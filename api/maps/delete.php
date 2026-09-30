<?php
require_once __DIR__ . '/../config.php';

$user = requireAuth();
$input = json_decode(file_get_contents('php://input'), true);
$name = trim((string)(($input['name'] ?? '')));
if ($name === '') {
    jsonResponse(['error' => 'Missing name'], 400);
}

$pdo = getDB();
$stmt = $pdo->prepare('DELETE FROM custom_maps WHERE user_id = ? AND name = ?');
$stmt->execute([$user['id'], $name]);

jsonResponse(['ok' => true, 'name' => $name]);
