<?php
// Текущая сытость питомца (с распадом). GET.
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/pet_state.php';

$user = requireAuth();
$pdo = getDB();

$saveStmt = $pdo->prepare('SELECT save_data FROM saves WHERE user_id = ?');
$saveStmt->execute([$user['id']]);
$saveRow = $saveStmt->fetch();
if (!$saveRow) {
    jsonResponse(['error' => 'Save not found'], 400);
}
$sd = json_decode($saveRow['save_data'], true);
$nowMs = (int)(microtime(true) * 1000);
$st = petStateFromSave($sd);
if ($st === null) {
    // Новый питомец — сыт полностью.
    jsonResponse(['value' => 100, 'mood' => 'green']);
}
list($v, $tMs) = $st;
$value = petSatietyAt($v, $tMs, $nowMs);
jsonResponse(['value' => round($value, 1), 'mood' => petMood($value)]);
