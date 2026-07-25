<?php
require_once __DIR__ . '/../config.php';

$user = requireAuth();
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['slots']) || !is_array($input['slots'])) {
    jsonResponse(['error' => 'Missing slots array'], 400);
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
    $totalChipsGained = 0;

    foreach ($input['slots'] as $slot) {
        $sellQty = max(1, (int)($slot['quantity'] ?? 1));
        $itemName = $slot['name'] ?? '';
        $itemId = $slot['itemId'] ?? '';

        // Support selling by name (stackable materials across multiple entries)
        if (!empty($itemName)) {
            $invStmt = $pdo->prepare('SELECT id, quantity, data FROM inventory_items WHERE user_id = ? AND name = ? AND data->>"$.type" = "material" ORDER BY id ASC FOR UPDATE');
            $invStmt->execute([$user['id'], $itemName]);
            $rows = $invStmt->fetchAll();

            if (empty($rows)) continue;

            $remaining = $sellQty;
            $pricePerUnit = 0;

            foreach ($rows as $invRow) {
                if ($remaining <= 0) break;

                $invQty = (int)$invRow['quantity'];
                $take = min($remaining, $invQty);

                // Calculate price per unit from first row
                if ($pricePerUnit === 0) {
                    $itemData = json_decode($invRow['data'], true);
                    $itemPrice = isset($itemData['price']) ? (int)$itemData['price'] : 0;
                    $itemLevel = isset($itemData['level']) ? (int)$itemData['level'] : 1;
                    $itemQuality = $itemData['quality'] ?? 'Обычный';

                    if ($itemPrice > 0) {
                        $pricePerUnit = (int)floor($itemPrice * 0.4);
                    } else {
                        $qMul = 1;
                        if ($itemQuality === 'Божественный') $qMul = 12;
                        elseif ($itemQuality === 'Легендарный') $qMul = 8;
                        elseif ($itemQuality === 'Смертоносный') $qMul = 6;
                        elseif ($itemQuality === 'Эпический') $qMul = 4;
                        elseif ($itemQuality === 'Раритетный') $qMul = 2.5;
                        elseif ($itemQuality === 'Редкий') $qMul = 1.5;
                        $pricePerUnit = (int)floor(($itemLevel * 3 + 5) * $qMul);
                    }
                }

                if ($take >= $invQty) {
                    $delStmt = $pdo->prepare('DELETE FROM inventory_items WHERE id = ?');
                    $delStmt->execute([$invRow['id']]);
                } else {
                    $updStmt = $pdo->prepare('UPDATE inventory_items SET quantity = quantity - ? WHERE id = ?');
                    $updStmt->execute([$take, $invRow['id']]);
                }

                $remaining -= $take;
            }

            $totalChipsGained += $pricePerUnit * ($sellQty - $remaining);
        } elseif (!empty($itemId)) {
            // Legacy: sell by specific item ID
            $invStmt = $pdo->prepare('SELECT id, quantity, data FROM inventory_items WHERE user_id = ? AND item_id = ? FOR UPDATE');
            $invStmt->execute([$user['id'], $itemId]);
            $invRow = $invStmt->fetch();

            if (!$invRow) continue;

            $invQty = (int)$invRow['quantity'];
            $sellQty = min($sellQty, $invQty);

            if ($sellQty <= 0) continue;

            $itemData = json_decode($invRow['data'], true);
            $itemPrice = isset($itemData['price']) ? (int)$itemData['price'] : 0;
            $itemLevel = isset($itemData['level']) ? (int)$itemData['level'] : 1;
            $itemQuality = $itemData['quality'] ?? 'Обычный';

            if ($itemPrice > 0) {
                $pricePerUnit = (int)floor($itemPrice * 0.4);
            } else {
                $qMul = 1;
                if ($itemQuality === 'Божественный') $qMul = 12;
                elseif ($itemQuality === 'Легендарный') $qMul = 8;
                elseif ($itemQuality === 'Смертоносный') $qMul = 6;
                elseif ($itemQuality === 'Эпический') $qMul = 4;
                elseif ($itemQuality === 'Раритетный') $qMul = 2.5;
                elseif ($itemQuality === 'Редкий') $qMul = 1.5;
                $pricePerUnit = (int)floor(($itemLevel * 3 + 5) * $qMul);
            }

            $totalChipsGained += $pricePerUnit * $sellQty;

            if ($sellQty >= $invQty) {
                $delStmt = $pdo->prepare('DELETE FROM inventory_items WHERE id = ?');
                $delStmt->execute([$invRow['id']]);
            } else {
                $updStmt = $pdo->prepare('UPDATE inventory_items SET quantity = quantity - ? WHERE id = ?');
                $updStmt->execute([$sellQty, $invRow['id']]);
            }
        }
    }

    // Add chips
    $saveData['player']['dataChips'] = $chips + $totalChipsGained;
    $updateSave = $pdo->prepare('UPDATE saves SET save_data = ?, updated_at = NOW() WHERE user_id = ?');
    $updateSave->execute([json_encode($saveData, JSON_UNESCAPED_UNICODE), $user['id']]);

    $pdo->commit();

    jsonResponse([
        'ok' => true,
        'dataChips' => $saveData['player']['dataChips'],
    ]);
} catch (Exception $e) {
    $pdo->rollBack();
    jsonResponse(['error' => 'Sell failed: ' . $e->getMessage()], 500);
}
