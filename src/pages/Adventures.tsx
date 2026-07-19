import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { WapPanel } from '../components/ui/WapPanel';
import { ZONES } from '../data/zones';
import { useExplorationStore } from '../stores/explorationStore';
import { usePlayerStore } from '../stores/playerStore';
import militaryBg from '../assets/images/map/military.png';

const LOCKED_ZONES = new Set([
  'Болото', 'Свалка мусора', 'Темный лес',
  'База бандитов', 'Руины города', 'Старый завод',
]);

export const Adventures = () => {
  const navigate = useNavigate();
  const isExploring = useExplorationStore((s) => s.isExploring);
  const isTraveling = usePlayerStore((s) => s.travel.isTraveling);
  const isReturning = usePlayerStore((s) => s.travel.isReturning);
  const isFighting = usePlayerStore((s) => s.combat.isFighting);

  const handleStart = (name: string, difficulty: number, factions: string[]) => {
    useExplorationStore.getState().startExploration(name, difficulty, factions);
    navigate(`/explore?zone=${encodeURIComponent(name)}`);
  };

  const availableZones = ZONES.filter((z) =>
    z.name !== 'Наша база' && z.name !== 'Базар' && !LOCKED_ZONES.has(z.name)
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}
    >
      <WapPanel variant="metal" padding="lg" style={{ flex: 1 }}>
        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
          🗺️ Отправиться в путешествие
        </div>

        {isTraveling || isReturning || isFighting ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
            ⏳ Ты уже в пути или в бою. Дождись завершения.
          </div>
        ) : isExploring ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
            🔍 Исследование уже запущено. Открой карту или страницу исследования.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 12,
            }}
          >
            {availableZones.map((zone) => (
              <motion.div
                key={zone.name}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  padding: 20,
                  background: zone.name === 'Заброшенная военная база и окрестности'
                    ? `linear-gradient(rgba(0,0,0,0.15), rgba(0,0,0,0.15)), url(${militaryBg}) center/cover`
                    : 'var(--bg-glass)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  minHeight: 100,
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {zone.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {zone.description}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 'auto', flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 11,
                    background: zone.difficulty > 15 ? 'rgba(248,113,113,0.15)' : 'rgba(74,222,128,0.15)',
                    color: zone.difficulty > 15 ? 'var(--accent-danger)' : 'var(--accent-success)',
                  }}>
                    SL {zone.difficulty}
                  </span>
                  {zone.allowedFactions.map((f) => (
                    <span key={f} style={{
                      padding: '2px 6px', borderRadius: 4, fontSize: 10,
                      background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)',
                    }}>
                      {f}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => handleStart(zone.name, zone.difficulty, zone.allowedFactions)}
                  style={{
                    marginTop: 8,
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid #22c55e',
                    background: 'rgba(34,197,94,0.15)',
                    color: '#22c55e',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: 'var(--wa-font-terminal)',
                    transition: 'all 150ms ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(34,197,94,0.25)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(34,197,94,0.15)'; }}
                >
                  🔍 Исследовать
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </WapPanel>
    </motion.div>
  );
};
