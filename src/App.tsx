import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
import { useUiStore } from './stores/uiStore';
import { useEffect } from 'react';
import { images } from './assets/index';
import './styles/global.css';

const seedInventory = () => {
  const store = usePlayerStore.getState();
  if (store.level === 1 && store.dataChips === 100) {
    store.addLog('🔧 База данных инициализирована. Системы готовы.', 'system');
  }
};

const AppContent = () => {
  useGameLoop();
  const equipmentOpen = useUiStore((s) => s.equipmentOpen);
  const toggleEquipment = useUiStore((s) => s.toggleEquipment);

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
            <Route path="/" element={<Dashboard />} />
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
