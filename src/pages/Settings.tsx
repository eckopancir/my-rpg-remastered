import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { WapPanel } from '../components/ui/WapPanel';
import { Button } from '../components/ui/Button';
import { useUiStore } from '../stores/uiStore';

const VolumeSlider = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 4 }}>
    <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 36, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
      {Math.round(value * 100)}%
    </span>
    <input
      type="range"
      min={0}
      max={1}
      step={0.01}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={{
        flex: 1, height: 4, appearance: 'none', outline: 'none',
        background: `linear-gradient(90deg, var(--accent-primary) ${value * 100}%, rgba(255,255,255,0.1) ${value * 100}%)`,
        borderRadius: 2, cursor: 'pointer',
      }}
    />
  </div>
);

const CheckRow = ({ title, hint, checked, onToggle }: { title: string; hint: string; checked: boolean; onToggle: () => void }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
    <div>
      <div style={{ fontSize: 14, fontWeight: 500 }}>{title}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{hint}</div>
    </div>
    <Button
      variant={checked ? 'primary' : 'ghost'}
      size="sm"
      onClick={onToggle}
    >
      {checked ? 'ON' : 'OFF'}
    </Button>
  </div>
);

export const Settings = () => {
  const navigate = useNavigate();
  const {
    soundEnabled, musicEnabled, musicVolume,
    uiVolume, arenaVolume, rangeVolume,
    showDamageNumbers, battleLogSize, autoReload,
    confirmExitCombat, showEnemyHpNumbers, duckMusicInCombat,
    setSoundEnabled, setMusicEnabled, setMusicVolume,
    setUiVolume, setArenaVolume, setRangeVolume,
    setShowDamageNumbers, setBattleLogSize, setAutoReload,
    setConfirmExitCombat, setShowEnemyHpNumbers, setDuckMusicInCombat,
  } = useUiStore();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      style={{ maxWidth: 480 }}
    >
      <WapPanel variant="metal" padding="lg">
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚙️ Настройки</span>
          <span onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer', fontSize: 14, color: 'white', padding: '0 4px' }}>✕</span>
        </div>
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

          {/* Volumes */}
          {soundEnabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0 8px' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>🔘 Интерфейс — клики кнопок</div>
                <VolumeSlider value={uiVolume ?? 1} onChange={setUiVolume} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>⚔️ Арена 2D — звуки боя</div>
                <VolumeSlider value={arenaVolume ?? 1} onChange={setArenaVolume} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>🎯 Shooting Range — выстрелы по манекену</div>
                <VolumeSlider value={rangeVolume ?? 1} onChange={setRangeVolume} />
              </div>
            </div>
          )}

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
              <>
                <VolumeSlider value={musicVolume} onChange={setMusicVolume} />
                <div style={{ marginTop: 8 }}>
                  <CheckRow
                    title="Тихая музыка в бою"
                    hint="Приглушать музыку на арене 2D"
                    checked={duckMusicInCombat}
                    onToggle={() => setDuckMusicInCombat(!duckMusicInCombat)}
                  />
                </div>
              </>
            )}
          </div>

          {/* Combat */}
          <div style={{
            padding: '12px 0',
            borderTop: '1px solid var(--border-glass)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>⚔️ Бой</div>
            <CheckRow
              title="Цифры урона"
              hint="Всплывающие числа над врагами и манекеном"
              checked={showDamageNumbers}
              onToggle={() => setShowDamageNumbers(!showDamageNumbers)}
            />
            <CheckRow
              title="HP врагов цифрами"
              hint="Числа текущее/макс рядом с полосками"
              checked={showEnemyHpNumbers}
              onToggle={() => setShowEnemyHpNumbers(!showEnemyHpNumbers)}
            />
            <CheckRow
              title="Автоперезарядка"
              hint="На арене — сразу перезаряжаться при пустом магазине"
              checked={autoReload}
              onToggle={() => setAutoReload(!autoReload)}
            />
            <CheckRow
              title="Подтверждение выхода из боя"
              hint="Спрашивать перед уходом с арены"
              checked={confirmExitCombat}
              onToggle={() => setConfirmExitCombat(!confirmExitCombat)}
            />
            <div style={{ padding: '8px 0' }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Размер лога боя</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Сколько строк держать в логе арены и полигона</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[10, 20, 50].map((n) => (
                  <Button
                    key={n}
                    variant={battleLogSize === n ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setBattleLogSize(n)}
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>
          </div>

        </div>
      </WapPanel>
    </motion.div>
  );
};
