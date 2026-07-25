<?php
require_once __DIR__ . '/../config.php';

$user = requireAuth();
$pdo = getDB();
$pdo->beginTransaction();

try {
    // Read level and chips from save_data
    $saveStmt = $pdo->prepare('SELECT save_data FROM saves WHERE user_id = ? FOR UPDATE');
    $saveStmt->execute([$user['id']]);
    $saveRow = $saveStmt->fetch();
    if (!$saveRow) {
        $pdo->rollBack();
        jsonResponse(['error' => 'Save not found'], 400);
    }

    $sd = json_decode($saveRow['save_data'], true);
    $level = (int)($sd['player']['level'] ?? 1);
    $chips = (int)($sd['player']['dataChips'] ?? 0);

    $cost = 50 + $level * 10;
    if ($chips < $cost) {
        $pdo->rollBack();
        jsonResponse(['error' => "Not enough chips, need $cost"], 400);
    }

    // Deduct chips
    $sd['player']['dataChips'] = $chips - $cost;
    $updSave = $pdo->prepare('UPDATE saves SET save_data = ?, updated_at = NOW() WHERE user_id = ?');
    $updSave->execute([json_encode($sd, JSON_UNESCAPED_UNICODE), $user['id']]);

    // Delete all player_skills for this user
    $del = $pdo->prepare('DELETE FROM player_skills WHERE user_id = ?');
    $del->execute([$user['id']]);

    $pdo->commit();

    $totalEarned = 3 + ($level - 1) * 3;

    jsonResponse([
        'ok' => true,
        'skillPoints' => $totalEarned,
        'dataChips' => $sd['player']['dataChips'],
    ]);
} catch (Exception $e) {
    $pdo->rollBack();
    jsonResponse(['error' => 'Reset failed: ' . $e->getMessage()], 500);
}
