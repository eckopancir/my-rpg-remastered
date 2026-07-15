import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { WapPanel } from '../components/ui/WapPanel';
import { Button } from '../components/ui/Button';
import { generateEncounters, blockEncounter, getBlockedEncounters, cleanupBlockedEncounters } from '../data/encounters';
import { ZONES } from '../data/zones';
import { usePlayerStore } from '../stores/playerStore';
import { useUiStore, type ExpeditionEntry } from '../stores/uiStore';

export const Expedition = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const zoneName = searchParams.get('zone') || 'Свалка мусора';

  const addLog = usePlayerStore((s) => s.addLog);
  const addToQueue = useUiStore((s) => s.addToQueue);
  const addToast = useUiStore((s) => s.addToast);
  const hasEncounterInQueue = useUiStore((s) => s.hasEncounterInQueue);

  const zone = ZONES.find((z) => z.name === zoneName) || ZONES[3];
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [encounters, setEncounters] = useState(() => {
    cleanupBlockedEncounters();
    return generateEncounters(zone.difficulty, 8);
  });

  const [refreshTimer, setRefreshTimer] = useState(600);

  useEffect(() => {
    if (refreshTimer <= 0) return;
    const t = setInterval(() => {
      setRefreshTimer((prev) => {
        if (prev <= 1) {
          cleanupBlockedEncounters();
          setEncounters(generateEncounters(zone.difficulty, 8));
          setSelectedIds([]);
          return 600;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [refreshTimer, zone.difficulty]);

  const blockedIds = getBlockedEncounters();

  const toggleSelect = (id: string) => {
    if (hasEncounterInQueue(id) || blockedIds.has(id)) {
      addToast('Это столкновение заблокировано (60 сек.)', 'warning');
      return;
    }
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleStart = () => {
    if (selectedIds.length === 0) return;

    const selectedEncounters = encounters.filter((e) => selectedIds.includes(e.id));
    selectedEncounters.forEach((e) => blockEncounter(e.id));

    const entryId = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const totalTime = zone.travelTime + selectedEncounters.length * 3;

    const entry: ExpeditionEntry = {
      id: entryId,
      zoneName: zone.name,
      encounterIds: selectedEncounters.map((e) => e.id),
      status: 'pending',
      duration: totalTime,
      remaining: totalTime,
      difficulty: zone.difficulty,
    };

    addToQueue(entry);
    addLog(`📋 Экспедиция в "${zone.name}" (${selectedEncounters.length} стычек) добавлена.`, 'info');
    addToast(`Экспедиция в "${zone.name}" запущена!`, 'success');

    usePlayerStore.getState().startTravel(zone.name, 1);
    navigate('/');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <WapPanel variant="metal" padding="lg">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{zone.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Выбери столкновения для экспедиции</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Обновление: {Math.floor(refreshTimer / 60)}:{String(refreshTimer % 60).padStart(2, '0')}
            </span>
            <Button
              variant="primary"
              onClick={handleStart}
              disabled={selectedIds.length === 0}
            >
              🚀 Старт ({selectedIds.length})
            </Button>
          </div>
        </div>

        {/* Encounters grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {encounters.map((enc, i) => {
            const isSelected = selectedIds.includes(enc.id);
            const isBlocked = hasEncounterInQueue(enc.id) || blockedIds.has(enc.id);
            const typeIcon = enc.type === 'combat' ? '⚔️' : enc.type === 'loot' ? '📦' : '❓';

            return (
              <motion.div
                key={enc.id}
                whileHover={!isBlocked ? { scale: 1.02 } : {}}
                onClick={() => !isBlocked && toggleSelect(enc.id)}
                style={{
                  padding: 16,
                  background: isSelected ? 'var(--accent-primary-dim)' : 'var(--bg-glass)',
                  border: `1px solid ${
                    isBlocked ? 'rgba(248,113,113,0.3)' :
                    isSelected ? 'var(--border-accent)' : 'var(--border-glass)'
                  }`,
                  borderRadius: 'var(--radius-md)',
                  cursor: isBlocked ? 'not-allowed' : 'pointer',
                  opacity: isBlocked ? 0.5 : 1,
                  transition: 'all 150ms ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    #{i + 1} {typeIcon}
                  </span>
                  <span style={{
                    padding: '2px 6px', borderRadius: 4, fontSize: 10,
                    background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)',
                  }}>
                    SL {enc.difficulty}
                  </span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{enc.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.3 }}>
                  {enc.description}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-muted)' }}>
                  <span>+{enc.expReward} XP</span>
                  <span>+{enc.chipReward} 💾</span>
                  <span>{enc.enemyCount > 0 ? `👾 x${enc.enemyCount}` : ''}</span>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="ghost" onClick={() => navigate('/map')}>← Назад к карте</Button>
          <Button
            variant="primary"
            onClick={handleStart}
            disabled={selectedIds.length === 0}
          >
            🚀 Начать экспедицию ({selectedIds.length})
          </Button>
        </div>
      </WapPanel>
    </motion.div>
  );
};
