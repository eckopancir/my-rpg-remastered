<?php
define('TRAVEL_TIME', 180);
define('TOTAL_TIME', 540);
// Редкий темп (синхронно с константами engine_logic.php — define() побеждает
// дублирующий const, поэтому значения должны совпадать здесь):
// крупные ~2/час, микро раз в 8-12 мин.
define('EVENT_COOLDOWN_MIN', 1500);
define('EVENT_COOLDOWN_MAX', 2100);
define('MICRO_COOLDOWN_MIN', 480);
define('MICRO_COOLDOWN_MAX', 720);
define('DEATH_COOLDOWN_MS', 30000);

// Длительность экспедиции, часы (слайдер на старте: 2-24).
define('EXP_MIN_HOURS', 2);
define('EXP_MAX_HOURS', 24);
// Дорога туда, сек (реальная вместо мгновенной).
define('TRAVEL_OUT_SEC', 120);
// Дорога домой, сек (плановая и досрочная — всегда час).
define('TRAVEL_BACK_SEC', 3600);

// Бонус к итогам за полную зачистку, ступени по плановой длительности:
// 2-5ч +10%, 6-11ч +30%, 12-17ч +60%, 18-24ч +100%. Досрочный возврат — без бонуса.
function durationBonusPct($plannedSec) {
  $h = $plannedSec / 3600;
  if ($h >= 18) return 100;
  if ($h >= 12) return 60;
  if ($h >= 6) return 30;
  return 10;
}

// Рюкзак: стакающиеся бонусы взятых в дорогу материалов (сгорают на старте).
// По лору: еда/вода лечат, инструменты и пластик — ценность хабара,
// железо и изолента — броня, дерево и гвозди — опыт следопыта,
// батарейки питают детекторы, топливо ускоряет возврат.
// Баланс: бонус за штуку большой, потолок достигается за 5–6 единиц
// (весь пак ≈ 60 ресурсов, а не 500).
// Капы: каждый тип даёт максимум половины общего капа (Дерево ≤ 50 %,
// Гвозди ≤ 50 %, вместе ≤ 100 %) — можно взять только один тип.
function expeditionBuffs($consumables) {
  $b = ['regen' => 0, 'healPct' => 0.0, 'legPct' => 0.0, 'expPct' => 0.0, 'chipsPct' => 0.0, 'dmgTakenMult' => 1.0, 'returnMult' => 1.0];
  if (is_string($consumables)) $consumables = json_decode($consumables, true);
  if (!is_array($consumables)) return $b;
  $counts = [];
  foreach ($consumables as $c) {
    if (!is_array($c)) continue;
    $n = (string)($c['name'] ?? '');
    if ($n === '') continue;
    $counts[$n] = ($counts[$n] ?? 0) + max(0, (int)($c['qty'] ?? $c['quantity'] ?? 0));
  }
  // Реген: +5 HP/мин за штуку, максимум +30/мин (6 шт).
  $b['regen'] = min($counts['Лекарства'] ?? 0, 6) * 5;
  // Хил: +5% за штуку, общий кап +30% (по 6 шт Воды и Консервов).
  $healUnits = min($counts['Вода'] ?? 0, 6) + min($counts['Консервы'] ?? 0, 6);
  $b['healPct'] = min($healUnits * 0.05, 0.30);
  // Легендарка: +3% за штуку, максимум +15% (5 шт) — шанс 3% → 18%.
  $b['legPct'] = min($counts['Батарейки'] ?? 0, 5) * 0.03;
  // Опыт: +10% за штуку, общий кап +100% (по 5 шт Дерева и Гвоздей).
  $expUnits = min($counts['Дерево'] ?? 0, 5) + min($counts['Гвозди'] ?? 0, 5);
  $b['expPct'] = min($expUnits * 0.10, 1.00);
  // Чипы: +10% за штуку, общий кап +100% (по 5 шт Инструментов и Пластмассы).
  $chipsUnits = min($counts['Инструменты'] ?? 0, 5) + min($counts['Пластмасса'] ?? 0, 5);
  $b['chipsPct'] = min($chipsUnits * 0.10, 1.00);
  // Урон: −5% за штуку, общий пол −50% (по 5 шт Изоленты и Железа).
  $iz = min($counts['Изолента'] ?? 0, 5);
  $fe = min($counts['Железо'] ?? 0, 5);
  $b['dmgTakenMult'] = max(0.5, (1 - $iz * 0.05) * (1 - $fe * 0.05));
  // Возврат: −15% за штуку, максимум −75% (5 шт).
  $b['returnMult'] = max(0.25, 1 - min($counts['Топливо'] ?? 0, 5) * 0.15);
  return $b;
}

function RNG($min, $max) { return mt_rand($min, $max); }
function PICK_RAND(&$arr) { return $arr[array_rand($arr)]; }
function rangeInt($min, $max) { return mt_rand($min, $max); }
function RF($min, $max) { return $min + mt_rand() / mt_getrandmax() * ($max - $min); }
function C($level, $base = 0) { return RNG(1, 5) + ($level - 1) * 2 + $base; }
function NC($level, $base = 0) { return -(RNG(1, 5) + ($level - 1) * 2 + $base); }
function E($level, $mult = 1) { return $mult * $level + RNG(1, 10); }
function LC($level, $mult = 0) { return RNG(5, 15) + ($level - 1) * 5 + $mult * 5; }
function LE($level, $mult = 0) { return RNG(5, 20) + ($level - 1) * 15 + $mult * 10; }
function pick($arr) { return $arr[array_rand($arr)]; }

$MALE_NAMES = ['Артём','Максим','Дмитрий','Алексей','Сергей','Андрей','Владимир','Константин','Игорь','Олег','Виктор','Григорий','Павел','Роман','Евгений','Николай','Михаил','Иван','Вадим','Борис','Глеб','Семён','Пётр','Ярослав','Тимур','Даниил','Егор','Матвей','Кирилл','Лев'];
$FEMALE_NAMES = ['Анна','Елена','Ольга','Марина','Светлана','Наталья','Ирина','Татьяна','Ксения','Дарья','Юлия','Александра','Виктория','Полина','Екатерина','Вера','Надежда','Любовь','Алиса','Зоя','Валерия','Маргарита','Антонина','Лидия','Галина'];
$NICKNAMES = ['Пустошник','Ходок','Скиталец','Сталкер','Торговец','Ветеран','Охотник','Механик','Лекарь','Связист','Гонец','Разведчик','Копатель','Сапёр','Кузнец','Стрелок','Проводник','Бродяга'];
$ITEM_NAMES = ['патроны','консервы','бинты','медикаменты','запчасти','инструменты','пища','вода','топливо','боеприпасы'];
$LOOT_ROOMS = ['подвал','бункер','склад','тайник','ржавый контейнер','сейф','сумку','ящик','шкаф','пещеру'];

$ZONE_ADJECTIVES = ['мрачных','заброшенных','покинутых','опасных','дымящихся','радиоактивных','тёмных','сырых','гнилых','ржавых'];
$FACTION_WEAPONS = ['автомат Калашникова','самодельный дробовик','армейскую винтовку','пулемёт','пистолет-пулемёт','обрез','снайперскую винтовку','огнемёт'];
$FACTION_EQUIP = ['бронежилет','каску','тактические очки','разгрузку','противогаз','рацию','тепловизор','штурмовой щит'];
$FACTION_LEADER = ['Командир','Сержант','Главарь','Бригадир','Офицер','Капитан','Старшина','Полковник'];

$ZONES = [
  ['name' => 'Наша база', 'difficulty' => 0, 'allowedFactions' => [], 'travelTime' => 0, 'minLevel' => 1],
  ['name' => 'Болото', 'difficulty' => 5, 'allowedFactions' => ['Мутанты'], 'travelTime' => 1, 'minLevel' => 1],
  ['name' => 'Заброшенная военная база и окрестности', 'difficulty' => 15, 'allowedFactions' => ['Военные'], 'travelTime' => 1, 'minLevel' => 3],
  ['name' => 'Свалка мусора', 'difficulty' => 3, 'allowedFactions' => ['Бандиты','Мутанты','Роботы'], 'travelTime' => 1, 'minLevel' => 1],
  ['name' => 'Темный лес', 'difficulty' => 10, 'allowedFactions' => ['Мутанты','Роботы'], 'travelTime' => 1, 'minLevel' => 2],
  ['name' => 'Базар', 'difficulty' => 0, 'allowedFactions' => [], 'travelTime' => 1, 'minLevel' => 1],
  ['name' => 'База бандитов', 'difficulty' => 20, 'allowedFactions' => ['Бандиты'], 'travelTime' => 1, 'minLevel' => 4],
  ['name' => 'Руины города', 'difficulty' => 8, 'allowedFactions' => ['Мутанты','Бандиты'], 'travelTime' => 1, 'minLevel' => 2],
  ['name' => 'Старый завод', 'difficulty' => 25, 'allowedFactions' => ['Бандиты','Военные','Роботы'], 'travelTime' => 1, 'minLevel' => 5],
];

// Зоны, закрытые для путешествий: открываются по мере прохождения.
// Список зон убран из интерфейса — игрок выбирает зону прямо из карточек рейдов,
// поэтому закрытость решает сервер.
const TRAVEL_LOCKED_ZONES = [
  'Болото', 'Свалка мусора', 'Темный лес',
  'База бандитов', 'Руины города', 'Старый завод',
];

/** Зоны, доступные для рейда: без базы/базара и без закрытых. */
function travelOpenZones() {
  global $ZONES;
  $out = [];
  foreach ($ZONES as $z) {
    $name = $z['name'];
    if ($name === 'Наша база' || $name === 'Базар') continue;
    if (in_array($name, TRAVEL_LOCKED_ZONES, true)) continue;
    $out[] = $z;
  }
  return $out;
}

function substituteText($text, $zone, $factions) {
  global $MALE_NAMES, $FEMALE_NAMES, $NICKNAMES, $ITEM_NAMES, $LOOT_ROOMS, $ZONE_ADJECTIVES, $FACTION_WEAPONS, $FACTION_EQUIP, $FACTION_LEADER;
  $replacements = [
    '{zone}' => $zone,
    '{male}' => PICK_RAND($MALE_NAMES),
    '{female}' => PICK_RAND($FEMALE_NAMES),
    '{nick}' => PICK_RAND($NICKNAMES),
    '{faction}' => $factions ? PICK_RAND($factions) : 'мутантов',
    '{item}' => PICK_RAND($ITEM_NAMES),
    '{room}' => PICK_RAND($LOOT_ROOMS),
    '{adj}' => PICK_RAND($ZONE_ADJECTIVES),
    '{weapon}' => PICK_RAND($FACTION_WEAPONS),
    '{equip}' => PICK_RAND($FACTION_EQUIP),
    '{leader}' => PICK_RAND($FACTION_LEADER),
  ];
  return strtr($text, $replacements);
}

function consumeResource($pdo, $userId, $resourceName) {
  $stmt = $pdo->prepare("SELECT id, quantity FROM inventory_items WHERE user_id = ? AND name = ? AND data->>'$.type' = 'material' LIMIT 1");
  $stmt->execute([$userId, $resourceName]);
  $row = $stmt->fetch();
  if (!$row) return false;
  if ($row['quantity'] > 1) {
    $upd = $pdo->prepare("UPDATE inventory_items SET quantity = quantity - 1 WHERE id = ?");
    $upd->execute([$row['id']]);
  } else {
    $del = $pdo->prepare("DELETE FROM inventory_items WHERE id = ?");
    $del->execute([$row['id']]);
  }
  return true;
}
