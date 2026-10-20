import type { TravelPhaseInfo } from '../../types/travel';
import styles from './travel.module.css';

const TRAVEL_OUT_SEC = 120;
const LEGACY_EXPLORE_SEC = 180;
const TRAVEL_BACK_SEC = 3600;

/** Секунды → «12ч 0м» / «43с». */
const fmtLeft = (sec: number): string => {
  const s = Math.max(0, Math.ceil(sec));
  if (s < 60) return `${s}с`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м`;
};

export interface RouteTimelineProps {
  phase: string;
  timeLeft: number;
  plannedSec: number;
  returnMult: number;
}

/** Собрать фазы рейда с остатком времени. */
export const buildPhases = (props: RouteTimelineProps): TravelPhaseInfo[] => {
  const exploreTotal = props.plannedSec > 0 ? props.plannedSec : LEGACY_EXPLORE_SEC;
  const backTotal = Math.round(TRAVEL_BACK_SEC * (props.returnMult || 1));
  const order: TravelPhaseInfo['key'][] = ['travel_out', 'exploring', 'travel_back'];
  const meta: Record<TravelPhaseInfo['key'], { label: string; icon: string; total: number }> = {
    travel_out: { label: 'Дорога туда', icon: '🚀', total: TRAVEL_OUT_SEC },
    exploring: { label: 'Зона', icon: '🔍', total: exploreTotal },
    travel_back: { label: 'Обратно', icon: '🏠', total: backTotal },
    complete: { label: 'Готово', icon: '✅', total: 0 },
  };
  const currentIdx = order.indexOf(props.phase as TravelPhaseInfo['key']);
  return order.map((key, i) => ({
    key,
    label: meta[key].label,
    icon: meta[key].icon,
    total: meta[key].total,
    left: i === currentIdx ? Math.max(0, props.timeLeft) : (i < currentIdx ? 0 : meta[key].total),
  }));
};

export const RouteTimeline = (props: RouteTimelineProps) => {
  const phases = buildPhases(props);
  const currentIdx = phases.findIndex((p) => p.key === props.phase);

  // Сколько секунд прошло всего.
  const totalTrip = phases.reduce((sum, p) => sum + p.total, 0);
  let elapsed = 0;
  for (let i = 0; i < phases.length; i++) {
    const p = phases[i];
    if (i < currentIdx) elapsed += p.total;
    else if (i === currentIdx) elapsed += Math.max(0, p.total - p.left);
  }

  const hh = Math.floor(elapsed / 3600);
  const mm = Math.floor((elapsed % 3600) / 60);
  const ss = elapsed % 60;
  const tripH = Math.floor(totalTrip / 3600);
  const tripM = Math.floor((totalTrip % 3600) / 60);

  return (
    <div className={styles.route}>
      {phases.map((p, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        const pct = p.total > 0 ? Math.min(100, Math.max(0, ((p.total - p.left) / p.total) * 100)) : 0;
        return (
          <div key={p.key} style={{ display: 'flex', alignItems: 'center', flex: i === currentIdx ? 2 : 1, minWidth: 0 }}>
            <div
              className={`${styles.routePhase} ${active ? styles.routePhaseActive : ''} ${done ? styles.routeDone : ''}`}
              title={p.total > 0 ? `${Math.round(pct)}% фазы пройдено` : ''}
            >
              <span>{done ? '✓' : p.icon}</span>
              <span>{p.label}</span>
              {active && p.total > 0 && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.7 }}>
                  {fmtLeft(p.left)}
                </span>
              )}
            </div>
            {i < phases.length - 1 && (
              <div className={styles.routeLine}>
                <div className={styles.routeLineFill} style={{ width: `${done ? 100 : active ? pct : 0}%` }} />
              </div>
            )}
          </div>
        );
      })}
      <div className={styles.routeClock}>
        {hh > 0 ? `${hh}:` : ''}{String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
        <small> / {tripH > 0 ? `${tripH}ч ` : ''}{tripM}м</small>
      </div>
    </div>
  );
};
