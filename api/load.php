<?php
require_once __DIR__ . '/config.php';

$user = requireAuth();

$pdo = getDB();
$stmt = $pdo->prepare('SELECT save_data, updated_at FROM saves WHERE user_id = ?');
$stmt->execute([$user['id']]);
$row = $stmt->fetch();

if (!$row) {
    jsonResponse(['data' => null]);
}

$data = json_decode($row['save_data'], true);
jsonResponse(['data' => $data, 'updated_at' => $row['updated_at']]);
