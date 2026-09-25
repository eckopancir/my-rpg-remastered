import type { AccessoryAbility } from '../types/abilities';

/** Боевые способности, дарованные сетами брони (панель арены, КД как у классовых). */
export const SET_ABILITY_DEFS: Record<string, AccessoryAbility> = {
  setb_ammo: {
    id: 'setb_ammo', name: 'Улучшенные бронебойные патроны', icon: '🔩',
    description: 'Пробитие +300% на 1 ход. КД 50. Дарует сет «Призрак» (5 вещей).',
    apCost: 2, cooldown: 50, powerRating: 65,
    effects: [{ type: 'stat_boost', stat: 'punching', value: 3.0, duration: 1 }],
  } as AccessoryAbility,
  setb_camo: {
    id: 'setb_camo', name: 'Улучшенная маскировка', icon: '👤',
    description: '+90% уклонения на 1 ход. КД 50. Дарует сет «Рейнджер» (5 вещей).',
    apCost: 2, cooldown: 50, powerRating: 65,
    effects: [{ type: 'stat_boost', stat: 'evasion', value: 0.9, duration: 1 }],
  } as AccessoryAbility,
  setb_medkit: {
    id: 'setb_medkit', name: 'Маленькая аптечка', icon: '🩹',
    description: 'Восстанавливает 15% здоровья. КД 50. Дарует сет «Тактик» (5 вещей).',
    apCost: 1, cooldown: 50, powerRating: 60,
    effects: [{ type: 'heal_percent', value: 15 } as any],
  } as AccessoryAbility,
  setb_exo: {
    id: 'setb_exo', name: 'Качественный экзоскелет', icon: '🦾',
    description: '−30% входящего урона на 5 ходов. КД 50. Дарует сет «Силовая броня» (5 вещей).',
    apCost: 1, cooldown: 50, powerRating: 65,
    effects: [{ type: 'stat_boost_mult', stat: 'incomingDamageMult', value: 0.7, duration: 5 }],
  } as AccessoryAbility,
  setb_rage: {
    id: 'setb_rage', name: 'Ярость джаггернаута', icon: '🤬',
    description: '+50% урона, +100% регена на 3 хода. КД 50. Дарует сет «Джаггернаут» (5 вещей).',
    apCost: 1, cooldown: 50, powerRating: 65,
    effects: [
      { type: 'stat_boost_mult', stat: 'damage', value: 0.5, duration: 3 },
      { type: 'stat_boost_mult', stat: 'regen', value: 1, duration: 3 },
    ],
  } as AccessoryAbility,
};

/** Подписи пассивок от сетов (для тултипа). */
export const SET_PASSIVE_LABELS: Record<string, string> = {
  sht_t7_rgheavy: 'Длинный ствол: тяжёлое',
  sht_t7_magheavy: 'Магазин: тяжёлое',
  set_second_wind: 'Второе дыхание (улучшенное)',
};
