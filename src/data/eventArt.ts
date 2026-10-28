/**
 * РђСЂС‚ СЃРѕР±С‹С‚РёР№ СЂРµР№РґР°: 7 Р»РёСЃС‚РѕРІ (public/art/events/pack-1..7.jpg), 5Г—5 СЏС‡РµРµРє
 * РЅР° Р»РёСЃС‚Рµ. РќРѕРјРµСЂР° СЃРѕР±С‹С‚РёР№ 1вЂ“163 = РїРѕСЂСЏРґРѕРє С€Р°Р±Р»РѕРЅРѕРІ РІ event_data.php:
 * help 1вЂ“28, trap 29вЂ“58, loot 59вЂ“162, item 163 (СЃРѕС‡С‚РµРЅРѕ СЃ generateEvent).
 *
 * Р›РёСЃС‚С‹ вЂ” РіРµРЅРµСЂР°С‚РёРІРЅС‹Рµ: РїРµСЂРіР°РјРµРЅС‚РЅС‹Рµ РїРѕР»СЏ, Р·Р°Р·РѕСЂС‹ Рё СЃРєСЂСѓРіР»С‘РЅРЅС‹Рµ СЂР°РјРєРё РЅРµ
 * РѕР±СЂР°Р·СѓСЋС‚ С‚РѕС‡РЅСѓСЋ СЃРµС‚РєСѓ, РїРѕСЌС‚РѕРјСѓ СЏС‡РµР№РєР° Р±РµСЂС‘С‚СЃСЏ РЅРµ В«500%Г—500%В», Р° С‚РѕС‡РЅС‹Рј
 * РїСЂСЏРјРѕСѓРіРѕР»СЊРЅРёРєРѕРј: Р·Р°РјРµСЂРµРЅРЅС‹Рµ РєСЂР°СЏ РєРѕР»РѕРЅРѕРє/СЃС‚СЂРѕРє в†’ С„РѕРЅ СЂР°СЃС‚СЏРіРёРІР°РµС‚СЃСЏ С‚Р°Рє,
 * С‡С‚РѕР±С‹ СЏС‡РµР№РєР° СЂРѕРІРЅРѕ Р·Р°РїРѕР»РЅСЏР»Р° СЌР»РµРјРµРЅС‚ (aspectRatio СЌР»РµРјРµРЅС‚Р° = РїСЂРѕРїРѕСЂС†РёРё
 * СЏС‡РµР№РєРё). Р“РµРѕРјРµС‚СЂРёСЏ Сѓ РєР°Р¶РґРѕРіРѕ Р»РёСЃС‚Р° СЃРІРѕСЏ (1вЂ“125 СЂРѕРІРЅС‹Рµ, 126вЂ“163 РјРµР»СЊС‡Рµ).
 */

import type { CSSProperties } from 'react';

interface SheetDef {
  /** РќРѕРјРµСЂ Р»РёСЃС‚Р° в†’ public/art/events/pack-N.jpg */
  file: number;
  /** Number of columns on the sheet (default 5). */
  cols?: number;
  /** Р”РёР°РїР°Р·РѕРЅ РЅРѕРјРµСЂРѕРІ СЃРѕР±С‹С‚РёР№ РЅР° Р»РёСЃС‚Рµ */
  from: number;
  to: number;
  /** Р›РµРІС‹Р№ РєСЂР°Р№ РєР°Р¶РґРѕР№ РёР· 5 РєРѕР»РѕРЅРѕРє */
  xs: number[];
  /** Р’РµСЂС…РЅРёР№ РєСЂР°Р№ РєР°Р¶РґРѕР№ РёР· 5 СЃС‚СЂРѕРє */
  ys: number[];
  /** Р Р°Р·РјРµСЂ СЏС‡РµР№РєРё */
  w: number;
  h: number;
  /** Р Р°Р·РјРµСЂ Р»РёСЃС‚Р° */
  W: number;
  H: number;
  /** РќРµСЃС‚Р°РЅРґР°СЂС‚РЅР°СЏ СЂР°СЃРєР»Р°РґРєР° Р»РёСЃС‚Р°: РЅРѕРјРµСЂ в†’ РёРЅРґРµРєСЃ СЏС‡РµР№РєРё (row*5+col, 0-based) */
  cells?: Record<number, number>;
}

const SHEETS: SheetDef[] = [
  { file: 1, from: 1,   to: 25,  xs: [25, 299, 572, 845, 1118],  ys: [25, 173, 322, 470, 619], w: 264, h: 140, W: 1408, H: 768 },
  { file: 2, from: 26,  to: 50,  xs: [35, 303, 574, 842, 1111],  ys: [30, 176, 323, 470, 617], w: 262, h: 141, W: 1408, H: 768 },
  { file: 3, from: 51,  to: 75,  xs: [25, 299, 572, 845, 1118],  ys: [25, 173, 322, 470, 619], w: 264, h: 140, W: 1408, H: 768 },
  { file: 4, from: 76,  to: 100, xs: [25, 299, 572, 845, 1118],  ys: [25, 173, 322, 470, 619], w: 264, h: 140, W: 1408, H: 768 },
  { file: 5, from: 101, to: 125, xs: [25, 299, 572, 845, 1118],  ys: [25, 173, 322, 470, 619], w: 264, h: 140, W: 1408, H: 768 },
  { file: 6, from: 126, to: 150, xs: [39, 307, 575, 842, 1111],  ys: [40, 183, 326, 469, 613], w: 258, h: 134, W: 1408, H: 768 },
  { file: 7, from: 151, to: 163, xs: [39, 307, 575, 842, 1111],  ys: [40, 183, 326, 470, 614], w: 258, h: 134, W: 1408, H: 768,
    // Р›РёСЃС‚ 7: СЃРѕР±С‹С‚РёСЏ 151вЂ“162 РёРґСѓС‚ СЂРѕРІРЅРѕ, Р° 163-Р№ (Р°СЂРјРµР№СЃРєРёР№ СЃС…СЂРѕРЅ) вЂ”
    // РІ РїРѕСЃР»РµРґРЅРµР№ СЏС‡РµР№РєРµ; СЏС‡РµР№РєРё 13вЂ“24 Р»РёСЃС‚Р° Р·Р°РЅСЏС‚С‹ РїРѕСЃС‚РѕСЂРѕРЅРЅРёРјРё
    // РєР°СЂС‚РёРЅРєР°РјРё-РїСЂРµРґРјРµС‚Р°РјРё Рё СЃРѕР±С‹С‚РёСЏРј РЅРµ РїСЂРёРЅР°РґР»РµР¶Р°С‚.
    cells: { 151: 0, 152: 1, 153: 2, 154: 3, 155: 4, 156: 5, 157: 6, 158: 7, 159: 8, 160: 9, 161: 10, 162: 11, 163: 24 },
  },
  // Brutal events (164-193): ONE sheet pack-8, 6 columns x 5 rows = 30 cells,
  // row-major order (art 164 = r1c1 ... 193 = r5c6). Geometry measured on the
  // final sheet 2026-10-28.
  { file: 8, from: 164, to: 193, cols: 6,
    xs: [25, 253, 482, 707, 934, 1162], ys: [24, 173, 321, 469, 618], w: 222, h: 142, W: 1408, H: 768 },
];

/** Р›РёСЃС‚ СЃР»РѕР¶РЅРѕСЃС‚Рё (public/art/diffs/diff-sheet.jpg): 5 РєРІР°РґСЂР°С‚РѕРІ РІ СЂСЏРґ. */
const DIFF_SHEET = { W: 2320, H: 464, w: 429, h: 412, ys: [27], xs: [34, 490, 943, 1400, 1858] };
export { DIFF_SHEET };
interface ArtCellSpec {
  url: string;
  /** РџСЂСЏРјРѕСѓРіРѕР»СЊРЅРёРє СЏС‡РµР№РєРё РЅР° Р»РёСЃС‚Рµ */
  x: number; y: number; w: number; h: number;
  /** Р Р°Р·РјРµСЂ Р»РёСЃС‚Р° */
  W: number; H: number;
}

/** РўРѕС‡РЅС‹Р№ inline-СЃС‚РёР»СЊ С„РѕРЅР°: СЏС‡РµР№РєР° Р·Р°РїРѕР»РЅСЏРµС‚ СЌР»РµРјРµРЅС‚ Р±РµР· РёСЃРєР°Р¶РµРЅРёСЏ. */
const cellStyle = (c: ArtCellSpec): CSSProperties => ({
  backgroundImage: `url(${c.url})`,
  backgroundRepeat: 'no-repeat',
  backgroundSize: `${(c.W / c.w) * 100}% ${(c.H / c.h) * 100}%`,
  backgroundPosition: `${(c.x / (c.W - c.w)) * 100}% ${(c.y / (c.H - c.h)) * 100}%`,
  aspectRatio: `${c.w} / ${c.h}`,
});

const artCache = new Map<number, CSSProperties | null>();

/** РЎС‚РёР»СЊ С„РѕРЅР° РґР»СЏ РЅРѕРјРµСЂР° СЃРѕР±С‹С‚РёСЏ; null = Р°СЂС‚Р° РЅРµС‚ (РјРёРєСЂРѕ/Р»РµРіРµРЅРґР°СЂРєРё/СЃРёСЃС‚РµРјРЅС‹Рµ). */
export const eventArtStyle = (n?: number | null): CSSProperties | null => {
  if (!n || n <= 0) return null;
  const hit = artCache.get(n);
  if (hit !== undefined) return hit;
  let out: CSSProperties | null = null;
  const sheet = SHEETS.find((s) => n >= s.from && n <= s.to);
  if (sheet) {
    const idx = sheet.cells ? (sheet.cells[n] ?? -1) : n - sheet.from;
    if (idx >= 0) {
      const cols = sheet.cols ?? 5;
      out = cellStyle({
        url: `/art/events/pack-${sheet.file}.jpg`,
        x: sheet.xs[idx % cols],
        y: sheet.ys[Math.floor(idx / cols)],
        w: sheet.w, h: sheet.h, W: sheet.W, H: sheet.H,
      });
    }
  }
  artCache.set(n, out);
  return out;
};

const DIFF_ORDER = ['normal', 'hard', 'danger', 'nightmare', 'hell'];

/** РЎС‚РёР»СЊ С„РѕРЅР° РґР»СЏ СЃР»РѕР¶РЅРѕСЃС‚Рё СЂРµР№РґР° (Р»РёСЃС‚ РёР· 5 РєРІР°РґСЂР°С‚РѕРІ). */
export const diffArtStyle = (key?: string | null): CSSProperties | null => {
  const idx = DIFF_ORDER.indexOf(key ?? '');
  if (idx < 0) return null;
  return cellStyle({
    url: '/art/diffs/diff-sheet.jpg',
    x: DIFF_SHEET.xs[idx],
    y: DIFF_SHEET.ys[0],
    w: DIFF_SHEET.w, h: DIFF_SHEET.h, W: DIFF_SHEET.W, H: DIFF_SHEET.H,
  });
};
