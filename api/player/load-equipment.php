<?php
require_once __DIR__ . '/../config.php';

$user = requireAuth();

$pdo = getDB();
$stmt = $pdo->prepare('SELECT slot, item_data FROM equipment WHERE user_id = ?');
$stmt->execute([$user['id']]);
$rows = $stmt->fetchAll();

$equipment = [];
foreach ($rows as $row) {
    $item = json_decode($row['item_data'], true);
    if ($item) $equipment[$row['slot']] = $item;
}

jsonResponse(['equipment' => $equipment]);
