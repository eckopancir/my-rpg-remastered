import type { Item } from '../types/items';

const num = (v: unknown): number =>
  typeof v === 'object' && v !== null ? ((v as any)?.base || 0) : ((v as number) || 0);

/** Вклад только вставленных модов по каждому стату. */
export const modStatsOf = (item: Item): Record<string, number> => {
  const out: Record<string, number> = {};
  if (item.mods) {
    for (const mod of Object.values(item.mods)) {
      if (!mod || !(mod as Item).stats) continue;
      for (const [k, v] of Object.entries((mod as Item).stats || {})) {
        out[k] = (out[k] || 0) + num(v);
      }
    }
  }
  return out;
};

/** Итоговые статы предмета с учётом вставленных модов (моды плюсуются к базе). */
export const effectiveItemStats = (item: Item): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(item.stats || {})) out[k] = num(v);
  const mods = modStatsOf(item);
  for (const [k, v] of Object.entries(mods)) out[k] = (out[k] || 0) + v;
  return out;
};
