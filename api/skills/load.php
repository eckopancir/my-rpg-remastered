<?php
require_once __DIR__ . '/../config.php';

$user = requireAuth();
$pdo = getDB();

// Load skill points from DB
$stmt = $pdo->prepare('SELECT skill_id, points FROM player_skills WHERE user_id = ?');
$stmt->execute([$user['id']]);
$skillRows = $stmt->fetchAll();

$skills = [];
$totalSpent = 0;
// Бесплатные базовые снайпера в потраченные не считаются (зеркало freeTake).
$freeTakeIds = ['snp_x_aim' => 1, 'snp_a7_deadeye' => 1, 'snp_x_stealth' => 1, 'pet_regen' => 1, 'pet_ai' => 1];
foreach ($skillRows as $row) {
    $skills[$row['skill_id']] = (int)$row['points'];
    if (!isset($freeTakeIds[$row['skill_id']])) $totalSpent += (int)$row['points'];
}

// Read level from save_data to calculate available skill points
$saveStmt = $pdo->prepare('SELECT save_data FROM saves WHERE user_id = ?');
$saveStmt->execute([$user['id']]);
$level = 1;
if ($saveRow = $saveStmt->fetch()) {
    $sd = json_decode($saveRow['save_data'], true);
    $level = (int)($sd['player']['level'] ?? 1);
}

$totalEarned = 3 + ($level - 1) * 3;
$skillPoints = $totalEarned - $totalSpent;

jsonResponse([
    'skills' => $skills,
    'skillPoints' => max(0, $skillPoints),
]);
