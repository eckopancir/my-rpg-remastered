import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { WapPanel } from '../components/ui/WapPanel';
import { Button } from '../components/ui/Button';
import { ItemTooltip } from '../components/widgets/ItemTooltip';
import { generateItem, getItemQuality } from '../engine/items';
import { makeBackpack } from '../data/backpacks';
import { GAME_ITEMS, GAME_RESOURCES } from '../data/GameItems';
import { AMMO_GROUPS, maxStackFor, bulletPackPrice } from '../data/ammo';
import { CONSUMABLE_DEFS } from '../data/consumables';
import { BACKPACK_DEFS } from '../data/backpacks';

const AMMO_GROUP_ICONS: Record<string, string> = Object.fromEntries(
  AMMO_GROUPS.map((g) => [g.key, g.icon]),
);
const CONSUMABLE_ICONS: Record<string, string> = Object.fromEntries(
  CONSUMABLE_DEFS.map((c) => [c.abilityId, c.icon]),
);
import { usePlayerStore } from '../stores/playerStore';
import { useInventoryStore } from '../stores/inventoryStore';
import { useAuthStore } from '../stores/authStore';
import { getItemImage } from '../assets/index';
import { getSellPrice } from '../utils/sellPrice';
import type { Item } from '../types/items';

const SELL_SLOT_COUNT = 12;
const SHOP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const API_BASE = '/api';

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
  abilityId?: string;
  ammoGroup?: string;
  ammoCapacity?: number;
  mods?: Record<string, unknown>;
  set?: string;
  damage?: string;
}

const SHOP_QUALITY_MULT: Record<string, number> = {
  'Божественный': 14, 'Легендарный': 10, 'Смертоносный': 7,
  'Эпический': 5, 'Раритетный': 3, 'Редкий': 2, 'Обычный': 1,
};

// Фикс цены за редкость (плоская добавка — раньше на низких уровнях её съедал кубик 0..50).
const RARITY_PRICE_FLAT: Record<string, number> = {
  normal: 0, common: 0, epic: 40, superepic: 90,
};

// Вес статов в цене: здоровье идёт сотнями, шансы — долями, нормируем.
const STAT_PRICE_W: Record<string, number> = {
  damage: 0.75, armor: 0.75, health: 0.125, regen: 5,
  crit: 125, evasion: 125, block: 125, vampir: 125, accuracy: 125, speed: 125,
  punching: 0.75, dpsEmi: 0.75, dpsToxis: 0.75, dpsExtro: 0.75, dpsFire: 0.75,
  maxHp: 0.125, maxStamina: 0.125,
};

const statPrice = (stats: Record<string, number>): number => {
  let sum = 0;
  for (const [k, v] of Object.entries(stats || {})) {
    if (typeof v !== 'number' || v <= 0) continue;
    sum += v * (STAT_PRICE_W[k] ?? 0.5);
  }
  return Math.floor(sum);
};

const CATEGORY_SLOTS: Record<string, string[]> = {
  weapons: ['weapon1', 'weapon2'],
  armor: ['head', 'armor', 'gloves', 'boots'],
  consumables: ['ammo'],
  mods: ['mod_barrel', 'mod_scope', 'mod_magazine', 'mod_muzzle', 'mod_receiver', 'mod_stock',
    'mod_blade', 'mod_handle', 'mod_pommel', 'mod_harness',
    'mod_lining', 'mod_hardshell', 'mod_utility', 'mod_patch'],
};

const generateCategoryItem = (level: number, validSlots: string[], idx: number): ShopItem | null => {
  for (let attempt = 0; attempt < 10; attempt++) {
    const targetSlot = validSlots[Math.floor(Math.random() * validSlots.length)];
    const single = generateItem(GAME_ITEMS, level, null, null, targetSlot);
    if (single) {
      // Цена: уровень + малая случайность + фикс за редкость + вес статов, всё × качество.
      // Раньше было level*10 + rand(0..50): на низких уровнях кубик всё решал,
      // а статы игнорировались — эпик за 50 чипов.
      const basePrice = level * 10 + Math.floor(Math.random() * 10);
      const qualityMultiplier = SHOP_QUALITY_MULT[single.quality] || 1;
      return {
        id: single.id + '_cat_' + idx + '_' + Date.now(),
        name: single.name,
        displayName: single.displayName || single.name,
        level: single.level || level,
        rarity: single.rarity,
        quality: single.quality,
        qualityColor: single.qualityColor || 'white',
        price: Math.floor((basePrice + (RARITY_PRICE_FLAT[single.rarity] || 0) + statPrice(single.stats || {})) * qualityMultiplier),
        stats: single.stats || {},
        slot: single.slot,
        type: single.type,
        abilityId: single.abilityId,
        ammoCapacity: (single as any).ammoCapacity,
        mods: (single as any).mods,
        set: (single as any).set,
        damage: (single as any).damage,
      };
    }
  }
  return null;
};

const generateShop = (level: number): ShopItem[] => {
  const items: ShopItem[] = [];
  let idx = 0;
  for (const cat of ['weapons', 'armor', 'consumables', 'mods'] as const) {
    const slots = CATEGORY_SLOTS[cat];
    // По 8 товаров в категории — витрина шире.
    for (let i = 0; i < 8; i++) {
      const item = generateCategoryItem(level, slots, idx++);
      if (item) items.push(item);
    }
  }
  const BASE_RESOURCES = GAME_RESOURCES.filter((r) =>
    !['Металлолом', 'Провода', 'Микросхема', 'Хим. реагент', 'Редкий сплав'].includes(r.name)
  );
  const resources = [...BASE_RESOURCES];
  // 24 ресурса (3 ряда по 8) увеличенными стаками — материалы теперь в ходу.
  for (let i = 0; i < 24; i++) {
    const def = resources[Math.floor(Math.random() * resources.length)];
    const qty = 3 + Math.floor(Math.random() * 8);
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
  // Расходники: сначала все 6 типов патронов, остаток — боевые расходники.
  // Рюкзаки генерируются ниже отдельным блоком (витрина Бронника).
  const bulletPick = [...AMMO_GROUPS];
  for (const g of bulletPick) {
    const qty = maxStackFor(g.key);
    items.push({
      id: `ammo_${g.key}_${Date.now()}_${Math.random().toString(36).slice(2, 4)}`,
      name: g.packName,
      displayName: `${g.packName} x${qty}`,
      level: 1,
      rarity: 'common',
      quality: 'Обычный',
      qualityColor: '#94a3b8',
      price: bulletPackPrice(g.key, qty),
      stats: {},
      slot: 'bullet',
      type: 'bullet',
      quantity: qty,
      ammoGroup: g.key,
    });
  }
  const consPick = [...CONSUMABLE_DEFS].sort(() => Math.random() - 0.5).slice(0, 2);
  for (const c of consPick) {
    items.push({
      id: `cons_${c.abilityId}_${Date.now()}_${Math.random().toString(36).slice(2, 4)}`,
      name: c.name,
      displayName: c.name,
      level: 1,
      rarity: 'common',
      quality: 'Обычный',
      qualityColor: '#94a3b8',
      price: c.price + level,
      stats: {},
      slot: 'consumable',
      type: 'consumable',
      quantity: 1,
      abilityId: c.abilityId,
    });
  }
  // Рюкзаки: 2 шт, качество — пирамидой, цена с мультипликатором качества.
  // Показываются в Броннике (слот backpack).
  const packPick = [...BACKPACK_DEFS].sort(() => Math.random() - 0.5).slice(0, 2);
  for (const p of packPick) {
    const pq = getItemQuality();
    const proto = makeBackpack(p.name, pq.name, pq.color, 1);
    items.push({
      id: `pack_${Date.now()}_${Math.random().toString(36).slice(2, 4)}`,
      name: p.name,
      displayName: proto.displayName,
      level: 1,
      rarity: 'common',
      quality: pq.name,
      qualityColor: pq.color,
      price: Math.floor((p.price + level * 3) * (SHOP_QUALITY_MULT[pq.name] || 1)),
      stats: {},
      slot: 'backpack',
      type: 'backpack',
      quantity: 1,
    });
  }
  return items;
};

type SortKey = 'price' | 'level' | 'name' | 'quality';

// Лавки площади: секции витрины. Цвета — акценты секций.
const STALLS = [
  { id: 'weapons', label: 'Кузня', icon: '⚔️', flavor: 'Оружие от местных умельцев', color: '#f87171', slots: ['weapon1', 'weapon2'] },
  { id: 'armor', label: 'Бронник', icon: '🛡️', flavor: 'Защита на любой вкус', color: '#60a5fa', slots: ['head', 'armor', 'gloves', 'boots', 'backpack'] },
  { id: 'consumables', label: 'Амуниция', icon: '🧪', flavor: 'Амулеты, еда и мелочи', color: '#4ade80', slots: ['ammo'] },
  { id: 'mods', label: 'Модификации', icon: '🔩', flavor: 'Тюнинг снаряжения', color: '#c084fc', slots: ['mod_barrel', 'mod_scope', 'mod_magazine', 'mod_muzzle', 'mod_receiver', 'mod_stock', 'mod_blade', 'mod_handle', 'mod_pommel', 'mod_harness', 'mod_lining', 'mod_hardshell', 'mod_utility', 'mod_patch'] },
  { id: 'resources', label: 'Ресурсные ряды', icon: '📦', flavor: 'Сырьё и материалы', color: '#fbbf24', slots: [] as string[] },
  { id: 'battle_supplies', label: 'Расходники', icon: '🎒', flavor: 'Патроны и боевые расходники', color: '#fb923c', slots: ['bullet', 'consumable'] },
] as const;

type StallId = typeof STALLS[number]['id'] | 'all';

const isHighTier = (quality: string) => ['Эпический', 'Смертоносный', 'Легендарный', 'Божественный'].includes(quality);

// Витринная карточка товара.
const ProductCard = ({ item, buyPrice, canAfford, onBuy, onHover, onMove, onLeave }: {
  item: ShopItem; buyPrice: number; canAfford: boolean;
  onBuy: () => void;
  onHover: (e: React.MouseEvent) => void; onMove: (e: React.MouseEvent) => void; onLeave: () => void;
}) => {
  const hot = isHighTier(item.quality);
  return (
    <div
      onMouseEnter={onHover}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{
        padding: 6, background: 'var(--bg-glass)',
        border: `2px solid ${item.qualityColor || 'var(--border-glass)'}`,
        borderRadius: 8, cursor: 'pointer',
        boxShadow: hot ? `0 0 10px ${(item.qualityColor || '#fff') + '44'}` : 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        transition: 'transform 100ms, box-shadow 120ms',
      }}
    >
      {(() => {
        const emoji = item.type === 'bullet'
          ? (AMMO_GROUP_ICONS[(item as any).ammoGroup] ?? '🔸')
          : item.type === 'consumable' && item.abilityId
            ? (CONSUMABLE_ICONS[item.abilityId] ?? '📦')
            : item.type === 'backpack' ? '🎒' : null;
        if (emoji) return <div style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{emoji}</div>;
        const url = getItemImage(item.resourceName || item.name, item.type !== 'material' ? item.displayName : undefined);
        return url ? <img src={url} alt="" style={{ width: 30, height: 30, objectFit: 'contain', imageRendering: 'pixelated', borderRadius: 4, background: 'rgba(0,0,0,0.25)' }} /> : <div style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📦</div>;
      })()}
      <div style={{ fontSize: 10, fontWeight: 600, color: item.qualityColor || 'var(--text-primary)', lineHeight: 1.2, textAlign: 'center', overflowWrap: 'break-word', width: '100%' }}>
        {item.displayName || item.name}
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
        {item.type === 'material' || item.type === 'bullet' ? `x${item.quantity || 1}` : `Lv.${item.level}`}
      </div>
      <Button variant="primary" size="sm"
        onClick={onBuy}
        disabled={!canAfford}
        style={{ width: '100%', fontSize: 10, padding: '2px 4px', marginTop: 0 }}
      >
        {buyPrice} 💾
      </Button>
    </div>
  );
};

export const Bazaar = () => {
  const playerLevel = usePlayerStore((s) => s.level);
  const dataChips = usePlayerStore((s) => s.dataChips);
  const spendChips = usePlayerStore((s) => s.spendChips);
  const addChips = usePlayerStore((s) => s.addChips);
  const addLog = usePlayerStore((s) => s.addLog);
  const addItemToInv = useInventoryStore((s) => s.addItem);
  const removeFromInv = useInventoryStore((s) => s.removeItem);
  const inventoryItems = useInventoryStore((s) => s.items);
  const token = useAuthStore((s) => s.token);
  const getUtil = () => usePlayerStore.getState().skillUtility();
  const applyBuyDiscount = (price: number) => Math.floor(price * (1 - getUtil().buyDiscount));
  const applySellBonus = (price: number) => Math.floor(price * (1 + getUtil().sellBonus));
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const [shopTab, setShopTab] = useState<StallId>('all');
  const [sortKey, setSortKey] = useState<SortKey>('price');
  const [sortAsc, setSortAsc] = useState(false);

  // Shop state from server
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [refreshAt, setRefreshAt] = useState(0);
  const [shopLoading, setShopLoading] = useState(true);
  const [timerSec, setTimerSec] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sell slots — reference items but don't remove from inventory
  const [sellSlots, setSellSlots] = useState<(Item | null)[]>(() => Array(SELL_SLOT_COUNT + getUtil().extraShopSlots).fill(null));
  const [sellQty, setSellQty] = useState<Record<number, number>>({});

  // Load shop from server on mount
  const loadShop = useCallback(async () => {
    if (!token) return;
    setShopLoading(true);
    try {
      const res = await fetch(`${API_BASE}/bazaar/load.php`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json.needsRefresh) {
        // Generate new shop client-side, sync to server
        const fresh = generateShop(playerLevel);
        const newRefreshAt = Date.now() + SHOP_INTERVAL_MS;
        const syncRes = await fetch(`${API_BASE}/bazaar/sync.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ items: fresh, refreshAt: newRefreshAt }),
        });
        if (syncRes.ok) {
          setShopItems(fresh);
          setRefreshAt(newRefreshAt);
        }
      } else {
        setShopItems(json.items || []);
        setRefreshAt(json.refreshAt || 0);
        if (json.dataChips !== undefined) {
          usePlayerStore.setState({ dataChips: json.dataChips });
        }
      }
    } catch {}
    setShopLoading(false);
  }, [token, playerLevel]);

  useEffect(() => {
    loadShop();
  }, [loadShop]);

  // Countdown timer from refreshAt
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const tick = () => {
      const remaining = Math.max(0, Math.floor((refreshAt - Date.now()) / 1000));
      setTimerSec(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current!);
        loadShop(); // will trigger refresh
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [refreshAt, loadShop]);

  // Total inventory quantity for a material name (sum across all entries)
  const getTotalMatQty = useCallback((name: string): number => {
    return inventoryItems
      .filter((i) => i.name === name && i.type === 'material')
      .reduce((sum, i) => sum + (i.quantity || 1), 0);
  }, [inventoryItems]);

  // Update sellQty when sellSlots change (reset qty for new items)
  useEffect(() => {
    setSellQty((prev) => {
      const next: Record<number, number> = {};
      for (const idx in sellSlots) {
        const item = sellSlots[idx];
        if (item) {
          const maxQty = item.type === 'material' ? getTotalMatQty(item.name) : (item.quantity || 1);
          const existing = prev[idx];
          next[idx] = existing && existing <= maxQty ? existing : 1;
        }
      }
      return next;
    });
  }, [sellSlots, getTotalMatQty]);

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

  // Товары лавки из отсортированного списка.
  const stallItems = (id: string): ShopItem[] => {
    if (id === 'resources') return sortedShop.filter((item) => item.type === 'material');
    const stall = STALLS.find((s) => s.id === id);
    const validSlots = stall ? [...stall.slots] : [];
    return sortedShop.filter((item) => validSlots.includes(item.slot));
  };

  const handleBuy = async (shopItem: ShopItem) => {
    if (!token) return;
    const buyPrice = applyBuyDiscount(shopItem.price);
    if (dataChips < buyPrice) {
      addLog(`❌ Недостаточно чипов (${dataChips} < ${buyPrice})`, 'warning');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/bazaar/buy.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ itemId: shopItem.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        addLog(`❌ ${err.error || 'Ошибка покупки'}`, 'warning');
        return;
      }
      const json = await res.json();
      // Update client-side: remove from shop, add chips
      setShopItems((prev) => prev.filter((i) => i.id !== shopItem.id));
      usePlayerStore.setState({ dataChips: json.dataChips });
      const serverItemId: string = json.itemId || `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      // Add item to inventory
      if (shopItem.type === 'material') {
        addItemToInv({
          id: serverItemId,
          name: shopItem.resourceName || shopItem.name,
          displayName: shopItem.resourceName || shopItem.name,
          rarity: 'common', level: 1, slot: 'any', stats: {},
          qualityColor: '#94a3b8', quality: 'Обычный', type: 'material',
          quantity: shopItem.quantity || 1,
        });
      } else {
        addItemToInv({
          id: serverItemId,
          name: shopItem.name, displayName: shopItem.displayName,
          rarity: shopItem.rarity, level: shopItem.level, slot: shopItem.slot,
          stats: shopItem.stats, qualityColor: shopItem.qualityColor,
          quality: shopItem.quality, type: shopItem.type,
          abilityId: shopItem.abilityId,
          quantity: (shopItem as any).quantity || 1,
          ammoGroup: (shopItem as any).ammoGroup,
          ammoCapacity: (shopItem as any).ammoCapacity,
          mods: (shopItem as any).mods,
          set: (shopItem as any).set,
          damage: (shopItem as any).damage,
        });
      }
      addLog(`🛒 Куплено: ${shopItem.displayName || shopItem.name} за ${json.charged ?? buyPrice} 💾`, 'loot');
    } catch {
      addLog('❌ Ошибка сети при покупке', 'warning');
    }
  };

  // Sell: drag-drop — just reference, don't remove from inventory
  const handleSellDrop = useCallback((slotIdx: number, e: React.DragEvent) => {
    e.preventDefault();
    const draggableId = e.dataTransfer.getData('text/plain');
    if (!draggableId) return;
    const item = inventoryItems.find((i) => i.id === draggableId);
    if (!item) return;
    if (sellSlots.some((s) => s?.id === item.id)) return;
    setSellSlots((prev) => {
      const next = [...prev];
      next[slotIdx] = item;
      return next;
    });
    // Initialize quantity for this slot
    setSellQty((prev) => ({ ...prev, [slotIdx]: 1 }));
  }, [inventoryItems, sellSlots]);

  const handleSellSlotRemove = (slotIdx: number) => {
    setSellSlots((prev) => {
      const next = [...prev];
      next[slotIdx] = null;
      return next;
    });
    setSellQty((prev) => {
      const next = { ...prev };
      delete next[slotIdx];
      return next;
    });
  };

  const adjustSellQty = (slotIdx: number, delta: number) => {
    const item = sellSlots[slotIdx];
    if (!item) return;
    const max = item.type === 'material' ? getTotalMatQty(item.name) : (item.quantity || 1);
    setSellQty((prev) => ({
      ...prev,
      [slotIdx]: Math.max(1, Math.min(max, (prev[slotIdx] || 1) + delta)),
    }));
  };

  const totalSellValue = useMemo(() => {
    const bonus = getUtil().sellBonus;
    return sellSlots.reduce((sum, item, idx) => {
      if (!item) return sum;
      const qty = sellQty[idx] || 1;
      const basePrice = getSellPrice(item);
      const perUnit = item.quantity && item.quantity > 1
        ? Math.floor(basePrice / (item.quantity || 1))
        : basePrice;
      return sum + Math.floor(perUnit * qty * (1 + bonus));
    }, 0);
  }, [sellSlots, sellQty]);

  const handleSellAll = async () => {
    if (totalSellValue <= 0) return;
    if (!token) return;
    const slots = sellSlots
      .map((item, idx) => {
        if (!item) return null;
        const qty = sellQty[idx] || 1;
        // For materials, sell by name (covers all inventory entries with that name)
        if (item.type === 'material') return { name: item.name, quantity: qty };
        return { itemId: item.id, quantity: qty };
      })
      .filter(Boolean);
    try {
      const res = await fetch(`${API_BASE}/bazaar/sell.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ slots }),
      });
      if (!res.ok) {
        addLog('❌ Ошибка при продаже', 'warning');
        return;
      }
      const json = await res.json();
      // Update client inventory
      for (const slot of slots) {
        if (!slot) continue;
        const qty = slot.quantity;
        if (slot.name) {
          // Material sold by name — deduct from all matching entries
          let remaining = qty;
          for (const invItem of inventoryItems) {
            if (remaining <= 0) break;
            if (invItem.name === slot.name && invItem.type === 'material') {
              if (remaining >= (invItem.quantity || 1)) {
                removeFromInv(invItem.id);
                remaining -= invItem.quantity || 1;
              } else {
                useInventoryStore.setState((s) => ({
                  items: s.items.map((i) =>
                    i.id === invItem.id ? { ...i, quantity: (i.quantity || 1) - remaining } : i
                  ),
                }));
                remaining = 0;
              }
            }
          }
        } else if (slot.itemId) {
          const invItem = inventoryItems.find((i) => i.id === slot.itemId);
          if (!invItem) continue;
          if (!invItem.quantity || invItem.quantity <= 1 || qty >= invItem.quantity) {
            removeFromInv(slot.itemId);
          } else {
            useInventoryStore.setState((s) => ({
              items: s.items.map((i) =>
                i.id === slot.itemId ? { ...i, quantity: (i.quantity || 1) - qty } : i
              ),
            }));
          }
        }
      }
      usePlayerStore.setState({ dataChips: json.dataChips });
      addLog(`💰 Продано за ${totalSellValue} 💾`, 'loot');
      setSellSlots(Array(SELL_SLOT_COUNT + getUtil().extraShopSlots).fill(null));
      setSellQty({});
    } catch {
      addLog('❌ Ошибка сети при продаже', 'warning');
    }
  };

  const handleRefresh = async () => {
    if (!token) return;
    const baseCost = playerLevel * 100;
    const cost = Math.floor(baseCost * (1 - getUtil().refreshDiscount));
    if (dataChips < cost) {
      addLog(`❌ Недостаточно чипов для обновления. Нужно ${cost}`, 'warning');
      return;
    }
    const fresh = generateShop(playerLevel);
    const newRefreshAt = Date.now() + SHOP_INTERVAL_MS;
    try {
      const res = await fetch(`${API_BASE}/bazaar/refresh.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ items: fresh, refreshAt: newRefreshAt, cost }),
      });
      if (!res.ok) {
        addLog('❌ Ошибка обновления', 'warning');
        return;
      }
      const json = await res.json();
      setShopItems(fresh);
      setRefreshAt(newRefreshAt);
      usePlayerStore.setState({ dataChips: json.dataChips });
      addLog(`🔄 Базар обновлён за ${cost} 💾`, 'info');
    } catch {
      addLog('❌ Ошибка сети', 'warning');
    }
  };

  const [hoveredShopItem, setHoveredShopItem] = useState<ShopItem | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [hoveredSellItem, setHoveredSellItem] = useState<Item | null>(null);
  const [tooltipSellPos, setTooltipSellPos] = useState({ x: 0, y: 0 });

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <WapPanel variant="metal" padding="lg">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>🏪 Барахолка</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
              Торговая площадь: лавки мастеров и ресурсные ряды.<br />
              Новый завоз — каждые 24 часа.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
            <div style={{
              padding: '10px 16px', textAlign: 'center',
              background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)',
              borderRadius: 10, minWidth: 110,
            }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1 }}>КОШЕЛЁК</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
                💾 {dataChips.toLocaleString()}
              </div>
            </div>
            <div style={{
              padding: '10px 16px', textAlign: 'center',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, minWidth: 110, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6,
            }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1 }}>ЗАВОЗ ЧЕРЕЗ</div>
              <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                {timerSec > 0
                  ? `${Math.floor(timerSec / 3600)}:${String(Math.floor((timerSec % 3600) / 60)).padStart(2, '0')}:${String(timerSec % 60).padStart(2, '0')}`
                  : 'обновление...'}
              </div>
              <Button size="sm" variant="ghost" onClick={handleRefresh} disabled={shopLoading} style={{ fontSize: 10 }}>
                🔄 Обновить товары · {Math.floor(playerLevel * 100 * (1 - getUtil().refreshDiscount))}💾
              </Button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <Button variant={tab === 'buy' ? 'primary' : 'ghost'} size="sm" onClick={() => setTab('buy')}>🛒 Купить</Button>
          <Button variant={tab === 'sell' ? 'primary' : 'ghost'} size="sm" onClick={() => setTab('sell')}>💰 Скупка</Button>
        </div>

        {tab === 'buy' ? (
          shopLoading ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>Загрузка товаров...</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                {([{ id: 'all', label: 'Вся площадь', icon: '📋' }, ...STALLS.map((s) => ({ id: s.id, label: s.label, icon: s.icon }))] as const).map((st) => (
                  <div key={st.id} onClick={() => setShopTab(st.id)}
                    style={{
                      padding: '4px 12px', fontSize: 11, cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                      background: shopTab === st.id ? 'var(--bg-glass-hover)' : 'transparent',
                      border: `1px solid ${shopTab === st.id ? 'var(--accent-primary)' : 'rgba(255,255,255,0.06)'}`,
                      color: shopTab === st.id ? 'var(--accent-primary)' : 'var(--text-muted)',
                      transition: 'all 80ms',
                    }}
                  >{st.icon} {st.label}</div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 14, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Сортировать:</span>
                {(['price', 'level', 'name', 'quality'] as SortKey[]).map((k) => (
                  <div key={k}
                    onClick={() => { if (sortKey === k) setSortAsc(!sortAsc); else { setSortKey(k); setSortAsc(false); } }}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {(shopTab === 'all' ? STALLS : STALLS.filter((s) => s.id === shopTab)).map((stall) => {
                  const goods = stallItems(stall.id);
                  if (goods.length === 0) return null;
                  return (
                    <div key={stall.id}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: stall.color }}>{stall.icon} {stall.label}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>{stall.flavor}</span>
                        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginLeft: 'auto' }}>{goods.length} шт.</span>
                      </div>
                      <div style={{
                        borderTop: `2px solid ${stall.color}44`, paddingTop: 10,
                      }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 8 }}>
                          {goods.map((item) => {
                            const buyPrice = applyBuyDiscount(item.price);
                            return (
                              <ProductCard
                                key={item.id}
                                item={item}
                                buyPrice={buyPrice}
                                canAfford={dataChips >= buyPrice}
                                onBuy={() => handleBuy(item)}
                                onHover={(e) => { setHoveredShopItem(item); setTooltipPos({ x: e.clientX, y: e.clientY }); }}
                                onMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                                onLeave={() => setHoveredShopItem(null)}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#4ade80' }}>🧑‍🌾 Скупщик</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>выложи товар на прилавок — посчитаем сразу</span>
            </div>
            <div style={{
              border: '2px dashed rgba(74,222,128,0.3)', borderRadius: 12,
              background: 'rgba(74,222,128,0.04)', padding: 14, marginBottom: 12,
            }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.6 }}>
                Перетащи предметы из инвентаря на прилавок. Для стаковых выбери количество, клик по слоту — убрать.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {sellSlots.map((item, idx) => (
                <div key={idx}
                  onDrop={(e) => handleSellDrop(idx, e)}
                  onDragOver={(e) => e.preventDefault()}
                  onMouseEnter={(e) => { if (item) { setHoveredSellItem(item); setTooltipSellPos({ x: e.clientX, y: e.clientY }); } }}
                  onMouseMove={(e) => { if (hoveredSellItem) setTooltipSellPos({ x: e.clientX, y: e.clientY }); }}
                  onMouseLeave={() => setHoveredSellItem(null)}
                  style={{
                    width: 72, minHeight: 72,
                    background: item ? 'var(--bg-glass)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${item ? (item.qualityColor || 'rgba(255,255,255,0.15)') : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    position: 'relative', cursor: item ? 'pointer' : 'default',
                    transition: 'all 100ms', gap: 2,
                  }}
                  onClick={() => item && handleSellSlotRemove(idx)}
                  title={item ? `${item.displayName || item.name} — клик убрать` : ''}
                >
                  {item ? (
                    <>
                      {(() => { const url = getItemImage(item.name, item.displayName); return url ? <img src={url} alt="" style={{ width: 28, height: 28, objectFit: 'contain', imageRendering: 'pixelated' }} /> : null; })()}
                      <div style={{
                        position: 'absolute', top: 1, right: 1,
                        fontSize: 8, fontFamily: 'var(--font-mono)',
                        color: 'var(--accent-warning)', background: 'rgba(0,0,0,0.7)',
                        borderRadius: 2, padding: '0 2px', lineHeight: '11px',
                      }}>
                        {(() => {
                          const perUnit = item.quantity && item.quantity > 1
                            ? Math.floor(getSellPrice(item) / (item.quantity || 1))
                            : getSellPrice(item);
                          const qty = sellQty[idx] || 1;
                          const bonus = getUtil().sellBonus;
                          return `${Math.floor(perUnit * qty * (1 + bonus))}💾`;
                        })()}
                      </div>
                      {(item.quantity || 1) > 1 && (
                        <div style={{ display: 'flex', gap: 2, alignItems: 'center', fontSize: 10, marginTop: 2 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div onClick={() => adjustSellQty(idx, -1)}
                            style={{ width: 16, height: 16, borderRadius: 3, background: 'rgba(239,68,68,0.2)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 700, fontSize: 12, lineHeight: '16px' }}
                          >−</div>
                          <span style={{ minWidth: 20, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{sellQty[idx] || 1}</span>
                          <div onClick={() => adjustSellQty(idx, 1)}
                            style={{ width: 16, height: 16, borderRadius: 3, background: 'rgba(34,197,94,0.2)', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 700, fontSize: 12, lineHeight: '16px' }}
                          >+</div>
                        </div>
                      )}
                    </>
                  ) : (
                    <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.08)' }}>+</span>
                  )}
                </div>
              ))}
              </div>
            </div>
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
      {hoveredShopItem && <ItemTooltip item={hoveredShopItem as unknown as Item} x={tooltipPos.x} y={tooltipPos.y} />}
      {hoveredSellItem && <ItemTooltip item={hoveredSellItem} x={tooltipSellPos.x} y={tooltipSellPos.y} />}
    </motion.div>
  );
};
