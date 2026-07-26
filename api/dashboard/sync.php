<?php
require_once __DIR__ . '/../config.php';

$user = requireAuth();
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) jsonResponse(['error' => 'Invalid input'], 400);

$pdo = getDB();

// During active exploration, server is the source of truth — skip sync to prevent
// stale client data from overwriting exploration gains (chips, exp, HP).
$stmt = $pdo->prepare("SELECT id FROM explorations WHERE user_id = ? AND phase NOT IN ('complete','idle') LIMIT 1");
$stmt->execute([$user['id']]);
if ($stmt->fetch()) {
  jsonResponse(['ok' => true, 'exploration_active' => true]);
  exit;
}

// Read current save_data
$stmt = $pdo->prepare('SELECT save_data FROM saves WHERE user_id = ?');
$stmt->execute([$user['id']]);
$row = $stmt->fetch();

$sd = $row ? json_decode($row['save_data'], true) : ['player' => []];
if (!isset($sd['player'])) $sd['player'] = [];
if (!isset($sd['player']['stats'])) $sd['player']['stats'] = [];

// Patch with incoming dashboard-relevant fields
$fields = ['currentHp', 'stamina', 'currentExp', 'expToNext', 'dataChips', 'activeEffects'];
foreach ($fields as $f) {
    if (isset($input[$f])) {
        if ($f === 'currentHp') $sd['player']['stats']['currentHp'] = (int)$input[$f];
        elseif ($f === 'stamina') $sd['player']['stats']['stamina'] = (int)$input[$f];
        elseif ($f === 'activeEffects') $sd['player']['activeEffects'] = $input[$f];
        else $sd['player'][$f] = $input[$f];
    }
}

$stmt = $pdo->prepare(
    'INSERT INTO saves (user_id, save_data, updated_at) VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE save_data = VALUES(save_data), updated_at = NOW()'
);
$stmt->execute([$user['id'], json_encode($sd, JSON_UNESCAPED_UNICODE)]);

jsonResponse(['ok' => true]);
