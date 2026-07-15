import { NavLink } from 'react-router-dom';
import { usePlayerStore } from '../../stores/playerStore';
import { useUiStore } from '../../stores/uiStore';
import { useSound } from '../../hooks/useSound';
import { WapHudBar } from '../ui/WapHudBar';
import { images } from '../../assets/index';
import styles from './Header.module.css';

const navItems = [
  { to: '/', label: '📊 Dashboard' },
  { to: '/skills', label: '⭐ Skills' },
  { to: '/map', label: '🗺️ Map' },
  { to: '/base', label: '🏢 Base' },
  { to: '/bazaar', label: '🏪 Bazaar' },
  { to: '/craft', label: '🔧 CRAFT' },
];

export const Header = () => {
  const level = usePlayerStore((s) => s.level);
  const dataChips = usePlayerStore((s) => s.dataChips);
  const stats = usePlayerStore((s) => s.stats);
  const exp = usePlayerStore((s) => s.currentExp);
  const expToNext = usePlayerStore((s) => s.expToNext);
  const toggleInventory = useUiStore((s) => s.toggleInventory);
  const toggleEquipment = useUiStore((s) => s.toggleEquipment);
  const { playClick } = useSound();

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <div className={styles.logo}>Wasteland</div>
        <nav className={styles.nav}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
              }
              onClick={playClick}
            >
              {item.label}
            </NavLink>
          ))}
          <button
            className={styles.navLink}
            onClick={() => { playClick(); toggleEquipment(); }}
            style={{ background: 'none', border: '1px solid transparent', cursor: 'pointer', fontFamily: 'var(--wa-font-hud)', fontSize: 12 }}
          >
            ⚔️ Equipment
          </button>
          <button
            className={styles.navLink}
            onClick={() => { playClick(); toggleInventory(); }}
            style={{ background: 'none', border: '1px solid transparent', cursor: 'pointer', fontFamily: 'var(--wa-font-hud)', fontSize: 12 }}
          >
            🎒 Inventory
          </button>
          <NavLink to="/settings" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`} onClick={playClick}>
            ⚙️ Settings
          </NavLink>
        </nav>
      </div>
      <div className={styles.right}>
        <div className={`${styles.stat} ${styles.hpBar}`}>
          <WapHudBar label="HP" value={stats.currentHp} max={stats.maxHp} variant="hp" size="sm" />
        </div>
        <div className={styles.stat}>
          <span style={{ color: 'var(--wa-accent-amber)' }}>⚡</span>
          <span className={styles.statValue}>{Math.round(stats.stamina)}</span>
        </div>
        <div className={styles.stat}>
          Lv.<span className={styles.statValue}>{level}</span>
        </div>
        <div className={styles.stat}>
          💾<span className={styles.statValue}>{dataChips}</span>
        </div>
      </div>
    </header>
  );
};