<?php
define('TRAVEL_TIME', 180);
define('TOTAL_TIME', 540);
define('EVENT_COOLDOWN_MIN', 12);
define('EVENT_COOLDOWN_MAX', 25);
define('MICRO_COOLDOWN_MIN', 5);
define('MICRO_COOLDOWN_MAX', 8);
define('DEATH_COOLDOWN_MS', 30000);

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
