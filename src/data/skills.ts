export interface SkillDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  maxPoints: number;
  reqPoints: number;
  statsPerPoint: string[];
}

export interface SkillClass {
  id: string;
  name: string;
  icon: string;
  color: string;
  skills: SkillDef[];
}

export const SKILL_CLASSES: SkillClass[] = [
  {
    id: 'soldier', name: 'Воин', icon: '⚔️', color: '#ef4444',
    skills: [
      { id: 'soldier_toughened', name: 'Укрепление', icon: '🛡️', desc: 'Увеличивает здоровье', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+10 HP'] },
      { id: 'soldier_heavy_hand', name: 'Тяжёлая рука', icon: '👊', desc: 'Увеличивает урон', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+1 DMG'] },
      { id: 'soldier_fighting_spirit', name: 'Боевой дух', icon: '🔥', desc: 'Увеличивает крит. шанс', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+1.5% CRIT'] },
      { id: 'soldier_iron_skin', name: 'Железная кожа', icon: '⛓️', desc: 'Увеличивает броню', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+2 ARM'] },
      { id: 'soldier_rage', name: 'Ярость', icon: '💢', desc: 'Скорость + крит', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+1.5% SPEED', '+1.5% CRIT'] },
      { id: 'soldier_retaliation', name: 'Возмездие', icon: '⚡', desc: 'Доп. урон', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+2 DMG'] },
      { id: 'soldier_unstoppable', name: 'Неудержимый', icon: '🧱', desc: 'Блок + HP', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+1.5% BLOCK', '+10 HP'] },
      { id: 'soldier_juggernaut', name: 'Танк', icon: '🏰', desc: 'Броня + уклонение', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+3 ARM', '+1.5% EVADE'] },
      { id: 'soldier_capstone', name: 'Герой Пустоши', icon: '👑', desc: 'Вершина мастерства', maxPoints: 1, reqPoints: 15, statsPerPoint: ['+50 HP', '+5% BLOCK', '+3% SPEED'] },
    ],
  },
  {
    id: 'demo', name: 'Подрывник', icon: '💥', color: '#f97316',
    skills: [
      { id: 'demo_explosives', name: 'Взрывчатка', icon: '💣', desc: 'Урон + огонь', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+1 DMG', '+1 FIRE'] },
      { id: 'demo_swift_hand', name: 'Лёгкая рука', icon: '🖐️', desc: 'Скорость', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+1% SPEED'] },
      { id: 'demo_burning', name: 'Горение', icon: '🔥', desc: 'Огненный урон', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+3 FIRE'] },
      { id: 'demo_shrapnel', name: 'Осколки', icon: '💫', desc: 'Крит. шанс', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+1.5% CRIT'] },
      { id: 'demo_fugas', name: 'Фугас', icon: '💢', desc: 'Огонь + дробящий', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+3 FIRE', '+1.5% PUNCH'] },
      { id: 'demo_molotov', name: 'Коктейль', icon: '🧪', desc: 'Урон + точность', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+2 DMG', '+1% ACC'] },
      { id: 'demo_thermo', name: 'Термоядерный', icon: '☢️', desc: 'Огонь + крит', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+5 FIRE', '+1.5% CRIT'] },
      { id: 'demo_fireworks', name: 'Фейерверк', icon: '🎆', desc: 'Скорость + урон', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+1.5% SPEED', '+2 DMG'] },
      { id: 'demo_capstone', name: 'Апокалипсис', icon: '💀', desc: 'Вершина мастерства', maxPoints: 1, reqPoints: 15, statsPerPoint: ['+20 FIRE', '+5% CRIT', '+5 DMG'] },
    ],
  },
  {
    id: 'night', name: 'Ночной клинок', icon: '🗡️', color: '#a78bfa',
    skills: [
      { id: 'night_shadow_step', name: 'Теневой шаг', icon: '🌑', desc: 'Скорость', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+1.5% SPEED'] },
      { id: 'night_sharp_blades', name: 'Острые клинки', icon: '🔪', desc: 'Крит + урон', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+1.5% CRIT', '+1 DMG'] },
      { id: 'night_dodge', name: 'Уклонение', icon: '💨', desc: 'Уклонение', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+1.5% EVADE'] },
      { id: 'night_precise', name: 'Точный удар', icon: '🎯', desc: 'Точность', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+1.5% ACC'] },
      { id: 'night_poison', name: 'Яд', icon: '☠️', desc: 'Вампиризм + урон', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+1.5% VAMP', '+2 DMG'] },
      { id: 'night_bleeding', name: 'Кровотечение', icon: '🩸', desc: 'Крит + скорость', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+2% CRIT', '+1.5% SPEED'] },
      { id: 'night_dark_mist', name: 'Тёмный туман', icon: '🌫️', desc: 'Уклонение + точность', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+2.5% EVADE', '+1.5% ACC'] },
      { id: 'night_death_dance', name: 'Танец смерти', icon: '💃', desc: 'Скорость + крит', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+2% SPEED', '+2% CRIT'] },
      { id: 'night_capstone', name: 'Убийца', icon: '🗡️', desc: 'Вершина мастерства', maxPoints: 1, reqPoints: 15, statsPerPoint: ['+10% CRIT', '+8% EVADE', '+10 DMG'] },
    ],
  },
  {
    id: 'arcanist', name: 'Арканист', icon: '🔮', color: '#60a5fa',
    skills: [
      { id: 'arcanist_shield', name: 'Маг. щит', icon: '🛡️', desc: 'Броня', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+2 ARM'] },
      { id: 'arcanist_focus', name: 'Концентрация', icon: '🧿', desc: 'Точность', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+1.5% ACC'] },
      { id: 'arcanist_regen', name: 'Регенерация', icon: '❤️', desc: 'Регенерация', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+1 REGEN'] },
      { id: 'arcanist_barrier', name: 'Энерг. барьер', icon: '🔵', desc: 'Блок', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+1.5% BLOCK'] },
      { id: 'arcanist_life_force', name: 'Живительная сила', icon: '💚', desc: 'HP + реген', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+10 HP', '+0.5 REGEN'] },
      { id: 'arcanist_distortion', name: 'Искажение', icon: '🌀', desc: 'Уклонение + блок', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+1.5% EVADE', '+1.5% BLOCK'] },
      { id: 'arcanist_aura', name: 'Защитная аура', icon: '✨', desc: 'Броня + реген', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+3 ARM', '+1 REGEN'] },
      { id: 'arcanist_restoration', name: 'Восстановление', icon: '💖', desc: 'HP + реген', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+15 HP', '+2 REGEN'] },
      { id: 'arcanist_capstone', name: 'Бессмертный', icon: '♾️', desc: 'Вершина мастерства', maxPoints: 1, reqPoints: 15, statsPerPoint: ['+50 HP', '+10 REGEN', '+5% BLOCK'] },
    ],
  },
  {
    id: 'occult', name: 'Оккультист', icon: '🔮', color: '#22c55e',
    skills: [
      { id: 'occult_dark_energy', name: 'Тёмная энергия', icon: '⚫', desc: 'ЭМИ + токс урон', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+1 ЭМИ', '+1 ТОКС'] },
      { id: 'occult_blood_thirst', name: 'Жажда крови', icon: '🩸', desc: 'Вампиризм', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+1.5% VAMP'] },
      { id: 'occult_curse', name: 'Проклятие', icon: '🔮', desc: 'Экстро урон + вампиризм', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+2 ЭКСТРО', '+1% VAMP'] },
      { id: 'occult_ritual', name: 'Ритуал', icon: '🕯️', desc: 'Крит + урон', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+1.5% CRIT', '+1 DMG'] },
      { id: 'occult_corruption', name: 'Порча', icon: '💀', desc: 'Все стихии + вампиризм', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+2 всех стихий', '+1.5% VAMP'] },
      { id: 'occult_necromancy', name: 'Некромантия', icon: '🧟', desc: 'Реген + вампиризм', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+1 REGEN', '+1.5% VAMP'] },
      { id: 'occult_sacrifice', name: 'Жертвоприношение', icon: '🔥', desc: 'Все стихии + крит', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+3 всех стихий', '+2% CRIT'] },
      { id: 'occult_demonic', name: 'Демон. сила', icon: '👿', desc: 'Все стихии + вампиризм', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+2 всех стихий', '+2% VAMP'] },
      { id: 'occult_capstone', name: 'Владыка тьмы', icon: '🌑', desc: 'Вершина мастерства', maxPoints: 1, reqPoints: 15, statsPerPoint: ['+10 всех стихий', '+8% VAMP', '+5% CRIT'] },
    ],
  },
  {
    id: 'berserker', name: 'Берсерк', icon: '💢', color: '#ff6b35',
    skills: [
      { id: 'berserker_frenzy', name: 'Исступление', icon: '🔥', desc: 'Урон + скорость', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+1 DMG', '+1% SPD'] },
      { id: 'berserker_bloodlust', name: 'Кровожадность', icon: '🩸', desc: 'Вампиризм', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+1.5% VAMP'] },
      { id: 'berserker_warcry', name: 'Боевой клич', icon: '📯', desc: 'Урон + пробитие', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+2 DMG', '+1.5% PUNCH'] },
      { id: 'berserker_brutal', name: 'Звериная сила', icon: '🐻', desc: 'Крит + урон', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+1.5% CRIT', '+1 DMG'] },
      { id: 'berserker_adrenaline', name: 'Адреналин', icon: '⚡', desc: 'Скорость + уклонение', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+1.5% SPD', '+1.5% EVADE'] },
      { id: 'berserker_berserk', name: 'Берсерк', icon: '😡', desc: 'Урон + крит', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+2 DMG', '+1.5% CRIT'] },
      { id: 'berserker_unleashed', name: 'Необузданность', icon: '💥', desc: 'Броня + урон', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+3 ARM', '+2 DMG'] },
      { id: 'berserker_eternal_rage', name: 'Вечная ярость', icon: '☄️', desc: 'Скорость + вампиризм', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+2% SPD', '+2% VAMP'] },
      { id: 'berserker_capstone', name: 'Бог войны', icon: '⚔️', desc: 'Вершина мастерства', maxPoints: 1, reqPoints: 15, statsPerPoint: ['+20 DMG', '+10% CRIT', '+5% VAMP'] },
    ],
  },
  {
    id: 'tank', name: 'Танк', icon: '🛡️', color: '#3b82f6',
    skills: [
      { id: 'tank_hardened', name: 'Закалка', icon: '⛓️', desc: 'Броня', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+2 ARM'] },
      { id: 'tank_vitality', name: 'Живучесть', icon: '❤️', desc: 'Здоровье', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+15 HP'] },
      { id: 'tank_shield_bash', name: 'Удар щитом', icon: '🛡️', desc: 'Блок + урон', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+1.5% BLOCK', '+1 DMG'] },
      { id: 'tank_iron_will', name: 'Железная воля', icon: '🧠', desc: 'Броня + реген', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+2 ARM', '+0.5 REGEN'] },
      { id: 'tank_fortress', name: 'Крепость', icon: '🏰', desc: 'HP + броня', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+15 HP', '+2 ARM'] },
      { id: 'tank_reflect', name: 'Отражение', icon: '🔁', desc: 'Блок + урон', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+1.5% BLOCK', '+1 DMG'] },
      { id: 'tank_immortal', name: 'Бессмертный', icon: '♾️', desc: 'HP + реген', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+20 HP', '+1 REGEN'] },
      { id: 'tank_paladin', name: 'Паладин', icon: '✝️', desc: 'Броня + вампиризм', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+3 ARM', '+1.5% VAMP'] },
      { id: 'tank_capstone', name: 'Колосс', icon: '🗿', desc: 'Вершина мастерства', maxPoints: 1, reqPoints: 15, statsPerPoint: ['+100 HP', '+15 ARM', '+5% BLOCK'] },
    ],
  },
  {
    id: 'sniper', name: 'Снайпер', icon: '🎯', color: '#22c55e',
    skills: [
      { id: 'sniper_focus', name: 'Фокус', icon: '👁️', desc: 'Меткость', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+1.5% ACC'] },
      { id: 'sniper_precision', name: 'Точность', icon: '🎯', desc: 'Крит', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+1.5% CRIT'] },
      { id: 'sniper_long_shot', name: 'Дальний выстрел', icon: '🏹', desc: 'Урон + меткость', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+1 DMG', '+1.5% ACC'] },
      { id: 'sniper_deadly_aim', name: 'Смертельный прицел', icon: '☠️', desc: 'Крит + урон', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+1.5% CRIT', '+2 DMG'] },
      { id: 'sniper_kill_zone', name: 'Зона поражения', icon: '📡', desc: 'Экстро + огонь', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+2 ЭКСТРО', '+2 FIRE'] },
      { id: 'sniper_executioner', name: 'Палач', icon: '🔪', desc: 'Урон + крит', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+3 DMG', '+1.5% CRIT'] },
      { id: 'sniper_armor_piercing', name: 'Бронебойность', icon: '💠', desc: 'Пробитие + урон', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+2% PUNCH', '+2 DMG'] },
      { id: 'sniper_nerves_steel', name: 'Стальные нервы', icon: '🧊', desc: 'Меткость + скорость', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+2% ACC', '+1.5% SPD'] },
      { id: 'sniper_capstone', name: 'Легенд. стрелок', icon: '🏆', desc: 'Вершина мастерства', maxPoints: 1, reqPoints: 15, statsPerPoint: ['+15 DMG', '+10% CRIT', '+10% ACC'] },
    ],
  },
  {
    id: 'survivor', name: 'Выживальщик', icon: '🏕️', color: '#eab308',
    skills: [
      { id: 'survivor_toughness', name: 'Выносливость', icon: '💪', desc: 'Здоровье', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+10 HP'] },
      { id: 'survivor_dodge', name: 'Уклонение', icon: '💨', desc: 'Уклонение', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+1.5% EVADE'] },
      { id: 'survivor_field_medic', name: 'Полевой медик', icon: '🩹', desc: 'Регенерация', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+1 REGEN'] },
      { id: 'survivor_scavenger', name: 'Добытчик', icon: '🔦', desc: 'Броня + уклонение', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+2 ARM', '+1.5% EVADE'] },
      { id: 'survivor_makeshift', name: 'Импровизация', icon: '🔧', desc: 'Блок + реген', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+1.5% BLOCK', '+0.5 REGEN'] },
      { id: 'survivor_camouflage', name: 'Камуфляж', icon: '🌿', desc: 'Уклонение + меткость', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+2% EVADE', '+1.5% ACC'] },
      { id: 'survivor_windrunner', name: 'Быстроногий', icon: '💨', desc: 'Скорость + уклонение', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+2% SPD', '+2% EVADE'] },
      { id: 'survivor_revitalize', name: 'Восстановление', icon: '💚', desc: 'Реген + HP', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+2 REGEN', '+15 HP'] },
      { id: 'survivor_capstone', name: 'Мастер выживания', icon: '🌟', desc: 'Вершина мастерства', maxPoints: 1, reqPoints: 15, statsPerPoint: ['+50 HP', '+10% EVADE', '+10 REGEN'] },
    ],
  },
  {
    id: 'merchant', name: 'Торговец', icon: '💰', color: '#f59e0b',
    skills: [
      { id: 'merchant_diplomacy', name: 'Дипломатия', icon: '🤝', desc: 'Меткость', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+1.5% ACC'] },
      { id: 'merchant_coin_throw', name: 'Метание монет', icon: '🪙', desc: 'Урон', maxPoints: 10, reqPoints: 0, statsPerPoint: ['+1 DMG'] },
      { id: 'merchant_insider', name: 'Осведомитель', icon: '🕵️', desc: 'Крит', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+1.5% CRIT'] },
      { id: 'merchant_black_market', name: 'Чёрный рынок', icon: '🏴', desc: 'Вампиризм', maxPoints: 10, reqPoints: 2, statsPerPoint: ['+1.5% VAMP'] },
      { id: 'merchant_protection', name: 'Крыша', icon: '☂️', desc: 'Броня + HP', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+2 ARM', '+10 HP'] },
      { id: 'merchant_money_talk', name: 'Деньги решают', icon: '💵', desc: 'Скорость + меткость', maxPoints: 10, reqPoints: 5, statsPerPoint: ['+1.5% SPD', '+1.5% ACC'] },
      { id: 'merchant_armored_transport', name: 'Бронетранспорт', icon: '🚛', desc: 'Броня + блок', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+3 ARM', '+1.5% BLOCK'] },
      { id: 'merchant_lucky', name: 'Фартовый', icon: '🍀', desc: 'Уклонение + крит', maxPoints: 10, reqPoints: 10, statsPerPoint: ['+2% EVADE', '+2% CRIT'] },
      { id: 'merchant_capstone', name: 'Магнат', icon: '👑', desc: 'Вершина мастерства', maxPoints: 1, reqPoints: 15, statsPerPoint: ['+50 HP', '+10% CRIT', '+5 DMG', '+10% ACC'] },
    ],
  },
];
