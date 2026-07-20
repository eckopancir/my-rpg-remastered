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
  const isExploring = useExplorationStore((s) => s.isExploring);
  const expZoneName = useExplorationStore((s) => s.zoneName);
  const phase = useExplorationStore((s) => s.phase);
  const isInfinite = useExplorationStore((s) => s.isInfinite);
  const tickCounter = useExplorationStore((s) => s.expeditionTickCounter);
  const travelTime = useExplorationStore((s) => s.travelTime);
  const expTimeLeft = useExplorationStore((s) => s.timeLeft);
  const expChips = useExplorationStore((s) => s.totalChipsGained);
  const expExp = useExplorationStore((s) => s.totalExpGained);
  const expItems = useExplorationStore((s) => s.totalItemsGained);


  const craftingMax = craftingType === 'merge' ? 10 : craftingType === 'create' ? 5 : craftingType === 'upgrade' ? 60 : 0;
  const craftingIcon = craftingType === 'merge' ? '⬆️' : craftingType === 'create' ? '⚙️' : craftingType === 'upgrade' ? '🏢' : '';
  const craftingTitle = craftingType === 'merge' ? 'Улучшение предмета' : craftingType === 'create' ? 'Создание предмета' : craftingLabel;

  return (
    <aside className={styles.sidebar}>
      <div className={styles.section} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div className={styles.sectionTitle}>Журнал заданий ({queue.length + (craftingTimer > 0 ? 1 : 0) + (isExploring ? 1 : 0)})</div>
        <div className={styles.queue}>
          {isExploring && (
            <div className={`${styles.queueItem} ${styles.queueItemActive}`}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 12 }}>
                📡 {expZoneName}
              </div>
              <div style={{ fontSize: 10, color: 'var(--wa-accent-amber)', marginBottom: 2 }}>
                {isInfinite ? `⏱ прошло ${tickCounter}с` : `⏱ осталось ${expTimeLeft}с`} · {phase === 'travel_out' ? 'выезд' : phase === 'exploring' ? 'в зоне' : phase === 'travel_back' ? 'возврат' : 'завершено'}
              </div>
              {expChips + expExp + expItems > 0 && (
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2 }}>
                  {expChips > 0 && `💾+${expChips} `}{expExp > 0 && `⚡+${expExp} `}{expItems > 0 && `📦+${expItems}`}
                </div>
              )}
              <ProgressBar
                value={expChips + expExp + expItems > 0 ? Math.min(100, (expChips + expExp + expItems) % 100) : 0}
                max={100}
                variant="accent"
              />
            </div>
          )}
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
          {!isExploring && queue.length === 0 && craftingTimer === 0 ? (
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
    </aside>
  );
};