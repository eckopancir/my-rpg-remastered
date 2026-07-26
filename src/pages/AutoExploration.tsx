import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { WapPanel } from '../components/ui/WapPanel';
import { ProgressBar } from '../components/ui/ProgressBar';
import { ItemTooltip } from '../components/widgets/ItemTooltip';
import { GAME_RESOURCES } from '../data/GameItems';
import { useExplorationStore, type ServerEventRow } from '../stores/explorationStore';
import { usePlayerStore } from '../stores/playerStore';

const PHASE_LABELS: Record<string, string> = {
  travel_out: '🚀 Путь туда',
  exploring: '🔍 Исследование',
  travel_back: '🏠 Путь обратно',
  complete: '✅ Завершено',
};

const PHASE_COLORS: Record<string, string> = {
  travel_out: 'var(--accent-info)',
  exploring: 'var(--accent-success)',
  travel_back: 'var(--accent-warning)',
  complete: 'var(--accent-primary)',
};

const parseTs = (ts: string) => new Date(ts.replace(' ', 'T')).getTime();

export const AutoExploration = () => {
  const navigate = useNavigate();
  const s = useExplorationStore();
  const addLog = usePlayerStore((s2) => s2.addLog);

  const [tooltipItem, setTooltipItem] = useState<any>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  if (!s.isExploring && s.phase !== 'complete') return null;

  const isDead = s.serverOutcome === 'dead';
  const fmtTime = (s: number) => { const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return h > 0 ? `${h}ч ${m}м` : `${m}м ${s % 60}с`; };
  const displayTime = s.isInfinite ? fmtTime(s.tickCount) : `${s.timeLeft}с`;
  const timeLabel = s.isInfinite ? 'прошло' : 'осталось';

  const showProgress = !s.isInfinite || s.phase !== 'exploring';
  const totalTrip = 1 + 180 + 30; // travel_out + explore + travel_back
  const progress = !showProgress ? 0
    : s.phase === 'travel_out'
      ? ((1 - s.timeLeft) / totalTrip) * 100
      : s.phase === 'exploring'
        ? (1 / totalTrip) * 100 + ((180 - s.timeLeft) / totalTrip) * 100
        : s.phase === 'travel_back'
          ? ((1 + 180 + 30 - s.timeLeft) / totalTrip) * 100
          : 100;

  const handleCancel = async () => {
    await s.cancelExploration();
    const nextPhase = useExplorationStore.getState().phase;
    addLog('🛑 Возвращение на базу досрочно.', 'warning');
    if (nextPhase !== 'travel_back') navigate('/adventure');
  };

  const sortedEvents = [...s.eventLog].sort((a, b) => a.id - b.id);
  const startTs = sortedEvents.length > 0
    ? parseTs(sortedEvents[0].created_at)
    : Date.now();
  const formatTimeStr = (ts: string) => {
    const diff = Math.floor((parseTs(ts) - startTs) / 1000);
    if (isNaN(diff)) return '';
    const m = Math.floor(diff / 60);
    const sec = diff % 60;
    return `+${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}
    >
      <WapPanel variant="metal" padding="lg" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            🔍 Авто-исследование: {s.zoneName}
          </div>
          <div style={{
            fontSize: 13, padding: '4px 12px', borderRadius: 'var(--radius-sm)',
            background: isDead ? 'var(--accent-danger)20' : `${PHASE_COLORS[s.phase]}20`,
            color: isDead ? 'var(--accent-danger)' : PHASE_COLORS[s.phase],
            border: `1px solid ${isDead ? 'var(--accent-danger)40' : `${PHASE_COLORS[s.phase]}40`}`,
            fontWeight: 500,
          }}>
            {isDead ? '💀 Погиб' : PHASE_LABELS[s.phase]}
          </div>
        </div>

        {showProgress ? (
          <ProgressBar value={Math.round(Math.min(progress, 100))} max={100} variant={isDead ? 'danger' : 'accent'} />
        ) : (
          <div style={{ height: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '100%', background: 'linear-gradient(90deg, rgba(20,184,166,0.3), rgba(20,184,166,0.1))', borderRadius: 6, animation: 'pulse 2s ease-in-out infinite' }} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
          {!isDead && <span>⏱ {timeLabel} {displayTime}</span>}
          <span>💾 {s.totalChips >= 0 ? `+${s.totalChips}` : s.totalChips}</span>
          <span>⚡ {s.totalExp >= 0 ? `+${s.totalExp}` : s.totalExp}</span>
          {s.totalItems > 0 && <span>📦 +{s.totalItems}</span>}
        </div>

        <div style={{
          flex: 1, marginTop: 12, padding: '8px 4px', overflowY: 'auto',
          maxHeight: 'calc(100vh - 320px)', display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {sortedEvents.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {s.phase === 'travel_out'
                ? '🚀 В пути к зоне... Скоро начнутся события.'
                : s.phase === 'complete'
                  ? '✅ Исследование завершено.'
                  : '⏳ Ожидание событий...'}
            </div>
          ) : (
            [...sortedEvents].reverse().map((entry) => (
              <EventCard
                key={entry.id}
                entry={entry}
                formatTime={formatTimeStr}
                onItemHover={(item, e) => {
                  setTooltipItem(item);
                  setTooltipPos({ x: e.clientX, y: e.clientY });
                }}
                onItemMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                onItemLeave={() => setTooltipItem(null)}
              />
            ))
          )}
        </div>

        {tooltipItem && (
          <ItemTooltip item={tooltipItem} x={tooltipPos.x} y={tooltipPos.y} />
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 12, justifyContent: 'flex-end' }}>
          <button onClick={handleCancel} style={{
            padding: '8px 24px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--accent-danger)', background: 'transparent',
            color: 'var(--accent-danger)', cursor: 'pointer', fontSize: 14, fontWeight: 500,
            fontFamily: 'var(--wa-font-terminal)',
          }}>
            🔴 Отмена
          </button>
        </div>
      </WapPanel>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Event card subcomponent
// ---------------------------------------------------------------------------
interface EventCardProps {
  entry: ServerEventRow;
  formatTime: (ts: string) => string;
  onItemHover: (item: any, e: React.MouseEvent) => void;
  onItemMove: (e: React.MouseEvent) => void;
  onItemLeave: () => void;
}

const EventCard = ({ entry, formatTime, onItemHover, onItemMove, onItemLeave }: EventCardProps) => {
  const isMicro = entry.is_micro === 1;
  const isLegendary = !!entry.legendary_event_id;

  const effects = parseEffects(entry.effects);
  if (effects.itemCount > 0) console.log('[EventCard] effects:', effects, 'items:', effects.items);
  const rewardIcons: string[] = [];
  if (effects.chips && effects.chips > 0) rewardIcons.push(`💾+${effects.chips}`);
  if (effects.chips && effects.chips < 0) rewardIcons.push(`💾${effects.chips}`);
  if (effects.exp && effects.exp > 0) rewardIcons.push(`⚡+${effects.exp}`);
  if (effects.damagePercent && effects.damagePercent > 0) rewardIcons.push(`💥-${Math.round(effects.damagePercent * 100)}%HP`);
  if (effects.healPercent && effects.healPercent > 0) rewardIcons.push(`💚+${Math.round(effects.healPercent * 100)}%HP`);
  if (effects.itemCount && effects.itemCount > 0) rewardIcons.push(`📦+${effects.itemCount}`);

  return (
    <div style={{
      padding: isLegendary ? '8px 12px' : isMicro ? '4px 10px' : '6px 10px',
      borderRadius: 'var(--radius-sm)',
      background: isLegendary
        ? 'linear-gradient(135deg, rgba(251,191,36,0.06), rgba(251,191,36,0.01))'
        : isMicro ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.03)',
      fontSize: isMicro ? 12 : 13,
      lineHeight: 1.5,
      color: 'var(--text-primary)',
      borderLeft: `3px solid ${
        isLegendary ? '#fbbf24' : isMicro ? 'rgba(255,255,255,0.15)' : getEventColor(entry.type)
      }`,
      opacity: isMicro ? 0.85 : 1,
      display: 'flex',
      gap: 8,
      alignItems: 'flex-start',
      ...(isLegendary ? { border: '1px solid rgba(251,191,36,0.2)' } : {}),
    }}>
      <span style={{
        fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)',
        whiteSpace: 'nowrap', minWidth: 36, marginTop: 2, opacity: 0.5,
      }}>
        {formatTime(entry.created_at)}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        {isLegendary && entry.legendary_event_id && (
          <div style={{
            fontSize: 11, fontWeight: 700, color: '#fbbf24', marginBottom: 4,
            letterSpacing: 1, textShadow: '0 0 6px rgba(251,191,36,0.2)',
          }}>
            ⚜ {entry.legendary_event_id}
            {entry.legendary_stage != null && ` · этап ${entry.legendary_stage}`}
          </div>
        )}

        {entry.text.split('\n').map((line: string, i: number) => {
          if (!entry.resource_cost || !line.includes(entry.resource_cost)) {
            return <div key={i}>{line || '\u00A0'}</div>;
          }
          const parts = line.split(entry.resource_cost);
          const resColor = entry.resource_had ? '#4ade80' : '#f87171';
          return (
            <div key={i}>
              {parts.map((part, j) => (
                <span key={j}>
                  {part}
                  {j < parts.length - 1 && (
                    <span
                      onMouseEnter={(e) => {
                        const def = GAME_RESOURCES.find((r) => r.name === entry.resource_cost);
                        if (def) {
                          onItemHover({
                            id: `res_${def.name}`,
                            name: def.name,
                            displayName: def.name,
                            type: def.type,
                            slot: def.slot,
                            rarity: def.rarity,
                            stats: {},
                            qualityColor: resColor,
                          }, e);
                        }
                      }}
                      onMouseMove={onItemMove}
                      onMouseLeave={onItemLeave}
                      style={{ cursor: 'pointer', color: resColor, borderBottom: `1px dashed ${resColor}44` }}>
                      {entry.resource_cost}
                    </span>
                  )}
                </span>
              ))}
            </div>
          );
        })}

        {rewardIcons.length > 0 && (
          <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
            {rewardIcons.map((r, i) => (
              <span key={i} style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 4,
                background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap',
              }}>{r}</span>
            ))}
          </div>
        )}

        {effects.items && effects.items.length > 0 && (
          <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
            📦
            {effects.items.map((item: any, i: number) => {
              const rarityColor = item.category === 'legendary' ? '#fbbf24'
                : item.category === 'rare' ? '#a78bfa'
                : item.category === 'material' ? '#60a5fa'
                : '#94a3b8';
              return (
                <span
                  key={i}
                  onMouseEnter={(e) => {
                    onItemHover({
                      id: `loot_${item.name}`,
                      name: item.name,
                      displayName: item.name,
                      type: item.type || 'material',
                      slot: null,
                      rarity: item.category || 'common',
                      stats: {},
                      qualityColor: rarityColor,
                    }, e);
                  }}
                  onMouseMove={onItemMove}
                  onMouseLeave={onItemLeave}
                  style={{
                    cursor: 'pointer', fontSize: 10, padding: '1px 6px', borderRadius: 4,
                    background: 'rgba(255,255,255,0.06)', color: rarityColor,
                    fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap',
                    borderBottom: `1px dashed ${rarityColor}44`,
                  }}
                >
                  {item.name}
                </span>
              );
            })}
          </div>
        )}

        {entry.decision && (
          <div style={{ marginTop: 3, fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', opacity: 0.8 }}>
            → {entry.decision}
          </div>
        )}

        {isLegendary && entry.legendary_result && (
          <div style={{
            marginTop: 4, fontSize: 10, fontWeight: 600,
            padding: '2px 8px', borderRadius: 4, display: 'inline-block',
            background: entry.legendary_result === 'complete'
              ? 'rgba(74,222,128,0.15)'
              : entry.legendary_result === 'stage'
                ? 'rgba(251,191,36,0.15)'
                : 'rgba(248,113,113,0.15)',
            color: entry.legendary_result === 'complete'
              ? '#4ade80'
              : entry.legendary_result === 'stage'
                ? '#fbbf24'
                : '#f87171',
            fontFamily: 'var(--font-mono)',
          }}>
            {entry.legendary_result === 'complete' ? '✓ ЗАВЕРШЕНО'
              : entry.legendary_result === 'stage' ? '→ ДАЛЕЕ'
              : '✗ ПРОВАЛ'}
          </div>
        )}
      </div>
    </div>
  );
};

function parseEffects(effects: string): Record<string, any> {
  try { return JSON.parse(effects); } catch { return {}; }
}

function getEventColor(type: string): string {
  switch (type) {
    case 'combat': return '#f87171';
    case 'loot': return '#fb923c';
    case 'trade': return '#34d399';
    case 'story': return '#60a5fa';
    case 'discovery': return '#a78bfa';
    case 'danger': return '#f97316';
    case 'anomaly': return '#a855f7';
    case 'legendary': return '#fbbf24';
    case 'system': return '#94a3b8';
    default: return '#94a3b8';
  }
}
