<?php
require_once __DIR__ . '/../../api/config.php';
require_once __DIR__ . '/engine_logic.php';

$pdo = getDB();
$user = requireAuth();
$userId = $user['id'];
$zone = $_GET['zone'] ?? '';

if (!$zone) {
  jsonResponse(['error' => 'zone required'], 400);
}

// Auto-resolve any stale exploration before starting a new one
$stmt = $pdo->prepare("SELECT * FROM explorations WHERE user_id = ? AND phase NOT IN ('complete','idle') ORDER BY id DESC");
$stmt->execute([$userId]);
while ($old = $stmt->fetch()) {
  $old['phase'] = 'complete';
  saveExplorationHistory($pdo, $userId, $old, 'complete');
}
$upd = $pdo->prepare("UPDATE explorations SET phase = 'complete' WHERE user_id = ? AND phase NOT IN ('complete','idle')");
$upd->execute([$userId]);

try {
  $result = startExploration($pdo, $userId, $zone);
  jsonResponse(['success' => true, 'exploration' => $result]);
} catch (Exception $e) {
  jsonResponse(['error' => $e->getMessage()], 500);
}
