// Немедленный сейв всего состояния на сервер (вне 60-секундного автосейва).
// Нужен после действий, которые пользователь может не пережить до автосейва:
// «Выложить всё», зарядка/разрядка магазина и т.п. Иначе refresh откатывает.
import { usePlayerStore } from '../stores/playerStore';
import { useInventoryStore } from '../stores/inventoryStore';
import { useExplorationStore } from '../stores/explorationStore';
import { useUiStore } from '../stores/uiStore';
import { useAuthStore } from '../stores/authStore';

export const syncNow = (): void => {
  try {
    const token = useAuthStore.getState().token;
    if (!token) return;
    const ui = useUiStore.getState() as any;
    const { craftingTimer, craftingTimerMax, craftingType, craftingLabel, queue, ...safeUi } = ui;
    const data = {
      player: usePlayerStore.getState(),
      inventory: useInventoryStore.getState(),
      exploration: useExplorationStore.getState(),
      ui: safeUi,
    };
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    fetch('/api/save.php', {
      method: 'POST',
      headers,
      body: JSON.stringify({ data }),
    }).catch(() => {});
    fetch('/api/inventory/sync.php', {
      method: 'POST',
      headers,
      body: JSON.stringify({ items: useInventoryStore.getState().items }),
    }).catch(() => {});
  } catch { /* best effort */ }
};
