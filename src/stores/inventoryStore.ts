import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Item } from '../types/items';

export type InvTab = 'weapons' | 'armor' | 'consumables' | 'mods' | 'materials' | 'all';
export type SortKey = 'name' | 'level' | 'rarity' | 'price';

interface InventoryStore {
  items: Item[];
  sellItems: Item[];
  currentPage: number;
  activeTab: InvTab;
  sortKey: SortKey;
  sortAsc: boolean;
  searchQuery: string;
  filterRarity: string[];
  filterSlot: string;

  setItems: (items: Item[]) => void;
  addItem: (item: Item) => void;
  removeItem: (id: string) => void;
  moveItem: (fromIndex: number, toIndex: number) => void;
  setCurrentPage: (page: number) => void;
  setActiveTab: (tab: InvTab) => void;
  setSortKey: (key: SortKey) => void;
  toggleSortAsc: () => void;
  setSearchQuery: (q: string) => void;
  setFilterRarity: (rarities: string[]) => void;
  setFilterSlot: (slot: string) => void;
  addToSell: (item: Item) => void;
  removeFromSell: (index: number) => void;
  clearSell: () => void;
}

const OLD_RESOURCE_NAMES = new Set([
  'Пластик', 'Металл', 'Ткань', 'Резина', 'Стекло', 'Электроника',
  'Химикаты', 'Топливо', 'Цемент', 'Сплавы', 'Детали', 'Микросхемы', 'Древесина',
]);

const REMAP_RESOURCE: Record<string, string> = {
  'Древесина': 'Дерево',
  'Пластик': 'Пластмасса',
};

export const useInventoryStore = create<InventoryStore>()(
  persist(
    (set) => ({
      items: [],
      sellItems: [],
      currentPage: 0,
      activeTab: 'all',
      sortKey: 'level',
      sortAsc: false,
      searchQuery: '',
      filterRarity: [],
      filterSlot: '',

      setItems: (items) => set({ items }),
      addItem: (item) => set((s) => ({ items: [...s.items, item] })),
      removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      moveItem: (fromIndex, toIndex) => set((s) => {
        const newItems = [...s.items];
        const [moved] = newItems.splice(fromIndex, 1);
        newItems.splice(toIndex, 0, moved);
        return { items: newItems };
      }),

      setCurrentPage: (page) => set({ currentPage: page }),
      setActiveTab: (tab) => set({ activeTab: tab, currentPage: 0 }),
      setSortKey: (key) => set({ sortKey: key }),
      toggleSortAsc: () => set((s) => ({ sortAsc: !s.sortAsc })),
      setSearchQuery: (q) => set({ searchQuery: q, currentPage: 0 }),
      setFilterRarity: (rarities) => set({ filterRarity: rarities, currentPage: 0 }),
      setFilterSlot: (slot) => set({ filterSlot: slot, currentPage: 0 }),

      addToSell: (item) => set((s) => ({ sellItems: [...s.sellItems, item] })),
      removeFromSell: (index) => set((s) => ({
        sellItems: s.sellItems.filter((_, i) => i !== index),
      })),
      clearSell: () => set({ sellItems: [] }),
    }),
    {
      name: 'inventory',
      version: 2,
      partialize: (state) => ({
        items: state.items,
        currentPage: state.currentPage,
        filterSlot: state.filterSlot,
      }),
      migrate: (persisted: any) => {
        if (!persisted?.items) return persisted;
        persisted.items = persisted.items.filter((item: any) => {
          if (item.type === 'material' || item.type === 'resources') {
            if (OLD_RESOURCE_NAMES.has(item.name)) return false;
            const renamed = REMAP_RESOURCE[item.name];
            if (renamed) { item.name = renamed; item.displayName = renamed; }
          }
          return true;
        });
        return persisted;
      },
    },
  ),
);
