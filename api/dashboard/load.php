<?php
require_once __DIR__ . '/../config.php';

$user = requireAuth();
$pdo = getDB();

// 1. Read save_data for player state
$stmt = $pdo->prepare('SELECT save_data FROM saves WHERE user_id = ?');
$stmt->execute([$user['id']]);
$row = $stmt->fetch();
$player = [];
if ($row) {
    $sd = json_decode($row['save_data'], true);
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
