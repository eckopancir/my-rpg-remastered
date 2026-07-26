<?php
// Background tick processor — run every minute via task scheduler
require_once __DIR__ . '/../api/config.php';
require_once __DIR__ . '/../api/exploration/engine_logic.php';

$pdo = getDB();

$stmt = $pdo->prepare("SELECT id, user_id FROM explorations WHERE phase NOT IN ('complete','idle')");
$stmt->execute();
$active = $stmt->fetchAll();

$processed = 0;
foreach ($active as $exp) {
  $result = processTicks($pdo, $exp['user_id'], 60);
  if ($result) $processed++;
}

echo json_encode(['processed' => $processed, 'checked' => count($active), 'time' => date('Y-m-d H:i:s')]);
