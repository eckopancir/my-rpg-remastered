import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { WapPanel } from '../components/ui/WapPanel';
import { ZONES, type Zone } from '../data/zones';
import { usePlayerStore } from '../stores/playerStore';
import { useExplorationStore } from '../stores/explorationStore';
import militaryBg from '../assets/images/map/military.png';

const LOCKED_ZONES = new Set([
  'Болото', 'Свалка мусора', 'Темный лес',
  'База бандитов', 'Руины города', 'Старый завод',
]);

export const Map = () => {
  const navigate = useNavigate();
  const isTraveling = usePlayerStore((s) => s.travel.isTraveling);
  const isNight = new Date().getHours() < 6 || new Date().getHours() >= 20;

  if (isTraveling) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
      >
        <WapPanel variant="metal" padding="lg" glow="amber" style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>🚀 В пути...</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Ты уже в экспедиции. Вернись на базу или дождись завершения.
          </div>
        </WapPanel>
      </motion.div>
    );
  }

  const handleZoneClick = (zone: Zone) => {
    if (zone.name === 'Наша база') {
      navigate('/base');
      return;
    }
    if (zone.name === 'Базар') {
      navigate('/bazaar');
      return;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}
    >
      <WapPanel variant="metal" padding="lg" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>🗺️ Карта мира {isNight ? '🌙' : '☀️'}</div>
        </div>

        {isNight && (
          <div style={{ fontSize: 10, color: 'var(--accent-warning)', marginBottom: 8, padding: '4px 8px', background: 'rgba(251,191,36,0.1)', borderRadius: 'var(--radius-sm)' }}>
            🌙 Ночь — враги получают -20% к точности, но твоя меткость снижена на 10%
          </div>
        )}
        {/* Zones grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            flex: 1,
          }}
        >
          {ZONES.filter((z) => z.name !== 'Наша база' && z.name !== 'Базар').map((zone) => {
            const isLocked = LOCKED_ZONES.has(zone.name);
            const isMilitary = zone.name === 'Заброшенная военная база и окрестности';
            const handleAutoExplore = (e: React.MouseEvent) => {
              e.stopPropagation();
              useExplorationStore.getState().startExploration(zone.name, zone.difficulty, zone.allowedFactions);
              navigate(`/explore?zone=${encodeURIComponent(zone.name)}`);
            };
            return (
              <motion.div
                key={zone.name}
                whileHover={!isLocked ? { scale: 1.03 } : undefined}
                whileTap={!isLocked ? { scale: 0.97 } : undefined}
                onClick={() => handleZoneClick(zone)}
                onDoubleClick={isMilitary ? () => navigate(`/expedition?zone=${encodeURIComponent(zone.name)}&count=3`) : undefined}
                style={{
                  padding: 20,
                  background: isMilitary
                    ? `linear-gradient(rgba(0,0,0,0.15), rgba(0,0,0,0.15)), url(${militaryBg}) center/cover`
                    : isLocked
                      ? 'var(--bg-glass)'
                      : 'var(--bg-glass)',
                  border: `1px solid ${
                    isLocked
                      ? 'rgba(100,100,100,0.2)'
                      : 'var(--border-glass)'
                  }`,
                  borderRadius: 'var(--radius-md)',
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  opacity: isLocked ? 0.5 : 1,
                  transition: 'all 150ms ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  position: 'relative',
                  overflow: 'hidden',
                  minHeight: 120,
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 600, color: isLocked ? 'var(--text-muted)' : isMilitary ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                  {zone.name}
                </div>
                <div style={{ fontSize: 13, color: isMilitary ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)', lineHeight: 1.4, fontFamily: isMilitary ? 'var(--wa-font-hud)' : undefined }}>
                  {zone.description}
                </div>
                {isMilitary && (
                  <div style={{ position: 'absolute', bottom: 8, right: 12, fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
                    Дважды кликни чтобы начать
                  </div>
                )}
                {isLocked && (
                  <div style={{
                    marginTop: 'auto', fontSize: 11, color: 'var(--text-muted)',
                    fontStyle: 'italic', padding: '4px 0',
                  }}>
                    ⏳ ждите в новом обновлении
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: isLocked ? 0 : 'auto', flexWrap: 'wrap' }}>
                  {!isLocked && (
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 11,
                      background: zone.difficulty > 15 ? 'rgba(248,113,113,0.15)' : 'rgba(74,222,128,0.15)',
                      color: zone.difficulty > 15 ? 'var(--accent-danger)' : 'var(--accent-success)',
                    }}>
                      SL {zone.difficulty}
                    </span>
                  )}
                  {!isLocked && zone.allowedFactions.map((f) => (
                    <span key={f} style={{
                      padding: '2px 6px', borderRadius: 4, fontSize: 10,
                      background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)',
                    }}>
                      {f}
                    </span>
                  ))}
                  {!isLocked && !isMilitary && (
                    <span
                      onClick={handleAutoExplore}
                      style={{
                        padding: '2px 10px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        background: 'rgba(34, 197, 94, 0.15)',
                        color: '#22c55e',
                        cursor: 'pointer',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                        transition: 'all 150ms ease',
                        fontFamily: 'var(--wa-font-terminal)',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(34, 197, 94, 0.25)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(34, 197, 94, 0.15)'; }}
                    >
                      🔍 Авто
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </WapPanel>

      {/* Quick travel buttons */}
      <div style={{ display: 'flex', gap: 12 }}>
        <div onClick={() => navigate('/base')} style={{ flex: 1, cursor: 'pointer', padding: 'var(--space-md)', background: 'var(--bg-glass)', borderRadius: 'var(--radius-lg)', backdropFilter: 'blur(var(--blur-glass))', border: '1px solid var(--border-glass)', textAlign: 'center', fontSize: 14, fontWeight: 500 }}>
          🏠 База
        </div>
        <div onClick={() => navigate('/bazaar')} style={{ flex: 1, cursor: 'pointer', padding: 'var(--space-md)', background: 'var(--bg-glass)', borderRadius: 'var(--radius-lg)', backdropFilter: 'blur(var(--blur-glass))', border: '1px solid var(--border-glass)', textAlign: 'center', fontSize: 14, fontWeight: 500 }}>
          🏪 Базар
        </div>
      </div>
    </motion.div>
  );
};
