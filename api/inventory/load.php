<?php
require_once __DIR__ . '/../config.php';

$user = requireAuth();

$pdo = getDB();
$stmt = $pdo->prepare('SELECT item_id, name, slot, quantity, equipped, data FROM inventory_items WHERE user_id = ? ORDER BY id ASC');
$stmt->execute([$user['id']]);
$rows = $stmt->fetchAll();

$items = [];
foreach ($rows as $row) {
    $data = json_decode($row['data'], true) ?: [];
    $data['id'] = $row['item_id'];
    $data['name'] = $row['name'];
    $data['slot'] = $row['slot'];
    $data['quantity'] = (int)$row['quantity'];
    $data['equipped'] = (bool)$row['equipped'];
    $items[] = $data;
}

jsonResponse(['items' => $items]);
