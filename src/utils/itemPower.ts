import { usePlayerStore, computePowerFromStats } from '../stores/playerStore';
import type { PlayerStats } from '../stores/playerStore';
import type { Item } from '../types/items';
import { ABILITY_MAP } from '../data/accessoryAbilities';

const STAT_KEY_MAP: Record<string, keyof PlayerStats> = {
  health: 'maxHp',
  maxHp: 'maxHp',
  stamina: 'maxStamina',
  maxStamina: 'maxStamina',
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
  for (const [k, v] of Object.entries(item.stats || {})) {
    const val = typeof v === 'object' ? ((v as any)?.base || 0) : (v || 0);
    if (val === 0) continue;
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
    abilityPower = Math.round(base * levelFactor);
  }

  return Math.max(0, Math.round(statDelta + abilityPower));
};

export function calcExtraShots(speed: number): number {
  const chance = speed * 0.5;
  const intPart = Math.floor(chance);
  const fracPart = chance - intPart;
  return intPart + (Math.random() < fracPart ? 1 : 0);
}
