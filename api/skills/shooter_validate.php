<?php
// Валидация ветки стрелка — зеркало src/data/shooter.ts.
// Без сайд-эффектов: можно тестировать через php CLI напрямую.

/**
 * id => [tier, maxRanks, gate(нужно в предыдущем тире), exclusiveWith[]]
 */
function shooterDefs() {
    return [
        'sht_medkit' => [0, 1, 0, []],
        'sht_grenade' => [0, 1, 0, []],
        'sht_reflexes' => [0, 1, 0, []],
        'sht_t1_auto' => [1, 10, 0, []],
        'sht_t1_pistol' => [1, 10, 0, []],
        'sht_t1_heavy' => [1, 10, 0, []],
        'sht_t2_speed' => [2, 10, 5, []],
        'sht_t2_punch' => [2, 10, 5, []],
        'sht_t2_critdmg' => [2, 10, 5, []],
        'sht_t3_acc' => [3, 10, 0, []],
        'sht_t4_head' => [4, 10, 0, ['sht_t4_react', 'sht_t4_bazooka']],
        'sht_t4_react' => [4, 10, 0, ['sht_t4_head', 'sht_t4_bazooka']],
        'sht_t4_bazooka' => [4, 10, 0, ['sht_t4_head', 'sht_t4_react']],
        'sht_t5_speed' => [5, 5, 0, []],
        'sht_t5_crit' => [5, 5, 0, []],
        'sht_t5_punch' => [5, 5, 0, []],
        'sht_t6_stim' => [6, 5, 0, []],
        'sht_t6_bandage' => [6, 5, 0, []],
        'sht_t6_acid' => [6, 5, 0, []],
        'sht_t6_shred' => [6, 5, 0, []],
        'sht_t7_rgauto' => [7, 1, 0, []],
        'sht_t7_rgpist' => [7, 1, 0, []],
        'sht_t7_rgheavy' => [7, 1, 0, []],
        'sht_t7_magpist' => [7, 1, 0, []],
        'sht_t7_magauto' => [7, 1, 0, []],
        'sht_t7_magheavy' => [7, 1, 0, []],
        'sht_t7_magmg' => [7, 1, 0, []],
        'sht_t8_rage' => [8, 1, 0, ['sht_t8_elem', 'sht_t8_exo', 'sht_t8_wind', 'sht_t8_barrage']],
        'sht_t8_elem' => [8, 1, 0, ['sht_t8_rage', 'sht_t8_exo', 'sht_t8_wind', 'sht_t8_barrage']],
        'sht_t8_exo' => [8, 1, 0, ['sht_t8_rage', 'sht_t8_elem', 'sht_t8_wind', 'sht_t8_barrage']],
        'sht_t8_wind' => [8, 1, 0, ['sht_t8_rage', 'sht_t8_elem', 'sht_t8_exo', 'sht_t8_barrage']],
        'sht_t8_barrage' => [8, 1, 0, ['sht_t8_rage', 'sht_t8_elem', 'sht_t8_exo', 'sht_t8_wind']],
    ];
}

/** Суммарные гейты верхних тиров: [tier, fromTier, toTier, need]. */
function shooterTierGates() {
    return [
        [3, 1, 2, 10],
        [4, 1, 3, 15],
        [5, 1, 4, 25],
        [6, 1, 5, 30],
        [7, 1, 6, 32],
        [8, 1, 6, 35],
    ];
}

/** Группы «выбери N»: tier => [ids, max]. */
function shooterPickGroups() {
    return [
        6 => [['sht_t6_stim', 'sht_t6_bandage', 'sht_t6_acid', 'sht_t6_shred'], 2],
        7 => [['sht_t7_rgauto', 'sht_t7_rgpist', 'sht_t7_rgheavy', 'sht_t7_magpist', 'sht_t7_magauto', 'sht_t7_magheavy', 'sht_t7_magmg'], 2],
    ];
}

/** Возвращает текст ошибки или null, если ветка валидна. */
function validateShooter($skills) {
    $defs = shooterDefs();
    $pts = [];
    foreach ($defs as $id => $d) {
        $pts[$id] = isset($skills[$id]) ? (int)$skills[$id] : 0;
    }
    // 1. Лимиты рангов.
    foreach ($defs as $id => $d) {
        if ($pts[$id] < 0 || $pts[$id] > $d[1]) {
            return 'Стрелок: лимит рангов ' . $id . ' (0-' . $d[1] . ')';
        }
    }
    // 2. Эксклюзивы.
    foreach ($defs as $id => $d) {
        if ($pts[$id] <= 0) continue;
        foreach ($d[3] as $rival) {
            if (($pts[$rival] ?? 0) > 0) {
                return 'Стрелок: конфликт ' . $id . ' + ' . $rival;
            }
        }
    }
    // 3. Лимиты групп «выбери N» (позже взятые слетают при чистке).
    foreach (shooterPickGroups() as $tier => $g) {
        list($ids, $max) = $g;
        $taken = 0;
        foreach ($ids as $gid) {
            if (($pts[$gid] ?? 0) > 0) $taken++;
        }
        if ($taken > $max) {
            return 'Стрелок: в тире ' . $tier . ' можно выбрать ' . $max;
        }
    }
    // 4. Гейты тиров с каскадом.
    $invalid = [];
    $sumTier = function ($tier) use (&$pts, $defs, &$invalid) {
        $s = 0;
        foreach ($defs as $id => $d) {
            if ($d[0] !== $tier) continue;
            if (in_array($id, $invalid, true)) continue;
            $s += $pts[$id];
        }
        return $s;
    };
    $changed = true;
    while ($changed) {
        $changed = false;
        foreach ($defs as $id => $d) {
            if (in_array($id, $invalid, true)) continue;
            if ($pts[$id] <= 0) continue;
            list($tier) = $d;
            $open = true;
            if ($tier > 1) {
                $cg = null;
                foreach (shooterTierGates() as $g) {
                    if ($g[0] === $tier) { $cg = $g; break; }
                }
                if ($cg !== null) {
                    $have = 0;
                    for ($t = $cg[1]; $t <= $cg[2]; $t++) $have += $sumTier($t);
                    $open = $have >= $cg[3];
                } else {
                    $open = $sumTier($tier - 1) >= $d[2];
                }
            }
            if (!$open) {
                $invalid[] = $id;
                $changed = true;
            }
        }
    }
    if (count($invalid) > 0) {
        return 'Стрелок: нет гейта для ' . implode(', ', $invalid);
    }
    return null;
}
