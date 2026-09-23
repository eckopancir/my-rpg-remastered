import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { useInventoryStore } from '../stores/inventoryStore';
import { usePlayerStore } from '../stores/playerStore';
import { generateItem } from '../engine/items';
import { GAME_ITEMS } from '../data/GameItems';
import { syncNow } from '../utils/serverSync';
import { WapPanel } from '../components/ui/WapPanel';
import { WapHeader } from '../components/ui/WapHeader';
import { Button } from '../components/ui/Button';

export const Admin = () => {
  const user = useAuthStore((s) => s.user);
  const [dbInfo, setDbInfo] = useState<string | null>(null);

  if (!user?.is_admin) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ padding: 20 }}>
        <WapPanel variant="metal">
          <WapHeader title="ДОСТУП ЗАПРЕЩЁН" glow="amber" />
          <p style={{ fontFamily: 'var(--wa-font-terminal)', color: 'var(--text-muted)', fontSize: 12 }}>
            У вас нет прав администратора.
          </p>
        </WapPanel>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <WapPanel variant="metal" glow="amber">
        <WapHeader title="⚙️ ПАНЕЛЬ АДМИНИСТРАТОРА" glow="amber" />
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ fontSize: 32 }}>🛡️</div>
          <div>
            <div style={{ fontFamily: 'var(--wa-font-hud)', fontSize: 16, fontWeight: 600, color: 'var(--wa-accent-amber)' }}>
              {user.username}
            </div>
            <div style={{ fontFamily: 'var(--wa-font-terminal)', fontSize: 11, color: 'var(--text-muted)' }}>
              Администратор · ID: {user.id}
            </div>
          </div>
        </div>
      </WapPanel>

      <WapPanel variant="metal">
        <WapHeader title="ИНФОРМАЦИЯ О СЕРВЕРЕ" glow="none" />
        <div style={{ fontFamily: 'var(--wa-font-terminal)', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <div>PHP: {dbInfo || 'загрузка...'}</div>
        </div>
      </WapPanel>

      {/* ТЕСТ: выдача щитов милишника (временно, снести после теста) */}
      <WapPanel variant="metal">
        <WapHeader title="ТЕСТ: ЩИТЫ" glow="none" />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              const ps = usePlayerStore.getState();
              const inv = useInventoryStore.getState();
              let n = 0;
              for (let i = 0; i < 10; i++) {
                try {
                  const it = generateItem(GAME_ITEMS, Math.max(1, ps.level), null, null, 'shield') as any;
                  inv.addItem(it);
                  n++;
                } catch { /* ignore */ }
              }
              syncNow();
              ps.addLog(`🛡️ Тест: выдано щитов: ${n}`, 'loot');
            }}
          >
            🛡️ Выдать 10 щитов
          </Button>
          <span style={{ fontFamily: 'var(--wa-font-terminal)', fontSize: 11, color: 'var(--text-muted)' }}>
            Временно для теста милишника
          </span>
        </div>
      </WapPanel>
    </motion.div>
  );
};
