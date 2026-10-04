import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUiStore } from '../../stores/uiStore';
import { usePlayerStore, gunSlotForWeapon } from '../../stores/playerStore';import { useInventoryStore } from '../../stores/inventoryStore';
import { getItemImage, isLargeArtWeapon } from '../../assets/index';
import { useSound } from '../../hooks/useSound';
import { WapHeader } from '../ui/WapHeader';
import { WapPanel } from '../ui/WapPanel';
import type { Item } from '../../types/items';
import { ItemTooltip } from './ItemTooltip';
import { ChestOpening } from './ChestOpening';
import { chestImageFor } from '../../data/chests';
import { GAME_ITEMS, GAME_RESOURCES } from '../../data/GameItems';
import { getBackpackImage, getBulletImage, getSchemeImage } from '../../assets/index';
import { getConsumableIcon } from '../../data/consumables';
import { calcItemPower } from '../../utils/itemPower';
import { effectiveItemStats, modLevelMult } from '../../utils/itemStats';
import { getSellPrice } from '../../utils/sellPrice';

const cellSize = 48;
const cols = 11;
const ITEMS_PER_PAGE = cols * 8;

const SLOT_FILTERS = [
  { value: '', label: 'All slots' },
  { value: 'weapon1', label: '— Ближний бой' },
  { value: 'shield', label: '— Щит' },
  { value: 'weapon2', label: '— Автомат' },
  { value: 'gun_pistol', label: '— Пистолет' },
  { value: 'gun_shotgun', label: '— Дробовик' },
  { value: 'gun_sniper', label: '— Снайперка' },
  { value: 'gun_heavy', label: '— Тяжёлое' },
  { value: 'head', label: '— Шлем' },
  { value: 'armor', label: '— Броня' },
  { value: 'pants', label: '— Штаны' },
  { value: 'gloves', label: '— Перчатки' },
  { value: 'boots', label: '— Ботинки' },
  { value: 'mod', label: '— Моды' },
  { value: 'material', label: '— Ресурсы' },
  { value: 'chest', label: '— Сундуки' },
  { value: 'consumable', label: '— Расходники' },
  { value: 'backpack', label: '— Рюкзаки' },
  { value: 'bullet', label: '— Патроны' },
  { value: 'blueprint', label: '— Сферы' },
];

const getItemTimestamp = (item: Item): number => {
  const ts = parseInt(item.id?.split('_')[0], 10);
  return isNaN(ts) ? 0 : ts;
};

const SORT_OPTIONS = [
  { value: '', label: 'Без сортировки' },
  { value: 'favorite', label: 'Избранное' },
  { value: 'power', label: 'Мощность' },
  { value: 'recent', label: 'Новые' },
  { value: 'level', label: 'Уровень' },
  { value: 'damage', label: 'Урон' },
  { value: 'armor', label: 'Броня' },
  { value: 'health', label: 'Здоровье' },
  { value: 'punching', label: 'Дробящий' },
  { value: 'critChance', label: 'Шанс крита' },
  { value: 'critDamage', label: 'Крит. урон' },
  { value: 'speed', label: 'Скорость' },
  { value: 'regen', label: 'Реген' },
  { value: 'evasion', label: 'Уклонение' },
  { value: 'accuracy', label: 'Точность' },
  { value: 'block', label: 'Блок' },
  { value: 'vampir', label: 'Вампиризм' },
  { value: 'stamina', label: 'Выносливость' },
  { value: 'price', label: 'Цена' },
  { value: 'rarity', label: 'Редкость' },
];

const RARITY_ORDER: Record<string, number> = {
  'Божественный': 7, 'Легендарный': 6, 'Смертоносный': 5, 'Эпический': 4,
  'Раритетный': 3, 'Редкий': 2, 'Обычный': 1,
};

const rarityRank = (item: Item): number =>
  RARITY_ORDER[item.quality || ''] ?? RARITY_ORDER[item.rarity || ''] ?? 0;

interface StackedItem {
  item: Item;
  count: number;
}

const stackItems = (items: Item[]): StackedItem[] => {
  const map = new Map<string, StackedItem>();
  for (const item of items) {
    if (item.type === 'material' || item.type === 'consumable' || item.type === 'bullet') {
      // Без качества = Обычный: иначе старые стаки не сливаются с новыми.
      const key = `${item.type}_${item.name}_${item.rarity}_${item.quality || 'Обычный'}`;
      const existing = map.get(key);
      if (existing) {
        existing.count += item.quantity || 1;
      } else {
        map.set(key, { item, count: item.quantity || 1 });
      }
    } else {
      map.set(`${item.id}`, { item, count: item.quantity || 1 });
    }
  }
  return Array.from(map.values());
};

const STAT_ALIASES: Record<string, string[]> = {
  health: ['health', 'maxHp'],
  maxHp: ['health', 'maxHp'],
};

const getStatValue = (item: Item, stat: string): number => {  if (stat === 'level') return item.level || 1;
  if (stat === 'price') return item.price || getSellPrice(item);
  // Как в тултипе: эффективные статы (моды + сферы), standalone-моды — со скейлом уровня.
  const eff = effectiveItemStats(item);
  const modMult = item.type === 'mod' ? modLevelMult(item) : 1;
  // Крит. урон — суммарный (легаси-% + бонус-пункты), иначе порядок врёт.
  if (stat === 'critDamage') return ((eff.crit || 0) + (eff.critDamage || 0)) * modMult;
  const keys = STAT_ALIASES[stat] || [stat];
  for (const key of keys) {
    const v = eff[key];
    const val = typeof v === 'object' ? ((v as any)?.base || 0) : (v || 0);
    if (val) return val * modMult;
  }
  return 0;
};

const slotFilterKey = (item: Item): string => {  if (item.type === 'mod') return 'mod';
  if (item.type === 'consumable') return 'consumable';
  if (item.type === 'material') return 'material';
  if (item.type === 'chest') return 'chest';
  if (item.type === 'backpack') return 'backpack';
  if (item.type === 'bullet') return 'bullet';
  if (item.type === 'blueprint') return 'blueprint';
  if (item.slot === 'ammo') return 'ammo';
  // Огнестрел раскладывается по классовым фильтрам.
  if (item.slot === 'weapon2') return gunSlotForWeapon(item);
  return item.slot || '';
};

// Закладки категорий слева: иконка — картинка предмета категории
// (снаряжение — из базы, остальное — из своих семейств спрайтов).
const tabRepFor = (value: string): { img?: string; emoji?: string } => {
  if (value === 'backpack') return { img: getBackpackImage('рейд') };
  if (value === 'bullet') return { img: getBulletImage('Патроны пистолетные') };
  if (value === 'blueprint') return { img: getSchemeImage('damage') };
  if (value === 'material') return { img: (GAME_RESOURCES[0] as any)?.image };
  if (value === 'consumable') return { emoji: '🧪' }; // у расходников арта нет — как в ячейках
  if (value === 'mod') return { img: getItemImage('Прицел', undefined, 'mod_scope', 'mod'), emoji: '🔧' };
  if (value === 'chest') return { img: chestImageFor('Обычный') };
  const rep: any = (GAME_ITEMS as any[]).find((d) => { try { return slotFilterKey(d as Item) === value; } catch { return false; } });
  if (!rep) return { emoji: '❔' };
  const url = getItemImage(rep.name, rep.displayName, rep.slot, rep.type);
  return url ? { img: url } : { emoji: rep.icon || '❔' };
};
const TABS: { value: string; label: string; img?: string; emoji?: string }[] = [
  { value: '', label: 'Все предметы', emoji: '📦' },
  ...SLOT_FILTERS.filter((f) => f.value !== '').map((f) => ({
    value: f.value,
    label: f.label.replace(/^— /, ''),
    ...tabRepFor(f.value),
  })),
];

export const InventoryOverlay = () => {
  const open = useUiStore((s) => s.inventoryOpen);
  const toggle = useUiStore((s) => s.toggleInventory);
  const setDraggedItemId = useUiStore((s) => s.setDraggedItemId);
  const inventoryPinned = useUiStore((s) => s.inventoryPinned);
  const setInventoryPinned = useUiStore((s) => s.setInventoryPinned);
  const inventoryPinPos = useUiStore((s) => s.inventoryPinPos);
  const setInventoryPinPos = useUiStore((s) => s.setInventoryPinPos);
  const items = useInventoryStore((s) => s.items);
  const removeItem = useInventoryStore((s) => s.removeItem);
  const setItems = useInventoryStore((s) => s.setItems);
  const favorites = useInventoryStore((s) => s.favorites);
  const seenIds = useInventoryStore((s) => s.seenIds);
  const toggleFavorite = useInventoryStore((s) => s.toggleFavorite);
  const markSeen = useInventoryStore((s) => s.markSeen);
  const equipItem = usePlayerStore((s) => s.equipItem);
  const takeOutBackpack = usePlayerStore((s) => s.takeOutBackpack);
  const equipment = usePlayerStore((s) => s.equipment);
  const useConsumable = usePlayerStore((s) => s.useConsumable);
  const addLog = usePlayerStore((s) => s.addLog);
  const dataChips = usePlayerStore((s) => s.dataChips);
  const stats = usePlayerStore((s) => s.stats);
  const { playClick, playEquip, playSound } = useSound();

  const [pos, setPos] = useState(inventoryPinPos);
  const [page, setPage] = useState(0);
  const [filterSlot, setFilterSlot] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; stacked: StackedItem; idx: number } | null>(null);
  const [hoveredItem, setHoveredItem] = useState<StackedItem | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [openingChest, setOpeningChest] = useState<Item | null>(null);
  // INV-6/9/10/13: shake ячейки, вылет вещи, тик стака, shimmer улучшения.
  const [shakeCell, setShakeCell] = useState<{ idx: number; t: number } | null>(null);
  const [dying, setDying] = useState<{ key: string; idx: number; t: number } | null>(null);
  const [tickMap, setTickMap] = useState<Record<string, number>>({});
  const [shimmerId, setShimmerId] = useState<{ id: string; t: number } | null>(null);
  const prevCounts = useRef<Record<string, number>>({});
  const prevSig = useRef<Record<string, string>>({});
  const dyingTimer = useRef<number | null>(null);
  useEffect(() => () => { if (dyingTimer.current !== null) window.clearTimeout(dyingTimer.current); }, []);

  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startPosX: 0, startPosY: 0 });

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('scroll', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close);
    };
  }, [contextMenu]);

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [filterSlot, sortBy]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current.dragging = true;
    dragRef.current.startX = e.clientX;
    dragRef.current.startY = e.clientY;
    dragRef.current.startPosX = pos.x;
    dragRef.current.startPosY = pos.y;
    e.preventDefault();
  }, [pos]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current.dragging) return;
      const newX = Math.max(0, Math.min(window.innerWidth - 580, dragRef.current.startPosX + e.clientX - dragRef.current.startX));
      const newY = Math.max(0, Math.min(window.innerHeight - 100, dragRef.current.startPosY + e.clientY - dragRef.current.startY));
      setPos({ x: newX, y: newY });
      setInventoryPinPos({ x: newX, y: newY });
    };
    const onUp = () => { dragRef.current.dragging = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [setInventoryPinPos]);

  // Stack + filter + sort
  const processed = useMemo(() => {
    let list = stackItems(items);

    if (filterSlot) {
      list = list.filter((s) => slotFilterKey(s.item) === filterSlot);
    }

    // Избранное: показываем только предметы со звёздочкой.
    if (sortBy === 'favorite') {
      list = list.filter((s) => favorites[s.item.id]);
    } else if (sortBy === 'power') {
      list = [...list].sort((a, b) => calcItemPower(b.item) - calcItemPower(a.item));
    } else if (sortBy === 'recent') {
      list = [...list].sort((a, b) => getItemTimestamp(b.item) - getItemTimestamp(a.item));
    } else if (sortBy === 'rarity') {
      list = [...list].sort((a, b) => rarityRank(b.item) - rarityRank(a.item));
    } else if (sortBy) {
      list = [...list].sort((a, b) => {
        const va = getStatValue(a.item, sortBy);
        const vb = getStatValue(b.item, sortBy);
        return vb - va;
      });
    }

    return list;
  }, [items, filterSlot, sortBy, favorites]);

  const totalPages = Math.max(1, Math.ceil(processed.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages - 1);
  // Счётчики закладок по категориям (пустые — приглушены).
  const tabCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of items) { const k = slotFilterKey(i); m[k] = (m[k] || 0) + 1; }
    return m;
  }, [items]);
  const pageItems = processed.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);
  const padded = [...pageItems];
  while (padded.length < ITEMS_PER_PAGE) padded.push(null as any);

  const rows = Math.ceil(padded.length / cols);

  const handleContext = (e: React.MouseEvent, stacked: StackedItem, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, stacked, idx });
  };

  // INV-9: вещь вылетает из ячейки (180мс), потом выполняется действие.
  const killWithAnim = (stacked: StackedItem, idx: number, fn: () => void) => {
    if (dyingTimer.current !== null) { window.clearTimeout(dyingTimer.current); dyingTimer.current = null; setDying(null); fn(); return; }
    setDying({ key: stacked.item.id, idx, t: Date.now() });
    dyingTimer.current = window.setTimeout(() => { dyingTimer.current = null; setDying(null); fn(); }, 180);
  };

  // INV-10/13: тик изменившегося стака + shimmer улучшенного предмета.
  useEffect(() => {
    const prevC = prevCounts.current;
    const prevS = prevSig.current;
    const first = Object.keys(prevC).length === 0;
    const nextC: Record<string, number> = {};
    const nextS: Record<string, string> = {};
    const ticks: Record<string, number> = {};
    for (const st of stackItems(items)) {
      const key = stackKeyOf(st.item);
      nextC[key] = (nextC[key] || 0) + st.count;
      const sig = `${st.item.level || 0}|${st.item.quality || ''}`;
      if (!nextS[st.item.id]) nextS[st.item.id] = sig;
      if (first) continue;
      if (prevC[key] !== undefined && prevC[key] !== nextC[key]) ticks[key] = Date.now();
      const ps = prevS[st.item.id];
      if (ps && ps !== sig) {
        const [pl, pq] = ps.split('|');
        const [cl, cq] = sig.split('|');
        if (+cl > +pl || (RARITY_ORDER[cq] ?? 0) > (RARITY_ORDER[pq] ?? 0)) setShimmerId({ id: st.item.id, t: Date.now() });
      }
    }
    if (Object.keys(ticks).length > 0) setTickMap((m) => ({ ...m, ...ticks }));
    prevCounts.current = nextC;
    prevSig.current = nextS;
  }, [items]);

  const handleEquip = (stacked: StackedItem) => {
    const item = stacked.item;
    const slot = getEquipSlotLocal(item);
    if (!slot) { addLog(`❌ ${item.displayName || item.name} нельзя экипировать`, 'warning'); return; }
    if (equipment[slot]) { addLog(`❌ Слот ${slot} занят`, 'warning'); return; }
    killWithAnim(stacked, contextMenu?.idx ?? -1, () => {
      if (equipItem(slot, item)) {
        if (!(item.type === 'material' && stacked.count > 1)) removeItem(item.id);
        playEquip();
      }
      setContextMenu(null);
    });
  };

  const handleUseConsumable = (stacked: StackedItem) => {
    const item = stacked.item;
    if (item.type !== 'consumable') { addLog(`❌ ${item.displayName || item.name} нельзя использовать`, 'warning'); return; }
    killWithAnim(stacked, contextMenu?.idx ?? -1, () => {
      useConsumable(item);
      setContextMenu(null);
    });
  };

  // Открытие сундука: забираем из инвентаря, дальше ведёт модалка.
  const openChest = (stacked: StackedItem, idx = -1) => {
    const item = stacked.item;
    if (item.type !== 'chest') return;
    killWithAnim(stacked, contextMenu?.idx ?? idx, () => {
      removeItem(item.id);
      setContextMenu(null);
      // Тултип сундука перекрывал анимацию — гасим ховер и закреплённые.
      setHoveredItem(null);
      useUiStore.getState().setTooltipPin(null);
      setOpeningChest(item);
    });
  };

  // Ключ группировки — как в stackItems (стаки по имени+качеству, остальное по id).
  const stackKeyOf = (item: Item): string => {
    if (item.type === 'material' || item.type === 'consumable' || item.type === 'bullet') {
      return `${item.type}_${item.name}_${item.rarity}_${item.quality || 'Обычный'}`;
    }
    return `id:${item.id}`;
  };

  // Ручная раскладка: дроп на ячейку вставляет предмет в эту позицию,
  // а не в конец. Работает только без сортировки/фильтра (иначе вид всё равно пересортирует).
  const handleCellDrop = (paddedIdx: number, e: React.DragEvent) => {
    const dtId = e.dataTransfer.getData('text/plain');
    const id = dtId || useUiStore.getState().draggedItemId;
    if (!id || id.startsWith('equip:') || id.startsWith('pack:') || id.startsWith('corpse:')) return;
    const all = useInventoryStore.getState().items;
    const fromIdx = all.findIndex((i) => i.id === id);
    if (fromIdx === -1) return;
    e.stopPropagation();
    e.preventDefault();
    if (sortBy || filterSlot) { addLog('📌 Убери сортировку и фильтр для ручной раскладки', 'warning'); setShakeCell({ idx: paddedIdx, t: Date.now() }); return; }
    const entry = padded[paddedIdx];
    if (entry && entry.item.id === id) return; // своя же ячейка
    const next = [...all];
    const [moved] = next.splice(fromIdx, 1);
    if (!entry) {
      // Пустая ячейка: вставить после последнего объекта текущей страницы, чтобы осталось на ней.
      let insertAt = next.length;
      for (let i = pageItems.length - 1; i >= 0; i--) {
        const repId = pageItems[i].item.id;
        const li = next.findIndex((o) => o.id === repId);
        if (li === -1) continue;
        const key = stackKeyOf(pageItems[i].item);
        insertAt = li + 1;
        while (insertAt < next.length && stackKeyOf(next[insertAt]) === key) insertAt++;
        break;
      }
      next.splice(insertAt, 0, moved);
    } else {
      // Вставить перед группой целевой ячейки.
      const key = stackKeyOf(entry.item);
      let at = next.findIndex((o) => o.id === entry.item.id);
      if (at === -1) at = next.findIndex((o) => stackKeyOf(o) === key);
      if (at === -1) next.push(moved);
      else next.splice(at, 0, moved);
    }
    setItems(next);
    playSound('clickbutton', 0.2);
  };

  const handleDrop = (stacked: StackedItem) => {    const item = stacked.item;
    killWithAnim(stacked, contextMenu?.idx ?? -1, () => {
      if (item.type === 'material' && stacked.count > 1) {
        // Reduce count
        useInventoryStore.setState((s) => {
          const idx = s.items.findIndex((i) => i.id === item.id);
          if (idx === -1) return {};
          const newItems = [...s.items];
          const qi = (newItems[idx].quantity || 1);
          if (qi > 1) {
            newItems[idx] = { ...newItems[idx], quantity: qi - 1 };
          } else {
            newItems.splice(idx, 1);
          }
          return { items: newItems };
        });
      } else {
        removeItem(item.id);
      }
      addLog(`🗑️ ${item.displayName || item.name} выброшен`, 'warning');
      setContextMenu(null);
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 600, userSelect: 'none' }}
        >
          {/* Title bar / drag handle */}
          <WapHeader title={`📦 ИНВЕНТАРЬ (${items.length})`} glow="teal" onMouseDown={onMouseDown}
            style={{ background: 'linear-gradient(180deg, rgb(217,119,6), rgb(146,64,14))' }}>
            <span style={{ fontFamily: 'var(--wa-font-hud)', fontSize: 11, color: 'var(--wa-accent-teal)' }}>
              💾 {dataChips}
            </span>
            <span
              onClick={(e) => { e.stopPropagation(); setInventoryPinned(!inventoryPinned); }}
              style={{ cursor: 'pointer', fontSize: 13, color: inventoryPinned ? 'var(--accent-primary)' : 'var(--text-muted)', padding: '0 4px' }}
            >
              📌
            </span>
            <span
              onClick={(e) => { e.stopPropagation(); toggle(); playClick(); }}
              style={{ cursor: 'pointer', fontSize: 14, color: 'white', padding: '0 4px' }}
            >
              ✕
            </span>
          </WapHeader>

          {/* Body */}
          <div style={{
            background: 'linear-gradient(180deg, #1a1a1a 0%, #151515 58%, #23272b 100%)',
            border: '1px solid rgba(217,119,6,0.35)',
            borderRadius: '0 0 10px 10px',
            boxShadow: '0 16px 48px rgba(0,0,0,0.75), 0 0 24px rgba(217,119,6,0.08), 0 2px 0 rgba(255,255,255,0.04) inset',
            padding: 8, minWidth: cols * (cellSize + 4) + 16 + 40,
          }}>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <select
                value={filterSlot}
                onChange={(e) => setFilterSlot(e.target.value)}
                style={{
                  flex: 1, padding: '4px 6px', fontSize: 11, background: '#141416',
                  color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.09)',
                  borderRadius: 6, outline: 'none', fontFamily: 'var(--font-sans)',
                }}
              >
                {SLOT_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  width: 140, padding: '4px 6px', fontSize: 11, background: '#141416',
                  color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.09)',
                  borderRadius: 6, outline: 'none', fontFamily: 'var(--font-sans)',
                }}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Grid (принимает возврат из рюкзака) + закладки категорий слева */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {TABS.map((t) => {
                  const active = filterSlot === t.value;
                  const n = t.value === '' ? items.length : (tabCounts[t.value] || 0);
                  return (
                    <div
                      key={t.value || 'all'}
                      title={n > 0 ? `${t.label} (${n})` : t.label}
                      onClick={() => { playClick(); setFilterSlot(active ? '' : t.value); }}
                      style={{
                        flex: 1, minHeight: 0, width: 34,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: 4, cursor: 'pointer',
                        border: `1px solid ${active ? 'var(--wa-accent-teal)' : 'rgba(255,255,255,0.08)'}`,
                        background: active ? 'rgba(45,212,191,0.15)' : 'rgba(0,0,0,0.35)',
                        boxShadow: active ? '0 0 8px rgba(45,212,191,0.35)' : 'none',
                        opacity: n === 0 && !active ? 0.35 : 1,
                      }}
                    >
                      {t.img
                        ? <img src={t.img} alt="" draggable={false} style={{ width: 20, height: 20, objectFit: 'contain' }} />
                        : <span style={{ fontSize: 15, lineHeight: 1 }}>{t.emoji}</span>}
                    </div>
                  );
                })}
              </div>
            <div
              key={`${filterSlot}|${sortBy}|${currentPage}`}
              className="invfx-reshuffle"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
                gap: 2,
              }}
              onDrop={(e) => {
                e.preventDefault();
                const dtId = e.dataTransfer.getData('text/plain');
                const id = dtId || useUiStore.getState().draggedItemId;
                if (!id) return;
                // Снятие экипировки перетаскиванием: equip:slot → в инвентарь.
                if (id.startsWith('equip:')) {
                  const eqSlot = id.slice(6);
                  if (eqSlot === 'backpack' && useUiStore.getState().backpackLocked) {
                    usePlayerStore.getState().addLog('🔒 Рюкзак под замком — сними замочек, чтобы снять.', 'warning');
                    return;
                  }
                  const old = usePlayerStore.getState().unequipItem(eqSlot as any);
                  if (old) {
                    useInventoryStore.getState().addItem(old);
                    playSound('putting-on-a-safety-belt', 0.5);
                  }
                  return;
                }
                const wasInPack = usePlayerStore.getState().backpackGrid.items.some((i) => i.id === id);
                takeOutBackpack(id);
                if (wasInPack) playSound('laying-out-a-travel-mat', 0.5);
              }}
              onDragOver={(e) => e.preventDefault()}
            >
              {padded.map((stacked, idx) => {
                if (!stacked) return <div key={`empty-${idx}`} style={{ width: cellSize, height: cellSize }} onDrop={(e) => handleCellDrop(idx, e)} />;

                const { item, count } = stacked;
                const imgUrl = item.image
                  || (item.type === 'chest' ? chestImageFor(item.quality || item.rarity || 'Обычный') : undefined)
                  || getItemImage(item.name, item.displayName, item.slot, item.type);
                // Расходники и патроны пока без арта — эмодзи-заглушка из дефа; рюкзаки — картинка по семейству.
                // Щиты: есть арт — картинка, нет — эмодзи из предмета.
                const emojiIcon = item.type === 'consumable'
                  ? getConsumableIcon(item)
                  : item.slot === 'shield' && !imgUrl
                    ? ((item as any).icon || '🛡️')
                    : item.type === 'backpack' ? null
                    : item.type === 'bullet' ? null // картинка группы через getItemImage выше
                    : null;
                // INV: флаги анимаций ячейки.
                const isNew = !seenIds[item.id];
                const isRare = item.quality === 'Легендарный' || item.quality === 'Божественный';
                const stackKey = stackKeyOf(item);
                const shaking = !!shakeCell && shakeCell.idx === idx;
                const leaving = !!dying && dying.idx === idx && dying.key === item.id;
                const cellCls = ['inv-cell', isNew ? 'invfx-newpop' : 'invfx-appear',
                  filterSlot ? 'invfx-match' : '', shaking ? 'invfx-shake' : '',
                  leaving ? 'invfx-leave' : '', isRare ? 'invfx-rare' : ''].filter(Boolean).join(' ');

                return (
                  <div
                    key={item.id}
                    className={cellCls}
                    draggable
                    onDrop={(e) => handleCellDrop(idx, e)}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', item.id);
                      setDraggedItemId(item.id);
                    }}
                    onDragEnd={() => setDraggedItemId(null)}
                    onContextMenu={(e) => handleContext(e, stacked, idx)}
                    onDoubleClick={() => {
                      if (item.type === 'chest') { openChest(stacked, idx); return; }
                      // Двойной клик — в рюкзак (не ждёт перетаскивания).
                      killWithAnim(stacked, idx, () => {
                        const msg = usePlayerStore.getState().putInBackpack(item.id);
                        playSound('laying-out-a-travel-mat', 0.5);
                        addLog(msg, msg.startsWith('❌') || msg.startsWith('⚠️') ? 'warning' : 'info');
                      });
                    }}
                    onMouseEnter={(e) => { setHoveredItem(stacked); setHoverPos({ x: e.clientX, y: e.clientY }); markSeen(stacked.item.id); }}
                    onMouseMove={(e) => setHoverPos({ x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setHoveredItem(null)}
                    style={{
                      width: cellSize, height: cellSize,
                      background: '#0f0f15',
                      border: `1px solid ${item.qualityColor || 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 3,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', position: 'relative',
                      transition: 'all 80ms',
                      animationDelay: `${Math.min(idx * 12, 300)}ms`, // INV-1
                      ...(isRare ? { ['--rare-c' as any]: item.qualityColor } : null), // INV-12
                    }}
                    onAnimationEnd={(e) => {
                      // Сбрасываем задержку появления, чтобы поздние FX (shake/leave) играли сразу.
                      if (e.animationName === 'invfxAppear' || e.animationName === 'invfxNewPop') e.currentTarget.style.animationDelay = '0ms';
                    }}
                  >
                    <div className="invfx-sweep" /> {/* INV-5 */}
                    {isRare && [0, 1, 2].map((i) => ( // INV-12: искры топ-редкости
                      <span key={i} className="invfx-spark" style={{ left: `${20 + i * 27}%`, width: 2, height: 2, background: item.qualityColor, animationDuration: `${1.8 + i * 0.5}s`, animationDelay: `${(i * 0.6).toFixed(1)}s` }} />
                    ))}
                    {shimmerId && shimmerId.id === item.id && <div key={shimmerId.t} className="invfx-shimmer" />} {/* INV-13 */}
                    {emojiIcon ? (
                      <span style={{ fontSize: 28, lineHeight: 1 }}>{emojiIcon}</span>
                    ) : imgUrl ? (
                      <img src={imgUrl} alt="" draggable={false} style={{ width: isLargeArtWeapon(stacked.item.name) ? 53 : 44, height: isLargeArtWeapon(stacked.item.name) ? 53 : 44, objectFit: 'contain', imageRendering: 'pixelated' }} />
                    ) : (
                      <span style={{ fontSize: 16, opacity: 0.2 }}>?</span>
                    )}
                    {count > 1 && (
                      <div style={{
                        position: 'absolute', bottom: 1, right: 2,
                        fontSize: 9, fontWeight: 600, fontFamily: 'var(--font-mono)',
                        color: '#fff', background: 'rgba(0,0,0,0.65)',
                        borderRadius: 2, padding: '0 3px', lineHeight: '13px',
                      }}>
                        <span key={tickMap[stackKey] ?? 'c0'} className={tickMap[stackKey] ? 'invfx-tick' : undefined}>x{count}</span>
                      </div>
                    )}
                    {item.rarity && (
                      <div style={{
                        position: 'absolute', top: 1, right: 2,
                        width: 4, height: 4, borderRadius: '50%',
                        background: item.qualityColor || 'rgba(255,255,255,0.2)',
                      }} />
                    )}
                    {favorites[item.id] && (
                      <div style={{
                        position: 'absolute', top: 0, left: 2,
                        fontSize: 11, lineHeight: 1, color: '#ffd700',
                        textShadow: '0 0 4px rgba(255,215,0,0.8)',
                      }}>
                        ★
                      </div>
                    )}
                    {!seenIds[item.id] && (
                      <div className="invfx-newbadge" style={{
                        position: 'absolute', bottom: 1, left: 2,
                        fontSize: 8, fontWeight: 800, lineHeight: 1,
                        color: '#fff',
                      }}>
                        NEW
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            </div>

            {/* Pagination */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginTop: 8, fontSize: 11,
            }}>
              <span style={{ color: 'var(--text-muted)' }}>
                Всего: {processed.length} | Стоимость хабара: 💾{items.reduce((sum, i) => sum + getSellPrice(i), 0).toLocaleString()}
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage <= 0}
                  style={{
                    padding: '2px 8px', fontSize: 11, fontFamily: 'var(--font-mono)',
                    background: currentPage > 0 ? '#16161a' : 'transparent',
                    color: currentPage > 0 ? 'var(--accent-primary)' : 'var(--text-muted)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 6, cursor: currentPage > 0 ? 'pointer' : 'default',
                  }}
                >
                  ◀
                </button>
                <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  {currentPage + 1}/{totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1}
                  style={{
                    padding: '2px 8px', fontSize: 11, fontFamily: 'var(--font-mono)',
                    background: currentPage < totalPages - 1 ? '#16161a' : 'transparent',
                    color: currentPage < totalPages - 1 ? 'var(--accent-primary)' : 'var(--text-muted)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 6, cursor: currentPage < totalPages - 1 ? 'pointer' : 'default',
                  }}
                >
                  ▶
                </button>
              </div>
            </div>
          </div>

          {hoveredItem && (
            <ItemTooltip item={hoveredItem.item} x={hoverPos.x} y={hoverPos.y} />
          )}

          {openingChest && (
            <ChestOpening chest={openingChest} onClose={() => setOpeningChest(null)} />
          )}

          {/* Context menu */}
          {contextMenu && (
            <div style={{
              position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 9999,
              background: 'linear-gradient(180deg, #1a1a1a 0%, #151515 58%, #23272b 100%)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 10, padding: 4, minWidth: 150,
              boxShadow: '0 16px 48px rgba(0,0,0,0.75)',
            }}>
              {contextMenu.stacked.item.slot && slotFilterKey(contextMenu.stacked.item) !== 'material' && (
                <div
                  onClick={() => handleEquip(contextMenu.stacked)}
                  style={{
                    padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--text-primary)',
                    borderRadius: 3, transition: 'background 80ms',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  ⛓️ Экипировать
                </div>
              )}
              {contextMenu.stacked.item.type === 'chest' && (
                <div
                  onClick={() => openChest(contextMenu.stacked)}
                  style={{
                    padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--accent-primary)',
                    borderRadius: 3, transition: 'background 80ms',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  📦 Открыть
                </div>
              )}
              {contextMenu.stacked.item.type === 'consumable' && (
                <div
                  onClick={() => handleUseConsumable(contextMenu.stacked)}
                  style={{
                    padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--accent-success)',
                    borderRadius: 3, transition: 'background 80ms',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  🧪 Использовать
                </div>
              )}
              <div
                onClick={() => handleDrop(contextMenu.stacked)}
                style={{
                  padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--accent-danger)',
                  borderRadius: 3, transition: 'background 80ms',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                🗑️ Выбросить
              </div>
              <div
                onClick={() => { toggleFavorite(contextMenu.stacked.item.id); setContextMenu(null); }}
                style={{
                  padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: '#ffd700',
                  borderRadius: 3, transition: 'background 80ms',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {favorites[contextMenu.stacked.item.id] ? '☆ Убрать из избранного' : '★ В избранное'}
              </div>
              {contextMenu.stacked.item.price ? (
                <div style={{ padding: '4px 12px', fontSize: 10, color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.04)', marginTop: 4 }}>
                  💰 {contextMenu.stacked.item.price}
                </div>
              ) : null}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const getEquipSlotLocal = (item: Item): string | null => {
  if (!item.slot) return null;
  const directSlots = ['head', 'armor', 'pants', 'weapon1', 'gloves', 'boots', 'backpack', 'shield'];
  if (directSlots.includes(item.slot)) return item.slot;
  // Огнестрел — в свой классовый слот.
  if (item.slot === 'weapon2') return gunSlotForWeapon(item);
  return null;
};
