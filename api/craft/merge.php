<?php
require_once __DIR__ . '/../config.php';

$user = requireAuth();
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['consumeIds'], $input['result'])) {
    jsonResponse(['error' => 'Missing consumeIds or result'], 400);
}

$pdo = getDB();
$pdo->beginTransaction();

try {
    // Verify all items to consume belong to user
    $placeholders = implode(',', array_fill(0, count($input['consumeIds']), '?'));
    $stmt = $pdo->prepare("SELECT item_id FROM inventory_items WHERE user_id = ? AND item_id IN ($placeholders)");
    $stmt->execute(array_merge([$user['id']], $input['consumeIds']));
    $existing = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $missing = array_diff($input['consumeIds'], $existing);
    if (!empty($missing)) {
        $pdo->rollBack();
        jsonResponse(['error' => 'Items not found: ' . implode(',', $missing)], 400);
    }

    // Delete consumed items
    $del = $pdo->prepare("DELETE FROM inventory_items WHERE user_id = ? AND item_id IN ($placeholders)");
    $del->execute(array_merge([$user['id']], $input['consumeIds']));

    // Insert result item
    $item = $input['result'];
    $ins = $pdo->prepare(
        'INSERT INTO inventory_items (user_id, item_id, name, slot, quantity, equipped, data)
         VALUES (?, ?, ?, ?, ?, 0, ?)'
    );
    $itemId = $item['id'] ?? '';
    $name = $item['name'] ?? '';
    $slot = $item['slot'] ?? null;
    $quantity = $item['quantity'] ?? 1;
    $data = $item;
    unset($data['id'], $data['name'], $data['slot'], $data['quantity']);
    $ins->execute([$user['id'], $itemId, $name, $slot, $quantity, json_encode($data, JSON_UNESCAPED_UNICODE)]);

    $pdo->commit();
    jsonResponse(['ok' => true]);
} catch (Exception $e) {
    $pdo->rollBack();
    jsonResponse(['error' => 'Merge failed: ' . $e->getMessage()], 500);
}
