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
  'weapon2' => ['crit' => 0.005, 'vampir' => 0.005, 'punching' => 0.005, 'accuracy' => 0.005, 'dpsExtro' => 2, 'dpsFire' => 2, 'dpsEmi' => 2, 'dpsToxis' => 2, 'damage' => 3],
  'head'    => ['regen' => 2, 'block' => 0.005, 'evasion' => 0.004, 'armor' => 2, 'health' => 250],
  'armor'   => ['regen' => 2, 'block' => 0.005, 'evasion' => 0.004, 'armor' => 2, 'health' => 250],
  'gloves'  => ['regen' => 2, 'block' => 0.005, 'evasion' => 0.004, 'armor' => 2, 'health' => 250],
  'boots'   => ['regen' => 2, 'block' => 0.005, 'evasion' => 0.004, 'armor' => 2, 'health' => 250],
  'ammo'    => ['regen' => 0.01, 'block' => 0.003, 'evasion' => 0.002, 'armor' => 0.5, 'health' => 20, 'damage' => 0.5],
  'mod'     => ['regen' => 0.005, 'block' => 0.005, 'evasion' => 0.004, 'armor' => 2, 'health' => 250, 'damage' => 2, 'crit' => 0.005, 'vampir' => 0.005, 'punching' => 0.005, 'accuracy' => 0.005, 'dpsExtro' => 1, 'dpsFire' => 1, 'dpsEmi' => 1, 'dpsToxis' => 1, 'ammoCapacity' => 5],
]));

define('RARITY_CHANCES', json_encode(['normal' => 33, 'epic' => 33, 'superepic' => 34]));

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
    ['name' => 'MP5',             'rarity' => 'normal',    'slot' => 'weapon2', 'stats' => ['damage' => 5, 'crit' => 0.02], 'ammoCapacity' => 30],
    ['name' => 'АК-47',           'rarity' => 'normal',    'slot' => 'weapon2', 'stats' => ['damage' => 9, 'crit' => 0.02], 'ammoCapacity' => 30],
    ['name' => 'Дробовик',        'rarity' => 'normal',    'slot' => 'weapon2', 'stats' => ['damage' => 14, 'accuracy' => 0.7, 'armor' => -2], 'ammoCapacity' => 6],
    ['name' => 'Винтовка СВД',   'rarity' => 'epic',      'slot' => 'weapon2', 'stats' => ['damage' => 16, 'crit' => 0.05], 'ammoCapacity' => 10],
    ['name' => 'ППШ',             'rarity' => 'normal',    'slot' => 'weapon2', 'stats' => ['damage' => 4], 'ammoCapacity' => 71],
    ['name' => 'Снайперская винтовка','rarity' => 'epic',  'slot' => 'weapon2', 'stats' => ['damage' => 22, 'crit' => 0.08], 'ammoCapacity' => 5],

    // Armor
    ['name' => 'Кожаная куртка',  'rarity' => 'normal',    'slot' => 'armor', 'stats' => ['armor' => 2, 'health' => 20]],
    ['name' => 'Бронежилет',      'rarity' => 'normal',    'slot' => 'armor', 'stats' => ['armor' => 5, 'health' => 40]],
    ['name' => 'Комбинезон',      'rarity' => 'normal',    'slot' => 'armor', 'stats' => ['armor' => 3, 'regen' => 0.5]],
    ['name' => 'Тяжёлый бронекостюм','rarity' => 'epic',   'slot' => 'armor', 'stats' => ['armor' => 10, 'health' => 80]],

    // Helmets
    ['name' => 'Кепка',           'rarity' => 'normal',    'slot' => 'head', 'stats' => ['armor' => 1]],
    ['name' => 'Каска',           'rarity' => 'normal',    'slot' => 'head', 'stats' => ['armor' => 3, 'health' => 10]],
    ['name' => 'Шлем',            'rarity' => 'normal',    'slot' => 'head', 'stats' => ['armor' => 4]],
    ['name' => 'Тактический шлем','rarity' => 'epic',      'slot' => 'head', 'stats' => ['armor' => 6, 'accuracy' => 0.02]],

    // Gloves
    ['name' => 'Рабочие перчатки','rarity' => 'normal',    'slot' => 'gloves', 'stats' => ['armor' => 1]],
    ['name' => 'Тактические перчатки','rarity' => 'normal','slot' => 'gloves','stats' => ['armor' => 2, 'damage' => 1]],
    ['name' => 'Бронеперчатки',   'rarity' => 'epic',      'slot' => 'gloves', 'stats' => ['armor' => 4, 'health' => 20]],

    // Boots
    ['name' => 'Кроссовки',       'rarity' => 'normal',    'slot' => 'boots', 'stats' => ['evasion' => 0.01]],
    ['name' => 'Армейские ботинки','rarity' => 'normal',   'slot' => 'boots', 'stats' => ['armor' => 2]],
    ['name' => 'Тяжёлые сапоги',  'rarity' => 'epic',      'slot' => 'boots', 'stats' => ['armor' => 4, 'health' => 30]],

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

  // 2. Filter items
  if ($slotFilter) {
    $filtered = array_values(array_filter($items, fn($i) => $i['slot'] === $slotFilter));
  } else {
    $filtered = array_values(array_filter($items, fn($i) => ($i['rarity'] ?? 'normal') === $selectedRarity));
  }
  if (empty($filtered)) {
    $filtered = array_values(array_filter($items, fn($i) => $i['name'] === 'Нож'));
    if (empty($filtered)) $filtered = [$items[0]];
  }

  // 3. Pick random base item
  $base = $filtered[array_rand($filtered)];

  // 4. Roll quality tier
  $qualityTiers = json_decode(QUALITY_TIERS, true);
  $tier = weightedPick($qualityTiers);

  // 5. Build item
  $genId = generateUid();
  $levelMult = 1 + ($playerLevel - 1) * 0.1;

  // Compute final stats with quality bonuses
  $finalStats = $base['stats'] ?? [];
  $slotKey = $base['slot'] ?? '';
  if (str_starts_with($slotKey, 'mod_')) $slotKey = 'mod';
  elseif (str_starts_with($slotKey, 'ammo')) $slotKey = 'ammo';

  $bonusSource = (json_decode(QUALITY_BONUSES, true))[$slotKey] ?? [];
  $bonusKeys = array_keys($bonusSource);

  for ($i = 0; $i < $tier['bonusStatsCount']; $i++) {
    if (empty($bonusKeys)) break;
    $statKey = $bonusKeys[array_rand($bonusKeys)];
    $baseBonus = $bonusSource[$statKey] ?? 0;
    $bonusVal = $baseBonus * $levelMult;
    $finalStats[$statKey] = ($finalStats[$statKey] ?? 0) + $bonusVal;
  }

  // Scale base stats by level
  foreach ($finalStats as $k => $v) {
    $v = $v * $levelMult;
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

  return $item;
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
  usort($items, fn($a, $b) => (($a['type'] ?? 'equipment') === 'material' ? 0 : 1) - (($b['type'] ?? 'equipment') === 'material' ? 0 : 1));

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
