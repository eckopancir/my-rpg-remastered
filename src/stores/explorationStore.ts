import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { usePlayerStore } from './playerStore';
import { useInventoryStore } from './inventoryStore';
import { useAuthStore } from './authStore';
import { generateItem, type GeneratedItem } from '../engine/items';
import { GAME_ITEMS } from '../data/GameItems';
import { createChest } from '../data/chests';


const API_BASE = '/api/exploration';

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

export interface ServerExploration {
  id: number;
  zone: string;
  phase: string;
  timeLeft: number;
  tickCount: number;
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
  decision: string | null;
  resource_cost: string | null;
  resource_had: number;
  legendary_event_id: string | null;
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

export const EMPTY_BUFFS: ConsBuffs = {
  regen: 0, healPct: 0, legPct: 0, expPct: 0, chipsPct: 0, dmgTakenMult: 1, returnMult: 1,
};

// Зеркало expeditionBuffs() из api/exploration/engine_config.php — для превью и локал-зеркала.
export const calcConsBuffs = (sel: Record<string, number>): ConsBuffs => {
  const n = (name: string) => Math.max(0, Math.floor(sel[name] || 0));
  const iz = Math.min(n('Изолента'), 20);
  const fe = Math.min(n('Железо'), 20);
  return {
    regen: Math.min(n('Лекарства'), 10),
    healPct: Math.min(n('Вода'), 50) * 0.001 + Math.min(n('Консервы'), 50) * 0.001,
    legPct: Math.min(n('Батарейки'), 30) * 0.001,
    expPct: Math.min(n('Дерево'), 50) * 0.002 + Math.min(n('Гвозди'), 50) * 0.002,
    chipsPct: Math.min(n('Инструменты'), 50) * 0.002 + Math.min(n('Пластмасса'), 50) * 0.002,
    dmgTakenMult: Math.max(0.64, (1 - iz * 0.01) * (1 - fe * 0.01)),
    returnMult: Math.max(0.5, 1 - Math.min(n('Топливо'), 10) * 0.05),
  };
};

// Описания для превью в модалке старта.
export const CONS_BUFF_DEFS: { name: string; desc: string }[] = [
  { name: 'Лекарства', desc: '+1 реген (макс +10)' },
  { name: 'Вода', desc: '+0.1% к хилу (макс +5%)' },
  { name: 'Консервы', desc: '+0.1% к хилу (макс +5%)' },
  { name: 'Батарейки', desc: '+0.1% к легендарке (макс +3%)' },
  { name: 'Дерево', desc: '+0.2% опыта (макс +10%)' },
  { name: 'Гвозди', desc: '+0.2% опыта (макс +10%)' },
  { name: 'Инструменты', desc: '+0.2% чипов (макс +10%)' },
  { name: 'Пластмасса', desc: '+0.2% чипов (макс +10%)' },
  { name: 'Изолента', desc: '−1% входящего урона (макс −20%)' },
  { name: 'Железо', desc: '−1% входящего урона (макс −20%)' },
  { name: 'Топливо', desc: '−5% времени возврата (макс −50%)' },
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
  eventRewardItems: Record<number, { items: GeneratedItem[]; saved: boolean }>;
  isProcessingRewards: boolean;
  isReturningHome: boolean;
  deathFlavor: string;
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

  startExploration: (zoneName: string, hours?: number, useMats?: boolean, consumables?: { name: string; qty: number }[]) => Promise<void>;
  cancelExploration: () => Promise<void>;
  pollServerState: () => Promise<void>;
  loadOlderEvents: () => Promise<void>;
  completeExploration: () => void;
  resetExploration: () => void;
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
      totalEvents: 0,
      hasMoreEvents: false,
      debtSec: 0,
      bulkMode: 'none',
      engineVersion: '',
      plannedSec: 0,
      useMaterials: true,
      consBuffs: { ...EMPTY_BUFFS },

      startExploration: async (zoneName, hours = 12, useMats = true, consumables = []) => {
        const token = getToken();
        if (!token) { set({ error: 'Not authenticated' }); return; }
        const h = Math.max(2, Math.min(24, Math.round(hours)));
        try {
          const res = await fetch(`${API_BASE}/start.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              zone: zoneName, hours: h, use_mats: useMats ? 1 : 0,
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
          usePlayerStore.getState().addLog(`🚀 Отправляемся в "${zoneName}".`, 'info');
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
          });
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
        if (!state.isExploring) {
          console.log('[EXP_POLL] isExploring is false, skipping');
          return;
        }

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
          const serverOutcome = data.state ?? 'active';
          const consBuffs = (data.consBuffs && typeof data.consBuffs === 'object')
            ? { ...EMPTY_BUFFS, ...data.consBuffs }
            : state.consBuffs;

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
          const playerData = data.player as { currentHp?: number } | undefined;
          if (playerData?.currentHp !== undefined) {
            const ps = usePlayerStore.getState();
            const serverHp = playerData.currentHp;
            const cappedHp = Math.min(serverHp, ps.stats.maxHp);
            if (cappedHp !== ps.stats.currentHp) {
              console.log('[SERVER_HP_SYNC]', { before: ps.stats.currentHp, serverHp, cappedHp, maxHp: ps.stats.maxHp, ts: Date.now() });
              usePlayerStore.setState({ stats: { ...ps.stats, currentHp: cappedHp } });
            }
          }

          if (!data.active) {
            set({
              isExploring: false,
              phase: 'complete', serverPhase: 'complete',
              serverOutcome,
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
            });
            return;
          }

          if (exp) {
            const clientPhase = exp.phase === 'travel_out' ? 'travel_out'
              : exp.phase === 'exploring' ? 'exploring'
              : exp.phase === 'travel_back' ? 'travel_back'
              : exp.phase === 'complete' ? 'complete'
              : state.phase;

            set({
              serverPhase: exp.phase,
              serverOutcome,
              phase: clientPhase,
              timeLeft: exp.timeLeft,
              tickCount: exp.tickCount,
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
          // Pick random death flavor
          const flavor = DEATH_FLAVORS[Math.floor(Math.random() * DEATH_FLAVORS.length)];
          ps.addLog(`💀 ${flavor}`, 'danger');
          // Lose chips earned this trip
          const lostChips = state.totalChips;
          if (lostChips > 0) {
            usePlayerStore.setState({ dataChips: Math.max(0, ps.dataChips - lostChips) });
            ps.addLog(`💾 Потеряно ${lostChips} чипов.`, 'warning');
          }
          // Lose all items found this trip
          const inv = useInventoryStore.getState();
          const rewardItems = state.eventRewardItems;
          let lostItems = 0;
          for (const entry of Object.values(rewardItems)) {
            for (const item of entry.items) {
              inv.removeItem(item.id);
              lostItems++;
            }
          }
          if (lostItems > 0) {
            ps.addLog(`📦 Потеряно ${lostItems} предметов.`, 'warning');
          }
          // HP to 1%
          const maxHp = ps.stats.maxHp || 10000;
          usePlayerStore.setState({ stats: { ...ps.stats, currentHp: Math.max(1, Math.round(maxHp * 0.01)) } });
          ps.addLog('❤️ Здоровье восстановлено до 1%.', 'heal');
          set({ deathFlavor: flavor });
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
        });
        // Process pending rewards after completion
        get().processPendingRewards();
      },

      resetExploration: () => {
        set({
          isExploring: false, zoneName: null, phase: 'idle', serverPhase: '',
          serverOutcome: null, timeLeft: 0, tickCount: 0,
          eventLog: [], totalChips: 0, totalExp: 0, totalItems: 0,
          explorationId: null, error: null,
          totalEvents: 0, hasMoreEvents: false,
          debtSec: 0, bulkMode: 'none',
          useMaterials: true,
          consBuffs: { ...EMPTY_BUFFS },
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
              const saveRes = await fetch(`${API_BASE}/save_items.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ items: cached.items, rewardId }),
              });
              if (saveRes.ok) {
                const sj = await saveRes.json().catch(() => null);
                if (sj?.already) {
                  // Награда уже заклеймена (вторая вкладка / повторный запрос):
                  // наши локальные копии — дубликаты, откатываем их.
                  for (const item of cached.items) {
                    inv.removeItem(item.id);
                  }
                }
                newItems[eventId] = { items: cached.items, saved: true };
                changed = true;
              }
              continue;
            }

            // Generate new items
            let itemPool: string | null = null;
            let chestSpec: { quality?: string; level?: number } | null = null;
            if (reward.reward_data) {
              try {
                const rd = typeof reward.reward_data === 'string' ? JSON.parse(reward.reward_data) : reward.reward_data;
                itemPool = rd?.itemPool || null;
                chestSpec = rd?.chest || null;
              } catch (_) {}
            }
            const items: GeneratedItem[] = [];
            if (chestSpec) {
              // Награда-сундук с легендарки: качество и уровень зафиксированы сервером.
              const chest = createChest(chestSpec.quality || 'Обычный', chestSpec.level || rewardPlayerLevel);
              items.push(chest as unknown as GeneratedItem);
            } else {
              for (let i = 0; i < itemCount; i++) {
                items.push(generateItem(GAME_ITEMS, rewardPlayerLevel, null, null, itemPool));
              }
            }

            // Add to inventory (immediate UI)
            for (const item of items) {
              inv.addItem(item);
            }

            // Save to server (transactional: INSERT + CLAIM)
            const saveRes = await fetch(`${API_BASE}/save_items.php`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ items, rewardId }),
            });

            if (saveRes.ok) {
              const sj = await saveRes.json().catch(() => null);
              if (sj?.already) {
                // Гонка: другая вкладка/ретрай заклеймила раньше —
                // только что добавленные копии лишние, убираем.
                for (const item of items) {
                  inv.removeItem(item.id);
                }
              }
              newItems[eventId] = { items, saved: true };
              changed = true;
            } else {
              // Rollback inventory
              for (const item of items) {
                inv.removeItem(item.id);
              }
              newItems[eventId] = { items, saved: false };
              changed = true;
            }
          }

          if (changed) {
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
        // Кэш несейвленных наград: переживает перезагрузку, чтобы ретрай
        // сейвил те же предметы, а не генерировал дубликаты.
        eventRewardItems: state.eventRewardItems,
      }),
      merge: (persisted: any, current: any) => ({
        ...current,
        ...persisted,
        isProcessingRewards: false,
        eventRewardItems: {},
      }),
    },
  ),
);

export async function catchUpExploration() {
  try {
    const store = useExplorationStore.getState();
    if (store.isExploring) {
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
    } else {
      console.log('[EXP_CATCHUP] isExploring is false, skipping poll');
    }
    await store.processPendingRewards();
  } catch (e) {
    console.error('[EXP_CATCHUP] error', e);
  }
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
