<?php
require_once __DIR__ . '/../config.php';

$user = requireAuth();
$pdo = getDB();
$now = date('Y-m-d H:i:s');

$stmt = $pdo->prepare('SELECT * FROM base_upgrades WHERE user_id = ? AND upgrading = 1 AND timer_expires_at IS NOT NULL AND timer_expires_at <= ?');
$stmt->execute([$user['id'], $now]);
$completed = $stmt->fetchAll();

$results = [];

foreach ($completed as $row) {
    $newLevel = (int)$row['level'] + 1;
    $upd = $pdo->prepare('UPDATE base_upgrades SET level = ?, upgrading = 0, timer_started_at = NULL, timer_duration = NULL, timer_expires_at = NULL WHERE id = ?');
    $upd->execute([$newLevel, $row['id']]);

    $results[] = [
        'baseName' => $row['base_name'],
        'newLevel' => $newLevel,
    ];
}

jsonResponse([
    'completed' => $results,
]);
