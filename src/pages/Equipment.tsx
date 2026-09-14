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

// qualityColor бывает hex и именованным (white/gold/...) — безопасный rgba.
const NAMED_RGB: Record<string, string> = {
  white: '255,255,255', lime: '0,255,0', deepskyblue: '0,191,255',
  mediumpurple: '147,112,219', red: '255,0,0', gold: '255,215,0', cyan: '0,255,255',
};
const withAlpha = (c: string, a: number): string => {
  if (c.startsWith('#')) {
    const h = c.slice(1).padEnd(6, '8').slice(0, 6);
    const n = parseInt(/^[0-9a-fA-F]{6}$/.test(h) ? h : '818cf8', 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  return `rgba(${NAMED_RGB[c.toLowerCase()] || '129,140,248'},${a})`;
};

const S = 1.38;
// Вертикаль шлем/броня/ноги/ботинки: равный отступ 25px (слот 64px).
const SLOT_POSITIONS: Record<string, { top: number; left: number }> = {
  head: { top: Math.round(12 * S), left: Math.round(45 * S) },
  armor: { top: 106, left: Math.round(45 * S) },
  pants: { top: 196, left: Math.round(45 * S) },
  weapon1: { top: Math.round(120 * S), left: Math.round(-35 * S) },
  weapon2: { top: Math.round(120 * S), left: Math.round(125 * S) },
  gloves: { top: Math.round(60 * S), left: Math.round(-20 * S) },
  boots: { top: 285, left: Math.round(45 * S) },
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
const MAIN_STATS = ['damage', 'armor', 'maxStamina'] as const;
const SECOND_STATS = ['accuracy', 'crit', 'speed', 'punching', 'vampir', 'block', 'evasion', 'maxHp', 'regen'] as const;
const ELEM_STATS = ['dpsEmi', 'dpsToxis', 'dpsExtro', 'dpsFire'] as const;

const STAT_LABELS: Record<string, string> = {
  damage: 'Урон', crit: 'Крит. шанс', armor: 'Броня', regen: 'Регенерация',
  evasion: 'Уклонение', block: 'Блок', punching: 'Дробящий', accuracy: 'Меткость',
  vampir: 'Вампиризм', speed: 'Скорость', maxHp: 'Макс. HP',
  maxStamina: 'Выносливость', dpsEmi: 'ЭМИ урон', dpsToxis: 'Токсичный урон',
  dpsExtro: 'Экстро урон', dpsFire: 'Огненный урон',
  incomingDamageMult: 'Получаемый урон', bonusAp: 'Доп. AP', shieldCharges: 'Заряды щита',
};

// Палитра как в тултипе: красный урон, синий защита, зелёный живучесть, жёлтый точность/мобильность.
const STAT_TT_COLORS: Record<string, string> = {
  damage: '#f87171', punching: '#f87171', vampir: '#f87171', dpsExtro: '#f87171', dpsFire: '#f87171',
  armor: '#60a5fa', block: '#60a5fa', evasion: '#60a5fa', dpsEmi: '#60a5fa',
  regen: '#4ade80', maxHp: '#4ade80', maxStamina: '#4ade80', luck: '#4ade80', incomingDamageMult: '#4ade80', dpsToxis: '#4ade80',
  crit: '#fbbf24', accuracy: '#fbbf24', speed: '#fbbf24',
};

const PCT_KEYS = ['crit', 'evasion', 'vampir', 'accuracy', 'speed', 'punching', 'incomingDamageMult'];

// Формат штрафа экипировки для подписи рядом: "-3%".
const fmtPenalty = (k: string, d: number): string => {
  const a = Math.abs(d);
  if (k === 'block') return `${(a * 10).toFixed(a >= 0.1 ? 1 : 2)}%`;
  if (PCT_KEYS.includes(k)) {
    const p = a * 100;
    return `${p >= 10 ? p.toFixed(0) : p.toFixed(1).replace(/\.0$/, '')}%`;
  }
  return `${a >= 100 ? a.toFixed(0) : a >= 1 ? a.toFixed(1) : a.toFixed(2)}`;
};

const statValue = (k: string, v: number): { label: string; val: string; color: string } | null => {
    // Нули показываем (скорость 0 от штрафов должна быть видна, красным).
    // Прячем только базовую точность 0.1 без бонусов — шум.
    if (k === 'accuracy' && v === 0.1) return null;
    const label = STAT_LABELS[k] || k;
    const val = k === 'block' ? `${(v * 10).toFixed(v >= 0.1 ? 1 : 2)}%` : PCT_KEYS.includes(k) ? `${(v * 100).toFixed(v >= 0.1 ? 1 : 2)}%` : (v >= 1 ? v.toFixed(1) : v.toFixed(3));
    const color = STAT_TT_COLORS[k] || '#d1d5db';
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
    const bd: Record<string, number> = (w as any).loadedAmmoBreakdown || {};
    const qualities = Object.keys(bd);
    let totalBack = 0;
    if (qualities.length > 0) {
      for (const q of qualities) {
        const cnt = bd[q] || 0;
        if (cnt > 0) totalBack += pst.returnAmmoToPack(ammoTypeForWeapon(w), cnt, q);
      }
    } else {
      totalBack = pst.returnAmmoToPack(ammoTypeForWeapon(w), loaded, (w as any).loadedAmmoQuality || 'Обычный');
    }
    const leftAfter = Math.max(0, loaded - totalBack);
    usePlayerStore.setState((st: any) => ({
      equipment: {
        ...st.equipment,
        [slot]: st.equipment[slot]
          ? { ...st.equipment[slot], loadedAmmo: leftAfter, loadedAmmoQuality: leftAfter <= 0 ? 'Обычный' : ((w as any).loadedAmmoQuality || 'Обычный'), loadedAmmoBreakdown: leftAfter > 0 ? (w as any).loadedAmmoBreakdown : undefined }
          : null,
      },
    }));
    pst.syncEquippedItem(slot);
    syncNow();
    playSound('reloading', 0.5);
    pst.addLog(`📤 Магазин выгружен в рюкзак (+${totalBack})`, 'info');
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
      const pack = pst.backpackGrid.items;
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
      usePlayerStore.setState((st: any) => {
        const grid = st.backpackGrid;
        const items = grid.items.map((i: any) =>
          i.id === ammoItemId
            ? left > 0 ? { ...i, quantity: left, displayName: leftName(left) } : null
            : i,
        ).filter(Boolean);
        return { backpackGrid: { ...grid, items } };
      });
    }
    // Качество магазина: пустой — качество пачки, дозарядка — худшее из двух.
    const oldQ = (w as any).loadedAmmoQuality || 'Обычный';
    const newQ = loaded <= 0 ? packQ : worseQuality(oldQ, packQ);
    usePlayerStore.setState((st: any) => {
      const cur = st.equipment[slot];
      if (!cur) return st;
      const bd: Record<string, number> = loaded <= 0 ? {} : { ...((cur as any).loadedAmmoBreakdown || {}) };
      bd[packQ] = (bd[packQ] || 0) + take;
      return {
        equipment: {
          ...st.equipment,
          [slot]: { ...cur, loadedAmmo: (cur.loadedAmmo ?? 0) + take, loadedAmmoQuality: newQ, loadedAmmoBreakdown: bd },
        },
      };
    });
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

  // Строка характеристики в стиле тултипа: ◇ цветное значение + лейбл.
  // Штраф экипировки — красной подписью рядом ("-3%"), значение всегда цветом палитры.
  const renderStatRow = (k: string, valOverride?: string) => {
    const sv = statValue(k, (stats as any)[k] ?? 0);
    if (!sv) return null;
    const d = (equipDelta[k as keyof typeof equipDelta] ?? 0) as number;
    const penalty = d < 0 ? fmtPenalty(k, d) : null;
    return (
      <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, lineHeight: 1.4 }}>
        <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 10 }}>◇</span>
        <span style={{ flex: 1, color: 'rgba(255,255,255,0.82)' }}>
          <span style={{ color: sv.color, fontWeight: 600 }}>{valOverride ?? sv.val}</span>{' '}
          <span style={{ color: 'rgba(255,255,255,0.72)' }}>{sv.label}</span>
          {penalty && <span style={{ color: '#f87171', fontSize: 10, marginLeft: 6 }}>-{penalty}</span>}
        </span>
      </div>
    );
  };

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

    // RPG-ячейка: утопленный тёмный металл + уголки качества + свечение за предметом.
    // Зелёный только у функциональных состояний (активный ствол, дроп-таргет).
    const qc = item?.qualityColor || '#818cf8';
    const cc = isActiveGun ? '#22c55e' : isDragTarget ? '#4ade80' : qc;
    const glowBase = isActiveGun || isDragTarget ? '#22c55e' : qc;
    const caption = item ? (item.displayName || item.name) : SLOT_LABELS[slot];
    return (
      <div key={slot} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
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
            position: 'relative',
            overflow: 'hidden',
            background: item
              ? 'linear-gradient(180deg, #0e0e11 0%, #16161a 100%)'
              : isDragTarget
                ? 'rgba(34,197,94,0.15)'
                : 'rgba(0,0,0,0.35)',
            border: `1px ${item || isDragTarget ? 'solid' : 'dashed'} ${item ? 'rgba(255,255,255,0.08)' : (isDragTarget ? 'rgba(34,197,94,0.8)' : 'rgba(255,255,255,0.14)')}`,
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: isActiveGun
              ? '0 0 18px rgba(34,197,94,0.7), inset 0 2px 10px rgba(0,0,0,0.75)'
              : isDragTarget && item
                ? '0 0 18px rgba(34,197,94,0.5), inset 0 2px 10px rgba(0,0,0,0.75)'
                : item
                  ? `0 0 14px ${withAlpha(qc, 0.28)}, inset 0 2px 10px rgba(0,0,0,0.75), 0 1px 0 rgba(255,255,255,0.03)`
                  : 'none',
            cursor: item ? 'grab' : 'pointer',
            transition: 'all 120ms',
            filter: isHover && item ? 'brightness(1.12)' : 'none',
          }}
        >
          {item && (
            <>
              {/* Свечение качества за предметом */}
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(ellipse 72% 66% at 50% 55%, ${withAlpha(glowBase, 0.32)}, transparent 70%)` }} />
              {/* Уголки качества */}
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2, filter: (isHover || isActiveGun || isDragTarget) ? `drop-shadow(0 0 3px ${cc})` : 'none' }}>
                <div style={{ position: 'absolute', top: 3, left: 3, width: 9, height: 9, borderTop: `2px solid ${cc}`, borderLeft: `2px solid ${cc}`, borderTopLeftRadius: 5 }} />
                <div style={{ position: 'absolute', top: 3, right: 3, width: 9, height: 9, borderTop: `2px solid ${cc}`, borderRight: `2px solid ${cc}`, borderTopRightRadius: 5 }} />
                <div style={{ position: 'absolute', bottom: 3, left: 3, width: 9, height: 9, borderBottom: `2px solid ${cc}`, borderLeft: `2px solid ${cc}`, borderBottomLeftRadius: 5 }} />
                <div style={{ position: 'absolute', bottom: 3, right: 3, width: 9, height: 9, borderBottom: `2px solid ${cc}`, borderRight: `2px solid ${cc}`, borderBottomRightRadius: 5 }} />
              </div>
            </>
          )}
          {item ? (
            <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              {(() => { const url = getItemImage(item.name, item.displayName, item.slot, (item as any).type); return url ? <img src={url} alt="" draggable={false} style={{ width: 52, height: 52, objectFit: 'contain', imageRendering: 'pixelated', filter: `drop-shadow(0 4px 8px rgba(0,0,0,0.6)) drop-shadow(0 0 6px ${withAlpha(qc, 0.4)})` }} /> : null; })()}
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', lineHeight: 1, marginTop: 2, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, padding: '1px 4px' }}>
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
        background: 'linear-gradient(180deg, #1a1a1a 0%, #151515 58%, #23272b 100%)',
        border: '1px solid rgba(217,119,6,0.35)',
        borderRadius: '0 0 10px 10px',
        boxShadow: '0 16px 48px rgba(0,0,0,0.75), 0 0 24px rgba(217,119,6,0.08), 0 2px 0 rgba(255,255,255,0.04) inset',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <span style={{ width: 14, height: 1, background: 'rgba(251,191,36,0.4)' }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#fbbf24' }}>◆ ХАРАКТЕРИСТИКИ</span>
              <span style={{ flex: 1, height: 1, background: 'rgba(251,191,36,0.14)' }} />
            </div>
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
            {/* Главные — в отдельной рамке */}
            <div style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8, padding: '8px 10px', marginBottom: 10,
              display: 'flex', flexDirection: 'column', gap: 5,
            }}>
              {MAIN_STATS.map((k) => renderStatRow(k))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
              {SECOND_STATS.map((k) => renderStatRow(k))}
            </div>
            {/* Стихийный урон — отдельное окно, всегда 1 знак после запятой */}
            <div style={{
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 8, padding: '8px 10px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ width: 14, height: 1, background: 'rgba(251,191,36,0.4)' }} />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#fbbf24' }}>◆ СТИХИЙНЫЙ УРОН</span>
                <span style={{ flex: 1, height: 1, background: 'rgba(251,191,36,0.14)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {ELEM_STATS.map((k) => renderStatRow(k, ((stats as any)[k] ?? 0).toFixed(1)))}
              </div>
            </div>
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