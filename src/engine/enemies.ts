export interface EnemyBaseDefinition {
  health: number;
  damage: number;
  dps: number;
  speed: number;
  crit: number;
  armor: number;
  evasion: number;
  block: number;
  punching: number;
  vampir: number;
  accuracy: number;
  expRewardMultiplier: number;
  regen?: number;
  rangeDistance?: number;
  imageKey?: string;
  nowModel?: string;
  dead?: string;
  avatar?: string;
  runAp?: number;
  shotPrice?: number;
  skillUse?: string[];
  bigModel?: string;
  soundAttack?: string;
  chance?: string;
  faction?: string;
  level?: number;
}

export const ENEMY_BASE_STATS: Record<string, EnemyBaseDefinition> = {
  Бандиты: {
    health: 480, damage: 5, dps: 5, speed: 0.05, crit: 0, critChance: 0.05, armor: 2, evasion: 0.05,
    block: 0, punching: 0, vampir: 0.01, accuracy: 1.0, expRewardMultiplier: 1.0,
    faction: 'Бандиты', soundAttack: 'shotenemy', nowModel: 'enemy', dead: 'dead', avatar: 'enemy', level: 1,
  },
  Мутанты: {
    health: 480, damage: 5, dps: 5, speed: 0.05, crit: 0, critChance: 0.05, armor: 2, evasion: 0.05,
    block: 0, punching: 0, vampir: 0.01, accuracy: 1.0, expRewardMultiplier: 1.2,
    faction: 'Мутанты', soundAttack: 'shotenemy', nowModel: 'g1', dead: 'dead', avatar: 'enemy', level: 1,
  },
  Роботы: {
    health: 480, damage: 5, dps: 5, speed: 0.05, crit: 0, critChance: 0.05, armor: 2, evasion: 0.05,
    block: 0, punching: 0, vampir: 0.01, accuracy: 1.0, expRewardMultiplier: 1.1,
    faction: 'Роботы', soundAttack: 'shotenemy', nowModel: 'g2', dead: 'dead', avatar: 'enemy', level: 1,
  },
  'Военные (tank)': {
    health: 480, damage: 5, dps: 5, speed: 0.05, crit: 0, critChance: 0.05, armor: 2, evasion: 0.05,
    regen: 1, block: 0, punching: 0, accuracy: 1.0, vampir: 0.01,
    expRewardMultiplier: 2, rangeDistance: 5, runAp: 4, shotPrice: 4,
    skillUse: ['ram'], bigModel: '150%', faction: 'Военные',
    soundAttack: 'shotenemy', nowModel: 'tank', dead: 'dead', avatar: 'tank', level: 3,
  },
  'Военные (melee)': {
    health: 480, damage: 5, dps: 5, speed: 0.05, crit: 0, critChance: 0.05, armor: 2, evasion: 0.05,
    regen: 1, block: 0, punching: 0, accuracy: 1.0, vampir: 0.01,
    expRewardMultiplier: 1.5, rangeDistance: 1, runAp: 4, shotPrice: 2,
    skillUse: ['ram'], bigModel: '110%', faction: 'Военные',
    soundAttack: 'melee', nowModel: 'melee', dead: 'dead', avatar: 'melee', level: 2,
  },
  'Военные (sniper)': {
    health: 480, damage: 5, dps: 5, speed: 0.05, crit: 0, critChance: 0.05, armor: 2, evasion: 0.05,
    regen: 1, block: 0, punching: 0, accuracy: 1.0, vampir: 0.01,
    expRewardMultiplier: 2, rangeDistance: 18, runAp: 3, shotPrice: 3,
    skillUse: ['suppression', 'aimShot'], bigModel: '130%', faction: 'Военные',
    soundAttack: 'sniper', nowModel: 'sniperimg', dead: 'dead', avatar: 'sniperimg', level: 3,
  },
  'Военные (drob)': {
    health: 480, damage: 5, dps: 5, speed: 0.05, crit: 0, critChance: 0.05, armor: 2, evasion: 0.05,
    regen: 1, block: 0, punching: 0, accuracy: 1.0, vampir: 0.01,
    expRewardMultiplier: 1.8, rangeDistance: 5, runAp: 4, shotPrice: 2,
    skillUse: ['aimShot', 'invisibility'], bigModel: '100%', faction: 'Военные',
    soundAttack: 'drob', nowModel: 'military1', dead: 'dead', avatar: 'military1', level: 2,
  },
  'Военные (original)': {
    health: 480, damage: 5, dps: 5, speed: 0.05, crit: 0, critChance: 0.05, armor: 2,
    evasion: 0.05, regen: 1, block: 0, punching: 0, accuracy: 1.0, vampir: 0.01,
    expRewardMultiplier: 1, rangeDistance: 9, runAp: 6, shotPrice: 2,
    skillUse: ['grenade', 'stimulant'], bigModel: '100%', faction: 'Военные',
    soundAttack: 'pistol', nowModel: 'military2', dead: 'dead', avatar: 'military2', level: 2,
  },
  'Военные (medic)': {
    health: 480, damage: 5, dps: 5, speed: 0.05, crit: 0, critChance: 0.05, armor: 2, evasion: 0.05,
    regen: 1, block: 0, punching: 0, accuracy: 1.0, vampir: 0.01,
    expRewardMultiplier: 1.2, rangeDistance: 9, runAp: 4, shotPrice: 1,
    skillUse: [''], bigModel: '100%', faction: 'Военные',
    soundAttack: 'healer', nowModel: 'medic', dead: 'dead', avatar: 'medic', level: 2,
  },
  'Военные (boss)': {
    health: 480, damage: 5, dps: 5, speed: 0.05, crit: 0, critChance: 0.05, armor: 2, evasion: 0.05,
    regen: 1, block: 0, punching: 0, accuracy: 1.0, vampir: 0.01,
    expRewardMultiplier: 5, rangeDistance: 8, runAp: 5, shotPrice: 1,
    skillUse: ['madness', 'rage'], bigModel: '130%', faction: 'Военные',
    soundAttack: 'пулемет', nowModel: 'military3', dead: 'dead', avatar: 'military3', level: 5,
  },
};

export const generateEnemy = (
  playerLevel: number,
  difficultyModifier: number = 0,
): EnemyBaseDefinition & {
  factionKey: string;
  currentHp: number; scaledDamage: number; scaledHealth: number;
  scaledArmor: number; scaledRegen: number; scaledSpeed: number;
  scaledCrit: number; scaledEvasion: number; scaledBlock: number;
  scaledPunching: number; scaledVampir: number; scaledAccuracy: number;
} => {
  const factionKeys = Object.keys(ENEMY_BASE_STATS);
  const factionKey = factionKeys[Math.floor(Math.random() * factionKeys.length)];
  const base = ENEMY_BASE_STATS[factionKey];

  const levelMult = 1 + 0.2 * (Math.max(1, playerLevel) - 1);
  const extraMult = 1 + (difficultyModifier || 0) / 100;
  const totalMult = levelMult * extraMult;
  const accuracyAdd = (playerLevel - 1) * 0.001;

  return {
    ...base,
    factionKey,
    currentHp: Math.round(base.health * totalMult),
    scaledHealth: Math.round(base.health * totalMult),
    scaledDamage: Math.round(base.damage * totalMult),
    scaledArmor: Math.round(base.armor * totalMult),
    scaledRegen: (base.regen || 0) * totalMult,
    scaledSpeed: base.speed * totalMult,
    scaledCrit: base.crit * totalMult,
    scaledEvasion: Math.min(1, base.evasion * totalMult),
    scaledBlock: base.block * totalMult,
    scaledPunching: base.punching * totalMult,
    // Вампиризм — доля от урона: не скейлится (урон скейлится сам).
    scaledVampir: base.vampir,
    scaledAccuracy: Math.min(2, base.accuracy + accuracyAdd),
  };
};
