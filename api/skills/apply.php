<?php
require_once __DIR__ . '/../config.php';

$user = requireAuth();
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['pendingSkills'])) {
    jsonResponse(['error' => 'Missing pendingSkills'], 400);
}

$pendingSkills = $input['pendingSkills'];
$pdo = getDB();
$pdo->beginTransaction();

try {
    // Load current skills from DB
    $stmt = $pdo->prepare('SELECT skill_id, points FROM player_skills WHERE user_id = ?');
    $stmt->execute([$user['id']]);
    $existing = [];
    $totalSpent = 0;
    foreach ($stmt->fetchAll() as $row) {
        $existing[$row['skill_id']] = (int)$row['points'];
        $totalSpent += (int)$row['points'];
    }

    // Read level for total earned
    $saveStmt = $pdo->prepare('SELECT save_data FROM saves WHERE user_id = ?');
    $saveStmt->execute([$user['id']]);
    $saveRow = $saveStmt->fetch();
    if (!$saveRow) {
        $pdo->rollBack();
        jsonResponse(['error' => 'Save not found'], 400);
    }
    $sd = json_decode($saveRow['save_data'], true);
    $level = (int)($sd['player']['level'] ?? 1);
    $totalEarned = 3 + ($level - 1) * 3;

    // Validate each pending skill
    // Load SKILL_CLASSES definitions from skills data file
    $skillsClassFile = __DIR__ . '/../../src/data/skills.ts';
    // Since we can't parse TS directly, validate using DB-level checks:
    // 1. total after apply ≤ totalEarned
    // 2. each skill ≥ 0

    $newSkills = $existing;
    $pendingTotal = 0;

    // First pass: apply pending to get new skills map
    foreach ($pendingSkills as $skillId => $points) {
        $points = (int)$points;
        if ($points < 0) {
            $pdo->rollBack();
            jsonResponse(['error' => 'Negative points for ' . $skillId], 400);
        }
        $newSkills[$skillId] = ($newSkills[$skillId] ?? 0) + $points;
        $pendingTotal += $points;
    }

    // Check total doesn't exceed earnings
    $newTotalSpent = $totalSpent + $pendingTotal;
    if ($newTotalSpent > $totalEarned) {
        $pdo->rollBack();
        jsonResponse(['error' => 'Not enough skill points'], 400);
    }

    // UPSERT new skills
    $upsert = $pdo->prepare(
        'INSERT INTO player_skills (user_id, skill_id, points) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE points = VALUES(points)'
    );
    $delete = $pdo->prepare('DELETE FROM player_skills WHERE user_id = ? AND skill_id = ?');

    foreach ($newSkills as $skillId => $points) {
        if ($points <= 0) {
            $delete->execute([$user['id'], $skillId]);
        } else {
            $upsert->execute([$user['id'], $skillId, $points]);
        }
    }

    $pdo->commit();

    $available = $totalEarned - $newTotalSpent;

    jsonResponse([
        'ok' => true,
        'skills' => $newSkills,
        'skillPoints' => max(0, $available),
    ]);
} catch (Exception $e) {
    $pdo->rollBack();
    jsonResponse(['error' => 'Apply failed: ' . $e->getMessage()], 500);
}
