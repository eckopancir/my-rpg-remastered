<?php
// Удаление старых очков ветки снайпера (sniper_*): ветка заменена новой моделью.
// Очки возвращаются автоматически — load.php считает skillPoints = earned - spent.
require_once __DIR__ . '/../config.php';

$user = requireAuth();
$pdo = getDB();

try {
    $stmt = $pdo->prepare("DELETE FROM player_skills WHERE user_id = ? AND skill_id LIKE 'sniper\\_%' ESCAPE '\\'");
    $stmt->execute([$user['id']]);
    $deleted = $stmt->rowCount();
    jsonResponse(['ok' => true, 'deleted' => $deleted]);
} catch (Exception $e) {
    jsonResponse(['error' => 'Migrate failed: ' . $e->getMessage()], 500);
}
