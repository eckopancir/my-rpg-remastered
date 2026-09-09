import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ExpeditionEntry {
  id: string;
  zoneName: string;
  encounterIds: string[];
  status: 'pending' | 'active' | 'completed';
  duration: number;
  remaining: number;
  difficulty: number;
  cardData?: {
    enemyKeys: string[];
    chipReward: number;
    xpReward: number;
    cardRarityName: string;
  };
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

let toastId = 0;

interface UiStore {
  sidebarOpen: boolean;
  queue: ExpeditionEntry[];
  toasts: Toast[];
  gameTick: number;
  soundEnabled: boolean;
  musicEnabled: boolean;
  musicVolume: number;
  uiVolume: number;
  arenaVolume: number;
  rangeVolume: number;
  showDamageNumbers: boolean;
  battleLogSize: number;
  autoReload: boolean;
  confirmExitCombat: boolean;
  showEnemyHpNumbers: boolean;
  duckMusicInCombat: boolean;
  isResting: boolean;
  craftingTimer: number;
  craftingTimerMax: number;
  craftingType: 'merge' | 'create' | 'upgrade' | null;
  craftingLabel: string;
  inventoryOpen: boolean;
  equipmentOpen: boolean;
  rangeOpen: boolean;
  draggedItemId: string | null;
  inventoryPinned: boolean;
  inventoryPinPos: { x: number; y: number };
  equipmentPinned: boolean;
  equipmentPinPos: { x: number; y: number };

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setCraftingTimer: (timer: number) => void;
  setCraftingTimerMax: (max: number) => void;
  setCraftingType: (type: 'merge' | 'create' | 'upgrade' | null) => void;
  setCraftingLabel: (label: string) => void;
  toggleInventory: () => void;
  setInventoryOpen: (open: boolean) => void;
  toggleEquipment: () => void;
  setEquipmentOpen: (open: boolean) => void;
  toggleRange: () => void;
  setRangeOpen: (open: boolean) => void;
  setDraggedItemId: (id: string | null) => void;
  setInventoryPinned: (pinned: boolean) => void;
  setInventoryPinPos: (pos: { x: number; y: number }) => void;
  setEquipmentPinned: (pinned: boolean) => void;
  setEquipmentPinPos: (pos: { x: number; y: number }) => void;
  backpackLocked: boolean;
  setBackpackLocked: (locked: boolean) => void;

  addToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;

  setSoundEnabled: (enabled: boolean) => void;
  setMusicEnabled: (enabled: boolean) => void;
  setMusicVolume: (volume: number) => void;
  setUiVolume: (volume: number) => void;
  setArenaVolume: (volume: number) => void;
  setRangeVolume: (volume: number) => void;
  setShowDamageNumbers: (v: boolean) => void;
  setBattleLogSize: (v: number) => void;
  setAutoReload: (v: boolean) => void;
  setConfirmExitCombat: (v: boolean) => void;
  setShowEnemyHpNumbers: (v: boolean) => void;
  setDuckMusicInCombat: (v: boolean) => void;

  addToQueue: (entry: ExpeditionEntry) => void;
  removeFromQueue: (id: string) => void;
  updateQueueEntry: (id: string, partial: Partial<ExpeditionEntry>) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  hasEncounterInQueue: (encounterId: string) => boolean;
  getNextActive: () => ExpeditionEntry | undefined;
  processQueue: () => void;

  tick: () => void;
  setIsResting: (v: boolean) => void;
}

export const useUiStore = create<UiStore>()(
  persist(
    (set, get) => ({
      sidebarOpen: true,
      queue: [],
      toasts: [],
      gameTick: 0,
      soundEnabled: true,
      musicEnabled: true,
      musicVolume: 0.2,
      uiVolume: 1,
      arenaVolume: 1,
      rangeVolume: 1,
      showDamageNumbers: true,
      battleLogSize: 20,
      autoReload: true,
      confirmExitCombat: true,
      showEnemyHpNumbers: false,
      duckMusicInCombat: false,
      isResting: false,
      craftingTimer: 0,
      craftingTimerMax: 0,
      craftingType: null,
      craftingLabel: '',
      inventoryOpen: false,
      equipmentOpen: false,
      rangeOpen: false,
      draggedItemId: null,
      inventoryPinned: false,
      inventoryPinPos: { x: 60, y: 60 },
      equipmentPinned: false,
      equipmentPinPos: { x: 60, y: 60 },
      // Замочек НЕ персистим: каждая загрузка — заблочен по умолчанию.
      backpackLocked: true,

      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      addToast: (message, type = 'info') => {
        const id = `toast-${++toastId}-${Date.now()}`;
        set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
        setTimeout(() => get().removeToast(id), 3000);
      },
      removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      setCraftingTimer: (timer) => set({ craftingTimer: timer }),
      setCraftingTimerMax: (max) => set({ craftingTimerMax: max }),
      setCraftingType: (type) => set({ craftingType: type }),
      setCraftingLabel: (label) => set({ craftingLabel: label }),
      setInventoryOpen: (open) => set({ inventoryOpen: open }),
      toggleInventory: () => set((s) => ({ inventoryOpen: !s.inventoryOpen })),
      setEquipmentOpen: (open) => set({ equipmentOpen: open }),
      toggleEquipment: () => set((s) => ({ equipmentOpen: !s.equipmentOpen })),
      setRangeOpen: (open) => set({ rangeOpen: open }),
      toggleRange: () => set((s) => ({ rangeOpen: !s.rangeOpen })),
      setDraggedItemId: (id) => set({ draggedItemId: id }),
      setInventoryPinned: (pinned) => set({ inventoryPinned: pinned }),
      setInventoryPinPos: (pos) => set({ inventoryPinPos: pos }),
      setEquipmentPinned: (pinned) => set({ equipmentPinned: pinned }),
      setEquipmentPinPos: (pos) => set({ equipmentPinPos: pos }),
      setBackpackLocked: (locked: any) => set((s) => ({
        backpackLocked: typeof locked === 'function' ? !!locked(s.backpackLocked) : !!locked,
      })),

      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
      setMusicEnabled: (enabled) => set({ musicEnabled: enabled }),
      setMusicVolume: (volume) => set({ musicVolume: Math.max(0, Math.min(1, volume)) }),
      setUiVolume: (volume) => set({ uiVolume: Math.max(0, Math.min(1, volume)) }),
      setArenaVolume: (volume) => set({ arenaVolume: Math.max(0, Math.min(1, volume)) }),
      setRangeVolume: (volume) => set({ rangeVolume: Math.max(0, Math.min(1, volume)) }),
      setShowDamageNumbers: (v) => set({ showDamageNumbers: v }),
      setBattleLogSize: (v) => set({ battleLogSize: [10, 20, 50].includes(v) ? v : 20 }),
      setAutoReload: (v) => set({ autoReload: v }),
      setConfirmExitCombat: (v) => set({ confirmExitCombat: v }),
      setShowEnemyHpNumbers: (v) => set({ showEnemyHpNumbers: v }),
      setDuckMusicInCombat: (v) => set({ duckMusicInCombat: v }),

      addToQueue: (entry) => set((s) => ({ queue: [...s.queue, entry] })),
      removeFromQueue: (id) => set((s) => ({ queue: s.queue.filter((e) => e.id !== id) })),
      updateQueueEntry: (id, partial) => set((s) => ({
        queue: s.queue.map((e) => (e.id === id ? { ...e, ...partial } : e)),
      })),
      reorderQueue: (fromIndex, toIndex) => set((s) => {
        const newQueue = [...s.queue];
        const [moved] = newQueue.splice(fromIndex, 1);
        newQueue.splice(toIndex, 0, moved);
        return { queue: newQueue };
      }),

      hasEncounterInQueue: (encounterId) => {
        return get().queue.some((e) => e.encounterIds.includes(encounterId));
      },

      getNextActive: () => {
        return get().queue.find((e) => e.status === 'active');
      },

      processQueue: () => {
        const state = get();
        const hasActive = state.queue.some((e) => e.status === 'active');
        if (!hasActive) {
          const nextPending = state.queue.find((e) => e.status === 'pending');
          if (nextPending) {
            set((s) => ({
              queue: s.queue.map((e) =>
                e.id === nextPending.id ? { ...e, status: 'active' as const } : e
              ),
            }));
          }
        }
      },

      tick: () => {
        const state = get();
        set({ gameTick: state.gameTick + 1 });

        // Tick active queue
        let queueChanged = false;
        const newQueue = state.queue.map((e) => {
          if (e.status === 'active') {
            const newRemaining = e.remaining - 1;
            if (newRemaining <= 0) {
              queueChanged = true;
              return { ...e, status: 'completed' as const, remaining: 0 };
            }
            return { ...e, remaining: newRemaining };
          }
          return e;
        });

        if (queueChanged) {
          set({ queue: newQueue });
          setTimeout(() => get().processQueue(), 100);
        } else {
          set({ queue: newQueue });
        }

        // Tick crafting timer (works even when Craft page is not mounted)
        if (state.craftingTimer > 0) {
          const next = state.craftingTimer - 1;
          if (next <= 0) {
            if (state.craftingType === 'upgrade') {
              set({ craftingTimer: 0 });
            } else {
              set({ craftingTimer: 0, craftingType: null, craftingLabel: '', craftingTimerMax: 0 });
            }
          } else {
            set({ craftingTimer: next });
          }
        }
      },

      setIsResting: (v) => set({ isResting: v }),
    }),
    {
      name: 'remastered_ui',
      version: 6,
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>;
        if (version < 4) {
          state.craftingTimer = 0;
          state.craftingTimerMax = 0;
          state.craftingType = null;
          state.craftingLabel = '';
          state.queue = [];
        }
        if (version < 5) {
          if (state.uiVolume === undefined) state.uiVolume = 1;
          if (state.arenaVolume === undefined) state.arenaVolume = 1;
          if (state.rangeVolume === undefined) state.rangeVolume = 1;
          if (state.showDamageNumbers === undefined) state.showDamageNumbers = true;
          if (state.battleLogSize === undefined) state.battleLogSize = 20;
          if (state.autoReload === undefined) state.autoReload = true;
          if (state.confirmExitCombat === undefined) state.confirmExitCombat = true;
          if (state.showEnemyHpNumbers === undefined) state.showEnemyHpNumbers = false;
          if (state.duckMusicInCombat === undefined) state.duckMusicInCombat = false;
        }
        if (version < 6) {
          if (state.backpackLocked === undefined) state.backpackLocked = false;
        }
        return state as UiStore;
      },
      partialize: (state) => ({
        queue: state.queue,
        soundEnabled: state.soundEnabled,
        musicEnabled: state.musicEnabled,
        musicVolume: state.musicVolume,
        uiVolume: state.uiVolume,
        arenaVolume: state.arenaVolume,
        rangeVolume: state.rangeVolume,
        showDamageNumbers: state.showDamageNumbers,
        battleLogSize: state.battleLogSize,
        autoReload: state.autoReload,
        confirmExitCombat: state.confirmExitCombat,
        showEnemyHpNumbers: state.showEnemyHpNumbers,
        duckMusicInCombat: state.duckMusicInCombat,
        inventoryPinned: state.inventoryPinned,
        inventoryPinPos: state.inventoryPinPos,
        equipmentPinned: state.equipmentPinned,
        equipmentPinPos: state.equipmentPinPos,
      }),
    },
  ),
);
