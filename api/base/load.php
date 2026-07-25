<?php
require_once __DIR__ . '/../config.php';

$user = requireAuth();
$pdo = getDB();
$now = date('Y-m-d H:i:s');

// Load all base upgrades for this user
$stmt = $pdo->prepare('SELECT * FROM base_upgrades WHERE user_id = ?');
$stmt->execute([$user['id']]);
$dbUpgrades = $stmt->fetchAll();

$upgrades = [];
$completedUpgrades = [];

foreach ($dbUpgrades as $row) {
    $upgrading = (int)$row['upgrading'];
    $expiresAt = $row['timer_expires_at'];

    // Check if timer expired
    if ($upgrading && $expiresAt && $expiresAt <= $now) {
        // Apply upgrade
        $newLevel = (int)$row['level'] + 1;
        $upd = $pdo->prepare('UPDATE base_upgrades SET level = ?, upgrading = 0, timer_started_at = NULL, timer_duration = NULL, timer_expires_at = NULL WHERE id = ?');
        $upd->execute([$newLevel, $row['id']]);

        $completedUpgrades[] = [
            'baseName' => $row['base_name'],
            'newLevel' => $newLevel,
        ];

        $upgrades[] = [
            'baseName' => $row['base_name'],
            'className' => $row['class_name'],
            'level' => $newLevel,
            'upgrading' => false,
            'timerExpiresAt' => null,
        ];
    } else {
        $upgrades[] = [
            'baseName' => $row['base_name'],
            'className' => $row['class_name'],
            'level' => (int)$row['level'],
            'upgrading' => (bool)$upgrading,
            'timerExpiresAt' => $upgrading ? strtotime($expiresAt) * 1000 : null,
        ];
    }
}

// Load effect cooldowns (as Unix ms)
$cdStmt = $pdo->prepare('SELECT effect_id, expires_at FROM base_effect_cooldowns WHERE user_id = ?');
$cdStmt->execute([$user['id']]);
$cooldowns = [];
while ($cd = $cdStmt->fetch()) {
    if ($cd['expires_at'] > $now) {
        $cooldowns[$cd['effect_id']] = strtotime($cd['expires_at']) * 1000;
    }
}

// Read dataChips
$chips = 0;
$saveStmt = $pdo->prepare('SELECT save_data FROM saves WHERE user_id = ?');
$saveStmt->execute([$user['id']]);
if ($saveRow = $saveStmt->fetch()) {
    $sd = json_decode($saveRow['save_data'], true);
    $chips = $sd['player']['dataChips'] ?? 0;
}

jsonResponse([
    'upgrades' => $upgrades,
    'cooldowns' => $cooldowns,
    'completedUpgrades' => $completedUpgrades,
    'dataChips' => (int)$chips,
]);
