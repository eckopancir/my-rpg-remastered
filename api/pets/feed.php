<?php
// Кормление питомца едой из инвентаря. POST { itemId }.
// Сервер ПРОВЕРЯЕТ предмет (оба хранилища: inventory_items и бэкпак в save_data)
// и считает сытость; списание стака делает клиент (как consumeFromPack) + syncNow.
// Съедает из стака только нужное до 100% (+20% за кусок).
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/pet_state.php';

$user = requireAuth();
$input = json_decode(file_get_contents('php://input'), true);
$itemId = (string)($input['itemId'] ?? '');
if ($itemId === '') {
    jsonResponse(['error' => 'Missing itemId'], 400);
}

$pdo = getDB();
$pdo->beginTransaction();

try {
    $saveStmt = $pdo->prepare('SELECT save_data FROM saves WHERE user_id = ? FOR UPDATE');
    $saveStmt->execute([$user['id']]);
    $saveRow = $saveStmt->fetch();
    if (!$saveRow) {
        $pdo->rollBack();
        jsonResponse(['error' => 'Save not found'], 400);
    }
    $saveData = json_decode($saveRow['save_data'], true);

    // 1. Ищем предмет: сначала inventory_items, потом бэкпак в save_data.
    $qty = 0;
    $found = false;
    $invStmt = $pdo->prepare('SELECT quantity, data FROM inventory_items WHERE user_id = ? AND item_id = ?');
    $invStmt->execute([$user['id'], $itemId]);
    if ($invRow = $invStmt->fetch()) {
        $itemData = json_decode($invRow['data'], true);
        $abilityId = (string)($itemData['abilityId'] ?? '');
        if ((($itemData['type'] ?? '') === 'consumable') && strpos($abilityId, 'food_') === 0) {
            $found = true;
            $qty = (int)$invRow['quantity'];
        }
    }
    if (!$found) {
        $gridItems = $saveData['player']['backpackGrid']['items'] ?? [];
        if (is_array($gridItems)) {
            foreach ($gridItems as $it) {
                if (($it['id'] ?? '') === $itemId) {
                    $abilityId = (string)($it['abilityId'] ?? '');
                    if ((($it['type'] ?? '') === 'consumable') && strpos($abilityId, 'food_') === 0) {
                        $found = true;
                        $qty = (int)($it['quantity'] ?? 1);
                    }
                    break;
                }
            }
        }
    }
    if (!$found) {
        $pdo->rollBack();
        jsonResponse(['error' => 'Еда не найдена (нужен расходник-еда)'], 400);
    }

    // 2. Сытость и порция (единый ключ player.petSatiety, время — мс).
    $nowMs = (int)(microtime(true) * 1000);
    $st = petStateFromSave($saveData);
    if ($st === null) {
        $st = [100, $nowMs];
    }
    list($v0, $t0) = $st;
    $sat = petSatietyAt($v0, $t0, $nowMs);
    $take = petFeedTake($sat, $qty);
    if ($take <= 0) {
        $pdo->rollBack();
        jsonResponse(['error' => 'Питомец сыт (100%)'], 400);
    }
    $sat = min(100, $sat + $take * PET_FOOD_PCT);

    $saveData['player']['petSatiety'] = ['value' => $sat, 'updatedAt' => $nowMs];
    $updateSave = $pdo->prepare('UPDATE saves SET save_data = ?, updated_at = NOW() WHERE user_id = ?');
    $updateSave->execute([json_encode($saveData, JSON_UNESCAPED_UNICODE), $user['id']]);

    $pdo->commit();
    jsonResponse([
        'ok' => true,
        'value' => round($sat, 1),
        'mood' => petMood($sat),
        'consumed' => $take,
    ]);
} catch (Exception $e) {
    $pdo->rollBack();
    jsonResponse(['error' => 'Feed failed: ' . $e->getMessage()], 500);
}
