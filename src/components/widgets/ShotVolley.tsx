import { useEffect, useMemo, useState } from 'react';
import { images } from '../../assets/index';
import type { ShotLine, ShotKind } from '../../stores/combatGridStore';
import styles from './BattleGrid.module.css';

interface BulletSpec {
  key: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  rot: number;
  delay: number;
  flight: number;
  size: number;
  filter: string;
}

const KIND_TINT: Record<string, string> = {
  single: 'none',
  burst: 'saturate(1.35) brightness(1.05)',
  spread: 'saturate(1.6) brightness(1.15)',
  boss: 'hue-rotate(-35deg) saturate(2.2) brightness(1.1)',
};

/** Залп: вспышка у дула + летящие пули. Живёт сам: гаснет по таймеру. */
export const ShotVolley = ({ shot }: { shot: ShotLine }) => {
  const kind: ShotKind = shot.kind ?? (shot.type === 'heal' ? 'heal' : 'single');
  const power = shot.power ?? (shot.type === 'bazooka' ? 1.8 : shot.type === 'aim' ? 1.5 : 1);
  const [go, setGo] = useState(false);
  const [done, setDone] = useState(false);

  // Укороченная трасса: старт от дула (не из центра стрелка),
  // финиш у края цели (не насквозь). Отступ ~0.45 клетки с каждой стороны.
  const seg = useMemo(() => {
    const dx = shot.to.x - shot.from.x;
    const dy = shot.to.y - shot.from.y;
    const len = Math.max(0.001, Math.hypot(dx, dy));
    const ux = dx / len;
    const uy = dy / len;
    return {
      sx: shot.from.x + ux * 0.45,
      sy: shot.from.y + uy * 0.45,
      ex: shot.to.x - ux * 0.45,
      ey: shot.to.y - uy * 0.45,
      ux,
      uy,
      len,
    };
  }, [shot]);

  const bullets = useMemo<BulletSpec[]>(() => {
    if (kind === 'heal') return [];
    const count = Math.max(1, Math.min(8, shot.count ?? 1));
    const dist = Math.max(0.5, seg.len - 0.9);
    const baseA = (Math.atan2(seg.uy, seg.ux) * 180) / Math.PI;
    const baseFlight = Math.min(600, Math.max(150, dist * 28 + 120)) * (kind === 'single' && power >= 1.3 ? 0.7 : 1) * (shot.fast ? 0.45 : 1);
    const list: BulletSpec[] = [];
    for (let i = 0; i < count; i++) {
      let ang = baseA;
      let delay = 0;
      if (kind === 'spread') {
        ang = baseA + [-30, -15, 0, 15, 30][i % 5];
        delay = i * 25;
      } else if (kind === 'burst') {
        delay = i * 80;
      } else if (kind === 'boss') {
        ang = baseA + (Math.random() * 16 - 8);
        delay = i * 70;
      }
      const rad = (ang * Math.PI) / 180;
      // Веер/ливень расходятся от дула, одиночные летят в усечённую точку.
      const tx = kind === 'single' ? seg.ex : seg.sx + Math.cos(rad) * dist;
      const ty = kind === 'single' ? seg.ey : seg.sy + Math.sin(rad) * dist;
      list.push({
        key: i,
        fromX: (seg.sx / 31) * 100,
        fromY: (seg.sy / 31) * 100,
        toX: (tx / 31) * 100,
        toY: (ty / 31) * 100,
        rot: ang + 90,
        delay,
        flight: baseFlight,
        size: 18 * power * (kind === 'boss' ? 1.3 : 1),
        filter: KIND_TINT[kind] || 'none',
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot]);

  const maxTime = useMemo(
    () => bullets.reduce((m, b) => Math.max(m, b.delay + b.flight), 200) + 200,
    [bullets],
  );

  useEffect(() => {
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setGo(true)));
    const t = setTimeout(() => setDone(true), maxTime);
    return () => {
      cancelAnimationFrame(r);
      clearTimeout(t);
    };
  }, [maxTime]);

  if (done) return null;

  const muzzleSize = (kind === 'heal' ? 24 : 28) * power;
  const mRot = kind === 'heal' ? 0 : (Math.atan2(seg.uy, seg.ux) * 180) / Math.PI + 90;
  const mzx = (kind === 'heal' ? shot.to.x : seg.sx) / 31 * 100;
  const mzy = (kind === 'heal' ? shot.to.y : seg.sy) / 31 * 100;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 40 }}>
      {/* Бластерная синяя линия для прицельных (тип aim) — под пулями */}
      {shot.type === 'aim' && (
        <svg className={styles.shotSvg}>
          <line
            x1={`${(shot.from.x / 31) * 100}%`}
            y1={`${(shot.from.y / 31) * 100}%`}
            x2={`${(shot.to.x / 31) * 100}%`}
            y2={`${(shot.to.y / 31) * 100}%`}
            className={`${styles.tracerLine} ${styles.aimShot}`}
          />
        </svg>
      )}
      {/* Вспышка: у дула стрелка; хил — зелёная на цели */}
      {images.muzzle && (
        <div style={{ position: 'absolute', left: `${mzx}%`, top: `${mzy}%`, width: 0, height: 0 }}>
          <img
            src={images.muzzle}
            alt=""
            draggable={false}
            className={styles.muzzleFlash}
            style={{
              width: muzzleSize,
              height: muzzleSize,
              objectFit: 'contain',
              transform: `translate(-50%,-100%) rotate(${mRot}deg)`,
              transformOrigin: '50% 100%',
              filter: kind === 'heal' ? 'hue-rotate(95deg) saturate(1.8)' : kind === 'boss' ? 'hue-rotate(-25deg) saturate(1.8)' : 'none',
            }}
          />
        </div>
      )}
      {/* Пули */}
      {images.bullet && bullets.map((b) => (
        <div
          key={b.key}
          style={{
            position: 'absolute',
            left: `${go ? b.toX : b.fromX}%`,
            top: `${go ? b.toY : b.fromY}%`,
            width: 0,
            height: 0,
            transition: `left ${b.flight}ms linear ${b.delay}ms, top ${b.flight}ms linear ${b.delay}ms`,
          }}
        >
          <img
            src={images.bullet as string}
            alt=""
            draggable={false}
            style={{
              width: b.size,
              height: b.size,
              objectFit: 'contain',
              transform: `translate(-50%,-50%) rotate(${b.rot}deg)`,
              filter: b.filter,
            }}
          />
        </div>
      ))}
    </div>
  );
};
