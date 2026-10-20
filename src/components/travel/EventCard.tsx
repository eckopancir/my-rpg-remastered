import type { TravelEvent, TravelRewardItem } from '../../types/travel';
import { KIND_META } from './adaptEvent';
import styles from './travel.module.css';

export interface EventCardProps {
  event: TravelEvent;
  onItemHover?: (item: TravelRewardItem, e: React.MouseEvent) => void;
  onItemMove?: (e: React.MouseEvent) => void;
  onItemLeave?: () => void;
}

const legendaryResultLabel = (r: string | null): { text: string; cls: string } => {
  if (r === 'complete') return { text: '✓ ЗАВЕРШЕНО', cls: styles.legendaryOk };
  if (r === 'stage') return { text: '→ ДАЛЕЕ', cls: styles.legendaryStage };
  if (r === 'fail') return { text: '✗ ПРОВАЛ', cls: styles.legendaryFail };
  return { text: 'НАЧАЛО ЦЕПОЧКИ', cls: styles.legendaryStage };
};

/**
 * Подпись находки: «Вода ×2», «Патроны 9мм ×30», «Редкий СКС 3 ур.».
 * Количество добавляем один раз — даже если оно уже есть в displayName.
 */
const itemLabel = (it: TravelRewardItem): string => {
  const qty = it.quantity ?? 1;
  const base = (it.displayName || it.name || '').replace(/\s*[x×]\s*\d+\s*$/i, '').trim();
  if (qty <= 1) return base || it.name;
  return `${base} ×${qty}`;
};

export const EventCard = ({ event, onItemHover, onItemMove, onItemLeave }: EventCardProps) => {
  const meta = KIND_META[event.kind];
  const r = event.rewards;
  const cls = [
    styles.card,
    event.micro ? styles.cardMicro : '',
    event.legendary ? styles.cardLegendary : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cls} style={{ ['--cardColor' as any]: meta.color }}>
      <div className={styles.cardTime}>{event.time}</div>
      <div className={styles.cardBody}>
        {event.legendary ? (
          <div className={styles.legendaryTitle}>
            ⚜ {event.legendary.title || event.legendary.key}
            {event.legendary.stage != null ? ` · этап ${event.legendary.stage}` : ''}
          </div>
        ) : null}

        <div className={styles.cardText}>{event.text}</div>

        {/* Решение показываем отдельной строкой, только если его ещё нет в тексте. */}
        {event.decision && !event.text.includes(event.decision) && (
          <div className={styles.cardDecision}>→ {event.decision}</div>
        )}

        {event.spent && (
          <div className={`${styles.cardSpent} ${event.spent.had ? styles.spentOk : styles.spentMiss}`}>
            {event.spent.had
              ? `Потрачено: ${event.spent.name}`
              : `Не хватило: ${event.spent.name}`}
          </div>
        )}

        {(r.chips !== 0 || r.exp !== 0 || r.healPercent > 0 || r.damagePercent > 0 || r.flatHeal > 0 || r.itemCount > 0 || r.items.length > 0) && (
          <div className={styles.rewards}>
            {r.chips !== 0 && (
              <span className={`${styles.badge} ${styles.badgeChips}`}>
                💾 {r.chips > 0 ? `+${r.chips}` : r.chips}
              </span>
            )}
            {r.exp !== 0 && (
              <span className={`${styles.badge} ${styles.badgeExp}`}>
                ⚡ {r.exp > 0 ? `+${r.exp}` : r.exp}
              </span>
            )}
            {r.healPercent > 0 && (
              <span className={`${styles.badge} ${styles.badgeHeal}`}>❤ +{Math.round(r.healPercent * 100)}%</span>
            )}
            {r.flatHeal > 0 && (
              <span className={`${styles.badge} ${styles.badgeHeal}`}>❤ +{Math.round(r.flatHeal)}</span>
            )}
            {r.damagePercent > 0 && (
              <span className={`${styles.badge} ${styles.badgeDmg}`}>💥 −{Math.round(r.damagePercent * 100)}%</span>
            )}
            {r.items.length > 0
              ? r.items.map((it, i) => (
                <span
                  key={it.id ?? i}
                  className={`${styles.badge} ${styles.badgeItem}`}
                  onMouseEnter={(e) => onItemHover?.(it, e)}
                  onMouseMove={onItemMove}
                  onMouseLeave={onItemLeave}
                >
                  📦 {itemLabel(it)}
                </span>
              ))
              : r.itemCount > 0 && (
                <span className={styles.badge}>📦 +{r.itemCount}</span>
              )}
          </div>
        )}

        {event.legendary && event.legendary.result && (
          <span className={`${styles.legendaryResult} ${legendaryResultLabel(event.legendary.result).cls}`}>
            {legendaryResultLabel(event.legendary.result).text}
          </span>
        )}

      </div>
    </div>
  );
};
