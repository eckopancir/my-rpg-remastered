<?php
// Состояние сытости питомца. Сервер — источник правды.
// 100% (сыт, зелёный) -> 0% (голодный, красный) за 12 часов.
// Настроение: >=66 зелёный, >=33 жёлтый, иначе красный.
// 1 кусок ЛЮБОЙ еды = +20% (стак 3 = +60%, с капом 100%).

define('PET_DECAY_HOURS', 12);
define('PET_FOOD_PCT', 20);

/** Текущая сытость с учётом распада. Время — МИЛЛИсекунды (как Date.now()). */
function petSatietyAt($storedV, $storedTMs, $nowMs) {
    $v = max(0, min(100, (float)$storedV));
    $elapsedH = max(0, ($nowMs - (int)$storedTMs) / 3600000);
    return max(0, $v - ($elapsedH / PET_DECAY_HOURS) * 100);
}

/**
 * Читает состояние из save_data: новый формат player.petSatiety {value, updatedAt(ms)},
 * legacy — player.pet {v, t(sec)}.
 * Возвращает [value, updatedAtMs] или null (нет данных = новый питомец).
 */
function petStateFromSave($saveData) {
    $pl = (isset($saveData['player']) && is_array($saveData['player'])) ? $saveData['player'] : [];
    if (isset($pl['petSatiety']) && is_array($pl['petSatiety']) && isset($pl['petSatiety']['value'])) {
        return [(float)$pl['petSatiety']['value'], (int)($pl['petSatiety']['updatedAt'] ?? 0)];
    }
    if (isset($pl['pet']) && is_array($pl['pet']) && isset($pl['pet']['v'])) {
        return [(float)$pl['pet']['v'], (int)($pl['pet']['t'] ?? 0) * 1000];
    }
    return null;
}

/** Настроение: green / yellow / red. */
function petMood($v) {
    if ($v >= 66) return 'green';
    if ($v >= 33) return 'yellow';
    return 'red';
}

/** Множитель HP в бою: сытый 1.0, проголодался 0.7, голодный 0.1. */
function petHpMult($v) {
    $m = petMood($v);
    if ($m === 'green') return 1.0;
    if ($m === 'yellow') return 0.7;
    return 0.1;
}

/** Сколько штук съесть из стака: до полного, минимум необходимость. */
function petFeedTake($satiety, $qty) {
    if ($satiety >= 100) return 0;
    $need = (int)ceil((100 - $satiety) / PET_FOOD_PCT);
    return max(0, min((int)$qty, $need));
}
