import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { WapPanel } from '../components/ui/WapPanel';
import { Button } from '../components/ui/Button';
import { ZONES, type Zone } from '../data/zones';
import { usePlayerStore } from '../stores/playerStore';

export const Map = () => {
  const navigate = useNavigate();
  const isTraveling = usePlayerStore((s) => s.travel.isTraveling);

  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [encounterCount, setEncounterCount] = useState(3);
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
    setSelectedZone(zone);
  };

  const handleStartExpedition = () => {
    if (!selectedZone) return;
    navigate(`/expedition?zone=${encodeURIComponent(selectedZone.name)}&count=${encounterCount}`);
    setSelectedZone(null);
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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {selectedZone && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Столкновений: 
                  <select
                    value={encounterCount}
                    onChange={(e) => setEncounterCount(Number(e.target.value))}
                    style={{
                      marginLeft: 8, padding: '2px 8px',
                      background: 'var(--bg-glass)', border: '1px solid var(--border-glass)',
                      borderRadius: 4, color: 'var(--text-primary)', fontSize: 13,
                    }}
                  >
                    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </span>
                <Button variant="primary" onClick={handleStartExpedition}>
                  🚀 В путь!
                </Button>
              </div>
            )}
          </div>
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
          {ZONES.filter((z) => z.name !== 'Наша база' && z.name !== 'Базар').map((zone) => (
            <motion.div
              key={zone.name}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleZoneClick(zone)}
              style={{
                padding: 20,
                background: selectedZone?.name === zone.name ? 'var(--accent-primary-dim)' : 'var(--bg-glass)',
                border: `1px solid ${selectedZone?.name === zone.name ? 'var(--border-accent)' : 'var(--border-glass)'}`,
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'all 150ms ease',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 600, color: selectedZone?.name === zone.name ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
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
            </motion.div>
          ))}
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
