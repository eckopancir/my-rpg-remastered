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
  foreach ($items as $item) {
    $itemId = preg_replace('/[^a-z0-9_-]/', '', str_replace(' ', '_', mb_strtolower($item['name'], 'UTF-8')));
    $stmt = $pdo->prepare("INSERT INTO inventory_items (user_id, item_id, name, quantity, data) VALUES (?, ?, ?, 1, ?)");
    $data = json_encode([
      'type' => $item['type'] ?? 'material',
      'category' => $item['category'] ?? 'common',
      'icon' => $item['icon'] ?? null,
    ]);
    $stmt->execute([$userId, $itemId, $item['name'], $data]);
  }
  return count($items);
}

function getLootTable($zoneName, $playerLevel) {
  $level = min($playerLevel, 10);
  $common = [
    ['name' => 'Ржавый винт', 'weight' => 20, 'type' => 'material', 'category' => 'junk'],
    ['name' => 'Рваная ткань', 'weight' => 20, 'type' => 'material', 'category' => 'junk'],
    ['name' => 'Битая посуда', 'weight' => 15, 'type' => 'material', 'category' => 'junk'],
  ];
  $uncommon = [
    ['name' => 'Медный провод', 'weight' => 15, 'type' => 'material', 'category' => 'junk'],
    ['name' => 'Стальная пластина', 'weight' => 12, 'type' => 'material', 'category' => 'junk'],
    ['name' => 'Старая гайка', 'weight' => 15, 'type' => 'material', 'category' => 'junk'],
  ];
  $rare = [
    ['name' => 'Микросхема', 'weight' => 5, 'type' => 'material', 'category' => 'rare'],
    ['name' => 'Оптический прицел', 'weight' => 3, 'type' => 'equipment', 'category' => 'rare'],
    ['name' => 'Довоенный чип', 'weight' => 4, 'type' => 'material', 'category' => 'rare'],
  ];
  $mats = [
    ['name' => 'Вода', 'weight' => 8, 'type' => 'material', 'category' => 'material'],
    ['name' => 'Изолента', 'weight' => 8, 'type' => 'material', 'category' => 'material'],
    ['name' => 'Инструменты', 'weight' => 6, 'type' => 'material', 'category' => 'material'],
    ['name' => 'Дерево', 'weight' => 10, 'type' => 'material', 'category' => 'material'],
    ['name' => 'Железо', 'weight' => 8, 'type' => 'material', 'category' => 'material'],
    ['name' => 'Аптечка', 'weight' => 4, 'type' => 'material', 'category' => 'material'],
    ['name' => 'Бинты', 'weight' => 6, 'type' => 'material', 'category' => 'material'],
    ['name' => 'Патроны', 'weight' => 7, 'type' => 'material', 'category' => 'material'],
  ];
  $table = array_merge($common, $uncommon, $mats);
  if ($level >= 3) $table = array_merge($table, $rare);
  if ($level >= 5) {
    $table = array_merge($table, [
      ['name' => 'Артефакт «Слеза»', 'weight' => 1, 'type' => 'artifact', 'category' => 'legendary'],
      ['name' => 'Генератор щита', 'weight' => 2, 'type' => 'equipment', 'category' => 'rare'],
    ]);
  }
  return $table;
}
