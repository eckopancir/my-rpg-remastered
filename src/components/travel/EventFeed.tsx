import { useEffect, useMemo, useRef, useState } from 'react';
import type { TravelEvent, TravelRewardItem } from '../../types/travel';
import { EventCard } from './EventCard';
import styles from './travel.module.css';

type Filter = 'all' | 'big' | 'micro' | 'legendary';

export interface EventFeedProps {
  events: TravelEvent[];
  hiddenCount: number;
  onLoadOlder?: () => void;
  onItemHover?: (item: TravelRewardItem, e: React.MouseEvent) => void;
  onItemMove?: (e: React.MouseEvent) => void;
  onItemLeave?: () => void;
}

export const EventFeed = ({
  events,
  hiddenCount,
  onLoadOlder,
  onItemHover,
  onItemMove,
  onItemLeave,
}: EventFeedProps) => {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);

  const visible = useMemo(() => {
    let list = events;
    if (filter === 'big') list = list.filter((e) => !e.micro && !e.legendary);
    else if (filter === 'micro') list = list.filter((e) => e.micro);
    else if (filter === 'legendary') list = list.filter((e) => !!e.legendary);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (e) =>
          e.text.toLowerCase().includes(q) ||
          e.title.toLowerCase().includes(q) ||
          (e.legendary?.key ?? '').toLowerCase().includes(q),
      );
    }
    // Свежие сверху — как лента.
    return [...list].reverse();
  }, [events, filter, query]);

  // Автоскролл к низу, если пользователь не ушёл читать выше.
  useEffect(() => {
    const el = listRef.current;
    if (!el || !atBottom) return;
    el.scrollTop = el.scrollHeight;
  }, [visible.length, atBottom]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 90);
  };

  const scrollToBottom = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  return (
    <div className={`${styles.panel} ${styles.feed}`}>
      <div className={styles.panelHead}>
        <span>Лента событий</span>
        <span style={{ color: 'var(--text-secondary)', letterSpacing: 0, textTransform: 'none' }}>
          {visible.length} записей
        </span>
      </div>

      <div className={styles.toolbar}>
        <button
          className={`${styles.filterChip} ${filter === 'all' ? styles.filterChipActive : ''}`}
          onClick={() => setFilter('all')}
        >
          Все
        </button>
        <button
          className={`${styles.filterChip} ${filter === 'big' ? styles.filterChipActive : ''}`}
          onClick={() => setFilter('big')}
        >
          Крупные
        </button>
        <button
          className={`${styles.filterChip} ${filter === 'micro' ? styles.filterChipActive : ''}`}
          onClick={() => setFilter('micro')}
        >
          Микро
        </button>
        <button
          className={`${styles.filterChip} ${filter === 'legendary' ? styles.filterChipActive : ''}`}
          onClick={() => setFilter('legendary')}
        >
          ⚜ Легендарные
        </button>
        <input
          className={styles.searchInput}
          placeholder="Поиск по событиям…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className={styles.feedList} ref={listRef} onScroll={onScroll}>
        {visible.length === 0 ? (
          <div className={styles.feedEmpty}>
            {events.length === 0
              ? 'Пока нет записей. События появятся, когда отряд доберётся до зоны.'
              : 'Ничего не найдено по фильтру.'}
          </div>
        ) : (
          visible.map((ev) => (
            <EventCard
              key={ev.id}
              event={ev}
              onItemHover={onItemHover}
              onItemMove={onItemMove}
              onItemLeave={onItemLeave}
            />
          ))
        )}

        {hiddenCount > 0 && onLoadOlder && (
          <button
            className={styles.filterChip}
            style={{ alignSelf: 'center', marginTop: 6 }}
            onClick={onLoadOlder}
          >
            ⬆ Показать ещё ({hiddenCount})
          </button>
        )}
      </div>

      {!atBottom && visible.length > 0 && (
        <button className={styles.scrollDown} onClick={scrollToBottom} title="Вниз к последним событиям">
          ↓
        </button>
      )}
    </div>
  );
};
