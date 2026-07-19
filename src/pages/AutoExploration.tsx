import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { WapPanel } from '../components/ui/WapPanel';
import { ProgressBar } from '../components/ui/ProgressBar';
import { ItemTooltip } from '../components/widgets/ItemTooltip';
import { getItemImage } from '../assets/index';
import { useExplorationStore } from '../stores/explorationStore';
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

export const AutoExploration = () => {
  const navigate = useNavigate();
  const isExploring = useExplorationStore((s) => s.isExploring);
  const zoneName = useExplorationStore((s) => s.zoneName);
  const phase = useExplorationStore((s) => s.phase);
  const timeLeft = useExplorationStore((s) => s.timeLeft);
  const travelTime = useExplorationStore((s) => s.travelTime);
  const eventLog = useExplorationStore((s) => s.eventLog);
  const totalChips = useExplorationStore((s) => s.totalChipsGained);
  const totalExp = useExplorationStore((s) => s.totalExpGained);
  const totalItems = useExplorationStore((s) => s.totalItemsGained);
  const cancelExploration = useExplorationStore((s) => s.cancelExploration);
  const addLog = usePlayerStore((s) => s.addLog);

  const [tooltipItem, setTooltipItem] = useState<any>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  if (!isExploring && phase !== 'complete') {
    return null;
  }

  const totalTrip = travelTime * 2;
  const progress = phase === 'travel_out'
    ? ((travelTime - timeLeft) / totalTrip) * 100
    : phase === 'exploring'
      ? (travelTime / totalTrip) * 100 + ((travelTime - timeLeft) / totalTrip) * 100
      : phase === 'travel_back'
        ? ((travelTime * 2 - timeLeft) / totalTrip) * 100
        : 100;

  const handleCancel = () => {
    cancelExploration();
    addLog('🛑 Возвращение на базу досрочно.', 'warning');
    navigate('/map');
  };

  const handleFinish = () => {
    navigate('/map');
  };

  // Time formatting
  const startTs = eventLog.length > 0 ? eventLog[0].ts : Date.now();
  const formatTime = (ts: number) => {
    const diff = Math.floor((ts - startTs) / 1000);
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return `+${m}:${s.toString().padStart(2, '0')}`;
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
            🔍 Авто-исследование: {zoneName}
          </div>
          <div
            style={{
              fontSize: 13,
              padding: '4px 12px',
              borderRadius: 'var(--radius-sm)',
              background: `${PHASE_COLORS[phase]}20`,
              color: PHASE_COLORS[phase],
              border: `1px solid ${PHASE_COLORS[phase]}40`,
              fontWeight: 500,
            }}
          >
            {PHASE_LABELS[phase]}
          </div>
        </div>

        <ProgressBar
          value={Math.round(progress)}
          max={100}
          variant="accent"
        />

        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
          <span>⏱ {timeLeft} сек</span>
          <span>💾 +{totalChips}</span>
          <span>⚡ +{totalExp}</span>
          {totalItems > 0 && <span>📦 +{totalItems}</span>}
        </div>

        <div
          style={{
            flex: 1,
            marginTop: 12,
            padding: '8px 4px',
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 320px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {eventLog.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {phase === 'travel_out'
                ? '🚀 В пути к зоне... Скоро начнутся события.'
                : phase === 'complete'
                  ? '✅ Исследование завершено.'
                  : '⏳ Ожидание событий...'}
            </div>
          ) : (
            [...eventLog].reverse().map((entry) => (
              <EventCard
                key={entry.id}
                entry={entry}
                formatTime={formatTime}
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
          {phase !== 'complete' && (
            <button
              onClick={handleCancel}
              style={{
                padding: '8px 24px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--accent-danger)',
                background: 'transparent',
                color: 'var(--accent-danger)',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
                fontFamily: 'var(--wa-font-terminal)',
              }}
            >
              🔴 Отмена
            </button>
          )}
          {phase === 'complete' && (
            <button
              onClick={handleFinish}
              style={{
                padding: '8px 24px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--accent-success)',
                background: 'transparent',
                color: 'var(--accent-success)',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
                fontFamily: 'var(--wa-font-terminal)',
              }}
            >
              ✅ На карту
            </button>
          )}
        </div>
      </WapPanel>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Event card subcomponent
// ---------------------------------------------------------------------------
interface EventCardProps {
  entry: any;
  formatTime: (ts: number) => string;
  onItemHover: (item: any, e: React.MouseEvent) => void;
  onItemMove: (e: React.MouseEvent) => void;
  onItemLeave: () => void;
}

const EventCard = ({ entry, formatTime, onItemHover, onItemMove, onItemLeave }: EventCardProps) => {
  const isMicro = entry.isMicro;
  const rewardIcons: string[] = [];
  if (entry.chips && entry.chips > 0) rewardIcons.push(`💾+${entry.chips}`);
  if (entry.chips && entry.chips < 0) rewardIcons.push(`💾${entry.chips}`);
  if (entry.exp && entry.exp > 0) rewardIcons.push(`⚡+${entry.exp}`);
  if (entry.damagePercent) rewardIcons.push(`💥-${Math.round(entry.damagePercent * 100)}%HP`);
  else if (entry.damage && entry.damage > 0) rewardIcons.push(`💥-${entry.damage}`);
  if (entry.healPercent) rewardIcons.push(`💚+${Math.round(entry.healPercent * 100)}%HP`);
  else if (entry.heal && entry.heal > 0) rewardIcons.push(`💚+${entry.heal}`);
  if (entry.combat) rewardIcons.push('⚔️');
  if (entry.items && entry.items.length > 0) rewardIcons.push(`📦+${entry.items.length}`);

  return (
    <div
      style={{
        padding: entry.isLegendary ? '8px 12px' : isMicro ? '4px 10px' : '6px 10px',
        borderRadius: 'var(--radius-sm)',
        background: entry.isLegendary
          ? 'linear-gradient(135deg, rgba(251,191,36,0.06), rgba(251,191,36,0.01))'
          : isMicro ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.03)',
        fontSize: isMicro ? 12 : 13,
        lineHeight: 1.5,
        color: 'var(--text-primary)',
        borderLeft: `3px solid ${
          entry.isLegendary ? '#fbbf24' : isMicro ? 'rgba(255,255,255,0.15)' : getEventColor(entry.type)
        }`,
        opacity: isMicro ? 0.85 : 1,
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
        ...(entry.isLegendary ? {
          border: '1px solid rgba(251,191,36,0.2)',
        } : {}),
      }}
    >
      {/* Timestamp */}
      <span
        style={{
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-primary)',
          whiteSpace: 'nowrap',
          minWidth: 36,
          marginTop: 2,
          opacity: 0.5,
        }}
      >
        {formatTime(entry.ts)}
      </span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Legendary title badge */}
        {entry.isLegendary && entry.legendaryTitle && (
          <div style={{
            fontSize: 11, fontWeight: 700, color: '#fbbf24', marginBottom: 4,
            letterSpacing: 1, textShadow: '0 0 6px rgba(251,191,36,0.2)',
          }}>
            ⚜ {entry.legendaryTitle}
            {entry.legendaryStage != null && ` · этап ${entry.legendaryStage}`}
          </div>
        )}
        {/* Text — split on \n for reward summary */}
        {entry.text.split('\n').map((line: string, i: number) => (
          <div key={i}>{line || '\u00A0'}</div>
        ))}

        {/* Reward badges */}
        {rewardIcons.length > 0 && (
          <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
            {rewardIcons.map((r, i) => (
              <span
                key={i}
                style={{
                  fontSize: 10,
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: 'rgba(255,255,255,0.06)',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  whiteSpace: 'nowrap',
                }}
              >
                {r}
              </span>
            ))}
          </div>
        )}

        {/* Decision badge */}
        {entry.decision && (
          <div
            style={{
              marginTop: 3,
              fontSize: 11,
              color: 'var(--text-muted)',
              fontStyle: 'italic',
              opacity: 0.8,
            }}
          >
            → {entry.decision}
          </div>
        )}

        {/* Legendary result badge */}
        {entry.isLegendary && entry.legendaryResult && (
          <div style={{
            marginTop: 4, fontSize: 10, fontWeight: 600,
            padding: '2px 8px', borderRadius: 4, display: 'inline-block',
            background: entry.legendaryResult === 'complete'
              ? 'rgba(74,222,128,0.15)'
              : entry.legendaryResult === 'retreat'
                ? 'rgba(251,191,36,0.15)'
                : 'rgba(248,113,113,0.15)',
            color: entry.legendaryResult === 'complete'
              ? '#4ade80'
              : entry.legendaryResult === 'retreat'
                ? '#fbbf24'
                : '#f87171',
            fontFamily: 'var(--font-mono)',
          }}>
            {entry.legendaryResult === 'complete' ? '✓ ЗАВЕРШЕНО'
              : entry.legendaryResult === 'retreat' ? '⬅ ВЫХОД'
              : '✗ ПРОВАЛ'}
          </div>
        )}

        {/* Item thumbnails */}
        {entry.items && entry.items.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            {entry.items.map((item: any, idx: number) => (
              <div
                key={item.id || idx}
                onMouseEnter={(e) => onItemHover(item, e)}
                onMouseMove={onItemMove}
                onMouseLeave={onItemLeave}
                style={{
                  width: 48,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 6,
                    border: `1px solid ${item.qualityColor || 'rgba(255,255,255,0.15)'}`,
                    background: 'rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={getItemImage(item.name, item.displayName)}
                    alt=""
                    style={{
                      width: 32,
                      height: 32,
                      objectFit: 'contain',
                      imageRendering: 'pixelated',
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: 9,
                    color: item.qualityColor || 'var(--text-muted)',
                    textAlign: 'center',
                    maxWidth: 48,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.2,
                  }}
                >
                  {item.displayName || item.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

function getEventColor(type: string): string {
  switch (type) {
    case 'combat': return '#f87171';
    case 'loot': return '#fb923c';
    case 'damage': return '#ef4444';
    case 'heal': return '#4ade80';
    case 'chips': return '#fbbf24';
    case 'xp': return '#818cf8';
    case 'trade': return '#34d399';
    case 'story': return '#60a5fa';
    case 'discovery': return '#a78bfa';
    case 'danger': return '#f97316';
    case 'legendary': return '#fbbf24';
    default: return '#94a3b8';
  }
}


