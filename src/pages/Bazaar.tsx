import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { WapPanel } from '../components/ui/WapPanel';
import { Button } from '../components/ui/Button';
import { generateItem } from '../engine/items';
import { GAME_ITEMS, GAME_RESOURCES } from '../data/GameItems';
import { usePlayerStore } from '../stores/playerStore';
import { useInventoryStore } from '../stores/inventoryStore';
import { getItemImage } from '../assets/index';
import type { Item } from '../types/items';

const SHOP_KEY = 'remastered_shop';
const SHOP_REFRESH_KEY = 'remastered_shop_refresh';
const SHOP_INTERVAL = 6000000;
const SELL_SLOT_COUNT = 12;

interface ShopItem {
  id: string;
  name: string;
  displayName: string;
  level: number;
  rarity: string;
  quality: string;
  qualityColor: string;
  price: number;
  stats: Record<string, number>;
  slot: string;
  type?: string;
  quantity?: number;
  resourceName?: string;
}

const generateShop = (level: number): ShopItem[] => {
  const items: ShopItem[] = [];

  // Equipment (10 items)
  for (let i = 0; i < 10; i++) {
    const single = generateItem(GAME_ITEMS, level);
    if (single) {
      const basePrice = level * 10 + Math.floor(Math.random() * 50);
      const qualityMultiplier = single.quality === 'Легендарный' ? 10 :
        single.quality === 'Эпический' ? 5 :
        single.quality === 'Раритетный' ? 3 :
        single.quality === 'Редкий' ? 2 : 1;
      items.push({
        id: single.id + '_eq_' + i + '_' + Date.now(),
        name: single.name,
        displayName: single.displayName || single.name,
        level: single.level || level,
        rarity: single.rarity,
        quality: single.quality,
        qualityColor: single.qualityColor || 'white',
        price: Math.floor(basePrice * qualityMultiplier),
        stats: single.stats || {},
        slot: single.slot,
        type: single.type,
      });
    }
  }

  // Resources / materials (8 items)
  const resources = [...GAME_RESOURCES];
  for (let i = 0; i < 8; i++) {
    const def = resources[Math.floor(Math.random() * resources.length)];
    const qty = 1 + Math.floor(Math.random() * 5);
    items.push({
      id: 'res_' + i + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 4),
      name: def.name,
      displayName: `${def.name} x${qty}`,
      level: 1,
      rarity: 'common',
      quality: 'Обычный',
      qualityColor: '#94a3b8',
      price: (level + 2) * qty + Math.floor(Math.random() * 10),
      stats: {},
      slot: 'any',
      type: 'material',
      quantity: qty,
      resourceName: def.name,
    });
  }

  return items;
};

const getSellPrice = (item: Item): number => {
  if (item.price) return Math.floor(item.price * 0.4);
  const qualityMultiplier = item.quality === 'Легендарный' ? 8 :
    item.quality === 'Эпический' ? 4 :
    item.quality === 'Раритетный' ? 2.5 :
    item.quality === 'Редкий' ? 1.5 : 1;
  return Math.floor((item.level || 1) * 3 + 5 * qualityMultiplier);
};

type SortKey = 'price' | 'level' | 'name' | 'quality';

export const Bazaar = () => {
  const playerLevel = usePlayerStore((s) => s.level);
  const dataChips = usePlayerStore((s) => s.dataChips);
  const spendChips = usePlayerStore((s) => s.spendChips);
  const addChips = usePlayerStore((s) => s.addChips);
  const addLog = usePlayerStore((s) => s.addLog);
  const addItem = useInventoryStore((s) => s.addItem);
  const inventoryItems = useInventoryStore((s) => s.items);
  const removeItem = useInventoryStore((s) => s.removeItem);
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const [shopTab, setShopTab] = useState<'all' | 'weapons' | 'armor' | 'consumables' | 'mods' | 'resources'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('price');
  const [sortAsc, setSortAsc] = useState(false);

  // Sell slots
  const [sellSlots, setSellSlots] = useState<(Item | null)[]>(() => Array(SELL_SLOT_COUNT).fill(null));

  const SHOP_VERSION = 2;
  const [shopItems, setShopItems] = useState<ShopItem[]>(() => {
    const stored = localStorage.getItem(SHOP_KEY);
    const refresh = localStorage.getItem(SHOP_REFRESH_KEY);
    const savedVersion = localStorage.getItem(SHOP_KEY + '_v');
    const now = Date.now();
    if (stored && refresh && now - parseInt(refresh) < SHOP_INTERVAL && savedVersion === String(SHOP_VERSION)) {
      try { return JSON.parse(stored); } catch {}
    }
    const fresh = generateShop(playerLevel);
    localStorage.setItem(SHOP_KEY, JSON.stringify(fresh));
    localStorage.setItem(SHOP_REFRESH_KEY, String(now));
    localStorage.setItem(SHOP_KEY + '_v', String(SHOP_VERSION));
    return fresh;
  });

  const [refreshTimer, setRefreshTimer] = useState(600);
  useEffect(() => {
    const t = setInterval(() => {
      setRefreshTimer((prev) => {
        if (prev <= 1) {
          const fresh = generateShop(playerLevel);
          setShopItems(fresh);
          localStorage.setItem(SHOP_KEY, JSON.stringify(fresh));
          localStorage.setItem(SHOP_REFRESH_KEY, String(Date.now()));
          return 600;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [playerLevel]);

  // Buy sort
  const sortedShop = useMemo(() => {
    const list = [...shopItems];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'price') cmp = a.price - b.price;
      else if (sortKey === 'level') cmp = a.level - b.level;
      else if (sortKey === 'name') cmp = a.displayName.localeCompare(b.displayName);
      else if (sortKey === 'quality') {
        const order = ['Обычный', 'Редкий', 'Раритетный', 'Эпический', 'Легендарный'];
        cmp = order.indexOf(a.quality) - order.indexOf(b.quality);
      }
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [shopItems, sortKey, sortAsc]);

  const filteredShop = useMemo(() => {
    if (shopTab === 'all') return sortedShop;
    if (shopTab === 'resources') return sortedShop.filter((item) => item.type === 'material');
    const slotMap: Record<string, string[]> = {
      weapons: ['weapon1', 'weapon2'],
      armor: ['head', 'armor', 'gloves', 'boots'],
      consumables: ['ammo'],
      mods: ['mod_barrel', 'mod_scope', 'mod_magazine', 'mod_muzzle', 'mod_receiver', 'mod_stock',
        'mod_blade', 'mod_handle', 'mod_pommel', 'mod_harness',
        'mod_lining', 'mod_hardshell', 'mod_utility', 'mod_patch'],
    };
    const validSlots = slotMap[shopTab] || [];
    return sortedShop.filter((item) => validSlots.includes(item.slot));
  }, [sortedShop, shopTab]);

  const handleBuy = (shopItem: ShopItem) => {
    if (!spendChips(shopItem.price)) {
      addLog(`❌ Недостаточно чипов для покупки ${shopItem.name} (${shopItem.price} 💾)`, 'warning');
      return;
    }
    if (shopItem.type === 'material') {
      addItem({
        id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: shopItem.resourceName || shopItem.name,
        rarity: 'common',
        level: 1,
        slot: 'any',
        stats: {},
        qualityColor: '#94a3b8',
        quality: 'Обычный',
        type: 'material',
        quantity: shopItem.quantity || 1,
      });
    } else {
      addItem({
        id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: shopItem.name,
        displayName: shopItem.displayName,
        rarity: shopItem.rarity,
        level: shopItem.level,
        slot: shopItem.slot,
        stats: shopItem.stats,
        qualityColor: shopItem.qualityColor,
        quality: shopItem.quality,
        type: shopItem.type,
      });
    }
    addLog(`🛒 Куплено: ${shopItem.displayName || shopItem.name} за ${shopItem.price} 💾`, 'loot');
    setShopItems((prev) => prev.filter((i) => i.id !== shopItem.id));
  };

  // Sell: drag-drop handlers
  const handleSellDrop = useCallback((slotIdx: number, e: React.DragEvent) => {
    e.preventDefault();
    const draggableId = e.dataTransfer.getData('text/plain');
    if (!draggableId) return;
    const item = inventoryItems.find((i) => i.id === draggableId);
    if (!item) return;
    if (sellSlots.some((s) => s?.id === item.id)) return;
    removeItem(item.id);
    setSellSlots((prev) => {
      const next = [...prev];
      next[slotIdx] = item;
      return next;
    });
  }, [inventoryItems, removeItem, sellSlots]);

  const handleSellSlotRemove = (slotIdx: number) => {
    const item = sellSlots[slotIdx];
    if (!item) return;
    addItem(item);
    setSellSlots((prev) => {
      const next = [...prev];
      next[slotIdx] = null;
      return next;
    });
  };

  const totalSellValue = useMemo(() => {
    return sellSlots.reduce((sum, item) => sum + (item ? getSellPrice(item) : 0), 0);
  }, [sellSlots]);

  const [hoveredShopItem, setHoveredShopItem] = useState<ShopItem | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const handleSellAll = () => {
    const total = totalSellValue;
    if (total <= 0) return;
    addChips(total);
    addLog(`💰 Продано ${sellSlots.filter(Boolean).length} предмет(ов) за ${total} 💾`, 'loot');
    setSellSlots(Array(SELL_SLOT_COUNT).fill(null));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <WapPanel variant="metal" padding="lg">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>🏪 Базар</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
              💾 {dataChips.toLocaleString()}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              | {Math.floor(refreshTimer / 60)}:{(refreshTimer % 60).toString().padStart(2, '0')}
            </span>
          </div>
        </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <Button variant={tab === 'buy' ? 'primary' : 'ghost'} size="sm" onClick={() => setTab('buy')}>
            🛒 Купить
          </Button>
          <Button variant={tab === 'sell' ? 'primary' : 'ghost'} size="sm" onClick={() => setTab('sell')}>
            💰 Продать
          </Button>
        </div>

        {tab === 'buy' ? (
          <>
            {/* Shop sub-tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              {([
                { id: 'all', label: 'Все', icon: '📋' },
                { id: 'weapons', label: 'Кузня', icon: '⚔️' },
                { id: 'armor', label: 'Броня', icon: '🛡️' },
                { id: 'consumables', label: 'Лавка', icon: '🧪' },
                { id: 'mods', label: 'Модификации', icon: '🔩' },
                { id: 'resources', label: 'Ресурсы', icon: '📦' },
              ] as const).map((st) => (
                <div key={st.id} onClick={() => setShopTab(st.id)}
                  style={{
                    padding: '3px 10px', fontSize: 11, cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                    background: shopTab === st.id ? 'var(--bg-glass-hover)' : 'transparent',
                    border: `1px solid ${shopTab === st.id ? 'var(--accent-primary)' : 'rgba(255,255,255,0.06)'}`,
                    color: shopTab === st.id ? 'var(--accent-primary)' : 'var(--text-muted)',
                    transition: 'all 80ms',
                  }}
                >{st.icon} {st.label}</div>
              ))}
            </div>
            {/* Sort controls */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Сортировать:</span>
              {(['price', 'level', 'name', 'quality'] as SortKey[]).map((k) => (
                <div
                  key={k}
                  onClick={() => {
                    if (sortKey === k) setSortAsc(!sortAsc);
                    else { setSortKey(k); setSortAsc(false); }
                  }}
                  style={{
                    padding: '3px 8px', fontSize: 11, cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                    background: sortKey === k ? 'var(--bg-glass-hover)' : 'transparent',
                    border: `1px solid ${sortKey === k ? 'var(--accent-primary)' : 'rgba(255,255,255,0.06)'}`,
                    color: sortKey === k ? 'var(--accent-primary)' : 'var(--text-muted)',
                    transition: 'all 80ms',
                  }}
                >
                  {k === 'price' ? 'Цена' : k === 'level' ? 'Уровень' : k === 'name' ? 'Название' : 'Качество'}
                  {sortKey === k && (sortAsc ? ' ▲' : ' ▼')}
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
              {filteredShop.map((item) => (
                <div
                  key={item.id}
                  onMouseEnter={(e) => { setHoveredShopItem(item); setTooltipPos({ x: e.clientX, y: e.clientY }); }}
                  onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoveredShopItem(null)}
                  style={{
                    padding: 10,
                    background: 'var(--bg-glass)',
                    border: `1px solid ${item.qualityColor || 'var(--border-glass)'}`,
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                  }}
                >
                  {(() => { const url = getItemImage(item.resourceName || item.name, item.type !== 'material' ? item.displayName : undefined); return url ? <img src={url} alt="" style={{ width: 40, height: 40, objectFit: 'contain', imageRendering: 'pixelated', margin: '0 auto 4px', display: 'block', borderRadius: 3, background: 'rgba(0,0,0,0.2)' }} /> : <div style={{ width: 40, height: 40, margin: '0 auto 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📦</div>; })()}
                  <div style={{ fontSize: 11, fontWeight: 500, color: item.qualityColor || 'var(--text-primary)', marginBottom: 2, lineHeight: 1.2 }}>
                    {item.displayName || item.name}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
                    {item.type === 'material' ? `x${item.quantity || 1}` : `Lv.${item.level}`}
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleBuy(item)}
                    disabled={dataChips < item.price}
                    style={{ width: '100%', fontSize: 10, padding: '3px 6px' }}
                  >
                    {item.price} 💾
                  </Button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
              Перетащи предметы из инвентаря в слоты
            </div>

            {/* Sell slots grid */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {sellSlots.map((item, idx) => (
                <div
                  key={idx}
                  onDrop={(e) => handleSellDrop(idx, e)}
                  onDragOver={(e) => e.preventDefault()}
                  style={{
                    width: 64, height: 64,
                    background: item ? 'var(--bg-glass)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${item ? (item.qualityColor || 'rgba(255,255,255,0.15)') : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative', cursor: item ? 'pointer' : 'default',
                    transition: 'all 100ms',
                  }}
                  onClick={() => handleSellSlotRemove(idx)}
                  title={item ? `${item.displayName || item.name} (${getSellPrice(item)} 💾) — клик убрать` : ''}
                >
                  {item ? (
                    <>
                      {(() => { const url = getItemImage(item.name, item.displayName); return url ? <img src={url} alt="" style={{ width: 40, height: 40, objectFit: 'contain', imageRendering: 'pixelated' }} /> : null; })()}
                      <div style={{
                        position: 'absolute', bottom: 0, right: 1,
                        fontSize: 8, fontFamily: 'var(--font-mono)',
                        color: 'var(--accent-warning)', background: 'rgba(0,0,0,0.7)',
                        borderRadius: 2, padding: '0 2px', lineHeight: '11px',
                      }}>
                        {getSellPrice(item)}💾
                      </div>
                    </>
                  ) : (
                    <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.08)' }}>+</span>
                  )}
                </div>
              ))}
            </div>

            {/* Total + Sell button */}
            {sellSlots.some(Boolean) && (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: 12, background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.2)', borderRadius: 'var(--radius-sm)',
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-success)' }}>
                  💰 Итого: {totalSellValue} 💾
                </span>
                <Button variant="primary" onClick={handleSellAll}>
                  Продать всё
                </Button>
              </div>
            )}
          </>
        )}
      </WapPanel>

      {hoveredShopItem && (
        <div style={{
          position: 'fixed', left: Math.min(tooltipPos.x + 14, window.innerWidth - 260),
          top: Math.min(tooltipPos.y - 8, window.innerHeight - 200),
          zIndex: 9999, width: 210,
          background: '#12121a', border: '1px solid var(--border-glass)',
          borderRadius: 'var(--radius-sm)', padding: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          pointerEvents: 'none', fontSize: 11,
        }}>
          <div style={{ fontWeight: 600, color: hoveredShopItem.qualityColor || 'var(--text-primary)', marginBottom: 4, fontSize: 12 }}>
            {hoveredShopItem.displayName}
          </div>
          <div style={{ color: 'var(--text-muted)', marginBottom: 4, fontSize: 10 }}>
            Lv.{hoveredShopItem.level} • {hoveredShopItem.rarity} • {hoveredShopItem.quality}
          </div>
          <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: 4 }}>
            {Object.entries(hoveredShopItem.stats || {}).slice(0, 8).map(([k, v]) => {
              const val = typeof v === 'object' ? ((v as any)?.base || 0) : (v || 0);
              if (!val) return null;
              return <div key={k}>{k}: +{val.toFixed(val > 1 ? 1 : 3)}</div>;
            })}
          </div>
          <div style={{ color: 'var(--accent-primary)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
            {hoveredShopItem.price} 💾
          </div>
        </div>
      )}
    </motion.div>
  );
};
