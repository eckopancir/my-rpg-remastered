import { CARD_MAP, cardText, effectiveCard, powerColor, type CardDef } from '../../data/dungeon/cards';
import styles from './dungeon.module.css';

const KIND_LABEL: Record<string, string> = {
  attack: 'атака',
  aoe: 'по площади',
  heal: 'лечение',
  shield: 'защита',
  debuff: 'ослабление',
  utility: 'утилита',
};

interface Props {
  defId: string;
  level?: number;
  /** В руке — карта чуть мельче и с наездом. */
  hand?: boolean;
  selected?: boolean;
  disabled?: boolean;
  /** Идентификатор экземпляра — для стрелки наведения. */
  uid?: string;
  /** Задержка анимации раздачи, мс. */
  delay?: number;
  onClick?: () => void;
}

export const CardView = ({ defId, level = 1, hand, selected, disabled, uid, delay, onClick }: Props) => {
  const def: CardDef | undefined = CARD_MAP[defId];
  if (!def) return null;
  const eff = effectiveCard(def, level);
  const cls = [
    styles.card,
    hand ? styles.cardHand : '',
    selected ? styles.cardSelected : '',
    disabled ? styles.cardDisabled : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      disabled={disabled}
      title={cardText(def, level)}
      data-card-uid={uid}
      style={hand && delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      <div className={styles.cardTop}>
        <span className={styles.cost}>{eff.cost}</span>
        <span className={styles.power} style={{ color: powerColor(def.power) }}>
          {def.power}
        </span>
      </div>
      <div className={styles.cardIcon}>{def.icon}</div>
      <div className={styles.cardName}>{def.name}</div>
      <div className={styles.cardText}>{cardText(def, level)}</div>
      <div className={styles.cardFoot}>
        <span className={styles.cardKind}>{KIND_LABEL[def.kind] || def.kind}</span>
        <span className={styles.level}>ур. {Math.max(1, Math.min(7, level))}</span>
      </div>
    </button>
  );
};
