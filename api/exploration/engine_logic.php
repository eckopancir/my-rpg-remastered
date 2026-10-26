<?php
require_once __DIR__ . '/engine_config.php';
require_once __DIR__ . '/difficulty.php';
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

// --- Профиль дропа из путешествия ---
// 30% находок — снаряжение, 70% — ресурсы/патроны/расходники.
// Снаряжение ограничено потолком качества и редкости: находка из пути
// не должна быть сильнее добычи с боссов.
define('TRAVEL_GEAR_CHANCE_PCT', 30);
define('TRAVEL_MICRO_ITEM_PCT', 10);
define('TRAVEL_QUALITY_CAP', 'Раритетный');

// Темп симуляции: 1 = реальное время (крупные события ~2/час, микро раз в
// 8-12 мин, этап легендарки — раз в минуту). Баланс урона в пути посчитан
// именно под этот темп, поэтому ускорение здесь ломает баланс:
// 1 = боевой темп, >1 = только для отладки.
define('TRAVEL_TEST_SPEED', 1);
define('TRAVEL_TEST_SPEED_MICRO', 1);
define('TRAVEL_TEST_SPEED_LEG', 1);

/** Тестовая скорость: перевести секунды симуляции в «ускоренные». */
function travelSpeed($sec) {
  return max(1, (int)round($sec / TRAVEL_TEST_SPEED));
}

/** Тестовая скорость для микро-событий. */
function travelSpeedMicro($sec) {
  return max(1, (int)round($sec / TRAVEL_TEST_SPEED_MICRO));
}

/** Тестовая скорость для этапов легендарной цепочки. */
function travelSpeedLeg($sec) {
  return max(1, (int)round($sec / TRAVEL_TEST_SPEED_LEG));
}
const MAX_TICKS_PER_POLL = 60;
// ТЕСТ: сколько крупных событий прогенерировать сразу при старте рейда.
// Отключено: тестовый показ ленты больше не нужен. Включается числом (10 и т.п.).
const TRAVEL_TEST_START_EVENTS = 0;
// Шанс запуска легендарной цепочки на каждом крупном событии, %.
// 2 крупных/час → ~12 за 6 часов → при 3% примерно 1 легендарка за ~16 часов.
// Только если нет активной цепочки. Латч has_triggered_legendary больше не используется.
const LEGENDARY_CHANCE_PCT = 3;
// Предметы с этапов легендарки убраны: вместо них в конце цепочки (финал или
// фейл) выдаётся один сундук, качество — пропорцией от пройденных этапов
// (1 этап — Обычный, все — Божественный). Уровень сундука фиксируется.
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
// ---------------------------------------------------------------------------
// Профиль награды из путешествия.
// Сервер решает характер дропа (пул, потолки, количество) — клиент только
// материализует предмет по профилю из reward_data.
// ---------------------------------------------------------------------------
function travelRewardProfile($playerLevel, $zoneDifficulty, $itemPool = null, $qualityCap = null) {
  $forcedGear = ($itemPool !== null && $itemPool !== '');
  $isGear = $forcedGear || (mt_rand(1, 100) <= TRAVEL_GEAR_CHANCE_PCT);
  if ($isGear) {
    $roll = mt_rand(1, 100);
    $rarity = $roll <= 70 ? 'normal' : ($roll <= 95 ? 'epic' : 'superepic');
    $lvl = max(1, min((int)$playerLevel, max(1, (int)$zoneDifficulty + 2)));
    return [
      'pool' => 'gear',
      'slot' => $forcedGear ? $itemPool : null,
      'rarity' => $rarity,
      'qualityCap' => $qualityCap ?: TRAVEL_QUALITY_CAP,
      'itemLevel' => $lvl,
      'qty' => 1,
    ];
  }
  $kindRoll = mt_rand(1, 100);
  $kind = $kindRoll <= 60 ? 'material' : ($kindRoll <= 85 ? 'ammo' : 'consumable');
  $qty = $kind === 'ammo' ? mt_rand(6, 18) : ($kind === 'consumable' ? mt_rand(1, 2) : mt_rand(2, 5));
  return [
    'pool' => 'resource',
    'kind' => $kind,
    'itemLevel' => 1,
    'qty' => $qty,
  ];
}

function createOfflineReward($pdo, $userId, $expId, $eventId, $eventText, $eventType, $itemCount, $playerLevel, $effectsArr, $itemPool = null, $chest = null, $profile = null) {
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
    'chest' => $chest,
    'profile' => $profile,
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
    // Баффы рюкзака (сгораемые расходники): реген добавляется к тиковому.
    $buffs = expeditionBuffs($exp['consumables'] ?? null);
    $regenPerTick += (int)($buffs['regen'] ?? 0);
    // Сложность рейда и его модификатор (характер).
    $difficulty = travelDifficulty($exp['difficulty'] ?? 'normal');
    $modifier = travelModifier($exp['modifier'] ?? null);
    $regenPerTick = (int)round($regenPerTick * (float)($modifier['regen'] ?? 1));
    $legChancePct = LEGENDARY_CHANCE_PCT + ($buffs['legPct'] ?? 0) * 100 + (float)($modifier['legChance'] ?? 0);

    $died = false;
    for ($i = 0; $i < $ticksToProcess; $i++) {
    // Passive regen — раз в минуту (tick_count персистентен между поллами,
    // поэтому фаза не плывёт). Кроме арены тут ничего нет.
    if ($regenPerTick > 0 && ((($exp['tick_count'] + 1) % 60) === 0)) {
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
        // Топливо из рюкзака сокращает возврат (returnMult, пол −50%).
        $exp['time_left'] = travelSpeed((int)round(TRAVEL_BACK_TICKS * ($buffs['returnMult'] ?? 1.0) * (float)($modifier['returnTime'] ?? 1.0)));
        $exp['was_cancelled'] = 0;
      }

      // Активная легендарная цепочка: этапы идут по своему таймеру
      // (один в минуту), обычные события при этом НЕ останавливаются.
      if ($exp['legendary_id']) {
        $exp['legendary_auto_resolve'] = (int)($exp['legendary_auto_resolve'] ?? 0) + 1;
        if ($exp['legendary_auto_resolve'] >= travelSpeedLeg(LEGENDARY_STAGE_EVERY_SEC)) {
          $exp['legendary_auto_resolve'] = 0;
          $legEvent = resolveLegendaryStage($pdo, $userId, $exp, $zoneDesc, $buffs);
          if ($legEvent) {
            // В ленту — усиленные баффом числа (как реально получили).
            $legEvent['effects'] = json_encode(effectsWithBuffs(json_decode($legEvent['effects'], true) ?: [], $buffs), JSON_UNESCAPED_UNICODE);
            $events[] = $legEvent;
            saveEvent($pdo, $userId, $expId, $legEvent);
            $legEff = json_decode($legEvent['effects'], true);
            if (isset($legEff['itemCount']) && $legEff['itemCount'] > 0) {
              $eventId = $pdo->lastInsertId();
              // Награда легендарки — сильнее обычной находки, но с потолком.
              createOfflineReward($pdo, $userId, $expId, $eventId, $legEvent['text'], $legEvent['type'], (int)$legEff['itemCount'], $playerLevel, $legEff, null, null,
                travelRewardProfile($playerLevel, $exp['zone_difficulty'], null, travelQualityCap($difficulty, $modifier)));
            }
          }
        }
      }

      // Micro events
      $exp['micro_event_cooldown'] = (int)$exp['micro_event_cooldown'] - 1;
      if ($exp['micro_event_cooldown'] <= 0) {
        $me = generateMicroEvent($zoneDesc, '');
        // %-эффекты микро -> числовые HP + множители сложности/модификатора.
        $me['effects'] = applyTravelScaling($me['effects'], $playerLevel, trapDmgBand((int)($exp['planned_sec'] ?? 0)), $difficulty, $modifier);
        // 10% микро-событий приносит мелочь (ресурсы/патроны).
        $microItem = (mt_rand(1, 100) <= TRAVEL_MICRO_ITEM_PCT) ? 1 : 0;
        if ($microItem > 0) $me['effects']['itemCount'] = $microItem;
        $applyResult = applyEffects($pdo, $userId, $me['effects'], $buffs);
        $exp['total_items'] = (int)$exp['total_items'] + $applyResult['count'];
        $exp['total_chips'] = (int)$exp['total_chips'] + $applyResult['appliedChips'];
        $exp['total_exp'] = (int)$exp['total_exp'] + $applyResult['appliedExp'];
        $meEvent = [
          'text' => $me['text'],
          'type' => $me['type'],
          'effects' => json_encode(effectsWithBuffs($me['effects'], $buffs)),
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
        if ($microItem > 0) {
          $microEventId = (int)$pdo->lastInsertId();
          createOfflineReward($pdo, $userId, $expId, $microEventId, $meEvent['text'], $meEvent['type'], $microItem,
            $playerLevel, $me['effects'], null, null,
            travelRewardProfile($playerLevel, $exp['zone_difficulty'], null));
        }
        $exp['micro_event_cooldown'] = travelSpeedMicro(RNG(MICRO_COOLDOWN_MIN, MICRO_COOLDOWN_MAX));
      }

      // Big events (активная цепочка сюда не доходит — она выше ставит continue).
      $exp['event_cooldown'] = (int)$exp['event_cooldown'] - 1;
      if ($exp['event_cooldown'] <= 0) {
        // Ролл запуска новой цепочки (3% + бонус рюкзака).
        if (mt_rand(1, 100) <= $legChancePct) {
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
              'legendary_title' => $legData['title'] ?? $pickedKey,
              'legendary_stage' => 0,
              'legendary_result' => null,
            ];
            saveEvent($pdo, $userId, $expId, $events[count($events)-1]);
          }
        } else {
          // Regular event: исход выбирается случайно (веса 20/20/20/20/15),
          // эффекты применяются сразу и попадают в строку события.
          // Ресурсы в пути не тратятся — инвентарь не трогаем.
          $itemsRef = [];
          $factions = $exp['zone_factions'] ? json_decode($exp['zone_factions'], true) ?? [] : [];
          $event = generateEvent($exp['zone'], $playerLevel, $factions, $itemsRef, $exp['tick_count'], trapDmgBand((int)($exp['planned_sec'] ?? 0)), $difficulty, $modifier);
          $applyResult = applyEffects($pdo, $userId, $event['effects'], $buffs);
          $exp['total_items'] = (int)$exp['total_items'] + $applyResult['count'];
          $exp['total_chips'] = (int)$exp['total_chips'] + $applyResult['appliedChips'];
          $exp['total_exp'] = (int)$exp['total_exp'] + $applyResult['appliedExp'];
          $ev = [
            'text' => $event['text'],
            'type' => $event['type'],
            'effects' => json_encode(effectsWithBuffs($event['effects'], $buffs)),
            'is_micro' => 0,
            'tick_number' => $exp['tick_count'],
            'art' => $event['art'] ?? null,
            'decision' => $event['decision'],
            'resource_cost' => null,
            'resource_had' => 0,
            'legendary_event_id' => null,
            'legendary_stage' => null,
          ];
          $events[] = $ev;
          saveEvent($pdo, $userId, $expId, $ev);
          if ($applyResult['count'] > 0) {
            $eventId = $pdo->lastInsertId();
            createOfflineReward($pdo, $userId, $expId, $eventId, $event['text'], $event['type'], $applyResult['count'], $playerLevel, $event['effects'], $event['itemPool'] ?? null, null,
              travelRewardProfile($playerLevel, $exp['zone_difficulty'], $event['itemPool'] ?? null, travelQualityCap($difficulty, $modifier)));
          }
        }
        $exp['event_cooldown'] = max(1, (int)round(travelSpeed(RNG(EVENT_COOLDOWN_MIN, EVENT_COOLDOWN_MAX)) / (float)($modifier['eventRate'] ?? 1)));
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
  // Ресурсы в пути не тратятся — инвентарь не трогаем.
  // Баффы рюкзака в bulk: копим СЫРЫЕ значения (как в строках событий),
  // баффы применяются один раз в финальном applyEffects — иначе задвоение.
  $bBuffs = expeditionBuffs($exp['consumables'] ?? null);
  $bChipsMult = 1 + (float)($bBuffs['chipsPct'] ?? 0);
  $bExpMult = 1 + (float)($bBuffs['expPct'] ?? 0);
  $bHealMult = 1 + (float)($bBuffs['healPct'] ?? 0);
  $bDmgMult = (float)($bBuffs['dmgTakenMult'] ?? 1.0);
  $bLegChance = LEGENDARY_CHANCE_PCT + ($bBuffs['legPct'] ?? 0) * 100;
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
    // Реген раз в минуту (внутри bulk фаза не важна — ровно 1/60 темп).
    if ($regenPerTick > 0 && ((($s + 1) % 60) === 0)) $hp = min($maxHp, $hp + $regenPerTick);

    // Активная легендарная цепочка: этапы тихо идут по своему таймеру
    // (один в минуту). Обычные события при этом не останавливаются.
    if ($exp['legendary_id']) {
      $exp['legendary_auto_resolve'] = (int)($exp['legendary_auto_resolve'] ?? 0) + 1;
      if ($exp['legendary_auto_resolve'] >= travelSpeedLeg(LEGENDARY_STAGE_EVERY_SEC)) {
        $exp['legendary_auto_resolve'] = 0;
        $row = resolveLegendaryStage($pdo, $userId, $exp, $zoneDesc, $bBuffs);
        if ($row) {
          $legN++;
          $le = json_decode($row['effects'], true) ?: [];
          if (!empty($le['itemCount'])) $bulkItems += (int)$le['itemCount'];
        }
      }
    }

    // Микро: эффекты копим в памяти, строк не пишем.
    // HP трекаем с баффами (как applyEffects), суммы — сырые (бафф разово в конце).
    $cdMicro--;
    if ($cdMicro <= 0) {
      $me = generateMicroEvent($zoneDesc, '');
      $me['effects'] = applyTravelScaling($me['effects'], $playerLevel, trapDmgBand((int)($exp['planned_sec'] ?? 0)), $difficulty, $modifier);
      // Числовой хил (в HP) — applyTravelScaling уже перевёл % в HP.
      if (!empty($me['effects']['heal'])) {
        $hp = min($maxHp, $hp + (int)round((int)$me['effects']['heal'] * $bHealMult));
      }
      $microN++;
      $cdMicro = travelSpeedMicro(RNG(MICRO_COOLDOWN_MIN, MICRO_COOLDOWN_MAX));
    }

    // Крупные в bulk: либо ролл запуска новой цепочки (3%),
    // либо обычное событие. Строк не пишем — всё уходит в сводку.
    $cdEvent--;
    if ($cdEvent <= 0) {
      if (mt_rand(1, 100) <= $bLegChance) {
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
      $bulkItemsRef = [];
      $event = generateEvent($exp['zone'], $playerLevel, $factions, $bulkItemsRef, $exp['tick_count'], trapDmgBand((int)($exp['planned_sec'] ?? 0)), $difficulty, $modifier);
      $eff = $event['effects'] ?? [];
      $bulkChips += (int)($eff['chips'] ?? 0);
      $bulkExp += (int)($eff['exp'] ?? 0);
      // Числовые HP (applyTravelScaling уже перевёл % в HP).
      if (!empty($eff['heal'])) $hp = min($maxHp, $hp + (int)round((int)$eff['heal'] * $bHealMult));
      if (!empty($eff['damage'])) {
        $dmg = (int)round((int)$eff['damage'] * $bDmgMult);
        $dmg = min($dmg, (int)round($maxHp * 0.95));
        $hp = max(0, $hp - $dmg);
      }
      if (!empty($eff['itemCount'])) {
        $bulkItems += (int)$eff['itemCount'];
        if ($itemPool === null && !empty($event['itemPool'])) $itemPool = $event['itemPool'];
      }
      $bigN++;
      }
      $cdEvent = max(1, (int)round(travelSpeed(RNG(EVENT_COOLDOWN_MIN, EVENT_COOLDOWN_MAX)) / (float)($modifier['eventRate'] ?? 1)));
    }

    // Смерть в офлайне — штатный путь с откатом и историей.
    // Баффы применяются разово здесь; тоталы — из применённого (иначе откат разойдётся).
    if ($hp <= 0) {
      $arDeath = applyEffects($pdo, $userId, ['chips' => $bulkChips, 'exp' => $bulkExp], $bBuffs);
      $exp['total_chips'] = (int)$exp['total_chips'] + $arDeath['appliedChips'];
      $exp['total_exp'] = (int)$exp['total_exp'] + $arDeath['appliedExp'];
      $exp['total_items'] = (int)$exp['total_items'] + $bulkItems;
      // Потиковый счётчик уже инкрементился на каждой итерации цикла —
      // добавляем только текущий (фатальный) тик, иначе задвоение.
      $exp['tick_count'] += 1;
      $exp['event_cooldown'] = $cdEvent;
      $exp['micro_event_cooldown'] = $cdMicro;
      $summary = buildBulkSummary($s + 1, $microN, $bigN, $legN, $arDeath['appliedChips'], $arDeath['appliedExp'], $bulkItems, true);
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
    $backTotal = travelSpeed((int)round(TRAVEL_BACK_TICKS * ($bBuffs['returnMult'] ?? 1.0) * (float)($modifier['returnTime'] ?? 1.0)));
    $exp['time_left'] = max(1, $backTotal - $over);
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
  // Суммы сырые, бафф — разово здесь; тоталы — из применённого.
  $arBulk = ['appliedChips' => 0, 'appliedExp' => 0];
  if ($bulkChips !== 0 || $bulkExp > 0) {
    $arBulk = applyEffects($pdo, $userId, ['chips' => $bulkChips, 'exp' => $bulkExp], $bBuffs);
  }
  $exp['total_chips'] = (int)$exp['total_chips'] + $arBulk['appliedChips'];
  $exp['total_exp'] = (int)$exp['total_exp'] + $arBulk['appliedExp'];
  $exp['total_items'] = (int)$exp['total_items'] + $bulkItems;
  $exp['event_cooldown'] = $cdEvent;
  $exp['micro_event_cooldown'] = $cdMicro;
  $curHp = getPlayerHp($pdo, $userId);
  if ($curHp !== $hp) {
    $sd2 = getSaveData($pdo, $userId);
    $sd2['player']['stats']['currentHp'] = $hp;
    putSaveData($pdo, $userId, $sd2);
  }

  // Сводную строку и награду пишем ТОЛЬКО при полном закрытии долга —
  // иначе каждый чанк плодил бы по сводке.
  if (!$bulkComplete) {
    return;
  }

  $summary = buildBulkSummary($sumSec, $microN, $bigN, $legN, $bulkChips, $bulkExp, $bulkItems, false);
  $summary['effects'] = json_encode(effectsWithBuffs(json_decode($summary['effects'], true) ?: [], $bBuffs), JSON_UNESCAPED_UNICODE);
  $events[] = $summary;
  saveEvent($pdo, $userId, $expId, $summary);
  if ($bulkItems > 0) {
    $eventId = (int)$pdo->lastInsertId();
    createOfflineReward($pdo, $userId, $expId, $eventId, $summary['text'], 'loot', $bulkItems, $playerLevel,
      ['chips' => $bulkChips, 'exp' => $bulkExp, 'itemCount' => $bulkItems], $itemPool, null,
      travelRewardProfile($playerLevel, $exp['zone_difficulty'] ?? 1, $itemPool));
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
/** Множитель награды за сложность рейда (легендарные этапы). */
function travelScaleRewards($reward, $exp) {
  if (!is_array($reward)) return $reward;
  $mult = (float)(travelDifficulty($exp['difficulty'] ?? 'normal')['rewardMult'] ?? 1);
  if (isset($reward['chips']) && $reward['chips'] > 0) $reward['chips'] = (int)round($reward['chips'] * $mult);
  if (isset($reward['exp']) && $reward['exp'] > 0) $reward['exp'] = (int)round($reward['exp'] * $mult);
  return $reward;
}

function resolveLegendaryStage($pdo, $userId, &$exp, $zoneDesc, $buffs = []) {
  $allLegends = getLegendaryEvents();
  $legKey = $exp['legendary_id'];
  if (!isset($allLegends[$legKey])) {
    // Цепочка неизвестна — закрываем её, иначе путешествие встанет.
    $exp['legendary_id'] = null;
    $exp['legendary_stage'] = null;
    $exp['legendary_auto_resolve'] = null;
    $exp['legendary_rewards'] = null;
    return null;
  }
  $leg = $allLegends[$legKey];
  $stageIdx = (int)$exp['legendary_stage'];
  if (!isset($leg['stages'][$stageIdx])) {
    // Стадии кончились (или их нет) — выплачиваем накопленное и закрываем цепочку.
    $rewards = json_decode($exp['legendary_rewards'] ?? '{}', true) ?: [];
    if (!empty($rewards)) {
      $playerLevelNow = getPlayerLevel($pdo, $userId);
      $applyResult = applyEffects($pdo, $userId, $rewards, $buffs);
      $exp['total_items'] = (int)$exp['total_items'] + $applyResult['count'];
      $exp['total_chips'] = (int)$exp['total_chips'] + $applyResult['appliedChips'];
      $exp['total_exp'] = (int)$exp['total_exp'] + $applyResult['appliedExp'];
    }
    grantLegendaryChest($pdo, $userId, $exp, $legKey, $leg, $stageIdx, false);
    $exp['legendary_id'] = null;
    $exp['legendary_stage'] = null;
    $exp['legendary_auto_resolve'] = null;
    $exp['legendary_rewards'] = null;
    return [
      'text' => 'Цепочка обрывается. Накопленное забрано с собой.',
      'type' => 'legendary',
      'effects' => json_encode($rewards),
      'is_micro' => 0,
      'tick_number' => $exp['tick_count'],
      'decision' => null,
      'resource_cost' => null,
      'resource_had' => 0,
      'legendary_event_id' => $legKey,
      'legendary_title' => $leg['title'] ?? $legKey,
      'legendary_stage' => $stageIdx,
      'legendary_result' => 'fail',
    ];
  }
  $stage = $leg['stages'][$stageIdx];
  $playerLevel = getPlayerLevel($pdo, $userId);
  if (empty($stage['text'])) {
    // Final stage — give final reward (без предметов: вместо них сундук ниже).
    $fr = computeLegendaryReward($leg['fr_rw'], $playerLevel);
    unset($fr['itemCount']);
    $fr = travelScaleRewards($fr, $exp);
    $rewards = json_decode($exp['legendary_rewards'] ?? '{}', true) ?: [];
    $merged = mergeEffectsArr($rewards, $fr);
    $applyResult = applyEffects($pdo, $userId, $merged, $buffs);
    $exp['total_items'] = (int)$exp['total_items'] + $applyResult['count'];
    $exp['total_chips'] = (int)$exp['total_chips'] + $applyResult['appliedChips'];
    $exp['total_exp'] = (int)$exp['total_exp'] + $applyResult['appliedExp'];
    $exp['legendary_id'] = null;
    $exp['legendary_stage'] = null;
    $exp['legendary_auto_resolve'] = null;
    $exp['legendary_rewards'] = null;
    grantLegendaryChest($pdo, $userId, $exp, $legKey, $leg, $stageIdx, true);
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
      'legendary_title' => $leg['title'] ?? $legKey,
      'legendary_stage' => $stageIdx + 1,
      'legendary_result' => 'complete',
    ];
  }

  // 70/30 roll
  $success = mt_rand(1, 100) <= 70;
  $stageReward = travelScaleRewards(computeLegendaryReward($stage['rw'], $playerLevel), $exp);
  $rewards = json_decode($exp['legendary_rewards'] ?? '{}', true) ?: [];

  if ($success) {
    $merged = mergeEffectsArr($rewards, $stageReward);
    $exp['legendary_rewards'] = json_encode($merged);
    $exp['legendary_stage'] = $stageIdx + 1;
    // Потикового auto-resolve больше нет: стадии идут по слотам крупных событий.
    $exp['legendary_auto_resolve'] = null;
    $applyResult = applyEffects($pdo, $userId, $stageReward, $buffs);
    $exp['total_items'] = (int)$exp['total_items'] + $applyResult['count'];
    $exp['total_chips'] = (int)$exp['total_chips'] + $applyResult['appliedChips'];
    $exp['total_exp'] = (int)$exp['total_exp'] + $applyResult['appliedExp'];
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
      'legendary_title' => $leg['title'] ?? $legKey,
      'legendary_stage' => $stageIdx + 1,
      'legendary_result' => 'stage',
    ];
  } else {
    // Fail — chain breaks, payout accumulated rewards + сундук за прогресс.
    $applyResult = applyEffects($pdo, $userId, $rewards, $buffs);
    $exp['total_items'] = (int)$exp['total_items'] + $applyResult['count'];
    $exp['total_chips'] = (int)$exp['total_chips'] + $applyResult['appliedChips'];
    $exp['total_exp'] = (int)$exp['total_exp'] + $applyResult['appliedExp'];
    $exp['legendary_id'] = null;
    $exp['legendary_stage'] = null;
    $exp['legendary_auto_resolve'] = null;
    $exp['legendary_rewards'] = null;
    grantLegendaryChest($pdo, $userId, $exp, $legKey, $leg, $stageIdx, false);
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
      'legendary_title' => $leg['title'] ?? $legKey,
      'legendary_stage' => $stageIdx + 1,
      'legendary_result' => 'fail',
    ];
  }
}

// ---------------------------------------------------------------------------
// Death rollback
// ---------------------------------------------------------------------------
function handleExplorationDeath($pdo, $userId, &$exp) {
  // Добыча рейда (сессийные предметы) — сгорает полностью.
  $sessionIds = json_decode($exp['session_item_ids'] ?? '[]', true) ?: [];
  if (!empty($sessionIds)) {
    $placeholders = implode(',', array_fill(0, count($sessionIds), '?'));
    $params = array_merge($sessionIds, [$userId]);
    $del = $pdo->prepare("DELETE FROM inventory_items WHERE id IN ($placeholders) AND user_id = ?");
    $del->execute($params);
  }
  // Чипы, заработанные за рейд, — сгорают. HP всегда 1% (фикс: раньше
  // ставилось только при наличии чипов).
  $lostChips = (int)$exp['total_chips'];
  $sd = getSaveData($pdo, $userId);
  if ($lostChips > 0) {
    $sd['player']['dataChips'] = max(0, ($sd['player']['dataChips'] ?? 0) - $lostChips);
  }
  // Личный рюкзак — обнуляется (как и добыча рейда).
  $bagItems = $sd['player']['backpackGrid']['items'] ?? [];
  $lostItems = count($sessionIds) + (is_array($bagItems) ? count($bagItems) : 0);
  if (is_array($sd['player']['backpackGrid'] ?? null)) {
    $sd['player']['backpackGrid']['items'] = [];
  }
  $sd['player']['stats']['currentHp'] = max(1, (int)floor(($sd['player']['stats']['maxHp'] ?? 100) * 0.01));
  putSaveData($pdo, $userId, $sd);

  // Причина смерти — последнее событие, наносившее урон.
  $deathCause = null;
  $evStmt = $pdo->prepare("SELECT text, effects FROM exploration_events WHERE exploration_id = ? ORDER BY id DESC LIMIT 10");
  $evStmt->execute([$exp['id']]);
  foreach ($evStmt->fetchAll() as $row) {
    $eff = json_decode($row['effects'] ?: '[]', true) ?: [];
    if ((int)($eff['damage'] ?? 0) > 0 || (float)($eff['damagePercent'] ?? 0) > 0) {
      $deathCause = $row['text'];
      break;
    }
  }

  // Отложенные награды событий этого рейда сгорают вместе с добычей:
  // иначе клиент подберёт их через get_pending_rewards.php уже после смерти.
  try {
    $pdo->prepare("UPDATE offline_rewards SET claimed = 1 WHERE user_id = ? AND exploration_id = ?")
        ->execute([$userId, $exp['id']]);
  } catch (Exception $e) {
    // Таблицы нет в старых базах — не критично для смерти.
  }

  // Финальная запись в ленту — чтобы в журнале рейда остался след.
  $ev = [
    'text' => 'Вы погибли.' . ($deathCause ? ' ' . $deathCause : '') . ' Добыча рейда и личный рюкзак потеряны.',
    'type' => 'death',
    'effects' => '{}',
    'is_micro' => 0,
    'tick_number' => (int)$exp['tick_count'],
    'art' => null,
    'decision' => null,
    'resource_cost' => null,
    'resource_had' => 0,
    'legendary_event_id' => null,
    'legendary_stage' => null,
  ];
  saveEvent($pdo, $userId, $exp['id'], $ev);

  $exp['phase'] = 'complete';
  $dbNowRow = $pdo->query("SELECT NOW(3) AS dbnow")->fetch();
  setExploreFields($pdo, $exp['id'], ['phase' => 'complete', 'last_tick_at' => $dbNowRow['dbnow']]);
  saveExplorationHistory($pdo, $userId, $exp, 'dead', [
    'death_cause' => $deathCause,
    'lost_chips'  => $lostChips,
    'lost_items'  => $lostItems,
  ]);
}

// ---------------------------------------------------------------------------
// Exploration start
// ---------------------------------------------------------------------------
function startExploration($pdo, $userId, $zone, $hours = 12, $useMats = 1, $consumables = [], $difficultyKey = 'normal', $modifierKey = null) {
  $zoneData = getZoneData($zone);
  $difficulty = travelDifficulty($difficultyKey);
  $modifier = travelModifier($modifierKey);
  $hours = max(EXP_MIN_HOURS, min(EXP_MAX_HOURS, (int)$hours));
  // Модификатор может продлить/сократить время в зоне.
  $plannedSec = (int)round($hours * 3600 * (float)($modifier['tripTime'] ?? 1));
  $useMats = $useMats ? 1 : 0;
  // Рюкзак: нормализуем [{name, qty}] и СЖИГАЕМ из инвентаря сразу.
  $pack = [];
  if (is_array($consumables)) {
    foreach ($consumables as $c) {
      if (!is_array($c)) continue;
      $nm = trim((string)($c['name'] ?? ''));
      $q = max(0, (int)($c['qty'] ?? $c['quantity'] ?? 0));
      if ($nm === '' || $q <= 0) continue;
      $pack[$nm] = ($pack[$nm] ?? 0) + $q;
    }
  }
  $pdo->beginTransaction();
  try {
    foreach ($pack as $nm => $need) {
      $rows = $pdo->prepare("SELECT id, quantity, data FROM inventory_items WHERE user_id = ? AND name = ? AND quantity > 0 ORDER BY id FOR UPDATE");
      $rows->execute([$userId, $nm]);
      $have = 0;
      $stacks = [];
      foreach ($rows->fetchAll() as $r) {
        // Материалом считаем строки с type=material в data (legacy без data — тоже).
        $d = json_decode($r['data'] ?? '', true);
        if (is_array($d) && !empty($d) && ($d['type'] ?? '') !== 'material') continue;
        $have += (int)$r['quantity'];
        $stacks[] = $r;
      }
      if ($have < $need) {
        throw new Exception("Не хватает {$nm}: нужно {$need}, есть {$have}");
      }
      $rest = $need;
      foreach ($stacks as $st) {
        if ($rest <= 0) break;
        $take = min((int)$st['quantity'], $rest);
        $rest -= $take;
        if ((int)$st['quantity'] - $take > 0) {
          $pdo->prepare("UPDATE inventory_items SET quantity = quantity - ? WHERE id = ?")->execute([$take, $st['id']]);
        } else {
          $pdo->prepare("DELETE FROM inventory_items WHERE id = ?")->execute([$st['id']]);
        }
      }
    }
    $packJson = [];
    foreach ($pack as $nm => $q) $packJson[] = ['name' => $nm, 'qty' => $q];

    // Плата за старт: выносливость (SL-число карточки).
    $staminaCost = travelStaminaCost($difficulty, $modifier);
    $stmt = $pdo->prepare("SELECT save_data FROM saves WHERE user_id = ? FOR UPDATE");
    $stmt->execute([$userId]);
    $saveRow = $stmt->fetch();
    $saveData = $saveRow ? json_decode($saveRow['save_data'], true) : null;
    $stats = $saveData['player']['stats'] ?? null;
    if (!is_array($saveData) || !is_array($stats)) {
      throw new Exception('Сохранение не найдено');
    }
    $curSt = (float)($stats['stamina'] ?? 0);
    if ($curSt < $staminaCost) {
      throw new Exception("Не хватает выносливости (SL {$staminaCost}): есть " . (int)floor($curSt));
    }
    $stats['stamina'] = $curSt - $staminaCost;
    $saveData['player']['stats'] = $stats;
    $upd = $pdo->prepare("UPDATE saves SET save_data = ?, updated_at = NOW() WHERE user_id = ?");
    $upd->execute([json_encode($saveData, JSON_UNESCAPED_UNICODE), $userId]);

    $stmt = $pdo->prepare("INSERT INTO explorations (user_id, zone, zone_difficulty, zone_factions, is_infinite, phase, time_left, planned_sec, was_cancelled, use_materials, consumables, difficulty, modifier, event_cooldown, micro_event_cooldown, has_triggered_legendary, last_tick_at, started_at)
      VALUES (?, ?, ?, ?, 0, 'travel_out', ?, ?, 0, ?, ?, ?, ?, 0, 0, 0, NOW(3), NOW())");
    $stmt->execute([$userId, $zone, (int)($zoneData['difficulty'] ?? 1),
      json_encode($zoneData['allowedFactions'] ?? [], JSON_UNESCAPED_UNICODE),
      travelSpeed(TRAVEL_OUT_TICKS), $plannedSec, $useMats,
      empty($packJson) ? null : json_encode($packJson, JSON_UNESCAPED_UNICODE),
      $difficulty['key'], $modifier['key']]);
    $expId = $pdo->lastInsertId();
    $pdo->commit();
  } catch (Exception $e) {
    $pdo->rollBack();
    throw $e;
  }

  // ТЕСТ: сразу после старта прогенерировать N крупных событий (лента
  // наполняется мгновенно; см. TRAVEL_TEST_START_EVENTS). Логика повторяет
  // обычный тик (строки ~352-383): генерация → применение → запись → награда.
  if (TRAVEL_TEST_START_EVENTS > 0 && $expId > 0) {
    $stmt = $pdo->prepare("SELECT * FROM explorations WHERE id = ?");
    $stmt->execute([$expId]);
    $exp = $stmt->fetch();
    if ($exp) {
      $playerLevel = getPlayerLevel($pdo, $userId);
      $buffs = expeditionBuffs($exp['consumables'] ?? null);
      $factions = $exp['zone_factions'] ? json_decode($exp['zone_factions'], true) ?? [] : [];
      $itemsRef = [];
      $band = trapDmgBand((int)($exp['planned_sec'] ?? 0));
      $addItems = 0; $addChips = 0; $addExp = 0;
      for ($i = 1; $i <= TRAVEL_TEST_START_EVENTS; $i++) {
        $event = generateEvent($exp['zone'], $playerLevel, $factions, $itemsRef, $i, $band, $difficulty, $modifier);
        $apply = applyEffects($pdo, $userId, $event['effects'], $buffs);
        $addItems += $apply['count']; $addChips += $apply['appliedChips']; $addExp += $apply['appliedExp'];
        // Страховка тестового прогона: регулярные события не убивают — HP не ниже 1.
        if (getPlayerHp($pdo, $userId) <= 0) {
          $sd = getSaveData($pdo, $userId);
          if (is_array($sd)) {
            $sd['player']['stats']['currentHp'] = 1;
            putSaveData($pdo, $userId, $sd);
          }
        }
        $ev = [
          'text' => $event['text'],
          'type' => $event['type'],
          'effects' => json_encode(effectsWithBuffs($event['effects'], $buffs)),
          'is_micro' => 0,
          'tick_number' => $i,
          'art' => $event['art'] ?? null,
          'decision' => $event['decision'] ?? null,
          'resource_cost' => null,
          'resource_had' => 0,
          'legendary_event_id' => null,
          'legendary_stage' => null,
        ];
        saveEvent($pdo, $userId, $expId, $ev);
        if ($apply['count'] > 0) {
          $eventId = $pdo->lastInsertId();
          createOfflineReward($pdo, $userId, $expId, $eventId, $event['text'], $event['type'], $apply['count'], $playerLevel, $event['effects'], $event['itemPool'] ?? null, null,
            travelRewardProfile($playerLevel, (int)($exp['zone_difficulty'] ?? 1), $event['itemPool'] ?? null, travelQualityCap($difficulty, $modifier)));
        }
      }
      $pdo->prepare("UPDATE explorations SET total_items = total_items + ?, total_chips = total_chips + ?, total_exp = total_exp + ?, tick_count = ?,
        event_cooldown = ?, micro_event_cooldown = ? WHERE id = ?")
        ->execute([$addItems, $addChips, $addExp, TRAVEL_TEST_START_EVENTS,
          max(1, (int)round(travelSpeed(RNG(EVENT_COOLDOWN_MIN, EVENT_COOLDOWN_MAX)) / (float)($modifier['eventRate'] ?? 1))),
          max(1, travelSpeedMicro(RNG(MICRO_COOLDOWN_MIN, MICRO_COOLDOWN_MAX))), $expId]);
    }
  }

  return ['id' => $expId, 'phase' => 'travel_out', 'time_left' => travelSpeed(TRAVEL_OUT_TICKS), 'is_infinite' => false, 'planned_sec' => $plannedSec, 'use_materials' => $useMats, 'stamina_spent' => $staminaCost, 'difficulty' => $difficulty['key'], 'modifier' => $modifier['key']];
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
      'difficulty' => $exp['difficulty'] ?? 'normal',
      'modifier' => $exp['modifier'] ?? null,
      'useMaterials' => !isset($exp['use_materials']) || (int)$exp['use_materials'] === 1,
      'legendaryId' => $exp['legendary_id'],
      'legendaryStage' => $exp['legendary_stage'] !== null ? (int)$exp['legendary_stage'] : null,
    ],
    'player' => [
      'dataChips' => (int)($sd['player']['dataChips'] ?? 0),
      'currentExp' => (int)($sd['player']['currentExp'] ?? 0),
      'currentHp' => (int)($sd['player']['stats']['currentHp'] ?? 100),
    ],
    'consBuffs' => expeditionBuffs($exp['consumables'] ?? null),
    // Характеристики режимов рейда — клиент рисует их в шапке журнала.
    'difficultyInfo' => travelDifficulty($exp['difficulty'] ?? 'normal'),
    'modifierInfo' => travelModifier($exp['modifier'] ?? null),
    'state' => $forceState ?? ($isActive ? 'active' : 'complete'),
    // Данные о смерти (причина/потери) — для экрана смерти на клиенте.
    'death' => ($forceState ?? '') === 'dead' ? lastDeathInfo($pdo, $exp['user_id']) : null,
    'newEvents' => $events,
  ];
}

/** Последняя запись о смерти пользователя (причина, потери). */
function lastDeathInfo($pdo, $userId) {
  $stmt = $pdo->prepare("SELECT death_cause, lost_chips, lost_items, difficulty, modifier FROM exploration_history WHERE user_id = ? AND outcome = 'dead' ORDER BY id DESC LIMIT 1");
  $stmt->execute([$userId]);
  $row = $stmt->fetch();
  if (!$row) return null;
  return [
    'cause' => $row['death_cause'],
    'lostChips' => (int)$row['lost_chips'],
    'lostItems' => (int)$row['lost_items'],
    'difficulty' => $row['difficulty'],
    'modifier' => $row['modifier'],
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
  // Досрочный возврат — реальная дорога домой (час минус топливо),
  // без бонуса за зачистку. История запишется по прибытии с исходом 'cancelled'.
  $mod = travelModifier($exp['modifier'] ?? null);
  $retSec = travelSpeed((int)round(TRAVEL_BACK_TICKS * (expeditionBuffs($exp['consumables'] ?? null)['returnMult'] ?? 1.0) * (float)($mod['returnTime'] ?? 1.0)));
  $upd = $pdo->prepare("UPDATE explorations SET phase = 'travel_back', time_left = ?, was_cancelled = 1 WHERE id = ?");
  $upd->execute([$retSec, $exp['id']]);
  return ['success' => true, 'return_sec' => $retSec];
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------
function saveExplorationHistory($pdo, $userId, $exp, $outcome, $extra = []) {
  $lastEvents = [];
  $evStmt = $pdo->prepare("SELECT text, type, effects, is_micro, art, created_at FROM exploration_events WHERE exploration_id = ? ORDER BY id DESC LIMIT 50");
  $evStmt->execute([$exp['id']]);
  $lastEvents = $evStmt->fetchAll();
  // Длительность считаем на стороне СУБД — иначе PHP-таймзона расходится
  // с серверной и в историю попадали отрицательные «-119 мин».
  $duration = 0;
  if ($exp['started_at']) {
    $durStmt = $pdo->prepare("SELECT UNIX_TIMESTAMP(NOW()) - UNIX_TIMESTAMP(?) AS d");
    $durStmt->execute([$exp['started_at']]);
    $duration = max(0, (int)($durStmt->fetch()['d'] ?? 0));
  }
  $stmt = $pdo->prepare("INSERT INTO exploration_history (user_id, zone, difficulty, modifier, planned_sec, outcome, total_chips, total_exp, total_items, duration_seconds, started_at, death_cause, lost_chips, lost_items, event_log, ended_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
  $stmt->execute([
    $userId, $exp['zone'],
    $exp['difficulty'] ?? 'normal', $exp['modifier'] ?? null, (int)($exp['planned_sec'] ?? 0),
    $outcome, (int)$exp['total_chips'], (int)$exp['total_exp'], (int)($exp['total_items'] ?? 0),
    $duration, $exp['started_at'] ?: null,
    $extra['death_cause'] ?? null, (int)($extra['lost_chips'] ?? 0), (int)($extra['lost_items'] ?? 0),
    json_encode($lastEvents, JSON_UNESCAPED_UNICODE),
  ]);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function saveEvent($pdo, $userId, $expId, $e) {
  if (empty($e['text'])) return;
  $stmt = $pdo->prepare("INSERT INTO exploration_events (user_id, exploration_id, tick_number, is_micro, text, type, effects, art, decision, resource_cost, resource_had, legendary_event_id, legendary_title, legendary_stage, legendary_result, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))");
  $stmt->execute([$userId, $expId, $e['tick_number'] ?? 0, $e['is_micro'] ?? 0,
    $e['text'], $e['type'] ?? 'unknown',
    $e['effects'] ?? '{}',
    $e['art'] ?? null,
    $e['decision'] ?? null, $e['resource_cost'] ?? null, (int)($e['resource_had'] ?? 0),
    $e['legendary_event_id'] ?? null, $e['legendary_title'] ?? null, $e['legendary_stage'] ?? null,
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
function applyEffects($pdo, $userId, $effects, $buffs = []) {
  $sd = getSaveData($pdo, $userId);
  $changed = false;
  $chips = isset($effects['chips']) ? (int)$effects['chips'] : 0;
  $exp = isset($effects['exp']) ? (int)$effects['exp'] : 0;
  $healPct = isset($effects['healPercent']) ? (float)$effects['healPercent'] : 0;
  $dmgPct = isset($effects['damagePercent']) ? (float)$effects['damagePercent'] : 0;
  $flatHeal = isset($effects['flatHeal']) ? (int)$effects['flatHeal'] : 0;
  $result = ['count' => 0, 'items' => [], 'appliedChips' => 0, 'appliedExp' => 0];
  // Баффы рюкзака: только позитивные ветки (потери не раздуваем).
  $chipsMult = 1 + (float)($buffs['chipsPct'] ?? 0);
  $expMult = 1 + (float)($buffs['expPct'] ?? 0);
  $healMult = 1 + (float)($buffs['healPct'] ?? 0);
  $dmgMult = (float)($buffs['dmgTakenMult'] ?? 1.0);

  if ($chips != 0) {
    $chips = $chips > 0 ? (int)round($chips * $chipsMult) : $chips;
    $sd['player']['dataChips'] = ($sd['player']['dataChips'] ?? 0) + $chips;
    $result['appliedChips'] = $chips;
    $changed = true;
  }
  if ($exp > 0) {
    $exp = (int)round($exp * $expMult);
    $sd['player']['currentExp'] = ($sd['player']['currentExp'] ?? 0) + $exp;
    $result['appliedExp'] = $exp;
    $changed = true;
  }
  if ($healPct > 0) {
    $healPct = $healPct * $healMult;
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
    $dmgPct = $dmgPct * $dmgMult;
    $maxHp = $sd['player']['stats']['maxHp'] ?? 100;
    $cur = $sd['player']['stats']['currentHp'] ?? $maxHp;
    $sd['player']['stats']['currentHp'] = max(0, $cur - (int)round($maxHp * $dmgPct));
    $changed = true;
  }
  // Числовой урон (в HP) — база растёт с уровнем, редукция рюкзака режет.
  if (isset($effects['damage']) && (int)$effects['damage'] > 0) {
    $dmg = (int)round((int)$effects['damage'] * $dmgMult);
    $maxHp = $sd['player']['stats']['maxHp'] ?? 100;
    $cur = $sd['player']['stats']['currentHp'] ?? $maxHp;
    // Страховка: одно событие не убивает мгновенно (на «Аде» — почти).
    $dmg = min($dmg, (int)round($maxHp * 0.95));
    $sd['player']['stats']['currentHp'] = max(0, $cur - $dmg);
    $changed = true;
  }
  // Числовой хил (в HP).
  if (isset($effects['heal']) && (int)$effects['heal'] > 0) {
    $heal = (int)round((int)$effects['heal'] * $healMult);
    $maxHp = $sd['player']['stats']['maxHp'] ?? 100;
    $cur = $sd['player']['stats']['currentHp'] ?? $maxHp;
    $sd['player']['stats']['currentHp'] = min($maxHp, $cur + $heal);
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

// Качество сундука за легендарку: 1 этап — Обычный, все — Божественный,
// между — линейно по лестнице. Фейл считает только пройденные этапы.
function legendaryChestQuality($passedStages, $totalStages) {
  $ladder = array('Обычный', 'Редкий', 'Раритетный', 'Эпический', 'Смертоносный', 'Легендарный', 'Божественный');
  $total = max(1, (int)$totalStages);
  $passed = max(0, (int)$passedStages);
  if ($passed >= $total) return 'Божественный';
  if ($passed <= 1) return 'Обычный';
  $idx = (int)round($passed / $total * 6);
  if ($idx < 1) $idx = 1;
  if ($idx > 5) $idx = 5;
  return $ladder[$idx];
}

// Один сундук в конце легендарной цепочки (финал или фейл).
// Уровень фиксируется здесь — клиент откроет предметы именно этого уровня.
function grantLegendaryChest($pdo, $userId, $exp, $legKey, $leg, $stageIdx, $completed) {
  $stages = isset($leg['stages']) && is_array($leg['stages']) ? $leg['stages'] : array();
  $realTotal = 0;
  foreach ($stages as $st) {
    if (!empty($st['text'])) $realTotal++;
  }
  if ($realTotal < 1) $realTotal = 1;
  $passed = $completed ? $realTotal : max(0, (int)$stageIdx);
  $quality = legendaryChestQuality($passed, $realTotal);
  $level = max(1, (int)getPlayerLevel($pdo, $userId));
  $expId = (int)($exp['id'] ?? 0);
  if ($expId <= 0) return;
  // Уникальный id строки: тик монотонен внутри экспедиции (UNIQUE user/exp/event).
  $eventId = 2000000000 + (int)($exp['tick_count'] ?? 0);
  $title = isset($leg['title']) ? $leg['title'] : $legKey;
  createOfflineReward(
    $pdo, $userId, $expId, $eventId,
    '⚜ ' . $title . ' — награда: сундук (' . $quality . ')',
    'legendary', 1, $level, array(),
    null, array('quality' => $quality, 'level' => $level)
  );
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

function generateEvent($zone, $playerLevel, $factions, &$items, $existingEventCount = 0, $dmgBand = null, $difficulty = null, $modifier = null) {
  $catData = getCategoryTexts();
  $category = pickCategory();
  $zoneDesc = getZoneDesc($zone);
  $faction = $factions ? pick($factions) : 'Бандиты';
  $eventKey = $existingEventCount;
  if ($dmgBand === null) $dmgBand = trapDmgBand(0);

  // Rich events (any category with hand-crafted branches)
  if (!empty($catData[$category]['rich'])) {
    // Номер арта = база категории + индекс шаблона (раскладка совпадает
    // с src/data/eventArt.ts: help 1–28, trap 29–58, loot 59–162, item 163).
    $artBase = ['help' => 1, 'trap' => 29, 'loot' => 59, 'item' => 163][$category] ?? null;
    $richIdx = (int)array_rand($catData[$category]['rich']);
    $template = $catData[$category]['rich'][$richIdx];
    $text = substitute($template['text'], $zoneDesc, $faction);
    $branch = $template['branch'] ?? null;
    if ($branch) {
      $result = resolveBranch(['outcomes' => $branch['outcomes']], $zone, $playerLevel, $items);
      $eff = mergeEffectsArr($template['effects'] ?? [], $result['effects']);
      // Ловушки бьют редко, поэтому каждый удар весомый: ×4 к урону шаблона.
      // Потолок (полоса по длительности) ставит applyTravelScaling — он же
      // переводит % в числовой HP.
      if (($template['type'] ?? '') === 'trap' && !empty($eff['damagePercent']) && $eff['damagePercent'] > 0) {
        $eff['damagePercent'] = $eff['damagePercent'] * TRAP_DAMAGE_MULT;
      }
      $eff = capEffects($eff, false, $dmgBand);
      // %-урон/хил -> числовые HP + множители сложности и модификатора.
      $eff = applyTravelScaling($eff, $playerLevel, $dmgBand, $difficulty ?: travelDifficulty('normal'), $modifier ?: travelModifier(null));
      // Знак исхода и доля удачных исходов в ветке — для выбора игрока
      // («Осторожно» / «Рискнуть») и подсветки в ленте.
      $good = effectsAreGood($eff);
      $goodPct = branchGoodPercent($branch['outcomes'], $playerLevel);
      return [
        'eventKey' => $eventKey, 'text' => $text . ' → ' . implode(' → ', $result['texts']),
        'intro' => $text,
        'type' => $template['type'], 'effects' => $eff,
        // Арт события (номер в спрайт-листах) — если картинка назначена.
        'art' => $artBase !== null ? $artBase + $richIdx : null,
        'decision' => $result['texts'][0],
        'good' => $good, 'goodPct' => $goodPct,
        // Безопасный вариант: не лезешь — берёшь мелочь и уходишь.
        'safeText' => $text . ' → Ты не лезешь в это. Уходишь, прихватив мелочь.',
        'safeEffects' => ['chips' => C($playerLevel, 1), 'exp' => E($playerLevel, 1)],
        // Ресурсы в пути не тратятся (трата — только на старте рейда).
        'resourceCost' => null, 'resourceHad' => 0,
        'itemPool' => $template['itemPool'] ?? null,
      ];
    }
  }

  // Fallback
  return [
    'eventKey' => $eventKey,
    'text' => substitute('Ты бредёшь по {zone} в тишине. Ничего особенного.', $zoneDesc, $faction),
    'intro' => substitute('Ты бредёшь по {zone} в тишине. Ничего особенного.', $zoneDesc, $faction),
    'type' => 'neutral', 'effects' => [], 'decision' => null, 'resourceCost' => null, 'resourceHad' => 0,
    'good' => true, 'goodPct' => 100,
    'safeText' => substitute('Ты бредёшь по {zone} в тишине. Ничего особенного.', $zoneDesc, $faction),
    'safeEffects' => [],
  ];
}

/** Исход положительный? (есть чипы/опыт/хил/предмет и нет урона/потерь). */
function effectsAreGood($eff) {
  if (!is_array($eff)) return true;
  $pos = (($eff['chips'] ?? 0) > 0) || (($eff['exp'] ?? 0) > 0) || (($eff['healPercent'] ?? 0) > 0)
    || (($eff['heal'] ?? 0) > 0) || (($eff['itemCount'] ?? 0) > 0);
  $neg = (($eff['chips'] ?? 0) < 0) || (($eff['exp'] ?? 0) < 0) || (($eff['damagePercent'] ?? 0) > 0)
    || (($eff['damage'] ?? 0) > 0);
  if ($neg && !$pos) return false;
  return true;
}

/** Доля удачных исходов в ветке по весу (процент). */
function branchGoodPercent($outcomes, $level) {
  $total = 0; $good = 0;
  foreach ($outcomes as $o) {
    $w = (int)($o['weight'] ?? 0);
    $total += $w;
    $e = [];
    if (is_callable($o['effects'] ?? null)) { try { $e = $o['effects']('зона', $level); } catch (Throwable $t) { $e = []; } }
    elseif (is_array($o['effects'] ?? null)) $e = $o['effects'];
    if (effectsAreGood($e)) $good += $w;
  }
  if ($total <= 0) return 100;
  return (int)round($good / $total * 100);
}

/**
 * Эффекты с учётом баффов рюкзака — для записи в ленту.
 * applyEffects() применяет баффы к реальным значениям (HP/чипы/опыт),
 * а в строку события кладём уже усиленные числа — тогда цифры в ленте
 * совпадают с тем, что реально получил игрок.
 */
function effectsWithBuffs($effects, $buffs = []) {
  if (!is_array($effects)) return $effects;
  $out = $effects;
  $chipsPct = (float)($buffs['chipsPct'] ?? 0);
  $expPct = (float)($buffs['expPct'] ?? 0);
  $healPct = (float)($buffs['healPct'] ?? 0);
  $dmgMult = (float)($buffs['dmgTakenMult'] ?? 1.0);
  if (isset($out['chips']) && is_numeric($out['chips'])) {
    $out['chips'] = $out['chips'] > 0 ? (int)round($out['chips'] * (1 + $chipsPct)) : $out['chips'];
  }
  if (isset($out['exp']) && is_numeric($out['exp'])) {
    $out['exp'] = $out['exp'] > 0 ? (int)round($out['exp'] * (1 + $expPct)) : $out['exp'];
  }
  if (isset($out['healPercent']) && $out['healPercent'] > 0) {
    $out['healPercent'] = round($out['healPercent'] * (1 + $healPct), 4);
  }
  if (isset($out['damagePercent']) && $out['damagePercent'] > 0) {
    $out['damagePercent'] = round($out['damagePercent'] * $dmgMult, 4);
  }
  // Числовые урон/хил (после перевода из %).
  if (isset($out['damage']) && $out['damage'] > 0) {
    $out['damage'] = (int)round($out['damage'] * $dmgMult);
  }
  if (isset($out['heal']) && $out['heal'] > 0) {
    $out['heal'] = (int)round($out['heal'] * (1 + $healPct));
  }
  return $out;
}

// ---------------------------------------------------------------------------
// Числовой урон: база растёт с уровнем игрока (через ожидаемый пул HP
// уровня), дальше множители сложности и модификатора. Шаблоны событий
// остаются в % — это их «вес» исхода.
// ---------------------------------------------------------------------------

/**
 * Ожидаемый пул HP для уровня игрока: кривая «уровень + снаряжение»
 * (500 HP на 1 ур. → 150 000 на 100 ур.).
 * Урон в пути считается от неё, а не от реального HP игрока: тогда
 * снаряжение даёт запас прочности, но не раздувает цель. Слабый по HP
 * персонаж на своём уровне получает те же числа — и умирает первым.
 */
function travelExpectedHp($playerLevel) {
  $L = max(1, (int)$playerLevel);
  $x = min(1, ($L - 1) / 99);
  return 500 + 149500 * pow($x, 1.6);
}

/** База урона/хила события (в HP): 10% от ожидаемого пула HP уровня. */
function travelPowerScale($playerLevel) {
  return (int)round(travelExpectedHp($playerLevel) * 0.10);
}

/**
 * Переводит %-эффекты шаблона в числовые (урон/хил в HP) и применяет
 * множители сложности и модификатора рейда.
 */
function applyTravelScaling($eff, $playerLevel, $dmgBand, $difficulty, $modifier) {
  if (!is_array($eff)) return $eff;
  $base = travelPowerScale($playerLevel);
  $dmgMult = (float)($difficulty['damageMult'] ?? 1) * (float)($modifier['damage'] ?? 1);
  $rewardMult = (float)($difficulty['rewardMult'] ?? 1);
  $chipMult = $rewardMult * (float)($modifier['chips'] ?? 1);
  $expMult = $rewardMult * (float)($modifier['exp'] ?? 1);
  $healMult = (float)($modifier['heal'] ?? 1);
  $findRate = (float)($modifier['findRate'] ?? 1);
  $lootBonus = (float)($modifier['lootBonus'] ?? 0);

  // Урон: % шаблона → множитель базы (8% = 1×), с потолком полосы.
  if (isset($eff['damagePercent']) && $eff['damagePercent'] > 0) {
    $factor = (float)$eff['damagePercent'] / 0.08;
    $factor = min($factor, (float)$dmgBand);
    unset($eff['damagePercent']);
    $eff['damage'] = (int)round($base * $factor * $dmgMult);
  }
  // Хил: % шаблона → HP (8% = 1× базы, как и урон).
  if (isset($eff['healPercent']) && $eff['healPercent'] > 0) {
    $heal = (int)round($base * ((float)$eff['healPercent'] / 0.08) * $healMult);
    unset($eff['healPercent']);
    $eff['heal'] = $heal;
  }
  if (isset($eff['chips']) && $eff['chips'] > 0) $eff['chips'] = (int)round($eff['chips'] * $chipMult);
  if (isset($eff['exp']) && $eff['exp'] > 0) $eff['exp'] = (int)round($eff['exp'] * $expMult);

  // Находки: меньше/больше.
  if (!empty($eff['itemCount'])) {
    if ($findRate < 1 && (mt_rand(1, 100) / 100) > $findRate) {
      unset($eff['itemCount']);
    } elseif ($lootBonus > 0 && (mt_rand(1, 100) / 100) < $lootBonus) {
      $eff['itemCount'] = (int)$eff['itemCount'] + 1;
    }
  }
  return $eff;
}

function capEffects($effects, $hadResource = false, $dmgBand = null) {
  if (!is_array($dmgBand)) $dmgBand = trapDmgBand(0);
  // Ресурсы в событиях больше не тратятся, поэтому капы «мягкие»:
  // без возможности докупить удачу запас прочности должен быть в запасе.
  if (isset($effects['healPercent']) && $effects['healPercent'] > 0) {
    $effects['healPercent'] = min($effects['healPercent'], 0.10);
  }
  return $effects;
}

/**
 * Полоса урона по длительности рейда — максимальный множитель от базы
 * (потолок для одного удара: ловушка не превышает полосу).
 * ≤6ч → 2.5×, 6–12ч → 3.5×, 12–18ч → 4.5×, 18–24ч → 6.0×.
 */
function trapDmgBand($plannedSec) {
  $h = $plannedSec / 3600;
  if ($h >= 18) return 6.0;
  if ($h >= 12) return 4.5;
  if ($h >= 6) return 3.5;
  return 2.5;
}

// Масштабирование базового урона исходов (0.05–0.18) к полосам выше.
const TRAP_DAMAGE_MULT = 4;
