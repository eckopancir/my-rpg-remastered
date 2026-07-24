import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ItemTooltip } from '../components/widgets/ItemTooltip';
import { CustomizationModal } from '../components/widgets/CustomizationModal';
import { WapHeader } from '../components/ui/WapHeader';
import { WapPanel } from '../components/ui/WapPanel';
import { usePlayerStore, EQUIPMENT_SLOTS, type EquipmentSlot } from '../stores/playerStore';
import { useInventoryStore } from '../stores/inventoryStore';
import { useUiStore } from '../stores/uiStore';
import { getItemImage, images } from '../assets/index';
import { useSound } from '../hooks/useSound';
import type { Item } from '../types/items';
import { ABILITY_MAP } from '../data/accessoryAbilities';

const S = 1.5;
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

export const Equipment = () => {
  const equipment = usePlayerStore((s) => s.equipment);
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
  const [pos, setPos] = useState(equipmentPinPos);
  const dragRef = useRef<{ dragging: boolean; startX: number; startY: number; startPosX: number; startPosY: number }>({ dragging: false, startX: 0, startY: 0, startPosX: 0, startPosY: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current.dragging) return;
      const newX = Math.max(0, Math.min(window.innerWidth - 500, dragRef.current.startPosX + e.clientX - dragRef.current.startX));
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

  // Hover tooltip
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

  // Single click (item) → unequip; Single click (empty) → open customization
  // Double click (item) → open modification window
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

  const renderSlot = (slot: EquipmentSlot) => {
    const item = equipment[slot];
    const pos = SLOT_POSITIONS[slot];
    const isAmmo = slot.startsWith('ammo');
    const slotW = isAmmo ? 50 : 62;
    const slotH = isAmmo ? 42 : 54;
    const isOccupied = !!equipment[slot];
    const isDragTarget = draggedItemId && validDropSlots.has(slot) && !isOccupied;

    return (
      <div
        key={slot}
        onDrop={(e) => handleDrop(slot, e)}
        onDragOver={handleDragOver}
        onMouseEnter={(e) => handleMouseEnter(slot, item, e)}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={() => handleSlotClick(slot, item)}
        onDoubleClick={() => handleSlotDoubleClick(slot, item)}
        style={{
          position: 'absolute',
          top: pos.top,
          left: pos.left,
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
          borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: isDragTarget
            ? '0 0 14px rgba(34,197,94,0.5)'
            : item
              ? `0 0 8px ${(item.qualityColor || '#818cf8') + '66'}`
              : 'none',
          cursor: 'pointer',
          transition: 'all 120ms',
        }}
      >
        {item ? (
          <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {(() => { const url = getItemImage(item.name, item.displayName); return url ? <img src={url} alt="" style={{ width: isAmmo ? 40 : 48, height: isAmmo ? 36 : 48, objectFit: 'contain', imageRendering: 'pixelated' }} /> : null; })()}
            {isAmmo && (item.quantity || 0) > 1 && (
              <div style={{
                position: 'absolute', bottom: 0, right: 2,
                fontSize: 8, fontWeight: 600, fontFamily: 'var(--font-mono)',
                color: '#fff', background: 'rgba(0,0,0,0.7)',
                borderRadius: 2, padding: '0 3px', lineHeight: '13px',
              }}>
                x{item.quantity}
              </div>
            )}

          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.15)' }}>{SLOT_LABELS[slot]}</span>
            <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.08)' }}>🔧</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 600, userSelect: 'none' }}
    >
      {/* Title bar / drag handle */}
      <WapHeader title="⚔️ ЭКИПИРОВКА" glow="amber" onMouseDown={onMouseDown}
        style={{ background: 'linear-gradient(180deg, rgba(217,119,6,0.6), rgba(146,64,14,0.4))' }}>
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

      {/* Body */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(20,12,8,0.85), rgba(10,8,5,0.9))',
        border: '1px solid rgba(217,119,6,0.1)',
        borderRadius: '0 0 6px 6px',
        padding: '16px 32px',
        minWidth: 320,
      }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{
            position: 'relative',
            left: 15,
            width: Math.round(150 * S),
            height: Math.round(260 * S),
            backgroundImage: images.main ? `url(${images.main})` : 'none',
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            borderRadius: Math.round(49 * S),
            overflow: 'visible',
          }}>
            {EQUIPMENT_SLOTS.map(renderSlot)}
          </div>
        </div>
      </div>

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