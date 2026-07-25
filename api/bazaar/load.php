<?php
require_once __DIR__ . '/../config.php';

$user = requireAuth();
$pdo = getDB();

// Find latest refresh_at for this user
$stmt = $pdo->prepare('SELECT MAX(refresh_at) as max_refresh FROM bazaar_items WHERE user_id = ?');
$stmt->execute([$user['id']]);
$row = $stmt->fetch();
$refreshAt = $row['max_refresh'] ? (int)$row['max_refresh'] : 0;

$now = time() * 1000; // JS timestamp (ms)
$needsRefresh = false;

if ($refreshAt === 0) {
    // No shop yet — signal refresh needed
    jsonResponse(['items' => [], 'refreshAt' => 0, 'needsRefresh' => true, 'dataChips' => 0]);
}

if ($now >= $refreshAt) {
    // Expired — signal refresh, items deleted in sync.php / refresh.php when new data arrives
    jsonResponse(['items' => [], 'refreshAt' => 0, 'needsRefresh' => true, 'dataChips' => 0]);
}

// Load unbought items
$stmt = $pdo->prepare('SELECT data FROM bazaar_items WHERE user_id = ? AND bought = 0 ORDER BY id ASC');
$stmt->execute([$user['id']]);
$items = [];
while ($r = $stmt->fetch()) {
    $items[] = json_decode($r['data'], true);
}

// Read dataChips from save_data
$chips = 0;
$saveStmt = $pdo->prepare('SELECT save_data FROM saves WHERE user_id = ?');
$saveStmt->execute([$user['id']]);
$saveRow = $saveStmt->fetch();
if ($saveRow) {
    $sd = json_decode($saveRow['save_data'], true);
    $chips = $sd['player']['dataChips'] ?? 0;
}

jsonResponse([
    'items' => $items,
    'refreshAt' => $refreshAt,
    'needsRefresh' => false,
    'dataChips' => (int)$chips,
]);
