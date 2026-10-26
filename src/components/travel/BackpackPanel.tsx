import { useEffect, useMemo, useState } from 'react';
import { usePlayerStore, isExpeditionRunning } from '../../stores/playerStore';
import { gridSlots, freeBigSlots, removeItemFromGrid } from '../../data/backpacks';
import { getItemImage } from '../../assets/index';
import { chestImageFor } from '../../data/chests';
import { ItemTooltip } from '../widgets/ItemTooltip';
import type { Item } from '../../types/items';
import styles from './travel.module.css';

const CELL = 44;
const GAP = 4;

/** Картинка предмета (как в тултипе): своё поле → сундук → lookup по имени. */
const imageOf = (item: any): string | undefined =>
  item.image
  || (item.type === 'chest' ? chestImageFor(item.quality || item.rarity || 'Обычный') : undefined)
  || getItemImage(item.name, item.displayName, item.slot, item.type);

/**
 * Панель «Рюкзак» — что внутри рюкзака игрока во время рейда.
 * Показывает сетку слотов, крупные вещи (2×2) и тултипы предметов.
 * ПКМ по предмету — контекстное меню: Использовать / Вернуть в инвентарь /
 * Выбросить. В активном рейде склад закрыт, поэтому «Вернуть в инвентарь»
 * заблокирован (store-гард takeOutBackpack тоже дублирует это).
 */
export const BackpackPanel = () => {
  const grid = usePlayerStore((s) => s.backpackGrid);
  const discardFromBackpack = usePlayerStore((s) => s.discardFromBackpack);
  const inTravel = isExpeditionRunning();
  const [tip, setTip] = useState<Item | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; item: Item } | null>(null);

  const slots = gridSlots(grid);
  const cols = grid.w || 5;
  const rows = Math.max(1, Math.ceil(slots / cols));

  const { occupied, covered, bigFree } = useMemo(() => {
    let occ = 0;
    const coveredSet = new Set<string>();
    (grid.cells ?? []).forEach((row, y) => {
      row.forEach((c, x) => {
        if (c) {
          occ++;
          coveredSet.add(`${x}_${y}`);
        }
      });
    });
    return { occupied: occ, covered: coveredSet, bigFree: freeBigSlots(grid) };
  }, [grid]);

  const items = grid.items ?? [];
  const free = Math.max(0, slots - occupied);

  const onEnter = (item: Item, e: React.MouseEvent) => {
    setTip(item);
    setPos({ x: e.clientX, y: e.clientY });
  };

  // Закрытие меню: клик мимо, повторный ПКМ, Escape.
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') close(); };
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [ctxMenu]);

  return (
    <div className={styles.bagBox}>
      <div className={styles.bagHead}>
        <span>🎒 Рюкзак</span>
        <span style={{ color: occupied >= slots ? '#fbbf24' : 'var(--text-secondary)' }}>
          {occupied} / {slots}
        </span>
      </div>

      <div
        className={styles.bagWrap}
        style={{ width: cols * CELL + (cols - 1) * GAP, height: rows * CELL + (rows - 1) * GAP }}
      >
        {/* пустые слоты */}
        {Array.from({ length: rows }).map((_, y) =>
          Array.from({ length: cols }).map((_, x) => {
            const idx = y * cols + x;
            if (idx >= slots) return null;
            if (covered.has(`${x}_${y}`)) return null;
            return <div key={`c${x}_${y}`} className={styles.bagCell} style={{ left: x * (CELL + GAP), top: y * (CELL + GAP), width: CELL, height: CELL }} />;
          }),
        )}

        {/* предметы */}
        {items.map((item: any) => {
          const w = item.gridW ?? 1;
          const h = item.gridH ?? 1;
          const img = imageOf(item);
          const qty = item.quantity ?? 1;
          return (
            <div
              key={item.id}
              className={styles.bagItem}
              style={{
                left: (item.gridX ?? 0) * (CELL + GAP),
                top: (item.gridY ?? 0) * (CELL + GAP),
                width: w * CELL + (w - 1) * GAP,
                height: h * CELL + (h - 1) * GAP,
              }}
              onMouseEnter={(e) => onEnter(item, e)}
              onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setTip(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTip(null);
                setCtxMenu({ x: e.clientX, y: e.clientY, item });
              }}
              title={`${item.displayName || item.name}\nПКМ — меню`}
            >
              {img ? <img className={styles.bagImg} src={img} alt="" /> : <span className={styles.bagIcon}>📦</span>}
              {qty > 1 && <span className={styles.bagQty}>{qty}</span>}
              {w > 1 && h > 1 && <span className={styles.bagSize}>{w}×{h}</span>}
            </div>
          );
        })}
      </div>

      <div className={styles.bagMeta}>
        <span>Свободно: <b>{free}</b></span>
        <span title="Сколько крупных вещей (2×2) ещё влезет">
          2×2 мест: <b style={{ color: bigFree > 0 ? '#4ade80' : '#f87171' }}>{bigFree}</b>
        </span>
      </div>

      {free === 0 && (
        <div className={styles.warnBox}>
          ⚠ Рюкзак полон — находки больше не помещаются и остаются в зоне.
        </div>
      )}

      {tip && <ItemTooltip item={tip} x={pos.x} y={pos.y} />}

      {ctxMenu && (() => {
        const isConsumable = ctxMenu.item.type === 'consumable';
        const menuPos = {
          x: Math.min(ctxMenu.x, window.innerWidth - 180),
          y: Math.min(ctxMenu.y, window.innerHeight - 130),
        };
        return (
          <div
            style={{
              position: 'fixed', left: menuPos.x, top: menuPos.y, zIndex: 9500,
              background: 'linear-gradient(180deg, #1a1a1a 0%, #151515 58%, #23272b 100%)',
              border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, padding: 4, minWidth: 150,
              boxShadow: '0 16px 48px rgba(0,0,0,0.75)',
            }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()}
          >
            {isConsumable && (
              <button onClick={() => {
                const item = ctxMenu.item;
                consumeOne(item);
                setCtxMenu(null);
              }}
                style={{
                  width: '100%', textAlign: 'left', padding: '6px 10px', background: 'transparent', border: 'none',
                  color: '#eee', cursor: 'pointer', fontSize: 13, borderRadius: 4,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >🍖 Использовать</button>
            )}
            {/* В активном рейде склад недоступен: из рюкзака нельзя вернуть
                в инвентарь. Гард продублирован в playerStore.takeOutBackpack. */}
            <button
              onClick={() => {
                if (inTravel) return;
                usePlayerStore.getState().takeOutBackpack(ctxMenu.item.id);
                setCtxMenu(null);
              }}
              disabled={inTravel}
              title={inTravel ? 'Склад доступен только на базе — в рейде остаётся рюкзак' : 'Вернуть предмет в инвентарь'}
              style={{
                width: '100%', textAlign: 'left', padding: '6px 10px', background: 'transparent', border: 'none',
                color: inTravel ? '#666' : '#eee', cursor: inTravel ? 'not-allowed' : 'pointer', fontSize: 13, borderRadius: 4,
              }}
            >{inTravel ? '🔒 В рейде нельзя' : '📤 Вернуть в инвентарь'}</button>
            <button onClick={() => {
              const it = ctxMenu.item;
              setCtxMenu(null);
              if (!window.confirm(`Выбросить «${it.displayName || it.name}»? Он пропадёт безвозвратно.`)) return;
              discardFromBackpack(it.id);
              setTip(null);
            }}
              style={{
                width: '100%', textAlign: 'left', padding: '6px 10px', background: 'transparent', border: 'none',
                color: '#f87171', cursor: 'pointer', fontSize: 13, borderRadius: 4,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(248,113,113,0.15)'; }}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >🗑 Выбросить</button>
          </div>
        );
      })()}
    </div>
  );

  /** Использовать расходник из рюкзака: списывает одну штуку из стака. */
  function consumeOne(item: Item) {
    const cur = usePlayerStore.getState().backpackGrid;
    const qty = (item.quantity ?? 1) as number;
    if (qty <= 1) {
      usePlayerStore.setState({ backpackGrid: removeItemFromGrid(cur, item.id) });
    } else {
      usePlayerStore.setState({ backpackGrid: { ...cur, items: cur.items.map((i) => i.id === item.id ? { ...i, quantity: qty - 1 } : i) } });
    }
    usePlayerStore.getState().useConsumable({ ...item, quantity: 1 });
    usePlayerStore.getState().addLog(`🍖 Использовано: ${item.displayName || item.name}.`, 'heal');
  }
};
