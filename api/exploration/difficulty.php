<?php
// Ступени сложности рейда и модификаторы (характер конкретного рейда).
//
// Сложность — главный рычаг: во сколько раз больнее и во сколько больше
// заработаешь. Модификатор — небольшой «характер» рейда, всегда плюс ↔ минус.
//
// Урон в пути числовой (в HP) и растёт с уровнем игрока: база
// travelPowerScale() в engine_logic.php, множитель полосы — trapDmgBand().

function travelDifficulties() {
  return [
    'normal' => [
      'key' => 'normal', 'name' => 'Обычная', 'icon' => '⚪', 'color' => '#e2e8f0',
      'damageMult' => 1.0, 'rewardMult' => 1.0,
      'qualityCap' => 'Раритетный',
      'desc' => 'Обычная вылазка. Зона знакомая, добыча скромная.',
    ],
    'hard' => [
      'key' => 'hard', 'name' => 'Сложная', 'icon' => '🟢', 'color' => '#4ade80',
      'damageMult' => 1.5, 'rewardMult' => 1.7,
      'qualityCap' => 'Эпический',
      'desc' => 'Больше добычи — больше и потерь.',
    ],
    'danger' => [
      'key' => 'danger', 'name' => 'Опасная', 'icon' => '🔵', 'color' => '#60a5fa',
      'damageMult' => 2.2, 'rewardMult' => 2.6,
      'qualityCap' => 'Смертоносный',
      'desc' => 'Территория не прощает ошибок.',
    ],
    'nightmare' => [
      'key' => 'nightmare', 'name' => 'Кошмар', 'icon' => '🟣', 'color' => '#a78bfa',
      'damageMult' => 3.5, 'rewardMult' => 4.2,
      'qualityCap' => 'Легендарный',
      'desc' => 'Только для тех, кто умеет умирать и возвращаться.',
    ],
    'hell' => [
      'key' => 'hell', 'name' => 'Ад на земле', 'icon' => '🔥', 'color' => '#f87171',
      'damageMult' => 5.0, 'rewardMult' => 6.0,
      'qualityCap' => 'Божественный',
      'desc' => 'Один удар — и рюкзак пуст. Награда correspondingly адская.',
    ],
  ];
}

function travelDifficulty($key) {
  $all = travelDifficulties();
  return $all[$key] ?? $all['normal'];
}

/**
 * Плата выносливостью за старт рейда (SL-число на карточке).
 * Складывается из ступени сложности и надбавки за «характер пути».
 */
function travelStaminaCost($difficulty, $modifier) {
  $base = [
    'normal' => 8,    'hard' => 12,   'danger' => 17,
    'nightmare' => 23, 'hell' => 30,
  ];
  $extra = [
    'night' => 3, 'silence' => 4, 'ambush' => 2, 'fog' => 3,
    'wind' => 1, 'gnats' => 1, 'lowtide' => 2, 'frost' => 1,
    'plague' => 4, 'compass' => 2, 'trail' => -2, 'traps' => 2,
  ];
  $b = $base[$difficulty['key']] ?? 8;
  $e = $modifier['key'] ? ($extra[$modifier['key']] ?? 0) : 0;
  return max(1, (int)round($b + $e));
}

function travelModifiers() {
  return [
    'night' => [
      'key' => 'night', 'name' => 'Ночь', 'icon' => '🌙',
      'legChance' => 5, 'damage' => 1.15,
      'desc' => 'Цепочки легендарок чаще, но в темноте бьют больнее.',
    ],
    'silence' => [
      'key' => 'silence', 'name' => 'Тишина', 'icon' => '🤫',
      'legChance' => 6, 'findRate' => 0.70,
      'desc' => 'Легендарки гуще, но находок меньше.',
    ],
    'ambush' => [
      'key' => 'ambush', 'name' => 'Засада', 'icon' => '🚧',
      'chips' => 1.25, 'damage' => 1.20,
      'desc' => 'Больше чипов — чаще засады.',
    ],
    'fog' => [
      'key' => 'fog', 'name' => 'Туман', 'icon' => '🌫',
      'chips' => 1.35, 'eventRate' => 0.75,
      'desc' => 'В дымке находят ценное, но события выпадают реже.',
    ],
    'wind' => [
      'key' => 'wind', 'name' => 'Ветер', 'icon' => '🌪',
      'eventRate' => 1.20, 'findRate' => 0.80,
      'desc' => 'Событий больше, но удачных находок меньше.',
    ],
    'gnats' => [
      'key' => 'gnats', 'name' => 'Мошка', 'icon' => '🦟',
      'exp' => 1.30, 'chips' => 0.80,
      'desc' => 'Опыта больше, чипов меньше.',
    ],
    'lowtide' => [
      'key' => 'lowtide', 'name' => 'Отлив', 'icon' => '🌊',
      'heal' => 1.40, 'findRate' => 0.75,
      'desc' => 'Лечит лучше, но находок меньше.',
    ],
    'frost' => [
      'key' => 'frost', 'name' => 'Стужа', 'icon' => '❄️',
      'regen' => 1.35, 'returnTime' => 1.15,
      'desc' => 'Регенерация быстрее, обратная дорога дольше.',
    ],
    'plague' => [
      'key' => 'plague', 'name' => 'Заражение', 'icon' => '☣',
      'qualityStep' => 1, 'regen' => 0.70,
      'desc' => 'Дроп качественнее, но реген хуже.',
    ],
    'compass' => [
      'key' => 'compass', 'name' => 'Компас', 'icon' => '🧭',
      'tripTime' => 1.15, 'chips' => 0.80,
      'desc' => 'В зоне можно побыть дольше, но чипов меньше.',
    ],
    'trail' => [
      'key' => 'trail', 'name' => 'Тропа', 'icon' => '⛰',
      'damage' => 0.85, 'chips' => 0.75,
      'desc' => 'Меньше получаешь, зато почти не получаешь по лицу.',
    ],
    'traps' => [
      'key' => 'traps', 'name' => 'Ловушки', 'icon' => '🪤',
      'lootBonus' => 0.20, 'damage' => 1.15,
      'desc' => 'Иногда находка лишняя, но и урон выше.',
    ],
  ];
}

function travelModifier($key) {
  $all = travelModifiers();
  if (!$key || !isset($all[$key])) {
    return [
      'key' => 'none', 'name' => 'Обычный рейд', 'icon' => '•',
      'damage' => 1.0, 'chips' => 1.0, 'exp' => 1.0, 'heal' => 1.0, 'regen' => 1.0,
      'eventRate' => 1.0, 'findRate' => 1.0, 'lootBonus' => 0.0, 'legChance' => 0,
      'qualityStep' => 0, 'tripTime' => 1.0, 'returnTime' => 1.0,
      'desc' => 'Ничего особенного не происходит.',
    ];
  }
  return array_merge([
    'damage' => 1.0, 'chips' => 1.0, 'exp' => 1.0, 'heal' => 1.0, 'regen' => 1.0,
    'eventRate' => 1.0, 'findRate' => 1.0, 'lootBonus' => 0.0, 'legChance' => 0,
    'qualityStep' => 0, 'tripTime' => 1.0, 'returnTime' => 1.0,
  ], $all[$key]);
}

/** Пирамида качества предметов (для потолка дропа). */
function travelQualitySteps() {
  return ['Обычный', 'Редкий', 'Раритетный', 'Эпический', 'Смертоносный', 'Легендарный', 'Божественный'];
}

/** Потолок качества дропа: от сложности + сдвиг модификатора (qualityStep). */
function travelQualityCap($difficulty, $modifier) {
  $steps = travelQualitySteps();
  $cap = $difficulty['qualityCap'] ?? 'Раритетный';
  $idx = array_search($cap, $steps);
  if ($idx === false) $idx = 2;
  $step = (int)($modifier['qualityStep'] ?? 0);
  if ($step !== 0) {
    $idx = max(0, min(count($steps) - 1, $idx + $step));
  }
  return $steps[$idx];
}
