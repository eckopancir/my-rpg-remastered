<?php
require_once __DIR__ . '/../config.php';

$user = requireAuth();
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['slot'])) {
    jsonResponse(['error' => 'Missing slot'], 400);
}

$slot = $input['slot'];

$pdo = getDB();

$stmt = $pdo->prepare('SELECT id, item_data FROM equipment WHERE user_id = ? AND slot = ?');
$stmt->execute([$user['id'], $slot]);
$row = $stmt->fetch();

if (!$row) {
    jsonResponse(['error' => 'Nothing equipped in this slot'], 404);
}

$del = $pdo->prepare('DELETE FROM equipment WHERE id = ?');
$del->execute([$row['id']]);

$item = json_decode($row['item_data'], true);
jsonResponse(['ok' => true, 'slot' => $slot, 'item' => $item]);
