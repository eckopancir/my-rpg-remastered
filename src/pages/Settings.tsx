import { motion } from 'framer-motion';
import { WapPanel } from '../components/ui/WapPanel';
import { Button } from '../components/ui/Button';
import { useUiStore } from '../stores/uiStore';

export const Settings = () => {
  const { soundEnabled, musicEnabled, musicVolume, setSoundEnabled, setMusicEnabled, setMusicVolume } = useUiStore();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      style={{ maxWidth: 480 }}
    >
      <WapPanel variant="metal" padding="lg">
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 24 }}>⚙️ Настройки</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Sound FX */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Sound Effects</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Клики, бой, экипировка</div>
            </div>
            <Button
              variant={soundEnabled ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setSoundEnabled(!soundEnabled)}
            >
              {soundEnabled ? 'ON' : 'OFF'}
            </Button>
          </div>

          {/* Music toggle + volume */}
          <div style={{
            padding: '12px 0',
            borderTop: '1px solid var(--border-glass)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>Background Music</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Главная тема Wasteland (84 MB)</div>
              </div>
              <Button
                variant={musicEnabled ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setMusicEnabled(!musicEnabled)}
              >
                {musicEnabled ? 'ON' : 'OFF'}
              </Button>
            </div>

            {musicEnabled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 32, textAlign: 'right' }}>
                  {Math.round(musicVolume * 100)}%
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={musicVolume}
                  onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
                  style={{
                    flex: 1, height: 4, appearance: 'none', outline: 'none',
                    background: `linear-gradient(90deg, var(--accent-primary) ${musicVolume * 100}%, rgba(255,255,255,0.1) ${musicVolume * 100}%)`,
                    borderRadius: 2, cursor: 'pointer',
                  }}
                />
              </div>
            )}
          </div>

        </div>
      </WapPanel>
    </motion.div>
  );
};
