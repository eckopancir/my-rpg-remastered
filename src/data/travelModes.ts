/**
 * Характеристики режимов рейда (сложность + характер пути).
 * Числа приходят с сервера (travelDifficulties/travelModifiers в
 * api/exploration/difficulty.php) — здесь только подписи и раскладка.
 */

export interface TravelModeInfo {
  key: string;
  name: string;
  icon?: string;
  color?: string;
  desc?: string;
  // Сложность.
  damageMult?: number;
  rewardMult?: number;
  qualityCap?: string;
  // Характер пути (модификатор).
  legChance?: number;
  damage?: number;
  chips?: number;
  exp?: number;
  heal?: number;
  regen?: number;
  eventRate?: number;
  findRate?: number;
  lootBonus?: number;
  qualityStep?: number;
  tripTime?: number;
  returnTime?: number;
}

export interface ModeTrait {
  label: string;
  value: string;
  /** up = выгодно игроку, down = риск/минус, flat = нейтрально. */
  tone: 'up' | 'down' | 'flat';
}

const fmtMult = (v: number): string => {
  const s = Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, '');
  return s.replace('.', ',');
};

/** Характеристики сложности: урон, награда, потолок качества дропа. */
export const difficultyTraits = (d?: TravelModeInfo | null): ModeTrait[] => {
  if (!d) return [];
  const out: ModeTrait[] = [];
  if (typeof d.damageMult === 'number') {
    out.push({ label: 'урон', value: `×${fmtMult(d.damageMult)}`, tone: d.damageMult > 1 ? 'down' : 'flat' });
  }
  if (typeof d.rewardMult === 'number') {
    out.push({ label: 'награда', value: `×${fmtMult(d.rewardMult)}`, tone: d.rewardMult > 1 ? 'up' : 'flat' });
  }
  if (d.qualityCap) out.push({ label: 'потолок дропа', value: d.qualityCap, tone: 'flat' });
  return out;
};

/** Множители характера пути: [поле, подпись, больше = лучше для игрока]. */
const MOD_FIELDS: Array<[keyof TravelModeInfo, string, boolean]> = [
  ['damage', 'урон', false],
  ['chips', 'чипы', true],
  ['exp', 'опыт', true],
  ['heal', 'хил', true],
  ['regen', 'реген', true],
  ['findRate', 'находки', true],
  ['eventRate', 'события', false],
  ['tripTime', 'время в зоне', true],
  ['returnTime', 'дорога домой', false],
];

/** Характеристики модификатора: только то, что реально отличается от 1. */
export const modifierTraits = (m?: TravelModeInfo | null): ModeTrait[] => {
  if (!m) return [];
  const out: ModeTrait[] = [];
  for (const [key, label, higherIsBetter] of MOD_FIELDS) {
    const v = m[key];
    if (typeof v !== 'number' || Math.abs(v - 1) < 0.0001) continue;
    out.push({
      label,
      value: `×${fmtMult(v)}`,
      tone: higherIsBetter ? (v > 1 ? 'up' : 'down') : (v > 1 ? 'down' : 'up'),
    });
  }
  if (typeof m.legChance === 'number' && m.legChance > 0) {
    out.push({ label: 'легендарка', value: `+${fmtMult(m.legChance)}%`, tone: 'up' });
  }
  if (typeof m.qualityStep === 'number' && m.qualityStep !== 0) {
    const s = Math.abs(m.qualityStep);
    out.push({
      label: 'качество дропа',
      value: `${m.qualityStep > 0 ? '+' : '−'}${s} ${s === 1 ? 'ступень' : 'ступени'}`,
      tone: m.qualityStep > 0 ? 'up' : 'down',
    });
  }
  if (typeof m.lootBonus === 'number' && m.lootBonus > 0) {
    out.push({ label: 'лишняя находка', value: `+${fmtMult(Math.round(m.lootBonus * 100))}%`, tone: 'up' });
  }
  return out;
};
