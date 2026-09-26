import { useCallback, useEffect, useRef, useState } from 'react';
import { useCombatGridStore } from '../../stores/combatGridStore';
import { usePlayerStore } from '../../stores/playerStore';
import { useUiStore } from '../../stores/uiStore';
import { useSound } from '../../hooks/useSound';
import { getEnemyImage, getItemImage, images } from '../../assets/index';
import { getConsumableIcon } from '../../data/consumables';
import { backpackSlotsFor, createGrid, tryInsertIntoGrid, removeItemFromGrid, isBigItem } from '../../data/backpacks';
import { ItemTooltip } from './ItemTooltip';
import { WapHeader } from '../ui/WapHeader';
import type { Item } from '../../types/items';
import styles from './BattleGrid.module.css';

import { CORPSE_SLOTS } from '../../engine/loot';
const cellPx = 52;

const iconFor = (item: any): string | null => {
  if (item.image) return null;
  if (item.type === 'consumable') return getConsumableIcon(item);
  if (item.type === 'backpack') return null;
  if (item.type === 'bullet') return null;
  if (item.type === 'chest') return null;
  return null;
};

/** Отрисовать одну ячейку (1×1 или 2×2). */
const Cell = ({ item, hidden, searching, onSearch, onDrop, onDragStart, onDoubleClick, onHover, onMove, onLeave }: {
  item: any | null;
  hidden?: boolean;
  searching?: boolean;
  onSearch?: () => void;
  onDrop: (itemId: string) => void;
  onDragStart: (id: string, e: React.DragEvent) => void;
  onDoubleClick: () => void;
  onHover: (e: React.MouseEvent) => void;
  onMove: (e: React.MouseEvent) => void;
  onLeave: () => void;
}) => {
  const w = item?.gridW ?? 1;
  const h = item?.gridH ?? 1;
  const sz = cellPx;
  // Скрытая ячейка трупа — туман неизвестности.
  if (item && hidden) {
    return (
      <div
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const id = e.dataTransfer.getData('text/plain'); if (id) onDrop(id); }}
        onDragOver={(e) => e.preventDefault()}
        onClick={onSearch}
        onMouseEnter={onHover}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        title="Клик — обыскать (2с)"
        style={{
          gridColumn: `span ${w}`, gridRow: `span ${h}`,
          width: '100%', height: '100%',
          background: searching
            ? 'rgba(217,119,6,0.18)'
            : 'repeating-linear-gradient(45deg, rgba(0,0,0,0.75), rgba(0,0,0,0.75) 4px, rgba(60,60,70,0.5) 4px, rgba(60,60,70,0.5) 8px)',
          border: '1px dashed rgba(255,255,255,0.3)',
          borderRadius: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          position: 'relative', cursor: 'pointer',
          animation: searching ? 'lootSearchPulse 0.5s ease-in-out infinite' : 'none',
        }}
      >
        <span style={{ fontSize: 20, lineHeight: 1 }}>{searching ? '🔍' : '❔'}</span>
        <span style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {searching ? 'поиск…' : 'обыскать'}
        </span>
      </div>
    );
  }
  const emoji = item ? iconFor(item) : null;
  const url = item && !emoji ? (item.image || getItemImage(item.name, item.displayName, item.slot, (item as any).type)) : undefined;
  return (
    <div
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const id = e.dataTransfer.getData('text/plain'); if (id) onDrop(id); }}
      onDragOver={(e) => e.preventDefault()}
      onDoubleClick={onDoubleClick}
      onMouseEnter={onHover}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{
        gridColumn: `span ${w}`, gridRow: `span ${h}`,
        width: '100%', height: '100%', background: '#201c17',
        border: `1px solid ${item?.qualityColor || 'rgba(255,235,200,0.22)'}`,
        borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}
    >
      {item && (
        <div
          draggable
          onDragStart={(e) => onDragStart(item.id, e)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab', width: '100%', height: '100%' }}
        >
          {emoji ? (
            <span style={{ fontSize: w > 1 || h > 1 ? 48 : 26, lineHeight: 1 }}>{emoji}</span>
          ) : url ? (
            <img src={url} alt="" draggable={false} style={{ width: w > 1 || h > 1 ? '85%' : 42, height: w > 1 || h > 1 ? '85%' : 42, objectFit: 'contain' }} />
          ) : (
            <span style={{ fontSize: 16, opacity: 0.2 }}>?</span>
          )}
        </div>
      )}
      {item && ((item.quantity ?? 1) > 1 || item.type === 'bullet') && (
        <div style={{
          position: 'absolute', bottom: 1, right: 2, fontSize: 9, fontWeight: 600,
          fontFamily: 'var(--font-mono)', color: '#fff', background: 'rgba(0,0,0,0.65)',
          borderRadius: 2, padding: '0 3px', lineHeight: '13px', pointerEvents: 'none',
        }}>
          x{item.quantity ?? 1}
        </div>
      )}
      {item && (w > 1 || h > 1) && (
        <div style={{
          position: 'absolute', top: 1, left: 2, fontSize: 8, fontWeight: 700,
          fontFamily: 'var(--font-mono)', color: '#fbbf24', pointerEvents: 'none',
        }}>
          {w}×{h}
        </div>
      )}
    </div>
  );
};

export const LootBackpackWindow = ({ enemyId, onClose }: { enemyId: number | string; onClose: () => void }) => {
  const enemies = useCombatGridStore((s) => s.enemies);
  const lootingSnap = useCombatGridStore((s) => s.lootingEnemy);
  // Сборный обыск ('combined-loot') в enemies[] отсутствует — читаем снапшот.
  const enemy = enemyId === 'combined-loot' ? lootingSnap : enemies.find((e: any) => e.id === enemyId);
  const isCombined = enemyId === 'combined-loot';
  const pack = usePlayerStore((s) => s.equipment.backpack);
  const backpackGrid = usePlayerStore((s) => s.backpackGrid);
  const { playClick, playSound } = useSound();
  const [tip, setTip] = useState<{ item: Item; x: number; y: number } | null>(null);
  const [hint, setHint] = useState<{ x: number; y: number } | null>(null);
  const [searching, setSearching] = useState<Record<string, boolean>>({});
  const timers = useRef<number[]>([]);
  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); }, []);

  const dragRef = useRef({ dragging: false });
  const [dragging, setDragging] = useState(false);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    dragRef.current = { dragging: true };
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onUp = () => { dragRef.current.dragging = false; setDragging(false); };
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mouseup', onUp); };
  }, [dragging]);

  const packSlots = backpackSlotsFor(pack);
  const loot: any[] = (enemy?.loot ?? []).slice(0, CORPSE_SLOTS);
  // Экипировка трупа (надетое). В сборном виде — с parentEnemyId для возврата.
  const gearView: any[] = (enemy as any)?.gear ?? [];

  const stripParent = (g: any) => {
    if (!g || typeof g !== 'object') return g;
    const { parentEnemyId, ...rest } = g as any;
    return rest;
  };

  // Разложить сборный список назад по исходным трупам (включая опустевшие).
  const distributeBack = (newItems: any[], kind: 'loot' | 'gear') => {
    const cur = kind === 'loot' ? loot : gearView;
    const parents = new Set<string | number>();
    for (const it of cur) {
      const pid = (it as any)?.parentEnemyId;
      if (pid !== undefined && pid !== null) parents.add(pid);
    }
    const byParent = new Map<string | number, any[]>();
    for (const pid of parents) byParent.set(pid, []);
    for (const it of newItems) {
      const pid = (it as any)?.parentEnemyId;
      if (pid === undefined || pid === null) continue;
      if (!byParent.has(pid)) byParent.set(pid, []);
      byParent.get(pid)!.push(kind === 'gear' ? stripParent(it) : it);
    }
    useCombatGridStore.setState((s: any) => ({
      enemies: s.enemies.map((e: any) => (byParent.has(e.id) ? { ...e, [kind]: byParent.get(e.id) } : e)),
      lootingEnemy: s.lootingEnemy && s.lootingEnemy.id === 'combined-loot'
        ? { ...s.lootingEnemy, [kind]: newItems } : s.lootingEnemy,
    }));
  };

  const refreshEnemyLoot = (newLoot: any[]) => {
    if (!isCombined) {
      useCombatGridStore.setState((s: any) => ({
        enemies: s.enemies.map((e: any) => (e.id === enemyId ? { ...e, loot: newLoot } : e)),
      }));
      return;
    }
    distributeBack(newLoot, 'loot');
  };

  const refreshGearView = (newGear: any[]) => {
    if (!isCombined) {
      useCombatGridStore.setState((s: any) => ({
        enemies: s.enemies.map((e: any) => (e.id === enemyId ? { ...e, gear: newGear.map(stripParent) } : e)),
      }));
      return;
    }
    distributeBack(newGear, 'gear');
  };

  const say = (msg: string) => useCombatGridStore.getState().addMessage(msg);

  const searchCell = (itemId: string) => {
    const item = loot.find((i: any) => i.id === itemId);
    if (!item || (item as any).revealed || searching[itemId]) return;
    setSearching((s) => ({ ...s, [itemId]: true }));
    playSound('sherst--myagkiy-shoroh', 0.5);
    timers.current.push(window.setTimeout(() => {
      setSearching((s) => {
        const n = { ...s };
        delete n[itemId];
        return n;
      });
      const cur = useCombatGridStore.getState().enemies.find((e: any) => e.id === enemyId);
      const curLoot: any[] = cur?.loot ?? loot;
      refreshEnemyLoot(curLoot.map((i: any) => (i.id === itemId ? { ...i, revealed: true } : i)));
      playClick();
    }, 2000));
  };

  // Труп -> свой рюкзак (grid).
  const takeFromCorpse = (itemId: string) => {
    const item = loot.find((i: any) => i.id === itemId);
    if (!item) return;
    if (!(item as any).revealed) { say('🔍 Сначала обыщи ячейку!'); return; }
    if (!pack) { say('❌ Нет рюкзака!'); return; }
    const { grid: newGrid, moved, leftoverQty } = tryInsertIntoGrid(backpackGrid, item);
    if (!moved) { say('❌ Свой рюкзак полон! Освободи место.'); return; }
    const rest = loot.filter((i: any) => i.id !== itemId);
    if (leftoverQty > 0) rest.push({ ...item, quantity: leftoverQty });
    refreshEnemyLoot(rest);
    usePlayerStore.setState({ backpackGrid: newGrid });
    playSound('laying-out-a-travel-mat', 0.5);
  };

  // Свой рюкзак -> труп.
  const putToCorpse = (itemId: string) => {
    if (isCombined) { say('❌ В общий обыск — только забирать!'); return; }
    if (loot.length >= CORPSE_SLOTS) { say('❌ Рюкзак трупа полон!'); return; }
    const item = backpackGrid.items.find((i) => i.id === itemId);
    if (!item) return;
    refreshEnemyLoot([...loot, item]);
    usePlayerStore.setState({ backpackGrid: removeItemFromGrid(backpackGrid, itemId) });
    playSound('laying-out-a-travel-mat', 0.5);
  };

  const onCorpseDrop = (rawId: string) => {
    const id = rawId || useUiStore.getState().draggedItemId || '';
    useUiStore.getState().setDraggedItemId(null);
    if (id.startsWith('gear:')) { stashGearToCorpse(id.slice(5)); return; }
    if (!id.startsWith('pack:')) return;
    putToCorpse(id.slice(5));
  };

  const onPackDrop = (rawId: string) => {
    const id = rawId || useUiStore.getState().draggedItemId || '';
    useUiStore.getState().setDraggedItemId(null);
    if (id.startsWith('gear:')) { takeGearToPack(id.slice(5)); return; }
    if (!id.startsWith('corpse:')) return;
    takeFromCorpse(id.slice(7));
  };

  // Экипировка трупа -> свой рюкзак (сломанное не снимается).
  const takeGearToPack = (gearId: string) => {
    const g = gearView.find((x: any) => x.id === gearId);
    if (!g) return;
    if ((g as any).broken) { say('🔧 Сломано — снять нельзя!'); return; }
    if (!pack) { say('❌ Нет рюкзака!'); return; }
    const clean = { ...stripParent(g), revealed: true };
    const { grid: newGrid, moved } = tryInsertIntoGrid(backpackGrid, clean);
    if (!moved) { say('❌ Свой рюкзак полон! Освободи место.'); return; }
    refreshGearView(gearView.filter((x: any) => x.id !== gearId));
    usePlayerStore.setState({ backpackGrid: newGrid });
    playSound('laying-out-a-travel-mat', 0.5);
  };

  // Экипировка трупа -> рюкзак трупа (только одиночный труп).
  const stashGearToCorpse = (gearId: string) => {
    if (isCombined) { say('❌ В общий обыск — только забирать!'); return; }
    const g = gearView.find((x: any) => x.id === gearId);
    if (!g || (g as any).broken) return;
    if (loot.length >= CORPSE_SLOTS) { say('❌ Рюкзак трупа полон!'); return; }
    refreshEnemyLoot([...loot, { ...stripParent(g), revealed: true }]);
    refreshGearView(gearView.filter((x: any) => x.id !== gearId));
    playSound('laying-out-a-travel-mat', 0.5);
  };

  const takeAll = () => {
    let cur = loot.map((i: any) => ({ ...i, revealed: true }));
    let movedAny = false;
    for (const item of [...cur]) {
      if (!pack) { say('❌ Нет рюкзака!'); return; }
      const { grid: newGrid, moved, leftoverQty } = tryInsertIntoGrid(usePlayerStore.getState().backpackGrid, item);
      if (!moved) break;
      cur = cur.filter((i: any) => i.id !== item.id);
      if (leftoverQty > 0) cur.push({ ...item, quantity: leftoverQty });
      usePlayerStore.setState({ backpackGrid: newGrid });
      movedAny = true;
    }
    // Целый гир — тоже забираем.
    let curGear = [...gearView];
    for (const g of [...curGear]) {
      if ((g as any).broken) continue;
      if (!pack) { say('❌ Нет рюкзака!'); return; }
      const clean = { ...stripParent(g), revealed: true };
      const { grid: newGrid, moved } = tryInsertIntoGrid(usePlayerStore.getState().backpackGrid, clean);
      if (!moved) break;
      curGear = curGear.filter((x: any) => x.id !== (g as any).id);
      usePlayerStore.setState({ backpackGrid: newGrid });
      movedAny = true;
    }
    refreshGearView(curGear);
    refreshEnemyLoot(cur);
    if (movedAny) playSound('laying-out-a-travel-mat', 0.5);
    else say('❌ Свой рюкзак полон! Освободи место.');
  };

  if (!enemy) return null;

  const showTip = (item: any) => (e: React.MouseEvent) => setTip({ item, x: e.clientX, y: e.clientY });
  const moveTip = (e: React.MouseEvent) => setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t));
  const showHint = (e: React.MouseEvent) => setHint({ x: e.clientX, y: e.clientY });
  const moveHint = (e: React.MouseEvent) => setHint((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t));
  const hiddenCount = loot.filter((i: any) => !(i as any).revealed).length;
  const enemyImg = getEnemyImage(enemy.faction, enemy.name);

  // Фиксированные слоты экипировки трупа.
  const gearCellFor = (key: string): any | null => {
    if (key === 'weapon') return gearView.find((x: any) => x.slot === 'weapon1' || x.slot === 'weapon2') || null;
    return gearView.find((x: any) => x.slot === key) || null;
  };

  // Auto-assign grid positions for corpse loot items (2×2 for weapons/armor)
  const corpseGridCols = 5;
  const corpseGridRows = Math.max(1, Math.ceil(CORPSE_SLOTS / corpseGridCols));
  const corpseItems: (Item | null)[] = Array(corpseGridCols * corpseGridRows).fill(null);
  const corpseOccupied = new Set<number>();
  for (const item of loot) {
    if (!item) continue;
    const w = isBigItem(item) ? 2 : 1;
    const h = isBigItem(item) ? 2 : 1;
    // Find free slot
    let placed = false;
    for (let y = 0; y <= corpseGridRows - h && !placed; y++) {
      for (let x = 0; x <= corpseGridCols - w && !placed; x++) {
        const idx = y * corpseGridCols + x;
        let canPlace = true;
        for (let dy = 0; dy < h && canPlace; dy++) {
          for (let dx = 0; dx < w && canPlace; dx++) {
            if (corpseOccupied.has((y + dy) * corpseGridCols + (x + dx))) canPlace = false;
          }
        }
        if (canPlace) {
          corpseItems[idx] = { ...item, gridW: w, gridH: h, gridX: x, gridY: y };
          for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
              corpseOccupied.add((y + dy) * corpseGridCols + (x + dx));
            }
          }
          placed = true;
        }
      }
    }
  }
  const gridCols = 5;
  const gridRows = Math.max(1, Math.ceil(packSlots / gridCols));
  const packCells: (Item | null)[] = Array(gridCols * gridRows).fill(null);
  for (const item of backpackGrid.items) {
    const gx = item.gridX ?? 0;
    const gy = item.gridY ?? 0;
    const gw = item.gridW ?? 1;
    const gh = item.gridH ?? 1;
    // Place item at top-left cell, mark covered cells as occupied
    const idx = gy * gridCols + gx;
    packCells[idx] = item;
    for (let dy = 0; dy < gh; dy++) {
      for (let dx = 0; dx < gw; dx++) {
        const ci = (gy + dy) * gridCols + (gx + dx);
        if (ci !== idx && ci < packCells.length) packCells[ci] = '__occupied__';
      }
    }
  }

  return (
    <div className={styles.lootOverlay} onClick={onClose}>
      <div className={styles.lootWindow} onClick={(e) => e.stopPropagation()} style={{ minWidth: 640, overflow: 'hidden', borderRadius: 8, paddingTop: 0, marginTop: -100, marginLeft: 20 }}>
        <WapHeader title="🎒 Обыск" glow="amber" onMouseDown={onDragStart}
          style={{ background: 'linear-gradient(180deg, rgb(217,119,6), rgb(146,64,14))', margin: '0 -20px 12px', width: 'calc(100% + 40px)', cursor: dragging ? 'grabbing' : 'grab' }}>
          <span onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ cursor: 'pointer', fontSize: 14, color: 'white', padding: '0 4px' }}>✕</span>
        </WapHeader>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>
          Тяни к себе · лишнее — обратно трупу · двойной клик — взять · скрытое — клик обыскать (1с) · оружие/броня 2×2 · гир трупа — ниже
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          {/* СЛЕВА: наш рюкзак (grid) */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <img src={images.hero} alt="hero" draggable={false} style={{ width: 44, height: 44, objectFit: 'contain' }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                🎒 Мой рюкзак ({backpackGrid.items.length}/{packSlots})
              </div>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${gridCols}, ${cellPx}px)`,
              gridTemplateRows: `repeat(${gridRows}, ${cellPx}px)`,
              gap: 4,
              justifyContent: 'start',
            }}>
              {packCells.map((cell, i) => {
                if (cell === '__occupied__') return null; // skip covered cells
                const item = cell as Item | null;
                if (!item && i >= packSlots) {
                  return (
                    <div
                      key={`plock-${i}`}
                      title="Закрыто — нет слота"
                      style={{
                        width: '100%', height: '100%',
                        background: 'rgba(60,10,10,0.5)',
                        border: '1px solid rgba(255,60,60,0.25)',
                        borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, opacity: 0.5, pointerEvents: 'none',
                      }}
                    >
                      🔒
                    </div>
                  );
                }
                return (
                  <Cell
                    key={item ? item.id : `p-${i}`}
                    item={item}
                    onDrop={onPackDrop}
                    onDragStart={(id, e) => { e.dataTransfer.setData('text/plain', `pack:${id}`); useUiStore.getState().setDraggedItemId(`pack:${id}`); }}
                    onDoubleClick={() => {}}
                    onHover={item ? showTip(item) : () => {}}
                    onMove={moveTip}
                    onLeave={() => setTip(null)}
                  />
                );
              })}
            </div>
          </div>
          {/* СПРАВА: труп */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              {enemyImg && <img src={enemyImg} alt={enemy.name} draggable={false} style={{ width: 44, height: 44, objectFit: 'contain' }} />}
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                {enemy.name} ({loot.length}/{CORPSE_SLOTS}){hiddenCount > 0 && ` · скрыто: ${hiddenCount}`}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${corpseGridCols}, ${cellPx}px)`, gridTemplateRows: `repeat(${corpseGridRows}, ${cellPx}px)`, gap: 4, marginBottom: 10, justifyContent: 'start' }}>
              {corpseItems.map((item, i) => {
                if (item === null && corpseOccupied.has(i)) return null;
                const isHidden = !!item && !(item as any).revealed;
                return (
                  <Cell
                    key={item ? item.id : `c-empty-${i}`}
                    item={item}
                    hidden={isHidden}
                    searching={!!(item && searching[item.id])}
                    onSearch={() => { if (item) { searchCell(item.id); setHint(null); } }}
                    onDrop={onCorpseDrop}
                    onDragStart={(id, e) => {
                      const it = loot.find((x: any) => x.id === id);
                      if (!(it as any)?.revealed) { e.preventDefault(); return; }
                      e.dataTransfer.setData('text/plain', `corpse:${id}`);
                      useUiStore.getState().setDraggedItemId(`corpse:${id}`);
                    }}
                    onDoubleClick={() => { if (item) takeFromCorpse(item.id); }}
                    onHover={item ? (isHidden ? showHint : showTip(item)) : () => {}}
                    onMove={item ? (isHidden ? moveHint : moveTip) : () => {}}
                    onLeave={() => { setTip(null); setHint(null); }}
                  />
                );
              })}
            </div>
            {/* Экипировка трупа: надетое (сломанное — только смотреть). */}
            {gearView.length > 0 && (
              <div style={{ marginTop: 2 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                  🛡️ Экипировка <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 10 }}>· двойной клик — себе · тяни в рюкзаки · 🔧 не снимается</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(6, ${cellPx}px)`, gap: 4, justifyContent: 'start' }}>
                  {[
                    { key: 'weapon', label: 'Оружие' },
                    { key: 'head', label: 'Шлем' },
                    { key: 'armor', label: 'Броня' },
                    { key: 'pants', label: 'Штаны' },
                    { key: 'gloves', label: 'Перчатки' },
                    { key: 'boots', label: 'Ботинки' },
                  ].map((c) => {
                    const g = gearCellFor(c.key);
                    return (
                      <div key={c.key} title={c.label} style={{ position: 'relative' }}>
                        <Cell
                          item={g}
                          onDrop={() => {}}
                          onDragStart={(id, e) => {
                            if ((g as any)?.broken) { e.preventDefault(); return; }
                            e.dataTransfer.setData('text/plain', `gear:${id}`);
                            useUiStore.getState().setDraggedItemId(`gear:${id}`);
                          }}
                          onDoubleClick={() => { if (g) takeGearToPack(g.id); }}
                          onHover={g ? showTip(g) : () => {}}
                          onMove={moveTip}
                          onLeave={() => setTip(null)}
                        />
                        {(g as any)?.broken && (
                          <div style={{
                            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(248,113,113,0.6)',
                            borderRadius: 3, fontSize: 9, fontWeight: 800, color: '#f87171', pointerEvents: 'none',
                          }}>
                            🔧 СЛОМ.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <div
            className={styles.lootTakeBtn}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '8px 6px', fontFamily: "'Courier New', monospace", fontWeight: 700,
              fontSize: 13, letterSpacing: 3, textTransform: 'uppercase',
              color: '#fff', background: 'linear-gradient(180deg, rgb(217,119,6), rgb(146,64,14))',
              border: '1px solid rgba(255,200,100,0.5)', borderRadius: 4,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 6px rgba(0,0,0,0.5)',
              textShadow: '0 1px 2px rgba(0,0,0,0.8)',
            }}
            onClick={takeAll}
          >
            ★ Забрать всё ★
          </div>
          <div className={styles.lootCloseBtn} onClick={onClose}>ЗАКРЫТЬ</div>
        </div>
        {tip && <ItemTooltip item={tip.item} x={tip.x} y={tip.y} />}
        {hint && !tip && (
          <div style={{
            position: 'fixed', left: Math.min(hint.x + 16, window.innerWidth - 240), top: hint.y - 10,
            zIndex: 9999, background: '#12121a', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 6, padding: '8px 12px', pointerEvents: 'none',
            fontSize: 12, color: 'var(--text-primary)', maxWidth: 220,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>❔ Неизвестно</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Кликни, чтобы обыскать (2с). После обыска здесь будет тултип предмета.</div>
          </div>
        )}
      </div>
    </div>
  );
};
