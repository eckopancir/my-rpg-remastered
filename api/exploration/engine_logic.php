<?php
require_once __DIR__ . '/engine_config.php';
require_once __DIR__ . '/event_data.php';
require_once __DIR__ . '/legendary_data.php';
require_once __DIR__ . '/engine_loot.php';

const TRAVEL_OUT_TICKS = 120;
const EXPLORE_TICKS = 180;
const TRAVEL_BACK_TICKS = 3600;
// Редкий темп (было тестово-часто: 12-25с / 5-8с):
// крупные ~2/час, микро раз в 8-12 мин.
const EVENT_COOLDOWN_MIN = 1500;
const EVENT_COOLDOWN_MAX = 2100;
const MICRO_COOLDOWN_MIN = 480;
const MICRO_COOLDOWN_MAX = 720;
const MAX_TICKS_PER_POLL = 60;
// Шанс запуска легендарной цепочки на каждом крупном событии, %.
// 2 крупных/час → ~12 за 6 часов → ~1 легендарка за 6 часов. Только если
// нет активной цепочки. Латч has_triggered_legendary больше не используется.
const LEGENDARY_CHANCE_PCT = 8;
// Шанс дропа предмета на каждом этапе легендарки (успех и финал, не фейл).
// Роллится поверх наград этапа: +1 предмет к itemCount.
// Сам предмет генерирует клиент из общего пула (редкость 33/33/34).
const LEGENDARY_ITEM_CHANCE_PCT = 25;
// Этап активной цепочки — раз в столько секунд, строго подряд:
// пока идёт легендарка, микро и крупные события на паузе.
const LEGENDARY_STAGE_EVERY_SEC = 60;
// Маркер версии движка — виден в ответе status.php, чтобы сразу понимать,
// какой код реально крутится на сервере.
const ENGINE_VERSION = 'bulk-v4.1-chunked';
// Остаток непокрытых тиков сверх этого порога не расписываем построчно,
// а агрегируем в одно сводное событие (иначе за 6–10ч офлайна копятся
// тысячи строк и клиент виснет на их загрузке/рендере).
const BULK_CATCHUP_SEC = 300;
// Кап строк лога на одну экспедицию (прунинг старых микро-событий).
const MAX_EVENTS_PER_EXP = 1000;
// Бюджет времени одного bulk-прохода, сек. При исчерпании коммитим
// обработанную часть и продолжаем следующим поллом (чанки) — вместо
// all-or-nothing, который max_execution_time убивает целиком с rollback.
const BULK_TIME_BUDGET_SEC = 15;
// Максимум предметов в одной строке offline_rewards: клиент материализует
// награду одним POST'ом в save_items.php, сотни за раз вешают стор и упираются в лимит.
const OFFLINE_REWARD_CHUNK = 20;

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
// Offline reward creation
// ---------------------------------------------------------------------------
function createOfflineReward($pdo, $userId, $expId, $eventId, $eventText, $eventType, $itemCount, $playerLevel, $effectsArr, $itemPool = null) {
  if ($itemCount <= 0) return;
  // Крупные суммы (например, bulk-сводка за сутки) режем на чанки, иначе
  // клиент попытается сгенерировать и POST'нуть сотни предметов одним
  // запросом: save_items.php режет по лимиту, стор лагает на генерации.
  // event_id чанков деривируем со сдвигом: в таблице UNIQUE(user,exp,event),
  // а диапазон 1e9+ реальными id событий не достижим.
  $eventId = (int)$eventId;
  $chunks = array_fill(0, (int)ceil($itemCount / OFFLINE_REWARD_CHUNK), OFFLINE_REWARD_CHUNK);
  $chunks[count($chunks) - 1] = $itemCount - OFFLINE_REWARD_CHUNK * (count($chunks) - 1);
  $rewardData = json_encode([
    'source' => 'travel',
    'event_type' => $eventType,
    'effects' => $effectsArr,
    'itemPool' => $itemPool,
  ], JSON_UNESCAPED_UNICODE);
  $stmt = $pdo->prepare("INSERT INTO offline_rewards (user_id, exploration_id, event_id, event_text, item_count, player_level, generation_version, reward_data)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)");
  foreach ($chunks as $i => $n) {
    $chunkEventId = $i === 0 ? $eventId : $eventId + 1000000000 + $i;
    $stmt->execute([$userId, $expId, $chunkEventId, $eventText, (int)$n, $playerLevel, $rewardData]);
  }
}

// ---------------------------------------------------------------------------
// Core: process ticks for an exploration
// ---------------------------------------------------------------------------
function processTicks($pdo, $userId, $maxTicks = MAX_TICKS_PER_POLL) {
  $procStart = microtime(true);
  // Transaction + row lock prevents race conditions when multiple requests
  // (e.g. overlapping setInterval polls, multiple tabs) try to process the
  // same time window, which would double-count ticks and speed up exploration.
  $pdo->beginTransaction();
  try {
    $stmt = $pdo->prepare("SELECT * FROM explorations WHERE user_id = ? AND phase NOT IN ('complete','idle') ORDER BY id DESC LIMIT 1 FOR UPDATE");
    $stmt->execute([$userId]);
    $exp = $stmt->fetch();
    if (!$exp) { $pdo->rollBack(); return null; }
    if (!isset($exp['total_items'])) $exp['total_items'] = 0;

    $dbNow = $pdo->query("SELECT UNIX_TIMESTAMP(NOW(3)) AS dbts")->fetch();
    $dbNowSec = (int)$dbNow['dbts'];
    $dbLastTick = $pdo->prepare("SELECT UNIX_TIMESTAMP(?) AS dbts");
    $dbLastTick->execute([$exp['last_tick_at']]);
    $dbLastTickSec = (int)$dbLastTick->fetch()['dbts'];
    $lastTickSec = $exp['last_tick_at'] ? $dbLastTickSec : $dbNowSec;
    $elapsedSec = max(0, $dbNowSec - $lastTickSec);
    $expId = $exp['id'];
    $ticksToProcess = min($elapsedSec, $maxTicks);
    if ($ticksToProcess <= 0) {
      $pdo->commit();
      return buildStatus($pdo, $exp, [], null, [
        'engine_version' => ENGINE_VERSION,
        'debtSec' => $elapsedSec,
        'bulkMode' => 'none',
        'processing_ms' => (int)round((microtime(true) - $procStart) * 1000),
      ]);
    }

    $events = [];
    $zoneDesc = getZoneDesc($exp['zone']);

    $sd = getSaveData($pdo, $userId);
    $regenPerTick = (int)($sd['player']['stats']['regen'] ?? 0);
    $playerLevel = getPlayerLevel($pdo, $userId);

    $died = false;
    for ($i = 0; $i < $ticksToProcess; $i++) {
    // Passive regen per tick
    if ($regenPerTick > 0) {
      applyEffects($pdo, $userId, ['flatHeal' => $regenPerTick]);
    }

    // --- Phase transitions ---
    if ($exp['phase'] === 'travel_out') {
      $exp['time_left'] = (int)$exp['time_left'] - 1;
      if ($exp['time_left'] <= 0) {
        $exp['phase'] = 'exploring';
        // Плановая длительность слайдера (2-24ч); legacy-строкам без неё — старый фолбэк.
        $exp['time_left'] = !empty($exp['planned_sec']) ? (int)$exp['planned_sec'] : EXPLORE_TICKS;
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
        $died = true;
        break;
      }

      // Время вышло → дорога домой (конечный run, без бесконечного ресета).
      // Бонус за длительность — только за полную зачистку, не за cancel.
      if ($exp['time_left'] <= 0) {
        $exp['phase'] = 'travel_back';
        $exp['time_left'] = TRAVEL_BACK_TICKS;
        $exp['was_cancelled'] = 0;
      }

      // Активная легендарная цепочка: всё остальное на паузе,
      // этапы идут строго подряд — один в минуту.
      if ($exp['legendary_id']) {
        $exp['legendary_auto_resolve'] = (int)($exp['legendary_auto_resolve'] ?? 0) + 1;
        if ($exp['legendary_auto_resolve'] >= LEGENDARY_STAGE_EVERY_SEC) {
          $exp['legendary_auto_resolve'] = 0;
          $legEvent = resolveLegendaryStage($pdo, $userId, $exp, $zoneDesc);
          $exp['legendary_auto_resolve'] = 0;
          if ($legEvent) {
            $events[] = $legEvent;
            saveEvent($pdo, $userId, $expId, $legEvent);
            $legEff = json_decode($legEvent['effects'], true);
            if (isset($legEff['itemCount']) && $legEff['itemCount'] > 0) {
              $eventId = $pdo->lastInsertId();
              createOfflineReward($pdo, $userId, $expId, $eventId, $legEvent['text'], $legEvent['type'], (int)$legEff['itemCount'], $playerLevel, $legEff);
            }
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
        // Micro events never generate items
        unset($me['effects']['itemCount']);
        $exp['total_items'] = (int)$exp['total_items'] + (int)($me['effects']['itemCount'] ?? 0);
        $exp['total_chips'] = (int)$exp['total_chips'] + (int)($me['effects']['chips'] ?? 0);
        $exp['total_exp'] = (int)$exp['total_exp'] + (int)($me['effects']['exp'] ?? 0);
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

      // Big events (активная цепочка сюда не доходит — она выше ставит continue).
      $exp['event_cooldown'] = (int)$exp['event_cooldown'] - 1;
      if ($exp['event_cooldown'] <= 0) {
        // Ролл запуска новой цепочки (~1 за 6 часов при 2 событиях/час).
        if (mt_rand(1, 100) <= LEGENDARY_CHANCE_PCT) {
          $legEvents = getLegendaryEvents();
          $legKeys = array_keys($legEvents);
          if (!empty($legKeys)) {
            $pickedKey = $legKeys[array_rand($legKeys)];
            $legData = $legEvents[$pickedKey];
            $exp['legendary_id'] = $pickedKey;
            $exp['legendary_stage'] = 0;
            $exp['legendary_auto_resolve'] = 0;
            $exp['legendary_rewards'] = json_encode([]);
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
          // Флаг use_materials=0: события считают, что ресурсов нет
          // (пустой инвентарь → всегда no-resource ветки, ничего не списывается).
          $useMats = !isset($exp['use_materials']) || (int)$exp['use_materials'] === 1;
          $itemsRef = $useMats ? loadInventoryItems($pdo, $userId) : [];
          $origIds = $useMats ? array_column($itemsRef, 'id') : [];
          $factions = $exp['zone_factions'] ? json_decode($exp['zone_factions'], true) ?? [] : [];
          $event = generateEvent($exp['zone'], $playerLevel, $factions, $itemsRef, $exp['tick_count']);
          if (!empty($event['resourceHad'])) {
            persistInventoryItems($pdo, $userId, $itemsRef, $origIds);
          }
          $applyResult = applyEffects($pdo, $userId, $event['effects']);
          $exp['total_items'] = (int)$exp['total_items'] + $applyResult['count'];
          $exp['total_chips'] = (int)$exp['total_chips'] + (int)($event['effects']['chips'] ?? 0);
          $exp['total_exp'] = (int)$exp['total_exp'] + (int)($event['effects']['exp'] ?? 0);
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
          if ($applyResult['count'] > 0) {
            $eventId = $pdo->lastInsertId();
            createOfflineReward($pdo, $userId, $expId, $eventId, $event['text'], $event['type'], $applyResult['count'], $playerLevel, $event['effects'], $event['itemPool'] ?? null);
          }
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
        $natural = empty($exp['was_cancelled']);
        $outcome = $natural ? 'complete' : 'cancelled';
        // Бонус ступенями за полную зачистку (2-5ч +10%, 6-11ч +30%,
        // 12-17ч +60%, 18-24ч +100%). Досрочный возврат — без бонуса.
        if ($natural) {
          $pct = durationBonusPct((int)($exp['planned_sec'] ?? 0));
          if ($pct > 0) {
            $bChips = (int)floor((int)$exp['total_chips'] * $pct / 100);
            $bExp = (int)floor((int)$exp['total_exp'] * $pct / 100);
            if ($bChips !== 0 || $bExp > 0) {
              applyEffects($pdo, $userId, ['chips' => $bChips, 'exp' => $bExp]);
              $exp['total_chips'] = (int)$exp['total_chips'] + $bChips;
              $exp['total_exp'] = (int)$exp['total_exp'] + $bExp;
              $bonusEv = ['text' => "🏆 Бонус за полную зачистку (+{$pct}%): +{$bChips} чипов, +{$bExp} опыта.",
                'type' => 'system', 'effects' => json_encode(['chips' => $bChips, 'exp' => $bExp], JSON_UNESCAPED_UNICODE),
                'is_micro' => 0, 'tick_number' => $exp['tick_count']];
              $events[] = $bonusEv;
              saveEvent($pdo, $userId, $expId, $bonusEv);
            }
          }
        }
        $events[] = ['text' => '🏠 Вы вернулись на базу. Экспедиция завершена!', 'type' => 'system', 'effects' => '{}', 'is_micro' => 0, 'tick_number' => $exp['tick_count']];
        saveEvent($pdo, $userId, $expId, $events[count($events)-1]);
        saveExplorationHistory($pdo, $userId, $exp, $outcome);
      }
      $exp['tick_count']++;
      setExploreField($pdo, $expId, ['phase' => $exp['phase'], 'time_left' => $exp['time_left'], 'tick_count' => $exp['tick_count']]);
      continue;
    }

    break; // unknown phase
  }

  // Долгий офлайн: остаток тиков агрегируем сводкой вместо тысяч строк.
  // (Без этого догон 10ч = ~600 поллов по 60 тиков.)
  // Time-boxed чанки: bulk идёт пока хватает бюджета времени; при исчерпании
  // коммитим обработанную часть (last_tick_at сдвигается), остаток добирает
  // следующий полл. Так max_execution_time не может откатить всё в ноль.
  $remainingSec = $elapsedSec - $ticksToProcess;
  $bulkMode = 'none';
  if ($remainingSec > BULK_CATCHUP_SEC && !$died && $exp['phase'] === 'exploring') {
    $bulkDone = 0; $bulkComplete = false;
    processBulkCatchup($pdo, $userId, $exp, $expId, $playerLevel, $regenPerTick, $remainingSec,
      $events, $died, microtime(true) + BULK_TIME_BUDGET_SEC, $bulkDone, $bulkComplete);
    $ticksToProcess += $bulkDone;
    $bulkMode = $died ? 'dead' : ($bulkComplete ? 'complete' : 'partial');
  }
  $statusMeta = [
    'engine_version' => ENGINE_VERSION,
    // После смерти экспедиция завершена — долга нет (last_tick_at = now).
    'debtSec' => $died ? 0 : max(0, $elapsedSec - $ticksToProcess),
    'bulkMode' => $bulkMode,
    'processing_ms' => (int)round((microtime(true) - $procStart) * 1000),
  ];

  if ($died) {
    pruneOldEvents($pdo, $expId);
    $pdo->commit();
    return buildStatus($pdo, $exp, $events, 'dead', $statusMeta);
  }

  $fields = [
    'phase' => $exp['phase'],
    'time_left' => $exp['time_left'],
    'tick_count' => $exp['tick_count'],
    'event_cooldown' => $exp['event_cooldown'],
    'micro_event_cooldown' => $exp['micro_event_cooldown'],
    'was_cancelled' => (int)($exp['was_cancelled'] ?? 0),
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
  $ltStmt = $pdo->prepare("UPDATE explorations SET last_tick_at = DATE_ADD(last_tick_at, INTERVAL ? SECOND) WHERE id = ?");
  $ltStmt->execute([$ticksToProcess, $expId]);

  pruneOldEvents($pdo, $expId);
  $pdo->commit();
  $statusMeta['processing_ms'] = (int)round((microtime(true) - $procStart) * 1000);
  return buildStatus($pdo, $exp, $events, null, $statusMeta);
  } catch (Exception $e) {
    $pdo->rollBack();
    throw $e;
  }
}

// ---------------------------------------------------------------------------
// Bulk catch-up: долгий офлайн симулируем без построчных INSERT'ов.
// Реальная симуляция (те же generateEvent/resolveLegendaryStage), но в БД
// уходит ОДНА сводная строка + ОДНА оффлайн-награда. Награды применяются
// одним проходом, HP трекаем в памяти (со смертью — штатный путь).
// ---------------------------------------------------------------------------
function processBulkCatchup($pdo, $userId, &$exp, $expId, $playerLevel, $regenPerTick, $seconds, &$events, &$died, $deadline, &$bulkDone, &$bulkComplete) {
  $bulkDone = 0; $bulkComplete = false;
  $sd = getSaveData($pdo, $userId);
  $maxHp = max(1, (int)($sd['player']['stats']['maxHp'] ?? 100));
  $hp = (int)($sd['player']['stats']['currentHp'] ?? $maxHp);

  $bulkChips = 0; $bulkExp = 0; $bulkItems = 0;
  $microN = 0; $bigN = 0; $legN = 0;
  $itemPool = null;

  $zoneDesc = getZoneDesc($exp['zone']);
  // Флаг use_materials=0: bulk тоже считает инвентарь пустым.
  $useMatsBulk = !isset($exp['use_materials']) || (int)$exp['use_materials'] === 1;
  $itemsRef = $useMatsBulk ? loadInventoryItems($pdo, $userId) : [];
  $origIds = $useMatsBulk ? array_column($itemsRef, 'id') : [];
  $factions = $exp['zone_factions'] ? json_decode($exp['zone_factions'], true) ?? [] : [];
  $cdEvent = (int)($exp['event_cooldown'] ?? 0);
  $cdMicro = (int)($exp['micro_event_cooldown'] ?? 0);

  // Bulk покрывает только exploring-окно: если плановое время истекает
  // внутри bulk, остаток идёт countdown'ом travel_back (без событий).
  $tl = max(0, (int)($exp['time_left'] ?? 0));
  $simSec = min($seconds, $tl);

  for ($s = 0; $s < $simSec; $s++) {
    // Time-box: проверяем бюджет каждые 64 итерации (microtime дешёвый,
    // но незачем дёргать его на каждом тике). При исчерпании выходим —
    // caller закоммитит обработанную часть, остаток доберёт следующий полл.
    if (($s & 63) === 0 && microtime(true) >= $deadline) {
      break;
    }
    if ($regenPerTick > 0) $hp = min($maxHp, $hp + $regenPerTick);

    // Активная легендарная цепочка: остальное на паузе, этапы тихо —
    // один в минуту. Награды этапов уже применены внутри resolveLegendaryStage.
    if ($exp['legendary_id']) {
      $exp['legendary_auto_resolve'] = (int)($exp['legendary_auto_resolve'] ?? 0) + 1;
      if ($exp['legendary_auto_resolve'] >= LEGENDARY_STAGE_EVERY_SEC) {
        $exp['legendary_auto_resolve'] = 0;
        $row = resolveLegendaryStage($pdo, $userId, $exp, $zoneDesc);
        $exp['legendary_auto_resolve'] = 0;
        if ($row) {
          $legN++;
          $le = json_decode($row['effects'], true) ?: [];
          if (!empty($le['itemCount'])) $bulkItems += (int)$le['itemCount'];
        }
      }
    } else {
    // Микро: эффекты копим в памяти, строк не пишем.
    $cdMicro--;
    if ($cdMicro <= 0) {
      $me = generateMicroEvent($zoneDesc, '');
      if (!empty($me['effects']['healPercent'])) {
        $hp = min($maxHp, $hp + (int)round($maxHp * (float)$me['effects']['healPercent']));
      }
      $microN++;
      $cdMicro = RNG(MICRO_COOLDOWN_MIN, MICRO_COOLDOWN_MAX);
    }

    // Крупные в bulk: либо ролл запуска новой цепочки (8%),
    // либо обычное событие. Строк не пишем — всё уходит в сводку.
    $cdEvent--;
    if ($cdEvent <= 0) {
      if (mt_rand(1, 100) <= LEGENDARY_CHANCE_PCT) {
        $legEvents = getLegendaryEvents();
        $legKeys = array_keys($legEvents);
        if (!empty($legKeys)) {
          $pickedKey = $legKeys[array_rand($legKeys)];
          $exp['legendary_id'] = $pickedKey;
          $exp['legendary_stage'] = 0;
          $exp['legendary_auto_resolve'] = 0;
          $exp['legendary_rewards'] = json_encode([]);
          $legN++; // интро без наград: цепочка учтена, стадии — дальше по минутам
        }
      } else {
      $event = generateEvent($exp['zone'], $playerLevel, $factions, $itemsRef, $exp['tick_count']);
      $eff = $event['effects'] ?? [];
      $bulkChips += (int)($eff['chips'] ?? 0);
      $bulkExp += (int)($eff['exp'] ?? 0);
      if (!empty($eff['healPercent'])) $hp = min($maxHp, $hp + (int)round($maxHp * (float)$eff['healPercent']));
      if (!empty($eff['damagePercent'])) $hp = max(0, $hp - (int)round($maxHp * (float)$eff['damagePercent']));
      if (!empty($eff['itemCount'])) {
        $bulkItems += (int)$eff['itemCount'];
        if ($itemPool === null && !empty($event['itemPool'])) $itemPool = $event['itemPool'];
      }
      $bigN++;
      }
      $cdEvent = RNG(EVENT_COOLDOWN_MIN, EVENT_COOLDOWN_MAX);
    }
    }

    // Смерть в офлайне — штатный путь с откатом и историей.
    if ($hp <= 0) {
      $exp['total_chips'] = (int)$exp['total_chips'] + $bulkChips;
      $exp['total_exp'] = (int)$exp['total_exp'] + $bulkExp;
      $exp['total_items'] = (int)$exp['total_items'] + $bulkItems;
      // Потиковый счётчик уже инкрементился на каждой итерации цикла —
      // добавляем только текущий (фатальный) тик, иначе задвоение.
      $exp['tick_count'] += 1;
      $exp['event_cooldown'] = $cdEvent;
      $exp['micro_event_cooldown'] = $cdMicro;
      applyEffects($pdo, $userId, ['chips' => $bulkChips, 'exp' => $bulkExp]);
      persistInventoryItems($pdo, $userId, $itemsRef, $origIds);
      $summary = buildBulkSummary($s + 1, $microN, $bigN, $legN, $bulkChips, $bulkExp, $bulkItems, true);
      $events[] = $summary;
      saveEvent($pdo, $userId, $expId, $summary);
      handleExplorationDeath($pdo, $userId, $exp);
      $exp['phase'] = 'complete';
      $died = true;
      $bulkDone = $s + 1;
      $bulkComplete = true; // смерть завершает всё — продолжать нечего
      return;
    }

    $exp['tick_count']++;
  }
  $bulkDone = $s;
  // Конец exploring-окна внутри bulk: остаток секунд — countdown travel_back
  // без событий. Сводка ниже описывает только симулированную часть ($sumSec).
  $sumSec = $bulkDone;
  if ($tl > 0 && $tl <= $seconds) {
    $over = $seconds - $tl;
    $exp['phase'] = 'travel_back';
    $exp['time_left'] = max(1, TRAVEL_BACK_TICKS - $over);
    $exp['was_cancelled'] = 0;
    // Незавершённая цепочка гаснет вместе с окном (заработанные этапы уже выплачены).
    $exp['legendary_id'] = null;
    $exp['legendary_stage'] = null;
    $exp['legendary_auto_resolve'] = null;
    $exp['legendary_rewards'] = null;
    $exp['tick_count'] += $over;
    $bulkDone = $seconds;
    $bulkComplete = true;
    $sumSec = $tl;
  } else {
    $exp['time_left'] = $tl - $bulkDone;
    $bulkComplete = ($simSec > 0 && $bulkDone >= $simSec);
  }

  // Применяем накопленное (и на полном, и на частичном проходе).
  $exp['total_chips'] = (int)$exp['total_chips'] + $bulkChips;
  $exp['total_exp'] = (int)$exp['total_exp'] + $bulkExp;
  $exp['total_items'] = (int)$exp['total_items'] + $bulkItems;
  $exp['event_cooldown'] = $cdEvent;
  $exp['micro_event_cooldown'] = $cdMicro;
  if ($bulkChips !== 0 || $bulkExp > 0) {
    applyEffects($pdo, $userId, ['chips' => $bulkChips, 'exp' => $bulkExp]);
  }
  $curHp = getPlayerHp($pdo, $userId);
  if ($curHp !== $hp) {
    $sd2 = getSaveData($pdo, $userId);
    $sd2['player']['stats']['currentHp'] = $hp;
    putSaveData($pdo, $userId, $sd2);
  }
  persistInventoryItems($pdo, $userId, $itemsRef, $origIds);

  // Сводную строку и награду пишем ТОЛЬКО при полном закрытии долга —
  // иначе каждый чанк плодил бы по сводке.
  if (!$bulkComplete) {
    return;
  }

  $summary = buildBulkSummary($sumSec, $microN, $bigN, $legN, $bulkChips, $bulkExp, $bulkItems, false);
  $events[] = $summary;
  saveEvent($pdo, $userId, $expId, $summary);
  if ($bulkItems > 0) {
    $eventId = (int)$pdo->lastInsertId();
    createOfflineReward($pdo, $userId, $expId, $eventId, $summary['text'], 'loot', $bulkItems, $playerLevel,
      ['chips' => $bulkChips, 'exp' => $bulkExp, 'itemCount' => $bulkItems], $itemPool);
  }
}

function buildBulkSummary($seconds, $microN, $bigN, $legN, $chips, $exp, $items, $died) {
  $h = (int)floor($seconds / 3600);
  $m = (int)floor(($seconds % 3600) / 60);
  $dur = $h > 0 ? "{$h} ч {$m} мин" : "{$m} мин";
  $chipsStr = $chips >= 0 ? "+{$chips}" : "{$chips}";
  $text = $died
    ? "🌙 Пока вас не было ({$dur}): {$bigN} крупных событий, {$microN} мелких. Герой погиб в пустоши — экспедиция завершена."
    : "🌙 Пока вас не было ({$dur}): {$bigN} крупных событий, {$microN} мелких."
      . ($legN > 0 ? " Легендарных этапов: {$legN}." : "")
      . " Итог: {$chipsStr} чипов, +{$exp} опыта"
      . ($items > 0 ? ", находок: {$items}." : ".");
  return [
    'text' => $text,
    'type' => 'system',
    'effects' => json_encode(['chips' => $chips, 'exp' => $exp, 'itemCount' => $items], JSON_UNESCAPED_UNICODE),
    'is_micro' => 0,
    'tick_number' => 0,
    'decision' => null,
    'resource_cost' => null,
    'resource_had' => 0,
    'legendary_event_id' => null,
    'legendary_stage' => null,
  ];
}

// Прунинг: держим не больше MAX_EVENTS_PER_EXP строк на экспедицию.
function pruneOldEvents($pdo, $expId) {
  $cntStmt = $pdo->prepare("SELECT COUNT(*) AS c, MAX(id) AS m FROM exploration_events WHERE exploration_id = ?");
  $cntStmt->execute([$expId]);
  $row = $cntStmt->fetch();
  $count = (int)($row['c'] ?? 0);
  if ($count > MAX_EVENTS_PER_EXP + 200) {
    $threshold = (int)$row['m'] - MAX_EVENTS_PER_EXP;
    $del = $pdo->prepare("DELETE FROM exploration_events WHERE exploration_id = ? AND id <= ?");
    $del->execute([$expId, $threshold]);
  }
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
  $playerLevel = getPlayerLevel($pdo, $userId);
  if (empty($stage['text'])) {
    // Final stage — give final reward
    $fr = computeLegendaryReward($leg['fr_rw'], $playerLevel);
    $fr = rollLegendaryItemDrop($fr);
    $rewards = json_decode($exp['legendary_rewards'] ?? '{}', true) ?: [];
    $merged = mergeEffectsArr($rewards, $fr);
    $applyResult = applyEffects($pdo, $userId, $merged);
    $exp['total_items'] = (int)$exp['total_items'] + $applyResult['count'];
    $exp['total_chips'] = (int)$exp['total_chips'] + (int)($fr['chips'] ?? 0);
    $exp['total_exp'] = (int)$exp['total_exp'] + (int)($fr['exp'] ?? 0);
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
  $stageReward = computeLegendaryReward($stage['rw'], $playerLevel);
  $rewards = json_decode($exp['legendary_rewards'] ?? '{}', true) ?: [];

  if ($success) {
    $stageReward = rollLegendaryItemDrop($stageReward);
    $merged = mergeEffectsArr($rewards, $stageReward);
    $exp['legendary_rewards'] = json_encode($merged);
    $exp['legendary_stage'] = $stageIdx + 1;
    // Потикового auto-resolve больше нет: стадии идут по слотам крупных событий.
    $exp['legendary_auto_resolve'] = null;
    $applyResult = applyEffects($pdo, $userId, $stageReward);
    $exp['total_items'] = (int)$exp['total_items'] + $applyResult['count'];
    $exp['total_chips'] = (int)$exp['total_chips'] + (int)($stageReward['chips'] ?? 0);
    $exp['total_exp'] = (int)$exp['total_exp'] + (int)($stageReward['exp'] ?? 0);
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
  $dbNowRow = $pdo->query("SELECT NOW(3) AS dbnow")->fetch();
  setExploreFields($pdo, $exp['id'], ['phase' => 'complete', 'last_tick_at' => $dbNowRow['dbnow']]);
  saveExplorationHistory($pdo, $userId, $exp, 'dead');
}

// ---------------------------------------------------------------------------
// Exploration start
// ---------------------------------------------------------------------------
function startExploration($pdo, $userId, $zone, $hours = 12, $useMats = 1) {
  $zoneData = getZoneData($zone);
  $hours = max(EXP_MIN_HOURS, min(EXP_MAX_HOURS, (int)$hours));
  $plannedSec = $hours * 3600;
  $useMats = $useMats ? 1 : 0;
  $stmt = $pdo->prepare("INSERT INTO explorations (user_id, zone, zone_difficulty, zone_factions, is_infinite, phase, time_left, planned_sec, was_cancelled, use_materials, event_cooldown, micro_event_cooldown, has_triggered_legendary, last_tick_at, started_at)
    VALUES (?, ?, ?, ?, 0, 'travel_out', ?, ?, 0, ?, 0, 0, 0, NOW(3), NOW())");
  $stmt->execute([$userId, $zone, (int)($zoneData['difficulty'] ?? 1),
    json_encode($zoneData['allowedFactions'] ?? [], JSON_UNESCAPED_UNICODE),
    TRAVEL_OUT_TICKS, $plannedSec, $useMats]);
  $expId = $pdo->lastInsertId();

  return ['id' => $expId, 'phase' => 'travel_out', 'time_left' => TRAVEL_OUT_TICKS, 'is_infinite' => false, 'planned_sec' => $plannedSec, 'use_materials' => $useMats];
}

// ---------------------------------------------------------------------------
// Build status response
// ---------------------------------------------------------------------------
function buildStatus($pdo, $exp, $events, $forceState = null, $meta = []) {
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
    'engine_version' => $meta['engine_version'] ?? ENGINE_VERSION,
    'debtSec' => (int)($meta['debtSec'] ?? 0),
    'bulkMode' => $meta['bulkMode'] ?? 'none',
    'processing_ms' => (int)($meta['processing_ms'] ?? 0),
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
      'plannedSec' => (int)($exp['planned_sec'] ?? 0),
      'useMaterials' => !isset($exp['use_materials']) || (int)$exp['use_materials'] === 1,
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
  // Досрочный возврат — реальная дорога домой (час), без бонуса за зачистку.
  // История запишется по прибытии с исходом 'cancelled'.
  $upd = $pdo->prepare("UPDATE explorations SET phase = 'travel_back', time_left = ?, was_cancelled = 1 WHERE id = ?");
  $upd->execute([TRAVEL_BACK_TICKS, $exp['id']]);
  return ['success' => true, 'return_sec' => TRAVEL_BACK_TICKS];
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
  $flatHeal = isset($effects['flatHeal']) ? (int)$effects['flatHeal'] : 0;
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
  if ($flatHeal > 0) {
    $maxHp = $sd['player']['stats']['maxHp'] ?? 100;
    $cur = $sd['player']['stats']['currentHp'] ?? $maxHp;
    $sd['player']['stats']['currentHp'] = min($maxHp, $cur + $flatHeal);
    $changed = true;
  }
  if ($dmgPct > 0) {
    $maxHp = $sd['player']['stats']['maxHp'] ?? 100;
    $cur = $sd['player']['stats']['currentHp'] ?? $maxHp;
    $sd['player']['stats']['currentHp'] = max(0, $cur - (int)round($maxHp * $dmgPct));
    $changed = true;
  }
  if (isset($effects['itemCount']) && $effects['itemCount'] > 0) {
    $result['count'] = (int)$effects['itemCount'];
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

// 25% дроп предмета на этапе легендарки: +1 к itemCount.
// Вызывается для успеха и финала (фейл — этап потерян целиком).
function rollLegendaryItemDrop($effects) {
  if (mt_rand(1, 100) <= LEGENDARY_ITEM_CHANCE_PCT) {
    $effects['itemCount'] = (int)($effects['itemCount'] ?? 0) + 1;
  }
  return $effects;
}

// ---------------------------------------------------------------------------
// Inventory helpers (reused from earlier)
// ---------------------------------------------------------------------------
function loadInventoryItems($pdo, $userId) {
  $stmt = $pdo->prepare("SELECT id, name, quantity FROM inventory_items WHERE user_id = ? AND quantity > 0");
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
  global $HELP_TEXTS_RICH, $LOOT_TEXTS_RICH, $TRAP_TEXTS_RICH, $ITEM_TEXTS_RICH;
  return [
    'help' => ['texts' => [], 'rich' => $HELP_TEXTS_RICH ?? []],
    'loot' => ['texts' => [], 'rich' => $LOOT_TEXTS_RICH ?? []],
    'trap' => ['texts' => [], 'rich' => $TRAP_TEXTS_RICH ?? []],
    'item' => ['texts' => [], 'rich' => $ITEM_TEXTS_RICH ?? []],
  ];
}

const CATEGORY_WEIGHTS = [
  'help' => 27, 'loot' => 103, 'trap' => 29, 'item' => 15,
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

  // Rich events (any category with hand-crafted branches)
  if (!empty($catData[$category]['rich'])) {
    $template = $catData[$category]['rich'][array_rand($catData[$category]['rich'])];
    $text = substitute($template['text'], $zoneDesc, $faction);
    $branch = $template['branch'] ?? null;
    if ($branch) {
      $result = resolveBranch(['outcomes' => $branch['outcomes']], $zone, $playerLevel, $items);
      $eff = mergeEffectsArr($template['effects'] ?? [], $result['effects']);
      // Ловушки бьют редко (2/час), поэтому каждый удар весомый:
      // масштабируем урон в полосу 0.35-0.80 (без ресурса; с ресурсом
      // смягчение работает и capEffects режет сильнее).
      if (($template['type'] ?? '') === 'trap' && !empty($eff['damagePercent']) && $eff['damagePercent'] > 0) {
        $eff['damagePercent'] = $eff['damagePercent'] * TRAP_DAMAGE_MULT;
        if (empty($result['resourceHad'])) {
          $eff['damagePercent'] = max($eff['damagePercent'], TRAP_DAMAGE_MIN);
        }
      }
      $eff = capEffects($eff, $result['resourceHad']);
      return [
        'eventKey' => $eventKey, 'text' => $text . ' → ' . implode(' → ', $result['texts']),
        'type' => $template['type'], 'effects' => $eff,
        'decision' => $result['texts'][0],
        'resourceCost' => $result['resourceCost'], 'resourceHad' => $result['resourceHad'] ? 1 : 0,
        'itemPool' => $template['itemPool'] ?? null,
      ];
    }
  }

  // Fallback
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
    // Редкие удары (ловушки раз в ~30 мин) — весомые: до 0.80 без ресурса.
    $effects['damagePercent'] = min($effects['damagePercent'], $hadResource ? 0.50 : 0.80);
  }
  return $effects;
}

// Масштабирование урона ловушек в полосу TRAP_DAMAGE_MIN..0.80.
const TRAP_DAMAGE_MULT = 4;
const TRAP_DAMAGE_MIN = 0.35;
