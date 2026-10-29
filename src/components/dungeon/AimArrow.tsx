import { useEffect, useRef, useState } from 'react';
import styles from './dungeon.module.css';

interface Props {
  /** uid выбранной карты в руке (data-card-uid). */
  sourceUid: string;
  /** Какого рода цель подсвечиваем. */
  kind: 'enemy' | 'merc';
}

interface Point { x: number; y: number }

/**
 * Стрелка от выбранной карты к наведённой цели.
 * Слой fixed + pointer-events: none, поэтому не мешает кликам по полю.
 * Источник ищется по data-атрибуту карты, цель — по data-target-kind.
 */
export const AimArrow = ({ sourceUid, kind }: Props) => {
  const [geom, setGeom] = useState<{ d: string; from: Point; to: Point } | null>(null);
  const mouse = useRef<Point | null>(null);

  useEffect(() => {
    const recompute = () => {
      const src = document.querySelector<HTMLElement>(`[data-card-uid="${sourceUid}"]`);
      if (!src) { setGeom(null); return; }
      const sr = src.getBoundingClientRect();
      const from: Point = { x: sr.left + sr.width / 2, y: sr.top + 10 };

      let to: Point | null = null;
      const m = mouse.current;
      if (m) {
        const hovered = document.elementFromPoint(m.x, m.y)?.closest<HTMLElement>(`[data-target-kind="${kind}"]`);
        if (hovered) {
          const tr = hovered.getBoundingClientRect();
          const cx = tr.left + tr.width / 2;
          const cy = tr.top + tr.height / 2;
          const dx = cx - from.x;
          const dy = cy - from.y;
          const dist = Math.hypot(dx, dy) || 1;
          // Останавливаемся у края карточки, а не в её центре.
          const t = Math.min(1, (Math.min(tr.width, tr.height) * 0.42) / dist);
          to = { x: cx - dx * t, y: cy - dy * t };
        }
      }
      if (!to) {
        to = m ? { x: m.x, y: m.y } : { x: from.x, y: from.y - 70 };
      }

      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.hypot(dx, dy);
      const lift = Math.min(170, Math.max(50, dist * 0.32));
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2 - lift;
      setGeom({
        d: `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${midX.toFixed(1)} ${midY.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`,
        from,
        to,
      });
    };

    const onMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
      recompute();
    };
    const onScroll = () => recompute();

    mouse.current = null;
    recompute();
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [sourceUid, kind]);

  const color = kind === 'enemy' ? '#f87171' : '#7dd3fc';
  const markerId = `aim-head-${kind}`;

  return (
    <svg className={styles.aimArrow} aria-hidden="true">
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
        </marker>
      </defs>
      {geom && (
        <>
          <path
            className={styles.aimPath}
            d={geom.d}
            stroke={color}
            markerEnd={`url(#${markerId})`}
          />
          <circle className={styles.aimDot} cx={geom.from.x} cy={geom.from.y} r={5} fill={color} />
          <circle className={styles.aimDot} cx={geom.to.x} cy={geom.to.y} r={4} fill={color} />
        </>
      )}
    </svg>
  );
};
