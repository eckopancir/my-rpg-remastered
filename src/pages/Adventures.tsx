import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { WapPanel } from '../components/ui/WapPanel';
import { ZONES } from '../data/zones';
import { useExplorationStore } from '../stores/explorationStore';
import { usePlayerStore } from '../stores/playerStore';
import { useAuthStore } from '../stores/authStore';
import militaryBg from '../assets/images/map/military.png';

const LOCKED_ZONES = new Set([
  'Болото', 'Свалка мусора', 'Темный лес',
  'База бандитов', 'Руины города', 'Старый завод',
]);

// Зеркало durationBonusPct() из api/exploration/engine_config.php — для превью.
const durationBonusPct = (hours: number) =>
  hours >= 18 ? 100 : hours >= 12 ? 60 : hours >= 6 ? 30 : 10;

interface HistoryEntry {
  id: number;
  zone: string;
  outcome: string;
  total_chips: number;
  total_exp: number;
  total_items: number;
  duration_seconds: number;
  event_log: any[];
  ended_at: string;
}

export const Adventures = () => {
  const navigate = useNavigate();
  const isExploring = useExplorationStore((s) => s.isExploring);
  const phase = useExplorationStore((s) => s.phase);
  const zoneName = useExplorationStore((s) => s.zoneName);
  const timeLeft = useExplorationStore((s) => s.timeLeft);
  const tickCount = useExplorationStore((s) => s.tickCount);
  const plannedSec = useExplorationStore((s) => s.plannedSec);
  const isInfinite = useExplorationStore((s) => s.isInfinite);
  const fmtTime = (s: number) => { const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return h > 0 ? `${h}ч ${m}м` : `${m}м ${s % 60}с`; };
  // Прошедшее время зеркально AutoExploration: дорога 120с, вылазка plannedSec, возврат 3600с.
  const elapsedSec = isInfinite
    ? tickCount
    : phase === 'travel_out'
      ? Math.max(0, 120 - timeLeft)
      : phase === 'exploring'
        ? (plannedSec > 0 ? Math.max(0, plannedSec - timeLeft) : 0)
        : phase === 'travel_back'
          ? (plannedSec > 0 ? plannedSec + Math.max(0, 3600 - timeLeft) : 0)
          : 0;
  const isTraveling = usePlayerStore((s) => s.travel.isTraveling);
  const isReturning = usePlayerStore((s) => s.travel.isReturning);
  const isFighting = usePlayerStore((s) => s.combat.isFighting);
  const addLog = usePlayerStore((s) => s.addLog);
  const resetExploration = useExplorationStore((s) => s.resetExploration);
  const token = useAuthStore((s) => s.token);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  // Модалка старта: выбор длительности слайдером 2-24ч.
  const [pendingZone, setPendingZone] = useState<string | null>(null);
  const [hours, setHours] = useState(12);
  const [useMats, setUseMats] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch('/api/exploration/history.php', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (data.history) setHistory(data.history); })
      .catch(() => {});
  }, [token]);

  const handleStart = (name: string) => {
    setHours(12);
    setPendingZone(name);
  };

  const confirmExplore = async () => {
    if (!pendingZone) return;
    await useExplorationStore.getState().startExploration(pendingZone, hours, useMats);
    const zn = pendingZone;
    setPendingZone(null);
    navigate(`/explore?zone=${encodeURIComponent(zn)}`);
  };

  const availableZones = ZONES.filter((z) =>
    z.name !== 'Наша база' && z.name !== 'Базар' && !LOCKED_ZONES.has(z.name)
  );

  const fmtDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}м ${s}с`;
  };

  const parseEffects = (effects: string): Record<string, any> => {
    if (!effects) return {};
    try {
      const parsed = JSON.parse(effects);
      if (Array.isArray(parsed)) return {};
      return parsed;
    } catch { return {}; }
  };

  const timeAgo = (iso: string) => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return `${diff}с назад`;
    if (diff < 3600) return `${Math.floor(diff/60)}м назад`;
    if (diff < 86400) return `${Math.floor(diff/3600)}ч назад`;
    return `${Math.floor(diff/86400)}д назад`;
  };

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
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <button onClick={async () => {
              // Отладочная кнопка: мгновенное завершение через reset.php
              // (без часового возврата) + локальный сброс.
              if (!token) return;
              await fetch('/api/exploration/reset.php', { headers: { Authorization: `Bearer ${token}` } });
              resetExploration();
              addLog('🔴 Экспедиция принудительно завершена (мгновенно).', 'warning');
            }} style={{
              padding: '10px 28px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--accent-danger)', background: 'rgba(248,113,113,0.15)',
              color: 'var(--accent-danger)', cursor: 'pointer', fontSize: 14, fontWeight: 600,
              fontFamily: 'var(--wa-font-terminal)',
            }}>🔴 Принудительно завершить</button>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
              Исследование активно
            </div>
            <div style={{ fontSize: 13 }}>Зона: <b>{zoneName}</b> · Фаза: <b>{phase}</b> · Прошло: {fmtTime(elapsedSec)}</div>
            <button onClick={() => navigate('/explore')} style={{
              marginTop: 8, padding: '10px 28px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--accent-info)', background: 'rgba(96,165,250,0.15)',
              color: 'var(--accent-info)', cursor: 'pointer', fontSize: 14, fontWeight: 600,
              fontFamily: 'var(--wa-font-terminal)', transition: 'all 150ms ease',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(96,165,250,0.25)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(96,165,250,0.15)'; }}
            >
              📋 Перейти к логу экспедиции
            </button>
          </div>
        ) : (
          <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button onClick={async () => {
              if (!token) return;
              await fetch('/api/exploration/reset.php', { headers: { Authorization: `Bearer ${token}` } });
              resetExploration();
              addLog('🔄 Все активные экспедиции сброшены.', 'warning');
            }} style={{
              padding: '6px 16px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--accent-danger)', background: 'rgba(248,113,113,0.1)',
              color: 'var(--accent-danger)', cursor: 'pointer', fontSize: 12,
              fontFamily: 'var(--wa-font-terminal)',
            }}>🔄 Сбросить все экспедиции</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {availableZones.map((zone) => (
              <motion.div key={zone.name} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} style={{
                padding: 20,
                background: zone.name === 'Заброшенная военная база и окрестности'
                  ? `linear-gradient(rgba(0,0,0,0.15), rgba(0,0,0,0.15)), url(${militaryBg}) center/cover`
                  : 'var(--bg-glass)',
                border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)',
                cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 100,
              }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{zone.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{zone.description}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 'auto', flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 11,
                    background: zone.difficulty > 15 ? 'rgba(248,113,113,0.15)' : 'rgba(74,222,128,0.15)',
                    color: zone.difficulty > 15 ? 'var(--accent-danger)' : 'var(--accent-success)',
                  }}>SL {zone.difficulty}</span>
                  {zone.allowedFactions.map((f) => (
                    <span key={f} style={{
                      padding: '2px 6px', borderRadius: 4, fontSize: 10,
                      background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)',
                    }}>{f}</span>
                  ))}
                </div>
                <button onClick={async () => handleStart(zone.name)} style={{
                  marginTop: 8, padding: '8px 16px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid #22c55e', background: 'rgba(34,197,94,0.15)',
                  color: '#22c55e', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  fontFamily: 'var(--wa-font-terminal)', transition: 'all 150ms ease',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(34,197,94,0.25)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(34,197,94,0.15)'; }}
                >🔍 Исследовать</button>
              </motion.div>
            ))}
          </div>
          </>
        )}

        {history.length > 0 && (
          <WapPanel variant="glass" padding="md" style={{ marginTop: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>
              📜 История путешествий
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.map((entry) => (
                <div key={entry.id} style={{
                  border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-glass)', overflow: 'hidden',
                }}>
                  <div onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                    cursor: 'pointer', fontSize: 13,
                  }}>
                    <span>{entry.outcome === 'death' ? '💀' : entry.outcome === 'cancelled' ? '🛑' : '🏁'}</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{entry.zone}</span>
                    <span style={{ color: entry.outcome === 'death' ? 'var(--accent-danger)' : 'var(--text-secondary)', fontSize: 11 }}>
                      {entry.outcome === 'death' ? 'Погиб' : entry.outcome === 'cancelled' ? 'Прервано' : 'Завершено'}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                      {entry.total_chips > 0 && `💾${entry.total_chips} `}
                      {entry.total_exp > 0 && `⚡${entry.total_exp} `}
                      {entry.total_items > 0 && `📦${entry.total_items} `}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{timeAgo(entry.ended_at)}</span>
                  </div>
                  {expandedId === entry.id && (
                    <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border-glass)', maxHeight: 300, overflowY: 'auto', fontSize: 12 }}>
                      {entry.outcome === 'death' && (
                        <div style={{ color: 'var(--accent-danger)', fontWeight: 600, marginBottom: 6, fontSize: 13 }}>
                          💀 Герой погиб в этом путешествии
                        </div>
                      )}
                      <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>⏱ {fmtDuration(entry.duration_seconds)}</div>
                      {entry.event_log.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Нет записей событий</div>
                      ) : (
                        (() => {
                          const reversed = [...entry.event_log].reverse();
                          const baseTime = new Date(reversed[0].created_at).getTime();
                          return reversed.map((ev: any, i: number) => {
                            const e = parseEffects(ev.effects);
                            const rewardParts: string[] = [];
                            if (e.chips && e.chips > 0) rewardParts.push(`💾+${e.chips}`);
                            if (e.chips && e.chips < 0) rewardParts.push(`💾${e.chips}`);
                            if (e.exp && e.exp > 0) rewardParts.push(`⚡+${e.exp}`);
                            if (e.healPercent && e.healPercent > 0) rewardParts.push(`❤️+${Math.round(e.healPercent * 100)}%`);
                            if (e.flatHeal && e.flatHeal > 0) rewardParts.push(`❤️+${e.flatHeal}`);
                            if (e.damagePercent && e.damagePercent > 0) rewardParts.push(`💔-${Math.round(e.damagePercent * 100)}%`);
                            if (e.itemCount && e.itemCount > 0) rewardParts.push(`📦+${e.itemCount}`);
                            const d = Math.floor((new Date(ev.created_at).getTime() - baseTime) / 1000);
                            return (
                              <div key={i} style={{ display: 'flex', gap: 6, padding: '3px 0', color: 'var(--text-secondary)' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: 10, whiteSpace: 'nowrap', minWidth: 32 }}>
                                  {d >= 0 ? `+${Math.floor(d/60)}:${(d%60).toString().padStart(2,'0')}` : ''}
                                </span>
                                <span style={{ flex: 1 }}>{ev.text}</span>
                                {rewardParts.length > 0 && (
                                  <span style={{ fontSize: 10, color: 'var(--text-secondary)', whiteSpace: 'nowrap', marginLeft: 8 }}>
                                    {rewardParts.join(' ')}
                                  </span>
                                )}
                              </div>
                            );
                          });
                        })()
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </WapPanel>
        )}
      </WapPanel>

      {/* Модалка старта экспедиции: длительность 2-24ч + превью бонуса */}
      {pendingZone && (
        <div
          onClick={() => setPendingZone(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(440px, 100%)', background: 'var(--bg-glass)',
              border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)',
              padding: 20, display: 'flex', flexDirection: 'column', gap: 12,
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 600 }}>🔍 Вылазка: {pendingZone}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Сколько времени остаёмся в зоне? Дорога туда ~2 мин, возврат — час.
              Досрочный возврат — без бонуса.
            </div>
            <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Длительность: <b style={{ color: 'var(--text-primary)', fontSize: 15 }}>{hours} ч</b>
            </label>
            <input
              type="range" min={2} max={24} step={1} value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-success)', cursor: 'pointer' }}
            />
            <div style={{
              fontSize: 13, padding: '8px 12px', borderRadius: 'var(--radius-sm)',
              background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)',
              color: '#4ade80',
            }}>
              🏆 Бонус за полную зачистку: +{durationBonusPct(hours)}% к чипам и опыту
            </div>
            <label style={{
              display: 'flex', gap: 8, alignItems: 'flex-start',
              fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5,
              cursor: 'pointer', padding: '8px 12px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-sm)',
            }}>
              <input
                type="checkbox" checked={useMats}
                onChange={(e) => setUseMats(e.target.checked)}
                style={{ marginTop: 2, accentColor: 'var(--accent-success)', cursor: 'pointer' }}
              />
              <span>
                Тратить материалы из инвентаря.<br />
                <span style={{ color: 'var(--text-muted)' }}>
                  Выкл — и события будут считать, что ресурсов нет (бережёт запасы, но награды скромнее).
                </span>
              </span>
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                onClick={() => setPendingZone(null)}
                style={{
                  padding: '8px 20px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(255,255,255,0.15)', background: 'transparent',
                  color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14,
                }}
              >
                Отмена
              </button>
              <button
                onClick={confirmExplore}
                style={{
                  padding: '8px 24px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--accent-success)', background: 'rgba(74,222,128,0.15)',
                  color: '#4ade80', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                }}
              >
                🚀 Отправиться
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};
