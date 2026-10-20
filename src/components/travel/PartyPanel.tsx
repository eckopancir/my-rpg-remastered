import { usePlayerStore } from '../../stores/playerStore';
import { getCharacterImage } from '../../assets/index';
import { BackpackPanel } from './BackpackPanel';
import styles from './travel.module.css';

export const PartyPanel = () => {
  const level = usePlayerStore((s) => s.level);
  const stats = usePlayerStore((s) => s.stats);

  const maxHp = Math.max(1, stats.maxHp || 1);
  const hp = Math.max(0, Math.min(maxHp, stats.currentHp || 0));
  const hpPct = Math.round((hp / maxHp) * 100);

  const maxStam = Math.max(1, stats.maxStamina || 1);
  const stam = Math.max(0, Math.min(maxStam, stats.stamina || 0));
  const stamPct = Math.round((stam / maxStam) * 100);

  const regen = stats.regen || 0;
  const portrait = getCharacterImage('hero') || getCharacterImage('hero2');

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span>Отряд</span>
        <span style={{ color: 'var(--text-secondary)' }}>ур. {level}</span>
      </div>

      <div className={styles.panelBody}>
        <div className={styles.portraitRow}>
          <div className={styles.portrait}>
            {portrait
              ? <img className={styles.portraitImg} src={portrait} alt="" />
              : <span className={styles.portraitFallback}>🧑</span>}
            <span className={styles.lvlBadge}>LV {level}</span>
          </div>
          <div className={styles.nameBlock}>
            <div className={styles.nameTitle}>Сталкер</div>
            <div className={styles.nameSub}>
              {stats.armor ? `Броня ${Math.round(stats.armor)}` : 'Без брони'}
              {stats.evasion ? ` · Уклон ${Math.round(stats.evasion * 100)}%` : ''}
            </div>
            <div className={styles.nameSub}>
              {regen > 0 ? `♺ Реген +${Math.round(regen)} HP/мин` : '♺ Регена нет'}
            </div>
          </div>
        </div>

        <div className={styles.bar}>
          <div className={styles.barLabel}>
            <span>❤ Здоровье</span>
            <b>{Math.round(hp)} / {Math.round(maxHp)}</b>
          </div>
          <div className={styles.barTrack}>
            <div className={`${styles.barFill} ${styles.barHp}`} style={{ width: `${hpPct}%` }} />
          </div>
        </div>

        <div className={styles.bar}>
          <div className={styles.barLabel}>
            <span>⚡ Выносливость</span>
            <b>{Math.round(stam)} / {Math.round(maxStam)}</b>
          </div>
          <div className={styles.barTrack}>
            <div className={`${styles.barFill} ${styles.barStam}`} style={{ width: `${stamPct}%` }} />
          </div>
        </div>

        <BackpackPanel />
      </div>
    </div>
  );
};
