<?php
require_once __DIR__ . '/../config.php';

$user = requireAuth();
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['itemId'])) {
    jsonResponse(['error' => 'Missing itemId'], 400);
}

$pdo = getDB();
$pdo->beginTransaction();

try {
    // Find the item
    $stmt = $pdo->prepare('SELECT data FROM bazaar_items WHERE user_id = ? AND item_id = ? AND bought = 0 FOR UPDATE');
    $stmt->execute([$user['id'], $input['itemId']]);
    $row = $stmt->fetch();

    if (!$row) {
        $pdo->rollBack();
        jsonResponse(['error' => 'Item not found or already bought'], 400);
    }

    $item = json_decode($row['data'], true);
    $price = (int)($item['price'] ?? 0);
    $buyPrice = (int)($item['_buyPrice'] ?? $price); // client can pass discounted price

    // Read current chips from save_data
    $saveStmt = $pdo->prepare('SELECT save_data FROM saves WHERE user_id = ? FOR UPDATE');
    $saveStmt->execute([$user['id']]);
    $saveRow = $saveStmt->fetch();

    if (!$saveRow) {
        $pdo->rollBack();
        jsonResponse(['error' => 'Save data not found'], 400);
    }

    $saveData = json_decode($saveRow['save_data'], true);
    $chips = (int)($saveData['player']['dataChips'] ?? 0);

    if ($chips < $buyPrice) {
        $pdo->rollBack();
        jsonResponse(['error' => 'Not enough chips'], 400);
    }

    // Deduct chips
    $saveData['player']['dataChips'] = $chips - $buyPrice;

    // Mark item as bought
    $buyStmt = $pdo->prepare('UPDATE bazaar_items SET bought = 1 WHERE user_id = ? AND item_id = ?');
    $buyStmt->execute([$user['id'], $input['itemId']]);

    // Update save_data
    $updateSave = $pdo->prepare('UPDATE saves SET save_data = ?, updated_at = NOW() WHERE user_id = ?');
    $updateSave->execute([json_encode($saveData, JSON_UNESCAPED_UNICODE), $user['id']]);

    // Insert item into inventory immediately
    $invId = 'inv_' . bin2hex(random_bytes(6));
    $invName = $item['resourceName'] ?? $item['name'] ?? 'Unknown';
    $invSlot = $item['slot'] ?? null;
    $invQty = (int)($item['quantity'] ?? 1);
    $invData = json_encode($item, JSON_UNESCAPED_UNICODE);
    $invStmt = $pdo->prepare(
        'INSERT INTO inventory_items (user_id, item_id, name, slot, quantity, equipped, data) VALUES (?, ?, ?, ?, ?, 0, ?)'
    );
    $invStmt->execute([$user['id'], $invId, $invName, $invSlot, $invQty, $invData]);

    $pdo->commit();

    jsonResponse([
        'ok' => true,
        'dataChips' => $saveData['player']['dataChips'],
    ]);
} catch (Exception $e) {
    $pdo->rollBack();
    jsonResponse(['error' => 'Buy failed: ' . $e->getMessage()], 500);
}
