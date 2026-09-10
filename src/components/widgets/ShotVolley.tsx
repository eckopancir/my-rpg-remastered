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

  const fx = (shot.from.x / 31) * 100;
  const fy = (shot.from.y / 31) * 100;

  const bullets = useMemo<BulletSpec[]>(() => {
    if (kind === 'heal') return [];
    const count = Math.max(1, Math.min(8, shot.count ?? 1));
    const dx = shot.to.x - shot.from.x;
    const dy = shot.to.y - shot.from.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const baseA = (Math.atan2(dy, dx) * 180) / Math.PI;
    const baseFlight = Math.min(600, Math.max(150, dist * 28 + 120)) * (kind === 'single' && power >= 1.3 ? 0.7 : 1);
    const list: BulletSpec[] = [];
    for (let i = 0; i < count; i++) {
      let ang = baseA;
      let delay = 0;
      if (kind === 'spread') {
        ang = baseA + [-24, -12, 0, 12, 24][i % 5];
        delay = i * 25;
      } else if (kind === 'burst') {
        delay = i * 80;
      } else if (kind === 'boss') {
        ang = baseA + (Math.random() * 16 - 8);
        delay = i * 70;
      }
      const rad = (ang * Math.PI) / 180;
      const tx = kind === 'spread' || kind === 'boss'
        ? shot.from.x + Math.cos(rad) * dist
        : shot.to.x;
      const ty = kind === 'spread' || kind === 'boss'
        ? shot.from.y + Math.sin(rad) * dist
        : shot.to.y;
      list.push({
        key: i,
        fromX: fx,
        fromY: fy,
        toX: (tx / 31) * 100,
        toY: (ty / 31) * 100,
        rot: ang + 90,
        delay,
        flight: baseFlight,
        size: 30 * power * (kind === 'boss' ? 1.3 : 1),
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

  const muzzleSize = (kind === 'heal' ? 40 : 46) * power;
  const mRot = kind === 'heal' ? 0 : (Math.atan2(shot.to.y - shot.from.y, shot.to.x - shot.from.x) * 180) / Math.PI + 90;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 40 }}>
      {/* Вспышка: у дула стрелка; хил — зелёная на цели */}
      {images.muzzle && (
        <div style={{ position: 'absolute', left: `${kind === 'heal' ? (shot.to.x / 31) * 100 : fx}%`, top: `${kind === 'heal' ? (shot.to.y / 31) * 100 : fy}%`, width: 0, height: 0 }}>
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
