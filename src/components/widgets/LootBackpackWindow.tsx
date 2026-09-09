import { useState } from 'react';
import { useCombatGridStore } from '../../stores/combatGridStore';
import { usePlayerStore } from '../../stores/playerStore';
import { useSound } from '../../hooks/useSound';
import { getItemImage } from '../../assets/index';
import { getConsumableIcon } from '../../data/consumables';
import { AMMO_GROUP_MAP, type AmmoGroup } from '../../data/ammo';
import { backpackSlotsFor, tryInsertInto } from '../../data/backpacks';
import { ItemTooltip } from './ItemTooltip';
import { WapHeader } from '../ui/WapHeader';
import type { Item } from '../../types/items';
import styles from './BattleGrid.module.css';

const CORPSE_SLOTS = 6;
const cellPx = 52;

const iconFor = (item: any): string | null => {
  if (item.image) return null;
  if (item.type === 'consumable') return getConsumableIcon(item);
  if (item.type === 'backpack') return '🎒';
  if (item.type === 'bullet') return AMMO_GROUP_MAP[(item.ammoGroup as AmmoGroup) ?? 'rifle']?.icon ?? '🔸';
  if (item.type === 'chest') return null;
  return null;
};

const Cell = ({ item, onDrop, onDragStart, onDoubleClick, onHover, onMove, onLeave }: {
  item: any | null;
  onDrop: (itemId: string) => void;
  onDragStart: (id: string, e: React.DragEvent) => void;
  onDoubleClick: () => void;
  onHover: (e: React.MouseEvent) => void;
  onMove: (e: React.MouseEvent) => void;
  onLeave: () => void;
}) => {
  const emoji = item ? iconFor(item) : null;
  const url = item && !emoji ? (item.image || getItemImage(item.name, item.displayName)) : undefined;
  return (
    <div
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const id = e.dataTransfer.getData('text/plain'); if (id) onDrop(id); }}
      onDragOver={(e) => e.preventDefault()}
      onDoubleClick={onDoubleClick}
      onMouseEnter={onHover}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{
        width: cellPx, height: cellPx, background: '#0f0f15',
        border: `1px solid ${item?.qualityColor || 'rgba(255,255,255,0.1)'}`,
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
  const { playClick } = useSound();
  const [tip, setTip] = useState<{ item: Item; x: number; y: number } | null>(null);

  const packSlots = backpackSlotsFor(pack);
  const loot: any[] = (enemy?.loot ?? []).slice(0, CORPSE_SLOTS);

  const refreshEnemyLoot = (newLoot: any[]) => {
    useCombatGridStore.setState((s: any) => ({
      enemies: s.enemies.map((e: any) => (e.id === enemyId ? { ...e, loot: newLoot } : e)),
    }));
  };

  const say = (msg: string) => useCombatGridStore.getState().addMessage(msg);

  // Труп -> свой рюкзак.
  const takeFromCorpse = (itemId: string) => {
    const item = loot.find((i: any) => i.id === itemId);
    if (!item) return;
    if (!pack) { say('❌ Нет рюкзака!'); return; }
    const { contents, moved, leftoverQty } = tryInsertInto(packContents, packSlots, item);
    if (!moved) { say('❌ Свой рюкзак полон! Освободи место.'); return; }
    const rest = loot.filter((i: any) => i.id !== itemId);
    if (leftoverQty > 0) rest.push({ ...item, quantity: leftoverQty });
    refreshEnemyLoot(rest);
    usePlayerStore.setState({ backpackContents: contents });
    playClick();
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
    playClick();
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
    let cur = [...loot];
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
    if (movedAny) playClick();
    else say('❌ Свой рюкзак полон! Освободи место.');
  };

  if (!enemy) return null;

  const showTip = (item: any) => (e: React.MouseEvent) => setTip({ item, x: e.clientX, y: e.clientY });
  const moveTip = (e: React.MouseEvent) => setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t));

  return (
    <div className={styles.lootOverlay} onClick={onClose}>
      <div className={styles.lootWindow} onClick={(e) => e.stopPropagation()} style={{ minWidth: 420, overflow: 'hidden', borderRadius: 8, paddingTop: 0 }}>
        <WapHeader title={`🎒 ${enemy.name} — рюкзак трупа (${loot.length}/${CORPSE_SLOTS})`} glow="amber" onMouseDown={() => {}}
          style={{ background: 'linear-gradient(180deg, rgb(217,119,6), rgb(146,64,14))', margin: '0 -20px 12px', width: 'calc(100% + 40px)' }}>
          <span onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ cursor: 'pointer', fontSize: 14, color: 'white', padding: '0 4px' }}>✕</span>
        </WapHeader>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
          Тяни к себе · лишнее — обратно трупу · двойной клик — взять
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
          {Array.from({ length: CORPSE_SLOTS }).map((_, i) => {
            const item = loot[i] ?? null;
            return (
              <Cell
                key={item ? item.id : `c-empty-${i}`}
                item={item}
                onDrop={onCorpseDrop}
                onDragStart={(id, e) => { e.dataTransfer.setData('text/plain', `corpse:${id}`); }}
                onDoubleClick={() => { if (item) takeFromCorpse(item.id); }}
                onHover={item ? showTip(item) : () => {}}
                onMove={moveTip}
                onLeave={() => setTip(null)}
              />
            );
          })}
        </div>
        <div className={styles.lootHeader} style={{ marginTop: 4 }}>
          🎒 Мой рюкзак ({packContents.length}/{packSlots})
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6, maxWidth: 5 * (cellPx + 4) }}>
          {packContents.length === 0 && <div className={styles.lootEmpty}>Пусто</div>}
          {packContents.map((item: any) => (
            <Cell
              key={item.id}
              item={item}
              onDrop={onPackDrop}
              onDragStart={(id, e) => { e.dataTransfer.setData('text/plain', `pack:${id}`); }}
              onDoubleClick={() => {}}
              onHover={showTip(item)}
              onMove={moveTip}
              onLeave={() => setTip(null)}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <div
            className={styles.lootTakeBtn}
            style={{ flex: 1, textAlign: 'center', padding: '6px' }}
            onClick={takeAll}
          >
            ЗАБРАТЬ ВСЁ
          </div>
          <div className={styles.lootCloseBtn} onClick={onClose}>ЗАКРЫТЬ</div>
        </div>
        {tip && <ItemTooltip item={tip.item} x={tip.x} y={tip.y} />}
      </div>
    </div>
  );
};
