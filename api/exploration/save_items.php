<?php
// Сохранение сгенерированных клиентом предметов + пометка награды выданной.
// Идемпотентно по rewardId: повтор (потерянный ответ, ретрай клиента)
// возвращает ok без дублирования предметов.
require_once __DIR__ . '/../../api/config.php';

$user = requireAuth();
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['items']) || !is_array($input['items']) || count($input['items']) === 0) {
  jsonResponse(['error' => 'Missing items array'], 400);
}
if (!isset($input['rewardId'])) {
  jsonResponse(['error' => 'Missing rewardId'], 400);
}
if (count($input['items']) > 50) {
  jsonResponse(['error' => 'Too many items'], 400);
}

$pdo = getDB();
$pdo->beginTransaction();

try {
  // Лочим награду: защита от двойного клейма из двух вкладок.
  $stmt = $pdo->prepare('SELECT id, exploration_id FROM offline_rewards WHERE id = ? AND user_id = ? AND claimed = 0 FOR UPDATE');
  $stmt->execute([(int)$input['rewardId'], $user['id']]);
  $reward = $stmt->fetch();

  if (!$reward) {
    // Уже выдана (ретрай после потерянного ответа) — ok без вставки.
    $check = $pdo->prepare('SELECT id FROM offline_rewards WHERE id = ? AND user_id = ? AND claimed = 1');
    $check->execute([(int)$input['rewardId'], $user['id']]);
    if ($check->fetch()) {
      $pdo->rollBack();
      jsonResponse(['ok' => true, 'already' => true]);
    }
    $pdo->rollBack();
    jsonResponse(['error' => 'Reward not found'], 404);
  }

  // Вставка в том же формате, что inventory/sync.php (колонки + остальное в data).
  $ins = $pdo->prepare(
    'INSERT INTO inventory_items (user_id, item_id, name, slot, quantity, equipped, data)
     VALUES (?, ?, ?, ?, ?, 0, ?)'
  );
  $newIds = [];
  foreach ($input['items'] as $item) {
    if (!is_array($item)) continue;
    $itemId = isset($item['id']) && $item['id'] !== '' ? (string)$item['id'] : 'srv_' . bin2hex(random_bytes(6));
    $name = $item['name'] ?? $item['displayName'] ?? 'Unknown';
    $slot = $item['slot'] ?? null;
    $quantity = max(1, (int)($item['quantity'] ?? 1));

    $data = $item;
    unset($data['id'], $data['name'], $data['slot'], $data['quantity'], $data['equipped']);

    $ins->execute([$user['id'], $itemId, $name, $slot, $quantity, json_encode($data, JSON_UNESCAPED_UNICODE)]);
    $newIds[] = (int)$pdo->lastInsertId();
  }

  if (empty($newIds)) {
    $pdo->rollBack();
    jsonResponse(['error' => 'No valid items'], 400);
  }

  // Привязываем находки к экспедиции, чтобы смерть откатывала их
  // (handleExplorationDeath чистит session_item_ids).
  $expStmt = $pdo->prepare('SELECT session_item_ids FROM explorations WHERE id = ? AND user_id = ? FOR UPDATE');
  $expStmt->execute([(int)$reward['exploration_id'], $user['id']]);
  if ($expRow = $expStmt->fetch()) {
    $sess = json_decode($expRow['session_item_ids'] ?? '[]', true);
    if (!is_array($sess)) $sess = [];
    foreach ($newIds as $nid) $sess[] = $nid;
    $updExp = $pdo->prepare('UPDATE explorations SET session_item_ids = ? WHERE id = ?');
    $updExp->execute([json_encode($sess, JSON_UNESCAPED_UNICODE), (int)$reward['exploration_id']]);
  }

  $claim = $pdo->prepare('UPDATE offline_rewards SET claimed = 1, claimed_at = NOW() WHERE id = ?');
  $claim->execute([(int)$reward['id']]);

  $pdo->commit();
  jsonResponse(['ok' => true, 'count' => count($newIds)]);
} catch (Exception $e) {
  $pdo->rollBack();
  jsonResponse(['error' => 'Save failed: ' . $e->getMessage()], 500);
}
