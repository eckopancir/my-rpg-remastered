<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/player/vitals_catchup.php';

$user = requireAuth();

$pdo = getDB();
$stmt = $pdo->prepare('SELECT save_data, updated_at FROM saves WHERE user_id = ?');
$stmt->execute([$user['id']]);
$row = $stmt->fetch();

if (!$row) {
    jsonResponse(['data' => null]);
}

$data = json_decode($row['save_data'], true);
if (!is_array($data)) $data = [];

// Offline vitals catch-up: HP/stamina regen + effect/travel expiry while the
// site was closed (frontend ticks only run in an open tab).
$nowMs = (int)(microtime(true) * 1000);
$updatedSec = isset($row['updated_at']) ? strtotime($row['updated_at']) : null;
// Активная экспедиция: стамина в гэпе падает (−1%/ч), иначе растёт (+2%/ч).
$exploring = false;
$exploreStartedMs = null;
try {
    $expStmt = $pdo->prepare("SELECT UNIX_TIMESTAMP(started_at)*1000 AS sms FROM explorations WHERE user_id = ? AND phase NOT IN ('complete','idle') ORDER BY id DESC LIMIT 1");
    $expStmt->execute([$user['id']]);
    if ($expRow = $expStmt->fetch()) {
        $exploring = true;
        $exploreStartedMs = isset($expRow['sms']) ? (int)$expRow['sms'] : null;
    }
} catch (Exception $e) { /* ignore */ }
$catchup = applyVitalsCatchup($data, $nowMs, $updatedSec ?: null, $exploring, $exploreStartedMs);
if ($catchup['applied']) {
    $upd = $pdo->prepare('UPDATE saves SET save_data = ?, updated_at = NOW() WHERE user_id = ?');
    $upd->execute([json_encode($data, JSON_UNESCAPED_UNICODE), $user['id']]);
    $row['updated_at'] = date('Y-m-d H:i:s');
}

jsonResponse(['data' => $data, 'updated_at' => $row['updated_at'], 'vitalsCatchup' => $catchup]);
