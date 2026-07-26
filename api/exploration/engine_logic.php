<?php
require_once __DIR__ . '/engine_config.php';
require_once __DIR__ . '/event_data.php';
require_once __DIR__ . '/legendary_data.php';
require_once __DIR__ . '/engine_loot.php';

const TRAVEL_OUT_TICKS = 1;
const EXPLORE_TICKS = 180;
const TRAVEL_BACK_TICKS = 30;
const EVENT_COOLDOWN_MIN = 12;
const EVENT_COOLDOWN_MAX = 25;
const MICRO_COOLDOWN_MIN = 5;
const MICRO_COOLDOWN_MAX = 8;
const MAX_TICKS_PER_POLL = 3600;
const LEGENDARY_AUTO_RESOLVE_TICKS = 3;

// Tiny MB texts
const MICRO_TEXTS = [
  'Под ногой хрустнула ветка. Тишина.',
  'Где-то вдалеке ухнул филин.',
  'Ветер доносит запах гари и сырости.',
  'Вы останавливаетесь перевести дух.',
  'Слышен отдалённый гул генератора.',
  'На земле — чей-то след. Свежий.',
  'Капли воды падают с ржавой трубы.',
  'В траве блестит пустая гильза.',
  'Над головой пролетела стая птиц.',
  'Где-то лают собаки. Или не собаки.',
  'Вы протираете запотевшие очки.',
  'Пульс учащается. Вокруг ни души.',
  'Из-за облака выглядывает солнце.',
  'Вы находите несколько ягод шиповника.',
  'Тени становятся длиннее. Вечереет.',
];

if (!function_exists('generateMicroEvent')) {
function generateMicroEvent($zoneDesc, $faction) {
  $text = substitute(MICRO_TEXTS[array_rand(MICRO_TEXTS)], $zoneDesc, $faction);
  $heal = mt_rand(0, 100) < 15 ? RF(0.005, 0.02) : 0;
  $eff = [];
  if ($heal > 0) $eff['healPercent'] = $heal;
  return ['text' => $text, 'effects' => $eff, 'type' => 'ambient'];
}
}

// ---------------------------------------------------------------------------
// Core: process ticks for an exploration
// ---------------------------------------------------------------------------
function processTicks($pdo, $userId, $maxTicks = MAX_TICKS_PER_POLL) {
  // 1. Load active exploration
  $stmt = $pdo->prepare("SELECT * FROM explorations WHERE user_id = ? AND phase NOT IN ('complete','idle') ORDER BY id DESC LIMIT 1");
  $stmt->execute([$userId]);
  $exp = $stmt->fetch();
  if (!$exp) return null;
  if (!isset($exp['total_items'])) $exp['total_items'] = 0;

  // 2. Calculate elapsed seconds since last_tick_at (use DB time for consistency)
  $dbNow = $pdo->query("SELECT UNIX_TIMESTAMP(NOW(3)) AS dbts")->fetch();
  $dbNowSec = (int)$dbNow['dbts'];
  $dbLastTick = $pdo->prepare("SELECT UNIX_TIMESTAMP(?) AS dbts");
  $dbLastTick->execute([$exp['last_tick_at']]);
  $dbLastTickSec = (int)$dbLastTick->fetch()['dbts'];
  $lastTickSec = $exp['last_tick_at'] ? $dbLastTickSec : $dbNowSec;
  $elapsedSec = max(0, $dbNowSec - $lastTickSec);
  // Stale detection: if last_tick_at is null or idle > 5 min, auto-complete
  $expId = $exp['id'];
  if ((!$exp['last_tick_at'] || $elapsedSec > 300) && $exp['phase'] !== 'travel_back') {
    $exp['phase'] = 'complete';
    saveExplorationHistory($pdo, $userId, $exp, 'complete');
    $fields = ['phase' => 'complete', 'time_left' => 0,
      'tick_count' => $exp['tick_count'], 'event_cooldown' => 0,
      'micro_event_cooldown' => 0, 'last_tick_at' => $pdo->query("SELECT NOW(3) AS dbnow")->fetch()['dbnow']];
    if ($exp['legendary_rewards']) $fields['legendary_rewards'] = is_string($exp['legendary_rewards']) ? $exp['legendary_rewards'] : json_encode($exp['legendary_rewards']);
    setExploreFields($pdo, $expId, $fields);
    return buildStatus($pdo, $exp, []);
  }

  $ticksToProcess = min($elapsedSec, $maxTicks);
  if ($ticksToProcess <= 0) {
    // Still in cooldown — just return current state
    return buildStatus($pdo, $exp, []);
  }

  $events = [];
  $zoneDesc = getZoneDesc($exp['zone']);

  for ($i = 0; $i < $ticksToProcess; $i++) {
    // --- Phase transitions ---
    if ($exp['phase'] === 'travel_out') {
      $exp['time_left'] = (int)$exp['time_left'] - 1;
      if ($exp['time_left'] <= 0) {
        $exp['phase'] = 'exploring';
        $exp['time_left'] = EXPLORE_TICKS;
        $exp['event_cooldown'] = 0;
        $exp['micro_event_cooldown'] = 0;
        $events[] = ['text' => '🚀 Вы прибыли в зону "' . $exp['zone'] . '". Время исследовать!', 'type' => 'system', 'effects' => '{}', 'is_micro' => 0, 'tick_number' => $exp['tick_count']];
        saveEvent($pdo, $userId, $expId, $events[count($events)-1]);
      }
      $exp['tick_count']++;
      setExploreField($pdo, $expId, ['phase' => $exp['phase'], 'time_left' => $exp['time_left'], 'event_cooldown' => $exp['event_cooldown'], 'micro_event_cooldown' => $exp['micro_event_cooldown'], 'tick_count' => $exp['tick_count']]);
      continue;
    }

    if ($exp['phase'] === 'exploring') {
      $exp['time_left'] = (int)$exp['time_left'] - 1;

      // Check death
      $hp = getPlayerHp($pdo, $userId);
      if ($hp <= 0) {
        handleExplorationDeath($pdo, $userId, $exp);
        $exp['phase'] = 'complete';
        return buildStatus($pdo, $exp, $events, 'dead');
      }

      // Time up → travel back (or reset for infinite)
      if ($exp['time_left'] <= 0) {
        if ($exp['is_infinite']) {
          $exp['time_left'] = EXPLORE_TICKS;
        } else {
          $exp['phase'] = 'travel_back';
          $exp['time_left'] = TRAVEL_BACK_TICKS;
          $events[] = ['text' => 'Время вышло. Пора возвращаться на базу.', 'type' => 'system', 'effects' => '{}', 'is_micro' => 0, 'tick_number' => $exp['tick_count']];
          saveEvent($pdo, $userId, $expId, $events[count($events)-1]);
        }
      }

      // Legendary auto-resolve
      if ($exp['legendary_id']) {
        $exp['legendary_auto_resolve'] = (int)$exp['legendary_auto_resolve'] - 1;
        if ($exp['legendary_auto_resolve'] <= 0) {
          $legEvent = resolveLegendaryStage($pdo, $userId, $exp, $zoneDesc);
          if ($legEvent) {
            $events[] = $legEvent;
            saveEvent($pdo, $userId, $expId, $legEvent);
          }
        }
        $exp['tick_count']++;
        setExploreField($pdo, $expId, [
          'time_left' => $exp['time_left'],
          'legendary_auto_resolve' => $exp['legendary_auto_resolve'],
          'legendary_stage' => $exp['legendary_stage'],
          'legendary_rewards' => $exp['legendary_rewards'],
          'legendary_id' => $exp['legendary_id'],
          'tick_count' => $exp['tick_count'],
        ]);
        continue;
      }

      // Micro events
      $exp['micro_event_cooldown'] = (int)$exp['micro_event_cooldown'] - 1;
      if ($exp['micro_event_cooldown'] <= 0) {
        $me = generateMicroEvent($zoneDesc, '');
        $applyResult = applyEffects($pdo, $userId, $me['effects']);
        $exp['total_items'] = (int)$exp['total_items'] + $applyResult['count'];
        $exp['total_chips'] = (int)$exp['total_chips'] + (int)($me['effects']['chips'] ?? 0);
        $exp['total_exp'] = (int)$exp['total_exp'] + (int)($me['effects']['exp'] ?? 0);
        if (!empty($applyResult['items'])) {
          $me['effects']['items'] = $applyResult['items'];
        }
        $meEvent = [
          'text' => $me['text'],
          'type' => $me['type'],
          'effects' => json_encode($me['effects']),
          'is_micro' => 1,
          'tick_number' => $exp['tick_count'],
          'decision' => null,
          'resource_cost' => null,
          'resource_had' => 0,
          'legendary_event_id' => null,
          'legendary_stage' => null,
        ];
        $events[] = $meEvent;
        saveEvent($pdo, $userId, $expId, $meEvent);
        $exp['micro_event_cooldown'] = RNG(MICRO_COOLDOWN_MIN, MICRO_COOLDOWN_MAX);
      }

      // Big events
      $exp['event_cooldown'] = (int)$exp['event_cooldown'] - 1;
      if ($exp['event_cooldown'] <= 0) {
        // Legendary trigger on first big event
        if (!$exp['has_triggered_legendary']) {
          $legEvents = getLegendaryEvents();
          $legKeys = array_keys($legEvents);
          if (!empty($legKeys)) {
            $pickedKey = $legKeys[array_rand($legKeys)];
            $legData = $legEvents[$pickedKey];
            $exp['legendary_id'] = $pickedKey;
            $exp['legendary_stage'] = 0;
            $exp['legendary_auto_resolve'] = LEGENDARY_AUTO_RESOLVE_TICKS;
            $exp['legendary_rewards'] = json_encode([]);
            $exp['has_triggered_legendary'] = 1;
            $events[] = [
              'text' => $legData['desc'],
              'type' => 'legendary',
              'effects' => '{}',
              'is_micro' => 0,
              'tick_number' => $exp['tick_count'],
              'decision' => null,
              'resource_cost' => null,
              'resource_had' => 0,
              'legendary_event_id' => $pickedKey,
              'legendary_stage' => 0,
              'legendary_result' => null,
            ];
            saveEvent($pdo, $userId, $expId, $events[count($events)-1]);
          }
        } else {
          // Regular event
          $itemsRef = loadInventoryItems($pdo, $userId);
          $origIds = array_column($itemsRef, 'id');
          $playerLevel = getPlayerLevel($pdo, $userId);
          $factions = $exp['zone_factions'] ? json_decode($exp['zone_factions'], true) ?? [] : [];
          $event = generateEvent($exp['zone'], $playerLevel, $factions, $itemsRef, $exp['tick_count']);
          if (!empty($event['resourceHad'])) {
            persistInventoryItems($pdo, $userId, $itemsRef, $origIds);
          }
          $applyResult = applyEffects($pdo, $userId, $event['effects']);
          $exp['total_items'] = (int)$exp['total_items'] + $applyResult['count'];
          $exp['total_chips'] = (int)$exp['total_chips'] + (int)($event['effects']['chips'] ?? 0);
          $exp['total_exp'] = (int)$exp['total_exp'] + (int)($event['effects']['exp'] ?? 0);
          if (!empty($applyResult['items'])) {
            $event['effects']['items'] = $applyResult['items'];
          }
          $ev = [
            'text' => $event['text'],
            'type' => $event['type'],
            'effects' => json_encode($event['effects']),
            'is_micro' => 0,
            'tick_number' => $exp['tick_count'],
            'decision' => $event['decision'],
            'resource_cost' => $event['resourceCost'],
            'resource_had' => $event['resourceHad'] ?? 0,
            'legendary_event_id' => null,
            'legendary_stage' => null,
          ];
          $events[] = $ev;
          saveEvent($pdo, $userId, $expId, $ev);
        }
        $exp['event_cooldown'] = RNG(EVENT_COOLDOWN_MIN, EVENT_COOLDOWN_MAX);
      }

      $exp['tick_count']++;
      continue;
    }

    if ($exp['phase'] === 'travel_back') {
      $exp['time_left'] = (int)$exp['time_left'] - 1;
      if ($exp['time_left'] <= 0) {
        $exp['phase'] = 'complete';
        $events[] = ['text' => '🏠 Вы вернулись на базу. Экспедиция завершена!', 'type' => 'system', 'effects' => '{}', 'is_micro' => 0, 'tick_number' => $exp['tick_count']];
        saveEvent($pdo, $userId, $expId, $events[count($events)-1]);
        saveExplorationHistory($pdo, $userId, $exp, 'complete');
      }
      $exp['tick_count']++;
      setExploreField($pdo, $expId, ['phase' => $exp['phase'], 'time_left' => $exp['time_left'], 'tick_count' => $exp['tick_count']]);
      continue;
    }

    break; // unknown phase
  }

  // Update last_tick_at and totals
  $dbNowRow = $pdo->query("SELECT NOW(3) AS dbnow")->fetch();
  $nowStr = $dbNowRow['dbnow'];
  $fields = [
    'last_tick_at' => $nowStr,
    'phase' => $exp['phase'],
    'time_left' => $exp['time_left'],
    'tick_count' => $exp['tick_count'],
    'event_cooldown' => $exp['event_cooldown'],
    'micro_event_cooldown' => $exp['micro_event_cooldown'],
    'has_triggered_legendary' => $exp['has_triggered_legendary'],
    'legendary_id' => $exp['legendary_id'],
    'legendary_stage' => $exp['legendary_stage'],
    'legendary_auto_resolve' => $exp['legendary_auto_resolve'],
    'total_chips' => $exp['total_chips'],
    'total_exp' => $exp['total_exp'],
    'total_items' => $exp['total_items'],
  ];
  if ($exp['legendary_rewards']) {
    $fields['legendary_rewards'] = is_string($exp['legendary_rewards']) ? $exp['legendary_rewards'] : json_encode($exp['legendary_rewards']);
  }
  setExploreFields($pdo, $expId, $fields);

  return buildStatus($pdo, $exp, $events);
}

// ---------------------------------------------------------------------------
// Legendary stage resolution
// ---------------------------------------------------------------------------
function resolveLegendaryStage($pdo, $userId, &$exp, $zoneDesc) {
  $allLegends = getLegendaryEvents();
  $legKey = $exp['legendary_id'];
  if (!isset($allLegends[$legKey])) return null;
  $leg = $allLegends[$legKey];
  $stageIdx = (int)$exp['legendary_stage'];
  if (!isset($leg['stages'][$stageIdx])) return null;
  $stage = $leg['stages'][$stageIdx];
  if (empty($stage['text'])) {
    // Final stage — give final reward
    $fr = computeLegendaryReward($leg['fr_rw'], getPlayerLevel($pdo, $userId));
    $rewards = json_decode($exp['legendary_rewards'] ?? '{}', true) ?: [];
    $merged = mergeEffectsArr($rewards, $fr);
    $applyResult = applyEffects($pdo, $userId, $merged);
    $exp['total_items'] = (int)$exp['total_items'] + $applyResult['count'];
    $exp['total_chips'] = (int)$exp['total_chips'] + (int)($fr['chips'] ?? 0);
    $exp['total_exp'] = (int)$exp['total_exp'] + (int)($fr['exp'] ?? 0);
    if (!empty($applyResult['items'])) {
      $fr['items'] = $applyResult['items'];
    }
    $exp['legendary_id'] = null;
    $exp['legendary_stage'] = null;
    $exp['legendary_auto_resolve'] = null;
    $exp['legendary_rewards'] = null;
    return [
      'text' => $leg['fr_text'],
      'type' => 'legendary',
      'effects' => json_encode($fr),
      'is_micro' => 0,
      'tick_number' => $exp['tick_count'],
      'decision' => null,
      'resource_cost' => null,
      'resource_had' => 0,
      'legendary_event_id' => $legKey,
      'legendary_stage' => $stageIdx + 1,
      'legendary_result' => 'complete',
    ];
  }

  // 70/30 roll
  $success = mt_rand(1, 100) <= 70;
  $stageReward = computeLegendaryReward($stage['rw'], getPlayerLevel($pdo, $userId));
  $rewards = json_decode($exp['legendary_rewards'] ?? '{}', true) ?: [];

  if ($success) {
    $merged = mergeEffectsArr($rewards, $stageReward);
    $exp['legendary_rewards'] = json_encode($merged);
    $exp['legendary_stage'] = $stageIdx + 1;
    $exp['legendary_auto_resolve'] = LEGENDARY_AUTO_RESOLVE_TICKS;
    $applyResult = applyEffects($pdo, $userId, $stageReward);
    $exp['total_items'] = (int)$exp['total_items'] + $applyResult['count'];
    $exp['total_chips'] = (int)$exp['total_chips'] + (int)($stageReward['chips'] ?? 0);
    $exp['total_exp'] = (int)$exp['total_exp'] + (int)($stageReward['exp'] ?? 0);
    if (!empty($applyResult['items'])) {
      $stageReward['items'] = $applyResult['items'];
    }
    return [
      'text' => $stage['suc'],
      'type' => 'legendary',
      'effects' => json_encode($stageReward),
      'is_micro' => 0,
      'tick_number' => $exp['tick_count'],
      'decision' => null,
      'resource_cost' => null,
      'resource_had' => 0,
      'legendary_event_id' => $legKey,
      'legendary_stage' => $stageIdx + 1,
      'legendary_result' => 'stage',
    ];
  } else {
    // Fail — chain breaks, payout accumulated rewards
    $applyResult = applyEffects($pdo, $userId, $rewards);
    $exp['total_items'] = (int)$exp['total_items'] + $applyResult['count'];
    $exp['total_chips'] = (int)$exp['total_chips'] + (int)($rewards['chips'] ?? 0);
    $exp['total_exp'] = (int)$exp['total_exp'] + (int)($rewards['exp'] ?? 0);
    if (!empty($applyResult['items'])) {
      $rewards['items'] = $applyResult['items'];
    }
    $exp['legendary_id'] = null;
    $exp['legendary_stage'] = null;
    $exp['legendary_auto_resolve'] = null;
    $exp['legendary_rewards'] = null;
    return [
      'text' => $stage['fail'],
      'type' => 'legendary',
      'effects' => json_encode($rewards),
      'is_micro' => 0,
      'tick_number' => $exp['tick_count'],
      'decision' => null,
      'resource_cost' => null,
      'resource_had' => 0,
      'legendary_event_id' => $legKey,
      'legendary_stage' => $stageIdx + 1,
      'legendary_result' => 'fail',
    ];
  }
}

// ---------------------------------------------------------------------------
// Death rollback
// ---------------------------------------------------------------------------
function handleExplorationDeath($pdo, $userId, &$exp) {
  // Remove session items
  $sessionIds = json_decode($exp['session_item_ids'] ?? '[]', true) ?: [];
  if (!empty($sessionIds)) {
    $placeholders = implode(',', array_fill(0, count($sessionIds), '?'));
    $params = array_merge($sessionIds, [$userId]);
    $del = $pdo->prepare("DELETE FROM inventory_items WHERE id IN ($placeholders) AND user_id = ?");
    $del->execute($params);
  }
  // Rollback chips
  $lostChips = (int)$exp['total_chips'];
  if ($lostChips > 0) {
    $sd = getSaveData($pdo, $userId);
    $sd['player']['dataChips'] = max(0, ($sd['player']['dataChips'] ?? 0) - $lostChips);
    $sd['player']['stats']['currentHp'] = 1;
    putSaveData($pdo, $userId, $sd);
  }
  $exp['phase'] = 'complete';
  setExploreFields($pdo, $exp['id'], ['phase' => 'complete', 'last_tick_at' => date('Y-m-d H:i:s')]);
  saveExplorationHistory($pdo, $userId, $exp, 'dead');
}

// ---------------------------------------------------------------------------
// Exploration start
// ---------------------------------------------------------------------------
function startExploration($pdo, $userId, $zone) {
  $zoneData = getZoneData($zone);
  $isInfinite = ($zone === 'Заброшенная военная база и окрестности');
  if ($isInfinite) {
    $phase = 'exploring';
    $timeLeft = EXPLORE_TICKS;
  } else {
    $phase = 'travel_out';
    $timeLeft = TRAVEL_OUT_TICKS;
  }
  $stmt = $pdo->prepare("INSERT INTO explorations (user_id, zone, zone_difficulty, zone_factions, is_infinite, phase, time_left, event_cooldown, micro_event_cooldown, has_triggered_legendary, last_tick_at, started_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, NOW(3), NOW())");
  $stmt->execute([$userId, $zone, (int)($zoneData['difficulty'] ?? 1),
    json_encode($zoneData['allowedFactions'] ?? [], JSON_UNESCAPED_UNICODE),
    $isInfinite ? 1 : 0,
    $phase, $timeLeft]);
  $expId = $pdo->lastInsertId();

  return ['id' => $expId, 'phase' => $phase, 'time_left' => $timeLeft, 'is_infinite' => $isInfinite];
}

// ---------------------------------------------------------------------------
// Build status response
// ---------------------------------------------------------------------------
function buildStatus($pdo, $exp, $events, $forceState = null) {
  $phase = $exp['phase'];
  $isActive = $phase !== 'complete' && $phase !== 'idle';
  $sd = getSaveData($pdo, $exp['user_id']);

  // For infinite zones, return elapsed seconds instead of remaining countdown
  $timeLeft = (int)$exp['time_left'];
  if (!empty($exp['is_infinite']) && $exp['started_at']) {
    $stmt = $pdo->query("SELECT UNIX_TIMESTAMP(started_at) AS started_ts, UNIX_TIMESTAMP(NOW(3)) AS dbts FROM explorations WHERE id = " . (int)$exp['id']);
    $row = $stmt->fetch();
    $elapsed = (int)$row['dbts'] - (int)$row['started_ts'];
    $timeLeft = max(0, $elapsed);
  }

  return [
    'active' => $isActive,
    'exploration' => [
      'id' => (int)$exp['id'],
      'zone' => $exp['zone'],
      'phase' => $phase,
      'timeLeft' => $timeLeft,
      'tickCount' => (int)$exp['tick_count'],
      'totalChips' => (int)$exp['total_chips'],
      'totalExp' => (int)$exp['total_exp'],
      'totalItems' => (int)($exp['total_items'] ?? 0),
      'isInfinite' => (bool)$exp['is_infinite'],
      'legendaryId' => $exp['legendary_id'],
      'legendaryStage' => $exp['legendary_stage'] !== null ? (int)$exp['legendary_stage'] : null,
    ],
    'player' => [
      'dataChips' => (int)($sd['player']['dataChips'] ?? 0),
      'currentExp' => (int)($sd['player']['currentExp'] ?? 0),
      'currentHp' => (int)($sd['player']['stats']['currentHp'] ?? 100),
    ],
    'state' => $forceState ?? ($isActive ? 'active' : 'complete'),
    'newEvents' => $events,
  ];
}

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------
function cancelExploration($pdo, $userId) {
  $stmt = $pdo->prepare("SELECT * FROM explorations WHERE user_id = ? AND phase NOT IN ('complete','idle') ORDER BY id DESC LIMIT 1");
  $stmt->execute([$userId]);
  $exp = $stmt->fetch();
  if (!$exp) return ['success' => false, 'message' => 'Нет активного исследования'];
  $exp['phase'] = 'complete';
  saveExplorationHistory($pdo, $userId, $exp, 'cancelled');
  $upd = $pdo->prepare("UPDATE explorations SET phase = 'complete' WHERE id = ?");
  $upd->execute([$exp['id']]);
  return ['success' => true];
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------
function saveExplorationHistory($pdo, $userId, $exp, $outcome) {
  $lastEvents = [];
  $evStmt = $pdo->prepare("SELECT text, type, effects, is_micro, created_at FROM exploration_events WHERE exploration_id = ? ORDER BY id DESC LIMIT 50");
  $evStmt->execute([$exp['id']]);
  $lastEvents = $evStmt->fetchAll();
  $duration = 0;
  if ($exp['started_at']) {
    $start = new DateTimeImmutable($exp['started_at']);
    $dbNowForDur = $pdo->query("SELECT UNIX_TIMESTAMP(NOW()) AS dbts")->fetch();
    $duration = (int)$dbNowForDur['dbts'] - $start->getTimestamp();
  }
  $stmt = $pdo->prepare("INSERT INTO exploration_history (user_id, zone, outcome, total_chips, total_exp, total_items, duration_seconds, event_log, ended_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())");
  $stmt->execute([$userId, $exp['zone'], $outcome, (int)$exp['total_chips'],
    (int)$exp['total_exp'], (int)($exp['total_items'] ?? 0), $duration,
    json_encode($lastEvents, JSON_UNESCAPED_UNICODE)]);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function saveEvent($pdo, $userId, $expId, $e) {
  if (empty($e['text'])) return;
  $stmt = $pdo->prepare("INSERT INTO exploration_events (user_id, exploration_id, tick_number, is_micro, text, type, effects, decision, resource_cost, resource_had, legendary_event_id, legendary_stage, legendary_result, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))");
  $stmt->execute([$userId, $expId, $e['tick_number'] ?? 0, $e['is_micro'] ?? 0,
    $e['text'], $e['type'] ?? 'unknown',
    $e['effects'] ?? '{}',
    $e['decision'] ?? null, $e['resource_cost'] ?? null, (int)($e['resource_had'] ?? 0),
    $e['legendary_event_id'] ?? null, $e['legendary_stage'] ?? null,
    $e['legendary_result'] ?? null]);
}

function setExploreField($pdo, $expId, $fields) {
  setExploreFields($pdo, $expId, $fields);
}
function setExploreFields($pdo, $expId, $fields) {
  if (empty($fields)) return;
  $sets = [];
  $params = [];
  foreach ($fields as $k => $v) {
    $sets[] = "`$k` = ?";
    $params[] = $v;
  }
  $params[] = $expId;
  $stmt = $pdo->prepare("UPDATE explorations SET " . implode(', ', $sets) . " WHERE id = ?");
  $stmt->execute($params);
}

function getSaveData($pdo, $userId) {
  $stmt = $pdo->prepare("SELECT save_data FROM saves WHERE user_id = ?");
  $stmt->execute([$userId]);
  $row = $stmt->fetch();
  if (!$row) return ['player' => ['stats' => []]];
  $sd = json_decode($row['save_data'], true);
  if (!isset($sd['player'])) $sd['player'] = [];
  if (!isset($sd['player']['stats'])) $sd['player']['stats'] = [];
  return $sd;
}

function putSaveData($pdo, $userId, $sd) {
  $stmt = $pdo->prepare("UPDATE saves SET save_data = ?, updated_at = NOW() WHERE user_id = ?");
  $stmt->execute([json_encode($sd, JSON_UNESCAPED_UNICODE), $userId]);
}

function getPlayerHp($pdo, $userId) {
  $sd = getSaveData($pdo, $userId);
  return (int)($sd['player']['stats']['currentHp'] ?? 0);
}

function getPlayerLevel($pdo, $userId) {
  $sd = getSaveData($pdo, $userId);
  return (int)($sd['player']['level'] ?? 1);
}

function getZoneData($zoneName) {
  foreach ($GLOBALS['ZONES'] as $z) {
    if ($z['name'] === $zoneName) return $z;
  }
  return ['difficulty' => 1, 'allowedFactions' => []];
}

function getZoneFactions($zone) {
  $z = getZoneData($zone);
  return $z['allowedFactions'] ?? [];
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------
function applyEffects($pdo, $userId, $effects) {
  $sd = getSaveData($pdo, $userId);
  $changed = false;
  $chips = isset($effects['chips']) ? (int)$effects['chips'] : 0;
  $exp = isset($effects['exp']) ? (int)$effects['exp'] : 0;
  $healPct = isset($effects['healPercent']) ? (float)$effects['healPercent'] : 0;
  $dmgPct = isset($effects['damagePercent']) ? (float)$effects['damagePercent'] : 0;
  $result = ['count' => 0, 'items' => []];

  if ($chips != 0) {
    $sd['player']['dataChips'] = ($sd['player']['dataChips'] ?? 0) + $chips;
    $changed = true;
  }
  if ($exp > 0) {
    $sd['player']['currentExp'] = ($sd['player']['currentExp'] ?? 0) + $exp;
    $changed = true;
  }
  if ($healPct > 0) {
    $maxHp = $sd['player']['stats']['maxHp'] ?? 100;
    $cur = $sd['player']['stats']['currentHp'] ?? $maxHp;
    $sd['player']['stats']['currentHp'] = min($maxHp, $cur + (int)round($maxHp * $healPct));
    $changed = true;
  }
  if ($dmgPct > 0) {
    $maxHp = $sd['player']['stats']['maxHp'] ?? 100;
    $cur = $sd['player']['stats']['currentHp'] ?? $maxHp;
    $sd['player']['stats']['currentHp'] = max(0, $cur - (int)round($maxHp * $dmgPct));
    $changed = true;
  }
  if (isset($effects['itemCount']) && $effects['itemCount'] > 0) {
    $result = generateLoot($pdo, $userId, '', 1, $effects['itemCount']);
  }
  if ($changed) putSaveData($pdo, $userId, $sd);
  return $result;
}

function mergeEffectsArr($a, $b) {
  foreach (['chips','exp','damage','damagePercent','heal','healPercent','itemCount'] as $k) {
    if (isset($b[$k])) $a[$k] = ($a[$k] ?? 0) + $b[$k];
  }
  return $a;
}

// ---------------------------------------------------------------------------
// Inventory helpers (reused from earlier)
// ---------------------------------------------------------------------------
function loadInventoryItems($pdo, $userId) {
  $stmt = $pdo->prepare("SELECT id, name, quantity FROM inventory_items WHERE user_id = ? AND data->>'$.type' = 'material'");
  $stmt->execute([$userId]);
  return $stmt->fetchAll();
}

function persistInventoryItems($pdo, $userId, $items, $originalIds) {
  $processed = [];
  foreach ($items as $item) {
    $id = $item['id'] ?? null;
    $qty = (int)($item['quantity'] ?? 0);
    if (!$id) continue;
    $processed[$id] = true;
    if ($qty > 0) {
      $upd = $pdo->prepare("UPDATE inventory_items SET quantity = ? WHERE id = ? AND user_id = ?");
      $upd->execute([$qty, $id, $userId]);
    } else {
      $del = $pdo->prepare("DELETE FROM inventory_items WHERE id = ? AND user_id = ?");
      $del->execute([$id, $userId]);
    }
  }
  foreach ($originalIds as $origId) {
    if (!isset($processed[$origId])) {
      $del = $pdo->prepare("DELETE FROM inventory_items WHERE id = ? AND user_id = ?");
      $del->execute([$origId, $userId]);
    }
  }
}

// ---------------------------------------------------------------------------
// getCategoryTexts, generateEvent, resolveBranch, etc. — from event_data
// (included via require_once, but aliased here for completeness)
// ---------------------------------------------------------------------------
function getCategoryTexts() {
  global $COMBAT_TEXTS, $TRADE_TEXTS, $TRAP_TEXTS, $LOOT_TEXTS,
         $DISCOVERY_TEXTS, $ANOMALY_TEXTS, $NPC_TEXTS, $REST_TEXTS,
         $HELP_TEXTS_RICH, $FACTION_TEXTS, $SPECIAL_TEXTS, $BRANCHING_TEXTS;
  return [
    'combat' => ['texts' => $COMBAT_TEXTS ?? [], 'rich' => []],
    'trade' => ['texts' => $TRADE_TEXTS ?? [], 'rich' => []],
    'trap' => ['texts' => $TRAP_TEXTS ?? [], 'rich' => []],
    'loot' => ['texts' => $LOOT_TEXTS ?? [], 'rich' => []],
    'discovery' => ['texts' => $DISCOVERY_TEXTS ?? [], 'rich' => []],
    'anomaly' => ['texts' => $ANOMALY_TEXTS ?? [], 'rich' => []],
    'npc' => ['texts' => $NPC_TEXTS ?? [], 'rich' => []],
    'rest' => ['texts' => $REST_TEXTS ?? [], 'rich' => []],
    'help' => ['texts' => [], 'rich' => $HELP_TEXTS_RICH ?? []],
    'faction' => ['texts' => $FACTION_TEXTS ?? [], 'rich' => []],
    'special' => ['texts' => $SPECIAL_TEXTS ?? [], 'rich' => []],
    'branching' => ['texts' => $BRANCHING_TEXTS ?? [], 'rich' => []],
  ];
}

const CATEGORY_WEIGHTS = [
  'combat' => 35, 'trade' => 12, 'help' => 12, 'trap' => 10,
  'loot' => 15, 'discovery' => 10, 'anomaly' => 5, 'npc' => 12,
  'rest' => 4, 'faction' => 6, 'special' => 3, 'branching' => 24,
];

function pickCategory() {
  $total = 0;
  foreach (CATEGORY_WEIGHTS as $w) $total += $w;
  $roll = mt_rand() / mt_getrandmax() * $total;
  foreach (CATEGORY_WEIGHTS as $cat => $w) {
    $roll -= $w;
    if ($roll <= 0) return $cat;
  }
  return 'combat';
}

function generateEvent($zone, $playerLevel, $factions, &$items, $existingEventCount = 0) {
  $catData = getCategoryTexts();
  $category = pickCategory();
  $zoneDesc = getZoneDesc($zone);
  $faction = $factions ? pick($factions) : 'Бандиты';
  $eventKey = $existingEventCount;

  // 1. Rich help
  if ($category === 'help' && !empty($catData['help']['rich'])) {
    $template = $catData['help']['rich'][array_rand($catData['help']['rich'])];
    $text = substitute($template['text'], $zoneDesc, $faction);
    $branch = $template['branch'] ?? null;
    if ($branch) {
      $result = resolveBranch(['outcomes' => $branch['outcomes']], $zone, $playerLevel, $items);
      $eff = mergeEffectsArr($template['effects'] ?? [], $result['effects']);
      $eff = capEffects($eff, $result['resourceHad']);
      return [
        'eventKey' => $eventKey, 'text' => $text . ' → ' . implode(' → ', $result['texts']),
        'type' => $template['type'], 'effects' => $eff,
        'decision' => $result['texts'][0],
        'resourceCost' => $result['resourceCost'], 'resourceHad' => $result['resourceHad'] ? 1 : 0,
      ];
    }
  }

  // 2. Text categories
  $textPool = $catData[$category]['texts'] ?? [];
  if (!empty($textPool)) {
    $baseText = substitute($textPool[array_rand($textPool)], $zoneDesc, $faction);
    $branchType = ['faction' => 'neutral', 'special' => 'discovery', 'branching' => 'neutral', 'trap' => 'danger', 'anomaly' => 'danger', 'npc' => 'neutral', 'rest' => 'heal'][$category] ?? $category;
    $autoTemplate = ['type' => $branchType];
    $autoBranch = getAutoBranch($autoTemplate, $zoneDesc);
    if ($autoBranch) {
      $result = resolveBranch($autoBranch, $zone, $playerLevel, $items);
      $eff = $result['effects'];
      $eff = capEffects($eff, $result['resourceHad']);
      return [
        'eventKey' => $eventKey, 'text' => $baseText . ' → ' . implode(' → ', $result['texts']),
        'type' => $category, 'effects' => $eff,
        'decision' => $result['texts'][0],
        'resourceCost' => $result['resourceCost'], 'resourceHad' => $result['resourceHad'] ? 1 : 0,
      ];
    }
    return [
      'eventKey' => $eventKey, 'text' => $baseText, 'type' => $category,
      'effects' => [], 'decision' => null, 'resourceCost' => null, 'resourceHad' => 0,
    ];
  }

  // 3. Fallback
  return [
    'eventKey' => $eventKey,
    'text' => substitute('Ты бредёшь по {zone} в тишине. Ничего особенного.', $zoneDesc, $faction),
    'type' => 'neutral', 'effects' => [], 'decision' => null, 'resourceCost' => null, 'resourceHad' => 0,
  ];
}

function capEffects($effects, $hadResource) {
  if (isset($effects['healPercent']) && $effects['healPercent'] > 0) {
    $effects['healPercent'] = min($effects['healPercent'], $hadResource ? 0.15 : 0.05);
  }
  if (isset($effects['damagePercent']) && $effects['damagePercent'] > 0) {
    $effects['damagePercent'] = min($effects['damagePercent'], $hadResource ? 0.15 : 0.30);
  }
  return $effects;
}
