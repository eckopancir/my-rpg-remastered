import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { usePlayerStore } from '../../stores/playerStore';
import { useUiStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { useSound } from '../../hooks/useSound';
import { WapHudBar } from '../ui/WapHudBar';
import { images } from '../../assets/index';
import styles from './Header.module.css';
import dashA2 from '../../assets/images/ui/a2.png';
import dashA1 from '../../assets/images/ui/a1.png';

const navItems = [
  { to: '/skills', label: '⭐ Skills' },
  { to: '/map', label: '🗺️ Map' },
  { to: '/adventure', label: '🔍 Travel' },
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
  const toggleRange = useUiStore((s) => s.toggleRange);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { playClick } = useSound();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [dashHover, setDashHover] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Предзагрузка ховер-картинки, чтобы не мигало при первом наведении.
  useEffect(() => {
    const img = new Image();
    img.src = dashA1;
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <div className={styles.logo}>Wasteland</div>
        <nav className={styles.nav}>
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `${styles.navLink} ${styles.navImageLink} ${isActive ? styles.navLinkActive : ''}`
            }
            onClick={playClick}
            onMouseEnter={() => setDashHover(true)}
            onMouseLeave={() => setDashHover(false)}
          >
            <img
              src={dashHover ? dashA1 : dashA2}
              alt="Dashboard"
              style={{ height: 94, width: 'auto', display: 'block' }}
            />
          </NavLink>
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
          <button
            className={styles.navLink}
            onClick={() => { playClick(); toggleRange(); }}
            style={{ background: 'none', border: '1px solid transparent', cursor: 'pointer', fontFamily: 'var(--wa-font-hud)', fontSize: 12 }}
          >
            🎯 Полигон
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

        {/* User menu */}
        {user && (
          <div className={styles.userMenu} ref={menuRef}>
            <button
              className={styles.userButton}
              onClick={() => { playClick(); setMenuOpen(!menuOpen); }}
              title={user.username}
            >
              <span className={styles.userAvatar}></span>
              <span className={styles.userName}>{user.username}</span>
              <span className={styles.userCaret}>{menuOpen ? '▲' : '▼'}</span>
            </button>
            {menuOpen && (
              <div className={styles.userDropdown}>
                <div className={styles.userDropdownInfo}>
                  <span style={{ fontSize: 18 }}></span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{user.username}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--wa-font-terminal)' }}>
                      ID: {user.id}
                    </div>
                  </div>
                </div>
                {user.is_admin && (
                  <button
                    className={styles.userDropdownItem}
                    onClick={() => { playClick(); setMenuOpen(false); navigate('/admin'); }}
                    style={{ color: 'var(--wa-accent-amber)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(217,119,6,0.08)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                  >
                    ⚙️ Админка
                  </button>
                )}
                <div className={styles.userDropdownDivider} />
                <button
                  className={styles.userDropdownItem}
                  onClick={() => { playClick(); setMenuOpen(false); logout(); }}
                >
                  🚪 Выйти
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
