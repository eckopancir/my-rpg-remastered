<?php
// Валидация веток питомцев — зеркало src/data/pets.ts.
// Без сайд-эффектов: можно тестировать через php CLI напрямую.

/**
 * id => [branch, tier, maxRanks, gate(нужно в предыдущем тире), exclusiveWith[], requiresAbility]
 */
function petDefs() {
    return [
        'pb_t1_hp' => ['bear', 1, 5, 0, [], null],
        'pb_t1_arm' => ['bear', 1, 10, 0, [], null],
        'pb_t2_dmg' => ['bear', 2, 10, 5, [], null],
        'pb_t2_aura' => ['bear', 2, 5, 5, [], null],
        'pb_t3_paw' => ['bear', 3, 1, 5, ['pb_t3_roar'], null],
        'pb_t3_roar' => ['bear', 3, 1, 5, ['pb_t3_paw'], null],
        'pb_t4_def' => ['bear', 4, 5, 5, [], null],
        'pb_t5_thick' => ['bear', 5, 5, 5, ['pb_t5_ursok'], null],
        'pb_t5_ursok' => ['bear', 5, 5, 5, ['pb_t5_thick'], null],
        'pb_t6_restore' => ['bear', 6, 1, 4, ['pb_t6_regen'], null],
        'pb_t6_regen' => ['bear', 6, 1, 4, ['pb_t6_restore'], null],
        'pb_t7_alpha' => ['bear', 7, 1, 5, [], null],
        'pw_t1_own' => ['wolf', 1, 5, 0, [], null],
        'pw_t1_eva' => ['wolf', 1, 10, 0, [], null],
        'pw_t2_dmg' => ['wolf', 2, 10, 5, [], null],
        'pw_t2_aura' => ['wolf', 2, 5, 5, [], null],
        'pw_t3_rend' => ['wolf', 3, 1, 5, ['pw_t3_shade'], null],
        'pw_t3_shade' => ['wolf', 3, 1, 5, ['pw_t3_rend'], null],
        'pw_t4_gon' => ['wolf', 4, 5, 5, [], null],
        'pw_t5_howl' => ['wolf', 5, 5, 5, [], null],
        'pw_t6_reap' => ['wolf', 6, 1, 4, ['pw_t6_oath'], null],
        'pw_t6_oath' => ['wolf', 6, 1, 4, ['pw_t6_reap'], null],
        'pw_t7_leader' => ['wolf', 7, 1, 5, [], null],
        'po_t1_reg' => ['boar', 1, 5, 0, [], null],
        'po_t1_dmg' => ['boar', 1, 10, 0, [], null],
        'po_t2_hp' => ['boar', 2, 5, 5, [], null],
        'po_t2_aura' => ['boar', 2, 3, 5, [], null],
        'po_t3_dash' => ['boar', 3, 1, 5, [], null],
        'po_t4_hide' => ['boar', 4, 1, 5, [], null],
        'po_t5_ram' => ['boar', 5, 1, 5, [], null],
        'po_t6_fury' => ['boar', 6, 1, 4, [], null],
        'po_t7_sekach' => ['boar', 7, 1, 5, [], null],
        'pet_regen' => ['bear', 0, 1, 0, [], null],
        'pet_ai' => ['bear', 0, 1, 0, [], null],
        'pet_command' => ['bear', 0, 1, 0, [], null],
    ];
}

/** Суммарные гейты верхних тиров: [branch, tier, fromTier, toTier, need]. */
function petTierGates() {
    return [
        ['bear', 4, 1, 3, 15],
        ['bear', 5, 1, 4, 20],
        ['bear', 6, 1, 5, 25],
        ['bear', 7, 1, 6, 25],
        ['wolf', 4, 1, 3, 15],
        ['wolf', 5, 1, 4, 20],
        ['wolf', 6, 1, 5, 25],
        ['wolf', 7, 1, 6, 25],
        ['boar', 6, 1, 5, 25],
        ['boar', 7, 1, 6, 25],
    ];
}

/** Возвращает текст ошибки или null, если ветки валидны. */
function validatePets($skills) {
    $defs = petDefs();
    $pts = [];
    foreach ($defs as $id => $d) {
        $pts[$id] = isset($skills[$id]) ? (int)$skills[$id] : 0;
    }
    // 1. Лимиты рангов.
    foreach ($defs as $id => $d) {
        if ($pts[$id] < 0 || $pts[$id] > $d[2]) {
            return 'Питомцы: лимит рангов ' . $id . ' (0-' . $d[2] . ')';
        }
    }
    // 2. Эксклюзивы.
    foreach ($defs as $id => $d) {
        if ($pts[$id] <= 0) continue;
        foreach ($d[4] as $rival) {
            if (($pts[$rival] ?? 0) > 0) {
                return 'Питомцы: конфликт ' . $id . ' + ' . $rival;
            }
        }
    }
    // 3. Ветки requiresAbility.
    foreach ($defs as $id => $d) {
        if ($pts[$id] <= 0 || $d[5] === null) continue;
        if (($pts[$d[5]] ?? 0) <= 0) {
            return 'Питомцы: ' . $id . ' требует ' . $d[5];
        }
    }
    // 4. Гейты тиров с каскадом.
    $invalid = [];
    $sumTier = function ($branch, $tier) use (&$pts, $defs, &$invalid) {
        $s = 0;
        foreach ($defs as $id => $d) {
            if ($d[0] !== $branch || $d[1] !== $tier) continue;
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
            list($branch, $tier) = $d;
            $open = true;
            if ($tier > 1) {
                $cg = null;
                foreach (petTierGates() as $g) {
                    if ($g[0] === $branch && $g[1] === $tier) { $cg = $g; break; }
                }
                if ($cg !== null) {
                    $have = 0;
                    for ($t = $cg[2]; $t <= $cg[3]; $t++) $have += $sumTier($branch, $t);
                    $open = $have >= $cg[4];
                } else {
                    $open = $sumTier($branch, $tier - 1) >= $d[3];
                }
            }
            if (!$open) {
                $invalid[] = $id;
                $changed = true;
            }
        }
    }
    if (count($invalid) > 0) {
        return 'Питомцы: нет гейта для ' . implode(', ', $invalid);
    }
    return null;
}
