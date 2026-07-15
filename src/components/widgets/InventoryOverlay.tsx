import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUiStore } from '../../stores/uiStore';
import { usePlayerStore } from '../../stores/playerStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { getItemImage } from '../../assets/index';
import { useSound } from '../../hooks/useSound';
import { WapHeader } from '../ui/WapHeader';
import { WapPanel } from '../ui/WapPanel';
import type { Item } from '../../types/items';
import { ItemTooltip } from './ItemTooltip';
import { calcItemPower } from '../../utils/itemPower';

const cellSize = 48;
const cols = 11;
const ITEMS_PER_PAGE = cols * 8;

const SLOT_FILTERS = [
  { value: '', label: 'All slots' },
  { value: 'weapon1', label: '— Оружие' },
  { value: 'weapon2', label: '— Вторая рука' },
  { value: 'head', label: '— Шлем' },
  { value: 'armor', label: '— Броня' },
  { value: 'gloves', label: '— Перчатки' },
  { value: 'boots', label: '— Ботинки' },
  { value: 'ammo', label: '— Амуниция' },
  { value: 'mod', label: '— Моды' },
  { value: 'consumable', label: '— Расходники' },
  { value: 'material', label: '— Ресурсы' },
];

const getItemTimestamp = (item: Item): number => {
  const ts = parseInt(item.id?.split('_')[0], 10);
  return isNaN(ts) ? 0 : ts;
};

const SORT_OPTIONS = [
  { value: '', label: 'Без сортировки' },
  { value: 'power', label: 'Мощность' },
  { value: 'recent', label: 'Новые' },
  { value: 'level', label: 'Уровень' },
  { value: 'damage', label: 'Урон' },
  { value: 'armor', label: 'Броня' },
  { value: 'maxHp', label: 'HP' },
  { value: 'crit', label: 'Крит' },
  { value: 'speed', label: 'Скорость' },
  { value: 'regen', label: 'Реген' },
  { value: 'evasion', label: 'Уклонение' },
  { value: 'block', label: 'Блок' },
  { value: 'vampir', label: 'Вампиризм' },
  { value: 'price', label: 'Цена' },
];

interface StackedItem {
  item: Item;
  count: number;
}

const stackItems = (items: Item[]): StackedItem[] => {
  const map = new Map<string, StackedItem>();
  for (const item of items) {
    if (item.type === 'material') {
      const key = `${item.name}_${item.rarity}`;
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

const getStatValue = (item: Item, stat: string): number => {
  if (stat === 'level') return item.level || 1;
  if (stat === 'price') return item.price || 0;
  const stats = item.stats || {};
  const v = stats[stat];
  return typeof v === 'object' ? ((v as any)?.base || 0) : (v || 0);
};

const slotFilterKey = (item: Item): string => {
  if (item.type === 'mod') return 'mod';
  if (item.type === 'consumable') return 'consumable';
  if (item.type === 'material') return 'material';
  if (item.slot === 'ammo') return 'ammo';
  return item.slot || '';
};

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
  const equipItem = usePlayerStore((s) => s.equipItem);
  const equipment = usePlayerStore((s) => s.equipment);
  const useConsumable = usePlayerStore((s) => s.useConsumable);
  const addLog = usePlayerStore((s) => s.addLog);
  const dataChips = usePlayerStore((s) => s.dataChips);
  const stats = usePlayerStore((s) => s.stats);
  const { playClick, playEquip } = useSound();

  const [pos, setPos] = useState(inventoryPinPos);
  const [page, setPage] = useState(0);
  const [filterSlot, setFilterSlot] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; stacked: StackedItem } | null>(null);
  const [hoveredItem, setHoveredItem] = useState<StackedItem | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

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

    if (sortBy === 'power') {
      list = [...list].sort((a, b) => calcItemPower(b.item) - calcItemPower(a.item));
    } else if (sortBy === 'recent') {
      list = [...list].sort((a, b) => getItemTimestamp(b.item) - getItemTimestamp(a.item));
    } else if (sortBy) {
      list = [...list].sort((a, b) => {
        const va = getStatValue(a.item, sortBy);
        const vb = getStatValue(b.item, sortBy);
        return vb - va;
      });
    }

    return list;
  }, [items, filterSlot, sortBy]);

  const totalPages = Math.max(1, Math.ceil(processed.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageItems = processed.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);
  const padded = [...pageItems];
  while (padded.length < ITEMS_PER_PAGE) padded.push(null as any);

  const rows = Math.ceil(padded.length / cols);

  const handleContext = (e: React.MouseEvent, stacked: StackedItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, stacked });
  };

  const handleEquip = (stacked: StackedItem) => {
    const item = stacked.item;
    const slot = getEquipSlotLocal(item);
    if (!slot) { addLog(`❌ ${item.displayName || item.name} нельзя экипировать`, 'warning'); return; }
    if (equipment[slot]) { addLog(`❌ Слот ${slot} занят`, 'warning'); return; }
    if (equipItem(slot, item)) {
      if (item.type === 'material' && stacked.count > 1) {
        // For stacked items, we just equip the item. The item stays in inventory.
        // Actually materials shouldn't be equippable. Skip.
      } else {
        removeItem(item.id);
      }
      playEquip();
    }
    setContextMenu(null);
  };

  const handleUseConsumable = (stacked: StackedItem) => {
    const item = stacked.item;
    if (item.type !== 'consumable') { addLog(`❌ ${item.displayName || item.name} нельзя использовать`, 'warning'); return; }
    useConsumable(item);
    removeItem(item.id);
    addLog(`🧪 Использован ${item.displayName || item.name}`, 'heal');
    setContextMenu(null);
  };

  const handleDrop = (stacked: StackedItem) => {
    const item = stacked.item;
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
            style={{ background: 'linear-gradient(180deg, rgba(217,119,6,0.6), rgba(146,64,14,0.4))' }}>
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
              style={{ cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)', padding: '0 4px' }}
            >
              ✕
            </span>
          </WapHeader>

          {/* Body */}
          <div style={{
            background: 'linear-gradient(180deg, rgba(8,20,18,0.85), rgba(5,12,10,0.9))',
            border: '1px solid rgba(20,184,166,0.1)',
            borderRadius: '0 0 6px 6px',
            padding: 8, minWidth: cols * (cellSize + 4) + 16,
          }}>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <select
                value={filterSlot}
                onChange={(e) => setFilterSlot(e.target.value)}
                style={{
                  flex: 1, padding: '4px 6px', fontSize: 11, background: '#1a1a26',
                  color: 'var(--text-secondary)', border: '1px solid var(--border-glass)',
                  borderRadius: 'var(--radius-sm)', outline: 'none', fontFamily: 'var(--font-sans)',
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
                  width: 140, padding: '4px 6px', fontSize: 11, background: '#1a1a26',
                  color: 'var(--text-secondary)', border: '1px solid var(--border-glass)',
                  borderRadius: 'var(--radius-sm)', outline: 'none', fontFamily: 'var(--font-sans)',
                }}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
              gap: 2,
            }}>
              {padded.map((stacked, idx) => {
                if (!stacked) return <div key={`empty-${idx}`} style={{ width: cellSize, height: cellSize }} />;

                const { item, count } = stacked;
                const imgUrl = getItemImage(item.name, item.displayName);

                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', item.id);
                      setDraggedItemId(item.id);
                    }}
                    onDragEnd={() => setDraggedItemId(null)}
                    onContextMenu={(e) => handleContext(e, stacked)}
                    onMouseEnter={(e) => { setHoveredItem(stacked); setHoverPos({ x: e.clientX, y: e.clientY }); }}
                    onMouseMove={(e) => setHoverPos({ x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setHoveredItem(null)}
                    style={{
                      width: cellSize, height: cellSize,
                      background: 'rgba(255,255,255,0.02)',
                      border: `1px solid ${item.qualityColor || 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 3,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', position: 'relative',
                      transition: 'all 80ms',
                    }}
                  >
                    {imgUrl ? (
                      <img src={imgUrl} alt="" style={{ width: 36, height: 36, objectFit: 'contain', imageRendering: 'pixelated' }} />
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
                        x{count}
                      </div>
                    )}
                    {item.rarity && (
                      <div style={{
                        position: 'absolute', top: 1, right: 2,
                        width: 4, height: 4, borderRadius: '50%',
                        background: item.qualityColor || 'rgba(255,255,255,0.2)',
                      }} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginTop: 8, fontSize: 11,
            }}>
              <span style={{ color: 'var(--text-muted)' }}>
                Всего: {processed.length}
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage <= 0}
                  style={{
                    padding: '2px 8px', fontSize: 11, fontFamily: 'var(--font-mono)',
                    background: currentPage > 0 ? 'rgba(129,140,248,0.15)' : 'transparent',
                    color: currentPage > 0 ? 'var(--accent-primary)' : 'var(--text-muted)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 'var(--radius-sm)', cursor: currentPage > 0 ? 'pointer' : 'default',
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
                    background: currentPage < totalPages - 1 ? 'rgba(129,140,248,0.15)' : 'transparent',
                    color: currentPage < totalPages - 1 ? 'var(--accent-primary)' : 'var(--text-muted)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 'var(--radius-sm)', cursor: currentPage < totalPages - 1 ? 'pointer' : 'default',
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

          {/* Context menu */}
          {contextMenu && (
            <div style={{
              position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 9999,
              background: '#12121a', border: '1px solid var(--border-glass)',
              borderRadius: 'var(--radius-sm)', padding: 4, minWidth: 150,
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
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
  const directSlots = ['head', 'armor', 'weapon1', 'weapon2', 'gloves', 'boots'];
  if (directSlots.includes(item.slot)) return item.slot;
  if (item.slot === 'ammo') {
    const equip = usePlayerStore.getState().equipment;
    const empty = ['ammo1', 'ammo2', 'ammo3', 'ammo4'].find((s) => !equip[s as keyof typeof equip]);
    return empty || 'ammo1';
  }
  return null;
};
