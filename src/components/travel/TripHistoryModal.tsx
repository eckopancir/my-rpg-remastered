import { useCallback, useEffect, useRef, useState } from 'react';
import { ModalWindow } from '../ui/ModalWindow';
import { DIFF_NAMES, MOD_NAMES } from '../../data/travelModes';
import { eventArtStyle } from '../../data/eventArt';
import { useAuthStore } from '../../stores/authStore';
import styles from './TripHistoryModal.module.css';

const PAGE = 20;

interface EventLogRow {
  text: string;
  type: string;
  is_micro: number;
  art: number | null;
  created_at: string;
}

interface HistRow {
  id: number;
  zone: string;
  difficulty: string;
  modifier: string | null;
  planned_sec: number;
  outcome: string;
  total_chips: number;
  total_exp: number;
  total_items: number;
  duration_seconds: number;
  started_at: string | null;
  death_cause: string | null;
  lost_chips: number;
  lost_items: number;
  event_log: EventLogRow[];
  ended_at: string;
}

interface Summary {
  trips: number;
  chips: number;
  exp: number;
  items: number;
  deaths: number;
}

type Filter = 'all' | 'complete' | 'cancelled' | 'dead';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'complete', label: '🏁 Завершённые' },
  { key: 'cancelled', label: '🛑 Досрочные' },
  { key: 'dead', label: '💀 Смерти' },
];

const OUTCOME_ICON: Record<string, string> = { dead: '💀', cancelled: '🛑', complete: '🏁' };

// Иконки типов в развёрнутом ленте рейда.
const LOG_ICON: Record<string, string> = {
  story: '📖',
  combat: '⚔',
  trade: '🤝',
  loot: '🎁',
  danger: '⚠',
  trap: '🪤',
  discovery: '🔍',
  anomaly: '🌀',
  neutral: '🧑',
  heal: '🩹',
  legendary: '⚜',
  system: '•',
  micro: '·',
  death: '💀',
};

const fmtClock = (ts: string | null) => {
  if (!ts) return '';
  const t = new Date(ts.replace(' ', 'T'));
  if (!Number.isFinite(t.getTime())) return ts.slice(5, 16);
  const d = t.getDate().toString().padStart(2, '0');
  const m = (t.getMonth() + 1).toString().padStart(2, '0');
  return `${d}.${m} ${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`;
};

const fmtOffset = (ts: string | null, startedAt: string | null) => {
  if (!ts || !startedAt) return '';
  const ms = new Date(ts.replace(' ', 'T')).getTime() - new Date(startedAt.replace(' ', 'T')).getTime();
  if (!Number.isFinite(ms)) return '';
  const c = Math.max(0, Math.floor(ms / 1000));
  return `+${Math.floor(c / 60)}:${(c % 60).toString().padStart(2, '0')}`;
};

/**
 * Раскрытая запись: параметры рейда, причина смерти и полный журнал событий.
 * Отдельный компонент получает запись пропсом — деталь всегда рисует ровно тот
 * рейд, по которому кликнули.
 */
const HistoryDetail = ({ h }: { h: HistRow }) => {
  const log = h.event_log ?? [];
  return (
    <div className={styles.detail}>
      <div className={styles.detailCols}>
        <div className={styles.params}>
          <div><span>Сложность</span><b>{DIFF_NAMES[h.difficulty] ?? h.difficulty}</b></div>
          <div><span>Характер</span><b>{h.modifier ? (MOD_NAMES[h.modifier] ?? h.modifier) : 'обычный'}</b></div>
          <div><span>План</span><b>{h.planned_sec ? `${Math.round(h.planned_sec / 3600)} ч` : '—'}</b></div>
          <div><span>Факт</span><b>{Math.max(0, Math.round(h.duration_seconds / 60))} мин</b></div>
          <div><span>Начало</span><b>{fmtClock(h.started_at) || '—'}</b></div>
          <div><span>Конец</span><b>{fmtClock(h.ended_at) || '—'}</b></div>
          {h.outcome === 'dead' && (
            <>
              <div><span>Потеряно чипов</span><b style={{ color: '#ef4444' }}>{h.lost_chips}</b></div>
              <div><span>Потеряно предметов</span><b style={{ color: '#ef4444' }}>{h.lost_items}</b></div>
            </>
          )}
        </div>
        {h.outcome === 'dead' && h.death_cause && (
          <div className={styles.deathCause}>💀 {h.death_cause}</div>
        )}
      </div>

      {log.length > 0 && (
        <div className={styles.log}>
          <div className={styles.logTitle}>Журнал рейда · {log.length} событий</div>
          <div className={styles.logList}>
            {log.map((e, i) => {
              const art = e.art ? eventArtStyle(e.art) : null;
              return (
                <div key={i} className={styles.logRow}>
                  <span className={styles.logIcon}>{LOG_ICON[e.type] ?? '•'}</span>
                  {art ? <i className={styles.logArt} style={art as Record<string, unknown>} /> : null}
                  <span className={styles.logText}>{e.text}</span>
                  <span className={styles.logTime}>{fmtOffset(e.created_at, h.started_at)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export const TripHistoryModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const token = useAuthStore((s) => s.token);
  const [filter, setFilter] = useState<Filter>('all');
  const [rows, setRows] = useState<HistRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const openWrapRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(
    (f: Filter, offset: number, append: boolean) => {
      if (!token) return;
      setLoading(true);
      fetch(`/api/exploration/history.php?limit=${PAGE}&offset=${offset}&outcome=${f}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          const list: HistRow[] = data.history ?? [];
          if (data.summary) setSummary(data.summary);
          setRows((prev) => (append ? [...prev, ...list] : list));
          setLoading(false);
        })
        .catch(() => setLoading(false));
    },
    [token],
  );

  useEffect(() => {
    if (open) {
      setExpanded(null);
      setRows([]);
      setSummary(null);
      load(filter, 0, false);
    }
  }, [open, filter, load]);

  // После раскрытия подкручиваем список к записи, чтобы её шапка и деталь
  // не «уезжали» под соседние строки из-за выросшей высоты списка.
  useEffect(() => {
    if (expanded != null) openWrapRef.current?.scrollIntoView({ block: 'nearest' });
  }, [expanded]);

  const hasMore = rows.length > 0 && rows.length % PAGE === 0;

  return (
    <ModalWindow
      open={open}
      onClose={onClose}
      title="История путешествий"
      icon="📜"
      variant="screen"
      width={740}
    >
      {/* Сводка по выбранному фильтру. */}
      <div className={styles.summary}>
        <div className={styles.sumTile}>
          <b>{summary?.trips ?? 0}</b><span>рейдов</span>
        </div>
        <div className={styles.sumTile}>
          <b style={{ color: '#38bdf8' }}>{summary?.chips ?? 0}</b><span>💾 чипов</span>
        </div>
        <div className={styles.sumTile}>
          <b style={{ color: '#4ade80' }}>{summary?.exp ?? 0}</b><span>⚡ опыта</span>
        </div>
        <div className={styles.sumTile}>
          <b style={{ color: '#93c5fd' }}>{summary?.items ?? 0}</b><span>📦 находок</span>
        </div>
        <div className={styles.sumTile}>
          <b style={{ color: '#ef4444' }}>{summary?.deaths ?? 0}</b><span>💀 смертей</span>
        </div>
      </div>

      {/* Фильтры исходов. */}
      <div className={styles.filterRow}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`${styles.chip} ${filter === f.key ? styles.chipActive : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Список рейдов. */}
      <div className={styles.list}>
        {!loading && rows.length === 0 && (
          <div className={styles.empty}>Ещё не было ни одного путешествия.</div>
        )}
        {rows.map((h) => {
          const isOpen = expanded === h.id;
          return (
            <div
              key={h.id}
              className={`${styles.rowWrap} ${isOpen ? styles.rowWrapOpen : ''}`}
              ref={isOpen ? openWrapRef : undefined}
            >
              <button
                className={`${styles.row} ${isOpen ? styles.rowOpen : ''}`}
                onClick={() => setExpanded(isOpen ? null : h.id)}
              >
                <span className={styles.outcomeIcon}>
                  {OUTCOME_ICON[h.outcome] ?? '🏁'}
                </span>
                <span className={styles.rowMain}>
                  <b className={styles.zone}>{h.zone}</b>
                  <span className={styles.meta}>
                    {DIFF_NAMES[h.difficulty] ?? h.difficulty}
                    {h.modifier ? ` · ${MOD_NAMES[h.modifier] ?? h.modifier}` : ''}
                    {` · ${Math.max(0, Math.round(h.duration_seconds / 60))} мин`}
                  </span>
                </span>
                <span className={styles.totals}>
                  💾{h.total_chips} ⚡{h.total_exp} 📦{h.total_items}
                </span>
                <span className={styles.date}>{fmtClock(h.ended_at)}</span>
              </button>

              {isOpen && <HistoryDetail h={h} />}
            </div>
          );
        })}

        {loading && <div className={styles.empty}>загрузка…</div>}
      </div>

      {hasMore && !loading && (
        <button className={styles.moreBtn} onClick={() => load(filter, rows.length, true)}>
          Показать ещё
        </button>
      )}
    </ModalWindow>
  );
};
