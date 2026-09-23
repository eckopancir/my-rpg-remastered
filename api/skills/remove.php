<?php
// Удаление конкретных способностей (антиабуз-чистка). Очки возвращаются
// автоматически — load.php считает skillPoints = earned - spent.
require_once __DIR__ . '/../config.php';

$user = requireAuth();
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['skillIds']) || !is_array($input['skillIds'])) {
    jsonResponse(['error' => 'Missing skillIds'], 400);
}

$pdo = getDB();

try {
    $del = $pdo->prepare('DELETE FROM player_skills WHERE user_id = ? AND skill_id = ?');
    $deleted = 0;
    foreach ($input['skillIds'] as $skillId) {
        $skillId = (string)$skillId;
        if ($skillId === '') continue;
        // Снайперские, пет-ид, милишник и удалённая классика — защита от злоупотребления эндпоинтом.
        if (strpos($skillId, 'snp_') !== 0
            && strpos($skillId, 'mln_') !== 0
            && strpos($skillId, 'pb_') !== 0
            && strpos($skillId, 'pw_') !== 0
            && strpos($skillId, 'po_') !== 0
            && strpos($skillId, 'pet_') !== 0
            && strpos($skillId, 'soldier_') !== 0
            && strpos($skillId, 'demo_') !== 0
            && strpos($skillId, 'night_') !== 0
            && strpos($skillId, 'arcanist_') !== 0
            && strpos($skillId, 'occult_') !== 0
            && strpos($skillId, 'berserker_') !== 0
            && strpos($skillId, 'tank_') !== 0
            && strpos($skillId, 'survivor_') !== 0
            && strpos($skillId, 'merchant_') !== 0
            && strpos($skillId, 'trader_') !== 0
            && strpos($skillId, 'stalker_') !== 0
            && strpos($skillId, 'cap_') !== 0) continue;
        $del->execute([$user['id'], $skillId]);
        $deleted += $del->rowCount();
    }
    jsonResponse(['ok' => true, 'deleted' => $deleted]);
} catch (Exception $e) {
    jsonResponse(['error' => 'Remove failed: ' . $e->getMessage()], 500);
}
