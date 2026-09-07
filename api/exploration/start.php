<?php
require_once __DIR__ . '/../../api/config.php';
require_once __DIR__ . '/engine_logic.php';

$pdo = getDB();
$user = requireAuth();
$userId = $user['id'];
// Параметры — из POST-JSON (рюкзак не влезет в GET) либо из query (совместимость).
$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) $input = [];
$zone = $input['zone'] ?? $_GET['zone'] ?? '';
$hours = isset($input['hours']) ? (int)$input['hours'] : (isset($_GET['hours']) ? (int)$_GET['hours'] : 12);
// use_mats=0: ресурсы из инвентаря не тратятся, события идут по no-resource веткам.
$useMats = isset($input['use_mats']) ? (int)$input['use_mats'] : (isset($_GET['use_mats']) ? (int)$_GET['use_mats'] : 1);
// Рюкзак: [{name, qty}] — сгорает из инвентаря на старте.
$consumables = $input['consumables'] ?? [];
if (!is_array($consumables)) $consumables = [];

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
  $result = startExploration($pdo, $userId, $zone, $hours, $useMats, $consumables);
  jsonResponse(['success' => true, 'exploration' => $result]);
} catch (Exception $e) {
  jsonResponse(['error' => $e->getMessage()], 500);
}
