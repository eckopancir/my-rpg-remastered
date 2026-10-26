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
  // Активного рейда нет. Если последний закончился смертью — сообщаем
  // исход, иначе штраф (потеря добычи и обнуление рюкзака) не применится.
  $hStmt = $pdo->prepare("SELECT outcome FROM exploration_history WHERE user_id = ? ORDER BY id DESC LIMIT 1");
  $hStmt->execute([$userId]);
  $hRow = $hStmt->fetch();
  $lastOutcome = ($hRow && $hRow['outcome'] === 'dead') ? 'dead' : 'complete';
  // Характеристики последнего режима — клиент рисует их в шапке журнала,
  // даже когда рейд уже закончился.
  $lStmt = $pdo->prepare("SELECT difficulty, modifier FROM explorations WHERE user_id = ? ORDER BY id DESC LIMIT 1");
  $lStmt->execute([$userId]);
  $lastExp = $lStmt->fetch() ?: [];
  jsonResponse([
    'active' => false,
    'state' => $lastOutcome,
    'difficulty' => $lastExp['difficulty'] ?? 'normal',
    'modifier' => $lastExp['modifier'] ?? null,
    'difficultyInfo' => travelDifficulty($lastExp['difficulty'] ?? 'normal'),
    'modifierInfo' => travelModifier($lastExp['modifier'] ?? null),
    // Данные последней смерти — клиент рисует экран смерти после перезагрузки.
    'death' => $lastOutcome === 'dead' ? lastDeathInfo($pdo, $userId) : null,
  ]);
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
