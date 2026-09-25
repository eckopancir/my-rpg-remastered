import { computePowerFromStats } from '../stores/playerStore';
import type { PlayerStats } from '../stores/playerStore';
import type { Item } from '../types/items';
import { ABILITY_MAP } from '../data/accessoryAbilities';
import { effectiveItemStats } from './itemStats';
import { effectiveAmmoCapacity } from '../data/ammo';

const STAT_KEY_MAP: Record<string, keyof PlayerStats> = {
  health: 'maxHp',
  maxHp: 'maxHp',
  stamina: 'maxStamina',
  maxStamina: 'maxStamina',
};

/**
 * Средний темп стрельбы (выстрелов/ход) за 5 ходов: 5 AP, выстрел 1 AP,
 * перезарядка 1 AP при пустом магазине, запас бесконечный.
 * Магазин 1 → 3.0; 2 → 4.0; 5/10 → 4.8; 30 → 5.0; без магазина (ближний бой) → 5.0.
 */
export const sustainedShotsPerTurn = (ammoCapacity?: number): number => {
  const TURNS = 5;
  const AP = 5;
  let total = 0;
  let mag = ammoCapacity ?? 0;
  const infinite = ammoCapacity == null;
  for (let t = 0; t < TURNS; t++) {
    let ap = AP;
    let m = infinite ? AP : mag;
    while (ap >= 1) {
      if (!infinite && m <= 0) {
        // Перезарядка за 1 AP; если AP нет — ход окончен.
        ap -= 1;
        m = ammoCapacity as number;
        continue;
      }
      // Выстрел.
      m -= 1;
      ap -= 1;
      total += 1;
    }
    if (!infinite) mag = m;
  }
  return total / TURNS;
};

export const calcItemPower = (item: Item): number => {
  // Статичная мощность: абсолютная сумма весов по эффективным статам
  // (база + моды + сферы). Не зависит от надетого — цифра стабильна везде.
  // Огнестрел: урон в sustained-эквиваленте (темп с перезарядками).
  const sustainedFactor = item.slot === 'weapon2' && item.ammoCapacity
    ? sustainedShotsPerTurn(effectiveAmmoCapacity(item)) / 5
    : 1;
  const combined: Record<string, number> = effectiveItemStats(item);
  const asPlayer: Record<string, number> = {};
  for (const [k, v] of Object.entries(combined)) {
    let val = v || 0;
    if (val === 0) continue;
    if (k === 'damage') val *= sustainedFactor;
    const mappedKey = STAT_KEY_MAP[k] || k;
    asPlayer[mappedKey] = (asPlayer[mappedKey] || 0) + val;
  }
  const { offensiveScore, defensiveScore } = computePowerFromStats(asPlayer as PlayerStats);

  let abilityPower = 0;
  if (item.abilityId && ABILITY_MAP[item.abilityId]) {
    const base = ABILITY_MAP[item.abilityId].powerRating;
    const levelFactor = 1 + ((item.level || 1) - 1) * 0.05;
    abilityPower = Math.round(base * levelFactor * 3);
  }

  return Math.max(0, Math.round(offensiveScore + defensiveScore + abilityPower));
};

export function calcExtraShots(speed: number): number {
  const chance = speed * 0.5;
  const intPart = Math.floor(chance);
  const fracPart = chance - intPart;
  return intPart + (Math.random() < fracPart ? 1 : 0);
}
