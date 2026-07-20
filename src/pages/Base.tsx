import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WapPanel } from '../components/ui/WapPanel';
import { Button } from '../components/ui/Button';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Badge } from '../components/ui/Badge';
import { usePlayerStore } from '../stores/playerStore';
import { useInventoryStore } from '../stores/inventoryStore';
import { useUiStore } from '../stores/uiStore';
import { BASE_POINTS, type BasePoint } from '../data/basePoints';
import type { ActiveEffect } from '../types/player';

interface UpgradeReq {
  items: { name: string; count: number }[];
  chips: number;
  time: number;
}

const ORIGINAL_RESOURCES = ['Железо', 'Дерево', 'Пластмасса', 'Вода', 'Гвозди', 'Изолента', 'Инструменты', 'Топливо', 'Батарейки', 'Консервы', 'Лекарства'] as const;

const RESOURCE_PATTERNS: Record<string, string[]> = {
  'base-workbench': ['Железо', 'Инструменты', 'Изолента'],
  'base-garden': ['Дерево', 'Вода', 'Консервы'],
  'base-greenhouse': ['Пластмасса', 'Вода', 'Батарейки'],
  'base-sleep': ['Дерево', 'Изолента', 'Батарейки'],
  'base-weapons': ['Железо', 'Инструменты', 'Топливо'],
  'base-armor': ['Железо', 'Пластмасса', 'Инструменты'],
  'base-livestock': ['Дерево', 'Вода', 'Консервы'],
  'base-medbay': ['Лекарства', 'Вода', 'Пластмасса'],
  'base-fun': ['Дерево', 'Батарейки', 'Изолента'],
  'base-gym': ['Дерево', 'Гвозди', 'Железо'],
  'base-watchtower': ['Дерево', 'Батарейки', 'Инструменты'],
};

const genRequirements = (baseId: string, level: number): UpgradeReq | null => {
  if (level > 30) return null;
  const pattern = RESOURCE_PATTERNS[baseId] || ['Железо', 'Гвозди', 'Дерево'];
  const coeffs = [0.33, 0.28, 0.22];
  const bases = [2, 1, 1];
  const items = pattern.map((name, i) => ({
    name,
    count: Math.max(bases[i], Math.floor(bases[i] + level * level * coeffs[i])),
  }));
  return {
    items,
    chips: Math.floor(20 + level * 5 + level * level * 0.5),
    time: Math.floor(18000 * Math.pow(level, 1.3)),
  };
};

// Base consumables system — matching original
interface BaseConsumable {
  id: string; name: string; desc: string; icon: string;
  requiredBase: string; requiredLevel: number;
  cooldown: number; duration: number;
  statBoosts: Record<string, number>;
}
const BASE_CONSUMABLES: BaseConsumable[] = [
  { id: 'med_bandage', name: 'Бинт', desc: 'Медленная регенерация', icon: '🩹', requiredBase: 'Медицина', requiredLevel: 1, cooldown: 30, duration: 30, statBoosts: { regen: 2 } },
  { id: 'med_kit', name: 'Аптечка', desc: 'Сильная регенерация', icon: '💊', requiredBase: 'Медицина', requiredLevel: 3, cooldown: 60, duration: 60, statBoosts: { regen: 5, maxHp: 50 } },
  { id: 'med_stimulant', name: 'Стимулятор', desc: 'Ускорение + реген', icon: '💉', requiredBase: 'Медицина', requiredLevel: 5, cooldown: 120, duration: 30, statBoosts: { speed: 0.03, regen: 3 } },
  { id: 'med_boost', name: 'Адреналин', desc: 'Мощный бафф HP', icon: '❤️‍🔥', requiredBase: 'Медицина', requiredLevel: 10, cooldown: 300, duration: 15, statBoosts: { maxHp: 200, regen: 10 } },
  { id: 'med_nanogel', name: 'Наногель', desc: 'Реген + броня', icon: '🧬', requiredBase: 'Медицина', requiredLevel: 15, cooldown: 600, duration: 60, statBoosts: { regen: 8, armor: 5 } },

  { id: 'weap_sharpen', name: 'Заточка', desc: '+ урон на 30с', icon: '⚔️', requiredBase: 'Оружейная', requiredLevel: 1, cooldown: 30, duration: 30, statBoosts: { damage: 5 } },
  { id: 'weap_oil', name: 'Оружейное масло', desc: '+ урон + крит', icon: '🛢️', requiredBase: 'Оружейная', requiredLevel: 3, cooldown: 60, duration: 45, statBoosts: { damage: 10, crit: 0.02 } },
  { id: 'weap_overclock', name: 'Разгон', desc: 'Скорость + урон', icon: '⚡', requiredBase: 'Оружейная', requiredLevel: 5, cooldown: 120, duration: 30, statBoosts: { speed: 0.05, damage: 8 } },
  { id: 'weap_thermite', name: 'Термит', desc: '+ бронепробитие', icon: '🔥', requiredBase: 'Оружейная', requiredLevel: 10, cooldown: 300, duration: 30, statBoosts: { punching: 0.05, damage: 15 } },
  { id: 'weap_rage', name: 'Ярость', desc: 'Мощный бафф урона', icon: '💢', requiredBase: 'Оружейная', requiredLevel: 15, cooldown: 600, duration: 20, statBoosts: { damage: 30, crit: 0.05, accuracy: -0.05 } },

  { id: 'arm_plate', name: 'Пластина', desc: '+ броня', icon: '🛡️', requiredBase: 'Броня', requiredLevel: 1, cooldown: 30, duration: 30, statBoosts: { armor: 5 } },
  { id: 'arm_kevlar', name: 'Кевлар', desc: 'Броня + блок', icon: '🧥', requiredBase: 'Броня', requiredLevel: 3, cooldown: 60, duration: 45, statBoosts: { armor: 10, block: 0.02 } },
  { id: 'arm_shield', name: 'Экран', desc: 'Мощный блок', icon: '🔰', requiredBase: 'Броня', requiredLevel: 5, cooldown: 120, duration: 20, statBoosts: { block: 0.08, armor: 8 } },
  { id: 'arm_field', name: 'Поле', desc: 'Щит + evasion', icon: '🌀', requiredBase: 'Броня', requiredLevel: 10, cooldown: 300, duration: 30, statBoosts: { armor: 15, evasion: 0.05 } },
  { id: 'arm_barrier', name: 'Барьер', desc: 'Макс защита', icon: '🏰', requiredBase: 'Броня', requiredLevel: 15, cooldown: 600, duration: 20, statBoosts: { armor: 25, block: 0.10, regen: 5 } },
];

interface LevelBonus {
  level: number;
  label: string;
}
const BASE_BONUSES: Record<string, LevelBonus[]> = {
  'Верстаки': [
    { level: 1, label: 'Разблокирован верстак' },
    { level: 5, label: '+10% качество крафта' },
    { level: 10, label: '+15% качество крафта' },
    { level: 15, label: '+20% качество крафта' },
    { level: 20, label: '+25% качество крафта' },
    { level: 25, label: '+30% качество крафта' },
    { level: 30, label: '+50% качество крафта' },
  ],
  'Огород': [
    { level: 1, label: 'Разблокирован огород' },
    { level: 5, label: '+5 🍎 еды/час' },
    { level: 10, label: '+10 🍎 еды/час' },
    { level: 15, label: '+20 🍎 еды/час' },
    { level: 20, label: '+35 🍎 еды/час' },
    { level: 25, label: '+50 🍎 еды/час' },
    { level: 30, label: '+100 🍎 еды/час' },
  ],
  'Теплица': [
    { level: 1, label: 'Разблокирована теплица' },
    { level: 5, label: '+3 ресурса/день' },
    { level: 10, label: '+6 ресурсов/день' },
    { level: 15, label: '+12 ресурсов/день' },
    { level: 20, label: '+20 ресурсов/день' },
    { level: 25, label: '+30 ресурсов/день' },
    { level: 30, label: '+50 ресурсов/день' },
  ],
  'Зона сна': [
    { level: 1, label: 'Разблокирована зона сна' },
    { level: 5, label: '+20% скорость регена выносливости' },
    { level: 10, label: '+40% скорость регена выносливости' },
    { level: 15, label: '+60% скорость регена выносливости' },
    { level: 20, label: '+80% скорость регена выносливости' },
    { level: 25, label: '+100% скорость регена выносливости' },
    { level: 30, label: '+150% скорость регена выносливости' },
  ],
  'Оружейная': [
    { level: 1, label: 'Разблокирована оружейная' },
    { level: 5, label: '+5% урон оружием' },
    { level: 10, label: '+10% урон оружием' },
    { level: 15, label: '+15% урон оружием' },
    { level: 20, label: '+20% урон оружием' },
    { level: 25, label: '+25% урон оружием' },
    { level: 30, label: '+40% урон оружием' },
  ],
  'Броня': [
    { level: 1, label: 'Разблокирована броня' },
    { level: 5, label: '+5% броня' },
    { level: 10, label: '+10% броня' },
    { level: 15, label: '+15% броня' },
    { level: 20, label: '+20% броня' },
    { level: 25, label: '+25% броня' },
    { level: 30, label: '+40% броня' },
  ],
  'Дом. скот': [
    { level: 1, label: 'Разблокирован дом. скот' },
    { level: 5, label: '+5 💾 чипов/час' },
    { level: 10, label: '+10 💾 чипов/час' },
    { level: 15, label: '+20 💾 чипов/час' },
    { level: 20, label: '+35 💾 чипов/час' },
    { level: 25, label: '+50 💾 чипов/час' },
    { level: 30, label: '+100 💾 чипов/час' },
  ],
  'Медицина': [
    { level: 1, label: 'Разблокирована медицина' },
    { level: 5, label: '+5% эффективность лечения' },
    { level: 10, label: '+10% эффективность лечения' },
    { level: 15, label: '+15% эффективность лечения' },
    { level: 20, label: '+20% эффективность лечения' },
    { level: 25, label: '+25% эффективность лечения' },
    { level: 30, label: '+50% эффективность лечения' },
  ],
  'Развлечения': [
    { level: 1, label: 'Разблокированы развлечения' },
    { level: 5, label: '+5% опыт' },
    { level: 10, label: '+10% опыт' },
    { level: 15, label: '+15% опыт' },
    { level: 20, label: '+20% опыт' },
    { level: 25, label: '+30% опыт' },
    { level: 30, label: '+50% опыт' },
  ],
  'Склад': [
    { level: 1, label: 'Разблокирован склад' },
    { level: 5, label: '+10 ячеек инвентаря' },
    { level: 10, label: '+20 ячеек инвентаря' },
    { level: 15, label: '+30 ячеек инвентаря' },
    { level: 20, label: '+50 ячеек инвентаря' },
    { level: 25, label: '+75 ячеек инвентаря' },
    { level: 30, label: '+100 ячеек инвентаря' },
  ],
  'Вышка': [
    { level: 1, label: 'Разблокирована вышка' },
    { level: 5, label: '+5% радиус обзора' },
    { level: 10, label: '+10% радиус обзора' },
    { level: 15, label: '+15% радиус обзора' },
    { level: 20, label: '+20% радиус обзора' },
    { level: 25, label: '+30% радиус обзора' },
    { level: 30, label: '+50% радиус обзора' },
  ],
};

const formatDuration = (sec: number): string => {
  if (sec < 60) return `${sec}с`;
  if (sec < 3600) return `${Math.floor(sec / 60)}м ${sec % 60}с`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}ч ${Math.floor((sec % 3600) / 60)}м`;
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  return `${d}д ${h}ч`;
};

export const Base = () => {
  const dataChips = usePlayerStore((s) => s.dataChips);
  const spendChips = usePlayerStore((s) => s.spendChips);
  const addLog = usePlayerStore((s) => s.addLog);
  const baseUpgrades = usePlayerStore((s) => s.baseUpgrades as Record<string, number> || {});
  const addEffect = usePlayerStore((s) => s.addEffect);
  const activeEffects = usePlayerStore((s) => s.activeEffects);
  const inventoryItems = useInventoryStore((s) => s.items);
  const removeItem = useInventoryStore((s) => s.removeItem);
  const storeCraftingTimer = useUiStore((s) => s.craftingTimer);
  const storeCraftingType = useUiStore((s) => s.craftingType);
  const storeCraftingLabel = useUiStore((s) => s.craftingLabel);
  const storeUpgradingBase = useUiStore((s) => s.upgradingBase);
  const setCraftingTimer = useUiStore((s) => s.setCraftingTimer);
  const setCraftingType = useUiStore((s) => s.setCraftingType);
  const setCraftingLabel = useUiStore((s) => s.setCraftingLabel);
  const setUpgradingBase = useUiStore((s) => s.setUpgradingBase);

  const [selectedUpg, setSelectedUpg] = useState<BasePoint | null>(null);
  const [placedItems, setPlacedItems] = useState<{ name: string; count: number; itemIds: string[] }[]>([]);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});

  // Cleanup local state when upgrade completes
  useEffect(() => {
    if (!storeUpgradingBase && storeCraftingTimer === 0 && (selectedUpg || placedItems.length > 0)) {
      setSelectedUpg(null);
      setPlacedItems([]);
    }
  }, [storeUpgradingBase, storeCraftingTimer]);

  // Cooldown tick
  useEffect(() => {
    const t = setInterval(() => {
      setCooldowns((prev) => {
        const next: Record<string, number> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (v > 1) next[k] = v - 1;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Restore upgrade state on mount if store has active upgrade
  useEffect(() => {
    if (storeCraftingType === 'upgrade' && storeCraftingTimer > 0 && storeUpgradingBase) {
      const bp = BASE_POINTS.find((p) => p.name === storeUpgradingBase);
      if (bp) setSelectedUpg(bp);
    } else if (storeCraftingTimer <= 0 && storeUpgradingBase) {
      // Stuck upgrade state — apply immediately
      const bn = storeUpgradingBase;
      usePlayerStore.getState().upgradeBase(bn);
      const newLevel = usePlayerStore.getState().baseUpgrades[bn] || 0;
      usePlayerStore.getState().addLog(`🏢 ${bn} улучшена до уровня ${newLevel}!`, 'loot');
      useUiStore.getState().setCraftingType(null);
      useUiStore.getState().setCraftingLabel('');
      useUiStore.getState().setUpgradingBase(null);
      useUiStore.getState().setCraftingTimer(0);
    }
  }, []);

  const closeModal = () => {
    for (const placed of placedItems) {
      for (const itemId of placed.itemIds) {
        const stillHas = inventoryItems.find((i) => i.id === itemId);
        if (!stillHas) {
          useInventoryStore.getState().addItem({
            id: `refund-${placed.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: placed.name, displayName: placed.name,
            type: 'material' as const, slot: 'any', rarity: 'common', level: 1, stats: {}, quantity: placed.count,
          });
        }
      }
    }
    setSelectedUpg(null); setPlacedItems([]);
  };

  const openUpgrade = (bp: BasePoint) => {
    if (storeUpgradingBase === bp.name) return;
    setSelectedUpg(bp); setPlacedItems([]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!selectedUpg) return;
    const currentLevel = baseUpgrades[selectedUpg.name] || 0;
    const req = genRequirements(selectedUpg.className, currentLevel + 1);
    if (!req) return;
    const itemId = e.dataTransfer.getData('text/plain');
    if (!itemId) return;
    const item = inventoryItems.find((i) => i.id === itemId);
    if (!item || item.type !== 'material') { addLog('❌ Только ресурсы', 'warning'); return; }
    const neededItem = req.items.find((ri) => ri.name === item.name);
    if (!neededItem) { addLog(`❌ ${item.name} не нужен`, 'warning'); return; }
    const alreadyPlaced = placedItems.find((p) => p.name === item.name);
    if (alreadyPlaced && alreadyPlaced.count >= neededItem.count) { addLog(`❌ Уже достаточно`, 'warning'); return; }
    const currentPlaced = placedItems.find((p) => p.name === item.name);
    const alreadyCount = currentPlaced?.count || 0;
    const remaining = neededItem.count - alreadyCount;
    if (remaining <= 0) return;
    const available = item.quantity || 1;
    const take = Math.min(available, remaining);
    const updateItemQuantity = (useInventoryStore.getState() as any).updateItemQuantity;
    if (updateItemQuantity && available > take) { updateItemQuantity(item.id, available - take); }
    else { removeItem(item.id); }
    if (currentPlaced) { currentPlaced.count += take; currentPlaced.itemIds.push(item.id); setPlacedItems([...placedItems]); }
    else { setPlacedItems((prev) => [...prev, { name: item.name, count: take, itemIds: [item.id] }]); }
    addLog(`📦 ${item.name} x${take} (${alreadyCount + take}/${neededItem.count})`, 'info');
  };

  const handleRemovePlaced = (name: string) => {
    const placed = placedItems.find((p) => p.name === name);
    if (!placed) return;
    useInventoryStore.getState().addItem({
      id: `refund-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name, displayName: name, type: 'material' as const, slot: 'any', rarity: 'common', level: 1, stats: {}, quantity: placed.count,
    });
    setPlacedItems((prev) => prev.filter((p) => p.name !== name));
  };

  const getResourceCount = (name: string) => {
    let total = 0;
    for (const item of inventoryItems) {
      if (item.name === name && item.type === 'material') total += item.quantity || 1;
    }
    return total;
  };

  const autoPlaceResources = () => {
    if (!selectedUpg) return;
    const currentLevel = baseUpgrades[selectedUpg.name] || 0;
    const req = genRequirements(selectedUpg.className, currentLevel + 1);
    if (!req) return;
    for (const ri of req.items) {
      const alreadyPlaced = placedItems.find((p) => p.name === ri.name)?.count || 0;
      if (alreadyPlaced >= ri.count) continue;
      const need = ri.count - alreadyPlaced;
      let taken = 0;
      const toRemove: { id: string; qty: number }[] = [];
      for (const item of inventoryItems) {
        if (taken >= need) break;
        if (item.name === ri.name && item.type === 'material') {
          const avail = item.quantity || 1;
          const take = Math.min(avail, need - taken);
          taken += take;
          toRemove.push({ id: item.id, qty: take });
        }
      }
      for (const r of toRemove) {
        const item = inventoryItems.find((i) => i.id === r.id);
        if (!item) continue;
        if ((item.quantity || 1) > r.qty) {
          useInventoryStore.setState((s) => ({
            items: s.items.map((i) => i.id === r.id ? { ...i, quantity: (i.quantity || 1) - r.qty } : i),
          }));
        } else {
          removeItem(r.id);
        }
      }
      if (taken > 0) {
        setPlacedItems((prev) => {
          const existing = prev.find((p) => p.name === ri.name);
          if (existing) {
            return prev.map((p) => p.name === ri.name ? { ...p, count: p.count + taken, itemIds: [...p.itemIds, ...toRemove.map((r) => r.id)] } : p);
          }
          return [...prev, { name: ri.name, count: taken, itemIds: toRemove.map((r) => r.id) }];
        });
        addLog(`📦 ${ri.name} x${taken} (${alreadyPlaced + taken}/${ri.count})`, 'info');
      }
    }
  };

  const startUpgrade = () => {
    if (!selectedUpg) return;
    const currentLevel = baseUpgrades[selectedUpg.name] || 0;
    const req = genRequirements(selectedUpg.className, currentLevel + 1);
    if (!req) return;
    if (!spendChips(req.chips)) { addLog(`❌ Нужно ${req.chips} 💾`, 'warning'); return; }
    setCraftingType('upgrade');
    setCraftingLabel(`${selectedUpg.name} ур.${currentLevel + 1}`);
    setCraftingTimer(req.time);
    setUpgradingBase(selectedUpg.name);
    setPlacedItems([]);
    addLog(`🔧 ${selectedUpg.name} улучшается... ${formatDuration(req.time)}`, 'system');
  };

  const useConsumable = (con: BaseConsumable) => {
    if (cooldowns[con.id]) { addLog(`❌ ${con.name} перезаряжается ${cooldowns[con.id]}с`, 'warning'); return; }
    const baseLevel = baseUpgrades[con.requiredBase] || 0;
    if (baseLevel < con.requiredLevel) { addLog(`❌ Нужен ур.${con.requiredLevel} ${con.requiredBase}`, 'warning'); return; }
    const effect: ActiveEffect = {
      id: `base_${con.id}_${Date.now()}`,
      name: con.name, duration: con.duration, remaining: con.duration, statBoosts: con.statBoosts,
    };
    addEffect(effect);
    addLog(`✨ ${con.name} активирован (${con.duration}с)`, 'heal');
    setCooldowns((prev) => ({ ...prev, [con.id]: con.cooldown }));
  };

  const itUpgrading = (id: string) => storeUpgradingBase === id;

  const upgradesList = useMemo(() => BASE_POINTS, []);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <WapPanel variant="metal" padding="lg">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>🏢 База</div>
          <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
            💾 {dataChips.toLocaleString()}
          </span>
        </div>

        {/* 11 Base Points Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {upgradesList.map((bp) => {
            const currentLevel = baseUpgrades[bp.name] || 0;
            const isMaxed = currentLevel >= bp.maxLevel;
            const req = isMaxed ? null : genRequirements(bp.className, currentLevel + 1);
            const upgrading = itUpgrading(bp.name);

            return (
              <div key={bp.name} onClick={() => openUpgrade(bp)}
                style={{
                  padding: 16, cursor: 'pointer',
                  background: 'var(--bg-glass)',
                  border: `1px solid ${upgrading ? 'var(--accent-warning)' : isMaxed ? '#fbbf24' : 'var(--border-glass)'}`,
                  borderRadius: 'var(--radius-md)',
                  display: 'flex', flexDirection: 'column', gap: 8,
                  position: 'relative', overflow: 'hidden',
                }}
              >
                {upgrading && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(251,191,36,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--accent-warning)', marginBottom: 4 }}>УЛУЧШЕНИЕ...</div>
                      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-warning)' }}>{storeCraftingTimer}с</div>
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 20 }}>{
                    bp.className === 'base-workbench' ? '🔧' :
                    bp.className === 'base-garden' ? '🌱' :
                    bp.className === 'base-greenhouse' ? '🌿' :
                    bp.className === 'base-sleep' ? '🛌' :
                    bp.className === 'base-weapons' ? '⚔️' :
                    bp.className === 'base-armor' ? '🛡️' :
                    bp.className === 'base-livestock' ? '🐄' :
                    bp.className === 'base-medbay' ? '🏥' :
                    bp.className === 'base-fun' ? '🎮' :
                    bp.className === 'base-gym' ? '🏋️' : '📡'
                  }</div>
                  <div style={{ fontSize: 12 }}>{isMaxed ? 'МАКС' : `Ур.${currentLevel + 1}/${bp.maxLevel}`}</div>
                </div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{bp.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.3 }}>{bp.description}</div>
                <ProgressBar value={currentLevel} max={bp.maxLevel} showLabel={false} height={5} />
              </div>
            );
          })}
        </div>
      </WapPanel>

      {/* Consumables panel */}
      <WapPanel variant="metal" padding="lg">
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>🧪 Расходные баффы базы</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
          {BASE_CONSUMABLES.map((con) => {
            const onCooldown = !!cooldowns[con.id];
            const baseLevel = baseUpgrades[con.requiredBase] || 0;
            const locked = baseLevel < con.requiredLevel;
            return (
              <div key={con.id} style={{
                padding: 12, borderRadius: 'var(--radius-sm)',
                background: locked ? 'rgba(255,255,255,0.02)' : 'var(--bg-glass)',
                border: `1px solid ${onCooldown ? 'rgba(255,255,255,0.05)' : 'var(--border-glass)'}`,
                opacity: locked ? 0.4 : 1,
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14 }}>{con.icon} {con.name}</span>
                  <Badge variant={con.requiredLevel <= 5 ? 'common' : con.requiredLevel <= 10 ? 'rare' : 'epic'}>
                    Lv.{con.requiredLevel}
                  </Badge>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{con.desc} ({con.duration}с)</div>
                <Button variant="primary" size="sm"
                  disabled={onCooldown || locked}
                  onClick={() => useConsumable(con)}
                  style={{ width: '100%', fontSize: 10 }}
                >
                  {locked ? `🔒 ${con.requiredBase} ур.${con.requiredLevel}` : onCooldown ? `⏳ ${cooldowns[con.id]}с` : `Активировать`}
                </Button>
              </div>
            );
          })}
        </div>
      </WapPanel>

      {/* Upgrade modal */}
      <AnimatePresence>
        {selectedUpg && !itUpgrading(selectedUpg.name) && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            style={{ position: 'fixed', top: 40, left: '50%', transform: 'translateX(-50%)', zIndex: 9998, width: 480, maxHeight: '80vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
              <WapPanel variant="metal" padding="lg">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{selectedUpg.name}</div>
                  <Button size="sm" variant="ghost" onClick={closeModal}>✕</Button>
                </div>
                {(() => {
                  const currentLevel = baseUpgrades[selectedUpg.name] || 0;
                  const req = genRequirements(selectedUpg.className, currentLevel + 1);
                  if (!req) {
                    return <div style={{ textAlign: 'center', padding: 20, color: '#fbbf24', fontWeight: 500 }}>✅ Максимальный уровень</div>;
                  }
                  const allPlaced = req.items.every((ri) => {
                    const placed = placedItems.find((p) => p.name === ri.name);
                    return placed && placed.count >= ri.count;
                  });
                  return (
                    <>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                        Требуется для ур.{currentLevel + 1} (всего {selectedUpg.maxLevel}):
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                        {req.items.map((ri) => {
                          const placed = placedItems.find((p) => p.name === ri.name);
                          const done = placed && placed.count >= ri.count;
                          const invCount = getResourceCount(ri.name);
                          return (
                            <div key={ri.name} onClick={() => placed && handleRemovePlaced(ri.name)}
                              style={{
                                flex: 1, minWidth: 120, padding: 16,
                                border: `2px dashed ${done ? 'var(--accent-success)' : placed ? 'var(--accent-warning)' : 'rgba(255,255,255,0.08)'}`,
                                borderRadius: 'var(--radius-sm)', textAlign: 'center',
                                background: done ? 'rgba(34,197,94,0.05)' : placed ? 'rgba(251,191,36,0.05)' : 'rgba(255,255,255,0.02)',
                                cursor: placed ? 'pointer' : 'default',
                              }}
                            >
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{ri.name}</div>
                              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)',
                                color: done ? 'var(--accent-success)' : placed ? 'var(--accent-warning)' : 'var(--text-muted)' }}>
                                {placed ? `${placed.count}/${ri.count}` : `x${ri.count}`}
                              </div>
                              <div style={{ fontSize: 10, color: invCount > 0 ? 'var(--accent-primary)' : 'var(--text-muted)', marginTop: 4 }}>
                                в инв: {invCount}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginBottom: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                        <span>💾 {req.chips}</span><span>⏱ {formatDuration(req.time)}</span>
                      </div>
                      {allPlaced ? (
                        <Button variant="primary" size="md" onClick={startUpgrade}
                          disabled={dataChips < req.chips} style={{ width: '100%', marginBottom: 12 }}>
                          🔧 Начать ({formatDuration(req.time)})
                        </Button>
                      ) : (
                        <Button variant="primary" size="md" onClick={autoPlaceResources}
                          style={{ width: '100%', marginBottom: 12 }}>
                          📦 Поместить ресурсы
                        </Button>
                      )}
                      {/* Level bonuses */}
                      {BASE_BONUSES[selectedUpg.name] && (
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Бонусы уровней</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {BASE_BONUSES[selectedUpg.name].map((b) => {
                              const unlocked = currentLevel >= b.level;
                              return (
                                <div key={b.level} style={{
                                  display: 'flex', alignItems: 'center', gap: 8,
                                  padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                                  background: unlocked ? 'rgba(34,197,94,0.06)' : 'var(--bg-glass)',
                                  opacity: unlocked ? 1 : 0.4,
                                  fontSize: 11,
                                }}>
                                  <span style={{
                                    width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: unlocked ? 'var(--accent-success)' : 'var(--text-muted)',
                                    color: '#000', fontSize: 10, fontWeight: 700,
                                  }}>{b.level}</span>
                                  <span style={{ color: unlocked ? 'var(--accent-success)' : 'var(--text-muted)' }}>
                                    {unlocked ? '✅' : '🔒'} {b.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </WapPanel>
            </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
