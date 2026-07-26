import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { PageContainer } from './components/layout/PageContainer';
import { AuthGuard } from './components/auth/AuthGuard';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Map } from './pages/Map';
import { Equipment } from './pages/Equipment';
import { Base } from './pages/Base';
import { Bazaar } from './pages/Bazaar';
import { Craft } from './pages/Craft';
import { Battle } from './pages/Battle';
import { Settings } from './pages/Settings';
import { Skills } from './pages/Skills';
import { Expedition } from './pages/Expedition';
import { AutoExploration } from './pages/AutoExploration';
import { Adventures } from './pages/Adventures';
import { Admin } from './pages/Admin';
import { MusicPlayer } from './components/widgets/MusicPlayer';
import { InventoryOverlay } from './components/widgets/InventoryOverlay';
import { useGameLoop } from './hooks/useGameLoop';
import { usePlayerStore } from './stores/playerStore';
import { useInventoryStore } from './stores/inventoryStore';
import { useExplorationStore } from './stores/explorationStore';
import { useUiStore } from './stores/uiStore';
import { useAuthStore } from './stores/authStore';
import { useEffect, useRef } from 'react';
import { images } from './assets/index';
import './styles/global.css';

const API_BASE = '/api';

const gatherSaveData = () => {
  const ui = useUiStore.getState();
  const { craftingTimer, craftingTimerMax, craftingType, craftingLabel, queue, ...safeUi } = ui;
  return {
    player: usePlayerStore.getState(),
    inventory: useInventoryStore.getState(),
    exploration: useExplorationStore.getState(),
    ui: safeUi,
  };
};

const syncInventoryToServer = async (token: string) => {
  const items = useInventoryStore.getState().items;
  try {
    await fetch(`${API_BASE}/inventory/sync.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ items }),
    });
  } catch {
    // silent
  }
};

const loadInventoryFromServer = async (token: string): Promise<boolean> => {
  try {
    const res = await fetch(`${API_BASE}/inventory/load.php`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return false;
    const json = await res.json();
    if (json.items && json.items.length > 0) {
      useInventoryStore.getState().setItems(json.items);
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

const seedInventory = () => {
  const store = usePlayerStore.getState();
  if (store.level === 1 && store.dataChips === 100) {
    store.addLog('🔧 База данных инициализирована. Системы готовы.', 'system');
  }
};

const SAVE_INTERVAL_MS = 60000;

const AppContent = () => {
  useGameLoop();
  const equipmentOpen = useUiStore((s) => s.equipmentOpen);
  const toggleEquipment = useUiStore((s) => s.toggleEquipment);
  const token = useAuthStore((s) => s.token);
  const saveGame = useAuthStore((s) => s.saveGame);
  const loadGame = useAuthStore((s) => s.loadGame);
  const loadedRef = useRef(false);

  useEffect(() => {
    seedInventory();
    usePlayerStore.getState().recalcStats();
    if (images.background) {
      document.body.style.backgroundImage = `url(${images.background})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundAttachment = 'fixed';
    }
  }, []);

  // Load save from server on mount (once)
  useEffect(() => {
    if (!token || loadedRef.current) return;
    loadedRef.current = true;

    const doLoad = async () => {
      const hasInventory = await loadInventoryFromServer(token);

      // Load equipment from server
      try {
        const equipRes = await fetch(`${API_BASE}/player/load-equipment.php`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (equipRes.ok) {
          const equipJson = await equipRes.json();
          if (equipJson.equipment && Object.keys(equipJson.equipment).length > 0) {
            usePlayerStore.setState({ equipment: equipJson.equipment });
          }
        }
      } catch { /* fallback to blob */ }

      const data = await loadGame();
      if (!data) return;

      if (data.player) {
        usePlayerStore.setState(data.player as any);
        // Skills are now server-authoritative — reload from DB after restore
        usePlayerStore.getState().loadSkills();
      }
      if (!hasInventory && data.inventory) {
        useInventoryStore.setState(data.inventory as any);
      }
      if (data.exploration) useExplorationStore.setState(data.exploration as any);
      if (data.ui) {
        // Strip any stale crafting fields from old server saves
        const { craftingTimer: _ct, craftingTimerMax: _ctm, craftingType: _cty, craftingLabel: _cl, ...cleanUi } = data.ui as any;
        useUiStore.setState({
          ...cleanUi,
          queue: [],
        });
      }
      usePlayerStore.getState().recalcStats();

      // Restore active base upgrade in sidebar (works on any page)
      try {
        const baseRes = await fetch(`${API_BASE}/base/load.php`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (baseRes.ok) {
          const baseJson = await baseRes.json();
          const ui = useUiStore.getState();
          let hasActiveUpgrade = false;
          for (const u of baseJson.upgrades || []) {
            if (u.upgrading && u.timerExpiresAt) {
              const remaining = Math.max(0, Math.floor((u.timerExpiresAt - Date.now()) / 1000));
              const totalDuration = u.timerDuration || Math.floor(18000 * Math.pow(u.level + 1, 1.3));
              ui.setCraftingType('upgrade');
              ui.setCraftingLabel(`${u.baseName} ур.${u.level + 1}`);
              ui.setCraftingTimer(remaining);
              ui.setCraftingTimerMax(totalDuration);
              hasActiveUpgrade = true;
            }
          }
          if (!hasActiveUpgrade && useUiStore.getState().craftingType === 'upgrade') {
            ui.setCraftingTimer(0);
            ui.setCraftingType(null);
            ui.setCraftingLabel('');
          }
        }
      } catch { /* silent */ }
    };

    doLoad();
  }, [token]);

  // Periodic auto-save
  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => {
      saveGame(gatherSaveData());
      syncInventoryToServer(token);
    }, SAVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [token]);

  // Save on tab close
  useEffect(() => {
    if (!token) return;
    const onUnload = () => {
      const data = gatherSaveData();
      const items = useInventoryStore.getState().items;
      fetch(`${API_BASE}/save.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ data }),
        keepalive: true,
      });
      fetch(`${API_BASE}/inventory/sync.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items }),
        keepalive: true,
      });
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [token]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'e' || e.key === 'E') { toggleEquipment(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleEquipment]);

  return (
    <AuthGuard>
      <MusicPlayer />
      <InventoryOverlay />
      {equipmentOpen && <Equipment />}
      <AnimatePresence mode="wait">
        <Routes>
          <Route element={<PageContainer />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/skills" element={<Skills />} />
          <Route path="/map" element={<Map />} />
            <Route path="/adventure" element={<Adventures />} />
            <Route path="/expedition" element={<Expedition />} />
            <Route path="/explore" element={<AutoExploration />} />
            <Route path="/base" element={<Base />} />
            <Route path="/bazaar" element={<Bazaar />} />
            <Route path="/craft" element={<Craft />} />
            <Route path="/battle" element={<Battle />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/equipment" element={<Dashboard />} />
          </Route>
        </Routes>
      </AnimatePresence>
    </AuthGuard>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<AppContent />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
