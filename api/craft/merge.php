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
    // Расходники клиент убирает из инвентаря сразу при укладке в слоты
    // (и синкает), поэтому к моменту завершения их может уже не быть в БД —
    // удаляем что есть, отсутствующие не считаем ошибкой.
    $placeholders = implode(',', array_fill(0, count($input['consumeIds']), '?'));
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
