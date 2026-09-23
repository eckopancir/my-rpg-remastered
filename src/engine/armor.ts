// Асимптотический срез урона бронёй (диминишинг, как в WoW/LoL/Dota):
//   DR = A^0.75 / (A^0.75 + K), входящий урон = базовый × (1 − DR).
// K = 135: 3000 брони = ровно 75% среза; 10 → 4%, 50 → 12.2%,
// 100 → 19%, 300 → 34.8%, 1000 → 56.8%, 2000 → 68.9%.
// Броня никогда не даёт 100%, но полезна на любом уровне.
export const ARMOR_K = 135;
export const ARMOR_EXP = 0.75;

/** Доля среза урона (0–1) от значения брони. */
export const armorDR = (armor: number): number => {
  const a = Math.max(0, armor || 0);
  if (a <= 0) return 0;
  const p = Math.pow(a, ARMOR_EXP);
  return p / (p + ARMOR_K);
};

/** Входящий урон после брони (броня — уже с учётом пробития). */
export const applyArmorDamage = (dmg: number, effArmor: number): number => {
  if (dmg <= 0) return 0;
  return dmg * (1 - armorDR(effArmor));
};
