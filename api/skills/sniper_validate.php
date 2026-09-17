<?php
// Валидация ветки снайпера — зеркало src/data/sniper.ts.
// Без сайд-эффектов: можно тестировать через php CLI напрямую.

/**
 * Правила ветки снайпера.
 * id => [column, tier, maxRanks, gate(нужно в предыдущем тире), exclusiveWith[], requiresAbility]
 */
function sniperDefs() {
    return [
        'snp_a1_crit' => ['attack', 1, 10, 0, [], null],
        'snp_a1_mix' => ['attack', 1, 5, 0, [], null],
        'snp_a2_acc' => ['attack', 2, 10, 5, [], null],
        'snp_a2_mix' => ['attack', 2, 5, 5, [], null],
        'snp_a3_punch' => ['attack', 3, 10, 5, [], null],
        'snp_a3_mix' => ['attack', 3, 5, 5, [], null],
        'snp_a4_eagle' => ['attack', 4, 5, 5, ['snp_a4_ammo'], null],
        'snp_a4_ammo' => ['attack', 4, 5, 5, ['snp_a4_eagle'], null],
        'snp_a5_eagle' => ['attack', 5, 2, 5, [], 'snp_a4_eagle'],
        'snp_a5_ammo' => ['attack', 5, 2, 5, [], 'snp_a4_ammo'],
        'snp_a6_range' => ['attack', 6, 2, 4, [], null],
        'snp_a6_cheap' => ['attack', 6, 2, 4, [], null],
        'snp_a6_trade' => ['attack', 6, 2, 4, [], null],
        'snp_a7_deadeye' => ['attack', 0, 1, 0, ['snp_x_aim'], null],
        'snp_x_aim' => ['attack', 0, 1, 0, ['snp_a7_deadeye'], null],
        'snp_x_stealth' => ['attack', 0, 1, 0, [], null],
        'snp_a7_rapid' => ['attack', 7, 1, 5, ['snp_a7_glass', 'snp_a7_crit'], null],
        'snp_a7_crit' => ['attack', 7, 1, 5, ['snp_a7_rapid', 'snp_a7_glass'], null],
        'snp_a7_glass' => ['attack', 7, 1, 5, ['snp_a7_rapid', 'snp_a7_crit'], null],
        'snp_d1_eva' => ['defense', 1, 10, 0, [], null],
        'snp_d1_arm' => ['defense', 1, 5, 0, [], null],
        'snp_d2_hp' => ['defense', 2, 5, 5, [], null],
        'snp_d2_arm' => ['defense', 2, 5, 5, [], null],
        'snp_d3_low' => ['defense', 3, 2, 5, ['snp_d3_high'], null],
        'snp_d3_high' => ['defense', 3, 2, 5, ['snp_d3_low'], null],
        'snp_d4_nest' => ['defense', 4, 5, 4, [], null],
        'snp_d4_camo' => ['defense', 4, 5, 4, [], null],
        'snp_d5_blood' => ['defense', 5, 1, 5, ['snp_d5_med'], null],
        'snp_d5_med' => ['defense', 5, 1, 5, ['snp_d5_blood'], null],
        'snp_d6_tele' => ['defense', 6, 1, 5, [], null],
    ];
}

/** Суммарные гейты верхних тиров: [column, tier, fromTier, toTier, need]. */
function sniperTierGates() {
    return [
        ['attack', 6, 1, 5, 25],
        ['attack', 7, 1, 6, 25],
        ['defense', 4, 1, 3, 15],
        ['defense', 5, 1, 4, 20],
        ['defense', 6, 1, 5, 25],
    ];
}

/** Возвращает текст ошибки или null, если ветка валидна. */
function validateSniper($skills) {
    $defs = sniperDefs();
    $pts = [];
    foreach ($defs as $id => $d) {
        $pts[$id] = isset($skills[$id]) ? (int)$skills[$id] : 0;
    }
    // 1. Лимиты рангов.
    foreach ($defs as $id => $d) {
        if ($pts[$id] < 0 || $pts[$id] > $d[2]) {
            return 'Снайпер: лимит рангов ' . $id . ' (0-' . $d[2] . ')';
        }
    }
    // 2. Эксклюзивы.
    foreach ($defs as $id => $d) {
        if ($pts[$id] <= 0) continue;
        foreach ($d[4] as $rival) {
            if (($pts[$rival] ?? 0) > 0) {
                return 'Снайпер: конфликт ' . $id . ' + ' . $rival;
            }
        }
    }
    // 3. Ветки requiresAbility.
    foreach ($defs as $id => $d) {
        if ($pts[$id] <= 0 || $d[5] === null) continue;
        if (($pts[$d[5]] ?? 0) <= 0) {
            return 'Снайпер: ' . $id . ' требует ' . $d[5];
        }
    }
    // 4. Гейты тиров с каскадом (как sniperFindInvalid: очки
    // невалидных не считаются в гейтах остальных).
    $invalid = [];
    $sumTier = function ($col, $tier) use (&$pts, $defs, &$invalid) {
        $s = 0;
        foreach ($defs as $id => $d) {
            if ($d[0] !== $col || $d[1] !== $tier) continue;
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
            list($col, $tier) = $d;
            $open = true;
            if ($tier > 1) {
                $cg = null;
                foreach (sniperTierGates() as $g) {
                    if ($g[0] === $col && $g[1] === $tier) { $cg = $g; break; }
                }
                if ($cg !== null) {
                    $have = 0;
                    for ($t = $cg[2]; $t <= $cg[3]; $t++) $have += $sumTier($col, $t);
                    $open = $have >= $cg[4];
                } else {
                    $open = $sumTier($col, $tier - 1) >= $d[3];
                }
            }
            if (!$open) {
                $invalid[] = $id;
                $changed = true;
            }
        }
    }
    if (count($invalid) > 0) {
        return 'Снайпер: нет гейта для ' . implode(', ', $invalid);
    }
    return null;
}
