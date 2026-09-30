import { useEffect, useRef } from 'react';
import { useCombatGridStore } from '../../stores/combatGridStore';
import { useUiStore } from '../../stores/uiStore';
import { CAR_IMAGES } from '../../engine/terrain';
import { playBirdLoop, stopBirdLoop, playCricketLoop, stopCricketLoop } from '../../hooks/useSound';

/** Эмбиент карты: дрейф тумана + тени облаков + пыль + светлячки (ночь) + дым и свет костра. */
export const AmbienceOverlay = () => {
  const isActive = useCombatGridStore((s) => s.isActive);
  const isRaining = useCombatGridStore((s) => s.isRaining);
  const isNightTime = useCombatGridStore((s) => s.isNightTime);
  const forceDay = useUiStore((s) => s.forceDay);
  const ref = useRef<HTMLCanvasElement>(null);
  const night = isNightTime && !forceDay;

  // Птицы: фоном без остановки, пока нет дождя и не ночь.
  useEffect(() => {
    if (!isActive || isRaining || night) return;
    try { playBirdLoop(0.2); } catch { /* ignore */ }
    return () => { try { stopBirdLoop(); } catch { /* ignore */ } };
  }, [isActive, isRaining, night]);

  // Сверчки: ночью всегда.
  useEffect(() => {
    if (!isActive || !night) return;
    try { playCricketLoop(0.2); } catch { /* ignore */ }
    return () => { try { stopCricketLoop(); } catch { /* ignore */ } };
  }, [isActive, night]);

  useEffect(() => {
    if (!isActive) return;
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let w = 0;
    let h = 0;
    const resize = () => {
      const p = cv.parentElement;
      if (!p) return;
      w = cv.width = p.clientWidth;
      h = cv.height = p.clientHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (cv.parentElement) ro.observe(cv.parentElement);

    interface Blob { x: number; y: number; r: number; vx: number; vy: number; a: number }
    const fog: Blob[] = Array.from({ length: 4 }, () => ({
      x: Math.random(), y: Math.random(),
      r: 0.3 + Math.random() * 0.3,
      vx: (0.004 + Math.random() * 0.006) * (Math.random() < 0.5 ? 1 : 1),
      vy: (Math.random() - 0.5) * 0.004,
      a: 0.10 + Math.random() * 0.06,
    }));
    const clouds: Blob[] = Array.from({ length: 3 }, () => ({
      x: Math.random(), y: Math.random(),
      r: 0.35 + Math.random() * 0.3,
      vx: 0.008 + Math.random() * 0.008,
      vy: 0,
      a: 0.16 + Math.random() * 0.08,
    }));
    interface Mote { x: number; y: number; s: number; v: number; o: number }
    const dust: Mote[] = Array.from({ length: 70 }, () => ({
      x: Math.random(), y: Math.random(),
      s: 1 + Math.random() * 2, v: 0.02 + Math.random() * 0.04,
      o: 0.18 + Math.random() * 0.3,
    }));
    interface Fly { x: number; y: number; ph: number; sp: number }
    const flies: Fly[] = Array.from({ length: 25 }, () => ({
      x: Math.random(), y: Math.random(),
      ph: Math.random() * Math.PI * 2, sp: 0.5 + Math.random(),
    }));
    interface Puff { x: number; y: number; r: number; t: number }
    const smoke: Puff[] = [];

    let last = performance.now();
    let smokeAcc = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) { last = now; return; }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const st = useCombatGridStore.getState();
      if (!st.isActive) return;
      const t = now / 1000;
      ctx.clearRect(0, 0, w, h);
      const night = st.isNightTime && !useUiStore.getState().forceDay;

      // Тени облаков (под всем).
      for (const c of clouds) {
        c.x += c.vx * dt;
        if (c.x - c.r > 1) c.x = -c.r;
        const g = ctx.createRadialGradient(c.x * w, c.y * h, 0, c.x * w, c.y * h, c.r * w);
        g.addColorStop(0, `rgba(5,8,12,${c.a})`);
        g.addColorStop(1, 'rgba(5,8,12,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      // Дрейф тумана.
      for (const f of fog) {
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        if (f.x - f.r > 1) f.x = -f.r;
        if (f.y - f.r > 1) f.y = -f.r;
        if (f.y + f.r < 0) f.y = 1 + f.r;
        const g = ctx.createRadialGradient(f.x * w, f.y * h, 0, f.x * w, f.y * h, f.r * w);
        g.addColorStop(0, `rgba(180,200,220,${f.a})`);
        g.addColorStop(1, 'rgba(180,200,220,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      // Пыль/листва по ветру.
      ctx.fillStyle = '#cbb98a';
      for (const d of dust) {
        d.x += d.v * dt * 0.6;
        d.y += Math.sin(t * 0.8 + d.x * 10) * 0.0004;
        if (d.x > 1.02) { d.x = -0.02; d.y = Math.random(); }
        ctx.globalAlpha = d.o;
        ctx.fillRect(d.x * w, d.y * h, d.s, d.s);
      }
      ctx.globalAlpha = 1;
      // Светлячки ночью.
      if (night) {
        for (const f of flies) {
          const tw = 0.5 + 0.5 * Math.sin(t * 2 * f.sp + f.ph);
          if (tw < 0.55) continue;
          ctx.fillStyle = `rgba(190,255,140,${(0.75 * tw).toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(f.x * w, f.y * h, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // Костёр: пульс света + дымок. Ночью свет намного ярче (реализм).
      // Сквозь туман войны не горит — только разведанные клетки.
      const cf = (st as any).campfire as { x: number; y: number } | undefined;
      const cfSeen = cf && (st as any).exploredCells && (st as any).exploredCells[`${cf.x},${cf.y}`];
      if (cf && cfSeen) {
        const cx = ((cf.x + 0.5) / 32) * w;
        const cy = ((cf.y + 0.5) / 32) * h;
        const nightBoost = night ? 1.5 : 1;
        const pulse = 0.5 + 0.5 * Math.sin(t * 3.1) * 0.5 + 0.5 * Math.sin(t * 7.3) * 0.2;
        const R = Math.min(w, h) * (0.10 + 0.02 * pulse) * nightBoost;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
        g.addColorStop(0, `rgba(255,150,50,${Math.min(night ? 0.35 : 0.38, (0.28 + 0.1 * pulse) * nightBoost).toFixed(2)})`);
        g.addColorStop(1, 'rgba(255,150,50,0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      }
      // Дым: костёр (если виден) + сгоревший вертолёт o33 (дыма в 2 раза больше).
      {
        const emitters: { x: number; y: number; rate: number }[] = [];
        if (cf && cfSeen) emitters.push({ x: ((cf.x + 0.5) / 32) * w, y: ((cf.y + 0.5) / 32) * h, rate: 1 });
        for (const o of (st as any).obstacles || []) {
          if (o.icon === 'car' && CAR_IMAGES[o.imgIndex] === 'o33') {
            emitters.push({ x: ((o.x + (o.w ?? 1) / 2) / 32) * w, y: ((o.y + (o.h ?? 1) / 2) / 32) * h, rate: 2 });
          }
        }
        smokeAcc += dt;
        while (smokeAcc > 0.12 && smoke.length < 30 && emitters.length > 0) {
          smokeAcc -= 0.12;
          const e = emitters[Math.floor(Math.random() * emitters.length)];
          for (let k = 0; k < e.rate; k++) {
            if (smoke.length >= 30) break;
            smoke.push({ x: e.x + (Math.random() - 0.5) * 8, y: e.y - 6, r: 2, t: 0 });
          }
        }
      }
      for (let i = smoke.length - 1; i >= 0; i--) {
        const p = smoke[i];
        p.t += dt;
        const k = p.t / 2.2;
        if (k >= 1) { smoke.splice(i, 1); continue; }
        p.y -= dt * 22;
        p.x += Math.sin(t * 2 + p.t * 3) * dt * 6;
        ctx.fillStyle = `rgba(150,150,155,${(0.22 * (1 - k)).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + k * 7, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [isActive]);

  if (!isActive) return null;
  return (
    <canvas
      ref={ref}
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 940,
      }}
    />
  );
};
