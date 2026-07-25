<?php
require_once __DIR__ . '/../config.php';

$user = requireAuth();
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['consumeIds'])) {
    jsonResponse(['error' => 'Missing consumeIds'], 400);
}

$pdo = getDB();
$pdo->beginTransaction();

try {
    // Delete consumed items
    $placeholders = implode(',', array_fill(0, count($input['consumeIds']), '?'));
    $del = $pdo->prepare("DELETE FROM inventory_items WHERE user_id = ? AND item_id IN ($placeholders)");
    $del->execute(array_merge([$user['id']], $input['consumeIds']));

    // Add yielded materials
    if (!empty($input['materials'])) {
        $ins = $pdo->prepare(
            'INSERT INTO inventory_items (user_id, item_id, name, slot, quantity, equipped, data)
             VALUES (?, ?, ?, ?, ?, 0, ?)'
        );
        foreach ($input['materials'] as $mat) {
            $matId = $mat['id'] ?? ('mat_' . uniqid());
            $matName = $mat['name'] ?? 'Material';
            $qty = $mat['quantity'] ?? 1;
            $data = json_encode(['type' => 'material'], JSON_UNESCAPED_UNICODE);
            $ins->execute([$user['id'], $matId, $matName, 'any', $qty, $data]);
        }
    }

    // Add blueprint if dropped
    if (!empty($input['blueprint'])) {
        $bp = $input['blueprint'];
        $bpId = $bp['id'] ?? ('bp_' . uniqid());
        $bpName = $bp['name'] ?? 'Blueprint';
        $bpSlot = $bp['slot'] ?? 'any';
        $data = $bp;
        unset($data['id'], $data['name'], $data['slot'], $data['quantity']);
        $insBp = $pdo->prepare(
            'INSERT INTO inventory_items (user_id, item_id, name, slot, quantity, equipped, data)
             VALUES (?, ?, ?, ?, 1, 0, ?)'
        );
        $insBp->execute([$user['id'], $bpId, $bpName, $bpSlot, json_encode($data, JSON_UNESCAPED_UNICODE)]);
    }

    $pdo->commit();
    jsonResponse(['ok' => true]);
} catch (Exception $e) {
    $pdo->rollBack();
    jsonResponse(['error' => 'Disassemble failed: ' . $e->getMessage()], 500);
}
