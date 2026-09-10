<?php
require_once __DIR__ . '/../config.php';

$user = requireAuth();
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['slot'], $input['item'])) {
    jsonResponse(['error' => 'Missing slot or item'], 400);
}

$slot = $input['slot'];
$item = $input['item'];
$itemId = $item['id'] ?? '';

$pdo = getDB();

// Обновить item_data (например loadedAmmo магазина). Если строки нет — вставить.
$upd = $pdo->prepare('UPDATE equipment SET item_id = ?, item_data = ? WHERE user_id = ? AND slot = ?');
$upd->execute([$itemId, json_encode($item, JSON_UNESCAPED_UNICODE), $user['id'], $slot]);

if ($upd->rowCount() === 0) {
    $ins = $pdo->prepare('INSERT INTO equipment (user_id, slot, item_id, item_data) VALUES (?, ?, ?, ?)');
    $ins->execute([$user['id'], $slot, $itemId, json_encode($item, JSON_UNESCAPED_UNICODE)]);
}

jsonResponse(['ok' => true, 'slot' => $slot]);
