import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ItemTooltip } from '../components/widgets/ItemTooltip';
import { CustomizationModal } from '../components/widgets/CustomizationModal';
import { BackpackWindow } from '../components/widgets/BackpackWindow';
import { WapHeader } from '../components/ui/WapHeader';
import { usePlayerStore, EQUIPMENT_SLOTS, GUN_SLOTS, gunSlotForWeapon, equipmentDelta, type EquipmentSlot } from '../stores/playerStore';
import { ammoTypeForWeapon, ammoGroupName, AMMO_GROUPS, effectiveAmmoCapacity, worseQuality, type AmmoGroup } from '../data/ammo';
import { syncNow } from '../utils/serverSync';
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
  armor: { top: Math.round(100 * S) - 12, left: Math.round(45 * S) },
  pants: { top: Math.round(146 * S), left: Math.round(45 * S) },
  weapon1: { top: Math.round(120 * S), left: Math.round(-35 * S) },
  weapon2: { top: Math.round(120 * S), left: Math.round(125 * S) },
  gloves: { top: Math.round(60 * S), left: Math.round(-20 * S) },
  boots: { top: Math.round(196 * S), left: Math.round(45 * S) },
  backpack: { top: Math.round(60 * S), left: Math.round(125 * S) },
};

const SLOT_LABELS: Record<string, string> = {
  head: 'Шлем', armor: 'Броня', pants: 'Штаны', weapon1: 'Ближний бой', weapon2: 'Автомат',
  gun_pistol: 'Пистолет', gun_shotgun: 'Дробовик', gun_sniper: 'Снайперка', gun_heavy: 'Тяжёлое',
  gloves: 'Перчатки', boots: 'Ботинки', backpack: 'Рюкзак',
};

// Слоты поверх силуэта + отдельный ряд оружейной сумки под куклой.
const OVERLAY_SLOTS = EQUIPMENT_SLOTS.filter((s) => !s.startsWith('gun_')) as EquipmentSlot[];
const GUN_ROW_SLOTS = EQUIPMENT_SLOTS.filter((s) => s.startsWith('gun_')) as EquipmentSlot[];

// Ключевые характеристики для сводки (остальное — под «Показать все»).
const KEY_STATS = ['damage', 'armor', 'maxHp', 'crit', 'evasion', 'speed', 'regen'] as const;

const STAT_LABELS: Record<string, string> = {
  damage: 'Урон', crit: 'Крит. шанс', armor: 'Броня', regen: 'Регенерация',
  evasion: 'Уклонение', block: 'Блок', punching: 'Дробящий', accuracy: 'Точность',
  vampir: 'Вампиризм', speed: 'Скорость', maxHp: 'Макс. HP',
  maxStamina: 'Выносливость', dpsEmi: 'ЭМИ урон', dpsToxis: 'Токсичный урон',
  dpsExtro: 'Экстро урон', dpsFire: 'Огненный урон',
  incomingDamageMult: 'Получаемый урон', bonusAp: 'Доп. AP', shieldCharges: 'Заряды щита',
};

const statValue = (k: string, v: number): { label: string; val: string; color: string } | null => {
    // Нули показываем (скорость 0 от штрафов должна быть видна, красным).
    // Прячем только базовую точность 0.1 без бонусов — шум.
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
  const activeWeaponSlot = usePlayerStore((s) => s.activeWeaponSlot);
  const setActiveWeaponSlot = usePlayerStore((s) => s.setActiveWeaponSlot);
  // Дельта от экипировки: отрицательная = штраф предмета (красный), иначе зелёный.
  const equipDelta = useMemo(
    () => equipmentDelta(equipment, activeWeaponSlot),
    [equipment, activeWeaponSlot],
  );
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
  const { playSound } = useSound();

  const [tooltipItem, setTooltipItem] = useState<Item | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [hoverSlot, setHoverSlot] = useState<string | null>(null);
  const [showAllStats, setShowAllStats] = useState(false);
  const [customizing, setCustomizing] = useState<{ item: Item | null; slot: string } | null>(null);
  const [backpackOpen, setBackpackOpen] = useState(false);
  // Замочек рюкзака живёт в сторе — переживает обновление страницы.
  const backpackLocked = useUiStore((s) => s.backpackLocked);
  const setBackpackLocked = useUiStore((s) => s.setBackpackLocked);
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

  const dragItem = useMemo(() => items.find((i) => i.id === draggedItemId), [items, draggedItemId]);  const validDropSlots = useMemo(() => {
    if (!dragItem) return new Set<string>();
    const slots = new Set<string>();
    // Пачку патронов можно бросить на любой надетый ствол с магазином.
    if ((dragItem as any).type === 'bullet') {
      for (const gs of GUN_SLOTS) {
        if ((equipment as any)[gs]?.ammoCapacity) slots.add(gs);
      }
    }
    if (!dragItem.slot) return slots;
    if (dragItem.slot === 'weapon2') {
      // Огнестрел — строго в свой классовый слот.
      slots.add(gunSlotForWeapon(dragItem));
    } else if (dragItem.slot === 'weapon1') {
      slots.add('weapon1');
    } else if ((EQUIPMENT_SLOTS as readonly string[]).includes(dragItem.slot)) {
      slots.add(dragItem.slot);
    }
    return slots;
  }, [dragItem, equipment]);

  const handleDrop = (slot: EquipmentSlot, e: React.DragEvent) => {
    e.preventDefault();
    // Фолбэк: dataTransfer иногда пуст — берём id из стора.
    const dtId = e.dataTransfer.getData('text/plain');
    const itemId = dtId || useUiStore.getState().draggedItemId;
    if (!itemId || itemId.startsWith('equip:')) return;
    // Патроны на надетый ствол — зарядка магазина, а не экипировка.
    if ((GUN_SLOTS as readonly string[]).includes(slot) && (equipment as any)[slot]?.ammoCapacity) {
      if (handleLoadMag(slot, itemId)) return;
    }
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    // Огнестрел — только в свой классовый слот.
    if (item.slot === 'weapon2' && gunSlotForWeapon(item) !== slot) {
      usePlayerStore.getState().addLog(`❌ Сюда не подходит: неси в «${SLOT_LABELS[gunSlotForWeapon(item)] || slot}».`, 'warning');
      return;
    }
    if (item.slot && item.slot !== slot && !(item.slot === 'weapon2' && (GUN_SLOTS as readonly string[]).includes(slot))) return;
    const old = equipment[slot];
    if (old) {
      // Замена: сначала снимаем старый, в инвентарь он уйдёт только если новый наделся.
      if (slot === 'backpack' && backpackLocked) {
        usePlayerStore.getState().addLog('🔒 Рюкзак под замком — сними замочек, чтобы снять.', 'warning');
        return;
      }
      unequipItem(slot);
    }
    if (equipItem(slot, item)) {
      removeItem(item.id);
      if (old) addItem(old);
      playSound('putting-on-a-safety-belt', 0.5);
    } else if (old) {
      // Не наделось — вернуть старый обратно, чтобы не потерять.
      equipItem(slot, old);
    }
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  // Выгрузить магазин из оружия в рюкзак (кнопка справа от слота).
  const handleUnload = (slot: EquipmentSlot) => {
    const pst = usePlayerStore.getState();
    const w = (pst.equipment as any)[slot];
    const loaded = w?.loadedAmmo || 0;
    if (!w || loaded <= 0) return;
    const back = pst.returnAmmoToPack(ammoTypeForWeapon(w), loaded, (w as any).loadedAmmoQuality || 'Обычный');
    const leftAfter = Math.max(0, (w.loadedAmmo || 0) - back);
    usePlayerStore.setState((st: any) => ({
      equipment: {
        ...st.equipment,
        [slot]: st.equipment[slot]
          ? { ...st.equipment[slot], loadedAmmo: leftAfter, loadedAmmoQuality: leftAfter <= 0 ? 'Обычный' : ((w as any).loadedAmmoQuality || 'Обычный') }
          : null,
      },
    }));
    pst.syncEquippedItem(slot);
    syncNow();
    playSound('reloading', 0.5);
    pst.addLog(`📤 Магазин выгружен в рюкзак (+${back})`, 'info');
  };

  // Зарядить надетый ствол патронами перетаскиванием на его слот.
  const handleLoadMag = (slot: EquipmentSlot, ammoItemId: string): boolean => {
    const pst = usePlayerStore.getState();
    const w = (pst.equipment as any)[slot];
    if (!w || !w.ammoCapacity) return false;
    const cap = effectiveAmmoCapacity(w);
    const loaded = w.loadedAmmo ?? 0;
    const space = cap - loaded;
    if (space <= 0) {
      pst.addLog('📀 Магазин уже полон.', 'warning');
      return true;
    }
    // Ищем пачку: сначала в инвентаре, потом в рюкзаке.
    const invItems = useInventoryStore.getState().items;
    const invIdx = invItems.findIndex((i) => i.id === ammoItemId);
    let ammo = invIdx !== -1 ? invItems[invIdx] : undefined;
    let from: 'inv' | 'pack' | null = invIdx !== -1 ? 'inv' : null;
    if (!ammo) {
      const pack = pst.backpackContents;
      const packIdx = pack.findIndex((i) => i.id === ammoItemId);
      if (packIdx !== -1) { ammo = pack[packIdx]; from = 'pack'; }
    }
    if (!ammo || from === null) return false;
    if ((ammo as any).type !== 'bullet') return false;
    // Группа пачки: явное поле, иначе по имени.
    const group = ((ammo as any).ammoGroup as AmmoGroup | undefined)
      || (AMMO_GROUPS.find((g) => g.packName === ammo!.name)?.key as AmmoGroup | undefined);
    if (!group) return false;
    if (group !== ammoTypeForWeapon(w)) {
      pst.addLog(`❌ Сюда нужны: ${ammoGroupName(ammoTypeForWeapon(w)).toLowerCase()}.`, 'warning');
      return true;
    }
    const take = Math.min(space, (ammo as any).quantity ?? 1);
    if (take <= 0) return true;
    const packQ = (ammo as any).quality || 'Обычный';
    const left = ((ammo as any).quantity ?? 1) - take;
    const leftName = (n: number) => packQ === 'Обычный' ? `${(ammo as any).name} x${n}` : `${(ammo as any).name} x${n} · ${packQ}`;
    if (from === 'inv') {
      if (left > 0) {
        useInventoryStore.setState((st: any) => ({
          items: st.items.map((i: any) => i.id === ammoItemId
            ? { ...i, quantity: left, displayName: leftName(left) }
            : i),
        }));
      } else {
        useInventoryStore.getState().removeItem(ammoItemId);
      }
    } else {
      usePlayerStore.setState((st: any) => ({
        backpackContents: left > 0
          ? st.backpackContents.map((i: any) => i.id === ammoItemId
            ? { ...i, quantity: left, displayName: leftName(left) }
            : i)
          : st.backpackContents.filter((i: any) => i.id !== ammoItemId),
      }));
    }
    // Качество магазина: пустой — качество пачки, дозарядка — худшее из двух.
    const oldQ = (w as any).loadedAmmoQuality || 'Обычный';
    const newQ = loaded <= 0 ? packQ : worseQuality(oldQ, packQ);
    usePlayerStore.setState((st: any) => ({
      equipment: {
        ...st.equipment,
        [slot]: st.equipment[slot]
          ? { ...st.equipment[slot], loadedAmmo: (st.equipment[slot].loadedAmmo ?? 0) + take, loadedAmmoQuality: newQ }
          : st.equipment[slot],
      },
    }));
    pst.syncEquippedItem(slot);
    syncNow();
    playSound('reloading', 0.5);
    pst.addLog(`📀 Заряжено: +${take} (${packQ}, магазин ${(loaded + take)}/${cap})`, 'info');
    return true;
  };

  const handleMouseEnter = (slot: string, item: Item | null, e: React.MouseEvent) => {
    setHoverSlot(slot);
    if (!item) return;
    setTooltipItem(item);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!tooltipItem) return;
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseLeave = () => {
    setHoverSlot(null);
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
      // Одинарный клик ничего не снимает: снятие только перетаскиванием
      // в инвентарь или заменой аналогичным предметом.
      if (!item) {
        setCustomizing({ item: null, slot });
        return;
      }
      // Клик по стволу — выбрать активным (зелёная рамка, урон с него).
      if ((GUN_SLOTS as readonly string[]).includes(slot)) {
        usePlayerStore.getState().setActiveWeaponSlot(slot as EquipmentSlot);
      }
    }, 220);
  };

  const handleSlotDoubleClick = (slot: string, item: Item | null) => {
    if (clickTimer.current !== null) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    if (slot === 'backpack' && item) { setBackpackOpen(true); return; }
    if (item) setCustomizing({ item, slot });
  };

  // Stats derived from equipped items
  const equippedItems = useMemo(() => EQUIPMENT_SLOTS.map((s) => equipment[s]).filter(Boolean) as Item[], [equipment]);
  const equippedCount = equippedItems.length;
  const avgLevel = equippedCount > 0 ? equippedItems.reduce((s, it) => s + (it.level || 0), 0) / equippedCount : 0;
  const avgStars = equippedCount > 0 ? equippedItems.reduce((s, it) => s + (QUALITY_STARS[it.quality || ''] || 0), 0) / equippedCount : 0;

  const renderSlotBox = (slot: EquipmentSlot, compact = false) => {
    const item = equipment[slot];
    const isGun = (GUN_SLOTS as readonly string[]).includes(slot);
    const isActiveGun = isGun && !!item && activeWeaponSlot === slot;
    const slotW = compact ? 60 : 72;
    const slotH = compact ? 52 : 64;
    const isOccupied = !!equipment[slot];
    // Подсветка совместимого слота: пустого и занятого (замена), патронам — стволы.
    const isDragTarget = !!draggedItemId && validDropSlots.has(slot);
    const isHover = hoverSlot === slot;

    const stars = item?.quality ? (QUALITY_STARS[item.quality] || 0) : 0;
    const frame = isActiveGun
      ? '#22c55e'
      : isDragTarget
        ? 'rgba(34,197,94,0.8)'
        : item
          ? (item.qualityColor || '#818cf8')
          : 'rgba(255,255,255,0.14)';
    const caption = item ? (item.displayName || item.name) : SLOT_LABELS[slot];
    return (
      <div key={slot} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div
          onDrop={(e) => handleDrop(slot, e)}
          onDragOver={handleDragOver}
          onMouseEnter={(e) => handleMouseEnter(slot, item, e)}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={() => handleSlotClick(slot, item)}
          onDoubleClick={() => handleSlotDoubleClick(slot, item)}
          draggable={!!item}
          onDragStart={(e) => { if (item) { e.dataTransfer.setData('text/plain', `equip:${slot}`); useUiStore.getState().setDraggedItemId(`equip:${slot}`); } }}
          onDragEnd={() => useUiStore.getState().setDraggedItemId(null)}
          title={item
            ? `${caption} — тяни в инвентарь, чтобы снять${isGun && item.ammoCapacity ? ` · патроны ${item.loadedAmmo || 0}/${effectiveAmmoCapacity(item)}` : ''}${isGun ? ' · клик — выбрать активным' : ''}`
            : caption}
          style={{
            width: slotW,
            height: slotH,
            background: isDragTarget
              ? 'rgba(34,197,94,0.15)'
              : item
                ? `linear-gradient(135deg, ${item.qualityColor || '#818cf8'}26, rgba(0,0,0,0.45))`
                : 'rgba(0,0,0,0.35)',
            border: `2px ${item || isDragTarget ? 'solid' : 'dashed'} ${frame}`,
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: isActiveGun
              ? '0 0 18px rgba(34,197,94,0.7)'
              : isDragTarget
                ? '0 0 18px rgba(34,197,94,0.5)'
                : isHover
                  ? `0 0 14px ${(item?.qualityColor || '#818cf8') + '88'}`
                  : item
                    ? `0 0 10px ${(item.qualityColor || '#818cf8') + '55'}`
                    : 'none',
            cursor: item ? 'grab' : 'pointer',
            transition: 'all 120ms',
          }}
        >
          {item ? (
            <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              {(() => { const url = getItemImage(item.name, item.displayName, item.slot, (item as any).type); return url ? <img src={url} alt="" draggable={false} style={{ width: 52, height: 52, objectFit: 'contain', imageRendering: 'pixelated' }} /> : null; })()}
              <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1, marginTop: 2, textAlign: 'center' }}>
                {item.level || 0} ур.
              </div>
              {isGun && (item as any).ammoCapacity != null && (
                <div style={{
                  position: 'absolute', bottom: 2, right: 3,
                  fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
                  color: '#fbbf24', background: 'rgba(0,0,0,0.75)',
                  borderRadius: 3, padding: '0 3px', lineHeight: '12px',
                }}>
                  {(item as any).loadedAmmo ?? 0}/{effectiveAmmoCapacity(item as any)}
                </div>
              )}
            </div>
          ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', opacity: isHover ? 0.8 : 0.55 }}>
            <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.22)' }}>+</span>
          </div>
          )}
        </div>
        <div style={{
          fontSize: 10, lineHeight: 1.2, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1,
          color: item ? (item.qualityColor || 'var(--text-secondary)') : 'var(--text-muted)',
          maxWidth: slotW + 20, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {SLOT_LABELS[slot] || caption}
          {isGun && item?.ammoCapacity ? (
            <span style={{ color: '#fbbf24' }}> · {item.loadedAmmo ?? 0}/{effectiveAmmoCapacity(item)}</span>
          ) : null}
          {isActiveGun ? (
            <span style={{ color: '#22c55e' }}> ●</span>
          ) : null}
        </div>
        {stars > 0 && (
          <div style={{ fontSize: 9, color: '#fbbf24', lineHeight: 1, whiteSpace: 'nowrap' }}>
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
    { label: '🔥 Стихийные', keys: ['dpsEmi', 'dpsToxis', 'dpsExtro', 'dpsFire'] },
  ];
  // В полном древе не дублируем краткий список сверху.
  const KEY_SET = new Set<string>(KEY_STATS as readonly string[]);

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
        padding: 20,
        display: 'flex', gap: 20, minWidth: 700, maxWidth: '100%',
      }}>
        {/* LEFT: hero paper-doll */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
          padding: '16px 10px', background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: 'var(--text-muted)' }}>🔫 ОРУЖЕЙНАЯ СУМКА</div>
          <div style={{ display: 'flex', gap: 12 }}>
            {GUN_ROW_SLOTS.map((slot) => {
              const gw = (equipment as any)[slot];
              return (
                <div key={slot} style={{ position: 'relative' }}>
                  {renderSlotBox(slot)}
                  {gw?.ammoCapacity ? (
                    <div
                      onClick={(e) => { e.stopPropagation(); handleUnload(slot); }}
                      title={(gw?.loadedAmmo || 0) > 0
                        ? `Выгрузить магазин (${gw?.loadedAmmo} шт.) в рюкзак`
                        : 'Магазин пуст — перетащи сюда пачку патронов, чтобы зарядить'}
                      style={{
                        position: 'absolute', top: 14, right: -14,
                        width: 22, height: 22, cursor: 'pointer', lineHeight: 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: (gw?.loadedAmmo || 0) > 0 ? 1 : 0.45,
                        filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.8))',
                      }}
                    >
                      {images.unloadMag
                        ? <img src={images.unloadMag} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} draggable={false} />
                        : '📤'}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: 'var(--text-muted)' }}>🛡️ ГЕРОЙ</div>
          <div style={{ position: 'relative', width: 207, height: 396, margin: '0 66px 0 60px', flexShrink: 0 }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, width: 207, height: 359,
              backgroundImage: images.main ? `url(${images.main})` : 'none',
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center top',
              borderRadius: 60,
              opacity: 0.95,
            }} />
            {OVERLAY_SLOTS.map((slot) => {
              const pos = SLOT_POSITIONS[slot];
              const gw = (equipment as any)[slot];
              const showUnload = ((GUN_SLOTS as readonly string[]).includes(slot)) && gw?.ammoCapacity;
              return (
                <div key={slot} style={{ position: 'absolute', top: pos.top, left: pos.left }}>
                  {renderSlotBox(slot)}
                  {/* Выгрузка магазина — всегда справа от ствола, если он надет */}
                  {showUnload ? (
                    <div
                      onClick={(e) => { e.stopPropagation(); handleUnload(slot); }}
                      title={(gw?.loadedAmmo || 0) > 0
                        ? `Выгрузить магазин (${gw?.loadedAmmo} шт.) в рюкзак`
                        : 'Магазин пуст — перетащи сюда пачку патронов, чтобы зарядить'}
                      style={{
                        position: 'absolute', top: 14, right: -16,
                        width: 24, height: 24, cursor: 'pointer', lineHeight: 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: (gw?.loadedAmmo || 0) > 0 ? 1 : 0.45,
                        filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.8))',
                      }}
                    >
                      {images.unloadMag
                        ? <img src={images.unloadMag} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} draggable={false} />
                        : '📤'}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {/* Замочек рюкзака — справа от слота, не под подписью */}
            <div
              onClick={(e) => { e.stopPropagation(); setBackpackLocked(!backpackLocked); }}
              title={backpackLocked ? 'Снять замочек' : 'Замочек: клик не снимет рюкзак'}
              style={{
                position: 'absolute',
                top: SLOT_POSITIONS.backpack.top + 18,
                left: SLOT_POSITIONS.backpack.left + 76,
                width: 22, height: 22, cursor: 'pointer', lineHeight: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: backpackLocked ? 1 : 0.45,
                filter: backpackLocked ? 'drop-shadow(0 0 4px rgba(251,191,36,0.8))' : 'grayscale(0.8)',
              }}
            >
              {images.backpackLock
                ? <img src={images.backpackLock} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} draggable={false} />
                : (backpackLocked ? '🔒' : '🔓')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', width: '100%' }}>
            {[
              { v: `${equippedCount}/${EQUIPMENT_SLOTS.length}`, l: 'надето' },
              { v: `⭐ ${avgStars.toFixed(1)}`, l: 'качество' },
              { v: `${avgLevel.toFixed(1)}`, l: 'ср. уровень' },
            ].map((t) => (
              <div key={t.l} style={{
                minWidth: 88, padding: '8px 6px', textAlign: 'center',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8,
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{t.v}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minWidth: 280 }}>
          <div style={{
            padding: 16, background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: 'var(--text-muted)', marginBottom: 12 }}>📊 ХАРАКТЕРИСТИКИ</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, marginBottom: 10 }}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Мощность</span>
              <span
                style={{ color: 'var(--wa-accent-amber)', fontWeight: 700, cursor: 'help', borderBottom: '1px dashed rgba(251,191,36,0.3)' }}
                onMouseEnter={(e) => { setShowPowerBreakdown(true); setPowerTooltipPos({ x: e.clientX, y: e.clientY }); }}
                onMouseMove={(e) => setPowerTooltipPos({ x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setShowPowerBreakdown(false)}
              >
                {(stats.power || 0).toLocaleString()}
              </span>
            </div>
            <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(217,119,6,0.3), transparent)', marginBottom: 8 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {KEY_STATS.map((k) => {
                const sv = statValue(k, stats[k] ?? 0);
                if (!sv) return null;
                // Зелёным — норма, красным — занижено штрафом экипировки.
                const lowered = (equipDelta[k as keyof typeof equipDelta] ?? 0) < 0;
                return (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: '#a0aec0' }}>{sv.label}</span>
                    <span style={{ color: lowered ? '#f87171' : '#4ade80', fontWeight: 600 }}>{sv.val}</span>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => setShowAllStats((v) => !v)}
              style={{
                marginTop: 10, width: '100%', padding: '6px 0',
                background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12,
              }}
            >
              {showAllStats ? '▴ Скрыть полное древо' : '▾ Показать все характеристики'}
            </button>
            {showAllStats && statGroups.map((g) => {
              const entries = g.keys
                .filter((k) => !KEY_SET.has(k as string))
                .map((k) => ({ key: k, ...(statValue(k, stats[k] ?? 0) ?? { label: '', val: '', color: '' }) }))
                .filter((e) => e.label);
              if (entries.length === 0) return null;
              return (
                <div key={g.label} style={{ fontSize: 12, lineHeight: 1.7, marginTop: 8 }}>
                  <div style={{ color: '#a16207', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 1 }}>{g.label}</div>
                  {entries.map((e) => {
                    const lowered = (equipDelta[e.key as keyof typeof equipDelta] ?? 0) < 0;
                    return (
                      <div key={e.key} style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 8 }}>
                        <span style={{ color: '#a0aec0' }}>{e.label}</span>
                        <span style={{ color: lowered ? '#f87171' : '#4ade80', fontWeight: 600 }}>{e.val}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
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
      {backpackOpen && <BackpackWindow onClose={() => setBackpackOpen(false)} />}
    </motion.div>
  );
};