<?php
require_once __DIR__ . '/../config.php';

$user = requireAuth();
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['baseName'], $input['className'], $input['level'], $input['duration'])) {
    jsonResponse(['error' => 'Missing required fields'], 400);
}

$pdo = getDB();
$pdo->beginTransaction();

try {
    $baseName = $input['baseName'];
    $className = $input['className'];
    $targetLevel = (int)$input['level'];
    $duration = (int)$input['duration'];
    $resourceSlots = $input['resourceSlots'] ?? [];

    // Check existing row
    $stmt = $pdo->prepare('SELECT * FROM base_upgrades WHERE user_id = ? AND base_name = ? FOR UPDATE');
    $stmt->execute([$user['id'], $baseName]);
    $row = $stmt->fetch();

    if ($row) {
        $currentLevel = (int)$row['level'];
        $isUpgrading = (int)$row['upgrading'];
        if ($isUpgrading) {
            $pdo->rollBack();
            jsonResponse(['error' => 'Already upgrading'], 400);
        }
        if ($targetLevel !== $currentLevel + 1) {
            $pdo->rollBack();
            jsonResponse(['error' => 'Level mismatch'], 400);
        }
    }

    // Consume resources
    foreach ($resourceSlots as $slot) {
        $resName = $slot['name'] ?? '';
        $needed = (int)($slot['count'] ?? 0);
        if ($needed <= 0) continue;

        // Find and deduct from inventory_items
        $invStmt = $pdo->prepare('SELECT id, quantity FROM inventory_items WHERE user_id = ? AND name = ? AND data->>"$.type" = "material" ORDER BY id ASC FOR UPDATE');
        $invStmt->execute([$user['id'], $resName]);
        $invRows = $invStmt->fetchAll();

        $remaining = $needed;
        foreach ($invRows as $invRow) {
            if ($remaining <= 0) break;
            $invQty = (int)$invRow['quantity'];
            $take = min($remaining, $invQty);

            if ($take >= $invQty) {
                $delStmt = $pdo->prepare('DELETE FROM inventory_items WHERE id = ?');
                $delStmt->execute([$invRow['id']]);
            } else {
                $updStmt = $pdo->prepare('UPDATE inventory_items SET quantity = quantity - ? WHERE id = ?');
                $updStmt->execute([$take, $invRow['id']]);
            }
            $remaining -= $take;
        }

        if ($remaining > 0) {
            $pdo->rollBack();
            jsonResponse(['error' => "Not enough $resName (need $needed)"], 400);
        }
    }

    // Deduct chips
    $saveStmt = $pdo->prepare('SELECT save_data FROM saves WHERE user_id = ? FOR UPDATE');
    $saveStmt->execute([$user['id']]);
    $saveRow = $saveStmt->fetch();

    if (!$saveRow) {
        $pdo->rollBack();
        jsonResponse(['error' => 'Save not found'], 400);
    }

    $saveData = json_decode($saveRow['save_data'], true);
    $chipsNeeded = (int)($input['chips'] ?? 0);
    $chips = (int)($saveData['player']['dataChips'] ?? 0);

    if ($chips < $chipsNeeded) {
        $pdo->rollBack();
        jsonResponse(['error' => 'Not enough chips'], 400);
    }

    $saveData['player']['dataChips'] = $chips - $chipsNeeded;

    $updSave = $pdo->prepare('UPDATE saves SET save_data = ?, updated_at = NOW() WHERE user_id = ?');
    $updSave->execute([json_encode($saveData, JSON_UNESCAPED_UNICODE), $user['id']]);

    // Upsert base_upgrades row with timer
    $expiresAtDb = date('Y-m-d H:i:s', time() + $duration);
    $expiresAtMs = (time() + $duration) * 1000; // Unix ms for JS

    if ($row) {
        $upd = $pdo->prepare('UPDATE base_upgrades SET upgrading = 1, timer_started_at = NOW(), timer_duration = ?, timer_expires_at = ? WHERE id = ?');
        $upd->execute([$duration, $expiresAtDb, $row['id']]);
    } else {
        $ins = $pdo->prepare('INSERT INTO base_upgrades (user_id, base_name, class_name, level, upgrading, timer_started_at, timer_duration, timer_expires_at) VALUES (?, ?, ?, ?, 1, NOW(), ?, ?)');
        $ins->execute([$user['id'], $baseName, $className, $targetLevel - 1, $duration, $expiresAtDb]);
    }

    $pdo->commit();

    jsonResponse([
        'ok' => true,
        'expiresAt' => $expiresAtMs,
        'dataChips' => $saveData['player']['dataChips'],
    ]);
} catch (Exception $e) {
    $pdo->rollBack();
    jsonResponse(['error' => 'Upgrade failed: ' . $e->getMessage()], 500);
}
