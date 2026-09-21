<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../player/vitals_catchup.php';

$user = requireAuth();
$pdo = getDB();

// 1. Read save_data for player state
$stmt = $pdo->prepare('SELECT save_data, updated_at FROM saves WHERE user_id = ?');
$stmt->execute([$user['id']]);
$row = $stmt->fetch();
$player = [];
if ($row) {
    $sd = json_decode($row['save_data'], true);
    if (!is_array($sd)) $sd = [];
    // Офлайн-догон виталов: пока сайт закрыт, фронтовые тики не идут.
    $nowMs = (int)(microtime(true) * 1000);
    $catchup = applyVitalsCatchup($sd, $nowMs, isset($row['updated_at']) ? strtotime($row['updated_at']) : null);
    if ($catchup['applied']) {
        $upd = $pdo->prepare('UPDATE saves SET save_data = ?, updated_at = NOW() WHERE user_id = ?');
        $upd->execute([json_encode($sd, JSON_UNESCAPED_UNICODE), $user['id']]);
    }
    $player = $sd['player'] ?? [];
}

// 2. Read equipment from dedicated table
$stmt = $pdo->prepare('SELECT slot, item_data FROM equipment WHERE user_id = ?');
$stmt->execute([$user['id']]);
$equipment = [];
foreach ($stmt->fetchAll() as $row) {
    $item = json_decode($row['item_data'], true);
    if ($item) $equipment[$row['slot']] = $item;
}
$equipment = (object)$equipment;

// 3. Read skills + calculate skillPoints
$stmt = $pdo->prepare('SELECT skill_id, points FROM player_skills WHERE user_id = ?');
$stmt->execute([$user['id']]);
$skills = [];
$totalSpent = 0;
foreach ($stmt->fetchAll() as $row) {
    $skills[$row['skill_id']] = (int)$row['points'];
    $totalSpent += (int)$row['points'];
}

$level = (int)($player['level'] ?? 1);
$totalEarned = 3 + ($level - 1) * 3;
$skillPoints = max(0, $totalEarned - $totalSpent);

jsonResponse([
    'level' => $level,
    'currentExp' => (int)($player['currentExp'] ?? 0),
    'expToNext' => (int)($player['expToNext'] ?? 100),
    'dataChips' => (int)($player['dataChips'] ?? 0),
    'baseHealth' => (int)($player['baseHealth'] ?? 200),
    'equipment' => $equipment,
    'activeEffects' => $player['activeEffects'] ?? [],
    'stats' => $player['stats'] ?? [],
    'skills' => $skills,
    'skillPoints' => $skillPoints,
]);
