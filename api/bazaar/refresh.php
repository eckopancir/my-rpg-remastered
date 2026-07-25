<?php
require_once __DIR__ . '/../config.php';

$user = requireAuth();
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['items']) || !isset($input['refreshAt']) || !isset($input['cost'])) {
    jsonResponse(['error' => 'Missing items, refreshAt or cost'], 400);
}

$pdo = getDB();
$pdo->beginTransaction();

try {
    // Read current chips
    $saveStmt = $pdo->prepare('SELECT save_data FROM saves WHERE user_id = ? FOR UPDATE');
    $saveStmt->execute([$user['id']]);
    $saveRow = $saveStmt->fetch();

    if (!$saveRow) {
        $pdo->rollBack();
        jsonResponse(['error' => 'Save data not found'], 400);
    }

    $saveData = json_decode($saveRow['save_data'], true);
    $chips = (int)($saveData['player']['dataChips'] ?? 0);
    $cost = (int)$input['cost'];

    if ($chips < $cost) {
        $pdo->rollBack();
        jsonResponse(['error' => 'Not enough chips for refresh'], 400);
    }

    // Deduct chips
    $saveData['player']['dataChips'] = $chips - $cost;
    $updateSave = $pdo->prepare('UPDATE saves SET save_data = ?, updated_at = NOW() WHERE user_id = ?');
    $updateSave->execute([json_encode($saveData, JSON_UNESCAPED_UNICODE), $user['id']]);

    // Delete old shop items
    $del = $pdo->prepare('DELETE FROM bazaar_items WHERE user_id = ?');
    $del->execute([$user['id']]);

    // Insert new items
    $refreshAt = (int)$input['refreshAt'];
    $ins = $pdo->prepare(
        'INSERT INTO bazaar_items (user_id, item_id, data, bought, refresh_at) VALUES (?, ?, ?, 0, ?)'
    );
    foreach ($input['items'] as $item) {
        $itemId = $item['id'] ?? ('shop_' . uniqid());
        $ins->execute([$user['id'], $itemId, json_encode($item, JSON_UNESCAPED_UNICODE), $refreshAt]);
    }

    $pdo->commit();
    jsonResponse([
        'ok' => true,
        'dataChips' => $saveData['player']['dataChips'],
    ]);
} catch (Exception $e) {
    $pdo->rollBack();
    jsonResponse(['error' => 'Refresh failed: ' . $e->getMessage()], 500);
}
