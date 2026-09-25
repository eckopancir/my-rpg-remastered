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
  'head'    => ['regen' => 2, 'block' => 0.005, 'evasion' => 0.004, 'armor' => 2, 'health' => 250],
  'armor'   => ['regen' => 2, 'block' => 0.005, 'evasion' => 0.004, 'armor' => 2, 'health' => 250],
  'gloves'  => ['regen' => 2, 'block' => 0.005, 'evasion' => 0.004, 'armor' => 2, 'health' => 250],
  'boots'   => ['regen' => 2, 'block' => 0.005, 'evasion' => 0.004, 'armor' => 2, 'health' => 250],
  'ammo'    => ['regen' => 0.01, 'block' => 0.003, 'evasion' => 0.002, 'armor' => 0.5, 'health' => 20, 'damage' => 0.5],
  'mod'     => ['regen' => 0.005, 'block' => 0.005, 'evasion' => 0.004, 'armor' => 2, 'health' => 250, 'damage' => 2, 'crit' => 0.005, 'vampir' => 0.005, 'punching' => 0.005, 'accuracy' => 0.0025, 'dpsExtro' => 1, 'dpsFire' => 1, 'dpsEmi' => 1, 'dpsToxis' => 1, 'ammoCapacity' => 5],
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
    ['name' => 'UZI',           'rarity' => 'normal',    'slot' => 'weapon2', 'stats' => ['damage' => 6, 'speed' => 0.08], 'ammoCapacity' => 32],
    ['name' => 'Thompson',      'rarity' => 'normal',    'slot' => 'weapon2', 'stats' => ['damage' => 9], 'ammoCapacity' => 30],
    ['name' => 'AK-47',         'rarity' => 'normal',    'slot' => 'weapon2', 'stats' => ['damage' => 10, 'crit' => 0.01], 'ammoCapacity' => 30],
    ['name' => 'Дробовик',        'rarity' => 'normal',    'slot' => 'weapon2', 'stats' => ['damage' => 14, 'accuracy' => 0.7, 'armor' => -2], 'ammoCapacity' => 6],
    ['name' => 'Винтовка СВД',   'rarity' => 'epic',      'slot' => 'weapon2', 'stats' => ['damage' => 16, 'crit' => 0.05], 'ammoCapacity' => 10],
    ['name' => 'M16A4',         'rarity' => 'normal',    'slot' => 'weapon2', 'stats' => ['damage' => 10, 'crit' => 0.02], 'ammoCapacity' => 30],
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
    $statKey = $bonusKeys[array_rand($bonusKeys)];
    $baseBonus = $bonusSource[$statKey] ?? 0;
    $bonusVal = $baseBonus * $levelMult;
    $finalStats[$statKey] = ($finalStats[$statKey] ?? 0) + $bonusVal;
  }

  // Scale base stats by level (штрафы не растут — только положительные статы).
  foreach ($finalStats as $k => $v) {
    if ($v > 0) $v = $v * $levelMult;
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
