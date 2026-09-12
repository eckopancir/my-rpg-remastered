import type { Item } from '../types/items';
import { schematicBonusOf } from '../data/schematics';

const num = (v: unknown): number =>
  typeof v === 'object' && v !== null ? ((v as any)?.base || 0) : ((v as number) || 0);

/** Множитель статов мода от его уровня: на 30 ур. ≈ ×3.9 (15% крита из 0.04). */
export const modLevelMult = (mod: Pick<Item, 'level'>): number =>
  1 + (Math.max(1, mod.level || 1) - 1) * 0.1;

/** Разовый даунскейл старых модов: раньше статы пеклись со скейлом уровня,
 *  теперь скейлит рантайм — делим один раз, чтобы не двоило.
 *  Идемпотентно (метка _descaled): безопасно звать повторно. */
export const demoteModStats = (item: any): void => {
  const mods = (item as any)?.mods;
  if (!mods) return;
  for (const mod of Object.values(mods) as any[]) {
    if (!mod || !mod.stats || (mod as any)._descaled) continue;
    const f = modLevelMult(mod);
    if (f > 1) {
      for (const k of Object.keys((mod as any).stats)) {
        const v = (mod as any).stats[k];
        if (typeof v === 'number') (mod as any).stats[k] = Math.round((v / f) * 10000) / 10000;
      }
    }
    (mod as any)._descaled = true;
  }
};

/** Вклад только вставленных модов по каждому стату (с учётом уровня модов). */
export const modStatsOf = (item: Item): Record<string, number> => {
  const out: Record<string, number> = {};
  if (item.mods) {
    for (const mod of Object.values(item.mods)) {
      if (!mod || !(mod as Item).stats) continue;
      const mult = modLevelMult(mod as Item);
      for (const [k, v] of Object.entries((mod as Item).stats || {})) {
        out[k] = (out[k] || 0) + num(v) * mult;
      }
    }
  }
  return out;
};

/** Итоговые статы предмета с учётом вставленных модов (моды плюсуются к базе)
 *  и схем перековки (схемы умножают итог по своему стату). */
export const effectiveItemStats = (item: Item): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(item.stats || {})) out[k] = num(v);
  const mods = modStatsOf(item);
  for (const [k, v] of Object.entries(mods)) out[k] = (out[k] || 0) + v;
  const schemes = schematicBonusOf(item);
  for (const [k, pct] of Object.entries(schemes)) {
    if (!out[k]) continue;
    out[k] = out[k] * (1 + pct / 100);
  }
  return out;
};
