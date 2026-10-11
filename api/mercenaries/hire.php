<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../bazaar/_skills.php';

$user = requireAuth();
$input = json_decode(file_get_contents('php://input'), true);

$role = $input['role'] ?? '';
$stars = (int)($input['stars'] ?? 0);
$level = max(1, (int)($input['level'] ?? 1));

if (!in_array($role, ['tank', 'medic', 'mechanic'], true) || $stars < 1 || $stars > 5) {
    jsonResponse(['error' => 'Bad role or stars'], 400);
}

// Цена считается сервером (клиентской не доверяем). Зеркало MERC_STAR_PRICE.
$mult = [1, 1, 4, 12, 40, 150][$stars];
$price = (int)round(($level * 200 + 500) * $mult);

$pdo = getDB();
$pdo->beginTransaction();

try {
    $saveStmt = $pdo->prepare('SELECT save_data FROM saves WHERE user_id = ? FOR UPDATE');
    $saveStmt->execute([$user['id']]);
    $saveRow = $saveStmt->fetch();
    if (!$saveRow) {
        $pdo->rollBack();
        jsonResponse(['error' => 'Save data not found'], 400);
    }
    $saveData = json_decode($saveRow['save_data'], true);
    $disc = traderDiscounts($pdo, $user['id']);
    $final = (int)floor($price * (1 - $disc['buyDiscount']));
    $chips = (int)($saveData['player']['dataChips'] ?? 0);
    if ($chips < $final) {
        $pdo->rollBack();
        jsonResponse(['error' => 'Not enough chips'], 400);
    }
    $saveData['player']['dataChips'] = $chips - $final;
    $upd = $pdo->prepare('UPDATE saves SET save_data = ?, updated_at = NOW() WHERE user_id = ?');
    $upd->execute([json_encode($saveData, JSON_UNESCAPED_UNICODE), $user['id']]);
    $pdo->commit();
    jsonResponse(['ok' => true, 'dataChips' => $saveData['player']['dataChips'], 'charged' => $final]);
} catch (Exception $e) {
    $pdo->rollBack();
    jsonResponse(['error' => 'Hire failed: ' . $e->getMessage()], 500);
}
