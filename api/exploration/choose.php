<?php
// Выбор игрока в крупном событии: «Осторожно» или «Рискнуть».
// Эффекты применяются на сервере, строка события обновляется.
require_once __DIR__ . '/../../api/config.php';
require_once __DIR__ . '/engine_logic.php';

$pdo = getDB();
$user = requireAuth();
$userId = $user['id'];

$input = json_decode(file_get_contents('php://input'), true);
$choice = ($input['choice'] ?? '') === 'risky' ? 'risky' : 'safe';

$stmt = $pdo->prepare("SELECT * FROM explorations WHERE user_id = ? AND phase NOT IN ('complete','idle') ORDER BY id DESC LIMIT 1");
$stmt->execute([$userId]);
$exp = $stmt->fetch();
if (!$exp) jsonResponse(['error' => 'Нет активного путешествия'], 404);
if (empty($exp['pending_choice'])) jsonResponse(['error' => 'Нет pending-выбора'], 404);

$buffs = expeditionBuffs($exp['consumables'] ?? null);
$res = resolvePendingChoice($pdo, $userId, $exp, $choice, $buffs);
if (!$res) jsonResponse(['error' => 'Выбор не найден'], 404);

jsonResponse([
  'success' => true,
  'choice' => $res,
  // Эффекты возвращаем клиенту, чтобы он применил их к своему состоянию
  // (сервер уже применил их к сейву).
  'effects' => $res['effects'] ?? [],
]);
