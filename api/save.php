<?php
require_once __DIR__ . '/config.php';

$user = requireAuth();
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['data'])) {
    jsonResponse(['error' => 'Missing data'], 400);
}

$pdo = getDB();
$stmt = $pdo->prepare(
    'INSERT INTO saves (user_id, save_data, updated_at) VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE save_data = VALUES(save_data), updated_at = NOW()'
);
$stmt->execute([$user['id'], json_encode($input['data'], JSON_UNESCAPED_UNICODE)]);

jsonResponse(['ok' => true]);
