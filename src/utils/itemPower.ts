import { usePlayerStore, computePowerFromStats } from '../stores/playerStore';
import type { PlayerStats } from '../stores/playerStore';
import type { Item } from '../types/items';
import { ABILITY_MAP } from '../data/accessoryAbilities';
import { effectiveItemStats } from './itemStats';

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

const applyClamps = (s: PlayerStats): void => {
  s.damage = Math.max(1, s.damage);
  s.crit = Math.max(0, s.crit);
  s.armor = Math.max(0, s.armor);
  s.regen = Math.max(0, s.regen);
  s.evasion = Math.min(0.9, Math.max(0, s.evasion));
  s.block = Math.min(0.9, Math.max(0, s.block));
  s.punching = Math.max(0, s.punching);
  s.accuracy = Math.min(2, Math.max(0.1, s.accuracy));
  s.vampir = Math.min(0.5, Math.max(0, s.vampir));
  s.speed = Math.max(0, s.speed);
  s.dpsEmi = Math.max(0, s.dpsEmi);
  s.dpsToxis = Math.max(0, s.dpsToxis);
  s.dpsExtro = Math.max(0, s.dpsExtro);
  s.dpsFire = Math.max(0, s.dpsFire);
};

export const calcItemPower = (item: Item): number => {
  const { stats, equipment } = usePlayerStore.getState();
  const isEquipped = Object.values(equipment).some(eq => eq && eq.id === item.id);

  const curStats = { ...stats };
  applyClamps(curStats);
  const { offensiveScore: curOff, defensiveScore: curDef } = computePowerFromStats(curStats);
  const curStatPower = curOff + curDef;

  const adjustedStats = { ...stats };
  const sign = isEquipped ? -1 : 1;
  // Огнестрел: урон идёт в sustained-эквиваленте (темп с перезарядками),
  // а не голым уроном: базука 300×2 и снайперка 250×10 дают ~1200/ход обе.
  const sustainedFactor = item.slot === 'weapon2' && item.ammoCapacity
    ? sustainedShotsPerTurn(item.ammoCapacity) / 5
    : 1;
  // Мощность с учётом модов: effectiveItemStats уже включает базу + моды.
  for (const [k, v] of Object.entries(effectiveItemStats(item))) {
    let val = v || 0;
    if (val === 0) continue;
    if (k === 'damage') val *= sustainedFactor;
    const mappedKey = STAT_KEY_MAP[k] || (k as keyof PlayerStats);
    if (mappedKey in adjustedStats && typeof adjustedStats[mappedKey] === 'number') {
      (adjustedStats as any)[mappedKey] += val * sign;
    }
  }
  applyClamps(adjustedStats);

  const { offensiveScore: adjOff, defensiveScore: adjDef } = computePowerFromStats(adjustedStats);
  const adjStatPower = adjOff + adjDef;
  const statDelta = Math.abs(adjStatPower - curStatPower);

  let abilityPower = 0;
  if (item.abilityId && ABILITY_MAP[item.abilityId]) {
    const base = ABILITY_MAP[item.abilityId].powerRating;
    const levelFactor = 1 + ((item.level || 1) - 1) * 0.05;
    abilityPower = Math.round(base * levelFactor * 3);
  }

  return Math.max(0, Math.round(statDelta + abilityPower));
};

export function calcExtraShots(speed: number): number {
  const chance = speed * 0.5;
  const intPart = Math.floor(chance);
  const fracPart = chance - intPart;
  return intPart + (Math.random() < fracPart ? 1 : 0);
}
