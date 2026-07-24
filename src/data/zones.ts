export interface Zone {
  name: string;
  difficulty: number;
  className: string;
  allowedFactions: string[];
  description: string;
  travelTime: number;
  minLevel: number;
  rewards: string[];
}

export const ZONES: Zone[] = [
  {
    name: 'Наша база', difficulty: 0, className: 'zone-base',
    allowedFactions: [], description: 'Ваше убежище. Здесь можно отдохнуть и восстановить силы.',
    travelTime: 0, minLevel: 1, rewards: [],
  },
  {
    name: 'Болото', difficulty: 5, className: 'zone-swamp',
    allowedFactions: ['Мутанты'], description: 'Туманные топи кишат мутантами. Опасная местность.',
    travelTime: 1, minLevel: 1, rewards: ['Обычные патроны', 'Бинт'],
  },
  {
    name: 'Заброшенная военная база и окрестности', difficulty: 15, className: 'zone-factory',
    allowedFactions: ['Военные'], description: 'Заброшенная военная база.',
    travelTime: 1, minLevel: 3, rewards: ['Оружие', 'Броня', 'Моды'],
  },
  {
    name: 'Свалка мусора', difficulty: 3, className: 'zone-forest',
    allowedFactions: ['Бандиты', 'Мутанты', 'Роботы'],
    description: 'Городская свалка. Можно найти запчасти и детали.',
    travelTime: 1, minLevel: 1, rewards: ['Материалы'],
  },
  {
    name: 'Темный лес', difficulty: 10, className: 'zone-military',
    allowedFactions: ['Мутанты', 'Роботы'],
    description: 'Древний лес, пораженный радиацией. Опасные твари.',
    travelTime: 1, minLevel: 2, rewards: ['Редкие материалы', 'Опыт'],
  },
  {
    name: 'Базар', difficulty: 0, className: 'zone-market',
    allowedFactions: [], description: 'Торговая точка. Можно купить и продать товары.',
    travelTime: 1, minLevel: 1, rewards: [],
  },
  {
    name: 'База бандитов', difficulty: 20, className: 'zone-cars',
    allowedFactions: ['Бандиты'],
    description: 'Укрепленный лагерь бандитов. Высокая награда.',
    travelTime: 1, minLevel: 4, rewards: ['Оружие', 'Чипы'],
  },
  {
    name: 'Руины города', difficulty: 8, className: 'zone-dump',
    allowedFactions: ['Мутанты', 'Бандиты'],
    description: 'Разрушенный город. Много укрытий и засад.',
    travelTime: 1, minLevel: 2, rewards: ['Припасы', 'Боеприпасы'],
  },
  {
    name: 'Старый завод', difficulty: 25, className: 'zone-village',
    allowedFactions: ['Бандиты', 'Военные', 'Роботы'],
    description: 'Заброшенный промышленный комплекс. Максимальная опасность.',
    travelTime: 1, minLevel: 5, rewards: ['Легендарные предметы', 'Чипы'],
  },
];

export const FACTIONS = ['Мутанты', 'Военные', 'Бандиты', 'Роботы'];

export const MILITARY_ENEMY_KEYS = [
  'Военные (tank)', 'Военные (melee)', 'Военные (sniper)',
  'Военные (drob)', 'Военные (original)', 'Военные (medic)', 'Военные (boss)',
];
