import { useEffect, useRef, useState } from 'react';
import { useCombatGridStore, getDist } from '../../stores/combatGridStore';
import { crowFrames } from '../../assets/index';
import { playCombatSound } from '../../hooks/useSound';

const FLIGHT_MS = 7000;
const EVERY_MS = 10000; // тест: часто. Прод: поднять.
const NEAR_DIST = 6;
/** Координаты клеток -> % (центры, как весь оверлей арены). */
const cellPct = (c: number): number => ((c + 0.5) / 32) * 100;

/** Ворон: раз в 10с летит из угла в угол, у игрока 1 раз кричит. */
export const CrowFlight = () => {
  const isActive = useCombatGridStore((s) => s.isActive);
  const [flight, setFlight] = useState<{ id: number; fx: number; fy: number; tx: number; ty: number } | null>(null);
  const [go, setGo] = useState(false);
  const [flap, setFlap] = useState(0);
  const sounded = useRef(false);
  const posRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!isActive || crowFrames.length === 0) return;
    let alive = true;
    const launch = () => {
      if (!alive) return;
      // Случайная диагональ: из одного угла в противоположный (за краями).
      const corners = [
        { fx: -3, fy: -3, tx: 34, ty: 34 },
        { fx: 34, fy: -3, tx: -3, ty: 34 },
        { fx: -3, fy: 34, tx: 34, ty: -3 },
        { fx: 34, fy: 34, tx: -3, ty: -3 },
      ];
      const c = corners[Math.floor(Math.random() * corners.length)];
      sounded.current = false;
      posRef.current = { x: c.fx, y: c.fy };
      setFlight({ id: Date.now(), ...c });
      setGo(false);
      requestAnimationFrame(() => requestAnimationFrame(() => { if (alive) setGo(true); }));
    };
    launch();
    const every = window.setInterval(launch, EVERY_MS);
    const flapT = window.setInterval(() => setFlap((f) => (f + 1) % Math.max(1, crowFrames.length)), 120);
    // Крик, когда ворон рядом с игроком (1 раз за пролёт).
    const snd = window.setInterval(() => {
      if (sounded.current) return;
      const st = useCombatGridStore.getState();
      if (!st.isActive) return;
      const el = (now: number) => {
        if (!flightRef.current) return;
        const k = Math.min(1, (now - flightRef.current.t0) / FLIGHT_MS);
        return {
          x: flightRef.current.fx + (flightRef.current.tx - flightRef.current.fx) * k,
          y: flightRef.current.fy + (flightRef.current.ty - flightRef.current.fy) * k,
        };
      };
      const p = el(Date.now());
      if (!p) return;
      posRef.current = p;
      if (getDist(p, st.playerPos) <= NEAR_DIST) {
        sounded.current = true;
        try { playCombatSound('crow-screaming-sound-effect-3', 0.5); } catch { /* ignore */ }
      }
    }, 400);
    return () => {
      alive = false;
      window.clearInterval(every);
      window.clearInterval(flapT);
      window.clearInterval(snd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const flightRef = useRef<{ fx: number; fy: number; tx: number; ty: number; t0: number } | null>(null);
  useEffect(() => {
    if (flight) flightRef.current = { ...flight, t0: Date.now() };
  }, [flight]);

  if (!isActive || !flight || crowFrames.length === 0) return null;
  const img = crowFrames[flap % crowFrames.length];
  // Картинка смотрит вправо — доворачиваем по вектору полёта.
  const ang = (Math.atan2(flight.ty - flight.fy, flight.tx - flight.fx) * 180) / Math.PI;
  return (
    <div
      key={flight.id}
      style={{
        position: 'absolute',
        left: `${cellPct(go ? flight.tx : flight.fx)}%`,
        top: `${cellPct(go ? flight.ty : flight.fy)}%`,
        width: '2.6%',
        aspectRatio: '280 / 520',
        transform: 'translate(-50%,-50%)',
        transition: `left ${FLIGHT_MS}ms linear, top ${FLIGHT_MS}ms linear`,
        zIndex: 35,
        pointerEvents: 'none',
      }}
    >
      <img
        src={img}
        alt=""
        draggable={false}
        style={{ width: '100%', height: '100%', objectFit: 'contain', transform: `rotate(${ang}deg)` }}
      />
    </div>
  );
};
