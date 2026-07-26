import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { usePlayerStore } from './playerStore';
import { useInventoryStore } from './inventoryStore';
import { useAuthStore } from './authStore';

const API_BASE = '/api/exploration';

export interface ServerExploration {
  id: number;
  zone: string;
  phase: string;
  timeLeft: number;
  tickCount: number;
  totalChips: number;
  totalExp: number;
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

  startExploration: (zoneName: string) => Promise<void>;
  cancelExploration: () => Promise<void>;
  pollServerState: () => Promise<void>;
  completeExploration: () => void;
  resetExploration: () => void;
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
        usePlayerStore.getState().addLog('🛑 Исследование прервано.', 'warning');
        syncInventoryFromServer(token);
        set({
          isExploring: false, zoneName: null, phase: 'idle', serverPhase: '',
          serverOutcome: null, timeLeft: 0, tickCount: 0,
          eventLog: [], totalChips: 0, totalExp: 0, totalItems: 0,
          explorationId: null, error: null,
        });
      },

      pollServerState: async () => {
        const state = get();
        if (!state.isExploring) return;

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

          // Apply effects from new events client-side
          const newEvents = allRecentEvents.filter((e: any) => e.id > state.processedEventId);
          if (newEvents.length > 0) {
            const maxId = Math.max(...newEvents.map((e: any) => e.id));
            for (const evt of newEvents) {
              applyLocalEffects(evt.effects);
            }
            set({ processedEventId: maxId });
          }

          // Sync player data from server to prevent dashboard sync from overwriting
          const playerData = data.player as { dataChips?: number; currentExp?: number; currentHp?: number } | undefined;
          if (playerData) {
            const ps = usePlayerStore.getState();
            const patch: Record<string, any> = {};
            if (playerData.dataChips !== undefined) patch.dataChips = playerData.dataChips;
            if (playerData.currentExp !== undefined) patch.currentExp = playerData.currentExp;
            if (playerData.currentHp !== undefined) {
              patch.stats = { ...ps.stats, currentHp: playerData.currentHp };
            }
            usePlayerStore.setState(patch);
          }

          if (!data.active) {
            // Sync inventory once on completion
            syncInventoryFromServer(token);
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
        } catch {
          // silent
        }
      },

      completeExploration: () => {
        const state = get();
        usePlayerStore.getState().addLog(
          state.serverOutcome === 'dead' ? '💀 Герой погиб.'
          : `🏁 Исследование "${state.zoneName}" завершено!`, 'loot');
        const token = getToken();
        if (token) syncInventoryFromServer(token);
        set({
          isExploring: false, zoneName: null, phase: 'idle', serverPhase: '',
          serverOutcome: null, timeLeft: 0, tickCount: 0,
          eventLog: [], totalChips: 0, totalExp: 0, totalItems: 0,
          explorationId: null,
        });
      },

      resetExploration: () => {
        set({
          isExploring: false, zoneName: null, phase: 'idle', serverPhase: '',
          serverOutcome: null, timeLeft: 0, tickCount: 0,
          eventLog: [], totalChips: 0, totalExp: 0, totalItems: 0,
          explorationId: null, error: null,
        });
      },
    }),
    {
      name: 'remastered_exploration',
      version: 4,
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
    },
  ),
);

export async function catchUpExploration() {
  const store = useExplorationStore.getState();
  if (!store.isExploring) return;
  await store.pollServerState();
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
      patch.dataChips = ps.dataChips + eff.chips;
    }
    if (eff.exp && typeof eff.exp === 'number') {
      patch.currentExp = ps.currentExp + eff.exp;
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
