<?php
require_once __DIR__ . '/../../api/config.php';
require_once __DIR__ . '/engine_logic.php';

$pdo = getDB();
$user = requireAuth();
$userId = $user['id'];

// Пагинация лога: после долгого офлайна в exploration_events тысячи строк,
// отдавать их все одним куском (как раньше LIMIT 1000) — вешает клиент.
// По умолчанию отдаём только хвост; старые события фронт догружает
// через before_id (кнопка "показать ещё").
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 150;
$limit = max(1, min($limit, 500));
$beforeId = isset($_GET['before_id']) ? (int)$_GET['before_id'] : 0;

// Process pending ticks and return state
$result = processTicks($pdo, $userId);

if (!$result) {
  jsonResponse(['active' => false]);
}

// Load events only for this exploration (paginated tail)
$expId = $result['exploration']['id'] ?? null;
$events = [];
$totalEvents = 0;
if ($expId) {
  $cntStmt = $pdo->prepare("SELECT COUNT(*) AS c FROM exploration_events WHERE exploration_id = ?");
  $cntStmt->execute([$expId]);
  $totalEvents = (int)($cntStmt->fetch()['c'] ?? 0);

  if ($beforeId > 0) {
    $stmt = $pdo->prepare("SELECT * FROM exploration_events WHERE exploration_id = ? AND id < ? ORDER BY id DESC LIMIT $limit");
    $stmt->execute([$expId, $beforeId]);
  } else {
    $stmt = $pdo->prepare("SELECT * FROM exploration_events WHERE exploration_id = ? ORDER BY id DESC LIMIT $limit");
    $stmt->execute([$expId]);
  }
  $events = $stmt->fetchAll();
}

$result['events'] = $events;
$result['totalEvents'] = $totalEvents;
jsonResponse($result);
