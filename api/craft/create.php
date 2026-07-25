<?php
require_once __DIR__ . '/../config.php';

$user = requireAuth();
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['blueprintId'], $input['result'])) {
    jsonResponse(['error' => 'Missing blueprintId or result'], 400);
}

$pdo = getDB();
$pdo->beginTransaction();

try {
    // Verify blueprint belongs to user
    $stmt = $pdo->prepare('SELECT id FROM inventory_items WHERE user_id = ? AND item_id = ?');
    $stmt->execute([$user['id'], $input['blueprintId']]);
    if (!$stmt->fetch()) {
        $pdo->rollBack();
        jsonResponse(['error' => 'Blueprint not found'], 400);
    }

    // Delete blueprint
    $del = $pdo->prepare('DELETE FROM inventory_items WHERE user_id = ? AND item_id = ?');
    $del->execute([$user['id'], $input['blueprintId']]);

    // Remove crafting resources (materials)
    if (!empty($input['resourceIds'])) {
        $placeholders = implode(',', array_fill(0, count($input['resourceIds']), '?'));
        $delRes = $pdo->prepare("DELETE FROM inventory_items WHERE user_id = ? AND item_id IN ($placeholders)");
        $delRes->execute(array_merge([$user['id']], $input['resourceIds']));
    }

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
    jsonResponse(['error' => 'Create failed: ' . $e->getMessage()], 500);
}
