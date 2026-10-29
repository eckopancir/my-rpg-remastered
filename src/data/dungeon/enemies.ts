/**
 * Пул врагов карточного данжа «Улей».
 *
 * Один данж — один пул. Враги выпадают случайно, 1–3 на бой.
 * Сила зависит от акта и тира ключа. Босс один и тот же, просто толще.
 *
 * У каждого паука своя способность — поведение описано в dungeonStore
 * (`intentFor`), здесь только данные и текст для карточки.
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
  /** Арт для карточки (public/art/dungeon/enemies). */
  image: string;
  /** Название способности. */
  ability: string;
  /** Короткое описание способности. */
  abilityDesc: string;
}

export interface EnemySeed {
  defId: string;
  name: string;
  hp: number;
  atk: number;
  logic: EnemyLogic;
  icon: string;
  color: string;
  image: string;
  ability: string;
  abilityDesc: string;
  isBoss: boolean;
  isElite: boolean;
}

const ART = '/art/dungeon/enemies';

export const ENEMY_POOL: EnemyDef[] = [
  {
    id: 'spiderling', name: 'Молодой паук', hp: 30, atk: 8, logic: 'swarm',
    icon: '🕷️', color: '#a3e635', image: `${ART}/spiderling.png`,
    ability: 'Роевой инстинкт',
    abilityDesc: 'Если рядом есть другой паук — кусает дважды.',
  },
  {
    id: 'worker', name: 'Паук-рабочий', hp: 42, atk: 12, logic: 'swarm',
    icon: '🕷️', color: '#84cc16', image: `${ART}/worker.png`,
    ability: 'Тяжёлый удар',
    abilityDesc: 'Раз в 3 хода бьёт в 1.5 раза сильнее и вдвое снижает броню цели на 2 хода.',
  },
  {
    id: 'hunter', name: 'Паук-охотник', hp: 55, atk: 14, logic: 'hunter',
    icon: '🕸️', color: '#22d3ee', image: `${ART}/hunter.png`,
    ability: 'Прыжок из тени',
    abilityDesc: 'Раз в 2 хода прыгает в задний ряд с +50% урона, по раненым — ещё больнее.',
  },
  {
    id: 'weaver', name: 'Паук-ткач', hp: 60, atk: 8, logic: 'tactician',
    icon: '🕸️', color: '#c084fc', image: `${ART}/weaver.png`,
    ability: 'Паутина',
    abilityDesc: 'Раз в 2 хода опутывает всех: броня восстанавливается вдвое меньше. Раз в 5 ходов — клич стае.',
  },
  {
    id: 'guard', name: 'Паук-страж', hp: 70, atk: 16, logic: 'aggressor',
    icon: '🛡️', color: '#f97316', image: `${ART}/guard.png`,
    ability: 'Каменный панцирь',
    abilityDesc: 'Раз в 3 хода наращивает броню и пропускает атаку.',
  },
  {
    id: 'soldier', name: 'Паук-солдат', hp: 64, atk: 13, logic: 'aggressor',
    icon: '🕷️', color: '#eab308', image: `${ART}/soldier.png`,
    ability: 'Строй',
    abilityDesc: 'Бьёт на 25% сильнее рядом с союзником. Раз в 4 хода — клич +3 атаки стае.',
  },
  {
    id: 'spitter', name: 'Паук-плевун', hp: 48, atk: 12, logic: 'hunter',
    icon: '🕸️', color: '#2dd4bf', image: `${ART}/spitter.png`,
    ability: 'Кислотный плевок',
    abilityDesc: 'Раз в 3 хода — кислота по всем. Раз в 5 ходов — −50% хила цели на 10 ходов.',
  },
  {
    id: 'carrier', name: 'Паук-носитель', hp: 78, atk: 9, logic: 'swarm',
    icon: '🥚', color: '#fb923c', image: `${ART}/carrier.png`,
    ability: 'Яйцекладка',
    abilityDesc: 'Раз в 4 хода призывает выводок. Пока выводок жив — получает −30% урона. Умирая, выпускает выводок.',
  },
];

export const BOSS_DEF: EnemyDef = {
  id: 'matriarch', name: 'Матка-кормилица', hp: 300, atk: 26, logic: 'boss',
  icon: '👑', color: '#ef4444', image: `${ART}/matriarch.png`,
  ability: 'Три фазы улья',
  abilityDesc: 'I — призыв выводка и вампиризм. II — кислотный ливень. III — безумие: двойные атаки и ярость стаи.',
};

/** Выводок — призыв матки и носителя. */
export const BROOD_DEF: EnemyDef = {
  id: 'brood', name: 'Выводок', hp: 26, atk: 7, logic: 'swarm',
  icon: '🕷️', color: '#a3e635', image: `${ART}/brood.png`,
  ability: 'Роевой инстинкт',
  abilityDesc: 'Кусает дважды, если рядом есть другой паук.',
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
      image: def.image,
      ability: def.ability,
      abilityDesc: def.abilityDesc,
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
