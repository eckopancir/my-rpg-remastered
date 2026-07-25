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

// Check if slot is already occupied
$stmt = $pdo->prepare('SELECT id FROM equipment WHERE user_id = ? AND slot = ?');
$stmt->execute([$user['id'], $slot]);
if ($stmt->fetch()) {
    jsonResponse(['error' => 'Slot already occupied'], 409);
}

// Insert equipment
$ins = $pdo->prepare('INSERT INTO equipment (user_id, slot, item_id, item_data) VALUES (?, ?, ?, ?)');
$ins->execute([$user['id'], $slot, $itemId, json_encode($item, JSON_UNESCAPED_UNICODE)]);

jsonResponse(['ok' => true, 'slot' => $slot, 'item' => $item]);
