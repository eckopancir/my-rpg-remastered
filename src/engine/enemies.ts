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
    health: 500, damage: 12, dps: 12, speed: 0.1, crit: 0.1, armor: 2, evasion: 0.05,
    block: 0, punching: 0, vampir: 0.001, accuracy: 0.95, expRewardMultiplier: 1.0,
    faction: 'Бандиты', soundAttack: 'shotenemy', nowModel: 'enemy', dead: 'dead', avatar: 'enemy', level: 1,
  },
  Мутанты: {
    health: 500, damage: 15, dps: 15, speed: 0.08, crit: 0.1, armor: 0, evasion: 0.15,
    block: 0, punching: 0, vampir: 0.001, accuracy: 0.85, expRewardMultiplier: 1.2,
    faction: 'Мутанты', soundAttack: 'shotenemy', nowModel: 'g1', dead: 'dead', avatar: 'enemy', level: 1,
  },
  Роботы: {
    health: 500, damage: 10, dps: 10, speed: 0.12, crit: 0.05, armor: 4, evasion: 0.05,
    block: 0.15, punching: 0.1, vampir: 0.001, accuracy: 1.0, expRewardMultiplier: 1.1,
    faction: 'Роботы', soundAttack: 'shotenemy', nowModel: 'g2', dead: 'dead', avatar: 'enemy', level: 1,
  },
  'Военные (tank)': {
    health: 400, damage: 6, dps: 6, speed: 0, crit: 0, armor: 5, evasion: 0.02,
    regen: 2, block: 0.05, punching: 0, accuracy: 1.0, vampir: 0,
    expRewardMultiplier: 2, rangeDistance: 5, runAp: 4, shotPrice: 4,
    skillUse: ['ram'], bigModel: '150%', faction: 'Военные',
    soundAttack: 'shotenemy', nowModel: 'tank', dead: 'dead', avatar: 'tank', level: 3,
  },
  'Военные (melee)': {
    health: 220, damage: 12, dps: 12, speed: 0.03, crit: 0.02, armor: 3, evasion: 0.02,
    regen: 0, block: 0.02, punching: 0, accuracy: 0.85, vampir: 0.5,
    expRewardMultiplier: 1.5, rangeDistance: 1, runAp: 4, shotPrice: 2,
    skillUse: ['ram'], bigModel: '110%', faction: 'Военные',
    soundAttack: 'melee', nowModel: 'melee', dead: 'dead', avatar: 'melee', level: 2,
  },
  'Военные (sniper)': {
    health: 120, damage: 25, dps: 25, speed: 0, crit: 0.10, armor: 1, evasion: 0,
    regen: 0, block: 0, punching: 0, accuracy: 1.2, vampir: 0,
    expRewardMultiplier: 2, rangeDistance: 18, runAp: 3, shotPrice: 3,
    skillUse: ['redZone', 'suppression', 'aimShot'], bigModel: '130%', faction: 'Военные',
    soundAttack: 'sniper', nowModel: 'sniperimg', dead: 'dead', avatar: 'sniperimg', level: 3,
  },
  'Военные (drob)': {
    health: 200, damage: 18, dps: 18, speed: 0.02, crit: 0.05, armor: 2, evasion: 0,
    regen: 0, block: 0, punching: 0.02, accuracy: 0.6, vampir: 0.02,
    expRewardMultiplier: 1.8, rangeDistance: 5, runAp: 4, shotPrice: 2,
    skillUse: ['aimShot', 'invisibility'], bigModel: '100%', faction: 'Военные',
    soundAttack: 'drob', nowModel: 'military1', dead: 'dead', avatar: 'military1', level: 2,
  },
  'Военные (original)': {
    health: 200, damage: 10, dps: 10, speed: 0.02, crit: 0.02, armor: 2,
    evasion: 0.01, regen: 0, block: 0.02, punching: 0.01, accuracy: 0.9, vampir: 0.02,
    expRewardMultiplier: 1, rangeDistance: 9, runAp: 6, shotPrice: 2,
    skillUse: ['grenade', 'stimulant'], bigModel: '100%', faction: 'Военные',
    soundAttack: 'pistol', nowModel: 'military2', dead: 'dead', avatar: 'military2', level: 2,
  },
  'Военные (medic)': {
    health: 160, damage: 8, dps: 8, speed: 0, crit: 0, armor: 1, evasion: 0,
    regen: 1, block: 0, punching: 0, accuracy: 2.0, vampir: 0,
    expRewardMultiplier: 1.2, rangeDistance: 9, runAp: 4, shotPrice: 1,
    skillUse: [''], bigModel: '100%', faction: 'Военные',
    soundAttack: 'healer', nowModel: 'medic', dead: 'dead', avatar: 'medic', level: 2,
  },
  'Военные (boss)': {
    health: 430, damage: 15, dps: 15, speed: 0.02, crit: 0.08, armor: 4, evasion: 0.03,
    regen: 2, block: 0.03, punching: 0.02, accuracy: 0.8, vampir: 0.05,
    expRewardMultiplier: 5, rangeDistance: 8, runAp: 5, shotPrice: 1,
    skillUse: ['madness', 'rage', 'summoner'], bigModel: '130%', faction: 'Военные',
    soundAttack: 'm134', nowModel: 'military3', dead: 'dead', avatar: 'military3', level: 5,
  },
};

export const generateEnemy = (
  playerLevel: number,
  difficultyModifier: number = 0,
): EnemyBaseDefinition & {
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
    scaledVampir: base.vampir * totalMult,
    scaledAccuracy: Math.min(2, base.accuracy + accuracyAdd),
  };
};
