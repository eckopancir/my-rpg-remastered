import { ROLE_COLOR, ROLE_ICON, ROLE_NAME, starsText, type MercRole } from '../../data/dungeon/mercs';
import type { Fx } from '../../stores/dungeonStore';
import styles from './dungeon.module.css';

interface Props {
  id: string;
  name: string;
  role: MercRole;
  stars: number;
  hp: number;
  maxHp: number;
  armor?: number;
  maxArmor?: number;
  shield?: number;
  slotLabel?: string;
  dead?: boolean;
  selected?: boolean;
  targetable?: boolean;
  fx?: Fx | null;
  onClick?: () => void;
}

export const MercCard = ({
  id, name, role, stars, hp, maxHp, armor, maxArmor, shield, slotLabel, dead, selected, targetable, fx, onClick,
}: Props) => {
  const isFx = !!fx && fx.targetUid === id;
  const hpPct = Math.max(0, Math.min(100, (hp / Math.max(1, maxHp)) * 100));
  const armorPct = maxArmor ? Math.max(0, Math.min(100, ((armor ?? 0) / Math.max(1, maxArmor)) * 100)) : 0;

  const cls = [
    styles.mercCard,
    dead ? styles.mercDead : '',
    selected ? styles.mercSelected : '',
    targetable ? styles.enemyTargetable : '',
    isFx && fx?.kind === 'hit' ? styles.shake : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cls}
      onClick={onClick}
      title={`${name} · ${ROLE_NAME[role]}`}
      data-target-kind="merc"
      data-target-uid={id}
    >
      {slotLabel && <span className={styles.slotTag}>{slotLabel}</span>}
      <div className={styles.mercHead}>
        <span className={styles.mercIcon} style={{ color: ROLE_COLOR[role] }}>{ROLE_ICON[role]}</span>
        <div style={{ minWidth: 0 }}>
          <div className={styles.mercName}>{name}</div>
          <div className={styles.mercStars}>{starsText(stars)}</div>
        </div>
      </div>

      <div className={styles.bar}>
        <div className={`${styles.barFill} ${styles.barHp}`} style={{ width: `${hpPct}%` }} />
      </div>
      <div className={styles.barRow}>
        <span>{Math.max(0, Math.round(hp))} / {maxHp}</span>
        {!!maxArmor && (
          <span className={styles.armorBadge}>🛡 {armor ?? 0}</span>
        )}
      </div>

      {!!maxArmor && (
        <div className={styles.bar} style={{ height: 4 }}>
          <div className={`${styles.barFill} ${styles.barArmor}`} style={{ width: `${armorPct}%` }} />
        </div>
      )}

      {!!shield && shield > 0 && (
        <div className={styles.barRow}>
          <span className={styles.shieldBadge}>✦ щит {shield}</span>
        </div>
      )}

      {isFx && (
        <>
          {fx.kind === 'hit' && <img className={styles.hitImg} src="/art/dungeon/hit.png" alt="" draggable={false} />}
          <span
            className={`${styles.dmgNum} ${fx.kind === 'heal' ? styles.dmgHeal : ''} ${fx.kind === 'shield' ? styles.dmgShield : ''}`}
          >
            {fx.kind === 'hit' ? `-${fx.value}` : `+${fx.value}`}
          </span>
        </>
      )}
    </div>
  );
};
