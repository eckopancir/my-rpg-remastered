<?php
require_once __DIR__ . '/../../api/config.php';

$pdo = getDB();
$user = requireAuth();
$userId = $user['id'];

$limit = max(1, min(50, (int)($_GET['limit'] ?? 20)));

$stmt = $pdo->prepare("SELECT id, zone, outcome, total_chips, total_exp, total_items, duration_seconds, event_log, ended_at
  FROM exploration_history WHERE user_id = ? ORDER BY ended_at DESC LIMIT ?");
$stmt->bindValue(1, $userId, PDO::PARAM_INT);
$stmt->bindValue(2, $limit, PDO::PARAM_INT);
$stmt->execute();
$rows = $stmt->fetchAll();

foreach ($rows as &$r) {
  $r['event_log'] = $r['event_log'] ? json_decode($r['event_log'], true) : [];
  $r['total_chips'] = (int)$r['total_chips'];
  $r['total_exp'] = (int)$r['total_exp'];
  $r['total_items'] = (int)$r['total_items'];
  $r['duration_seconds'] = (int)$r['duration_seconds'];
}

jsonResponse(['history' => $rows]);
