/**
 * Пул врагов карточного данжа «Улей».
 *
 * Один данж — один пул. Враги выпадают случайно, 1–3 на бой.
 * Сила зависит от акта и тира ключа. Босс один и тот же, просто толще.
 */

export type EnemyLogic = 'swarm' | 'aggressor' | 'hunter' | 'tactician' | 'boss';

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  atk: number;
  logic: EnemyLogic;
  icon: string;
  color: string;
}

export interface EnemySeed {
  defId: string;
  name: string;
  hp: number;
  atk: number;
  logic: EnemyLogic;
  icon: string;
  color: string;
  isBoss: boolean;
  isElite: boolean;
}

export const ENEMY_POOL: EnemyDef[] = [
  { id: 'spiderling', name: 'Молодой паук', hp: 30, atk: 8, logic: 'swarm', icon: '🕷️', color: '#a3e635' },
  { id: 'worker', name: 'Паук-рабочий', hp: 42, atk: 12, logic: 'swarm', icon: '🕷️', color: '#84cc16' },
  { id: 'hunter', name: 'Паук-охотник', hp: 55, atk: 14, logic: 'hunter', icon: '🕸️', color: '#22d3ee' },
  { id: 'weaver', name: 'Паук-ткач', hp: 60, atk: 8, logic: 'tactician', icon: '🕸️', color: '#c084fc' },
  { id: 'guard', name: 'Паук-страж', hp: 70, atk: 16, logic: 'aggressor', icon: '🛡️', color: '#f97316' },
];

export const BOSS_DEF: EnemyDef = {
  id: 'matriarch', name: 'Матка-кормилица', hp: 300, atk: 26, logic: 'boss', icon: '👑', color: '#ef4444',
};

export const ACT_MULT = [
  { hp: 1.0, atk: 1.0 },
  { hp: 1.6, atk: 1.3 },
  { hp: 2.2, atk: 1.55 },
];

export const ACT_NAMES = ['Акт I · Логово', 'Акт II · Глубина', 'Акт III · Сердце улья'];

export const actOfDoor = (door: number): number => (door <= 10 ? 0 : door <= 20 ? 1 : 2);

/** 1–3 врага: 1–3 двери → 1, 4–6 → 2, 7–9 → 3; II и III акты всегда 3. */
export const enemyCountForDoor = (door: number): number => {
  if (door % 10 === 0) return 1; // босс
  if (actOfDoor(door) > 0) return 3;
  if (door <= 3) return 1;
  if (door <= 6) return 2;
  return 3;
};

export const tierMult = (tier: number) => ({
  hp: 0.8 + 0.2 * Math.max(1, Math.min(7, tier)),
  atk: 0.9 + 0.1 * Math.max(1, Math.min(7, tier)),
  reward: 0.8 + 0.2 * Math.max(1, Math.min(7, tier)),
});

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const spawnEnemies = (
  door: number,
  tier: number,
  source: 'battle' | 'elite' | 'boss',
): EnemySeed[] => {
  const act = actOfDoor(door);
  const actMult = ACT_MULT[act];
  const tm = tierMult(tier);
  const scale = (def: EnemyDef, elite: boolean): EnemySeed => {
    const eliteHp = elite ? 1.6 : 1;
    const eliteAtk = elite ? 1.3 : 1;
    return {
      defId: def.id,
      name: def.name,
      hp: Math.max(1, Math.round(def.hp * actMult.hp * tm.hp * eliteHp)),
      atk: Math.max(1, Math.round(def.atk * actMult.atk * tm.atk * eliteAtk)),
      logic: def.logic,
      icon: def.icon,
      color: def.color,
      isBoss: def.logic === 'boss',
      isElite: elite,
    };
  };

  if (source === 'boss') {
    return [scale(BOSS_DEF, false)];
  }
  if (source === 'elite') {
    return [scale(pick(ENEMY_POOL), true)];
  }

  const count = enemyCountForDoor(door);
  const picks: EnemyDef[] = [];
  for (let i = 0; i < count; i++) {
    let pool = ENEMY_POOL;
    if (picks.some((p) => p.logic === 'tactician')) {
      pool = ENEMY_POOL.filter((p) => p.logic !== 'tactician');
    }
    picks.push(pick(pool));
  }
  return picks.map((def) => scale(def, false));
};
