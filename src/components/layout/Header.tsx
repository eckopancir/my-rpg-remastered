import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { usePlayerStore } from '../../stores/playerStore';
import { useUiStore } from '../../stores/uiStore';
import { useCombatGridStore } from '../../stores/combatGridStore';
import { useAuthStore } from '../../stores/authStore';
import { useSound } from '../../hooks/useSound';
import { images } from '../../assets/index';
import styles from './Header.module.css';
import dashA2 from '../../assets/images/ui/a2.png';
import dashA1 from '../../assets/images/ui/a1.png';
import hpPlateImg from '../../assets/images/ui/hp-plate.png';
import staminaPlateImg from '../../assets/images/ui/stamina-plate.png';

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

  // Настройка «Подтверждение выхода из боя»: уход с арены через навигацию — с вопросом.
  const guardCombatNav = (e: React.MouseEvent<HTMLAnchorElement>) => {
    playClick();
    const ui = useUiStore.getState();
    const combat = useCombatGridStore.getState();
    if (combat.isActive && (ui.confirmExitCombat ?? true)) {
      const href = e.currentTarget.getAttribute('href');
      if (href && window.location.pathname !== href) {
        if (!window.confirm('Точно выйти из боя? Прогресс боя будет потерян.')) e.preventDefault();
      }
    }
  };

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
            onClick={guardCombatNav}
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
              onClick={guardCombatNav}
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
          <NavLink to="/settings" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`} onClick={guardCombatNav}>
            ⚙️ Settings
          </NavLink>
        </nav>
      </div>
      <div className={styles.right}>
        <div className={`${styles.stat} ${styles.hpBar}`} title={`HP ${Math.round(stats.currentHp)} / ${stats.maxHp}`}>
          <div style={{
            position: 'relative', width: 140, aspectRatio: '735 / 352',
            backgroundImage: `url(${hpPlateImg})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
          }}>
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              paddingLeft: 37, fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 10,
              color: stats.currentHp / Math.max(1, stats.maxHp) < 0.3 ? '#f87171' : '#fff',
              textShadow: '0 0 6px rgba(0,0,0,0.9), 0 2px 3px rgba(0,0,0,0.9)',
              letterSpacing: 0, whiteSpace: 'nowrap',
            }}>
              {Math.round(stats.currentHp)} / {stats.maxHp}
            </div>
          </div>
        </div>
        <div className={styles.stat} title={`Стамина ${Math.round(stats.stamina)}`}>
          <img src={staminaPlateImg} alt="⚡" draggable={false} style={{ height: 34, width: 'auto', display: 'block' }} />
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
