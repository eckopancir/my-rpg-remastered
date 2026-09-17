<?php
require_once __DIR__ . '/config.php';

$user = requireAuth();
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['data'])) {
    jsonResponse(['error' => 'Missing data'], 400);
}

$pdo = getDB();

// Сытость питомца — серверный источник правды (часы клиента могут спешить,
// поэтому клиентское значение игнорируем и оставляем stored).
$data = $input['data'];
try {
    $curStmt = $pdo->prepare('SELECT save_data FROM saves WHERE user_id = ?');
    $curStmt->execute([$user['id']]);
    if ($curRow = $curStmt->fetch()) {
        $curSd = json_decode($curRow['save_data'], true);
        if (isset($curSd['player']['petSatiety']) && is_array($curSd['player']['petSatiety'])) {
            if (!isset($data['player']) || !is_array($data['player'])) $data['player'] = [];
            $data['player']['petSatiety'] = $curSd['player']['petSatiety'];
        }
    }
} catch (Exception $e) { /* best effort, сохраняем как есть */ }

$stmt = $pdo->prepare(
    'INSERT INTO saves (user_id, save_data, updated_at) VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE save_data = VALUES(save_data), updated_at = NOW()'
);
$stmt->execute([$user['id'], json_encode($data, JSON_UNESCAPED_UNICODE)]);

jsonResponse(['ok' => true]);
