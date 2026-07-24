import { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { WapPanel } from '../components/ui/WapPanel';
import { WapHeader } from '../components/ui/WapHeader';
import { Button } from '../components/ui/Button';
import { ProgressBar } from '../components/ui/ProgressBar';
import { useInventoryStore } from '../stores/inventoryStore';
import { usePlayerStore } from '../stores/playerStore';
import { useUiStore } from '../stores/uiStore';
import { useSound } from '../hooks/useSound';
import { GAME_ITEMS } from '../data/GameItems';
import {
  QUALITY_ORDER, QUALITY_COLORS, SLOT_STAT_POOL, SLOT_LABELS, SLOT_ICONS,
  CRAFT_COST, MATERIAL_NAMES, STAT_COUNT, getNextQuality, rollBlueprint, rollYield,
} from '../data/crafting';
import { ItemTooltip } from '../components/widgets/ItemTooltip';
import { generateItem } from '../engine/items';
import { GAME_ITEMS as GAME_ITEMS_LIST } from '../data/GameItems';
import { getItemImage } from '../assets/index';
import type { Item } from '../types/items';

type Tab = 'merge' | 'disassemble' | 'create';

const STAT_LABELS: Record<string, string> = {
  damage: 'Урон', crit: 'Крит', armor: 'Броня', regen: 'Реген',
  evasion: 'Уклонение', block: 'Блок', punching: 'Пробитие', accuracy: 'Точность',
  vampir: 'Вампиризм', speed: 'Скорость', maxHp: 'МаксHP',
};

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateStatValue(stat: string, level: number): number {
  const mul = 1 + (level - 1) * 0.1;
  if (['crit', 'speed', 'evasion', 'block', 'punching', 'vampir', 'accuracy'].includes(stat)) {
    return parseFloat(((Math.random() * 0.045 + 0.005) * mul).toFixed(4));
  }
  if (stat === 'maxHp' || stat === 'health') {
    return Math.round(randomInt(10, 200) * mul);
  }
  if (stat === 'stamina') {
    return parseFloat(((Math.random() * 0.045 + 0.005) * mul).toFixed(4));
  }
  if (stat === 'regen') {
    return parseFloat(((Math.random() * 0.995 + 0.005) * mul).toFixed(3));
  }
  const baseRanges: Record<string, [number, number]> = {
    damage: [3, 20], armor: [1, 15],
  };
  const [min, max] = baseRanges[stat] || [1, 8];
  return Math.round(randomInt(min, max) * mul);
}

function generateItemForSlot(slot: string, quality: string, level: number, forcedStats?: Record<string, number>): Item {
  const pool = GAME_ITEMS.filter((i) => i.slot === slot && i.type !== 'consumable' && i.type !== 'material');
  const template = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : undefined;
  const stats: Record<string, number> = {};
  if (forcedStats) {
    Object.assign(stats, forcedStats);
  } else {
    const statPool = SLOT_STAT_POOL[slot] || ['damage'];
    const count = STAT_COUNT[quality] || 1;
    const shuffled = [...statPool].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count);
    for (const stat of selected) stats[stat] = generateStatValue(stat, level);
  }
  return {
    id: `crafted_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: template?.name || `Предмет ${slot}`,
    displayName: template?.displayName || template?.name || `Предмет ${slot}`,
    type: slot === 'weapon1' || slot === 'weapon2' ? 'weapon' : 'armor',
    slot,
    rarity: quality,
    level,
    quality,
    qualityColor: QUALITY_COLORS[quality] || '#a0a0a0',
    stats,
    image: template?.image,
  };
}

function countResource(name: string): number {
  const items = useInventoryStore.getState().items;
  const found = items.find((i) => i.name === name && i.type === 'material');
  return found ? found.quantity || 1 : 0;
}

function removeResources(resources: Record<string, number>): boolean {
  const items = useInventoryStore.getState().items;
  for (const [matName, count] of Object.entries(resources)) {
    if (count <= 0) continue;
    const found = items.find((i) => i.name === matName && i.type === 'material');
    if (!found || (found.quantity || 1) < count) return false;
  }
  for (const [matName, count] of Object.entries(resources)) {
    if (count <= 0) continue;
    const found = items.find((i) => i.name === matName && i.type === 'material')!;
    if ((found.quantity || 1) > count) {
      useInventoryStore.setState((s) => ({
        items: s.items.map((i) => i.id === found.id ? { ...i, quantity: (i.quantity || 1) - count } : i),
      }));
    } else {
      useInventoryStore.getState().removeItem(found.id);
    }
  }
  return true;
}

function addMaterials(yields: Record<string, number>) {
  const items = useInventoryStore.getState().items;
  const addItem = useInventoryStore.getState().addItem;
  for (const [mat, count] of Object.entries(yields)) {
    if (count <= 0) continue;
    const matName = MATERIAL_NAMES[mat as keyof typeof MATERIAL_NAMES];
    if (!matName) continue;
    const existing = items.find((i) => i.name === matName && i.type === 'material');
    if (existing) {
      useInventoryStore.setState((s) => ({
        items: s.items.map((i) => i.id === existing.id ? { ...i, quantity: (i.quantity || 1) + count } : i),
      }));
    } else {
      addItem({
        id: `mat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: matName, displayName: matName, type: 'material', slot: 'any',
        rarity: 'common', level: 1, stats: {}, quantity: count, stackable: true,
      });
    }
  }
}

function tryDropBlueprint(itemId: string): string | null {
  const bpQuality = rollBlueprint(itemId);
  if (!bpQuality) return null;
  useInventoryStore.getState().addItem({
    id: `bp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: `Схема: ${bpQuality}`,
    displayName: `📜 Схема (${bpQuality})`,
    type: 'blueprint', blueprintRarity: bpQuality, slot: 'any', rarity: bpQuality,
    level: 1, stats: {}, quality: bpQuality,
    qualityColor: QUALITY_COLORS[bpQuality] || '#a0a0a0', stackable: false,
  });
  return bpQuality;
}

function SlotIcon(item: Item): string {
  if (item.type === 'mod') return '🔩';
  if (item.slot === 'weapon1') return '⚔️';
  if (item.slot === 'weapon2') return '🔫';
  if (item.slot === 'head') return '⛑️';
  if (item.slot === 'armor') return '🛡️';
  if (item.slot === 'gloves') return '🧤';
  if (item.slot === 'boots') return '👢';
  return '📦';
}

function DropSlot({ item, onDrop, onRemove, label }: {
  item: Item | null; onDrop: (id: string) => void; onRemove: () => void; label?: string;
}) {
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
      onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) onDrop(id); }}
      onClick={() => item && onRemove()}
      style={{
        width: 80, height: 80, borderRadius: 6,
        border: `2px dashed ${item ? (item.qualityColor || 'rgba(255,255,255,0.2)') : 'rgba(255,255,255,0.1)'}`,
        background: item ? `${item.qualityColor || '#222'}22` : 'rgba(255,255,255,0.03)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        cursor: item ? 'pointer' : 'default', transition: 'all 100ms',
        fontSize: 10, textAlign: 'center', gap: 2,
      }}
      title={item ? `${item.displayName || item.name} — клик убрать` : label}
    >
      {item ? (
        <>
          <span style={{ fontSize: 18 }}>{SlotIcon(item)}</span>
          <span style={{ color: item.qualityColor || '#aaa', lineHeight: 1.1, maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.displayName || item.name}
          </span>
        </>
      ) : (
        <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.08)' }}>+</span>
      )}
    </div>
  );
}

export const Craft = () => {
  const items = useInventoryStore((s) => s.items);
  const addItem = useInventoryStore((s) => s.addItem);
  const removeItem = useInventoryStore((s) => s.removeItem);
  const addLog = usePlayerStore((s) => s.addLog);
  const level = usePlayerStore((s) => s.level);
  const { playCraft } = useSound();
  const craftingTimer = useUiStore((s) => s.craftingTimer);
  const craftingType = useUiStore((s) => s.craftingType);
  const setCraftingTimer = useUiStore((s) => s.setCraftingTimer);
  const setCraftingType = useUiStore((s) => s.setCraftingType);

  const [tab, setTab] = useState<Tab>('merge');

  // Merge
  const [mergeSlots, setMergeSlots] = useState<(Item | null)[]>(Array(5).fill(null));

  // Disassemble
  const [disassembleSlots, setDisassembleSlots] = useState<(Item | null)[]>(Array(5).fill(null));

  // Merge result
  const [mergeResult, setMergeResult] = useState<Item | null>(null);

  // Create
  const [createSlot, setCreateSlot] = useState<string | null>(null);
  const [createBlueprint, setCreateBlueprint] = useState<Item | null>(null);
  const [createSelectedStats, setCreateSelectedStats] = useState<Record<string, number>>({});
  const [createResult, setCreateResult] = useState<Item | null>(null);

  // Tooltip for result items
  const [tooltipItem, setTooltipItem] = useState<Item | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Single timer effect — reads from store
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (craftingTimer > 0) {
      timerRef.current = setInterval(() => {
        const state = useUiStore.getState();
        if (state.craftingTimer <= 1) {
          clearInterval(timerRef.current!);
          state.setCraftingTimer(0);
          const ctype = state.craftingType;
          state.setCraftingType(null);
          if (ctype === 'merge') handleMergeComplete();
          else if (ctype === 'create') handleCreateComplete();
        } else {
          state.setCraftingTimer(state.craftingTimer - 1);
        }
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [craftingTimer > 0]);

  // Determine lowest quality among merge slots
  const mergeMeta = useMemo(() => {
    const filled = mergeSlots.filter(Boolean) as Item[];
    if (filled.length === 0) return null;
    let lowestQuality = filled[0].quality || 'Обычный';
    const slotCounts: Record<string, number> = {};
    for (const item of filled) {
      const q = item.quality || 'Обычный';
      if (QUALITY_ORDER.indexOf(q) < QUALITY_ORDER.indexOf(lowestQuality)) {
        lowestQuality = q;
      }
      const slot = item.slot || 'any';
      slotCounts[slot] = (slotCounts[slot] || 0) + 1;
    }
    const majoritySlot = Object.entries(slotCounts).sort((a, b) => b[1] - a[1])[0][0];
    return { lowestQuality, count: filled.length, majoritySlot };
  }, [mergeSlots]);

  const canMerge = mergeMeta && mergeMeta.count === 5 && !!getNextQuality(mergeMeta.lowestQuality);

  function handleDropToMerge(itemId: string) {
    const idx = mergeSlots.findIndex((s) => s === null);
    if (idx === -1) return;
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    if (item.type === 'material') { addLog('❌ Ресурсы нельзя', 'warning'); return; }
    if (mergeSlots.some((s) => s?.id === item.id)) return;
    removeItem(item.id);
    setMergeSlots((prev) => { const next = [...prev]; next[idx] = item; return next; });
  }

  function handleRemoveFromMergeSlot(idx: number) {
    const item = mergeSlots[idx];
    if (!item) return;
    addItem(item);
    setMergeSlots((prev) => { const next = [...prev]; next[idx] = null; return next; });
  }

  function startMerge() {
    if (!canMerge || !mergeMeta) return;
    setCraftingType('merge');
    setCraftingTimer(10);
    addLog(`⬆️ Улучшение (${mergeMeta.lowestQuality})... 10 сек`, 'info');
  }

  function handleMergeComplete() {
    if (!mergeMeta) return;
    const nextQuality = getNextQuality(mergeMeta.lowestQuality);
    if (!nextQuality) { addLog('❌ Максимальное качество', 'warning'); return; }
    const generated = generateItem(GAME_ITEMS_LIST, level, null, nextQuality, mergeMeta.majoritySlot);
    setMergeResult({
      id: generated.id,
      name: generated.name,
      displayName: generated.displayName,
      type: generated.type as any || (generated.slot === 'weapon1' || generated.slot === 'weapon2' ? 'weapon' : 'armor'),
      slot: generated.slot,
      rarity: generated.rarity,
      level: generated.level,
      quality: generated.quality,
      qualityColor: generated.qualityColor,
      stats: generated.stats,
      image: generated.image,
      timeLimit: generated.timeLimit,
      damage: generated.damage,
    } as Item);
    addLog(`⬆️ Создан: ${generated.displayName} (${nextQuality})`, 'loot');
    setMergeSlots(Array(5).fill(null));
  }

  function handleDropToDisassemble(itemId: string) {
    const idx = disassembleSlots.findIndex((s) => s === null);
    if (idx === -1) return;
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    if (item.type === 'material') { addLog('❌ Ресурсы нельзя разобрать', 'warning'); return; }
    if (disassembleSlots.some((s) => s?.id === item.id)) return;
    removeItem(item.id);
    setDisassembleSlots((prev) => { const next = [...prev]; next[idx] = item; return next; });
  }

  function handleRemoveFromDisassembleSlot(idx: number) {
    const item = disassembleSlots[idx];
    if (!item) return;
    addItem(item);
    setDisassembleSlots((prev) => { const next = [...prev]; next[idx] = null; return next; });
  }

  function handleDisassembleAll() {
    const filled = disassembleSlots.filter(Boolean) as Item[];
    if (filled.length === 0) return;
    for (const item of filled) {
      if (!item.quality) continue;
      const yields = rollYield(item.quality);
      addMaterials(yields);
      const bp = tryDropBlueprint(item.quality);
      if (bp) addLog(`📜 Схема (${bp}) при разборе ${item.displayName || item.name}`, 'loot');
    }
    addLog(`🔨 Разобрано ${filled.length} предмет(ов)`, 'info');
    setDisassembleSlots(Array(5).fill(null));
  }

  // Create: available stats for the selected slot
  const availableStats = useMemo(() => {
    if (!createSlot) return [];
    return SLOT_STAT_POOL[createSlot] || [];
  }, [createSlot]);

  const maxStats = useMemo(() => {
    if (!createBlueprint) return 0;
    return STAT_COUNT[createBlueprint.blueprintRarity || 'Обычный'] || 1;
  }, [createBlueprint]);

  const selectedStatsCount = useMemo(() => {
    return Object.values(createSelectedStats).reduce((s, c) => s + c, 0);
  }, [createSelectedStats]);

  const costMultiplier = useMemo(() => {
    let m = 0;
    for (const count of Object.values(createSelectedStats)) {
      for (let i = 0; i < count; i++) m += Math.pow(2, i);
    }
    return m || 1;
  }, [createSelectedStats]);

  function incCreateStat(stat: string) {
    const totalSelected = Object.values(createSelectedStats).reduce((s, c) => s + c, 0);
    if (totalSelected >= maxStats) return;
    setCreateSelectedStats((prev) => {
      const next = { ...prev };
      next[stat] = (next[stat] || 0) + 1;
      return next;
    });
  }

  function decCreateStat(stat: string) {
    setCreateSelectedStats((prev) => {
      if (!prev[stat] || prev[stat] <= 0) return prev;
      const next = { ...prev };
      next[stat] -= 1;
      if (next[stat] <= 0) delete next[stat];
      return next;
    });
  }

  const canAffordCreate = useMemo(() => {
    if (!createBlueprint) return false;
    const quality = createBlueprint.blueprintRarity || 'Обычный';
    const base = CRAFT_COST[quality];
    if (!base) return false;
    const mul = costMultiplier;
    for (const [mat, count] of Object.entries(base)) {
      if (count <= 0) continue;
      const needed = Math.ceil(count * mul);
      if (countResource(MATERIAL_NAMES[mat as keyof typeof MATERIAL_NAMES]) < needed) return false;
    }
    return true;
  }, [createBlueprint, items, costMultiplier]);

  function handleCreate() {
    if (!createSlot || !createBlueprint) return;
    const quality = createBlueprint.blueprintRarity || 'Обычный';
    const base = CRAFT_COST[quality];
    if (!base) return;
    const mul = costMultiplier;
    const resourceCheck: Record<string, number> = {};
    for (const [mat, count] of Object.entries(base)) {
      if (count > 0) resourceCheck[MATERIAL_NAMES[mat as keyof typeof MATERIAL_NAMES]] = Math.ceil(count * mul);
    }
    if (!removeResources(resourceCheck)) { addLog('❌ Недостаточно ресурсов', 'warning'); return; }
    removeItem(createBlueprint.id);
    setCraftingType('create');
    setCraftingTimer(5);
    addLog('⚙️ Создание предмета... 5 сек', 'info');
  }

  function handleCreateComplete() {
    if (!createSlot) return;
    const quality = createBlueprint?.blueprintRarity || 'Обычный';
    const forcedStats: Record<string, number> = {};
    for (const [stat, count] of Object.entries(createSelectedStats)) {
      if (count > 0) {
        let total = 0;
        for (let i = 0; i < count; i++) total += generateStatValue(stat, level);
        forcedStats[stat] = Number(total.toFixed(3));
      }
    }
    const newItem = generateItemForSlot(createSlot, quality, level, forcedStats);
    setCreateResult(newItem);
    addLog(`⚙️ Создан: ${newItem.displayName} (${quality})`, 'loot');
    setCreateBlueprint(null);
    setCreateSlot(null);
    setCreateSelectedStats({});
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ padding: '0 0 16px' }}>
        <WapPanel variant="metal" padding="lg" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 8,
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
            }}>🔧</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>CRAFT</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Улучшай, разбирай и создавай снаряжение
              </div>
            </div>
          </div>
        </WapPanel>

        <WapPanel variant="screen" padding="sm" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {([{ id: 'merge', label: '⬆️ Улучшение' }, { id: 'disassemble', label: '🔨 Разбор' }, { id: 'create', label: '⚙️ Создание' }] as const).map((t) => (
              <Button key={t.id} size="sm" variant={tab === t.id ? 'primary' : 'ghost'} onClick={() => setTab(t.id)}>
                {t.label}
              </Button>
            ))}
          </div>
        </WapPanel>

        {/* ============ MERGE ============ */}
        {tab === 'merge' && (
          <WapPanel variant="metal" padding="lg">
            <WapHeader title="⬆️ Улучшение (5 → 1)" glow="amber" />
            {craftingTimer > 0 && craftingType === 'merge' ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 14, color: 'var(--accent-warning)', marginBottom: 8 }}>🔧 Улучшение...</div>
                <ProgressBar value={10 - craftingTimer} max={10} variant="accent" label={`${craftingTimer} сек`} />
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Перетащи 5 любых предметов (кроме ресурсов) в слоты, затем нажми «Улучшить». Итоговое качество = минимальное качество среди вставленных +1.
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, justifyContent: 'center' }}>
                  {mergeSlots.map((item, idx) => (
                    <DropSlot key={idx} item={item} onDrop={handleDropToMerge}
                      onRemove={() => handleRemoveFromMergeSlot(idx)} label={`Слот ${idx + 1}`}
                    />
                  ))}
                </div>
                {mergeMeta && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 8 }}>
                    Мин. качество: {mergeMeta.lowestQuality} · Ур. игрока: {level} ({mergeMeta.count}/5)
                    {canMerge && (
                      <span style={{ marginLeft: 8, color: 'var(--accent-success)' }}>
                        → {getNextQuality(mergeMeta.lowestQuality)}
                      </span>
                    )}
                  </div>
                )}
                <Button variant="primary" size="md" disabled={!canMerge} onClick={startMerge} style={{ width: '100%' }}>
                  ⬆️ Улучшить
                </Button>
              </>
            )}
            {mergeResult && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Результат улучшения:
                </div>
                <div
                  onMouseEnter={(e) => { setTooltipItem(mergeResult); setTooltipPos({ x: e.clientX, y: e.clientY }); }}
                  onMouseMove={(e) => { if (tooltipItem) setTooltipPos({ x: e.clientX, y: e.clientY }); }}
                  onMouseLeave={() => setTooltipItem(null)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 10, padding: '8px 14px',
                    border: `1px solid ${mergeResult.qualityColor || 'rgba(255,255,255,0.2)'}`,
                    borderRadius: 6, background: 'rgba(0,0,0,0.25)', fontSize: 13,
                  }}
                >
                  <span style={{ fontSize: 20 }}>{SlotIcon(mergeResult)}</span>
                  <span style={{ color: mergeResult.qualityColor || 'var(--text-primary)', fontWeight: 500 }}>
                    {mergeResult.displayName || mergeResult.name}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Lv.{mergeResult.level}</span>
                  <Button size="sm" variant="primary" onClick={() => { addItem(mergeResult); setMergeResult(null); setTooltipItem(null); }}>
                    Забрать
                  </Button>
                </div>
              </div>
            )}
          </WapPanel>
        )}

        {/* ============ DISASSEMBLE ============ */}
        {tab === 'disassemble' && (
          <WapPanel variant="metal" padding="lg">
            <WapHeader title="🔨 Разбор на ресурсы" glow="amber" />
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Перетащи до 5 любых предметов (кроме ресурсов) в слоты и нажми «Разобрать все».
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, justifyContent: 'center' }}>
              {disassembleSlots.map((item, idx) => (
                <DropSlot key={idx} item={item} onDrop={handleDropToDisassemble}
                  onRemove={() => handleRemoveFromDisassembleSlot(idx)} label={`Слот ${idx + 1}`}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, justifyContent: 'center' }}>
              {disassembleSlots.filter(Boolean).map((item, idx) => {
                if (!item?.quality) return null;
                const preview = rollYield(item.quality);
                return (
                  <div key={idx} style={{ fontSize: 10, padding: '3px 6px', background: 'rgba(74,222,128,0.06)', borderRadius: 4, border: '1px solid rgba(74,222,128,0.1)' }}>
                    {Object.entries(preview).map(([mat, c]) => (
                      <span key={mat} style={{ marginRight: 4 }}>{MATERIAL_NAMES[mat as keyof typeof MATERIAL_NAMES]}×{c}</span>
                    ))}
                    <span style={{ color: '#a78bfa' }}>📜</span>
                  </div>
                );
              })}
            </div>
            <Button variant="danger" size="md"
              disabled={disassembleSlots.every((s) => s === null)}
              onClick={handleDisassembleAll} style={{ width: '100%' }}
            >
              🔨 Разобрать все ({disassembleSlots.filter(Boolean).length})
            </Button>
          </WapPanel>
        )}

        {/* ============ CREATE ============ */}
        {tab === 'create' && (
          <WapPanel variant="metal" padding="lg">
            <WapHeader title="⚙️ Создание предмета" glow="amber" />
            {craftingTimer > 0 && craftingType === 'create' ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 14, color: 'var(--accent-warning)', marginBottom: 8 }}>⚙️ Создание...</div>
                <ProgressBar value={5 - craftingTimer} max={5} variant="accent" label={`${craftingTimer} сек`} />
              </div>
            ) : (
              <>
                {/* Step 1: Choose slot */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Шаг 1: Выбери тип предмета
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {Object.entries(SLOT_LABELS).map(([slot, label]) => (
                      <Button key={slot} size="sm"
                        variant={createSlot === slot ? 'primary' : 'ghost'}
                        onClick={() => { setCreateSlot(slot); setCreateSelectedStats({}); }}
                        style={{ fontSize: 11 }}
                      >
                        {SLOT_ICONS[slot]} {label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Step 2: Choose blueprint */}
                {createSlot && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                      Шаг 2: Вставь схему (определяет качество)
                    </div>
                    {(() => {
                      const blueprints = items.filter((i) => i.type === 'blueprint');
                      if (blueprints.length === 0) {
                        return <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>Нет схем. Разбирай предметы.</div>;
                      }
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {blueprints.map((bp) => (
                            <div key={bp.id} onClick={() => { setCreateBlueprint(bp); setCreateSelectedStats({}); }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', cursor: 'pointer',
                                background: createBlueprint?.id === bp.id ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.02)',
                                border: `1px solid ${createBlueprint?.id === bp.id ? 'var(--border-accent)' : 'rgba(255,255,255,0.06)'}`,
                                borderRadius: 4, fontSize: 12,
                              }}
                            >
                              <span>📜</span>
                              <span style={{ color: bp.qualityColor || 'var(--text-primary)', fontWeight: 500 }}>
                                {bp.displayName || bp.name}
                              </span>
                              {createBlueprint?.id === bp.id && <span style={{ marginLeft: 'auto', color: 'var(--accent-primary)' }}>✓</span>}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Step 3: Choose stats */}
                {createSlot && createBlueprint && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                      Шаг 3: Выбери статы ({selectedStatsCount}/{maxStats})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {availableStats.map((stat) => {
                        const statCount = createSelectedStats[stat] || 0;
                        const canSelect = selectedStatsCount < maxStats;
                        return (
                          <div key={stat}
                            onClick={() => canSelect && incCreateStat(stat)}
                            onContextMenu={(e) => { e.preventDefault(); decCreateStat(stat); }}
                            style={{
                              padding: '5px 10px', borderRadius: 4,
                              cursor: canSelect || statCount > 0 ? 'pointer' : 'not-allowed',
                              background: statCount > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.03)',
                              border: `1px solid ${statCount > 0 ? 'var(--accent-success)' : 'rgba(255,255,255,0.06)'}`,
                              color: statCount > 0 ? 'var(--accent-success)' : 'var(--text-muted)',
                              opacity: canSelect || statCount > 0 ? 1 : 0.35,
                              fontSize: 12, userSelect: 'none',
                            }}
                          >
                            {STAT_LABELS[stat] || stat}
                            {statCount > 0 ? ` ×${statCount}` : ' +'}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Step 4: Resources + Craft */}
                {createSlot && createBlueprint && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                      Шаг 4: Ресурсы
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      {(() => {
                        const quality = createBlueprint.blueprintRarity || 'Обычный';
                        const base = CRAFT_COST[quality];
                        const mul = costMultiplier;
                        return Object.entries(base).map(([mat, count]) => {
                          if (count <= 0) return null;
                          const matName = MATERIAL_NAMES[mat as keyof typeof MATERIAL_NAMES];
                          const needed = Math.ceil(count * mul);
                          const have = countResource(matName);
                          return (
                            <span key={mat} style={{
                              fontSize: 11, padding: '2px 6px', borderRadius: 4,
                              background: have >= needed ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)',
                              color: have >= needed ? 'var(--accent-success)' : 'var(--accent-danger)',
                            }}>
                              {matName} {have}/{needed}
                              {mul > 1 && <span style={{ opacity: 0.5, marginLeft: 2 }}>(×{mul})</span>}
                            </span>
                          );
                        });
                      })()}
                    </div>
                    {costMultiplier > 1 && (
                      <div style={{ fontSize: 10, color: 'var(--accent-warning)', textAlign: 'center', marginBottom: 8 }}>
                        Множитель ресурсов: ×{costMultiplier} (повторы статов)
                      </div>
                    )}
                    <Button variant="primary" size="md"
                      disabled={!canAffordCreate || selectedStatsCount === 0}
                      onClick={handleCreate}
                      style={{ width: '100%', background: canAffordCreate && selectedStatsCount > 0 ? 'var(--accent-success)' : undefined }}
                    >
                      ⚙️ Создать
                    </Button>
                  </div>
                )}
              </>
            )}
            {createResult && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Результат создания:
                </div>
                <div
                  onMouseEnter={(e) => { setTooltipItem(createResult); setTooltipPos({ x: e.clientX, y: e.clientY }); }}
                  onMouseMove={(e) => { if (tooltipItem) setTooltipPos({ x: e.clientX, y: e.clientY }); }}
                  onMouseLeave={() => setTooltipItem(null)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 10, padding: '8px 14px',
                    border: `1px solid ${createResult.qualityColor || 'rgba(255,255,255,0.2)'}`,
                    borderRadius: 6, background: 'rgba(0,0,0,0.25)', fontSize: 13,
                  }}
                >
                  <span style={{ fontSize: 20 }}>{SlotIcon(createResult)}</span>
                  <span style={{ color: createResult.qualityColor || 'var(--text-primary)', fontWeight: 500 }}>
                    {createResult.displayName || createResult.name}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Lv.{createResult.level}</span>
                  <Button size="sm" variant="primary" onClick={() => { addItem(createResult); setCreateResult(null); setTooltipItem(null); }}>
                    Забрать
                  </Button>
                </div>
              </div>
            )}
          </WapPanel>
        )}
      </div>
      {tooltipItem && <ItemTooltip item={tooltipItem} x={tooltipPos.x} y={tooltipPos.y} />}
    </motion.div>
  );
};
