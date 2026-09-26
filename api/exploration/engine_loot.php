<?php
// ---------------------------------------------------------------------------
// Quality tiers & bonuses (ported from client)
// ---------------------------------------------------------------------------
define('QUALITY_TIERS', json_encode([
  ['name' => 'Обычный',    'chance' => 21.39, 'bonusStatsCount' => 0,  'color' => 'white',        'timeLimitMultiplier' => 1],
  ['name' => 'Редкий',     'chance' => 20.0,  'bonusStatsCount' => 1,  'color' => 'lime',         'timeLimitMultiplier' => 2],
  ['name' => 'Раритетный', 'chance' => 25.0,  'bonusStatsCount' => 2,  'color' => 'deepskyblue',  'timeLimitMultiplier' => 3],
  ['name' => 'Эпический',  'chance' => 22.5,  'bonusStatsCount' => 3,  'color' => 'mediumpurple', 'timeLimitMultiplier' => 4],
  ['name' => 'Смертоносный','chance' => 21.0, 'bonusStatsCount' => 5,  'color' => 'red',          'timeLimitMultiplier' => 5],
  ['name' => 'Легендарный','chance' => 20.1,  'bonusStatsCount' => 7,  'color' => 'gold',         'timeLimitMultiplier' => 6],
  ['name' => 'Божественный','chance' => 20.01,'bonusStatsCount' => 10, 'color' => 'cyan',         'timeLimitMultiplier' => 7],
]));

define('QUALITY_BONUSES', json_encode([
  'weapon1' => ['crit' => 0.005, 'vampir' => 0.005, 'punching' => 0.005, 'accuracy' => 0.005, 'damage' => 2],
  'weapon2' => ['crit' => 0.005, 'vampir' => 0.005, 'punching' => 0.005, 'accuracy' => 0.005, 'speed' => 0.02, 'dpsExtro' => 2, 'dpsFire' => 2, 'dpsEmi' => 2, 'dpsToxis' => 2, 'damage' => 3],
  'head'    => ['regen' => 2, 'block' => 0.04, 'evasion' => 0.004, 'armor' => 2, 'health' => 250],
  'armor'   => ['regen' => 2, 'block' => 0.04, 'evasion' => 0.004, 'armor' => 2, 'health' => 250],
  'gloves'  => ['regen' => 2, 'block' => 0.04, 'evasion' => 0.004, 'armor' => 2, 'health' => 250],
  'boots'   => ['regen' => 2, 'block' => 0.04, 'evasion' => 0.004, 'armor' => 2, 'health' => 250],
  'ammo'    => ['regen' => 0.01, 'block' => 0.024, 'evasion' => 0.002, 'armor' => 0.5, 'health' => 20, 'damage' => 0.5],
  'mod'     => ['regen' => 0.005, 'block' => 0.04, 'evasion' => 0.004, 'armor' => 2, 'health' => 250, 'damage' => 2, 'crit' => 0.005, 'vampir' => 0.005, 'punching' => 0.005, 'accuracy' => 0.0025, 'dpsExtro' => 1, 'dpsFire' => 1, 'dpsEmi' => 1, 'dpsToxis' => 1, 'ammoCapacity' => 5],
]));

define('RARITY_CHANCES', json_encode(['normal' => 50, 'epic' => 35, 'superepic' => 15]));

// ---------------------------------------------------------------------------
// Resource definitions
// ---------------------------------------------------------------------------
function getGameResources() {
  return [
    ['name' => 'Вода',       'rarity' => 'common', 'slot' => 'any', 'type' => 'material', 'stats' => new stdClass],
    ['name' => 'Изолента',    'rarity' => 'common', 'slot' => 'any', 'type' => 'material', 'stats' => new stdClass],
    ['name' => 'Железо',     'rarity' => 'common', 'slot' => 'any', 'type' => 'material', 'stats' => new stdClass],
    ['name' => 'Дерево',     'rarity' => 'common', 'slot' => 'any', 'type' => 'material', 'stats' => new stdClass],
    ['name' => 'Инструменты','rarity' => 'common', 'slot' => 'any', 'type' => 'material', 'stats' => new stdClass],
    ['name' => 'Гвозди',     'rarity' => 'common', 'slot' => 'any', 'type' => 'material', 'stats' => new stdClass],
    ['name' => 'Пластмасса', 'rarity' => 'common', 'slot' => 'any', 'type' => 'material', 'stats' => new stdClass],
    ['name' => 'Металлолом', 'rarity' => 'common', 'slot' => 'any', 'type' => 'material', 'stats' => new stdClass],
    ['name' => 'Провода',    'rarity' => 'common', 'slot' => 'any', 'type' => 'material', 'stats' => new stdClass],
    ['name' => 'Микросхема', 'rarity' => 'common', 'slot' => 'any', 'type' => 'material', 'stats' => new stdClass],
    ['name' => 'Хим. реагент','rarity' => 'common','slot' => 'any', 'type' => 'material', 'stats' => new stdClass],
    ['name' => 'Редкий сплав','rarity' => 'common','slot' => 'any', 'type' => 'material', 'stats' => new stdClass],
    ['name' => 'Топливо',    'rarity' => 'common', 'slot' => 'any', 'type' => 'material', 'stats' => new stdClass],
    ['name' => 'Батарейки',  'rarity' => 'common', 'slot' => 'any', 'type' => 'material', 'stats' => new stdClass],
    ['name' => 'Консервы',   'rarity' => 'common', 'slot' => 'any', 'type' => 'material', 'stats' => new stdClass],
    ['name' => 'Лекарства',  'rarity' => 'common', 'slot' => 'any', 'type' => 'material', 'stats' => new stdClass],
  ];
}

// ---------------------------------------------------------------------------
// Item definitions (key equipment)
// ---------------------------------------------------------------------------
function getGameItems() {
  return [
    // Melee weapons (weapon1)
    ['name' => 'Нож',             'rarity' => 'normal',    'slot' => 'weapon1', 'stats' => ['damage' => 4, 'crit' => 0.01]],
    ['name' => 'Мачето',          'rarity' => 'normal',    'slot' => 'weapon1', 'stats' => ['damage' => 6, 'crit' => 0.02]],
    ['name' => 'Бейсбольная бита','rarity' => 'normal',    'slot' => 'weapon1', 'stats' => ['damage' => 5, 'crit' => 0.01, 'armor' => 1]],
    ['name' => 'Катана',          'rarity' => 'epic',      'slot' => 'weapon1', 'stats' => ['damage' => 12, 'crit' => 0.05]],
    ['name' => 'Тесак',           'rarity' => 'normal',    'slot' => 'weapon1', 'stats' => ['damage' => 8, 'crit' => 0.03]],
    ['name' => 'Кувалда',         'rarity' => 'normal',    'slot' => 'weapon1', 'stats' => ['damage' => 10, 'accuracy' => -0.05, 'armor' => 2]],
    ['name' => 'Электро-дубина',  'rarity' => 'epic',      'slot' => 'weapon1', 'stats' => ['damage' => 7, 'crit' => 0.04, 'dpsEmi' => 3]],
    ['name' => 'Костяная булава', 'rarity' => 'epic',      'slot' => 'weapon1', 'stats' => ['damage' => 9, 'dpsToxis' => 0.5, 'vampir' => 0.01]],

    // Firearms (weapon2)
    ['name' => 'Пистолет ТТ',    'rarity' => 'normal',    'slot' => 'weapon2', 'stats' => ['damage' => 8, 'crit' => 0.03], 'ammoCapacity' => 8],
    ['name' => 'UZI',           'rarity' => 'normal',    'slot' => 'weapon2', 'stats' => ['damage' => 6, 'speed' => 0.08], 'ammoCapacity' => 32],
    ['name' => 'Thompson',      'rarity' => 'normal',    'slot' => 'weapon2', 'stats' => ['damage' => 8], 'ammoCapacity' => 100],
    ['name' => 'AK-47',         'rarity' => 'normal',    'slot' => 'weapon2', 'stats' => ['damage' => 12, 'crit' => 0.02, 'punching' => 0.02], 'ammoCapacity' => 30],
    ['name' => 'Дробовик',        'rarity' => 'normal',    'slot' => 'weapon2', 'stats' => ['damage' => 14, 'accuracy' => 0.7, 'armor' => -2], 'ammoCapacity' => 6],
    ['name' => 'Винтовка СВД',   'rarity' => 'epic',      'slot' => 'weapon2', 'stats' => ['damage' => 16, 'crit' => 0.05], 'ammoCapacity' => 10],
    ['name' => 'M16A4',         'rarity' => 'normal',    'slot' => 'weapon2', 'stats' => ['damage' => 10, 'crit' => 0.02], 'ammoCapacity' => 30],
    ['name' => 'Снайперская винтовка','rarity' => 'epic',  'slot' => 'weapon2', 'stats' => ['damage' => 22, 'crit' => 0.08], 'ammoCapacity' => 5],

    // Armor sets (12 комплектов × 5; PHP-статы: health вместо maxHp)
    ['name' => 'Капюшон призрака', 'rarity' => 'superepic', 'slot' => 'head', 'set' => 'Призрак', 'stats' => ['armor' => 6, 'health' => 82, 'evasion' => 0.0099, 'crit' => 0.01, 'speed' => 0.0082, 'accuracy' => 0.005, 'stamina' => 2.475]],
    ['name' => 'Плащ призрака', 'rarity' => 'superepic', 'slot' => 'armor', 'set' => 'Призрак', 'stats' => ['armor' => 12, 'health' => 172, 'evasion' => 0.0204, 'crit' => 0.02, 'speed' => 0.0172, 'accuracy' => 0.01, 'stamina' => 5.1]],
    ['name' => 'Штаны призрака', 'rarity' => 'superepic', 'slot' => 'pants', 'set' => 'Призрак', 'stats' => ['armor' => 6, 'health' => 82, 'evasion' => 0.0099, 'crit' => 0.01, 'speed' => 0.0082, 'accuracy' => 0.005, 'stamina' => 2.475]],
    ['name' => 'Наручи призрака', 'rarity' => 'superepic', 'slot' => 'gloves', 'set' => 'Призрак', 'stats' => ['armor' => 6, 'health' => 82, 'evasion' => 0.0099, 'crit' => 0.01, 'speed' => 0.0082, 'accuracy' => 0.005, 'stamina' => 2.475]],
    ['name' => 'Башмаки призрака', 'rarity' => 'superepic', 'slot' => 'boots', 'set' => 'Призрак', 'stats' => ['armor' => 6, 'health' => 82, 'evasion' => 0.0099, 'crit' => 0.01, 'speed' => 0.0082, 'accuracy' => 0.005, 'stamina' => 2.475]],
    ['name' => 'Шлем разведчика', 'rarity' => 'normal', 'slot' => 'head', 'set' => 'Разведчик', 'stats' => ['armor' => 5.75, 'health' => 107, 'evasion' => 0.0041, 'speed' => 0.005, 'accuracy' => 0.0033, 'stamina' => 3.3, 'regen' => 0.5]],
    ['name' => 'Куртка разведчика', 'rarity' => 'normal', 'slot' => 'armor', 'set' => 'Разведчик', 'stats' => ['armor' => 12, 'health' => 222, 'evasion' => 0.0085, 'speed' => 0.01, 'accuracy' => 0.0068, 'stamina' => 6.8, 'regen' => 1]],
    ['name' => 'Штаны разведчика', 'rarity' => 'normal', 'slot' => 'pants', 'set' => 'Разведчик', 'stats' => ['armor' => 5.75, 'health' => 107, 'evasion' => 0.0041, 'speed' => 0.005, 'accuracy' => 0.0033, 'stamina' => 3.3, 'regen' => 0.5]],
    ['name' => 'Перчатки разведчика', 'rarity' => 'normal', 'slot' => 'gloves', 'set' => 'Разведчик', 'stats' => ['armor' => 5.75, 'health' => 107, 'evasion' => 0.0041, 'speed' => 0.005, 'accuracy' => 0.0033, 'stamina' => 3.3, 'regen' => 0.5]],
    ['name' => 'Ботинки разведчика', 'rarity' => 'normal', 'slot' => 'boots', 'set' => 'Разведчик', 'stats' => ['armor' => 5.75, 'health' => 107, 'evasion' => 0.0041, 'speed' => 0.005, 'accuracy' => 0.0033, 'stamina' => 3.3, 'regen' => 0.5]],
    ['name' => 'Шлем рейнджера', 'rarity' => 'epic', 'slot' => 'head', 'set' => 'Рейнджер', 'stats' => ['armor' => 6.625, 'health' => 132, 'evasion' => 0.0033, 'speed' => 0.0033, 'accuracy' => 0.0033, 'stamina' => 1.975, 'vampir' => 0.0082]],
    ['name' => 'Броня рейнджера', 'rarity' => 'epic', 'slot' => 'armor', 'set' => 'Рейнджер', 'stats' => ['armor' => 13.5, 'health' => 272, 'evasion' => 0.0068, 'speed' => 0.0068, 'accuracy' => 0.0068, 'stamina' => 4.1, 'vampir' => 0.0172]],
    ['name' => 'Штаны рейнджера', 'rarity' => 'epic', 'slot' => 'pants', 'set' => 'Рейнджер', 'stats' => ['armor' => 6.625, 'health' => 132, 'evasion' => 0.0033, 'speed' => 0.0033, 'accuracy' => 0.0033, 'stamina' => 1.975, 'vampir' => 0.0082]],
    ['name' => 'Перчатки рейнджера', 'rarity' => 'epic', 'slot' => 'gloves', 'set' => 'Рейнджер', 'stats' => ['armor' => 6.625, 'health' => 132, 'evasion' => 0.0033, 'speed' => 0.0033, 'accuracy' => 0.0033, 'stamina' => 1.975, 'vampir' => 0.0082]],
    ['name' => 'Ботинки рейнджера', 'rarity' => 'epic', 'slot' => 'boots', 'set' => 'Рейнджер', 'stats' => ['armor' => 6.625, 'health' => 132, 'evasion' => 0.0033, 'speed' => 0.0033, 'accuracy' => 0.0033, 'stamina' => 1.975, 'vampir' => 0.0082]],
    ['name' => 'Шлем тактика', 'rarity' => 'epic', 'slot' => 'head', 'set' => 'Тактик', 'stats' => ['armor' => 8.25, 'health' => 165, 'block' => 0.165, 'evasion' => 0.0033, 'accuracy' => 0.0017, 'stamina' => 1.65, 'regen' => 0.5]],
    ['name' => 'Броня тактика', 'rarity' => 'epic', 'slot' => 'armor', 'set' => 'Тактик', 'stats' => ['armor' => 17, 'health' => 340, 'block' => 0.34, 'evasion' => 0.0068, 'accuracy' => 0.0034, 'stamina' => 3.4, 'regen' => 1]],
    ['name' => 'Штаны тактика', 'rarity' => 'epic', 'slot' => 'pants', 'set' => 'Тактик', 'stats' => ['armor' => 8.25, 'health' => 165, 'block' => 0.165, 'evasion' => 0.0033, 'accuracy' => 0.0017, 'stamina' => 1.65, 'regen' => 0.5]],
    ['name' => 'Перчатки тактика', 'rarity' => 'epic', 'slot' => 'gloves', 'set' => 'Тактик', 'stats' => ['armor' => 8.25, 'health' => 165, 'block' => 0.165, 'evasion' => 0.0033, 'accuracy' => 0.0017, 'stamina' => 1.65, 'regen' => 0.5]],
    ['name' => 'Ботинки тактика', 'rarity' => 'epic', 'slot' => 'boots', 'set' => 'Тактик', 'stats' => ['armor' => 8.25, 'health' => 165, 'block' => 0.165, 'evasion' => 0.0033, 'accuracy' => 0.0017, 'stamina' => 1.65, 'regen' => 0.5]],
    ['name' => 'Шлем штурмовика', 'rarity' => 'superepic', 'slot' => 'head', 'set' => 'Штурмовик', 'stats' => ['armor' => 9.875, 'health' => 247.5, 'block' => 0.2475, 'evasion' => 0.0017, 'accuracy' => 0.0017, 'crit' => 0.0033, 'stamina' => 1.975, 'regen' => 0.825]],
    ['name' => 'Броня штурмовика', 'rarity' => 'superepic', 'slot' => 'armor', 'set' => 'Штурмовик', 'stats' => ['armor' => 20.5, 'health' => 510, 'block' => 0.51, 'evasion' => 0.0034, 'accuracy' => 0.0034, 'crit' => 0.0068, 'stamina' => 4.1, 'regen' => 1.7]],
    ['name' => 'Штаны штурмовика', 'rarity' => 'superepic', 'slot' => 'pants', 'set' => 'Штурмовик', 'stats' => ['armor' => 9.875, 'health' => 247.5, 'block' => 0.2475, 'evasion' => 0.0017, 'accuracy' => 0.0017, 'crit' => 0.0033, 'stamina' => 1.975, 'regen' => 0.825]],
    ['name' => 'Перчатки штурмовика', 'rarity' => 'superepic', 'slot' => 'gloves', 'set' => 'Штурмовик', 'stats' => ['armor' => 9.875, 'health' => 247.5, 'block' => 0.2475, 'evasion' => 0.0017, 'accuracy' => 0.0017, 'crit' => 0.0033, 'stamina' => 1.975, 'regen' => 0.825]],
    ['name' => 'Ботинки штурмовика', 'rarity' => 'superepic', 'slot' => 'boots', 'set' => 'Штурмовик', 'stats' => ['armor' => 9.875, 'health' => 247.5, 'block' => 0.2475, 'evasion' => 0.0017, 'accuracy' => 0.0017, 'crit' => 0.0033, 'stamina' => 1.975, 'regen' => 0.825]],
    ['name' => 'Шлем рейдера', 'rarity' => 'normal', 'slot' => 'head', 'set' => 'Рейдер', 'stats' => ['armor' => 11.5, 'health' => 297, 'evasion' => 0.0008, 'stamina' => 2.475, 'speed' => -0.0082, 'accuracy' => -0.005]],
    ['name' => 'Броня рейдера', 'rarity' => 'normal', 'slot' => 'armor', 'set' => 'Рейдер', 'stats' => ['armor' => 24, 'health' => 612, 'evasion' => 0.0017, 'stamina' => 5.1, 'speed' => -0.017, 'accuracy' => -0.01]],
    ['name' => 'Штаны рейдера', 'rarity' => 'normal', 'slot' => 'pants', 'set' => 'Рейдер', 'stats' => ['armor' => 11.5, 'health' => 297, 'evasion' => 0.0008, 'stamina' => 2.475, 'speed' => -0.0082, 'accuracy' => -0.005]],
    ['name' => 'Перчатки рейдера', 'rarity' => 'normal', 'slot' => 'gloves', 'set' => 'Рейдер', 'stats' => ['armor' => 11.5, 'health' => 297, 'evasion' => 0.0008, 'stamina' => 2.475, 'speed' => -0.0082, 'accuracy' => -0.005]],
    ['name' => 'Ботинки рейдера', 'rarity' => 'normal', 'slot' => 'boots', 'set' => 'Рейдер', 'stats' => ['armor' => 11.5, 'health' => 297, 'evasion' => 0.0008, 'stamina' => 2.475, 'speed' => -0.0082, 'accuracy' => -0.005]],
    ['name' => 'Экзо-шлем', 'rarity' => 'epic', 'slot' => 'head', 'set' => 'Экзокостюм', 'stats' => ['armor' => 14.875, 'health' => 280, 'block' => 0.33, 'regen' => 1.65, 'stamina' => 4.95, 'speed' => -0.01, 'accuracy' => -0.0033, 'evasion' => -0.0082]],
    ['name' => 'Экзокостюм', 'rarity' => 'epic', 'slot' => 'armor', 'set' => 'Экзокостюм', 'stats' => ['armor' => 30.5, 'health' => 580, 'block' => 0.68, 'regen' => 3.4, 'stamina' => 10.2, 'speed' => -0.02, 'accuracy' => -0.0068, 'evasion' => -0.017]],
    ['name' => 'Экзо-штаны', 'rarity' => 'epic', 'slot' => 'pants', 'set' => 'Экзокостюм', 'stats' => ['armor' => 14.875, 'health' => 280, 'block' => 0.33, 'regen' => 1.65, 'stamina' => 4.95, 'speed' => -0.01, 'accuracy' => -0.0033, 'evasion' => -0.0082]],
    ['name' => 'Экзо-перчатки', 'rarity' => 'epic', 'slot' => 'gloves', 'set' => 'Экзокостюм', 'stats' => ['armor' => 14.875, 'health' => 280, 'block' => 0.33, 'regen' => 1.65, 'stamina' => 4.95, 'speed' => -0.01, 'accuracy' => -0.0033, 'evasion' => -0.0082]],
    ['name' => 'Экзо-ботинки', 'rarity' => 'epic', 'slot' => 'boots', 'set' => 'Экзокостюм', 'stats' => ['armor' => 14.875, 'health' => 280, 'block' => 0.33, 'regen' => 1.65, 'stamina' => 4.95, 'speed' => -0.01, 'accuracy' => -0.0033, 'evasion' => -0.0082]],
    ['name' => 'Шлем силовой брони', 'rarity' => 'epic', 'slot' => 'head', 'set' => 'Силовая броня', 'stats' => ['armor' => 16.5, 'health' => 594, 'block' => 0.5275, 'regen' => 1.975, 'stamina' => 3.3, 'speed' => -0.0198, 'accuracy' => -0.01, 'evasion' => -0.0165]],
    ['name' => 'Силовая броня', 'rarity' => 'epic', 'slot' => 'armor', 'set' => 'Силовая броня', 'stats' => ['armor' => 34, 'health' => 1224, 'block' => 1.09, 'regen' => 4.1, 'stamina' => 6.8, 'speed' => -0.041, 'accuracy' => -0.02, 'evasion' => -0.034]],
    ['name' => 'Штаны силовой брони', 'rarity' => 'epic', 'slot' => 'pants', 'set' => 'Силовая броня', 'stats' => ['armor' => 16.5, 'health' => 594, 'block' => 0.5275, 'regen' => 1.975, 'stamina' => 3.3, 'speed' => -0.0198, 'accuracy' => -0.01, 'evasion' => -0.0165]],
    ['name' => 'Перчатки силовой брони', 'rarity' => 'epic', 'slot' => 'gloves', 'set' => 'Силовая броня', 'stats' => ['armor' => 16.5, 'health' => 594, 'block' => 0.5275, 'regen' => 1.975, 'stamina' => 3.3, 'speed' => -0.0198, 'accuracy' => -0.01, 'evasion' => -0.0165]],
    ['name' => 'Сапоги силовой брони', 'rarity' => 'epic', 'slot' => 'boots', 'set' => 'Силовая броня', 'stats' => ['armor' => 16.5, 'health' => 594, 'block' => 0.5275, 'regen' => 1.975, 'stamina' => 3.3, 'speed' => -0.0198, 'accuracy' => -0.01, 'evasion' => -0.0165]],
    ['name' => 'Шлем джаггернаута', 'rarity' => 'superepic', 'slot' => 'head', 'set' => 'Джаггернаут', 'stats' => ['armor' => 20.625, 'health' => 825, 'block' => 0.66, 'regen' => 3.3, 'stamina' => 4.95, 'speed' => -0.033, 'accuracy' => -0.0165, 'evasion' => -0.05]],
    ['name' => 'Броня джаггернаута', 'rarity' => 'superepic', 'slot' => 'armor', 'set' => 'Джаггернаут', 'stats' => ['armor' => 42.5, 'health' => 1700, 'block' => 1.36, 'regen' => 6.8, 'stamina' => 10.2, 'speed' => -0.068, 'accuracy' => -0.034, 'evasion' => -0.1]],
    ['name' => 'Штаны джаггернаута', 'rarity' => 'superepic', 'slot' => 'pants', 'set' => 'Джаггернаут', 'stats' => ['armor' => 20.625, 'health' => 825, 'block' => 0.66, 'regen' => 3.3, 'stamina' => 4.95, 'speed' => -0.033, 'accuracy' => -0.0165, 'evasion' => -0.05]],
    ['name' => 'Перчатки джаггернаута', 'rarity' => 'superepic', 'slot' => 'gloves', 'set' => 'Джаггернаут', 'stats' => ['armor' => 20.625, 'health' => 825, 'block' => 0.66, 'regen' => 3.3, 'stamina' => 4.95, 'speed' => -0.033, 'accuracy' => -0.0165, 'evasion' => -0.05]],
    ['name' => 'Ботинки джаггернаута', 'rarity' => 'superepic', 'slot' => 'boots', 'set' => 'Джаггернаут', 'stats' => ['armor' => 20.625, 'health' => 825, 'block' => 0.66, 'regen' => 3.3, 'stamina' => 4.95, 'speed' => -0.033, 'accuracy' => -0.0165, 'evasion' => -0.05]],
    ['name' => 'Шлем бродяги', 'rarity' => 'normal', 'slot' => 'head', 'set' => 'Бродяга', 'stats' => ['armor' => 7.375, 'health' => 148, 'block' => 0.0825, 'evasion' => 0.0008, 'stamina' => 0.825, 'regen' => 0.165]],
    ['name' => 'Куртка бродяги', 'rarity' => 'normal', 'slot' => 'armor', 'set' => 'Бродяга', 'stats' => ['armor' => 15.5, 'health' => 308, 'block' => 0.17, 'evasion' => 0.0017, 'stamina' => 1.7, 'regen' => 0.34]],
    ['name' => 'Штаны бродяги', 'rarity' => 'normal', 'slot' => 'pants', 'set' => 'Бродяга', 'stats' => ['armor' => 7.375, 'health' => 148, 'block' => 0.0825, 'evasion' => 0.0008, 'stamina' => 0.825, 'regen' => 0.165]],
    ['name' => 'Перчатки бродяги', 'rarity' => 'normal', 'slot' => 'gloves', 'set' => 'Бродяга', 'stats' => ['armor' => 7.375, 'health' => 148, 'block' => 0.0825, 'evasion' => 0.0008, 'stamina' => 0.825, 'regen' => 0.165]],
    ['name' => 'Ботинки бродяги', 'rarity' => 'normal', 'slot' => 'boots', 'set' => 'Бродяга', 'stats' => ['armor' => 7.375, 'health' => 148, 'block' => 0.0825, 'evasion' => 0.0008, 'stamina' => 0.825, 'regen' => 0.165]],
    ['name' => 'Шлем мусорщика', 'rarity' => 'normal', 'slot' => 'head', 'set' => 'Мусорщик', 'stats' => ['armor' => 5, 'health' => 82, 'evasion' => 0.0008, 'stamina' => 0.5, 'regen' => 0.0825]],
    ['name' => 'Куртка мусорщика', 'rarity' => 'normal', 'slot' => 'armor', 'set' => 'Мусорщик', 'stats' => ['armor' => 10, 'health' => 172, 'evasion' => 0.0017, 'stamina' => 1, 'regen' => 0.17]],
    ['name' => 'Штаны мусорщика', 'rarity' => 'normal', 'slot' => 'pants', 'set' => 'Мусорщик', 'stats' => ['armor' => 5, 'health' => 82, 'evasion' => 0.0008, 'stamina' => 0.5, 'regen' => 0.0825]],
    ['name' => 'Перчатки мусорщика', 'rarity' => 'normal', 'slot' => 'gloves', 'set' => 'Мусорщик', 'stats' => ['armor' => 5, 'health' => 82, 'evasion' => 0.0008, 'stamina' => 0.5, 'regen' => 0.0825]],
    ['name' => 'Ботинки мусорщика', 'rarity' => 'normal', 'slot' => 'boots', 'set' => 'Мусорщик', 'stats' => ['armor' => 5, 'health' => 82, 'evasion' => 0.0008, 'stamina' => 0.5, 'regen' => 0.0825]],
    ['name' => 'Шлем военного', 'rarity' => 'normal', 'slot' => 'head', 'set' => 'Военный', 'stats' => ['armor' => 9.125, 'health' => 214, 'block' => 0.165, 'evasion' => 0.0017, 'accuracy' => 0.0017, 'stamina' => 1.325, 'regen' => 0.33]],
    ['name' => 'Броня военного', 'rarity' => 'normal', 'slot' => 'armor', 'set' => 'Военный', 'stats' => ['armor' => 18.5, 'health' => 444, 'block' => 0.34, 'evasion' => 0.0034, 'accuracy' => 0.0034, 'stamina' => 2.7, 'regen' => 0.68]],
    ['name' => 'Штаны военного', 'rarity' => 'normal', 'slot' => 'pants', 'set' => 'Военный', 'stats' => ['armor' => 9.125, 'health' => 214, 'block' => 0.165, 'evasion' => 0.0017, 'accuracy' => 0.0017, 'stamina' => 1.325, 'regen' => 0.33]],
    ['name' => 'Перчатки военного', 'rarity' => 'normal', 'slot' => 'gloves', 'set' => 'Военный', 'stats' => ['armor' => 9.125, 'health' => 214, 'block' => 0.165, 'evasion' => 0.0017, 'accuracy' => 0.0017, 'stamina' => 1.325, 'regen' => 0.33]],
    ['name' => 'Ботинки военного', 'rarity' => 'normal', 'slot' => 'boots', 'set' => 'Военный', 'stats' => ['armor' => 9.125, 'health' => 214, 'block' => 0.165, 'evasion' => 0.0017, 'accuracy' => 0.0017, 'stamina' => 1.325, 'regen' => 0.33]],
    ['name' => 'Шлем лесничего', 'rarity' => 'normal', 'slot' => 'head', 'set' => 'Лесничий', 'stats' => ['armor' => 3.3, 'health' => 57.75, 'evasion' => 0.0005, 'stamina' => 0.33, 'regen' => 0.0495]],
    ['name' => 'Куртка лесничего', 'rarity' => 'normal', 'slot' => 'armor', 'set' => 'Лесничий', 'stats' => ['armor' => 6.8, 'health' => 119, 'evasion' => 0.00102, 'stamina' => 0.68, 'regen' => 0.102]],
    ['name' => 'Штаны лесничего', 'rarity' => 'normal', 'slot' => 'pants', 'set' => 'Лесничий', 'stats' => ['armor' => 3.3, 'health' => 57.75, 'evasion' => 0.0005, 'stamina' => 0.33, 'regen' => 0.0495]],
    ['name' => 'Перчатки лесничего', 'rarity' => 'normal', 'slot' => 'gloves', 'set' => 'Лесничий', 'stats' => ['armor' => 3.3, 'health' => 57.75, 'evasion' => 0.0005, 'stamina' => 0.33, 'regen' => 0.0495]],
    ['name' => 'Ботинки лесничего', 'rarity' => 'normal', 'slot' => 'boots', 'set' => 'Лесничий', 'stats' => ['armor' => 3.3, 'health' => 57.75, 'evasion' => 0.0005, 'stamina' => 0.33, 'regen' => 0.0495]],
    ['name' => 'Шлем учёного', 'rarity' => 'superepic', 'slot' => 'head', 'set' => 'Учёный', 'stats' => ['armor' => 13.2, 'health' => 412, 'regen' => 6.6, 'stamina' => 5.75, 'evasion' => -0.0165]],
    ['name' => 'Броня учёного', 'rarity' => 'superepic', 'slot' => 'armor', 'set' => 'Учёный', 'stats' => ['armor' => 27.2, 'health' => 850, 'regen' => 13.6, 'stamina' => 12, 'evasion' => -0.034]],
    ['name' => 'Штаны учёного', 'rarity' => 'superepic', 'slot' => 'pants', 'set' => 'Учёный', 'stats' => ['armor' => 13.2, 'health' => 412, 'regen' => 6.6, 'stamina' => 5.75, 'evasion' => -0.0165]],
    ['name' => 'Перчатки учёного', 'rarity' => 'superepic', 'slot' => 'gloves', 'set' => 'Учёный', 'stats' => ['armor' => 13.2, 'health' => 412, 'regen' => 6.6, 'stamina' => 5.75, 'evasion' => -0.0165]],
    ['name' => 'Ботинки учёного', 'rarity' => 'superepic', 'slot' => 'boots', 'set' => 'Учёный', 'stats' => ['armor' => 13.2, 'health' => 412, 'regen' => 6.6, 'stamina' => 5.75, 'evasion' => -0.0165]],
    ['name' => 'Шлем дикаря', 'rarity' => 'normal', 'slot' => 'head', 'set' => 'Дикарь', 'stats' => ['armor' => 5.775, 'health' => 165, 'vampir' => 0.02, 'stamina' => 1.65]],
    ['name' => 'Броня дикаря', 'rarity' => 'normal', 'slot' => 'armor', 'set' => 'Дикарь', 'stats' => ['armor' => 11.9, 'health' => 340, 'vampir' => 0.04, 'stamina' => 3.4]],
    ['name' => 'Штаны дикаря', 'rarity' => 'normal', 'slot' => 'pants', 'set' => 'Дикарь', 'stats' => ['armor' => 5.775, 'health' => 165, 'vampir' => 0.02, 'stamina' => 1.65]],
    ['name' => 'Перчатки дикаря', 'rarity' => 'normal', 'slot' => 'gloves', 'set' => 'Дикарь', 'stats' => ['armor' => 5.775, 'health' => 165, 'vampir' => 0.02, 'stamina' => 1.65]],
    ['name' => 'Ботинки дикаря', 'rarity' => 'normal', 'slot' => 'boots', 'set' => 'Дикарь', 'stats' => ['armor' => 5.775, 'health' => 165, 'vampir' => 0.02, 'stamina' => 1.65]],

    // Ammo
    ['name' => 'Обычные патроны',         'rarity' => 'normal',    'slot' => 'ammo', 'stats' => ['damage' => 2]],
    ['name' => 'Бинт из тряпки',          'rarity' => 'normal',    'slot' => 'ammo', 'stats' => ['regen' => 0.1, 'health' => 18]],
    ['name' => 'Аптечка экстренная',      'rarity' => 'superepic', 'slot' => 'ammo', 'stats' => ['health' => 90]],
    ['name' => 'Стимулятор',              'rarity' => 'superepic', 'slot' => 'ammo', 'stats' => ['damage' => 4]],
  ];
}

// ---------------------------------------------------------------------------
// Utility: pick by weighted random
// ---------------------------------------------------------------------------
function weightedPick($items, $weightKey = 'chance') {
  $total = array_sum(array_column($items, $weightKey));
  $rand = mt_rand() / mt_getrandmax() * $total;
  foreach ($items as $item) {
    $rand -= $item[$weightKey];
    if ($rand <= 0) return $item;
  }
  return $items[0];
}

function pickRandom($arr) {
  return $arr[array_rand($arr)];
}

function generateUid() {
  return 'loot_' . bin2hex(random_bytes(8));
}

// ---------------------------------------------------------------------------
// Generate a single equipment item (ported from client generateItem)
// ---------------------------------------------------------------------------
function generateItem($playerLevel, $guaranteedRarity = null, $slotFilter = null) {
  $items = getGameItems();

  // 1. Pick rarity
  if ($guaranteedRarity) {
    $selectedRarity = $guaranteedRarity;
  } else {
    $rarityChances = json_decode(RARITY_CHANCES, true);
    $total = array_sum($rarityChances);
    $rand = mt_rand() / mt_getrandmax() * $total;
    $selectedRarity = 'normal';
    foreach ($rarityChances as $key => $chance) {
      $rand -= $chance;
      if ($rand <= 0) { $selectedRarity = $key; break; }
    }
  }

  // 2. Filter items (closures instead of fn() — Apache runs PHP 7.0/7.1)
  if ($slotFilter) {
    $filtered = array_values(array_filter($items, function ($i) use ($slotFilter) { return $i['slot'] === $slotFilter; }));
  } else {
    $filtered = array_values(array_filter($items, function ($i) use ($selectedRarity) { return ($i['rarity'] ?? 'normal') === $selectedRarity; }));
  }
  if (empty($filtered)) {
    $filtered = array_values(array_filter($items, function ($i) { return $i['name'] === 'Нож'; }));
    if (empty($filtered)) $filtered = [$items[0]];
  }

  // 3. Pick random base item
  $base = $filtered[array_rand($filtered)];

  // 4. Roll quality tier
  $qualityTiers = json_decode(QUALITY_TIERS, true);
  $tier = weightedPick($qualityTiers);

  // 5. Build item
  $genId = generateUid();
  $levelMult = 1 + ($playerLevel - 1) * 0.05;

  // Compute final stats with quality bonuses
  $finalStats = $base['stats'] ?? [];
  $slotKey = $base['slot'] ?? '';
  if (strpos($slotKey, 'mod_') === 0) $slotKey = 'mod';
  elseif (strpos($slotKey, 'ammo') === 0) $slotKey = 'ammo';

  $bonusSource = (json_decode(QUALITY_BONUSES, true))[$slotKey] ?? [];
  // Бонусы — только к статам, что уже есть в базе (как в клиенте);
  // исключение — стихийный урон (всем) и вампиризм (только оружие).
  $rollableNew = ['dpsEmi' => 1, 'dpsToxis' => 1, 'dpsExtro' => 1, 'dpsFire' => 1];
  $isWeaponSlot = strpos($slotKey, 'weapon') === 0 || strpos($slotKey, 'gun_') === 0;
  $bonusKeys = [];
  foreach (array_keys($bonusSource) as $bk) {
    if (($finalStats[$bk] ?? 0) != 0 || isset($rollableNew[$bk])) $bonusKeys[] = $bk;
    elseif ($bk === 'vampir' && $isWeaponSlot) $bonusKeys[] = $bk;
  }

  for ($i = 0; $i < $tier['bonusStatsCount']; $i++) {
    if (empty($bonusKeys)) break;
    // Оружие: стихийка — отдельная ветка 25%, иначе база (75%).
    $statKey = $bonusKeys[array_rand($bonusKeys)];
    if ($isWeaponSlot) {
      $flatKeys = [];
      $baseKeys = [];
      foreach ($bonusKeys as $bk) {
        if (isset($rollableNew[$bk])) $flatKeys[] = $bk; else $baseKeys[] = $bk;
      }
      if (!empty($flatKeys) && (empty($baseKeys) || (mt_rand() / mt_getrandmax()) < 0.25)) {
        $statKey = $flatKeys[array_rand($flatKeys)];
      } elseif (!empty($baseKeys)) {
        $statKey = $baseKeys[array_rand($baseKeys)];
      }
    }
    $baseBonus = $bonusSource[$statKey] ?? 0;
    $bonusVal = $baseBonus * $levelMult;
    $finalStats[$statKey] = ($finalStats[$statKey] ?? 0) + $bonusVal;
  }

  // База = значения 100 ур.: плюсы и штрафы скейлятся множителем уровня,
  // штрафы — от базы/5.95 (на 1 ур. маленькие, на 100 — прописанные, не зануляются).
  $lvl100mult = 1 + 99 * 0.05;
  foreach ($finalStats as $k => $v) {
    $orig = ($base['stats'] ?? [])[$k] ?? 0;
    if ($orig > 0) $v = ($v - $orig) + $orig * $levelMult;
    elseif ($orig < 0) $v = ($v - $orig) + ($orig / $lvl100mult) * $levelMult;
    $finalStats[$k] = round($v, 3);
  }

  $item = [
    'id' => $genId,
    'name' => $base['name'],
    'displayName' => $tier['name'] . ' ' . $base['name'] . ' ' . $playerLevel . ' ур.',
    'rarity' => $selectedRarity,
    'slot' => $base['slot'] ?? '',
    'stats' => $finalStats,
    'quality' => $tier['name'],
    'qualityColor' => $tier['color'],
    'level' => $playerLevel,
    'type' => $base['type'] ?? 'equipment',
  ];

  if (isset($base['ammoCapacity'])) $item['ammoCapacity'] = $base['ammoCapacity'];
  if (isset($base['damage'])) $item['damage'] = $base['damage'];
  if (isset($base['mods'])) $item['mods'] = $base['mods'];
  if (isset($base['set'])) $item['set'] = $base['set'];

  // Гнёзда под сферы + предустановленные сферы с дропа (зеркало клиента).
  $slotName = $base['slot'] ?? '';
  $isW = $slotName === 'weapon1' || $slotName === 'weapon2' || strpos($slotName, 'gun_') === 0;
  $isA = in_array($slotName, ['head', 'armor', 'pants', 'gloves', 'boots'], true);
  if (($isW || $isA) && empty($base['unique'])) {
    $item['socketSlots'] = $isW ? (1 + random_int(0, 4)) : (1 + random_int(0, 2));
    $pre = rollPreinstalledSpheres($slotName, $item['socketSlots'], $finalStats);
    if (!empty($pre)) $item['sockets'] = $pre;
  }

  return $item;
}

/**
 * Предустановленные сферы с дропа: оружие 25%/10%/2% (1/2/3 шт.),
 * броня 15%/5% (1/2 шт.). Ось: оружию — атакующие, броне — защитные
 * (PHP-статы: health вместо maxHp). Качество сферы — обычной пирамидой.
 */
function rollPreinstalledSpheres($slot, $socketSlots, $stats) {
  if (!$socketSlots || $socketSlots <= 0) return [];
  $isW = $slot === 'weapon1' || $slot === 'weapon2' || strpos($slot, 'gun_') === 0;
  $isA = in_array($slot, ['head', 'armor', 'pants', 'gloves', 'boots'], true);
  if (!$isW && !$isA) return [];
  $r = mt_rand() / mt_getrandmax();
  $n = 0;
  if ($isW) {
    if ($r < 0.02) $n = 3; elseif ($r < 0.12) $n = 2; elseif ($r < 0.37) $n = 1;
  } else {
    if ($r < 0.05) $n = 2; elseif ($r < 0.20) $n = 1;
  }
  $n = min($n, $socketSlots);
  if ($n <= 0) return [];
  $pctKeys = $isW
    ? ['damage', 'crit', 'speed', 'punching', 'accuracy', 'vampir']
    : ['armor', 'evasion', 'block', 'vampir', 'regen', 'health', 'stamina'];
  $flatKeys = $isW ? ['dpsEmi', 'dpsFire', 'dpsToxis', 'dpsExtro'] : [];
  $pool = [];
  foreach ($pctKeys as $k) { if (($stats[$k] ?? 0) > 0) $pool[] = $k; }
  foreach ($flatKeys as $k) $pool[] = $k;
  if (empty($pool)) return [];
  $pctPool = [];
  foreach ($pctKeys as $k) { if (($stats[$k] ?? 0) > 0) $pctPool[] = $k; }
  $qnames = ['Обычный', 'Редкий', 'Раритетный', 'Эпический', 'Смертоносный', 'Легендарный', 'Божественный'];
  $defensive = ['armor' => 1, 'evasion' => 1, 'block' => 1, 'vampir' => 1, 'regen' => 1, 'health' => 1, 'maxHp' => 1, 'stamina' => 1];
  $tiers = json_decode(QUALITY_TIERS, true);
  $out = [];
  for ($i = 0; $i < $n; $i++) {
    // Стихийка — отдельная ветка 25%, иначе характеристика с предмета (75%).
    $useFlat = !empty($flatKeys) && (empty($pctPool) || (mt_rand() / mt_getrandmax()) < 0.25);
    $pickPool = $useFlat ? $flatKeys : (!empty($pctPool) ? $pctPool : $flatKeys);
    $stat = $pickPool[array_rand($pickPool)];
    $qt = weightedPick($tiers);
    $idx = array_search($qt['name'], $qnames);
    if ($idx === false) $idx = 0;
    if (in_array($stat, ['dpsEmi', 'dpsFire', 'dpsToxis', 'dpsExtro'], true)) {
      $pct = 5 + 2.5 * $idx;
    } else {
      $raw = 20 + 5 * $idx;
      $pct = isset($defensive[$stat]) ? round($raw / 3, 1) : $raw;
    }
    $out[] = ['stat' => $stat, 'pct' => $pct];
  }
  return $out;
}

// ---------------------------------------------------------------------------
// Generate loot for expedition events
// ---------------------------------------------------------------------------
function generateLoot($pdo, $userId, $zoneName, $playerLevel, $itemCount = 1) {
  $items = [];

  // Generate equipment items (itemCount controls how many equipment pieces)
  for ($i = 0; $i < $itemCount; $i++) {
    $eq = generateItem($playerLevel);
    if ($eq) $items[] = $eq;
  }

  // Always generate 1-3 resources
  $resources = getGameResources();
  $resourceCount = random_int(1, 3);
  for ($i = 0; $i < $resourceCount; $i++) {
    $def = pickRandom($resources);
    $qty = random_int(1, 5);
    $existingKey = null;
    foreach ($items as $idx => $it) {
      if (($it['name'] ?? '') === $def['name'] && ($it['type'] ?? '') === 'material') {
        $existingKey = $idx;
        break;
      }
    }
    if ($existingKey !== null) {
      $items[$existingKey]['quantity'] = ($items[$existingKey]['quantity'] ?? 1) + $qty;
    } else {
      $items[] = [
        'id' => generateUid(),
        'name' => $def['name'],
        'displayName' => $def['name'],
        'rarity' => 'common',
        'slot' => 'any',
        'stats' => new stdClass,
        'quality' => 'Обычный',
        'qualityColor' => '#a0a0a0',
        'level' => 1,
        'type' => 'material',
        'quantity' => $qty,
      ];
    }
  }

  // Sort: resources first, then equipment
  usort($items, function ($a, $b) {
    return (($a['type'] ?? 'equipment') === 'material' ? 0 : 1) - (($b['type'] ?? 'equipment') === 'material' ? 0 : 1);
  });

  // Insert items into inventory_items table
  if ($pdo && $userId) {
    try {
      $ins = $pdo->prepare(
        'INSERT INTO inventory_items (user_id, item_id, name, slot, quantity, equipped, data)
         VALUES (?, ?, ?, ?, ?, 0, ?)'
      );
      foreach ($items as $item) {
        $slot = $item['slot'] ?? null;
        $qty = $item['quantity'] ?? 1;
        $data = $item;
        unset($data['id'], $data['name'], $data['slot'], $data['quantity']);
        $data['stats'] = (array)($data['stats'] ?? []);
        $ins->execute([
          $userId,
          $item['id'],
          $item['name'],
          $slot,
          $qty,
          json_encode($data, JSON_UNESCAPED_UNICODE),
        ]);
      }
    } catch (Exception $e) {
      // Log error but don't break the expedition
      error_log("generateLoot insert failed: " . $e->getMessage());
    }
  }

  return ['count' => count($items), 'items' => $items];
}
