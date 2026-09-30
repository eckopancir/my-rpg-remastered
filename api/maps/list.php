<?php
require_once __DIR__ . '/../config.php';

$user = requireAuth();
$pdo = getDB();

$stmt = $pdo->prepare('SELECT name, map_data, updated_at FROM custom_maps WHERE user_id = ? ORDER BY updated_at DESC');
$stmt->execute([$user['id']]);

$out = [];
while ($row = $stmt->fetch()) {
    $map = json_decode($row['map_data'], true);
    $out[] = [
        'name' => $row['name'],
        'updatedAt' => $row['updated_at'],
        'obstacles' => is_array($map) && isset($map['obstacles']) && is_array($map['obstacles']) ? count($map['obstacles']) : 0,
        'units' => is_array($map) && isset($map['units']) && is_array($map['units']) ? count($map['units']) : 0,
    ];
}

jsonResponse(['ok' => true, 'maps' => $out]);
