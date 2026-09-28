import { useEffect, useRef } from 'react';
import { useCombatGridStore } from '../../stores/combatGridStore';
import { useUiStore } from '../../stores/uiStore';
import { playRainLoop, stopRainLoop } from '../../hooks/useSound';

const DROPS = 330;
const SPLASH_MAX = 60;

/** Дождь поверх арены: canvas-штрихи + всплески. Звук — playLoopSound('rain'), файл зальёшь позже. */
export const RainOverlay = () => {
  const isRaining = useCombatGridStore((s) => s.isRaining);
  const isActive = useCombatGridStore((s) => s.isActive);
  const isNightTime = useCombatGridStore((s) => s.isNightTime);
  const forceDay = useUiStore((s) => s.forceDay);
  const ref = useRef<HTMLCanvasElement>(null);
  // Ночью дождя нет — только сверчки.
  const on = isRaining && isActive && !(isNightTime && !forceDay);

  // Звук дождя: первый проход с начала, дальше с 1:20.
  useEffect(() => {
    if (!on) return;
    try { playRainLoop(0.25); } catch { /* ignore */ }
    return () => { try { stopRainLoop(); } catch { /* ignore */ } };
  }, [on]);

  useEffect(() => {
    if (!on) return;
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
    interface Drop { x: number; y: number; len: number; sp: number; o: number }
    interface Splash { x: number; y: number; t: number }
    const drops: Drop[] = Array.from({ length: DROPS }, () => ({
      x: Math.random(), y: Math.random(),
      len: 10 + Math.random() * 14, sp: 0.9 + Math.random() * 0.7,
      o: 0.14 + Math.random() * 0.26,
    }));
    const splashes: Splash[] = [];
    let last = performance.now();
    const WIND = -0.16;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) { last = now; return; }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      // Капли-штрихи с ветром влево.
      for (const d of drops) {
        const vy = d.sp * h * 1.1 * dt;
        const vx = vy * WIND;
        const x0 = d.x * w;
        const y0 = d.y * h;
        ctx.strokeStyle = `rgba(174,194,224,${d.o.toFixed(2)})`;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + vx * d.len * 0.09, y0 + d.len);
        ctx.stroke();
        d.y += (vy / h);
        d.x += vx / Math.max(1, w);
        if (d.y > 1.02) {
          d.y = -0.02;
          d.x = Math.random() * 1.1;
        }
        if (d.x < -0.05) d.x = 1.02;
      }
      // Всплески: пара новых за кадр, живут 300мс.
      for (let i = 0; i < 2 && splashes.length < SPLASH_MAX; i++) {
        if (Math.random() < 0.6) splashes.push({ x: Math.random() * w, y: Math.random() * h, t: 0 });
      }
      for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i];
        s.t += dt;
        const k = s.t / 0.3;
        if (k >= 1) { splashes.splice(i, 1); continue; }
        ctx.strokeStyle = `rgba(174,194,224,${(0.35 * (1 - k)).toFixed(2)})`;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, 2 + k * 5, 1 + k * 2.5, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [on]);

  if (!on) return null;
  return (
    <canvas
      ref={ref}
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 950,
      }}
    />
  );
};
