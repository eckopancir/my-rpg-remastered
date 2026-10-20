import { usePlayerStore } from '../../stores/playerStore';
import { getCharacterImage, getItemImage } from '../../assets/index';
import styles from './travel.module.css';

/** Слоты снаряжения, которые показываем в панели отряда. */
const SHOWN_SLOTS: { slot: string; label: string; icon: string }[] = [
  { slot: 'weapon1', label: 'Оружие 1', icon: '🗡' },
  { slot: 'weapon2', label: 'Оружие 2', icon: '🔫' },
  { slot: 'head', label: 'Шлем', icon: '🪖' },
  { slot: 'armor', label: 'Бронежилет', icon: '🧥' },
  { slot: 'pants', label: 'Штаны', icon: '👖' },
  { slot: 'gloves', label: 'Перчатки', icon: '🧤' },
  { slot: 'boots', label: 'Ботинки', icon: '🥾' },
  { slot: 'shield', label: 'Щит', icon: '🛡' },
];

export const PartyPanel = () => {
  const level = usePlayerStore((s) => s.level);
  const stats = usePlayerStore((s) => s.stats);
  const equipment = usePlayerStore((s) => s.equipment);

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

        <div className={styles.sectionTitle}>Снаряжение</div>
        <div className={styles.gearGrid}>
          {SHOWN_SLOTS.map(({ slot, label, icon }) => {
            const item: any = (equipment as any)[slot];
            const img = item ? getItemImage(item.name, item.displayName, item.slot, item.type) : undefined;
            return (
              <div
                key={slot}
                className={`${styles.gearSlot} ${item ? '' : styles.gearSlotEmpty}`}
                title={item ? `${item.displayName || item.name}\n${label}` : `${label}: пусто`}
              >
                {item
                  ? (img
                    ? <img className={styles.gearImg} src={img} alt="" />
                    : <span className={styles.gearIcon}>{icon}</span>)
                  : <span className={styles.gearIcon}>{icon}</span>}
              </div>
            );
          })}
        </div>

        <div className={styles.sectionTitle}>Состояние</div>
        <div className={styles.statList}>
          <div className={styles.statRow}>
            <span>Урон</span>
            <b>{Math.round(stats.damage || 0)}</b>
          </div>
          <div className={styles.statRow}>
            <span>Крит</span>
            <b>{Math.round((stats.critChance || 0) * 100)}%</b>
          </div>
          <div className={`${styles.statRow} ${regen > 0 ? styles.statGood : ''}`}>
            <span>Реген в минуту</span>
            <b>+{Math.round(regen)}</b>
          </div>
          <div className={styles.statRow}>
            <span>Макс. HP</span>
            <b>{Math.round(maxHp)}</b>
          </div>
        </div>
      </div>
    </div>
  );
};
