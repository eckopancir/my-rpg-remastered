import { useMemo, useState } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import { gridSlots, freeBigSlots } from '../../data/backpacks';
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
 */
export const BackpackPanel = () => {
  const grid = usePlayerStore((s) => s.backpackGrid);
  const discardFromBackpack = usePlayerStore((s) => s.discardFromBackpack);
  const [tip, setTip] = useState<Item | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

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
                if (!window.confirm(`Выбросить «${item.displayName || item.name}»? Он пропадёт безвозвратно.`)) return;
                discardFromBackpack(item.id);
                setTip(null);
              }}
              title={`${item.displayName || item.name}\nПКМ — выбросить`}
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
    </div>
  );
};
