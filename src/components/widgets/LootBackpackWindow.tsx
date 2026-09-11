import { useEffect, useRef, useState } from 'react';
import { useCombatGridStore } from '../../stores/combatGridStore';
import { usePlayerStore } from '../../stores/playerStore';
import { useSound } from '../../hooks/useSound';
import { getEnemyImage, getItemImage, images } from '../../assets/index';
import { getConsumableIcon } from '../../data/consumables';
import { AMMO_GROUP_MAP, type AmmoGroup } from '../../data/ammo';
import { backpackSlotsFor, tryInsertInto } from '../../data/backpacks';
import { ItemTooltip } from './ItemTooltip';
import { WapHeader } from '../ui/WapHeader';
import type { Item } from '../../types/items';
import styles from './BattleGrid.module.css';

import { CORPSE_SLOTS } from '../../engine/loot';
const cellPx = 52;

const iconFor = (item: any): string | null => {
  if (item.image) return null;
  if (item.type === 'consumable') return getConsumableIcon(item);
  if (item.type === 'backpack') return '🎒';
  if (item.type === 'bullet') return AMMO_GROUP_MAP[(item.ammoGroup as AmmoGroup) ?? 'rifle']?.icon ?? '🔸';
  if (item.type === 'chest') return null;
  return null;
};

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
  // Скрытая ячейка трупа — туман неизвестности, клик = обыск 1с.
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
          width: cellPx, height: cellPx,
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
        width: cellPx, height: cellPx, background: '#201c17',
        border: `1px solid ${item?.qualityColor || 'rgba(255,235,200,0.22)'}`,
        borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}
    >
      {item && (
        <div
          draggable
          onDragStart={(e) => onDragStart(item.id, e)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab' }}
        >
          {emoji ? (
            <span style={{ fontSize: 26, lineHeight: 1 }}>{emoji}</span>
          ) : url ? (
            <img src={url} alt="" draggable={false} style={{ width: 42, height: 42, objectFit: 'contain' }} />
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
    </div>
  );
};

export const LootBackpackWindow = ({ enemyId, onClose }: { enemyId: number | string; onClose: () => void }) => {
  const enemy = useCombatGridStore((s) => s.enemies.find((e: any) => e.id === enemyId));
  const pack = usePlayerStore((s) => s.equipment.backpack);
  const packContents = usePlayerStore((s) => s.backpackContents);
  const { playClick, playSound } = useSound();
  const [tip, setTip] = useState<{ item: Item; x: number; y: number } | null>(null);
  // Хинт над скрытой ячейкой: hover работает и там, учит механике обыска.
  const [hint, setHint] = useState<{ x: number; y: number } | null>(null);
  // Идёт обыск ячеек (флаг держится 1с, потом ячейка открывается навсегда).
  const [searching, setSearching] = useState<Record<string, boolean>>({});
  const timers = useRef<number[]>([]);
  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); }, []);

  const packSlots = backpackSlotsFor(pack);
  const loot: any[] = (enemy?.loot ?? []).slice(0, CORPSE_SLOTS);

  const refreshEnemyLoot = (newLoot: any[]) => {
    useCombatGridStore.setState((s: any) => ({
      enemies: s.enemies.map((e: any) => (e.id === enemyId ? { ...e, loot: newLoot } : e)),
    }));
  };

  const say = (msg: string) => useCombatGridStore.getState().addMessage(msg);

  // Обыск скрытой ячейки: 1с — и содержимое видно навсегда (флаг на предмете).
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

  // Труп -> свой рюкзак (только открытое).
  const takeFromCorpse = (itemId: string) => {
    const item = loot.find((i: any) => i.id === itemId);
    if (!item) return;
    if (!(item as any).revealed) { say('🔍 Сначала обыщи ячейку!'); return; }
    if (!pack) { say('❌ Нет рюкзака!'); return; }
    const { contents, moved, leftoverQty } = tryInsertInto(packContents, packSlots, item);
    if (!moved) { say('❌ Свой рюкзак полон! Освободи место.'); return; }
    const rest = loot.filter((i: any) => i.id !== itemId);
    if (leftoverQty > 0) rest.push({ ...item, quantity: leftoverQty });
    refreshEnemyLoot(rest);
    usePlayerStore.setState({ backpackContents: contents });
    playSound('laying-out-a-travel-mat', 0.5);
  };

  // Свой рюкзак -> труп (освободить место свопом).
  const putToCorpse = (itemId: string) => {
    if (loot.length >= CORPSE_SLOTS) { say('❌ Рюкзак трупа полон!'); return; }
    const ps = usePlayerStore.getState();
    const idx = ps.backpackContents.findIndex((i) => i.id === itemId);
    if (idx === -1) return;
    const item = ps.backpackContents[idx];
    refreshEnemyLoot([...loot, item]);
    usePlayerStore.setState({ backpackContents: ps.backpackContents.filter((_, i) => i !== idx) });
    playSound('laying-out-a-travel-mat', 0.5);
  };

  // Drop на ячейку трупа: принимаем только из своего рюкзака.
  const onCorpseDrop = (rawId: string) => {
    if (!rawId.startsWith('pack:')) return;
    putToCorpse(rawId.slice(5));
  };

  // Drop на ячейку своего рюкзака: принимаем только с трупа.
  const onPackDrop = (rawId: string) => {
    if (!rawId.startsWith('corpse:')) return;
    takeFromCorpse(rawId.slice(7));
  };

  const takeAll = () => {
    // Сначала открываем всё скрытое, потом забираем.
    let cur = loot.map((i: any) => ({ ...i, revealed: true }));
    let movedAny = false;
    for (const item of [...cur]) {
      if (!pack) { say('❌ Нет рюкзака!'); return; }
      const { contents, moved, leftoverQty } = tryInsertInto(usePlayerStore.getState().backpackContents, packSlots, item);
      if (!moved) break;
      cur = cur.filter((i: any) => i.id !== item.id);
      if (leftoverQty > 0) cur.push({ ...item, quantity: leftoverQty });
      usePlayerStore.setState({ backpackContents: contents });
      movedAny = true;
    }
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

  return (
    <div className={styles.lootOverlay} onClick={onClose}>
      <div className={styles.lootWindow} onClick={(e) => e.stopPropagation()} style={{ minWidth: 640, overflow: 'hidden', borderRadius: 8, paddingTop: 0, marginTop: -50 }}>
        <WapHeader title="🎒 Обыск" glow="amber" onMouseDown={() => {}}
          style={{ background: 'linear-gradient(180deg, rgb(217,119,6), rgb(146,64,14))', margin: '0 -20px 12px', width: 'calc(100% + 40px)' }}>
          <span onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ cursor: 'pointer', fontSize: 14, color: 'white', padding: '0 4px' }}>✕</span>
        </WapHeader>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>
          Тяни к себе · лишнее — обратно трупу · двойной клик — взять · скрытое — клик обыскать (1с)
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          {/* СЛЕВА: наш герой и наш рюкзак */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <img src={images.hero} alt="hero" draggable={false} style={{ width: 44, height: 44, objectFit: 'contain' }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                🎒 Мой рюкзак ({packContents.length}/{packSlots})
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 5 * (cellPx + 4) }}>
              {Array.from({ length: Math.max(packSlots, 1) }).map((_, i) => {
                const item = packContents[i] ?? null;
                return (
                  <Cell
                    key={item ? item.id : `p-empty-${i}`}
                    item={item}
                    onDrop={onPackDrop}
                    onDragStart={(id, e) => { e.dataTransfer.setData('text/plain', `pack:${id}`); }}
                    onDoubleClick={() => {}}
                    onHover={item ? showTip(item) : () => {}}
                    onMove={moveTip}
                    onLeave={() => setTip(null)}
                  />
                );
              })}
            </div>
          </div>
          {/* СПРАВА: враг и его рюкзак */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              {enemyImg && <img src={enemyImg} alt={enemy.name} draggable={false} style={{ width: 44, height: 44, objectFit: 'contain' }} />}
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                {enemy.name} ({loot.length}/{CORPSE_SLOTS}){hiddenCount > 0 && ` · скрыто: ${hiddenCount}`}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(5, ${cellPx}px)`, gap: 4, marginBottom: 10, justifyContent: 'start' }}>
              {Array.from({ length: CORPSE_SLOTS }).map((_, i) => {
                const item = loot[i] ?? null;
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
                    }}
                    onDoubleClick={() => { if (item) takeFromCorpse(item.id); }}
                    onHover={item ? (isHidden ? showHint : showTip(item)) : () => {}}
                    onMove={item ? (isHidden ? moveHint : moveTip) : () => {}}
                    onLeave={() => { setTip(null); setHint(null); }}
                  />
                );
              })}
            </div>
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
