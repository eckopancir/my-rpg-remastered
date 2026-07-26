<?php
function generateLoot($pdo, $userId, $zoneName, $playerLevel, $itemCount = 1) {
  $items = [];
  $dropTable = getLootTable($zoneName, $playerLevel);
  for ($i = 0; $i < $itemCount; $i++) {
    $roll = mt_rand(1, 100);
    $cumulative = 0;
    foreach ($dropTable as $entry) {
      $cumulative += $entry['weight'];
      if ($roll <= $cumulative) {
        $items[] = $entry;
        break;
      }
    }
  }
  $created = [];
  foreach ($items as $item) {
    $itemId = preg_replace('/[^a-z0-9_-]/', '', str_replace(' ', '_', mb_strtolower($item['name'], 'UTF-8')));
    $stmt = $pdo->prepare("INSERT INTO inventory_items (user_id, item_id, name, quantity, data) VALUES (?, ?, ?, 1, ?)");
    $data = json_encode([
      'type' => $item['type'] ?? 'material',
      'category' => $item['category'] ?? 'common',
      'icon' => $item['icon'] ?? null,
    ]);
    $stmt->execute([$userId, $itemId, $item['name'], $data]);
    $created[] = [
      'name' => $item['name'],
      'type' => $item['type'] ?? 'material',
      'category' => $item['category'] ?? 'common',
    ];
  }
  return ['count' => count($created), 'items' => $created];
}

function getLootTable($zoneName, $playerLevel) {
  $level = min($playerLevel, 10);

  // Resources (GAME_RESOURCES) — type=material, category=material
  $resources = [
    ['name' => 'Вода',         'weight' => 10, 'type' => 'material', 'category' => 'material'],
    ['name' => 'Изолента',     'weight' => 9,  'type' => 'material', 'category' => 'material'],
    ['name' => 'Железо',       'weight' => 9,  'type' => 'material', 'category' => 'material'],
    ['name' => 'Дерево',       'weight' => 10, 'type' => 'material', 'category' => 'material'],
    ['name' => 'Инструменты',  'weight' => 7,  'type' => 'material', 'category' => 'material'],
    ['name' => 'Гвозди',       'weight' => 8,  'type' => 'material', 'category' => 'material'],
    ['name' => 'Пластмасса',   'weight' => 8,  'type' => 'material', 'category' => 'material'],
    ['name' => 'Металлолом',   'weight' => 9,  'type' => 'material', 'category' => 'material'],
    ['name' => 'Провода',      'weight' => 8,  'type' => 'material', 'category' => 'material'],
    ['name' => 'Хим. реагент', 'weight' => 6,  'type' => 'material', 'category' => 'material'],
    ['name' => 'Топливо',      'weight' => 6,  'type' => 'material', 'category' => 'material'],
    ['name' => 'Батарейки',    'weight' => 6,  'type' => 'material', 'category' => 'material'],
    ['name' => 'Консервы',     'weight' => 6,  'type' => 'material', 'category' => 'material'],
    ['name' => 'Лекарства',    'weight' => 5,  'type' => 'material', 'category' => 'material'],
    ['name' => 'Микросхема',   'weight' => 4,  'type' => 'material', 'category' => 'material'],
    ['name' => 'Редкий сплав', 'weight' => 3,  'type' => 'material', 'category' => 'material'],
  ];

  // Common melee weapons — type=weapon, category=common
  $commonMelee = [
    ['name' => 'Нож',               'weight' => 4, 'type' => 'weapon', 'category' => 'common', 'slot' => 'weapon1'],
    ['name' => 'Дубинка',           'weight' => 4, 'type' => 'weapon', 'category' => 'common', 'slot' => 'weapon1'],
    ['name' => 'Бейсбольная бита',  'weight' => 3, 'type' => 'weapon', 'category' => 'common', 'slot' => 'weapon1'],
    ['name' => 'Кастет',            'weight' => 3, 'type' => 'weapon', 'category' => 'common', 'slot' => 'weapon1'],
    ['name' => 'Топор',             'weight' => 3, 'type' => 'weapon', 'category' => 'common', 'slot' => 'weapon1'],
    ['name' => 'Кинжал',            'weight' => 3, 'type' => 'weapon', 'category' => 'common', 'slot' => 'weapon1'],
    ['name' => 'Мачето',            'weight' => 3, 'type' => 'weapon', 'category' => 'common', 'slot' => 'weapon1'],
    ['name' => 'Тесак',             'weight' => 2, 'type' => 'weapon', 'category' => 'common', 'slot' => 'weapon1'],
    ['name' => 'Молот',             'weight' => 2, 'type' => 'weapon', 'category' => 'common', 'slot' => 'weapon1'],
  ];

  // Common firearms — type=weapon, category=common
  $commonGuns = [
    ['name' => 'Пистолет ТТ',          'weight' => 3, 'type' => 'weapon', 'category' => 'common', 'slot' => 'weapon2'],
    ['name' => 'Пистолет Макарова',    'weight' => 3, 'type' => 'weapon', 'category' => 'common', 'slot' => 'weapon2'],
    ['name' => 'Глок 17',              'weight' => 3, 'type' => 'weapon', 'category' => 'common', 'slot' => 'weapon2'],
    ['name' => 'Beretta 92',           'weight' => 2, 'type' => 'weapon', 'category' => 'common', 'slot' => 'weapon2'],
    ['name' => 'Koch USP',             'weight' => 3, 'type' => 'weapon', 'category' => 'common', 'slot' => 'weapon2'],
    ['name' => 'Дробовик',             'weight' => 2, 'type' => 'weapon', 'category' => 'common', 'slot' => 'weapon2'],
    ['name' => 'Обрез',                'weight' => 3, 'type' => 'weapon', 'category' => 'common', 'slot' => 'weapon2'],
    ['name' => 'Револьвер Наган',      'weight' => 2, 'type' => 'weapon', 'category' => 'common', 'slot' => 'weapon2'],
    ['name' => 'ППШ',                  'weight' => 2, 'type' => 'weapon', 'category' => 'common', 'slot' => 'weapon2'],
    ['name' => 'Винтовка Мосина',      'weight' => 2, 'type' => 'weapon', 'category' => 'common', 'slot' => 'weapon2'],
  ];

  // Common armor — type=armor, category=common
  $commonArmor = [
    ['name' => 'Кепка',               'weight' => 3, 'type' => 'armor', 'category' => 'common', 'slot' => 'head'],
    ['name' => 'Каска',               'weight' => 3, 'type' => 'armor', 'category' => 'common', 'slot' => 'head'],
    ['name' => 'Кожаная куртка',      'weight' => 3, 'type' => 'armor', 'category' => 'common', 'slot' => 'armor'],
    ['name' => 'Бронежилет',          'weight' => 2, 'type' => 'armor', 'category' => 'common', 'slot' => 'armor'],
    ['name' => 'Рабочие перчатки',    'weight' => 3, 'type' => 'armor', 'category' => 'common', 'slot' => 'gloves'],
    ['name' => 'Тактические перчатки', 'weight' => 2, 'type' => 'armor', 'category' => 'common', 'slot' => 'gloves'],
    ['name' => 'Кроссовки',           'weight' => 3, 'type' => 'armor', 'category' => 'common', 'slot' => 'boots'],
    ['name' => 'Армейские ботинки',   'weight' => 3, 'type' => 'armor', 'category' => 'common', 'slot' => 'boots'],
  ];

  // Uncommon items — category=uncommon
  $uncommon = [
    ['name' => 'Кувалда',                    'weight' => 3, 'type' => 'weapon', 'category' => 'uncommon', 'slot' => 'weapon1'],
    ['name' => 'Топор бандита',              'weight' => 3, 'type' => 'weapon', 'category' => 'uncommon', 'slot' => 'weapon1'],
    ['name' => 'Tec-9',                      'weight' => 2, 'type' => 'weapon', 'category' => 'uncommon', 'slot' => 'weapon2'],
    ['name' => 'MP5',                        'weight' => 2, 'type' => 'weapon', 'category' => 'uncommon', 'slot' => 'weapon2'],
    ['name' => 'Узи',                        'weight' => 2, 'type' => 'weapon', 'category' => 'uncommon', 'slot' => 'weapon2'],
    ['name' => 'MAC-10',                     'weight' => 2, 'type' => 'weapon', 'category' => 'uncommon', 'slot' => 'weapon2'],
    ['name' => 'FN FNC',                     'weight' => 2, 'type' => 'weapon', 'category' => 'uncommon', 'slot' => 'weapon2'],
    ['name' => 'АК-47',                      'weight' => 2, 'type' => 'weapon', 'category' => 'uncommon', 'slot' => 'weapon2'],
    ['name' => 'Шлем',                       'weight' => 3, 'type' => 'armor',  'category' => 'uncommon', 'slot' => 'head'],
    ['name' => 'Кевларовая броня',           'weight' => 2, 'type' => 'armor',  'category' => 'uncommon', 'slot' => 'armor'],
    ['name' => 'Кираса',                      'weight' => 2, 'type' => 'armor',  'category' => 'uncommon', 'slot' => 'armor'],
    ['name' => 'Боевые перчатки',            'weight' => 2, 'type' => 'armor',  'category' => 'uncommon', 'slot' => 'gloves'],
    ['name' => 'Тактические сапоги',          'weight' => 2, 'type' => 'armor',  'category' => 'uncommon', 'slot' => 'boots'],
    ['name' => 'Тяжёлые сапоги',             'weight' => 2, 'type' => 'armor',  'category' => 'uncommon', 'slot' => 'boots'],
  ];

  // Rare items — category=rare
  $rare = [
    ['name' => 'Катана',                  'weight' => 2, 'type' => 'weapon', 'category' => 'rare', 'slot' => 'weapon1'],
    ['name' => 'Плазменный клинок',       'weight' => 1, 'type' => 'weapon', 'category' => 'rare', 'slot' => 'weapon1'],
    ['name' => 'Снайперская винтовка',    'weight' => 1, 'type' => 'weapon', 'category' => 'rare', 'slot' => 'weapon2'],
    ['name' => 'VSS Винторез',            'weight' => 2, 'type' => 'weapon', 'category' => 'rare', 'slot' => 'weapon2'],
    ['name' => 'Винтовка СВД',            'weight' => 1, 'type' => 'weapon', 'category' => 'rare', 'slot' => 'weapon2'],
    ['name' => 'Автомат АК-74',           'weight' => 1, 'type' => 'weapon', 'category' => 'rare', 'slot' => 'weapon2'],
    ['name' => 'Экзоскелет',              'weight' => 1, 'type' => 'armor',  'category' => 'rare', 'slot' => 'armor'],
    ['name' => 'Энергетическая броня',    'weight' => 1, 'type' => 'armor',  'category' => 'rare', 'slot' => 'armor'],
    ['name' => 'Тактический шлем',        'weight' => 2, 'type' => 'armor',  'category' => 'rare', 'slot' => 'head'],
    ['name' => 'Амулет удачи',            'weight' => 2, 'type' => 'accessory', 'category' => 'rare', 'slot' => 'ammo'],
    ['name' => 'Кристалл регенерации',    'weight' => 2, 'type' => 'accessory', 'category' => 'rare', 'slot' => 'ammo'],
    ['name' => 'Медный браслет',           'weight' => 2, 'type' => 'accessory', 'category' => 'rare', 'slot' => 'ammo'],
  ];

  // Legendary items — category=legendary
  $legendary = [
    ['name' => 'M134 Minigun',             'weight' => 1, 'type' => 'weapon', 'category' => 'legendary', 'slot' => 'weapon2'],
    ['name' => 'Плазменная винтовка',      'weight' => 1, 'type' => 'weapon', 'category' => 'legendary', 'slot' => 'weapon2'],
    ['name' => 'Катана Резчик Душ',        'weight' => 1, 'type' => 'weapon', 'category' => 'legendary', 'slot' => 'weapon1'],
    ['name' => 'Цепной меч Инквизитор',    'weight' => 1, 'type' => 'weapon', 'category' => 'legendary', 'slot' => 'weapon1'],
    ['name' => 'Боевая броня',             'weight' => 1, 'type' => 'armor',  'category' => 'legendary', 'slot' => 'armor'],
    ['name' => 'Кираса Бессмертие',        'weight' => 1, 'type' => 'armor',  'category' => 'legendary', 'slot' => 'armor'],
    ['name' => 'Артефакт древних',         'weight' => 1, 'type' => 'accessory', 'category' => 'legendary', 'slot' => 'ammo'],
    ['name' => 'Реактивный ранец',         'weight' => 1, 'type' => 'armor',  'category' => 'legendary', 'slot' => 'boots'],
  ];

  $table = array_merge($resources, $commonMelee, $commonGuns, $commonArmor);
  if ($level >= 2) $table = array_merge($table, $uncommon);
  if ($level >= 4) $table = array_merge($table, $rare);
  if ($level >= 6) $table = array_merge($table, $legendary);
  return $table;
}
