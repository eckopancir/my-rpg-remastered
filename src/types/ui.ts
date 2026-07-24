export type Page =
  | 'dashboard'
  | 'map'
  | 'expedition'
  | 'inventory'
  | 'equipment'
  | 'base'
  | 'bazaar'
  | 'craft'
  | 'battle'
  | 'settings';

export interface TooltipState {
  itemId: string | null;
  x: number;
  y: number;
}

export interface QueueEntry {
  id: string;
  zoneName: string;
  encounterIds: string[];
  startTime: number | null;
  duration: number;
  status: 'pending' | 'active' | 'completed';
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration: number;
}
