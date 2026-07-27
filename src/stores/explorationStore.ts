import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { usePlayerStore } from './playerStore';
import { useInventoryStore } from './inventoryStore';
import { useAuthStore } from './authStore';
import { generateItem, type GeneratedItem } from '../engine/items';
import { GAME_ITEMS } from '../data/GameItems';


const API_BASE = '/api/exploration';

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

  startExploration: (zoneName: string) => Promise<void>;
  cancelExploration: () => Promise<void>;
  pollServerState: () => Promise<void>;
  completeExploration: () => void;
  resetExploration: () => void;
  processPendingRewards: () => Promise<void>;
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

      startExploration: async (zoneName) => {
        const token = getToken();
        if (!token) { set({ error: 'Not authenticated' }); return; }
        try {
          const res = await fetch(`${API_BASE}/start.php?zone=${encodeURIComponent(zoneName)}`, {
            headers: { Authorization: `Bearer ${token}` },
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
        usePlayerStore.getState().addLog('🛑 Возвращаемся на базу... 30 сек до прибытия.', 'warning');
        set({
          phase: 'travel_back',
          serverPhase: 'travel_back',
          timeLeft: 30,
          isInfinite: false,
          isReturningHome: true,
        });
      },

      pollServerState: async () => {
        const state = get();
        if (!state.isExploring) return;

        // Return journey countdown
        if (state.isReturningHome) {
          const newTimeLeft = state.timeLeft - 1;
          if (newTimeLeft <= 0) {
            set({ timeLeft: 0, isReturningHome: false });
            get().completeExploration();
            return;
          }
          set({ timeLeft: newTimeLeft });
        }

        const token = getToken();
        if (!token) return;

        try {
          const res = await fetch(`${API_BASE}/status.php`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (!res.ok) return;

          const exp = data.exploration as ServerExploration | undefined;
          const allRecentEvents: any[] = data.events ?? [];
          const serverOutcome = data.state ?? 'active';

          // Process new events (effects + resources)
          const newEvents = allRecentEvents.filter((e: any) => e.id > state.processedEventId);
          const inv = useInventoryStore.getState();
          if (newEvents.length > 0) {
            const maxId = Math.max(...newEvents.map((e: any) => e.id));
            for (const evt of newEvents) {
              applyLocalEffects(evt.effects);
              if (evt.resource_had && evt.resource_cost) {
                inv.consumeItemByName(evt.resource_cost);
              }
            }
            set({ processedEventId: maxId });
          }

          // Sync player data from server (HP only — XP is applied via applyLocalEffects → addExp)
          const playerData = data.player as { currentHp?: number } | undefined;
          if (playerData?.currentHp !== undefined) {
            const ps = usePlayerStore.getState();
            if (playerData.currentHp !== ps.stats.currentHp) {
              usePlayerStore.setState({ stats: { ...ps.stats, currentHp: playerData.currentHp } });
            }
          }

          if (!data.active) {
            set({
              isExploring: false,
              phase: 'complete', serverPhase: 'complete',
              serverOutcome,
              eventLog: allRecentEvents,
              totalChips: exp?.totalChips ?? 0,
              totalExp: exp?.totalExp ?? 0,
              tickCount: exp?.tickCount ?? 0,
              processedEventId: 0,
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
              eventLog: allRecentEvents.length > 0 ? allRecentEvents : state.eventLog,
            });
          }
          // Process pending rewards after each poll
          await get().processPendingRewards();
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
                newItems[eventId] = { items: cached.items, saved: true };
                changed = true;
              }
              continue;
            }

            // Generate new items
            const items: GeneratedItem[] = [];
            for (let i = 0; i < itemCount; i++) {
              items.push(generateItem(GAME_ITEMS, rewardPlayerLevel));
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
      version: 7,
      migrate: (persisted: any) => {
        const clean = { ...persisted };
        delete clean.eventRewardItems;
        delete clean.isProcessingRewards;
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
      await store.pollServerState();
    }
    await store.processPendingRewards();
  } catch {
    // silent
  }
}

// Apply effects from a JSON effects string to the player store (client-side safety net)
function applyLocalEffects(effectsJson: string) {
  if (!effectsJson || effectsJson === '{}') return;
  try {
    const eff = JSON.parse(effectsJson);
    if (!eff || typeof eff !== 'object') return;
    const ps = usePlayerStore.getState();
    const patch: Record<string, any> = {};

    if (eff.chips && typeof eff.chips === 'number') {
      usePlayerStore.getState().addChips(eff.chips);
    }
    if (eff.exp && typeof eff.exp === 'number') {
      usePlayerStore.getState().addExp(eff.exp);
    }
    if (eff.healPercent && typeof eff.healPercent === 'number') {
      const maxHp = ps.stats.maxHp || 10000;
      const healAmt = Math.round(maxHp * eff.healPercent);
      patch.stats = { ...ps.stats, currentHp: Math.min(maxHp, ps.stats.currentHp + healAmt) };
    }
    if (eff.damagePercent && typeof eff.damagePercent === 'number') {
      const maxHp = ps.stats.maxHp || 10000;
      const dmgAmt = Math.round(maxHp * eff.damagePercent);
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
