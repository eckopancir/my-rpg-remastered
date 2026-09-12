<?php
// Перековка: подъём уровня (op=levelup) и установка/снятие схем (op=socket).
// Предмет в слоте уже убран клиентом из инвентаря (и синкнут), поэтому
// строку оружия не требуем — заменяем (удалить + вставить).
require_once __DIR__ . '/../config.php';

$user = requireAuth();
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['op'], $input['weaponId'], $input['weapon'])) {
    jsonResponse(['error' => 'Missing op, weaponId or weapon'], 400);
}

$op = $input['op'];
if ($op !== 'levelup' && $op !== 'socket') {
    jsonResponse(['error' => 'Unknown op'], 400);
}

$pdo = getDB();
$pdo->beginTransaction();

try {
    // Списать ресурсы по именам (подъём уровня).
    if ($op === 'levelup' && !empty($input['needs'])) {
        foreach ($input['needs'] as $matName => $qty) {
            $qty = (int)$qty;
            if ($qty <= 0) continue;
            $st = $pdo->prepare('SELECT id, quantity FROM inventory_items WHERE user_id = ? AND name = ? AND data->>"$.type" = "material" ORDER BY id ASC FOR UPDATE');
            $st->execute([$user['id'], $matName]);
            $rows = $st->fetchAll();
            $have = 0;
            foreach ($rows as $r) $have += (int)$r['quantity'];
            if ($have < $qty) {
                $pdo->rollBack();
                jsonResponse(['error' => 'Not enough ' . $matName], 400);
            }
            $rest = $qty;
            foreach ($rows as $r) {
                if ($rest <= 0) break;
                $q = (int)$r['quantity'];
                $take = min($rest, $q);
                if ($take >= $q) {
                    $pdo->prepare('DELETE FROM inventory_items WHERE id = ?')->execute([$r['id']]);
                } else {
                    $pdo->prepare('UPDATE inventory_items SET quantity = quantity - ? WHERE id = ?')->execute([$take, $r['id']]);
                }
                $rest -= $take;
            }
        }
    }

    // Съесть схему (установка; при снятии blueprintId пустой).
    if ($op === 'socket' && !empty($input['blueprintId'])) {
        $pdo->prepare('DELETE FROM inventory_items WHERE user_id = ? AND item_id = ?')
            ->execute([$user['id'], $input['blueprintId']]);
    }

    // Заменить строку оружия обновлённым снепшотом.
    $w = $input['weapon'];
    $pdo->prepare('DELETE FROM inventory_items WHERE user_id = ? AND item_id = ?')
        ->execute([$user['id'], $input['weaponId']]);
    $itemId = $w['id'] ?? $input['weaponId'];
    $name = $w['name'] ?? '';
    $slot = $w['slot'] ?? null;
    $quantity = $w['quantity'] ?? 1;
    $data = $w;
    unset($data['id'], $data['name'], $data['slot'], $data['quantity']);
    $pdo->prepare(
        'INSERT INTO inventory_items (user_id, item_id, name, slot, quantity, equipped, data)
         VALUES (?, ?, ?, ?, ?, 0, ?)'
    )->execute([$user['id'], $itemId, $name, $slot, $quantity, json_encode($data, JSON_UNESCAPED_UNICODE)]);

    $pdo->commit();
    jsonResponse(['ok' => true]);
} catch (Exception $e) {
    $pdo->rollBack();
    jsonResponse(['error' => 'Reforge failed: ' . $e->getMessage()], 500);
}
