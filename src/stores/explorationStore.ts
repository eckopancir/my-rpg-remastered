import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { usePlayerStore } from './playerStore';
import { useInventoryStore } from './inventoryStore';
import { useAuthStore } from './authStore';
import { generateItem, type GeneratedItem } from '../engine/items';
import { generateTravelReward, type TravelRewardProfile } from '../engine/travelLoot';
import { GAME_ITEMS } from '../data/GameItems';
import { createChest } from '../data/chests';
import type { TravelModeInfo } from '../data/travelModes';

/** Кап кэша имён находок (eventRewardItems): больше 120 событий рейда лента не показывает. */
const REWARD_CACHE_MAX = 120;
import { backpackSlotsFor, tryInsertIntoGrid, removeItemFromGrid, compactGrid, createGrid } from '../data/backpacks';
import { syncNow, flushPlayerBlob } from '../utils/serverSync';


const API_BASE = '/api/exploration';

/**
 * Гвард «смерть уже отзеркалена в этой сессии»: штрафы смерти (пустой рюкзак,
 * списанные чипы, HP 1%) принимаются из серверного блоба однажды за смерть.
 * Сбрасывается при старте нового рейда (startExploration).
 */
let deathMirrorApplied = false;

// Сколько событий держим в памяти. После долгого офлайна в БД могут быть
// тысячи строк — весь лог в стейт не кладём, иначе виснет рендер.
const MAX_EVENT_LOG = 500;
// Сколько эффектов применяем локально за один полл (защита от фриза
// при догоне большой истории).
const MAX_EFFECTS_PER_POLL = 100;

const DEATH_FLAVORS = [
  'Странствующий торговец нашёл ваше бездыханное тело и донёс до базы.',
  'Отряд сталкеров подобрал вас в пустоши и доставил к лекарю.',
  'Местные жители нашли вас у дороги и выходили ценой своих припасов.',
  'Бродячий механик наткнулся на ваше тело и отвёз на своей телеге.',
  'Спасательная группа услышала сигнал твоего КПК и эвакуировала.',
  'Стая псов кружила вокруг, но вмешался рейнджер и отбил вас.',
  'Ваше тело подобрал дрон-медик и доставил в ближайший лагерь.',
  'Караванщики нашли вас в кювете и подбросили до базы за спасибо.',
  'Из последних сил дополз до тракта — тебя подобрал попутный грузовик.',
  'Кочевое племя выходило вас с помощью древних техник.',
  'Бандиты обыскали вас, забрали ценное, но бросили умирать — тебя нашли свои.',
  'Вас вынес на себе наёмник, которому ты задолжал пару чипов.',
  'Безымянный герой рискнул жизнью и вытащил вас из зоны поражения.',
  'Патруль сектора эвакуировал вас после того, как сигнал биометрии пропал.',
  'Случайный охотник за артефактами наткнулся на ваше тело в аномалии.',
  'Монахи из ближайшего скита подобрали вас и отмолили от смерти.',
  'Боевой медик ввёл стимулятор и на руках донёс до госпиталя.',
  'Вас эвакуировали на вертолёте — пришлось отдать последние чипы за топливо.',
  'Старый друг выкупил вас у мародёров, не задавая лишних вопросов.',
  'Конвой ООН наткнулся на вас и оказал первую помощь.',
  'Вы очнулись в капсуле Vita — автоматическая система спасения сработала.',
  'Тебя вытащили из-под завалов, когда здание рухнуло.',
  'Ребёнок привёл взрослых к вашему телу — вся деревня помогала выхаживать.',
  'Собака-поводырь притащила аптечку и грела вас до прихода подмоги.',
  'Путешественник из другого клана поделился последней аптечкой.',
  'Вы промёрзли до костей, но охотничья избушка дала убежище — вас нашли по дыму.',
  'Шахтёры наткнулись на вас в туннеле и вытащили на поверхность.',
  'Робот-уборщик принял вас за мусор и сгрузил в лазарет — главное, живой.',
  'Цыганский табор выходил вас за несколько монет и гадание на судьбу.',
  'Вас смыло рекой, но рыбаки вытянули сетями и откачали.',
];

/** Случайная «спасательная» история для экрана смерти (гарантированно одна за рейд). */
export const pickDeathFlavor = (): string =>
  DEATH_FLAVORS[Math.floor(Math.random() * DEATH_FLAVORS.length)];

export interface ServerExploration {
  id: number;
  zone: string;
  phase: string;
  timeLeft: number;
  tickCount: number;
  /** Плавный визуальный реген: ставка/мин и фаза (сек с последнего начисления). */
  regenPerMin?: number;
  regenPhase?: number;
  totalChips: number;
  totalExp: number;
  totalItems?: number;
  isInfinite: boolean;
  plannedSec?: number;
  useMaterials?: boolean;
  legendaryId: string | null;
  legendaryStage: number | null;
}

export interface ServerEventRow {
  id: number;
  text: string;
  type: string;
  effects: string;
  is_micro: number;
  tick_number: number;
  /** Номер арта события (1–163), если у шаблона есть картинка. */
  art: number | null;
  decision: string | null;
  resource_cost: string | null;
  resource_had: number;
  legendary_event_id: string | null;
  /** Русское название легендарной цепочки. */
  legendary_title?: string | null;
  legendary_stage: number | null;
  legendary_result: string | null;
  created_at: string;
}

export interface ConsBuffs {
  regen: number;
  healPct: number;
  legPct: number;
  expPct: number;
  chipsPct: number;
  dmgTakenMult: number;
  returnMult: number;
}

/**
 * Характеристики режима рейда с сервера: сложность (урон/награда/потолок
 * качества) либо модификатор (характер пути).
 */
export type { TravelModeInfo } from '../data/travelModes';

export const EMPTY_BUFFS: ConsBuffs = {
  regen: 0, healPct: 0, legPct: 0, expPct: 0, chipsPct: 0, dmgTakenMult: 1, returnMult: 1,
};

// Зеркало expeditionBuffs() из api/exploration/engine_config.php — для превью и локал-зеркала.
export const calcConsBuffs = (sel: Record<string, number>): ConsBuffs => {
  const n = (name: string) => Math.max(0, Math.floor(sel[name] || 0));
  const iz = Math.min(n('Изолента'), 5);
  const fe = Math.min(n('Железо'), 5);
  const healUnits = Math.min(n('Вода'), 6) + Math.min(n('Консервы'), 6);
  const expUnits = Math.min(n('Дерево'), 5) + Math.min(n('Гвозди'), 5);
  const chipsUnits = Math.min(n('Инструменты'), 5) + Math.min(n('Пластмасса'), 5);
  return {
    regen: Math.min(n('Лекарства'), 6) * 5,
    healPct: Math.min(healUnits * 0.05, 0.3),
    legPct: Math.min(n('Батарейки'), 5) * 0.03,
    expPct: Math.min(expUnits * 0.1, 1),
    chipsPct: Math.min(chipsUnits * 0.1, 1),
    dmgTakenMult: Math.max(0.5, (1 - iz * 0.05) * (1 - fe * 0.05)),
    returnMult: Math.max(0.25, 1 - Math.min(n('Топливо'), 5) * 0.15),
  };
};

// Описания для превью в модалке старта.
export const CONS_BUFF_DEFS: { name: string; desc: string }[] = [
  { name: 'Лекарства', desc: '+5 реген/мин (макс +30)' },
  { name: 'Вода', desc: '+5% хил (макс +30%)' },
  { name: 'Консервы', desc: '+5% хил (макс +30%)' },
  { name: 'Батарейки', desc: '+3% шанс легендарки (макс +15%)' },
  { name: 'Дерево', desc: '+10% опыта (макс +100%)' },
  { name: 'Гвозди', desc: '+10% опыта (макс +100%)' },
  { name: 'Инструменты', desc: '+10% чипов (макс +100%)' },
  { name: 'Пластмасса', desc: '+10% чипов (макс +100%)' },
  { name: 'Изолента', desc: '−5% входящего урона (макс −50%)' },
  { name: 'Железо', desc: '−5% входящего урона (макс −50%)' },
  { name: 'Топливо', desc: '−15% времени возврата (макс −75%)' },
];

interface ExplorationStore {
  isExploring: boolean;
  zoneName: string | null;
  phase: string;
  serverPhase: string;
  timeLeft: number;
  tickCount: number;
  eventLog: ServerEventRow[];
  totalChips: number;
  totalExp: number;
  totalItems: number;
  isInfinite: boolean;
  explorationId: number | null;
  serverOutcome: string | null; // 'active', 'complete', 'dead'
  error: string | null;
  processedEventId: number;
  eventRewardItems: Record<number, { items: GeneratedItem[]; saved: boolean; dropped?: boolean }>;
  isProcessingRewards: boolean;
  isReturningHome: boolean;
  deathFlavor: string;
  deathInfo: { cause: string | null; lostChips: number; lostItems: number; difficulty: string; explorationId?: number | null } | null;
  /** Смерть случилась в этой сессии (рейд был активен) — можно зеркалить штрафы. */
  deathFresh: boolean;
  /** ID смерти (запись exploration_history), которая уже была квитирована
   *  (клик по экрану смерти / reset). Персистится: глушит только СВОЮ смерть,
   *  новая смерть (другой id) снова показывает экран и разрешает зеркало. */
  settledDeathId: number | null;
  /** Штраф за смерть уже применён (чтобы не списать дважды).
   *  Квитируется только смертью с тем же id (см. settledDeathId). */
  deathSettled: boolean;
  totalEvents: number;
  hasMoreEvents: boolean;
  // Догон офлайна: сколько секунд долга осталось на сервере + режим bulk.
  debtSec: number;
  bulkMode: string;
  engineVersion: string;
  // Плановая длительность экспедиции, сек (слайдер 2-24ч). 0 = legacy.
  plannedSec: number;
  // Тратить ли материалы из инвентаря (галочка на старте).
  useMaterials: boolean;
  // Баффы рюкзака с сервера (зеркало expeditionBuffs) для локального применения.
  consBuffs: ConsBuffs;
  // Сложность рейда (normal/hard/danger/nightmare/hell).
  difficulty: string;
  // Модификатор рейда (характер) — null, если обычный.
  modifier: string | null;
  // Характеристики режимов с сервера (для шапки журнала).
  difficultyInfo: TravelModeInfo | null;
  modifierInfo: TravelModeInfo | null;
  /** Плавный визуальный реген в рейде: ставка/мин, фаза и момент полла.
   *  Только для СЛОЯ ОТОБРАЖЕНИЯ (шапка) — в store HP не пишем. */
  raidRegenPerMin: number;
  raidRegenPhase: number;
  raidRegenAt: number;

  startExploration: (zoneName: string, hours?: number, useMats?: boolean, consumables?: { name: string; qty: number }[], difficulty?: string, modifier?: string | null) => Promise<void>;
  cancelExploration: () => Promise<void>;
  pollServerState: () => Promise<void>;
  loadOlderEvents: () => Promise<void>;
  completeExploration: () => void;
  resetExploration: () => Promise<void>;
  processPendingRewards: () => Promise<void>;
}

// Мерж двух кусков лога по id с дедупом и капом на хвост.
function mergeEventLogs(
  current: ServerEventRow[], incoming: any[], max: number,
): ServerEventRow[] {
  if (incoming.length === 0) return current;
  const seen = new Set<number>(current.map((e) => e.id));
  const merged = [...current];
  for (const e of incoming) {
    if (typeof e?.id !== 'number' || seen.has(e.id)) continue;
    seen.add(e.id);
    merged.push(e as ServerEventRow);
  }
  merged.sort((a, b) => a.id - b.id);
  return merged.length > max ? merged.slice(-max) : merged;
}

const getToken = () => useAuthStore.getState().token;

export const useExplorationStore = create<ExplorationStore>()(
  persist(
    (set, get) => ({
      isExploring: false,
      zoneName: null,
      phase: 'idle',
      serverPhase: '',
      timeLeft: 0,
      tickCount: 0,
      eventLog: [],
      totalChips: 0,
      totalExp: 0,
      totalItems: 0,
      isInfinite: false,
      explorationId: null,
      serverOutcome: null,
      error: null,
      processedEventId: 0,
      eventRewardItems: {},
      isProcessingRewards: false,
      isReturningHome: false,
      deathFlavor: '',
      deathInfo: null,
      deathFresh: false,
      settledDeathId: null,
      totalEvents: 0,
      hasMoreEvents: false,
      debtSec: 0,
      bulkMode: 'none',
      engineVersion: '',
      plannedSec: 0,
      useMaterials: true,
      consBuffs: { ...EMPTY_BUFFS },
      difficulty: 'normal',
      modifier: null,
      difficultyInfo: null,
      modifierInfo: null,
      raidRegenPerMin: 0,
      raidRegenPhase: 0,
      raidRegenAt: 0,
      deathSettled: false,

      startExploration: async (zoneName, hours = 12, useMats = true, consumables = [], difficulty = 'normal', modifier: string | null = null) => {
        const token = getToken();
        if (!token) { set({ error: 'Not authenticated' }); return; }
        // Срочно доливаем актуальное состояние до сервера: после смерти+лечения
        // серверный блоб может ещё держать HP 1% (автосейв раз в 60с), и тогда
        // полл прижмёт шкалу HP к 1% на весь новый рейд. flush гарантирует,
        // что сервер получил вылеченное HP ДО начала путешествия.
        await flushPlayerBlob();
        const h = Math.max(2, Math.min(24, Math.round(hours)));
        try {
          const res = await fetch(`${API_BASE}/start.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              zone: zoneName, hours: h, use_mats: useMats ? 1 : 0,
              difficulty, modifier,
              consumables: consumables
                .filter((c) => c.name && c.qty > 0)
                .map((c) => ({ name: c.name, qty: Math.floor(c.qty) })),
            }),
          });
          const data = await res.json();
          if (!res.ok) { set({ error: data.error || 'Failed to start' }); return; }

          const exp = data.exploration;

          // Refresh inventory from server before starting
          syncInventoryFromServer(token);
          usePlayerStore.getState().addLog(`🚀 Отправляемся в "${zoneName}" (${exp?.difficulty || difficulty}).`, 'info');
          set({
            isExploring: true,
            zoneName,
            phase: exp?.phase ?? 'travel_out',
            serverPhase: exp?.phase ?? 'travel_out',
            serverOutcome: 'active',
            timeLeft: exp?.time_left ?? 1,
            tickCount: 0,
            eventLog: [],
            totalChips: 0,
            totalExp: 0,
            totalItems: 0,
            isInfinite: exp?.is_infinite === true || exp?.phase === 'exploring',
            explorationId: exp?.id ?? null,
            error: null,
            processedEventId: 0,
            totalEvents: 0,
            hasMoreEvents: false,
            debtSec: 0,
            bulkMode: 'none',
            engineVersion: '',
            plannedSec: typeof exp?.planned_sec === 'number' ? exp.planned_sec : h * 3600,
            useMaterials: exp?.use_materials === undefined ? useMats : exp.use_materials !== 0,
            deathInfo: null,
            deathFlavor: '',
            // Новый рейд — новый цикл: экран смерти снова может сработать,
            // а свежая смерть снова должна отзеркалиться из блоба.
            deathSettled: false,
            deathFresh: false,
            settledDeathId: null,
          });
          deathMirrorApplied = false;
        } catch (e) {
          set({ error: `Network error: ${e}` });
        }
      },

      cancelExploration: async () => {
        const token = getToken();
        if (!token) return;
        try {
          await fetch(`${API_BASE}/cancel.php`, { headers: { Authorization: `Bearer ${token}` } });
        } catch { /* ignore */ }
        usePlayerStore.getState().addLog('🛑 Возвращаемся на базу... дорога займёт около часа.', 'warning');
        // Возврат идёт на сервере (travel_back, 1ч) — локально не выдумываем
        // обратный отсчёт, ждём timeLeft из поллов.
        set({
          phase: 'travel_back',
          serverPhase: 'travel_back',
          isInfinite: false,
          isReturningHome: true,
        });
      },

      pollServerState: async () => {
        const state = get();
        // Опрос идёт даже если клиент считает, что рейда нет: сервер — источник
        // истины (рейд мог начаться в другой вкладке или до перезагрузки).
        const token = getToken();
        if (!token) {
          console.log('[EXP_POLL] no token, skipping');
          return;
        }

        try {
          const res = await fetch(`${API_BASE}/status.php?limit=150`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (!res.ok) {
            console.log('[EXP_POLL] server returned error', { status: res.status, data });
            return;
          }

          console.log('[EXP_POLL] server response', {
            active: data.active,
            state: data.state,
            timeLeft: data.exploration?.timeLeft,
            phase: data.exploration?.phase,
            tickCount: data.exploration?.tickCount,
            hasDebug: !!data._debug,
            debug: data._debug,
            ts: Date.now()
          });

          const exp = data.exploration as ServerExploration | undefined;
          const allRecentEvents: any[] = data.events ?? [];
          // Свежие события, созданные именно этим тиком. Сервер уже учёл их
          // эффекты в сейве — локально повторяем только их, а не всю историю.
          const freshEvents: any[] = data.newEvents ?? [];
          // Данные смерти от сервера: id записи истории, причина, потери.
          const deathServer = (data as any).death as any;
          const incomingDeathId = deathServer && typeof deathServer === 'object'
            && Number.isFinite(Number(deathServer.explorationId))
            ? Number(deathServer.explorationId) : null;
          // get() после await: пока шёл запрос, смерть могли уже закрыть кнопкой —
          // иначе «поздний» полл снова покажет экран смерти.
          // Смерть считается квитированной только если штамп (deathSettled)
          // относится к ЭТОЙ же смерти (id совпадает с settledDeathId).
          // Персист «смерть уже обработана» из прошлой сессии больше не глушит
          // НОВУЮ смерть: сбрасываем штамп, экран и зеркало снова активны.
          let settledNow = get().deathSettled;
          if (
            data.state === 'dead' && settledNow
            && incomingDeathId !== null
            && incomingDeathId !== get().settledDeathId
          ) {
            set({ deathSettled: false, settledDeathId: null });
            settledNow = false;
          }
          const serverOutcome = (data.state === 'dead' && !settledNow) ? 'dead' : (data.state ?? 'active');
          // «Свежая» смерть — рейд был активен в этой сессии. Только тогда
          // клиент зеркалит штрафы: после F5 сервер уже всё списал сам.
          const deathFresh = serverOutcome === 'dead' && state.isExploring;
          const deathInfo = serverOutcome === 'dead' && deathServer && typeof deathServer === 'object'
            ? {
                explorationId: incomingDeathId,
                cause: deathServer.cause ?? null,
                lostChips: Number(deathServer.lostChips ?? 0),
                lostItems: Number(deathServer.lostItems ?? 0),
                difficulty: String(deathServer.difficulty ?? ''),
              }
            : null;
          const consBuffs = (data.consBuffs && typeof data.consBuffs === 'object')
            ? { ...EMPTY_BUFFS, ...data.consBuffs }
            : state.consBuffs;
          const diffKey = (exp as any)?.difficulty ?? state.difficulty;
          const modKey = (exp as any)?.modifier ?? null;
          // Характеристики режимов с сервера — рисуем их в шапке журнала.
          const diffInfo = (data.difficultyInfo && typeof data.difficultyInfo === 'object')
            ? (data.difficultyInfo as TravelModeInfo)
            : state.difficultyInfo;
          const modInfo = (data.modifierInfo && typeof data.modifierInfo === 'object')
            ? (data.modifierInfo as TravelModeInfo)
            : state.modifierInfo;

          // Применяем эффекты только свежих событий (обычно 0–15 шт).
          // Старый путь — дифф по всей 1000-й истории — после долгого офлайна
          // делал до 1000 апдейтов стора за полл и вешал UI, поэтому дифф
          // используем лишь как фолбэк и капаем его.
          const inv = useInventoryStore.getState();
          const fallbackNew = allRecentEvents
            .filter((e: any) => e.id > state.processedEventId)
            .slice(-MAX_EFFECTS_PER_POLL);
          const effectsSource = freshEvents.length > 0 ? freshEvents : fallbackNew;
          if (effectsSource.length > 0) {
            for (const evt of effectsSource) {
              applyLocalEffects(evt.effects, consBuffs);
              if (evt.resource_had && evt.resource_cost) {
                inv.consumeItemByName(evt.resource_cost);
              }
            }
          }
          // processedEventId — максимум из всего виденного, чтобы backlog
          // офлайна не переприменялся на каждом полле.
          let maxSeenId = state.processedEventId;
          for (const e of allRecentEvents) {
            if (typeof e.id === 'number' && e.id > maxSeenId) maxSeenId = e.id;
          }
          for (const e of freshEvents) {
            if (typeof e.id === 'number' && e.id > maxSeenId) maxSeenId = e.id;
          }
          if (maxSeenId !== state.processedEventId) {
            set({ processedEventId: maxSeenId });
          }

          // Инкрементальный мерж лога с капом вместо замены всего массива.
          const mergedLog = mergeEventLogs(state.eventLog, allRecentEvents, MAX_EVENT_LOG);
          const totalEvents = typeof data.totalEvents === 'number' ? data.totalEvents : mergedLog.length;
          // Догон офлайна с сервера (bulk): долг в секундах + режим + версия движка.
          const debtSec = typeof data.debtSec === 'number' ? data.debtSec : 0;
          const bulkMode = typeof data.bulkMode === 'string' ? data.bulkMode : 'none';
          const engineVersion = typeof data.engine_version === 'string' ? data.engine_version : state.engineVersion;

          // Sync player data from server (HP only — XP is applied via applyLocalEffects → addExp)
          // Адоптим вверх всегда (реген/баффы на сервере). Вниз — только во
          // время активного рейда (сервер — источник урона). Вне рейда
          // серверное HP могло остаться 1% после смерти (клиентский flush
          // с вылеченным HP ещё не доставлен) — не прижимаем лечёное к 1%.
          const playerData = data.player as { currentHp?: number } | undefined;
          if (playerData?.currentHp !== undefined) {
            const ps = usePlayerStore.getState();
            const serverHp = playerData.currentHp;
            const cappedHp = Math.min(serverHp, ps.stats.maxHp);
            const adoptDown = data.active === true;
            const nextHp = (adoptDown || cappedHp >= ps.stats.currentHp)
              ? cappedHp
              : ps.stats.currentHp;
            if (nextHp !== ps.stats.currentHp) {
              console.log('[SERVER_HP_SYNC]', { before: ps.stats.currentHp, serverHp, nextHp, maxHp: ps.stats.maxHp, active: data.active, ts: Date.now() });
              usePlayerStore.setState({ stats: { ...ps.stats, currentHp: nextHp } });
            }
          }

          if (!data.active) {
            set({
              isExploring: false,
              phase: 'complete', serverPhase: 'complete',
              // Проекция визуального регена вне активного рейда выключена.
              raidRegenPerMin: 0, raidRegenPhase: 0, raidRegenAt: 0,
              serverOutcome,
              deathInfo: serverOutcome === 'dead' ? (deathInfo ?? state.deathInfo) : null,
              deathFresh,
              eventLog: mergedLog,
              totalChips: exp?.totalChips ?? 0,
              totalExp: exp?.totalExp ?? 0,
              tickCount: exp?.tickCount ?? 0,
              totalEvents,
              hasMoreEvents: totalEvents > mergedLog.length,
              processedEventId: 0,
              debtSec: 0,
              bulkMode: 'none',
              engineVersion,
              consBuffs: { ...EMPTY_BUFFS },
              // Характеристики последнего режима — шапка показывает их и без активного рейда.
              difficulty: typeof data.difficulty === 'string' ? data.difficulty : state.difficulty,
              modifier: 'modifier' in data ? ((data.modifier as string | null) ?? null) : state.modifier,
              difficultyInfo: diffInfo,
              modifierInfo: modInfo,
            });
            // Смерть: штрафы зеркалим СРАЗУ при первом распознавании (не при
            // клике по экрану смерти) — и для офлайн-смерти (deathFresh=false),
            // и для смерти, случившейся в этой сессии (deathFresh=true).
            // Принимаем серверный блоб как истину: рюкзак опустошён, чипы
            // списаны, HP 1%. Иначе до клика по экрану смерти автосейв (60с)
            // успевает «воскресить» полный рюкзак, а [SERVER_HP_SYNC] — держать
            // устаревшее высокое HP.
            if (serverOutcome === 'dead' && !settledNow && !deathMirrorApplied) {
              deathMirrorApplied = true;
              const psBefore = usePlayerStore.getState();
              const bagCountBefore = psBefore.backpackGrid?.items?.length ?? 0;
              void refreshPlayerBlobAfterOfflineDeath(token).then(() => {
                const ps = usePlayerStore.getState();
                const lostChips = deathInfo?.lostChips ?? 0;
                if (lostChips > 0) ps.addLog(`💾 Потеряно ${lostChips} чипов.`, 'warning');
                if (bagCountBefore > 0) {
                  ps.addLog(`🎒 Рюкзак опустошён (${bagCountBefore} предметов).`, 'warning');
                }
                // Рюкзак честнее достроить с сервера (инкубатор сессионных
                // предметов: сервер удалил их из inventory_items).
                syncInventoryFromServer(token);
                // Сразу гоним вычищенный блоб на сервер: следующие сейвы
                // (автосейв/flush в startExploration) уже не несут потерь.
                syncNow();
              });
            }
            return;
          }

          if (exp) {
            const clientPhase = exp.phase === 'travel_out' ? 'travel_out'
              : exp.phase === 'exploring' ? 'exploring'
              : exp.phase === 'travel_back' ? 'travel_back'
              : exp.phase === 'complete' ? 'complete'
              : state.phase;

            set({
              isExploring: true,
              zoneName: exp.zone ?? state.zoneName,
              serverPhase: exp.phase,
              serverOutcome,
              phase: clientPhase,
              timeLeft: exp.timeLeft,
              tickCount: exp.tickCount,
              // Плавный визуальный реген: шапка тикает 1/60 ставки посекундно
              // от зеркального HP, между поллами. raidRegenAt — именно момент,
              // когда сервер замерил currentHp: проекция считается от него.
              raidRegenPerMin: Number.isFinite(Number(exp.regenPerMin)) ? Math.max(0, Number(exp.regenPerMin)) : 0,
              raidRegenPhase: Number.isFinite(Number(exp.regenPhase)) ? Math.min(60, Math.max(0, Number(exp.regenPhase))) : 0,
              raidRegenAt: Date.now(),
              totalChips: exp.totalChips,
              totalExp: exp.totalExp,
              totalItems: exp.totalItems ?? 0,
              isInfinite: exp.isInfinite,
              explorationId: exp.id,
              eventLog: mergedLog,
              totalEvents,
              hasMoreEvents: totalEvents > mergedLog.length,
              debtSec,
              bulkMode,
              engineVersion,
              plannedSec: typeof exp.plannedSec === 'number' && exp.plannedSec > 0
                ? exp.plannedSec
                : state.plannedSec,
              useMaterials: typeof exp.useMaterials === 'boolean'
                ? exp.useMaterials
                : state.useMaterials,
              consBuffs,
              difficulty: diffKey,
              modifier: modKey,
              difficultyInfo: diffInfo,
              modifierInfo: modInfo,
              // Живой рейд — данные смерти неактуальны.
              deathInfo: null,
            });
          }
          // Process pending rewards after each poll
          await get().processPendingRewards();
        } catch {
          // silent
        }
      },

      // Догрузка старых событий для кнопки "показать ещё".
      loadOlderEvents: async () => {
        const state = get();
        if (!state.isExploring || !state.hasMoreEvents) return;
        let minId = Number.MAX_SAFE_INTEGER;
        for (const e of state.eventLog) {
          if (e.id < minId) minId = e.id;
        }
        if (minId === Number.MAX_SAFE_INTEGER) return;
        const token = getToken();
        if (!token) return;
        try {
          const res = await fetch(
            `${API_BASE}/status.php?limit=200&before_id=${minId}`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (!res.ok) return;
          const data = await res.json();
          const older: any[] = data.events ?? [];
          if (older.length === 0) {
            set({ hasMoreEvents: false });
            return;
          }
          const mergedLog = mergeEventLogs(older, get().eventLog, MAX_EVENT_LOG);
          const totalEvents = typeof data.totalEvents === 'number'
            ? data.totalEvents
            : mergedLog.length;
          set({
            eventLog: mergedLog,
            totalEvents,
            hasMoreEvents: totalEvents > mergedLog.length,
          });
        } catch {
          // silent
        }
      },

      completeExploration: () => {
        const state = get();
        const ps = usePlayerStore.getState();

        if (state.serverOutcome === 'dead') {
          // Штрафы смерти уже отзеркалены в pollServerState (первый полл с
          // исходом 'dead' принял серверный блоб: пустой рюкзак, чипы, HP 1%).
          // Квитацию (deathSettled) включаем ПОСЛЕ повторной адоптации
          // серверного блоба: клик-сейв снимает гвард в save.php, и если
          // локальный рюкзак ещё не вычищен гонкой (полл/лог медленнее клика),
          // полный блоб «воскресит» потери — это и был баг неопустошаемого рюкзака.
          const flavor = DEATH_FLAVORS[Math.floor(Math.random() * DEATH_FLAVORS.length)];
          const settledId = state.deathInfo?.explorationId ?? null;
          ps.addLog(`💀 ${flavor}`, 'danger');
          void (async () => {
            const token = getToken();
            if (token) await refreshPlayerBlobAfterOfflineDeath(token);
            set({
              deathFlavor: flavor,
              deathSettled: true,
              deathFresh: false,
              // Штамп привязан к конкретной смерти (id записи истории):
              // следующая смерть (другой id) снова покажет экран и зеркало.
              settledDeathId: settledId,
            });
            // Немедленный сейв с квитацией: save.php увидит deathSettled=true,
            // снимет гвард-маркер и перестанет чистить рюкзак/чипы/HP.
            syncNow();
          })();
        } else if (state.isReturningHome) {
          ps.addLog(`🏁 Возвращение на базу завершено.`, 'loot');
        } else {
          ps.addLog(`🏁 Исследование "${state.zoneName}" завершено!`, 'loot');
        }

        const token = getToken();
        if (token) syncInventoryFromServer(token);
        set({
          isExploring: false, zoneName: null, phase: 'idle', serverPhase: '',
          serverOutcome: null, timeLeft: 0, tickCount: 0,
          eventLog: [], totalChips: 0, totalExp: 0, totalItems: 0,
          explorationId: null, isReturningHome: false,
          totalEvents: 0, hasMoreEvents: false,
          debtSec: 0, bulkMode: 'none',
          useMaterials: true,
          consBuffs: { ...EMPTY_BUFFS },
          deathInfo: null,
        });
        // Process pending rewards after completion; после обработки
        // кэш находок чистим — лента рейда уже сброшена, имена
        // больше не нужны (и не накапливаются в localStorage).
        void get().processPendingRewards().then(() => {
          if (!get().isProcessingRewards) set({ eventRewardItems: {} });
        });
      },

      // Сброс экспедиции: сначала сервер помечает активный рейд завершённым
      // (reset.php), иначе ближайший полл status.php снова «загрузит» рейд.
      // Сервер не ответил — локально не сбрасываем, чтобы не расходиться с ним.
      resetExploration: async () => {
        const token = getToken();
        if (!token) return;
        try {
          const res = await fetch(`${API_BASE}/reset.php`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return;
        } catch {
          return;
        }
        set({
          isExploring: false, zoneName: null, phase: 'idle', serverPhase: '',
          serverOutcome: null, timeLeft: 0, tickCount: 0,
          eventLog: [], totalChips: 0, totalExp: 0, totalItems: 0,
          explorationId: null, error: null,
          totalEvents: 0, hasMoreEvents: false,
          debtSec: 0, bulkMode: 'none',
          useMaterials: true,
          consBuffs: { ...EMPTY_BUFFS },
          deathSettled: true,
          settledDeathId: get().deathInfo?.explorationId ?? null,
          isReturningHome: false,
          deathInfo: null,
          deathFresh: false,
        });
      },

      processPendingRewards: async () => {
        if (get().isProcessingRewards) return;
        set({ isProcessingRewards: true });

        try {
          const token = getToken();
          if (!token) { set({ isProcessingRewards: false }); return; }

          const res = await fetch(`${API_BASE}/get_pending_rewards.php`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) { set({ isProcessingRewards: false }); return; }
          const data = await res.json();
          const rewards: any[] = data.pendingRewards ?? [];

          if (rewards.length === 0) { set({ isProcessingRewards: false }); return; }

          const playerLevel = usePlayerStore.getState().level;
          const inv = useInventoryStore.getState();
          const currentItems = get().eventRewardItems;
          const newItems = { ...currentItems };
          let changed = false;

          for (const reward of rewards) {
            const rewardId: number = reward.id;
            const eventId: number = reward.event_id;
            const itemCount: number = reward.item_count || 0;
            if (itemCount <= 0) continue;
            const rewardPlayerLevel: number = reward.player_level || playerLevel;

            // Already cached — retry save if not saved
            if (newItems[eventId]) {
              const cached = newItems[eventId];
              if (cached.saved) continue;
              // Кэш пережил перезагрузку: предметы уже лежат в рюкзаке,
              // повторно их не кладём — только переклеймиваем награду.
              const del = deliverToBackpack(cached.items as any[], false);
              const saveRes = await fetch(`${API_BASE}/save_items.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                  items: del.placed,
                  rewardId,
                  mode: del.usedBackpack ? 'backpack' : 'inventory',
                  drop: del.dropped && del.placed.length === 0 ? 1 : 0,
                }),
              });
              if (saveRes.ok) {
                newItems[eventId] = { items: cached.items, saved: true };
                changed = true;
              }
              continue;
            }

            // Generate new items
            let itemPool: string | null = null;
            let chestSpec: { quality?: string; level?: number } | null = null;
            let profile: TravelRewardProfile | null = null;
            let keyDrop: { slug: string; tier: number; title: string; quality: string; color: string } | null = null;
            if (reward.reward_data) {
              try {
                const rd = typeof reward.reward_data === 'string' ? JSON.parse(reward.reward_data) : reward.reward_data;
                itemPool = rd?.itemPool || null;
                chestSpec = rd?.chest || null;
                profile = rd?.profile || null;
                keyDrop = rd?.keyDrop || null;
              } catch (_) {}
            }
            const items: GeneratedItem[] = [];
            if (keyDrop) {
              // Легендарный ключ: предмет с фиксированной редкостью (решил сервер).
              const tier = Math.max(1, Math.min(7, keyDrop.tier || 1));
              items.push({
                id: `key_${keyDrop.slug}_${tier}_${Math.random().toString(16).slice(2, 8)}`,
                name: `legendary_key_${keyDrop.slug}`,
                displayName: `Ключ: ${keyDrop.title || keyDrop.slug}`,
                type: 'key',
                slot: 'key',
                rarity: 'common',
                level: rewardPlayerLevel,
                quality: keyDrop.quality || 'Обычный',
                qualityColor: keyDrop.color || 'white',
                image: `/art/keys/key-${tier}.png`,
                stats: {},
                quantity: 1,
                stackable: false,
                description: 'Трофей легендарной цепочки рейда. Валюта подземелий.',
              } as unknown as GeneratedItem);
            } else if (chestSpec) {
              // Награда-сундук с легендарки: качество и уровень зафиксированы сервером.
              const chest = createChest(chestSpec.quality || 'Обычный', chestSpec.level || rewardPlayerLevel);
              items.push(chest as unknown as GeneratedItem);
            } else if (profile) {
              // Сервер решил характер дропа (пул/потолки/количество).
              items.push(...(generateTravelReward(profile, rewardPlayerLevel) as unknown as GeneratedItem[]));
            } else {
              for (let i = 0; i < itemCount; i++) {
                items.push(generateItem(GAME_ITEMS, rewardPlayerLevel, null, null, itemPool));
              }
            }

            // Доставка в Тетрис-рюкзак. Если рюкзак переполнен — добыча
            // остаётся в зоне (предмет не выдаётся вообще).
            const del = deliverToBackpack(items as any[], true);
            const placed = del.placed;

            // Save to server (transactional: INSERT + CLAIM)
            const saveBody: any = placed.length > 0
              ? { items: placed, rewardId, mode: del.usedBackpack ? 'backpack' : 'inventory' }
              : { rewardId, drop: 1 };
            const saveRes = await fetch(`${API_BASE}/save_items.php`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify(saveBody),
            });

            if (saveRes.ok) {
              // Если предмет не влез в рюкзак — награда помечена потерянной,
              // но сами предметы запоминаем: в ленте покажем, что именно нашли.
              newItems[eventId] = {
                items: placed.length > 0 ? placed : items,
                saved: true,
                dropped: placed.length === 0,
              };
              changed = true;
            } else {
              // Rollback: убираем только то, что положили сами.
              for (const item of placed) {
                if (del.usedBackpack) {
                  const g = usePlayerStore.getState().backpackGrid;
                  usePlayerStore.setState({ backpackGrid: removeItemFromGrid(g, item.id) });
                } else {
                  inv.removeItem(item.id);
                }
              }
              newItems[eventId] = { items: placed, saved: false };
              changed = true;
            }
            if (del.dropped) {
              usePlayerStore.getState().addLog('🎒 Рюкзак полон — добыча осталась в зоне.', 'warning');
            }
          }

          if (changed) {
            // Кап кэша: имена живут только в ленте рейда, хранить весь
            // бесконечный журнал в localStorage незачем.
            const keys = Object.keys(newItems)
              .map(Number)
              .sort((a, b) => b - a);
            for (const k of keys.slice(REWARD_CACHE_MAX)) delete newItems[k];
            set({ eventRewardItems: newItems, isProcessingRewards: false });
          } else {
            set({ isProcessingRewards: false });
          }
        } catch {
          set({ isProcessingRewards: false });
        }
      },
    }),
    {
      name: 'remastered_exploration',
      version: 8,
      migrate: (persisted: any) => {
        const clean = { ...persisted };
        delete clean.isProcessingRewards;
        // eventRewardItems теперь персистим осознанно (см. partialize):
        // иначе перезаход между генерацией и клеймом дублировал награды.
        return clean;
      },
      partialize: (state) => ({
        isExploring: state.isExploring,
        zoneName: state.zoneName,
        phase: state.phase,
        serverPhase: state.serverPhase,
        serverOutcome: state.serverOutcome,
        timeLeft: state.timeLeft,
        tickCount: state.tickCount,
        eventLog: state.eventLog.slice(-200),
        processedEventId: state.processedEventId,
        totalChips: state.totalChips,
        totalExp: state.totalExp,
        totalItems: state.totalItems,
        isInfinite: state.isInfinite,
        explorationId: state.explorationId,
        plannedSec: state.plannedSec,
        useMaterials: state.useMaterials,
        consBuffs: state.consBuffs,
        difficulty: state.difficulty,
        modifier: state.modifier,
        difficultyInfo: state.difficultyInfo,
        modifierInfo: state.modifierInfo,
        // Кэш несейвленных наград: переживает перезагрузку, чтобы ретрай
        // сейвил те же предметы, а не генерировал дубликаты.
        eventRewardItems: state.eventRewardItems,
        // Штампы квитации смерти: переживают перезагрузку, но привязаны
        // к id конкретной смерти (settledDeathId) — новая смерть
        // (другой id) снова покажет экран и разрешит зеркало штрафов.
        deathSettled: state.deathSettled,
        settledDeathId: state.settledDeathId,
      }),
      merge: (persisted: any, current: any) => ({
        ...current,
        ...persisted,
        isProcessingRewards: false,
        // eventRewardItems НЕ трогаем: он в partialize осознанно — кэш
        // находок переживает перезагрузку, иначе клеймлённые раньше
        // награды навсегда теряют имена в ленте (fallback «нашли 📦 +N»
        // без тултипа). Ретрай несейвленных и дублирование страхует
        // processPendingRewards.
      }),
    },
  ),
);

/**
 * Оффлайн-смерть: сервер уже применил штрафы к сейв-блобу (handleExplorationDeath:
 * рюкзак опустошён, чипы рейда списаны, HP 1%). Клиент, узнав об исходе 'dead',
 * принимает блоб как истину — иначе последующий автосейв старого локального
 * состояния перезапишет сервер и потерянные предметы «воскреснут».
 * Только приоритет XP/уровня сохраняем (максимальный из клиент/сервер).
 */
async function refreshPlayerBlobAfterOfflineDeath(token: string): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/load.php`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const json = await res.json();
    const serverPlayer = (json?.data as any)?.player as any;
    if (!serverPlayer) return;
    // Серверный гвард-маркер не должен утекать в клиентский стейк и блобы сейва.
    delete serverPlayer.backpackWipeAt;
    const ps = usePlayerStore.getState();
    usePlayerStore.setState({
      backpackGrid: serverPlayer.backpackGrid ?? ps.backpackGrid,
      dataChips: Math.max(0, Number(serverPlayer.dataChips ?? ps.dataChips) || 0),
      stats: {
        ...ps.stats,
        currentHp: Math.min(
          ps.stats.currentHp,
          Number.isFinite(serverPlayer.stats?.currentHp) ? serverPlayer.stats.currentHp : ps.stats.currentHp,
        ),
      },
      // XP/уровень выше — приоритет клиентского счёта (см. doLoad).
      level: Math.max(ps.level, serverPlayer.level ?? 1),
      currentExp: Math.max(ps.currentExp, serverPlayer.currentExp ?? 0),
      expToNext: Math.max(ps.expToNext, serverPlayer.expToNext ?? 100),
    });
    usePlayerStore.getState().recalcStats();
  } catch { /* смерть-адаптация не должна ронять приложение */ }
}

export async function catchUpExploration() {
  try {
    const store = useExplorationStore.getState();
    // Опрос всегда: сервер — источник истины (рейд мог начаться в другой
    // вкладке или до перезагрузки страницы).
    console.log('[EXP_CATCHUP] calling pollServerState', {
      phase: store.phase, timeLeft: store.timeLeft, tickCount: store.tickCount,
      explorationId: store.explorationId, isReturningHome: store.isReturningHome,
      ts: Date.now()
    });
    await store.pollServerState();
    const after = useExplorationStore.getState();
    console.log('[EXP_CATCHUP] after pollServerState', {
      isExploring: after.isExploring, phase: after.phase, timeLeft: after.timeLeft,
      serverPhase: after.serverPhase, tickCount: after.tickCount, ts: Date.now()
    });
    await store.processPendingRewards();
  } catch (e) {
    console.error('[EXP_CATCHUP] error', e);
  }
}

/**
 * Доставка наград в Тетрис-рюкзак игрока.
 * - Рюкзака нет (0 слотов) → находки идут в склад (плоский инвентарь).
 * - Рюкзак есть, но не влезает → предмет теряется (добыча остаётся в зоне).
 * - fresh=false — повторная попытка (кэш после перезагрузки): предметы,
 *   уже лежащие в рюкзаке, повторно не кладём.
 */
function deliverToBackpack(items: any[], fresh: boolean) {
  const pStore = usePlayerStore.getState();
  const grid0 = pStore.backpackGrid;
  const pack: any = (pStore.equipment as any).backpack;
  const slots = Math.max(grid0?.slots ?? 0, backpackSlotsFor(pack));
  const inv = useInventoryStore.getState();

  if (slots <= 0) {
    for (const item of items) inv.addItem(item as any);
    return { placed: items, dropped: false, usedBackpack: false };
  }

  let grid = grid0;
  const placed: any[] = [];
  let dropped = false;
  for (const item of items) {
    if (!fresh && grid.items.some((i: any) => i.id === item.id)) {
      placed.push(item);
      continue;
    }
    // Уплотняем рюкзак: иначе крупная вещь (2×2) не влезет в раздробленный
    // рюкзак из одних 1×1 предметов и находка просто сгорит.
    const res = tryInsertIntoGrid(grid, item);
    if (!res.moved) {
      const packed = compactGrid(grid);
      const res2 = tryInsertIntoGrid(packed, item);
      if (res2.moved) {
        grid = res2.grid;
        placed.push(item);
        if (res2.leftoverQty > 0) dropped = true;
        continue;
      }
      dropped = true;
      continue;
    }
    grid = res.grid;
    placed.push(item);
    if (res.leftoverQty > 0) dropped = true;
  }
  if (placed.length > 0) {
    usePlayerStore.setState({ backpackGrid: grid });
    syncNow();
  }
  return { placed, dropped, usedBackpack: true };
}

// Apply effects from a JSON effects string to the player store (client-side safety net).
// Зеркало applyEffects(): баффы рюкзака применяются так же, иначе разъедется с сервером.
function applyLocalEffects(effectsJson: string, buffs: ConsBuffs = EMPTY_BUFFS) {
  if (!effectsJson || effectsJson === '{}') return;
  try {
    const eff = JSON.parse(effectsJson);
    if (!eff || typeof eff !== 'object') return;
    const ps = usePlayerStore.getState();
    const patch: Record<string, any> = {};

    if (eff.chips && typeof eff.chips === 'number') {
      const v = eff.chips > 0 ? Math.round(eff.chips * (1 + (buffs.chipsPct || 0))) : eff.chips;
      usePlayerStore.getState().addChips(v);
    }
    if (eff.exp && typeof eff.exp === 'number') {
      const v = eff.exp > 0 ? Math.round(eff.exp * (1 + (buffs.expPct || 0))) : eff.exp;
      usePlayerStore.getState().addExp(v);
    }
    if (eff.healPercent && typeof eff.healPercent === 'number') {
      const maxHp = ps.stats.maxHp || 10000;
      const healAmt = Math.round(maxHp * eff.healPercent * (1 + (buffs.healPct || 0)));
      patch.stats = { ...ps.stats, currentHp: Math.min(maxHp, ps.stats.currentHp + healAmt) };
    }
    if (eff.damagePercent && typeof eff.damagePercent === 'number') {
      const maxHp = ps.stats.maxHp || 10000;
      const dmgAmt = Math.round(maxHp * eff.damagePercent * (buffs.dmgTakenMult ?? 1));
      patch.stats = { ...(patch.stats || ps.stats), currentHp: Math.max(0, (patch.stats?.currentHp ?? ps.stats.currentHp) - dmgAmt) };
    }
    // Числовой урон/хил (в HP) — база растёт с уровнем, редукция рюкзака режет.
    if (eff.heal && typeof eff.heal === 'number') {
      const maxHp = ps.stats.maxHp || 10000;
      const healAmt = Math.round(eff.heal * (1 + (buffs.healPct || 0)));
      patch.stats = { ...(patch.stats || ps.stats), currentHp: Math.min(maxHp, (patch.stats?.currentHp ?? ps.stats.currentHp) + healAmt) };
    }
    if (eff.damage && typeof eff.damage === 'number') {
      const maxHp = ps.stats.maxHp || 10000;
      const dmgAmt = Math.min(Math.round(eff.damage * (buffs.dmgTakenMult ?? 1)), Math.round(maxHp * 0.95));
      patch.stats = { ...(patch.stats || ps.stats), currentHp: Math.max(0, (patch.stats?.currentHp ?? ps.stats.currentHp) - dmgAmt) };
    }

    if (Object.keys(patch).length > 0) {
      usePlayerStore.setState(patch);
    }
  } catch {
    // silent
  }
}

async function syncInventoryFromServer(token: string) {
  try {
    const res = await fetch('/api/inventory/load.php', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const json = await res.json();
      if (json.items) {
        useInventoryStore.getState().setItems(json.items);
      }
    }
  } catch {
    // silent
  }
}
