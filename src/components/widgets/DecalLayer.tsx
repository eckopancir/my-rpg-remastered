import { useEffect, useRef, useState } from 'react';
import { useCombatGridStore } from '../../stores/combatGridStore';
import { getBattleImage } from '../../assets/index';

const S = 1024;
const CELL = S / 32;

/** Кэш картинок штампов (модульный — пережил перерисовки). */
const imgCache = new Map<string, HTMLImageElement | null>();
const tmp = document.createElement('canvas');
const tmpCtx = tmp.getContext('2d', { willReadFrequently: true });

const loadImg = (src: string, onDone: () => void): HTMLImageElement | null => {
  if (imgCache.has(src)) return imgCache.get(src) || null;
  imgCache.set(src, null);
  const im = new Image();
  im.onload = () => { imgCache.set(src, im); onDone(); };
  im.onerror = () => { imgCache.set(src, null); };
  im.src = src;
  return null;
};

/**
 * Слой земли кисти-ручки: все штампы «сварены» в единое пятно.
 * Пересечения не темнеют: композитинг по максимуму альфы (max-union),
 * а не source-over. Перерисовка только при правке (rAF-коалесцинг).
 */
export const DecalLayer = () => {
  const decals = useCombatGridStore((s) => s.decals);
  const ref = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const cv = ref.current;
      if (!cv || !tmpCtx) return;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.clearRect(0, 0, S, S);
      const out = ctx.getImageData(0, 0, S, S);
      const dd = out.data;
      const list = (decals || []) as any[];
      for (const d of list) {
        const key = d.imgKey;
        if (!key) continue;
        const src = getBattleImage(key);
        if (!src) continue;
        const im = loadImg(src, () => setTick((t) => t + 1));
        if (!im) continue;
        const dia = Math.max(2, (d.size || 1) * CELL);
        const cx = d.x * CELL;
        const cy = d.y * CELL;
        const x0 = Math.max(0, Math.floor(cx - dia / 2));
        const y0 = Math.max(0, Math.floor(cy - dia / 2));
        const x1 = Math.min(S, Math.ceil(cx + dia / 2));
        const y1 = Math.min(S, Math.ceil(cy + dia / 2));
        const w = x1 - x0;
        const h = y1 - y0;
        if (w <= 0 || h <= 0) continue;
        tmp.width = w;
        tmp.height = h;
        tmpCtx.clearRect(0, 0, w, h);
        tmpCtx.drawImage(im, (cx - dia / 2) - x0, (cy - dia / 2) - y0, dia, dia);
        const sd = tmpCtx.getImageData(0, 0, w, h).data;
        for (let j = 0; j < h; j++) {
          const row = (y0 + j) * S + x0;
          for (let i = 0; i < w; i++) {
            const si = ((j * w) + i) * 4;
            const sa = sd[si + 3];
            if (sa === 0) continue;
            const di = (row + i) * 4;
            // Max-union: побеждает более плотный пиксель, шва двойной плотности нет.
            if (sa > dd[di + 3]) {
              dd[di] = sd[si];
              dd[di + 1] = sd[si + 1];
              dd[di + 2] = sd[si + 2];
              dd[di + 3] = sa;
            }
          }
        }
      }
      ctx.putImageData(out, 0, 0);
    });
    return () => cancelAnimationFrame(rafRef.current);
  }, [decals, tick]);

  return (
    <canvas
      ref={ref}
      width={S}
      height={S}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
};
