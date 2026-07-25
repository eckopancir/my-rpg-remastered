<?php
require_once __DIR__ . '/../config.php';

$user = requireAuth();
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['items']) || !isset($input['refreshAt'])) {
    jsonResponse(['error' => 'Missing items or refreshAt'], 400);
}

$pdo = getDB();
$pdo->beginTransaction();

try {
    // Delete all existing bazaar items for user
    $del = $pdo->prepare('DELETE FROM bazaar_items WHERE user_id = ?');
    $del->execute([$user['id']]);

    $refreshAt = (int)$input['refreshAt'];
    $ins = $pdo->prepare(
        'INSERT INTO bazaar_items (user_id, item_id, data, bought, refresh_at) VALUES (?, ?, ?, 0, ?)'
    );

    foreach ($input['items'] as $item) {
        $itemId = $item['id'] ?? ('shop_' . uniqid());
        $ins->execute([$user['id'], $itemId, json_encode($item, JSON_UNESCAPED_UNICODE), $refreshAt]);
    }

    $pdo->commit();
    jsonResponse(['ok' => true]);
} catch (Exception $e) {
    $pdo->rollBack();
    jsonResponse(['error' => 'Sync failed: ' . $e->getMessage()], 500);
}
