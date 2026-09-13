import type { Item } from '../types/items';
import { schematicBonusOf } from '../data/schematics';
import { bulletDamageMult } from '../data/ammo';

const num = (v: unknown): number =>
  typeof v === 'object' && v !== null ? ((v as any)?.base || 0) : ((v as number) || 0);

/** Множитель статов мода от его уровня: на 30 ур. ≈ ×3.9 (15% крита из 0.04). */
export const modLevelMult = (mod: Pick<Item, 'level'>): number =>
  1 + (Math.max(1, mod.level || 1) - 1) * 0.1;

/** Разовый даунскейл СТАРЫХ модов: раньше статы пеклись со скейлом уровня,
 *  теперь скейлит рантайм — делим один раз, чтобы не двоило.
 *  Новые моды (_modv=2) уже сырые — их трогать НЕЛЬЗЯ.
 *  Идемпотентно (метка _descaled): безопасно звать повторно. */
export const demoteModStats = (item: any): void => {
  const mods = (item as any)?.mods;
  if (!mods) return;
  for (const mod of Object.values(mods) as any[]) {
    if (!mod || !mod.stats || (mod as any)._descaled || (mod as any)._modv === 2) continue;
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

/** Лечение модов нового образца, ошибочно порезанных даунскейлом:
 *  умножаем обратно на скейл уровня (моды не левелятся — инверсия точная).
 *  Метка _healed13 — чтобы не лечить дважды (сейв мог не успеть уйти на сервер).
 *  Вызывать один раз из миграций и загрузки. */
export const healWronglyDemoted = (item: any): boolean => {
  const mods = (item as any)?.mods;
  if (!mods) return false;
  let healed = false;
  for (const mod of Object.values(mods) as any[]) {
    if (!mod || !mod.stats || (mod as any)._modv !== 2 || !(mod as any)._descaled || (mod as any)._healed13) continue;
    const f = modLevelMult(mod);
    if (f > 1) {
      for (const k of Object.keys((mod as any).stats)) {
        const v = (mod as any).stats[k];
        if (typeof v === 'number') (mod as any).stats[k] = Math.round(v * f * 10000) / 10000;
      }
      healed = true;
    }
    (mod as any)._healed13 = true;
  }
  return healed;
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
 *  и сфер перековки (каждая сфера умножает: 5×+30% = ×1.3^5 = +271.3%;
 *  стихийные сферы плюсуют плоско).
 *  Для weapon2 добавляет бонус от качества патронов. */
export const effectiveItemStats = (item: Item): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(item.stats || {})) out[k] = num(v);
  const mods = modStatsOf(item);
  for (const [k, v] of Object.entries(mods)) out[k] = (out[k] || 0) + v;
  for (const s of (((item as any).sockets || []) as { stat: string; pct: number }[])) {
    if (!s || !s.stat) continue;
    if (s.stat.startsWith('dps')) {
      // Стихийная сфера: плоская прибавка.
      out[s.stat] = (out[s.stat] || 0) + (s.pct || 0);
    } else {
      if (!out[s.stat]) continue;
      out[s.stat] = out[s.stat] * (1 + (s.pct || 0) / 100);
    }
  }
  // Бонус от качества патронов для weapon2
  if (item.slot === 'weapon2' && item.ammoCapacity) {
    const quality = (item as any).loadedAmmoQuality || 'Обычный';
    const mult = bulletDamageMult(quality);
    if (mult > 1) {
      for (const [k, v] of Object.entries(out)) {
        if (typeof v === 'number' && v > 0) {
          out[k] = Math.round(v * mult);
        }
      }
    }
  }
  return out;
};
