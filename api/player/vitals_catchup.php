<?php
// Backend vitals catch-up: HP/stamina regen + expiry of timed states while the site is closed.
//
// Problem: passive regen (useGameLoop, 1/min), rest regen (restTick), effect
// durations (tickEffects) and travel timers only tick in the browser. With the
// site closed nothing advances, so HP stays frozen (e.g. 32299/63752).
//
// Fix (lazy catch-up, same pattern as petSatietyAt in api/pets/pet_state.php):
// on every server read/write of the save blob we advance vitals by the elapsed
// wall-clock time since player.vitalsAt (ms, stamped on each save/load).
// Deterministic, no cron needed, capped to avoid runaway offline progress.

if (!function_exists('applyVitalsCatchup')) {

define('VITALS_MAX_OFFLINE_SEC', 72 * 3600); // cap offline progress: 72h
define('VITALS_STAMINA_PER_MIN', 1);         // legacy, больше не используется (модель почасовая, см. ниже)

/**
 * Advances HP/stamina/effects/travel inside $saveData (player.*) from the
 * stored vitalsAt timestamp up to $nowMs. Always re-stamps vitalsAt.
 *
 * Stamina — почасовая модель: в активной экспедиции −1%/ч от maxStamina,
 * иначе +2%/ч (даже с закрытым сайтом, до 72ч).
 * $exploring: true — сейчас есть активная экспедиция (фаза не complete/idle).
 * $exploreStartedMs: когда она стартовала (для сплита реген/трейн в гэпе).
 *
 * Returns a summary for client toasts:
 * ['applied', 'offlineMin', 'hpGained', 'staminaGained', 'staminaLost', 'effectsExpired', 'travelFinished']
 */
function applyVitalsCatchup(array &$saveData, int $nowMs, $fallbackUpdatedAtSec = null, $exploring = false, $exploreStartedMs = null): array {
    $summary = [
        'applied' => false, 'offlineMin' => 0, 'hpGained' => 0,
        'staminaGained' => 0, 'staminaLost' => 0, 'effectsExpired' => 0, 'travelFinished' => false,
    ];
    if (!isset($saveData['player']) || !is_array($saveData['player'])) return $summary;
    $pl = &$saveData['player'];

    // Mid-combat saves: frontend also pauses all ticks while fighting
    // (regen skipped, effects tick per-turn instead). Stay consistent: stamp only.
    if (!empty($pl['combat']['isFighting'])) {
        $pl['vitalsAt'] = $nowMs;
        return $summary;
    }

    // Anchor timestamp (ms). Legacy saves lack it -> fall back to saves.updated_at.
    $anchorMs = isset($pl['vitalsAt']) ? (int)$pl['vitalsAt'] : 0;
    if ($anchorMs <= 0) {
        if ($fallbackUpdatedAtSec !== null && $fallbackUpdatedAtSec > 0) {
            $anchorMs = $fallbackUpdatedAtSec * 1000;
        } else {
            $pl['vitalsAt'] = $nowMs;
            return $summary;
        }
    }
    $elapsedSec = (int)floor(($nowMs - $anchorMs) / 1000);
    if ($elapsedSec < 60) {
        $pl['vitalsAt'] = $nowMs;
        return $summary;
    }
    if ($elapsedSec > VITALS_MAX_OFFLINE_SEC) $elapsedSec = VITALS_MAX_OFFLINE_SEC;

    $stats = isset($pl['stats']) && is_array($pl['stats']) ? $pl['stats'] : [];
    $maxHp = (float)($stats['maxHp'] ?? 0);
    $curHp = (float)($stats['currentHp'] ?? 0);
    $maxSt = (float)($stats['maxStamina'] ?? 0);
    $curSt = (float)($stats['stamina'] ?? 0);
    $regen = max(0.0, (float)($stats['regen'] ?? 0));

    // 1) Travel timers are second-based: finish/drain them first, regen only
    //    applies to the leftover time (frontend also skips regen while traveling).
    $regenSec = $elapsedSec;
    if (isset($pl['travel']) && is_array($pl['travel'])) {
        $tr = &$pl['travel'];
        $rem = (int)($tr['remaining'] ?? 0);
        if (!empty($tr['isReturning'])) {
            if ($elapsedSec >= $rem) {
                $pl['travel'] = ['isTraveling' => false, 'isReturning' => false, 'destination' => null, 'remaining' => 0, 'total' => 0];
                if ($maxSt > 0) { $curSt = $maxSt; $pl['stats']['stamina'] = $curSt; }
                $summary['travelFinished'] = true;
                $regenSec = $elapsedSec - $rem;
            } else {
                $tr['remaining'] = $rem - $elapsedSec;
                $regenSec = 0;
            }
        } elseif (!empty($tr['isTraveling'])) {
            if ($elapsedSec >= $rem) {
                $pl['travel'] = ['isTraveling' => false, 'isReturning' => false, 'destination' => null, 'remaining' => 0, 'total' => 0];
                $summary['travelFinished'] = true;
                $regenSec = $elapsedSec - $rem;
            } else {
                $tr['remaining'] = $rem - $elapsedSec;
                // Frontend travelTick drains 1 stamina/sec while traveling.
                if ($maxSt > 0) { $curSt = max(0.0, $curSt - $elapsedSec); $pl['stats']['stamina'] = $curSt; }
                $regenSec = 0;
            }
        }
    }

    // 2) HP-реген по минутному тику (как фронт); в активной экспедиции — пауза.
    //    Стамина — почасовая: −1%/ч в экспедиции, иначе +2%/ч от maxStamina.
    //    Если экспедиция стартовала внутри гэпа — сплит: реген до старта, дрейн после.
    $drainSec = 0;
    $regenSecForStam = $regenSec;
    if ($exploring) {
        $expStart = is_numeric($exploreStartedMs) ? (int)$exploreStartedMs : 0;
        if ($expStart > $anchorMs && $expStart < $nowMs) {
            $regenSecForStam = (int)floor(($expStart - $anchorMs) / 1000);
            $drainSec = $elapsedSec - (int)floor(($expStart - $anchorMs) / 1000);
        } else {
            $regenSecForStam = 0;
            $drainSec = $elapsedSec;
        }
    }
    $minutes = (int)floor($regenSec / 60);
    // В экспедиции HP стоит; если она стартовала внутри гэпа — реген за idle-часть.
    $hpMinutes = $exploring ? (int)floor($regenSecForStam / 60) : $minutes;
    if ($hpMinutes > 0) {
        if ($maxHp > 0 && $curHp < $maxHp && $regen > 0) {
            $newHp = min($maxHp, $curHp + $hpMinutes * $regen);
            $summary['hpGained'] = (int)round($newHp - $curHp);
            $curHp = $newHp;
            $pl['stats']['currentHp'] = $curHp;
        }
    }
    if ($maxSt > 0) {
        if ($drainSec > 0) {
            $lost = $maxSt * 0.01 * ($drainSec / 3600);
            $newSt = max(0.0, $curSt - $lost);
            $summary['staminaLost'] = (int)round($curSt - $newSt);
            $curSt = $newSt;
            $pl['stats']['stamina'] = $curSt;
        }
        $stamMinutes = (int)floor($regenSecForStam / 60);
        if ($stamMinutes > 0 && $curSt < $maxSt) {
            $newSt = min($maxSt, $curSt + $maxSt * 0.02 * ($regenSecForStam / 3600));
            $summary['staminaGained'] = (int)round($newSt - $curSt);
            $pl['stats']['stamina'] = $newSt;
        }
    }

    // 3) Active effects: remaining is seconds (frontend tickEffects -1/sec). Expire.
    //    (HoT ticks are skipped: the regen above already heals toward the cap.)
    if (isset($pl['activeEffects']) && is_array($pl['activeEffects'])) {
        $kept = [];
        foreach ($pl['activeEffects'] as $e) {
            $rem = (int)($e['remaining'] ?? 0) - $elapsedSec;
            if ($rem > 0) { $e['remaining'] = $rem; $kept[] = $e; }
            else $summary['effectsExpired']++;
        }
        $pl['activeEffects'] = $kept;
    }

    $pl['vitalsAt'] = $nowMs;
    $summary['applied'] = true;
    $summary['offlineMin'] = (int)floor($elapsedSec / 60);
    return $summary;
}

}
