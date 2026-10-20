<?php
// Карточки рейдов для зоны: 4 предложения (сложность + модификатор + длительность).
// Детерминированы по пользователю, зоне и 10-минутному окну — обновление
// бесплатное, БД не нужна.
require_once __DIR__ . '/../../api/config.php';
require_once __DIR__ . '/difficulty.php';

$user = requireAuth();
$zone = trim((string)($_GET['zone'] ?? ''));
if ($zone === '') jsonResponse(['error' => 'zone required'], 400);

$difficulties = travelDifficulties();
$modifiers = travelModifiers();

// Окно обновления: 10 минут (карточки не меняются чаще).
$window = (int)floor(time() / 600);
$seed = crc32($user['id'] . '|' . $zone . '|' . $window);
mt_srand($seed);

$diffKeys = array_keys($difficulties);
$modKeys = array_keys($modifiers);

// Сложности в карточках всегда разные: одна «Обычная», дальше по нарастающей.
$pool = $diffKeys;
shuffle($pool);
$diffPool = array_values($pool);
$cards = [];
$usedMods = [];
for ($i = 0; $i < 4; $i++) {
  $diffKey = $diffPool[$i] ?? 'normal';
  // Модификатор — случайный, не повторяющийся в наборе.
  $avail = array_values(array_diff($modKeys, $usedMods));
  if (!$avail) $avail = $modKeys;
  $modKey = $avail[array_rand($avail)];
  $usedMods[] = $modKey;
  $diff = $difficulties[$diffKey];
  $mod = $modifiers[$modKey];
  $hours = [2, 4, 8, 12, 18, 24][array_rand([0, 1, 2, 3, 4, 5])];
  $cards[] = [
    'id' => $window . '-' . $diffKey . '-' . $modKey . '-' . $i,
    'zone' => $zone,
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
    'refreshIn' => 600 - (time() % 600),
  ];
}

jsonResponse(['cards' => $cards, 'refreshIn' => 600 - (time() % 600)]);
