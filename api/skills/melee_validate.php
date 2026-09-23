<?php
// Валидация ветки милишника — зеркало src/data/melee.ts.
// Без сайд-эффектов: можно тестировать через php CLI напрямую.

/**
 * id => [tier, maxRanks, gate(нужно в предыдущем тире), exclusiveWith[]]
 */
function meleeDefs() {
    return [
        'mln_shield_use' => [0, 1, 0, []],
        'mln_shotgun_stun' => [0, 1, 0, []],
        'mln_t1_melee' => [1, 10, 0, []],
        'mln_t1_shotgun' => [1, 10, 0, []],
        'mln_t2_vamp' => [2, 5, 5, []],
        'mln_t2_punch' => [2, 5, 5, []],
        'mln_t3_acc' => [3, 10, 0, []],
        'mln_t3_mix' => [3, 10, 0, []],
        'mln_t4_shield' => [4, 10, 0, ['mln_t4_fortify']],
        'mln_t4_fortify' => [4, 10, 0, ['mln_t4_shield']],
        'mln_t5_vamp' => [5, 5, 0, ['mln_t5_punch']],
        'mln_t5_punch' => [5, 5, 0, ['mln_t5_vamp']],
        'mln_t6_block' => [6, 2, 0, []],
        'mln_t6_cheap' => [6, 2, 0, []],
        'mln_t6_adrenaline' => [6, 2, 0, []],
        'mln_t6_regen' => [6, 2, 0, []],
        'mln_t7_rage' => [7, 1, 0, ['mln_t7_ram', 'mln_t7_rush']],
        'mln_t7_ram' => [7, 1, 0, ['mln_t7_rage', 'mln_t7_rush']],
        'mln_t7_rush' => [7, 1, 0, ['mln_t7_rage', 'mln_t7_ram']],
    ];
}

/** Суммарные гейты верхних тиров: [tier, fromTier, toTier, need]. */
function meleeTierGates() {
    return [
        [3, 1, 2, 10],
        [4, 1, 3, 15],
        [5, 1, 4, 25],
        [6, 1, 5, 30],
        [7, 1, 6, 32],
    ];
}

/** Возвращает текст ошибки или null, если ветка валидна. */
function validateMelee($skills) {
    $defs = meleeDefs();
    $pts = [];
    foreach ($defs as $id => $d) {
        $pts[$id] = isset($skills[$id]) ? (int)$skills[$id] : 0;
    }
    // 1. Лимиты рангов.
    foreach ($defs as $id => $d) {
        if ($pts[$id] < 0 || $pts[$id] > $d[1]) {
            return 'Милишник: лимит рангов ' . $id . ' (0-' . $d[1] . ')';
        }
    }
    // 2. Эксклюзивы.
    foreach ($defs as $id => $d) {
        if ($pts[$id] <= 0) continue;
        foreach ($d[3] as $rival) {
            if (($pts[$rival] ?? 0) > 0) {
                return 'Милишник: конфликт ' . $id . ' + ' . $rival;
            }
        }
    }
    // 3. Гейты тиров с каскадом.
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
                foreach (meleeTierGates() as $g) {
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
        return 'Милишник: нет гейта для ' . implode(', ', $invalid);
    }
    return null;
}
