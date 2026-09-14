import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { usePlayerStore } from '../../stores/playerStore';
import { useUiStore } from '../../stores/uiStore';
import { useCombatGridStore } from '../../stores/combatGridStore';
import { useSound } from '../../hooks/useSound';
import { getItemImage } from '../../assets/index';
import { getConsumableIcon } from '../../data/consumables';
import { backpackSlotsFor, backpackDefByName, removeItemFromGrid } from '../../data/backpacks';
import { FOOD_MAP } from '../../data/food';
import { getSellPrice } from '../../utils/sellPrice';
import { ItemTooltip } from './ItemTooltip';
import { WapHeader } from '../ui/WapHeader';
import type { Item } from '../../types/items';

interface Props {
  onClose: () => void;
}

const cellSize = 48;
const GRID_COLS = 5;

const cellIcon = (item: Item): string | null => {
  if (item.image) return null;
  if (item.type === 'consumable') return getConsumableIcon(item);
  if (item.type === 'backpack') return null;
  if (item.type === 'bullet') return null;
  if (item.type === 'chest') return null;
  return null;
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

export const BackpackWindow = ({ onClose }: Props) => {
  const backpack = usePlayerStore((s) => s.equipment.backpack);
  const backpackGrid = usePlayerStore((s) => s.backpackGrid);
  const putInBackpack = usePlayerStore((s) => s.putInBackpack);
  const takeOutBackpack = usePlayerStore((s) => s.takeOutBackpack);
  const emptyBackpackToInventory = usePlayerStore((s) => s.emptyBackpackToInventory);
  const addLog = usePlayerStore((s) => s.addLog);
  const { playClick, playSound } = useSound();
  const [tip, setTip] = useState<{ item: Item; x: number; y: number } | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; item: Item } | null>(null);
  const [pos, setPos] = useState(() => ({
    x: Math.max(0, (window.innerWidth - 360) / 2),
    y: Math.max(0, (window.innerHeight - 480) / 2),
  }));
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startPosX: 0, startPosY: 0 });
  const [dragging, setDragging] = useState(false);

  const slots = backpackSlotsFor(backpack);
  const gridRows = Math.max(1, Math.ceil(slots / GRID_COLS));
  const contents = backpackGrid.items;
  const inCombat = useCombatGridStore((s) => s.isActive && s.enemies.some((e) => !e.dead && e.knowsPlayer));

  // Build occupied map for grid rendering
  const occupied = useMemo(() => {
    const occ = new Set<string>();
    for (const it of backpackGrid.items) {
      const gx = it.gridX ?? 0;
      const gy = it.gridY ?? 0;
      const gw = it.gridW ?? 1;
      const gh = it.gridH ?? 1;
      for (let dy = 0; dy < gh; dy++) {
        for (let dx = 0; dx < gw; dx++) {
          occ.add(`${gx + dx},${gy + dy}`);
        }
      }
    }
    return occ;
  }, [backpackGrid.items]);

  const info = useMemo(() => {
    const byType: Record<string, number> = {};
    let value = 0;
    let ammo = 0;
    for (const it of contents) {
      const t = it.type || 'прочее';
      byType[t] = (byType[t] || 0) + 1;
      value += getSellPrice(it);
      if (it.type === 'bullet') ammo += (it.quantity ?? 1) as number;
    }
    const def = backpack ? backpackDefByName(backpack.name || '') : undefined;
    return { byType, value, ammo, family: def?.family ?? '—', base: def?.baseSlots ?? slots };
  }, [contents, backpack, slots]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current.dragging = true;
    dragRef.current.startX = e.clientX;
    dragRef.current.startY = e.clientY;
    dragRef.current.startPosX = pos.x;
    dragRef.current.startPosY = pos.y;
    setDragging(true);
    e.preventDefault();
  }, [pos.x, pos.y]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current.dragging) return;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 200, dragRef.current.startPosX + e.clientX - dragRef.current.startX)),
        y: Math.max(0, Math.min(window.innerHeight - 60, dragRef.current.startPosY + e.clientY - dragRef.current.startY)),
      });
    };
    const onUp = () => { dragRef.current.dragging = false; setDragging(false); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dtId = e.dataTransfer.getData('text/plain');
    const itemId = dtId || useUiStore.getState().draggedItemId;
    if (!itemId) return;
    const msg = putInBackpack(itemId);
    playSound('laying-out-a-travel-mat', 0.5);
    addLog(msg, msg.startsWith('❌') || msg.startsWith('⚠️') ? 'warning' : 'info');
  };

  if (!backpack) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1400, pointerEvents: 'none', userSelect: 'none' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        style={{ position: 'fixed', left: pos.x, top: pos.y, pointerEvents: 'auto', minWidth: 320, maxWidth: '92vw' }}
      >
        <WapHeader title={`${backpack.displayName || backpack.name} (${contents.length}/${slots})`} glow="amber" onMouseDown={onMouseDown}
          style={{ background: 'linear-gradient(180deg, rgb(217,119,6), rgb(146,64,14))' }}>
          <span onClick={(e) => { e.stopPropagation(); playClick(); onClose(); }} style={{ cursor: 'pointer', fontSize: 14, color: 'white', padding: '0 4px' }}>✕</span>
        </WapHeader>
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          style={{
            background: 'linear-gradient(180deg, #1a1a1a 0%, #151515 58%, #23272b 100%)',
            border: '1px solid rgba(217,119,6,0.35)',
            borderRadius: '0 0 10px 10px',
            boxShadow: '0 16px 48px rgba(0,0,0,0.75), 0 0 24px rgba(217,119,6,0.08), 0 2px 0 rgba(255,255,255,0.04) inset',
            padding: 12,
            display: 'grid',
            gridTemplateColumns: `repeat(${GRID_COLS}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${gridRows}, ${cellSize}px)`,
            gap: 4,
            justifyContent: 'center',
          }}
        >
          {/* Render placed items with grid spans */}
          {backpackGrid.items.map((item) => {
            const w = item.gridW ?? 1;
            const h = item.gridH ?? 1;
            const emoji = cellIcon(item);
            const url = emoji ? undefined : (item.image || getItemImage(item.name, item.displayName, item.slot, item.type));
            const qc = item.qualityColor || '#818cf8';
            const body = emoji ? (
              <span style={{ fontSize: w > 1 || h > 1 ? 48 : 26, lineHeight: 1 }}>{emoji}</span>
            ) : url ? (
              <img src={url} alt="" draggable={false} style={{ width: w > 1 || h > 1 ? '85%' : 40, height: w > 1 || h > 1 ? '85%' : 40, objectFit: 'contain' }} />
            ) : (
              <span style={{ fontSize: 16, opacity: 0.2 }}>?</span>
            );
            return (
              <div
                key={item.id}
                onDoubleClick={() => {
                  if (inCombat) { addLog('⚔️ На арене нельзя доставать из рюкзака!', 'warning'); return; }
                  takeOutBackpack(item.id);
                  playSound('laying-out-a-travel-mat', 0.5);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  const abilId = (item as any).abilityId || '';
                  const isFood = item.type === 'consumable' && FOOD_MAP[abilId];
                  const isConsumable = item.type === 'consumable';
                  if (isFood || isConsumable) {
                    setCtxMenu({ x: e.clientX, y: e.clientY, item });
                  }
                }}
                onMouseEnter={(e) => setTip({ item, x: e.clientX, y: e.clientY })}
                onMouseMove={(e) => setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t))}
                onMouseLeave={() => setTip(null)}
                title="Двойной клик — вернуть в инвентарь"
                style={{
                  gridColumn: `${(item.gridX ?? 0) + 1} / span ${w}`,
                  gridRow: `${(item.gridY ?? 0) + 1} / span ${h}`,
                  background: 'linear-gradient(180deg, #0e0e11 0%, #16161a 100%)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', position: 'relative', overflow: 'hidden',
                  boxShadow: `0 0 10px ${withAlpha(qc, 0.25)}, inset 0 2px 8px rgba(0,0,0,0.7)`,
                }}
              >
                {/* Свечение качества за предметом */}
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(ellipse 72% 66% at 50% 55%, ${withAlpha(qc, 0.3)}, transparent 70%)` }} />
                {/* Уголки качества */}
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
                  <div style={{ position: 'absolute', top: 2, left: 2, width: 7, height: 7, borderTop: `2px solid ${qc}`, borderLeft: `2px solid ${qc}`, borderTopLeftRadius: 4 }} />
                  <div style={{ position: 'absolute', top: 2, right: 2, width: 7, height: 7, borderTop: `2px solid ${qc}`, borderRight: `2px solid ${qc}`, borderTopRightRadius: 4 }} />
                  <div style={{ position: 'absolute', bottom: 2, left: 2, width: 7, height: 7, borderBottom: `2px solid ${qc}`, borderLeft: `2px solid ${qc}`, borderBottomLeftRadius: 4 }} />
                  <div style={{ position: 'absolute', bottom: 2, right: 2, width: 7, height: 7, borderBottom: `2px solid ${qc}`, borderRight: `2px solid ${qc}`, borderBottomRightRadius: 4 }} />
                </div>
                <div
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData('text/plain', item.id); useUiStore.getState().setDraggedItemId(item.id); }}
                  onDragEnd={() => { useUiStore.getState().setDraggedItemId(null); }}
                  title="Тяни в инвентарь"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab' }}
                >
                  {body}
                </div>
                {((item.quantity ?? 1) > 1 || item.type === 'bullet') && (
                  <div style={{
                    position: 'absolute', bottom: 1, right: 2,
                    fontSize: 9, fontWeight: 600, fontFamily: 'var(--font-mono)',
                    color: '#fff', background: 'rgba(0,0,0,0.65)',
                    borderRadius: 2, padding: '0 3px', lineHeight: '13px',
                  }}>
                    x{item.quantity ?? 1}
                  </div>
                )}
                {(w > 1 || h > 1) && (
                  <div style={{
                    position: 'absolute', top: 1, left: 2, fontSize: 8, fontWeight: 700,
                    fontFamily: 'var(--font-mono)', color: '#fbbf24', pointerEvents: 'none',
                  }}>
                    {w}×{h}
                  </div>
                )}
              </div>
            );
          })}
          {/* Empty cells (лишние ячейки последнего ряда — заблокированы) */}
          {Array.from({ length: gridRows * GRID_COLS }).map((_, i) => {
            const x = i % GRID_COLS;
            const y = Math.floor(i / GRID_COLS);
            if (occupied.has(`${x},${y}`)) return null;
            if (x >= GRID_COLS || y >= gridRows) return null;
            if (i >= slots) {
              return (
                <div
                  key={`locked-${i}`}
                  title="Закрыто — нет слота"
                  style={{
                    gridColumn: `${x + 1}`, gridRow: `${y + 1}`,
                    width: cellSize, height: cellSize,
                    background: 'linear-gradient(180deg, #160d0d 0%, #100b0b 100%)',
                    border: '1px solid rgba(255,60,60,0.2)',
                    borderRadius: 6,
                    boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, opacity: 0.5, pointerEvents: 'none',
                  }}
                >
                  🔒
                </div>
              );
            }
            return (
              <div
                key={`empty-${i}`}
                title="Перетащи сюда из инвентаря"
                style={{
                  gridColumn: `${x + 1}`, gridRow: `${y + 1}`,
                  width: cellSize, height: cellSize,
                  background: 'linear-gradient(180deg, #0e0e11 0%, #141418 100%)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 6,
                  boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.6)',
                }}
              />
            );
          })}
        </div>
        <div style={{
          marginTop: 6, padding: '8px 10px', borderRadius: 8,
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
          fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7,
        }}>
          <div>Семейство: <b style={{ color: 'var(--text-primary)' }}>{info.family}</b> (база {info.base} + качество)</div>
          <div>Занято: <b style={{ color: 'var(--text-primary)' }}>{contents.length}/{slots}</b> · патронов: <b style={{ color: 'var(--text-primary)' }}>{info.ammo}</b> · value: <b style={{ color: '#fbbf24' }}>💾{info.value.toLocaleString()}</b></div>
          <div>Состав: {Object.keys(info.byType).length > 0
            ? Object.entries(info.byType).map(([t, n]) => `${t} x${n}`).join(' · ')
            : 'пусто'}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>Оружие/броня занимают 2×2 · Тяни из инвентаря · двойной клик — обратно</div>
          <button
            onClick={() => {
              const n = emptyBackpackToInventory();
              if (n > 0) { playSound('laying-out-a-travel-mat', 0.5); addLog(`📤 Выложено из рюкзака: ${n} шт.`, 'info'); }
            }}
            disabled={contents.length === 0 || inCombat}
            style={{
              marginTop: 6, width: '100%', padding: '6px 0',
              background: contents.length === 0 || inCombat ? 'transparent' : 'rgba(217,119,6,0.15)',
              border: '1px solid rgba(217,119,6,0.4)', borderRadius: 6,
              color: contents.length === 0 || inCombat ? 'var(--text-muted)' : '#fbbf24',
              cursor: contents.length === 0 || inCombat ? 'default' : 'pointer', fontSize: 12, fontWeight: 600,
            }}
          >
            {inCombat ? '⚔️ На арене нельзя' : `📤 Выложить всё (${contents.length})`}
          </button>
        </div>
        {tip && <ItemTooltip item={tip.item} x={tip.x} y={tip.y} />}

        {ctxMenu && (
          <div style={{
            position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 9999,
            background: 'linear-gradient(180deg, #1a1a1a 0%, #151515 58%, #23272b 100%)',
            border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, padding: 4, minWidth: 140,
            boxShadow: '0 16px 48px rgba(0,0,0,0.75)',
          }}>
            <button onClick={() => {
              const item = ctxMenu.item;
              const abilId = (item as any).abilityId || '';
              const qty = (item.quantity ?? 1) as number;
              if (qty <= 1) {
                usePlayerStore.setState({ backpackGrid: removeItemFromGrid(backpackGrid, item.id) });
              } else {
                const newGrid = { ...backpackGrid, items: backpackGrid.items.map((i) => i.id === item.id ? { ...i, quantity: qty - 1 } : i) };
                usePlayerStore.setState({ backpackGrid: newGrid });
              }
              usePlayerStore.getState().useConsumable({ ...item, quantity: 1 });
              playSound('laying-out-a-travel-mat', 0.5);
              setCtxMenu(null);
            }}
              style={{
                width: '100%', textAlign: 'left', padding: '6px 10px', background: 'transparent', border: 'none',
                color: '#eee', cursor: 'pointer', fontSize: 13, borderRadius: 4,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >🍖 Использовать</button>
            <button onClick={() => {
              if (inCombat) { addLog('⚔️ На арене нельзя доставать из рюкзака!', 'warning'); setCtxMenu(null); return; }
              takeOutBackpack(ctxMenu.item.id);
              playSound('laying-out-a-travel-mat', 0.5);
              setCtxMenu(null);
            }}
              style={{
                width: '100%', textAlign: 'left', padding: '6px 10px', background: 'transparent', border: 'none',
                color: inCombat ? '#666' : '#eee', cursor: inCombat ? 'not-allowed' : 'pointer', fontSize: 13, borderRadius: 4,
              }}
              onMouseEnter={(e) => { if (!inCombat) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >{inCombat ? '⚔️ Нельзя на арене' : '📤 Вернуть в инвентарь'}</button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
