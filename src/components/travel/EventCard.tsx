import type { TravelEvent, TravelRewardItem } from '../../types/travel';
import { KIND_META } from './adaptEvent';
import { ChoicePanel } from './ChoicePanel';
import styles from './travel.module.css';

export interface EventCardProps {
  event: TravelEvent;
  onChoose?: (id: string) => void;
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

export const EventCard = ({ event, onChoose, onItemHover, onItemMove, onItemLeave }: EventCardProps) => {
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
            ⚜ {event.legendary.key}
            {event.legendary.stage != null ? ` · этап ${event.legendary.stage}` : ''}
          </div>
        ) : (
          <div className={styles.cardHead}>
            <span>{meta.icon}</span>
            <span>{event.title}</span>
          </div>
        )}

        <div className={styles.cardText}>{event.text}</div>

        {event.decision && <div className={styles.cardDecision}>→ {event.decision}</div>}

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
                  📦 {it.displayName || it.name}{it.quantity && it.quantity > 1 ? ` ×${it.quantity}` : ''}
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

        {event.choices && event.choices.length > 0 && onChoose && (
          <ChoicePanel choices={event.choices} onChoose={onChoose} />
        )}
      </div>
    </div>
  );
};
