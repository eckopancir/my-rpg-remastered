import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { WapPanel } from '../components/ui/WapPanel';
import { WapHeader } from '../components/ui/WapHeader';

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
    </motion.div>
  );
};
