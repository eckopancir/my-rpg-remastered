<?php
require_once __DIR__ . '/../config.php';

$user = requireAuth();
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['effectId'], $input['cooldown'])) {
    jsonResponse(['error' => 'Missing effectId or cooldown'], 400);
}

$pdo = getDB();
$effectId = $input['effectId'];
$cooldown = (int)$input['cooldown'];
$expiresAt = date('Y-m-d H:i:s', time() + $cooldown);

// Check existing cooldown
$stmt = $pdo->prepare('SELECT expires_at FROM base_effect_cooldowns WHERE user_id = ? AND effect_id = ?');
$stmt->execute([$user['id'], $effectId]);
$existing = $stmt->fetch();

if ($existing && $existing['expires_at'] > date('Y-m-d H:i:s')) {
    jsonResponse(['error' => 'Effect still on cooldown'], 400);
}

// Upsert cooldown
$ups = $pdo->prepare(
    'INSERT INTO base_effect_cooldowns (user_id, effect_id, expires_at) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at)'
);
$ups->execute([$user['id'], $effectId, $expiresAt]);

jsonResponse([
    'ok' => true,
    'expiresAt' => $expiresAt,
]);
