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
  healDown?: number;
  armorDown?: number;
  vuln?: number;
  barrier?: number;
  regen?: number;
  thorns?: number;
  taunt?: number;
  dodge?: number;
  slotLabel?: string;
  /** Арт наёмника (если нарисован). */
  image?: string;
  dead?: boolean;
  selected?: boolean;
  targetable?: boolean;
  fx?: Fx | null;
  onClick?: () => void;
}

export const MercCard = ({
  id, name, role, stars, hp, maxHp, armor, maxArmor, shield, healDown, armorDown, vuln,
  barrier, regen, thorns, taunt, dodge, slotLabel, image, dead, selected, targetable, fx, onClick,
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
      style={{ ['--role-color' as string]: ROLE_COLOR[role] }}
      onClick={onClick}
      title={`${name} · ${ROLE_NAME[role]}`}
      data-target-kind="merc"
      data-target-uid={id}
    >
      {slotLabel && <span className={styles.slotTag}>{slotLabel}</span>}

      <div className={styles.mercArt}>
        {image
          ? <img className={styles.mercArtImg} src={image} alt="" draggable={false} />
          : <span className={styles.mercArtIcon} style={{ color: ROLE_COLOR[role] }}>{ROLE_ICON[role]}</span>}
      </div>

      <div className={styles.mercHead}>
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

      {(!!barrier || !!regen || !!thorns || !!taunt || !!dodge) && (
        <div className={styles.mercDebuffs}>
          {!!barrier && <span className={styles.debuffBadge} style={{ color: '#7dd3fc' }} title="Поглощает урон, не сгорает в конце хода">барьер {barrier}</span>}
          {!!regen && <span className={styles.debuffBadge} style={{ color: '#4ade80' }} title="Лечит каждый ход">реген {regen}</span>}
          {!!thorns && <span className={styles.debuffBadge} style={{ color: '#fb923c' }} title="Наносит урон атакующему">шипы {thorns}</span>}
          {!!taunt && <span className={styles.debuffBadge} style={{ color: '#fbbf24' }} title="Враги бьют только его">провок. {taunt}</span>}
          {!!dodge && <span className={styles.debuffBadge} style={{ color: '#a3e635' }} title="Шанс уклониться">уклон. {dodge}%</span>}
        </div>
      )}

      {(!!healDown || !!armorDown || !!vuln) && (
        <div className={styles.mercDebuffs}>
          {!!healDown && <span className={styles.debuffBadge} style={{ color: '#c084fc' }} title="Хил урезан вдвое">−хил {healDown}</span>}
          {!!armorDown && <span className={styles.debuffBadge} style={{ color: '#38bdf8' }} title="Броня восстанавливается вдвое меньше">−броня {armorDown}</span>}
          {!!vuln && <span className={styles.debuffBadge} style={{ color: '#f472b6' }} title="Получает +50% урона">уязв. {vuln}</span>}
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
