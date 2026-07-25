<?php
require_once __DIR__ . '/../config.php';

$user = requireAuth();
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['items']) || !is_array($input['items'])) {
    jsonResponse(['error' => 'Missing items array'], 400);
}

$pdo = getDB();
$pdo->beginTransaction();

try {
    // Delete all items for user
    $del = $pdo->prepare('DELETE FROM inventory_items WHERE user_id = ?');
    $del->execute([$user['id']]);

    // Insert new items
    $ins = $pdo->prepare(
        'INSERT INTO inventory_items (user_id, item_id, name, slot, quantity, equipped, data)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    foreach ($input['items'] as $item) {
        $itemId = $item['id'] ?? '';
        $name = $item['name'] ?? '';
        $slot = $item['slot'] ?? null;
        $quantity = $item['quantity'] ?? 1;
        $equipped = !empty($item['equipped']) ? 1 : 0;

        // Remove fields that shouldn't be in data
        $data = $item;
        unset($data['id'], $data['name'], $data['slot'], $data['quantity'], $data['equipped']);

        $ins->execute([$user['id'], $itemId, $name, $slot, $quantity, $equipped, json_encode($data, JSON_UNESCAPED_UNICODE)]);
    }

    $pdo->commit();
    jsonResponse(['ok' => true, 'count' => count($input['items'])]);
} catch (Exception $e) {
    $pdo->rollBack();
    jsonResponse(['error' => 'Sync failed: ' . $e->getMessage()], 500);
}
