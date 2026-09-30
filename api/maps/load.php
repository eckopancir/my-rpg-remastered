<?php
require_once __DIR__ . '/../config.php';

$user = requireAuth();
$name = trim((string)($_GET['name'] ?? ''));
if ($name === '') {
    jsonResponse(['error' => 'Missing name'], 400);
}

$pdo = getDB();
$stmt = $pdo->prepare('SELECT name, map_data, updated_at FROM custom_maps WHERE user_id = ? AND name = ?');
$stmt->execute([$user['id'], $name]);
$row = $stmt->fetch();
if (!$row) {
    jsonResponse(['error' => 'Not found'], 404);
}

$map = json_decode($row['map_data'], true);
if (!is_array($map)) {
    jsonResponse(['error' => 'Corrupt map'], 500);
}

jsonResponse(['ok' => true, 'name' => $row['name'], 'updatedAt' => $row['updated_at'], 'map' => $map]);
