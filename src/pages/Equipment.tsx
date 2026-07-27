import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ItemTooltip } from '../components/widgets/ItemTooltip';
import { CustomizationModal } from '../components/widgets/CustomizationModal';
import { WapHeader } from '../components/ui/WapHeader';
import { usePlayerStore, EQUIPMENT_SLOTS, type EquipmentSlot } from '../stores/playerStore';
import { useInventoryStore } from '../stores/inventoryStore';
import { useUiStore } from '../stores/uiStore';
import { getItemImage, images } from '../assets/index';
import { useSound } from '../hooks/useSound';
import { calcItemPower } from '../utils/itemPower';
import type { Item } from '../types/items';

const QUALITY_STARS: Record<string, number> = {
  'Обычный': 1, 'Редкий': 2, 'Раритетный': 3, 'Эпический': 4,
  'Смертоносный': 5, 'Легендарный': 6, 'Божественный': 7,
};

const S = 1.38;
const SLOT_POSITIONS: Record<string, { top: number; left: number }> = {
  head: { top: Math.round(12 * S), left: Math.round(45 * S) },
  armor: { top: Math.round(100 * S), left: Math.round(45 * S) },
  weapon1: { top: Math.round(120 * S), left: Math.round(-35 * S) },
  weapon2: { top: Math.round(120 * S), left: Math.round(125 * S) },
  gloves: { top: Math.round(60 * S), left: Math.round(-20 * S) },
  boots: { top: Math.round(170 * S), left: Math.round(45 * S) },
  ammo1: { top: Math.round(220 * S), left: Math.round(19 * S) },
  ammo2: { top: Math.round(220 * S), left: Math.round(131 * S) },
  ammo3: { top: Math.round(220 * S), left: Math.round(-38 * S) },
  ammo4: { top: Math.round(220 * S), left: Math.round(75 * S) },
};

const SLOT_LABELS: Record<string, string> = {
  head: 'Шлем', armor: 'Броня', weapon1: 'Оружие', weapon2: 'Вторая рука',
  gloves: 'Перчатки', boots: 'Ботинки',
  ammo1: 'Ам1', ammo2: 'Ам2', ammo3: 'Ам3', ammo4: 'Ам4',
};

const STAT_LABELS: Record<string, string> = {
  damage: 'Урон', crit: 'Крит. шанс', armor: 'Броня', regen: 'Регенерация',
  evasion: 'Уклонение', block: 'Блок', punching: 'Дробящий', accuracy: 'Точность',
  vampir: 'Вампиризм', speed: 'Скорость', maxHp: 'Макс. HP',
  maxStamina: 'Выносливость', dpsEmi: 'ЭМИ урон', dpsToxis: 'Токсичный урон',
  dpsExtro: 'Экстро урон', dpsFire: 'Огненный урон',
};

const statValue = (k: string, v: number): { label: string; val: string; color: string } | null => {
    if (v === 0 && k !== 'accuracy') return null;
    if (k === 'accuracy' && v === 0.1) return null;
    const label = STAT_LABELS[k] || k;
    const pctKeys = ['crit', 'evasion', 'block', 'vampir', 'accuracy', 'speed', 'incomingDamageMult'];
    const val = pctKeys.includes(k) ? `${(v * 100).toFixed(v >= 0.1 ? 1 : 2)}%` : (v >= 1 ? v.toFixed(1) : v.toFixed(3));
    const color = ['damage', 'crit', 'accuracy', 'punching', 'dpsEmi', 'dpsToxis', 'dpsExtro', 'dpsFire'].includes(k)
      ? '#f87171' : k === 'maxHp' || k === 'armor' || k === 'evasion' || k === 'block'
        ? '#4ade80' : '#94a3b8';
    return { label, val, color };
  };

export const Equipment = () => {
  const equipment = usePlayerStore((s) => s.equipment);
  const stats = usePlayerStore((s) => s.stats);
  const powerBreakdown = usePlayerStore((s) => s.powerBreakdown);
  const equipItem = usePlayerStore((s) => s.equipItem);
  const unequipItem = usePlayerStore((s) => s.unequipItem);
  const items = useInventoryStore((s) => s.items);
  const removeItem = useInventoryStore((s) => s.removeItem);
  const addItem = useInventoryStore((s) => s.addItem);
  const draggedItemId = useUiStore((s) => s.draggedItemId);
  const equipmentOpen = useUiStore((s) => s.equipmentOpen);
  const toggleEquipment = useUiStore((s) => s.toggleEquipment);
  const setEquipmentOpen = useUiStore((s) => s.setEquipmentOpen);
  const equipmentPinned = useUiStore((s) => s.equipmentPinned);
  const setEquipmentPinned = useUiStore((s) => s.setEquipmentPinned);
  const equipmentPinPos = useUiStore((s) => s.equipmentPinPos);
  const setEquipmentPinPos = useUiStore((s) => s.setEquipmentPinPos);
  const { playEquip } = useSound();

  const [tooltipItem, setTooltipItem] = useState<Item | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [customizing, setCustomizing] = useState<{ item: Item | null; slot: string } | null>(null);
  const [showPowerBreakdown, setShowPowerBreakdown] = useState(false);
  const [powerTooltipPos, setPowerTooltipPos] = useState({ x: 0, y: 0 });
  const [pos, setPos] = useState(equipmentPinPos);
  const dragRef = useRef<{ dragging: boolean; startX: number; startY: number; startPosX: number; startPosY: number }>({ dragging: false, startX: 0, startY: 0, startPosX: 0, startPosY: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current.dragging) return;
      const newX = Math.max(0, Math.min(window.innerWidth - 640, dragRef.current.startPosX + e.clientX - dragRef.current.startX));
      const newY = Math.max(0, Math.min(window.innerHeight - 100, dragRef.current.startPosY + e.clientY - dragRef.current.startY));
      setPos({ x: newX, y: newY });
      setEquipmentPinPos({ x: newX, y: newY });
    };
    const onUp = () => { dragRef.current.dragging = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [setEquipmentPinPos]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current.dragging = true;
    dragRef.current.startX = e.clientX;
    dragRef.current.startY = e.clientY;
    dragRef.current.startPosX = pos.x;
    dragRef.current.startPosY = pos.y;
    e.preventDefault();
  }, [pos]);

  const dragItem = useMemo(() => items.find((i) => i.id === draggedItemId), [items, draggedItemId]);
  const validDropSlots = useMemo(() => {
    if (!dragItem) return new Set<string>();
    const slots = new Set<string>();
    if (!dragItem.slot) return slots;
    if (dragItem.slot === 'ammo') {
      EQUIPMENT_SLOTS.filter((s) => s.startsWith('ammo')).forEach((s) => slots.add(s));
    } else if (EQUIPMENT_SLOTS.includes(dragItem.slot as any)) {
      slots.add(dragItem.slot);
    }
    return slots;
  }, [dragItem]);

  const handleDrop = (slot: EquipmentSlot, e: React.DragEvent) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('text/plain');
    if (!itemId) return;
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    if (item.slot && item.slot !== slot && !(item.slot === 'ammo' && slot.startsWith('ammo'))) return;
    if (equipItem(slot, item)) {
      removeItem(item.id);
      playEquip();
    }
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleUnequip = (slot: EquipmentSlot) => {
    const item = unequipItem(slot);
    if (item) addItem(item);
    setTooltipItem(null);
  };

  const handleMouseEnter = (slot: string, item: Item | null, e: React.MouseEvent) => {
    if (!item) return;
    setTooltipItem(item);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!tooltipItem) return;
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseLeave = () => {
    setTooltipItem(null);
  };

  const clickTimer = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (clickTimer.current !== null) clearTimeout(clickTimer.current);
    };
  }, []);

  const handleSlotClick = (slot: string, item: Item | null) => {
    if (clickTimer.current !== null) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = null;
      if (item) {
        handleUnequip(slot as EquipmentSlot);
      } else {
        setCustomizing({ item: null, slot });
      }
    }, 220);
  };

  const handleSlotDoubleClick = (slot: string, item: Item | null) => {
    if (clickTimer.current !== null) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    if (item) setCustomizing({ item, slot });
  };

  // Stats derived from equipped items
  const equippedItems = useMemo(() => EQUIPMENT_SLOTS.map((s) => equipment[s]).filter(Boolean) as Item[], [equipment]);
  const equippedCount = equippedItems.length;
  const avgLevel = equippedCount > 0 ? equippedItems.reduce((s, it) => s + (it.level || 0), 0) / equippedCount : 0;
  const avgStars = equippedCount > 0 ? equippedItems.reduce((s, it) => s + (QUALITY_STARS[it.quality || ''] || 0), 0) / equippedCount : 0;

  const renderSlot = (slot: EquipmentSlot) => {
    const item = equipment[slot];
    const pos = SLOT_POSITIONS[slot];
    const isAmmo = slot.startsWith('ammo');
    const slotW = isAmmo ? 53 : 64;
    const slotH = isAmmo ? 44 : 55;
    const isOccupied = !!equipment[slot];
    const isDragTarget = draggedItemId && validDropSlots.has(slot) && !isOccupied;

    const stars = item?.quality ? (QUALITY_STARS[item.quality] || 0) : 0;

    return (
      <div key={slot} style={{ position: 'absolute', top: pos.top, left: pos.left, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div
          onDrop={(e) => handleDrop(slot, e)}
          onDragOver={handleDragOver}
          onMouseEnter={(e) => handleMouseEnter(slot, item, e)}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={() => handleSlotClick(slot, item)}
          onDoubleClick={() => handleSlotDoubleClick(slot, item)}
          style={{
            width: slotW,
            height: slotH,
            background: isDragTarget
              ? 'rgba(34,197,94,0.15)'
              : item
                ? `linear-gradient(135deg, ${item.qualityColor || '#818cf8'}22, rgba(0,0,0,0.4))`
                : 'rgba(0,0,0,0.35)',
            border: `2px solid ${
              isDragTarget
                ? 'rgba(34,197,94,0.8)'
                : item
                  ? (item.qualityColor || '#818cf8')
                  : 'rgba(255,255,255,0.08)'
            }`,
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: isDragTarget
              ? '0 0 18px rgba(34,197,94,0.5)'
              : item
                ? `0 0 10px ${(item.qualityColor || '#818cf8') + '66'}`
                : 'none',
            cursor: 'pointer',
            transition: 'all 120ms',
          }}
        >
          {item ? (
            <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              {(() => { const url = getItemImage(item.name, item.displayName); return url ? <img src={url} alt="" style={{ width: isAmmo ? 35 : 42, height: isAmmo ? 31 : 42, objectFit: 'contain', imageRendering: 'pixelated' }} /> : null; })()}
              <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1, marginTop: 1, textAlign: 'center' }}>
                {item.level || 0} ур.
              </div>
              {isAmmo && (item.quantity || 0) > 1 && (
                <div style={{
                  position: 'absolute', bottom: 1, right: 2,
                  fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
                  color: '#fff', background: 'rgba(0,0,0,0.75)',
                  borderRadius: 2, padding: '0 2px', lineHeight: '12px',
                }}>
                  x{item.quantity}
                </div>
              )}
            </div>
          ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)' }}>{SLOT_LABELS[slot]}</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.06)' }}>+</span>
          </div>
          )}
        </div>
        {stars > 0 && (
          <div style={{ fontSize: 9, color: '#fbbf24', lineHeight: 1, marginTop: 1, whiteSpace: 'nowrap' }}>
            {'★'.repeat(Math.min(stars, 5))}
          </div>
        )}
      </div>
    );
  };

  const statGroups: { label: string; keys: (keyof typeof stats)[] }[] = [
    { label: '⚔️ Боевые', keys: ['damage', 'crit', 'accuracy', 'punching'] },
    { label: '🛡️ Защита', keys: ['armor', 'evasion', 'block', 'maxHp'] },
    { label: '♻️ Прочее', keys: ['maxStamina', 'regen', 'vampir', 'speed'] },
    { label: '🔥 Урон (DPS)', keys: ['dpsEmi', 'dpsToxis', 'dpsExtro', 'dpsFire'] },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 600, userSelect: 'none' }}
    >
      <WapHeader title="⚔️ ЭКИПИРОВКА" glow="amber" onMouseDown={onMouseDown}
        style={{ background: 'linear-gradient(180deg, rgb(217,119,6), rgb(146,64,14))' }}>
        <span
          onClick={(e) => { e.stopPropagation(); setEquipmentPinned(!equipmentPinned); }}
          style={{ cursor: 'pointer', fontSize: 13, color: equipmentPinned ? 'var(--accent-primary)' : 'var(--text-muted)', padding: '0 4px' }}
        >
          📌
        </span>
        <span
          onClick={(e) => { e.stopPropagation(); setEquipmentOpen(false); }}
          style={{ cursor: 'pointer', fontSize: 14, color: 'white', padding: '0 4px' }}
        >
          ✕
        </span>
      </WapHeader>

      <div style={{
        background: 'linear-gradient(180deg, rgb(20,12,8), rgb(10,8,5))',
        border: '2px solid rgba(217,119,6,0.2)',
        borderRadius: '0 0 8px 8px',
        boxShadow: [
          '0 0 0 1px rgba(217,119,6,0.3)',
          '0 0 12px rgba(217,119,6,0.06)',
          'inset 0 0 30px rgba(217,119,6,0.02)',
        ].join(', '),
        padding: '11px 15px',
        display: 'flex', gap: 18, minWidth: 550,
      }}>
        {/* Left: stats panel */}
        <div style={{ minWidth: 220, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {/* Summary line */}
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ background: 'rgba(251,191,36,0.1)', padding: '2px 8px', borderRadius: 4 }}>📦 {equippedCount}/10</span>
            <span style={{ color: '#fbbf24' }}>⭐ {avgStars.toFixed(1)}</span>
            <span>📊 {avgLevel.toFixed(1)} ур.</span>
          </div>

          {/* Total power */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, letterSpacing: 0.5 }}>
            <span style={{ color: 'var(--text-muted)' }}>🟡</span>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>МОЩНОСТЬ</span>
            <span
              style={{ color: 'var(--wa-accent-amber)', fontWeight: 700, cursor: 'help', borderBottom: '1px dashed rgba(251,191,36,0.3)' }}
              onMouseEnter={(e) => { setShowPowerBreakdown(true); setPowerTooltipPos({ x: e.clientX, y: e.clientY }); }}
              onMouseMove={(e) => setPowerTooltipPos({ x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setShowPowerBreakdown(false)}
            >
              {(stats.power || 0).toLocaleString()}
            </span>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(217,119,6,0.3), transparent)' }} />

          {/* Stat groups */}
          {statGroups.map((g) => {
            const entries = g.keys
              .map((k) => ({ key: k, ...(statValue(k, stats[k] ?? 0) ?? { label: '', val: '', color: '' }) }))
              .filter((e) => e.label);
            if (entries.length === 0) return null;
            return (
              <div key={g.label} style={{ fontSize: 12, lineHeight: 1.7 }}>
                <div style={{ color: '#a16207', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 1 }}>{g.label}</div>
                {entries.map((e) => (
                  <div key={e.key} style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 8 }}>
                    <span style={{ color: '#a0aec0' }}>{e.label}</span>
                    <span style={{ color: e.color, fontWeight: 600 }}>{e.val}</span>
                  </div>
                ))}
              </div>
            );
          })}

        </div>

        {/* Right: character + slots */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 44 }}>
          <div style={{
            position: 'relative',
            width: Math.round(150 * S),
            height: Math.round(260 * S),
            backgroundImage: images.main ? `url(${images.main})` : 'none',
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            borderRadius: Math.round(49 * S),
            overflow: 'visible',
            flexShrink: 0,
          }}>
            {EQUIPMENT_SLOTS.map(renderSlot)}
          </div>
        </div>
      </div>

      {showPowerBreakdown && (
        <div style={{
          position: 'fixed',
          left: Math.min(powerTooltipPos.x + 14, window.innerWidth - 300),
          top: Math.min(powerTooltipPos.y - 8, window.innerHeight - 300),
          zIndex: 9999, width: 260,
          background: '#12121a', border: '1px solid rgba(251,191,36,0.3)',
          borderRadius: 4, padding: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5), 0 0 12px rgba(251,191,36,0.1)',
          pointerEvents: 'none', fontSize: 11,
        }}>
          <div style={{ fontWeight: 600, color: '#fbbf24', marginBottom: 6, fontSize: 12 }}>🟡 Разбор мощности</div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
            <span>⚔️ Атака (DPS ×3):</span>
            <span style={{ color: 'var(--text-primary)' }}>+{powerBreakdown.offensiveScore.toLocaleString()}</span>
          </div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
            <span>🛡️ Защита (EHP /10):</span>
            <span style={{ color: 'var(--text-primary)' }}>+{powerBreakdown.defensiveScore.toLocaleString()}</span>
          </div>
          {powerBreakdown.itemPowers.length > 0 && (
            <>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6, marginBottom: 4 }}>
                <div style={{ color: '#fbbf24', marginBottom: 4, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>⚙️ Предметы</div>
                {powerBreakdown.itemPowers.map((ip, i) => (
                  <div key={i} style={{ color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginBottom: 2, fontSize: 10 }}>
                    <span>{ip.slot} <span style={{ opacity: 0.4 }}>({ip.itemName})</span></span>
                    <span style={{ color: '#fbbf24' }}>+{ip.power}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {powerBreakdown.abilityItems.length > 0 && (
            <>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6, marginBottom: 4 }}>
                <div style={{ color: '#fbbf24', marginBottom: 4, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>💎 Способности амуниции</div>
                {powerBreakdown.abilityItems.map((ai, i) => (
                  <div key={i} style={{ color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginBottom: 2, fontSize: 10 }}>
                    <span>{ai.abilityName} <span style={{ opacity: 0.4 }}>({ai.itemName})</span></span>
                    <span style={{ color: '#fbbf24' }}>+{ai.power}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6, marginTop: 2, display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
            <span style={{ color: 'var(--text-primary)' }}>Итого</span>
            <span style={{ color: '#fbbf24' }}>{(stats.power || 0).toLocaleString()}</span>
          </div>
        </div>
      )}
      {tooltipItem && <ItemTooltip item={tooltipItem} x={tooltipPos.x} y={tooltipPos.y} />}

      {customizing && (
        <CustomizationModal
          item={customizing.item}
          slot={customizing.slot}
          onClose={() => setCustomizing(null)}
        />
      )}
    </motion.div>
  );
};