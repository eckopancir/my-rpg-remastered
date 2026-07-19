import { usePlayerStore } from '../../stores/playerStore';
import { useUiStore } from '../../stores/uiStore';
import { useExplorationStore } from '../../stores/explorationStore';
import { ProgressBar } from '../ui/ProgressBar';
import styles from './Sidebar.module.css';

const logColorMap: Record<string, string> = {
  damage: '#f87171',
  heal: '#4ade80',
  loot: '#fb923c',
  system: '#818cf8',
  warning: '#fb923c',
  info: '#94a3b8',
};

const fmtTime = (ts: number): string => {
  const diff = Date.now() - ts;
  if (diff < 60000) return `${Math.floor(diff / 1000)}с`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}м`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}ч`;
  return `${Math.floor(diff / 86400000)}д`;
};

export const Sidebar = () => {
  const logs = usePlayerStore((s) => s.logs);
  const queue = useUiStore((s) => s.queue);
  const craftingTimer = useUiStore((s) => s.craftingTimer);
  const craftingType = useUiStore((s) => s.craftingType);
  const craftingLabel = useUiStore((s) => s.craftingLabel);

  const craftingMax = craftingType === 'merge' ? 10 : craftingType === 'create' ? 5 : craftingType === 'upgrade' ? 60 : 0;
  const craftingIcon = craftingType === 'merge' ? '⬆️' : craftingType === 'create' ? '⚙️' : craftingType === 'upgrade' ? '🏢' : '';
  const craftingTitle = craftingType === 'merge' ? 'Улучшение предмета' : craftingType === 'create' ? 'Создание предмета' : craftingLabel;

  return (
    <aside className={styles.sidebar}>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Журнал заданий ({queue.length + (craftingTimer > 0 ? 1 : 0)})</div>
        <div className={styles.queue}>
          {craftingTimer > 0 && (
            <div className={`${styles.queueItem} ${styles.queueItemActive}`}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 12 }}>
                {craftingIcon} {craftingTitle}
              </div>
              <div style={{ fontSize: 10, color: 'var(--wa-accent-amber)', marginBottom: 4 }}>
                ⏳ {craftingTimer} сек
              </div>
              <ProgressBar
                value={craftingMax - craftingTimer}
                max={craftingMax}
                variant="accent"
              />
            </div>
          )}
          {queue.length === 0 && craftingTimer === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '2px 0', fontFamily: 'var(--wa-font-terminal)' }}>
              Нет активных заданий
            </div>
          ) : (
            queue.map((entry) => (
              <div
                key={entry.id}
                className={`${styles.queueItem} ${entry.status === 'active' ? styles.queueItemActive : ''}`}
              >
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{entry.zoneName}</div>
                <div style={{ fontSize: 11, color: entry.status === 'active' ? 'var(--wa-accent-amber)' : 'var(--text-muted)' }}>
                  {entry.status === 'active' ? `⏳ ${entry.remaining}s` : entry.status}
                </div>
              </div>
            ))
          )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Лог боя</div>
      </div>
      <div className={styles.logs}>
        {logs.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--wa-font-terminal)' }}>Нет записей</div>
        ) : (
          [...logs].reverse().slice(0, 50).map((log) => (
            <div
              key={log.id}
              className={styles.logEntry}
              style={{ color: logColorMap[log.type] || 'var(--text-secondary)' }}
            >
              <span style={{ opacity: 0.4, fontSize: 9, marginRight: 4, fontFamily: 'var(--wa-font-terminal)', flexShrink: 0 }}>
                {log.ts ? fmtTime(log.ts) : ''}
              </span>
              {log.message}
            </div>
          ))
        )}
      </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>📡 Экспедиция</div>
      </div>
      <ExplorationMiniLog />
    </aside>
  );
};

const ExplorationMiniLog = () => {
  const isExploring = useExplorationStore((s) => s.isExploring);
  const phase = useExplorationStore((s) => s.phase);
  const eventLog = useExplorationStore((s) => s.eventLog);
  const zoneName = useExplorationStore((s) => s.zoneName);
  const timeLeft = useExplorationStore((s) => s.timeLeft);

  if (!isExploring && eventLog.length === 0) {
    return (
      <div className={styles.logs}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--wa-font-terminal)' }}>
          Нет активных исследований
        </div>
      </div>
    );
  }

  const phaseIcon = phase === 'travel_out' ? '🚀' : phase === 'exploring' ? '🔍' : phase === 'travel_back' ? '🏠' : '✅';
  const recentLogs = eventLog.slice(-5);

  return (
    <div className={styles.logs}>
      {zoneName && (
        <div style={{ fontSize: 11, color: 'var(--accent-primary)', marginBottom: 4, fontWeight: 600 }}>
          {phaseIcon} {zoneName} — {timeLeft}с
        </div>
      )}
      {recentLogs.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--wa-font-terminal)' }}>
          В пути...
        </div>
      ) : (
        [...recentLogs].reverse().map((log) => (
          <div
            key={log.id}
            style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              padding: '2px 0',
              lineHeight: 1.4,
              borderLeft: `2px solid ${getExplorationColor(log.type)}`,
              paddingLeft: 6,
              marginBottom: 2,
            }}
          >
            {log.text.length > 80 ? log.text.slice(0, 80) + '...' : log.text}
          </div>
        ))
      )}
    </div>
  );
};

const getExplorationColor = (type: string): string => {
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
    default: return '#94a3b8';
  }
};