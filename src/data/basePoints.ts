export interface BasePoint {
  name: string;
  level: number;
  className: string;
  upgrading: boolean;
  timer: number;
  description: string;
  maxLevel: number;
  costPerLevel: number;
}

export const BASE_POINTS: BasePoint[] = [
  { name: 'Верстаки', level: 1, className: 'base-workbench', upgrading: false, timer: 0, description: 'Повышает качество создаваемых предметов', maxLevel: 30, costPerLevel: 100 },
  { name: 'Огород', level: 1, className: 'base-garden', upgrading: false, timer: 0, description: 'Производит припасы и медикаменты', maxLevel: 30, costPerLevel: 80 },
  { name: 'Теплица', level: 1, className: 'base-greenhouse', upgrading: false, timer: 0, description: 'Улучшенное производство ресурсов', maxLevel: 30, costPerLevel: 120 },
  { name: 'Зона сна', level: 1, className: 'base-sleep', upgrading: false, timer: 0, description: 'Ускоряет восстановление выносливости', maxLevel: 30, costPerLevel: 50 },
  { name: 'Оружейная', level: 1, className: 'base-weapons', upgrading: false, timer: 0, description: 'Повышает урон всего оружия', maxLevel: 30, costPerLevel: 150 },
  { name: 'Броня', level: 1, className: 'base-armor', upgrading: false, timer: 0, description: 'Увеличивает защиту персонажа', maxLevel: 30, costPerLevel: 150 },
  { name: 'Дом. скот', level: 1, className: 'base-livestock', upgrading: false, timer: 0, description: 'Постоянный доход чипов', maxLevel: 30, costPerLevel: 100 },
  { name: 'Медицина', level: 1, className: 'base-medbay', upgrading: false, timer: 0, description: 'Улучшает лечение и регенерацию', maxLevel: 30, costPerLevel: 130 },
  { name: 'Развлечения', level: 1, className: 'base-fun', upgrading: false, timer: 0, description: 'Повышает мораль, даёт бонус к опыту', maxLevel: 30, costPerLevel: 60 },
  { name: 'Склад', level: 1, className: 'base-gym', upgrading: false, timer: 0, description: 'Увеличивает вместимость инвентаря', maxLevel: 30, costPerLevel: 90 },
  { name: 'Вышка', level: 1, className: 'base-watchtower', upgrading: false, timer: 0, description: 'Увеличивает обзор на карте', maxLevel: 30, costPerLevel: 110 },
];

export const BASE_STORAGE_KEY = 'remastered_basePoints';
