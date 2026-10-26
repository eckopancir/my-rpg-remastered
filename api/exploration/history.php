<?php
require_once __DIR__ . '/../../api/config.php';

$pdo = getDB();
$user = requireAuth();
$userId = $user['id'];

$limit = max(1, min(50, (int)($_GET['limit'] ?? 20)));
$offset = max(0, (int)($_GET['offset'] ?? 0));
$outcome = (string)($_GET['outcome'] ?? 'all'); // all | complete | cancelled | dead

$where = "user_id = ?";
$params = [$userId];
if ($outcome === 'complete' || $outcome === 'cancelled' || $outcome === 'dead') {
  $where .= " AND outcome = ?";
  $params[] = $outcome;
}

// Итоги по выбранному фильтру (всего рейдов, суммы, смерти).
$sumStmt = $pdo->prepare("SELECT COUNT(*) AS trips,
    COALESCE(SUM(total_chips), 0) AS chips,
    COALESCE(SUM(total_exp), 0) AS exp,
    COALESCE(SUM(total_items), 0) AS items,
    COALESCE(SUM(outcome = 'dead'), 0) AS deaths
  FROM exploration_history WHERE $where");
$sumStmt->execute($params);
$summary = $sumStmt->fetch();
foreach ($summary as $k => $v) $summary[$k] = (int)$v;

$stmt = $pdo->prepare("SELECT id, zone, difficulty, modifier, planned_sec, outcome, total_chips, total_exp, total_items,
    duration_seconds, started_at, death_cause, lost_chips, lost_items, event_log, ended_at
  FROM exploration_history WHERE $where ORDER BY ended_at DESC, id DESC LIMIT ? OFFSET ?");
$stmt->bindValue(array_push($params, $limit) - 1, $limit, PDO::PARAM_INT);
$stmt->bindValue(array_push($params, $offset) - 1, $offset, PDO::PARAM_INT);
$stmt->execute($params);
$rows = $stmt->fetchAll();

foreach ($rows as &$r) {
  $r['event_log'] = $r['event_log'] ? json_decode($r['event_log'], true) : [];
  foreach (['total_chips', 'total_exp', 'total_items', 'duration_seconds', 'planned_sec', 'lost_chips', 'lost_items'] as $f) {
    $r[$f] = (int)$r[$f];
  }
}

jsonResponse(['history' => $rows, 'summary' => $summary]);
