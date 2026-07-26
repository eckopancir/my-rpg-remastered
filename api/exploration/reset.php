<?php
// Force-reset: marks ALL active explorations as complete
require_once __DIR__ . '/../../api/config.php';
require_once __DIR__ . '/engine_logic.php';

$pdo = getDB();
$user = requireAuth();
$userId = $user['id'];

$stmt = $pdo->prepare("SELECT * FROM explorations WHERE user_id = ? AND phase NOT IN ('complete','idle') ORDER BY id DESC");
$stmt->execute([$userId]);
$count = 0;
while ($old = $stmt->fetch()) {
    $old['phase'] = 'complete';
    saveExplorationHistory($pdo, $userId, $old, 'cancelled');
    $count++;
}
$upd = $pdo->prepare("UPDATE explorations SET phase = 'complete' WHERE user_id = ? AND phase NOT IN ('complete','idle')");
$upd->execute([$userId]);
$updCount = $upd->rowCount();

jsonResponse(['success' => true, 'reset_count' => $count, 'updated' => $updCount]);
