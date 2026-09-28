import { useEffect, useState } from 'react';
import { useCombatGridStore } from '../../stores/combatGridStore';
import { crowFrames } from '../../assets/index';

const EVERY_MS = 45000;

/** Стая вдали: те же кадры ворона, вдвое меньше, без звука, редкий пролёт. */
export const BirdFlock = () => {
  const isActive = useCombatGridStore((s) => s.isActive);
  const [flight, setFlight] = useState<{ id: number; fy: number; left: boolean } | null>(null);
  const [go, setGo] = useState(false);
  const [flap, setFlap] = useState(0);

  useEffect(() => {
    if (!isActive || crowFrames.length === 0) return;
    let alive = true;
    const launch = () => {
      if (!alive) return;
      // Высоко: верхняя треть карты, слева направо или обратно.
      const left = Math.random() < 0.5;
      setFlight({ id: Date.now(), fy: 4 + Math.random() * 6, left });
      setGo(false);
      requestAnimationFrame(() => requestAnimationFrame(() => { if (alive) setGo(true); }));
    };
    if (Math.random() < 0.5) launch();
    const every = window.setInterval(() => { if (Math.random() < 0.6) launch(); }, EVERY_MS);
    const flapT = window.setInterval(() => setFlap((f) => (f + 1) % Math.max(1, crowFrames.length)), 140);
    return () => { alive = false; window.clearInterval(every); window.clearInterval(flapT); };
  }, [isActive]);

  if (!isActive || !flight || crowFrames.length === 0) return null;
  const from = flight.left ? -6 : 37;
  const to = flight.left ? 37 : -6;
  // Клин 1-2-3: вожак + два ряда позади (px от точки стаи, зеркалится по направлению).
  const back = flight.left ? -1 : 1;
  const wedge = [
    { dx: 0, dy: 0 },
    { dx: 55 * back, dy: -20 }, { dx: 55 * back, dy: 20 },
    { dx: 110 * back, dy: -40 }, { dx: 110 * back, dy: 0 }, { dx: 110 * back, dy: 40 },
  ];
  return (
    <div
      key={flight.id}
      style={{
        position: 'absolute',
        left: `${(((go ? to : from) + 0.5) / 32) * 100}%`,
        top: `${((flight.fy + 0.5) / 32) * 100}%`,
        width: 0, height: 0,
        transition: 'left 14s linear',
        zIndex: 36,
        pointerEvents: 'none',
        opacity: 0.9,
      }}
    >
      {wedge.map((o, i) => (
        <img
          key={i}
          src={crowFrames[(flap + i) % crowFrames.length]}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            left: o.dx, top: o.dy,
            width: 26, height: 48, objectFit: 'contain',
            transform: `translate(-50%,-50%) ${flight.left ? 'none' : 'scaleX(-1)'}`,
          }}
        />
      ))}
    </div>
  );
};
