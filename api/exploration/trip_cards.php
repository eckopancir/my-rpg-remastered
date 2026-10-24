<?php
// Карточки рейдов: набор предложений (зона + сложность + характер + длительность).
// Детерминированы по пользователю и 10-минутному окну — обновление бесплатное,
// БД не нужна. Список зон в интерфейсе убран: игрок выбирает зону прямо
// из карточек, поэтому доступность зоны решает сервер.
require_once __DIR__ . '/../../api/config.php';
require_once __DIR__ . '/difficulty.php';
require_once __DIR__ . '/engine_config.php';

$user = requireAuth();

$difficulties = travelDifficulties();
$modifiers = travelModifiers();
$zones = travelOpenZones();
if (empty($zones)) {
  // Все зоны закрыты — не оставляем игрока без вариантов.
  global $ZONES;
  foreach ($ZONES as $z) {
    if ($z['name'] === 'Наша база' || $z['name'] === 'Базар') continue;
    $zones[] = $z;
  }
}

// Окно обновления: 10 минут (карточки не меняются чаще).
$window = (int)floor(time() / 600);
$seed = crc32($user['id'] . '|' . $window);
mt_srand($seed);

$diffKeys = array_keys($difficulties);
$modKeys = array_keys($modifiers);
$durations = [2, 4, 8, 12, 18, 24];
// По 5 карточек на каждую длительность: 30 предложений за подход.
$perDuration = 5;

$cards = [];
foreach ($durations as $hours) {
  $diffPool = $diffKeys;
  shuffle($diffPool);
  $modPool = $modKeys;
  shuffle($modPool);
  for ($i = 0; $i < $perDuration; $i++) {
    $diffKey = $diffPool[$i % count($diffPool)];
    $modKey = $modPool[$i % count($modPool)];
    $zone = $zones[array_rand($zones)];
    $diff = $difficulties[$diffKey];
    $mod = $modifiers[$modKey];
    $cards[] = [
      'id' => $window . '-' . $hours . '-' . $diffKey . '-' . $modKey . '-' . $i,
      'zone' => $zone['name'],
      'zoneLevel' => (int)$zone['difficulty'],
      'zoneFactions' => array_values($zone['allowedFactions']),
      'difficulty' => $diffKey,
      'difficultyName' => $diff['name'],
      'difficultyIcon' => $diff['icon'],
      'difficultyColor' => $diff['color'],
      'damageMult' => $diff['damageMult'],
      'rewardMult' => $diff['rewardMult'],
      'qualityCap' => $diff['qualityCap'],
      'difficultyDesc' => $diff['desc'],
      'modifier' => $modKey,
      'modifierName' => $mod['name'],
      'modifierIcon' => $mod['icon'],
      'modifierDesc' => $mod['desc'],
      'hours' => $hours,
      'sl' => travelStaminaCost($diff, $mod),
      'durationBonusPct' => durationBonusPct($hours * 3600),
      'refreshIn' => 600 - (time() % 600),
    ];
  }
}

jsonResponse(['cards' => $cards, 'refreshIn' => 600 - (time() % 600)]);
