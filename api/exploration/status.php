<?php
require_once __DIR__ . '/../../api/config.php';
require_once __DIR__ . '/engine_logic.php';

$pdo = getDB();
$user = requireAuth();
$userId = $user['id'];

// Process pending ticks and return state
$result = processTicks($pdo, $userId);

if (!$result) {
  jsonResponse(['active' => false]);
}

// Load events only for this exploration
$expId = $result['exploration']['id'] ?? null;
$events = [];
if ($expId) {
  $stmt = $pdo->prepare("SELECT * FROM exploration_events WHERE exploration_id = ? ORDER BY id DESC LIMIT 1000");
  $stmt->execute([$expId]);
  $events = $stmt->fetchAll();
}

$result['events'] = $events;
jsonResponse($result);
