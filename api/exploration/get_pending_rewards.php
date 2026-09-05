<?php
// Список невыданных наград за события путешествия.
// Клиент генерирует предметы сам (generateItem) и сохраняет через save_items.php.
require_once __DIR__ . '/../../api/config.php';

$pdo = getDB();
$user = requireAuth();

$stmt = $pdo->prepare("SELECT id, exploration_id, event_id, event_text, item_count, player_level, reward_data
  FROM offline_rewards WHERE user_id = ? AND claimed = 0 ORDER BY id ASC LIMIT 50");
$stmt->execute([$user['id']]);
$rows = $stmt->fetchAll();

$list = [];
foreach ($rows as $r) {
  $list[] = [
    'id' => (int)$r['id'],
    'exploration_id' => (int)$r['exploration_id'],
    'event_id' => (int)$r['event_id'],
    'event_text' => $r['event_text'],
    'item_count' => (int)$r['item_count'],
    'player_level' => (int)$r['player_level'],
    'reward_data' => $r['reward_data'],
  ];
}

jsonResponse(['pendingRewards' => $list]);
