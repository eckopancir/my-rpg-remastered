import { useState } from 'react';
import { CARD_MAP, RARITY_META, SET_META, cardText, effectiveCard, powerColor, type CardDef } from '../../data/dungeon/cards';
import { CARD_ART } from '../../data/dungeon/cardArt';
import styles from './dungeon.module.css';

const KIND_LABEL: Record<string, string> = {
  attack: 'атака',
  aoe: 'по площади',
  heal: 'лечение',
  shield: 'защита',
  debuff: 'ослабление',
  buff: 'усиление',
  control: 'контроль',
  utility: 'утилита',
};

interface Props {
  defId: string;
  level?: number;
  /** В руке — карта чуть мельче. */
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
  const [artFailed, setArtFailed] = useState(false);
  const def: CardDef | undefined = CARD_MAP[defId];
  if (!def) return null;
  const artId = CARD_ART[defId];
  const eff = effectiveCard(def, level);
  const rageGain = eff.effects.reduce((s, e) => (e.t === 'rage' ? s + e.v : s), 0);
  const critGain = eff.effects.reduce((s, e) => (e.t === 'critChance' ? s + e.v : s), 0);
  const rarity = RARITY_META[def.rarity] || RARITY_META.common;
  const set = SET_META[def.set] || SET_META.tactics;
  const cls = [
    styles.card,
    hand ? styles.cardHand : '',
    selected ? styles.cardSelected : '',
    disabled ? styles.cardDisabled : '',
  ].filter(Boolean).join(' ');

  const style: Record<string, string> = { ['--rarity']: rarity.color };
  if (hand && delay) style.animationDelay = `${delay}ms`;

  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      disabled={disabled}
      title={`${def.name} · ${rarity.label} · ${set.label}\n${cardText(def, level)}`}
      data-card-uid={uid}
      style={style}
    >
      <div className={styles.cardTop}>
        <span className={styles.cost}>{eff.cost}</span>
        <span className={styles.power} style={{ color: powerColor(def.power) }}>
          {def.power}
        </span>
      </div>
      <div className={styles.cardIcon}>
        {artId && !artFailed ? (
          <img
            className={styles.cardArt}
            src={`/art/dungeon/cards/${artId}.png`}
            alt=""
            loading="lazy"
            onError={() => setArtFailed(true)}
          />
        ) : (
          def.icon
        )}
      </div>
      <div className={styles.cardName}>{def.name}</div>
      <div className={styles.cardText}>{cardText(def, level, true)}</div>

      {(eff.critChance || eff.rageChance || rageGain || critGain) ? (
        <div className={styles.cardBadges}>
          {eff.critChance ? <span className={styles.badgeCrit}>крит {eff.critChance}%</span> : null}
          {critGain ? <span className={styles.badgeCrit}>крит +{critGain}%</span> : null}
          {eff.rageChance ? <span className={styles.badgeRage}>ярость {eff.rageChance}%</span> : null}
          {rageGain ? <span className={styles.badgeRage}>ярость +{rageGain}%</span> : null}
        </div>
      ) : null}

      <div className={styles.cardFoot}>
        <span className={styles.cardKind}>{set.icon} {KIND_LABEL[def.kind] || def.kind}</span>
        <span className={styles.level}>ур. {Math.max(1, Math.min(7, level))}</span>
      </div>
    </button>
  );
};
