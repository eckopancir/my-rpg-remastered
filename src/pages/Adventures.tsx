import { useState } from 'react';
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
  const phase = useExplorationStore((s) => s.phase);
  const zoneName = useExplorationStore((s) => s.zoneName);
  const timeLeft = useExplorationStore((s) => s.timeLeft);
  const isInfinite = useExplorationStore((s) => s.isInfinite);
  const expeditionTickCounter = useExplorationStore((s) => s.expeditionTickCounter);
  const travelTime = useExplorationStore((s) => s.travelTime);
  const isTraveling = usePlayerStore((s) => s.travel.isTraveling);
  const isReturning = usePlayerStore((s) => s.travel.isReturning);
  const isFighting = usePlayerStore((s) => s.combat.isFighting);

  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const history = useExplorationStore((s) => s.history);

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
          <div
            style={{
              textAlign: 'center', padding: 40, color: 'var(--text-secondary)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
            }}
          >
            <div style={{ fontSize: 24 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
              Исследование активно
            </div>
            <div style={{ fontSize: 13 }}>Зона: <b>{zoneName}</b> · Фаза: <b>{phase}</b>{isInfinite && phase === 'exploring'
              ? ` · Прошло: ${(expeditionTickCounter || 0) - (travelTime || 0)}с`
              : ` · Осталось: ${timeLeft} сек`}</div>
            <button
              onClick={() => navigate('/explore')}
              style={{
                marginTop: 8,
                padding: '10px 28px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--accent-info)',
                background: 'rgba(96,165,250,0.15)',
                color: 'var(--accent-info)',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                fontFamily: 'var(--wa-font-terminal)',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(96,165,250,0.25)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(96,165,250,0.15)'; }}
            >
              📋 Перейти к логу экспедиции
            </button>
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

        {history.length > 0 && (
          <WapPanel variant="glass" padding="md" style={{ marginTop: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>
              📜 История путешествий
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.map((entry) => (
                <div key={entry.id} style={{
                  border: '1px solid var(--border-glass)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-glass)',
                  overflow: 'hidden',
                }}>
                  <div
                    onClick={() => setExpandedHistory(expandedHistory === entry.id ? null : entry.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                      cursor: 'pointer', fontSize: 13,
                    }}
                  >
                    <span>{entry.outcome === 'death' ? '💀' : entry.outcome === 'cancelled' ? '🛑' : '🏁'}</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{entry.zoneName}</span>
                    <span style={{ color: entry.outcome === 'death' ? 'var(--accent-danger)' : 'var(--text-secondary)', fontSize: 11 }}>
                      {entry.outcome === 'death' ? 'Погиб' : entry.outcome === 'cancelled' ? 'Прервано' : 'Завершено'}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                      {entry.totalChipsGained > 0 && `💾${entry.totalChipsGained} `}
                      {entry.totalExpGained > 0 && `⚡${entry.totalExpGained} `}
                      {entry.totalItemsGained > 0 && `📦${entry.totalItemsGained}`}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                      {(() => {
                        const diff = Math.floor((Date.now() - entry.endedAt) / 1000);
                        if (diff < 60) return `${diff}с назад`;
                        if (diff < 3600) return `${Math.floor(diff/60)}м назад`;
                        if (diff < 86400) return `${Math.floor(diff/3600)}ч назад`;
                        return `${Math.floor(diff/86400)}д назад`;
                      })()}
                    </span>
                  </div>
                  {expandedHistory === entry.id && (
                    <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border-glass)', maxHeight: 300, overflowY: 'auto', fontSize: 12 }}>
                      {entry.eventLog.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Нет записей событий</div>
                      ) : (
                        [...entry.eventLog].reverse().map((ev) => (
                          <div key={ev.id} style={{ padding: '3px 0', display: 'flex', gap: 6, color: 'var(--text-secondary)' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: 10, whiteSpace: 'nowrap', minWidth: 32 }}>
                              {(() => {
                                const diff = Math.floor((ev.ts - entry.eventLog[0].ts) / 1000);
                                return `+${Math.floor(diff/60)}:${(diff%60).toString().padStart(2,'0')}`;
                              })()}
                            </span>
                            <span style={{ flex: 1 }}>{ev.text}</span>
                            {ev.chips && <span style={{ color: '#fbbf24', fontSize: 10 }}>💾{ev.chips}</span>}
                            {ev.exp && <span style={{ color: '#818cf8', fontSize: 10 }}>⚡{ev.exp}</span>}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </WapPanel>
        )}
      </WapPanel>
    </motion.div>
  );
};
