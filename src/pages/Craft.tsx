import { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { WapPanel } from '../components/ui/WapPanel';
import { WapHeader } from '../components/ui/WapHeader';
import { Button } from '../components/ui/Button';
import { ProgressBar } from '../components/ui/ProgressBar';
import { useInventoryStore } from '../stores/inventoryStore';
import { usePlayerStore } from '../stores/playerStore';
import { useUiStore } from '../stores/uiStore';
import { useAuthStore } from '../stores/authStore';
import { useSound } from '../hooks/useSound';
import {
  QUALITY_ORDER, QUALITY_COLORS,
  MATERIAL_NAMES, AMMO_CRAFT_COST,
  craftCostFor, disassembleCategoryOf,
  getNextQuality, rollBlueprint, rollYield,
} from '../data/crafting';
import { AMMO_GROUPS, makeBulletPack, maxStackFor, type AmmoGroup } from '../data/ammo';
import { SCHEME_STATS, SCHEME_STAT_LABELS, SCHEME_FLAT_STATS, schemePctFor, schemeFlatFor, isSocketable, socketSlotsOf, statsForLevel, levelStatMult } from '../data/schematics';
import { getSchemeImage } from '../assets/index';
import { ItemTooltip } from '../components/widgets/ItemTooltip';
import { generateItem } from '../engine/items';
import { GAME_ITEMS as GAME_ITEMS_LIST } from '../data/GameItems';
import { getItemImage, getBulletImage } from '../assets/index';
import type { Item } from '../types/items';

type Tab = 'merge' | 'disassemble' | 'create';

function countResource(name: string): number {
  // Суммируем все стаки (без качества и Обычные — один ресурс).
  return useInventoryStore.getState().items
    .filter((i) => i.name === name && i.type === 'material')
    .reduce((s, i) => s + (i.quantity || 1), 0);
}

function removeResources(resources: Record<string, number>): boolean {
  const items = useInventoryStore.getState().items;
  for (const [matName, count] of Object.entries(resources)) {
    if (count <= 0) continue;
    if (countResource(matName) < count) return false;
  }
  // Списываем по нескольким стакам подряд.
  for (const [matName, count] of Object.entries(resources)) {
    if (count <= 0) continue;
    let remaining = count;
    const stacks = useInventoryStore.getState().items.filter((i) => i.name === matName && i.type === 'material');
    for (const st of stacks) {
      if (remaining <= 0) break;
      const q = st.quantity || 1;
      if (q > remaining) {
        useInventoryStore.setState((s) => ({
          items: s.items.map((i) => i.id === st.id ? { ...i, quantity: q - remaining } : i),
        }));
        remaining = 0;
      } else {
        useInventoryStore.getState().removeItem(st.id);
        remaining -= q;
      }
    }
  }
  return true;
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

function DropSlot({ item, onDrop, onRemove, label, onTipShow, onTipMove, onTipHide }: {
  item: Item | null; onDrop: (id: string) => void; onRemove: () => void; label?: string;
  onTipShow?: (item: Item, e: React.MouseEvent) => void; onTipMove?: (e: React.MouseEvent) => void; onTipHide?: () => void;
}) {
  const url = item ? (item.image || getItemImage(item.name, item.displayName, item.slot, item.type)) : undefined;
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
      onDrop={(e) => {
        e.preventDefault();
        // Фолбэк: dataTransfer иногда пуст — берём id из стора.
        const id = e.dataTransfer.getData('text/plain') || useUiStore.getState().draggedItemId;
        if (id) onDrop(id);
      }}
      onClick={() => item && onRemove()}
      onMouseEnter={(e) => { if (item && onTipShow) onTipShow(item, e); }}
      onMouseMove={(e) => { if (item && onTipMove) onTipMove(e); }}
      onMouseLeave={() => { if (onTipHide) onTipHide(); }}
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
          {url ? (
            <img src={url} alt="" style={{ width: 44, height: 44, objectFit: 'contain' }} draggable={false} />
          ) : (
            <span style={{ fontSize: 18 }}>{SlotIcon(item)}</span>
          )}
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
  const { playSound } = useSound();
  const craftingTimer = useUiStore((s) => s.craftingTimer);
  const craftingType = useUiStore((s) => s.craftingType);
  const setCraftingTimer = useUiStore((s) => s.setCraftingTimer);
  const setCraftingType = useUiStore((s) => s.setCraftingType);

  const [tab, setTab] = useState<Tab>('merge');
  const token = useAuthStore((s) => s.token);
  const base = import.meta.env.VITE_API_URL || 'http://rpg.local/api';

  // Merge
  const [mergeSlots, setMergeSlots] = useState<(Item | null)[]>(Array(5).fill(null));
  const mergeItemIdsRef = useRef<string[]>([]);

  // Disassemble
  const [disassembleSlots, setDisassembleSlots] = useState<(Item | null)[]>(Array(5).fill(null));

  // Merge result
  const [mergeResult, setMergeResult] = useState<Item | null>(null);

  // Reforge (перековка): оружие/броня + сфера.
  // UI едет на локальном стейте, в стор зеркалим для серверной персистентности.
  const [reforgeWeapon, setReforgeWeaponLocal] = useState<Item | null>(() => usePlayerStore.getState().reforgeWeapon);
  const [reforgeBlueprint, setReforgeBlueprintLocal] = useState<Item | null>(() => usePlayerStore.getState().reforgeBlueprint);
  const setReforgeWeapon = (w: Item | null) => { setReforgeWeaponLocal(w); usePlayerStore.getState().setReforgeWeapon(w); };
  const setReforgeBlueprint = (b: Item | null) => { setReforgeBlueprintLocal(b); usePlayerStore.getState().setReforgeBlueprint(b); };

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
    playSound('install', 0.4);
  }

  function handleRemoveFromMergeSlot(idx: number) {
    const item = mergeSlots[idx];
    if (!item) return;
    addItem(item);
    setMergeSlots((prev) => { const next = [...prev]; next[idx] = null; return next; });
    playSound('clickbutton', 0.3);
  }

  function startMerge() {
    if (!canMerge || !mergeMeta) return;
    mergeItemIdsRef.current = mergeSlots.filter(Boolean).map((i) => i!.id);
    setCraftingType('merge');
    setCraftingTimer(10);
    playSound('craft', 0.5);
    addLog(`⬆️ Улучшение (${mergeMeta.lowestQuality})... 10 сек`, 'info');
  }

  async function handleMergeComplete() {
    if (!mergeMeta) return;
    const nextQuality = getNextQuality(mergeMeta.lowestQuality);
    if (!nextQuality) { addLog('❌ Максимальное качество', 'warning'); return; }
    const generated = generateItem(GAME_ITEMS_LIST, level, null, nextQuality, mergeMeta.majoritySlot);
    const resultItem: Item = {
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
    } as Item;
    setMergeResult(resultItem);
    playSound('craft2', 0.5);
    addLog(`⬆️ Создан: ${generated.displayName} (${nextQuality})`, 'loot');
    setMergeSlots(Array(5).fill(null));
    // Сервер — писатель: ждём ok, иначе результат не выдаём (иначе призрак
    // только локально). Расходники при отказе остались в БД — вернёт синк.
    try {
      const res = await fetch(`${base}/craft/merge.php`, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${token}` }, body:JSON.stringify({ consumeIds: mergeItemIdsRef.current, result: resultItem }) });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        addLog(`❌ Сервер отклонил улучшение: ${err?.error || res.status}`, 'warning');
        setMergeResult(null);
      }
    } catch {
      addLog('❌ Ошибка сети — результат не сохранён', 'warning');
      setMergeResult(null);
    }
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
    playSound('install', 0.4);
  }

  function handleRemoveFromDisassembleSlot(idx: number) {
    const item = disassembleSlots[idx];
    if (!item) return;
    addItem(item);
    setDisassembleSlots((prev) => { const next = [...prev]; next[idx] = null; return next; });
    playSound('clickbutton', 0.3);
  }

  async function handleDisassembleAll() {
    const filled = disassembleSlots.filter(Boolean) as Item[];
    if (filled.length === 0) return;
    const consumeIds = filled.map((i) => i.id);
    // Один ролл на всё: те же объекты уходят на сервер и кладутся локально.
    // Раньше роллилось дважды (серверу одно, себе другое) — дубли и рассинхрон.
    const yields: Record<string, number> = {};
    for (const item of filled) {
      if (!item.quality) continue;
      const y = rollYield(item.quality, item);
      for (const [mat, c] of Object.entries(y)) yields[mat] = (yields[mat] || 0) + (c || 0);
    }
    const materials: Item[] = [];
    for (const [mat, count] of Object.entries(yields)) {
      if (count <= 0) continue;
      const matName = MATERIAL_NAMES[mat as keyof typeof MATERIAL_NAMES];
      if (!matName) continue;
      // Ресурсы всегда строго Обычные — иначе плодятся дубли «с качеством/без».
      materials.push({
        id: `mat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: matName, displayName: matName, type: 'material', slot: 'any',
        rarity: 'common', level: 1, stats: {}, quantity: count, stackable: true,
        quality: 'Обычный', qualityColor: '#a0a0a0',
      } as Item);
    }
    let blueprint: Item | null = null;
    for (const item of filled) {
      if (!item.quality || blueprint) continue;
      // Из патронов сфер не бывает.
      if (disassembleCategoryOf(item) === 'bullet' || disassembleCategoryOf(item) === 'energyCell') continue;
      const bp = rollBlueprint(item.quality);
      if (bp) {
        // Сфера на один случайный стат (уровня у сфер нет).
        // Стихийные — плоская прибавка (+10, +5 за ранг), остальные — %.
        const stat = SCHEME_STATS[Math.floor(Math.random() * SCHEME_STATS.length)];
        const isFlat = SCHEME_FLAT_STATS.has(stat);
        const pct = isFlat ? schemeFlatFor(stat, bp) : schemePctFor(stat, bp);
        const label = SCHEME_STAT_LABELS[stat] || stat;
        blueprint = {
          id: `bp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: `Аномальная сфера: ${label}`, displayName: `🔮 Сфера (${bp}): ${label} +${pct}${isFlat ? '' : '%'}`,
          type: 'blueprint', blueprintRarity: bp, blueprintStat: stat, slot: 'any', rarity: bp,
          level: 1, stats: {}, quality: bp,
          qualityColor: QUALITY_COLORS[bp] || '#a0a0a0', stackable: false,
          image: getSchemeImage(stat),
        } as Item;
      }
    }
    try {
      const res = await fetch(`${base}/craft/disassemble.php`, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${token}` }, body:JSON.stringify({
        consumeIds,
        materials: materials.map((m) => ({ id: m.id, name: m.name, quantity: m.quantity, quality: m.quality || 'Обычный' })),
        blueprint: blueprint ? { id: blueprint.id, name: blueprint.name, displayName: blueprint.displayName, slot: blueprint.slot, quality: blueprint.quality, qualityColor: blueprint.qualityColor, level: blueprint.level, blueprintRarity: (blueprint as any).blueprintRarity, blueprintStat: (blueprint as any).blueprintStat, image: blueprint.image } : null,
      }) });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        addLog(`❌ Сервер отклонил разбор: ${err?.error || res.status}`, 'warning');
        return;
      }
    } catch {
      addLog('❌ Ошибка сети — разбор не сохранён', 'warning');
      return;
    }
    // Сервер ok: кладём ровно те же объекты (merge в существующие Обычные стаки).
    const curItems = useInventoryStore.getState().items;
    for (const m of materials) {
      const existing = curItems.find((i) => i.name === m.name && i.type === 'material' && (i.quality || 'Обычный') === 'Обычный');
      if (existing) {
        useInventoryStore.setState((s) => ({
          items: s.items.map((i) => i.id === existing.id ? { ...i, quantity: (i.quantity || 1) + (m.quantity || 1), quality: 'Обычный', qualityColor: '#a0a0a0' } : i),
        }));
      } else {
        addItem(m);
      }
    }
    playSound('craft3', 0.5);
    if (blueprint) {
      addItem(blueprint);
      addLog(`💎 Выпала: ${blueprint.displayName}`, 'loot');
    }
    addLog(`🔨 Разобрано ${filled.length} предмет(ов)`, 'info');
    setDisassembleSlots(Array(5).fill(null));
  }

  // ============ ПЕРЕКОВКА ============
  function handleDropToReforge(itemId: string) {
    if (reforgeWeapon) return;
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    if (!isSocketable(item)) { addLog('❌ Перековывать можно только оружие и броню', 'warning'); return; }
    if ((item as any).unique) { addLog('❌ Уники нельзя перековывать', 'warning'); return; }
    removeItem(item.id);
    // Старым предметам фиксируем гнёзда и базу сразу, чтобы не плавали.
    const fixed: Item = {
      ...item,
      socketSlots: socketSlotsOf(item),
      sockets: Array.isArray((item as any).sockets) ? (item as any).sockets : [],
    };
    setReforgeWeapon(fixed);
    playSound('install', 0.4);
  }

  function handleRemoveReforgeWeapon() {
    if (!reforgeWeapon) return;
    addItem(reforgeWeapon);
    setReforgeWeapon(null);
    playSound('clickbutton', 0.3);
  }

  function handleDropReforgeBp(itemId: string) {
    if (reforgeBlueprint) return;
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    if (item.type !== 'blueprint') { addLog('❌ Сюда только сферы', 'warning'); return; }
    removeItem(item.id);
    setReforgeBlueprint(item);
    playSound('install', 0.4);
  }

  function handleRemoveReforgeBp() {
    if (!reforgeBlueprint) return;
    addItem(reforgeBlueprint);
    setReforgeBlueprint(null);
    playSound('clickbutton', 0.3);
  }

  /** База статов 1 ур.: сохранённая или обратным пересчётом из текущих. */
  function baseStatsOf(w: Item): Record<string, number> {
    if ((w as any).baseStats) return { ...((w as any).baseStats as Record<string, number>) };
    const mult = levelStatMult(w.level || 1);
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(w.stats || {})) {
      if (typeof v !== 'number' || v < 0) continue;
      out[k] = v / mult;
    }
    return out;
  }

  function bumpDisplayName(w: Item, lvl: number): string {
    const dn = w.displayName || w.name;
    if (/\d+\s*ур\.?/.test(dn)) return dn.replace(/\d+\s*ур\.?/, `${lvl} ур.`);
    return `${dn} ${lvl} ур.`;
  }

  /** Подъём уровня на +1 за ресурсы (потолок — уровень игрока). */
  async function handleLevelUp() {
    const w = reforgeWeapon;
    if (!w) return;
    const curLvl = w.level || 1;
    if (curLvl >= level) { addLog(`❌ Максимум: уровень игрока (${level})`, 'warning'); return; }
    const cost = craftCostFor((w.slot as string) || 'armor', w.quality || 'Обычный');
    const need: Record<string, number> = {};
    for (const [mat, count] of Object.entries(cost)) {
      if (count > 0) need[MATERIAL_NAMES[mat as keyof typeof MATERIAL_NAMES]] = count;
    }
    for (const [matName, count] of Object.entries(need)) {
      if (countResource(matName) < count) { addLog('❌ Не хватает ресурсов на перековку', 'warning'); playSound('clickbutton', 0.3); return; }
    }
    const base1 = baseStatsOf(w);
    const newLvl = curLvl + 1;
    const updated: Item = {
      ...w,
      level: newLvl,
      stats: statsForLevel(base1, newLvl),
      baseStats: base1,
      socketSlots: socketSlotsOf(w),
      sockets: Array.isArray((w as any).sockets) ? (w as any).sockets : [],
      displayName: bumpDisplayName(w, newLvl),
    };
    try {
      const res = await fetch(`${base}/craft/reforge.php`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ op: 'levelup', weaponId: w.id, weapon: updated, needs: need }) });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        addLog(`❌ Сервер отклонил перековку: ${err?.error || res.status}`, 'warning');
        return;
      }
    } catch {
      addLog('❌ Ошибка сети — уровень не поднят', 'warning');
      return;
    }
    removeResources(need);
    setReforgeWeapon(updated);
    playSound('craft2', 0.5);
    addLog(`⚒️ ${updated.displayName} → ${newLvl} ур.`, 'loot');
  }

  /** Вставить сферу из малого слота (слоты кончились — сначала удали старую). */
  async function handleSocketScheme() {
    const w = reforgeWeapon;
    const bp = reforgeBlueprint;
    if (!w || !bp) return;
    const max = socketSlotsOf(w);
    const cur = Array.isArray((w as any).sockets) ? [...(w as any).sockets] : [];
    if (cur.length >= max) { addLog('❌ Гнёзда заняты — удали старую сферу', 'warning'); return; }
    const stat = (bp as any).blueprintStat || 'damage';
    if (!isSocketable(w)) { addLog('❌ Сферы только на оружие/броню', 'warning'); return; }
    const isFlat = SCHEME_FLAT_STATS.has(stat);
    const pct = isFlat ? schemeFlatFor(stat, (bp as any).blueprintRarity || bp.quality) : schemePctFor(stat, (bp as any).blueprintRarity || bp.quality);
    const updated: Item = {
      ...w,
      socketSlots: max,
      sockets: [...cur, { stat, pct }],
    };
    try {
      const res = await fetch(`${base}/craft/reforge.php`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ op: 'socket', weaponId: w.id, weapon: updated, blueprintId: bp.id }) });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        addLog(`❌ Сервер отклонил сферу: ${err?.error || res.status}`, 'warning');
        return;
      }
    } catch {
      addLog('❌ Ошибка сети — сфера не вставлена', 'warning');
      return;
    }
    removeItem(bp.id);
    setReforgeBlueprint(null);
    setReforgeWeapon(updated);
    playSound('craft4', 0.5);
    addLog(`💎 Сфера: ${SCHEME_STAT_LABELS[stat] || stat} +${pct}${isFlat ? '' : '%'} → ${w.displayName || w.name}`, 'loot');
  }

  /** Удалить вставленную сферу (бесплатно). */
  async function handleRemoveScheme(idx: number) {
    const w = reforgeWeapon;
    if (!w) return;
    const cur = Array.isArray((w as any).sockets) ? [...(w as any).sockets] : [];
    if (idx < 0 || idx >= cur.length) return;
    const updated: Item = { ...w, sockets: cur.filter((_, i) => i !== idx) };
    try {
      const res = await fetch(`${base}/craft/reforge.php`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ op: 'socket', weaponId: w.id, weapon: updated, blueprintId: null }) });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        addLog(`❌ Сервер отклонил: ${err?.error || res.status}`, 'warning');
        return;
      }
    } catch {
      addLog('❌ Ошибка сети', 'warning');
      return;
    }
    setReforgeWeapon(updated);
    playSound('clickbutton', 0.3);
    addLog('💎 Сфера извлечена', 'info');
  }

  // Создание патронов: мгновенно, полный стак обычных (энергоячейки — без пороха).
  function handleCraftAmmo(group: AmmoGroup) {
    const cost = AMMO_CRAFT_COST[group];
    if (!cost) return;
    const need: Record<string, number> = {};
    if (cost.powder > 0) need[MATERIAL_NAMES.powder] = cost.powder;
    if (cost.scrap > 0) need[MATERIAL_NAMES.scrap] = cost.scrap;
    if ((cost.reagent || 0) > 0) need[MATERIAL_NAMES.reagent] = cost.reagent || 0;
    if (!removeResources(need)) { addLog('❌ Не хватает ресурсов на патроны', 'warning'); playSound('clickbutton', 0.3); return; }
    const pack = makeBulletPack(group, maxStackFor(group), 'Обычный');
    addItem(pack);
    playSound('reloading', 0.5);
    addLog(`🔸 Снаряжено: ${pack.displayName}`, 'loot');
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
            {([{ id: 'merge', label: '⬆️ Улучшение' }, { id: 'disassemble', label: '🔨 Разбор' }, { id: 'create', label: '⚒️ Перековка' }] as const).map((t) => (
              <Button key={t.id} size="sm" variant={tab === t.id ? 'primary' : 'ghost'} onClick={() => { playSound('clickbutton', 0.3); setTab(t.id); }}>
                {t.label}
              </Button>
            ))}
          </div>
        </WapPanel>

        {/* ============ MERGE ============ */}
        {tab === 'merge' && (
          <WapPanel variant="metal" padding="lg" style={{ maxWidth: 660 }}>
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
                      onTipShow={(it, e) => { setTooltipItem(it); setTooltipPos({ x: e.clientX, y: e.clientY }); }}
                      onTipMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                      onTipHide={() => setTooltipItem(null)}
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
                  <Button size="sm" variant="primary" onClick={() => { playSound('paySell', 0.5); addItem(mergeResult); setMergeResult(null); setTooltipItem(null); }}>
                    Забрать
                  </Button>
                </div>
              </div>
            )}
          </WapPanel>
        )}

        {/* ============ DISASSEMBLE ============ */}
        {tab === 'disassemble' && (
          <WapPanel variant="metal" padding="lg" style={{ maxWidth: 660 }}>
            <WapHeader title="🔨 Разбор на ресурсы" glow="amber" />
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Перетащи до 5 любых предметов (кроме ресурсов) в слоты и нажми «Разобрать все».
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, justifyContent: 'center' }}>
              {disassembleSlots.map((item, idx) => (
                <DropSlot key={idx} item={item} onDrop={handleDropToDisassemble}
                  onRemove={() => handleRemoveFromDisassembleSlot(idx)} label={`Слот ${idx + 1}`}
                  onTipShow={(it, e) => { setTooltipItem(it); setTooltipPos({ x: e.clientX, y: e.clientY }); }}
                  onTipMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                  onTipHide={() => setTooltipItem(null)}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, justifyContent: 'center' }}>
              {disassembleSlots.filter(Boolean).map((item, idx) => {
                if (!item?.quality) return null;
                const preview = rollYield(item.quality, item);
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

        {/* ============ REFORGE ============ */}
        {tab === 'create' && (
          <WapPanel variant="metal" padding="lg" style={{ maxWidth: 660 }}>
            <WapHeader title="⚒️ Перековка" glow="amber" />
            <>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                Перетащи оружие/броню в большой слот и сферу в малый. Поднимай уровень до своего ({level}) и вставляй сферы в гнёзда. Уники не перековываются.
              </div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center', justifyContent: 'center' }}>
                {/* Большой слот: оружие/броня */}
                <div
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                  onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain') || useUiStore.getState().draggedItemId; if (id) handleDropToReforge(id); }}
                  onClick={() => reforgeWeapon && handleRemoveReforgeWeapon()}
                  onMouseEnter={(e) => { if (reforgeWeapon) { setTooltipItem(reforgeWeapon); setTooltipPos({ x: e.clientX, y: e.clientY }); } }}
                  onMouseMove={(e) => { if (reforgeWeapon) setTooltipPos({ x: e.clientX, y: e.clientY }); }}
                  onMouseLeave={() => setTooltipItem(null)}
                  title={reforgeWeapon ? `${reforgeWeapon.displayName || reforgeWeapon.name} — клик вернуть в инвентарь` : 'Оружие или броня из инвентаря'}
                  style={{
                    width: 110, height: 110, borderRadius: 8,
                    border: `2px dashed ${reforgeWeapon ? (reforgeWeapon.qualityColor || 'rgba(255,255,255,0.2)') : 'rgba(255,255,255,0.1)'}`,
                    background: reforgeWeapon ? `${reforgeWeapon.qualityColor || '#222'}22` : 'rgba(255,255,255,0.03)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    cursor: reforgeWeapon ? 'pointer' : 'default', gap: 4, padding: 4,
                  }}
                >
                  {reforgeWeapon ? (
                    <>
                      {(() => { const url = reforgeWeapon.image || getItemImage(reforgeWeapon.name, reforgeWeapon.displayName, reforgeWeapon.slot, reforgeWeapon.type); return url ? <img src={url} alt="" style={{ width: 56, height: 56, objectFit: 'contain' }} draggable={false} /> : <span style={{ fontSize: 30 }}>{SlotIcon(reforgeWeapon)}</span>; })()}
                      <span style={{ color: reforgeWeapon.qualityColor || '#aaa', lineHeight: 1.1, fontSize: 10, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {reforgeWeapon.displayName || reforgeWeapon.name}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Lv.{reforgeWeapon.level || 1}</span>
                    </>
                  ) : (
                    <span style={{ fontSize: 30, color: 'rgba(255,255,255,0.08)' }}>🗡️</span>
                  )}
                </div>
                <span style={{ fontSize: 20, color: 'var(--text-muted)' }}>+</span>
                {/* Малый слот: сфера */}
                <DropSlot item={reforgeBlueprint} onDrop={handleDropReforgeBp}
                  onRemove={handleRemoveReforgeBp} label="Сфера"
                  onTipShow={(it, e) => { setTooltipItem(it); setTooltipPos({ x: e.clientX, y: e.clientY }); }}
                  onTipMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                  onTipHide={() => setTooltipItem(null)}
                />
              </div>
              {/* Слоты перековки ниже */}

              {/* Подъём уровня и сферы ниже */}

              {/* Подъём уровня и сферы ниже */}
                {(() => {
                  const w = reforgeWeapon;
                  const maxSockets = w ? socketSlotsOf(w) : 0;
                  const installed = w && Array.isArray((w as any).sockets) ? (w as any).sockets : [];
                  const wLvl = w ? (w.level || 1) : 1;
                  const canLevel = w && wLvl < level;
                  const lvlCost = w ? craftCostFor((w.slot as string) || 'armor', w.quality || 'Обычный') : null;
                  const bp = reforgeBlueprint;
                  const bpStat = bp ? ((bp as any).blueprintStat || 'damage') : '';
                  const bpPct = bp ? (SCHEME_FLAT_STATS.has(bpStat) ? schemeFlatFor(bpStat, ((bp as any).blueprintRarity || bp.quality)) : schemePctFor(bpStat, ((bp as any).blueprintRarity || bp.quality))) : 0;
                  return (
                    <>
                      {/* Подъём уровня */}
                      {w && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                            Подъём уровня ({wLvl} → {wLvl + 1}, твой {level})
                          </div>
                          {lvlCost && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                              {Object.entries(lvlCost).map(([mat, count]) => {
                                if (count <= 0) return null;
                                const matName = MATERIAL_NAMES[mat as keyof typeof MATERIAL_NAMES];
                                const have = countResource(matName);
                                return (
                                  <span key={mat} style={{
                                    fontSize: 11, padding: '2px 6px', borderRadius: 4,
                                    background: have >= count ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)',
                                    color: have >= count ? 'var(--accent-success)' : 'var(--accent-danger)',
                                  }}>
                                    {matName} {have}/{count}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          <Button variant="primary" size="md" disabled={!canLevel} onClick={handleLevelUp} style={{ width: '100%' }}>
                            {canLevel ? `⚒️ Поднять до ${wLvl + 1} ур.` : `✅ Максимум (${wLvl} ур.)`}
                          </Button>
                        </div>
                      )}
                      {/* Сферы */}
                      {w && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                            Сферы ({installed.length}/{maxSockets})
                          </div>
                          {installed.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                              {installed.map((s: any, i: number) => (
                                <div key={i} style={{
                                  display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
                                  background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.25)',
                                  borderRadius: 4, fontSize: 12,
                                }}>
                                  <span style={{ color: '#4ade80', fontWeight: 600 }}>💎 {SCHEME_STAT_LABELS[s.stat] || s.stat} +{s.pct}{SCHEME_FLAT_STATS.has(s.stat) ? '' : '%'}</span>
                                  <span
                                    onClick={() => handleRemoveScheme(i)}
                                    style={{ marginLeft: 'auto', cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)' }}
                                  >
                                    ✕ убрать (бесплатно)
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          {installed.length < maxSockets ? (
                            bp ? (
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                                background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)',
                                borderRadius: 4, fontSize: 12, marginBottom: 8,
                              }}>
                                <span style={{ color: bp.qualityColor || 'var(--text-primary)' }}>
                                  {bp.displayName || bp.name}
                                </span>
                                <Button size="sm" variant="primary" onClick={handleSocketScheme} style={{ marginLeft: 'auto' }}>
                                  Вставить
                                </Button>
                              </div>
                            ) : (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                Перетащи сферу в малый слот выше{bp ? '' : ' (сферы падают с разбора)'}.
                              </div>
                            )
                          ) : (
                            <div style={{ fontSize: 11, color: 'var(--accent-warning)' }}>
                              Гнёзда забиты — удали старую сферу, чтобы вставить новую.
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
                {/* Патроны: мгновенное снаряжение полного стака обычных */}
                <div style={{ marginTop: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                    🔸 Снаряжение патронов (сразу в инвентарь)
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {AMMO_GROUPS.map((g) => {
                      const cost = AMMO_CRAFT_COST[g.key];
                      if (!cost) return null;
                      const qty = maxStackFor(g.key);
                      const parts: { name: string; have: number; need: number }[] = [];
                      if (cost.powder > 0) parts.push({ name: MATERIAL_NAMES.powder, have: countResource(MATERIAL_NAMES.powder), need: cost.powder });
                      if (cost.scrap > 0) parts.push({ name: MATERIAL_NAMES.scrap, have: countResource(MATERIAL_NAMES.scrap), need: cost.scrap });
                      if ((cost.reagent || 0) > 0) parts.push({ name: MATERIAL_NAMES.reagent, have: countResource(MATERIAL_NAMES.reagent), need: cost.reagent || 0 });
                      const afford = parts.every((p) => p.have >= p.need);
                      const img = getBulletImage(g.packName);
                      return (
                        <div key={g.key}
                          onClick={() => handleCraftAmmo(g.key)}
                          title={afford ? `Снарядить ${qty} шт` : 'Не хватает ресурсов'}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
                            borderRadius: 6, cursor: afford ? 'pointer' : 'not-allowed',
                            opacity: afford ? 1 : 0.45,
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.08)', fontSize: 11,
                          }}
                        >
                          {img && <img src={img} alt="" style={{ width: 26, height: 26, objectFit: 'contain' }} />}
                          <span style={{ color: 'var(--text-primary)' }}>{g.name} x{qty}</span>
                          <span style={{ color: afford ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                            {parts.map((p) => `${p.name} ${p.have}/${p.need}`).join(' · ')}
                          </span>
                        </div>
                      );
                    })}
                    </div>
                  </div>
                </>
          </WapPanel>
        )}
      </div>
      {tooltipItem && <ItemTooltip item={tooltipItem} x={tooltipPos.x} y={tooltipPos.y} />}
    </motion.div>
  );
};
