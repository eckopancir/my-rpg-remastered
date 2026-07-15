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
  isResting: boolean;
  craftingTimer: number;
  craftingType: 'merge' | 'create' | 'upgrade' | null;
  craftingLabel: string;
  upgradingBase: string | null;
  inventoryOpen: boolean;
  equipmentOpen: boolean;
  draggedItemId: string | null;
  inventoryPinned: boolean;
  inventoryPinPos: { x: number; y: number };
  equipmentPinned: boolean;
  equipmentPinPos: { x: number; y: number };

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setCraftingTimer: (timer: number) => void;
  setCraftingType: (type: 'merge' | 'create' | 'upgrade' | null) => void;
  setCraftingLabel: (label: string) => void;
  setUpgradingBase: (name: string | null) => void;
  toggleInventory: () => void;
  setInventoryOpen: (open: boolean) => void;
  toggleEquipment: () => void;
  setEquipmentOpen: (open: boolean) => void;
  setDraggedItemId: (id: string | null) => void;
  setInventoryPinned: (pinned: boolean) => void;
  setInventoryPinPos: (pos: { x: number; y: number }) => void;
  setEquipmentPinned: (pinned: boolean) => void;
  setEquipmentPinPos: (pos: { x: number; y: number }) => void;

  addToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;

  setSoundEnabled: (enabled: boolean) => void;
  setMusicEnabled: (enabled: boolean) => void;
  setMusicVolume: (volume: number) => void;

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
      isResting: false,
      craftingTimer: 0,
      craftingType: null,
      craftingLabel: '',
      upgradingBase: null,
      inventoryOpen: false,
      equipmentOpen: false,
      draggedItemId: null,
      inventoryPinned: false,
      inventoryPinPos: { x: 60, y: 60 },
      equipmentPinned: false,
      equipmentPinPos: { x: 60, y: 60 },

      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      addToast: (message, type = 'info') => {
        const id = `toast-${++toastId}-${Date.now()}`;
        set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
        setTimeout(() => get().removeToast(id), 3000);
      },
      removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      setCraftingTimer: (timer) => set({ craftingTimer: timer }),
      setCraftingType: (type) => set({ craftingType: type }),
      setCraftingLabel: (label) => set({ craftingLabel: label }),
      setUpgradingBase: (name) => set({ upgradingBase: name }),
      setInventoryOpen: (open) => set({ inventoryOpen: open }),
      toggleInventory: () => set((s) => ({ inventoryOpen: !s.inventoryOpen })),
      setEquipmentOpen: (open) => set({ equipmentOpen: open }),
      toggleEquipment: () => set((s) => ({ equipmentOpen: !s.equipmentOpen })),
      setDraggedItemId: (id) => set({ draggedItemId: id }),
      setInventoryPinned: (pinned) => set({ inventoryPinned: pinned }),
      setInventoryPinPos: (pos) => set({ inventoryPinPos: pos }),
      setEquipmentPinned: (pinned) => set({ equipmentPinned: pinned }),
      setEquipmentPinPos: (pos) => set({ equipmentPinPos: pos }),

      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
      setMusicEnabled: (enabled) => set({ musicEnabled: enabled }),
      setMusicVolume: (volume) => set({ musicVolume: Math.max(0, Math.min(1, volume)) }),

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
          // Process next in queue
          setTimeout(() => get().processQueue(), 100);
        } else {
          set({ queue: newQueue });
        }
      },

      setIsResting: (v) => set({ isResting: v }),
    }),
    {
      name: 'remastered_ui',
      version: 1,
      partialize: (state) => ({
        queue: state.queue,
        craftingTimer: state.craftingTimer,
        craftingType: state.craftingType,
        craftingLabel: state.craftingLabel,
        upgradingBase: state.upgradingBase,
        soundEnabled: state.soundEnabled,
        musicEnabled: state.musicEnabled,
        musicVolume: state.musicVolume,
        inventoryPinned: state.inventoryPinned,
        inventoryPinPos: state.inventoryPinPos,
        equipmentPinned: state.equipmentPinned,
        equipmentPinPos: state.equipmentPinPos,
      }),
    },
  ),
);
