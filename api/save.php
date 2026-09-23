<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/player/vitals_catchup.php';

$user = requireAuth();
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['data'])) {
    jsonResponse(['error' => 'Missing data'], 400);
}

$pdo = getDB();

// Сытость питомца — серверный источник правды (часы клиента могут спешить,
// поэтому клиентское значение игнорируем и оставляем stored).
$data = $input['data'];
$nowMs = (int)(microtime(true) * 1000);
try {
    $curStmt = $pdo->prepare('SELECT save_data, updated_at FROM saves WHERE user_id = ?');
    $curStmt->execute([$user['id']]);
    if ($curRow = $curStmt->fetch()) {
        $curSd = json_decode($curRow['save_data'], true);
        if (isset($curSd['player']['petSatiety']) && is_array($curSd['player']['petSatiety'])) {
            if (!isset($data['player']) || !is_array($data['player'])) $data['player'] = [];
            $data['player']['petSatiety'] = $curSd['player']['petSatiety'];
        }
        // Safety net: this save arrives after an offline gap without a prior
        // load.php catch-up (normally load runs first on open). Advance the
        // stored vitals, then keep the best of stored/client so neither combat
        // damage nor consumable heals get silently lost.
        $storedAgeSec = $curRow['updated_at'] ? (time() - strtotime($curRow['updated_at'])) : 0;
        if ($storedAgeSec > 120 && is_array($curSd)) {
            $expSm = null;
            try {
                $expStmt2 = $pdo->prepare("SELECT UNIX_TIMESTAMP(started_at)*1000 AS sms FROM explorations WHERE user_id = ? AND phase NOT IN ('complete','idle') ORDER BY id DESC LIMIT 1");
                $expStmt2->execute([$user['id']]);
                if ($expRow2 = $expStmt2->fetch()) $expSm = isset($expRow2['sms']) ? (int)$expRow2['sms'] : null;
            } catch (Exception $e2) { /* ignore */ }
            $catchup = applyVitalsCatchup($curSd, $nowMs, strtotime($curRow['updated_at']) ?: null, $expSm !== null, $expSm);
            if ($catchup['applied'] && isset($curSd['player']['stats'], $data['player']['stats'])) {
                $st = &$data['player']['stats'];
                $cst = $curSd['player']['stats'];
                $maxHp = (float)($st['maxHp'] ?? $cst['maxHp'] ?? 0);
                $maxSt = (float)($st['maxStamina'] ?? $cst['maxStamina'] ?? 0);
                if ($maxHp > 0) $st['currentHp'] = min($maxHp, max((float)($cst['currentHp'] ?? 0), (float)($st['currentHp'] ?? 0)));
                if ($maxSt > 0) $st['stamina'] = min($maxSt, max((float)($cst['stamina'] ?? 0), (float)($st['stamina'] ?? 0)));
            }
        }
    }
} catch (Exception $e) { /* best effort, сохраняем как есть */ }

// Штамп времени виталов: точка отсчёта офлайн-регена.
if (!isset($data['player']) || !is_array($data['player'])) $data['player'] = [];
$data['player']['vitalsAt'] = $nowMs;

$stmt = $pdo->prepare(
    'INSERT INTO saves (user_id, save_data, updated_at) VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE save_data = VALUES(save_data), updated_at = NOW()'
);
$stmt->execute([$user['id'], json_encode($data, JSON_UNESCAPED_UNICODE)]);

jsonResponse(['ok' => true]);
