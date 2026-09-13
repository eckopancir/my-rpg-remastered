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
import skillsOff from '../../assets/images/ui/skills-off.jpg';
import skillsOn from '../../assets/images/ui/skills-on.jpg';
import mapOff from '../../assets/images/ui/map-off.jpg';
import mapOn from '../../assets/images/ui/map-on.jpg';
import travelOff from '../../assets/images/ui/travel-off.jpg';
import travelOn from '../../assets/images/ui/travel-on.jpg';
import baseOff from '../../assets/images/ui/base-off.jpg';
import baseOn from '../../assets/images/ui/base-on.jpg';
import bazaarOff from '../../assets/images/ui/bazaar-off.jpg';
import bazaarOn from '../../assets/images/ui/bazaar-on.jpg';
import craftOff from '../../assets/images/ui/craft-off.jpg';
import craftOn from '../../assets/images/ui/craft-on.jpg';
import equipmentOff from '../../assets/images/ui/equipment-off.jpg';
import equipmentOn from '../../assets/images/ui/equipment-on.jpg';
import inventoryOff from '../../assets/images/ui/inventory-off.jpg';
import inventoryOn from '../../assets/images/ui/inventory-on.jpg';
import polygonOff from '../../assets/images/ui/polygon-off.jpg';
import polygonOn from '../../assets/images/ui/polygon-on.jpg';
import settingsOff from '../../assets/images/ui/settings-off.jpg';
import settingsOn from '../../assets/images/ui/settings-on.jpg';
import hpIconImg from '../../assets/images/ui/hp-icon.png';
import staminaPlateImg from '../../assets/images/ui/stamina-plate.png';
import levelIconImg from '../../assets/images/ui/level-icon.png';

const imageNavItems = [
  { to: '/skills', label: 'Skills', off: skillsOff, on: skillsOn },
  { to: '/map', label: 'Map', off: mapOff, on: mapOn },
  { to: '/adventure', label: 'Travel', off: travelOff, on: travelOn },
  { to: '/base', label: 'Base', off: baseOff, on: baseOn },
  { to: '/bazaar', label: 'Bazaar', off: bazaarOff, on: bazaarOn },
  { to: '/craft', label: 'Craft', off: craftOff, on: craftOn },
];

const navItems: { to: string; label: string }[] = [];

export const Header = () => {
  const level = usePlayerStore((s) => s.level);
  const dataChips = usePlayerStore((s) => s.dataChips);
  const stats = usePlayerStore((s) => s.stats);
  const exp = usePlayerStore((s) => s.currentExp);
  const expToNext = usePlayerStore((s) => s.expToNext);
  const toggleInventory = useUiStore((s) => s.toggleInventory);
  const toggleEquipment = useUiStore((s) => s.toggleEquipment);
  const toggleBackpack = useUiStore((s) => s.toggleBackpack);
  const toggleRange = useUiStore((s) => s.toggleRange);
  const inventoryOpen = useUiStore((s) => s.inventoryOpen);
  const equipmentOpen = useUiStore((s) => s.equipmentOpen);
  const rangeOpen = useUiStore((s) => s.rangeOpen);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { playClick } = useSound();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [hoverImg, setHoverImg] = useState<string | null>(null);
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

  // Предзагрузка ховер-картинок, чтобы не мигало при первом наведении.
  useEffect(() => {
    for (const src of [dashA1, skillsOn, mapOn, travelOn, baseOn, bazaarOn, craftOn, equipmentOn, inventoryOn, polygonOn, settingsOn]) {
      const img = new Image();
      img.src = src;
    }
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
            onMouseEnter={() => setHoverImg('/dashboard')}
            onMouseLeave={() => setHoverImg(null)}
          >
            {({ isActive }) => (
              <img
                src={hoverImg === '/dashboard' || isActive ? dashA1 : dashA2}
                alt="Dashboard"
                className={styles.navImage}
              />
            )}
          </NavLink>
          {imageNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `${styles.navLink} ${styles.navImageLink} ${isActive ? styles.navLinkActive : ''}`
              }
              onClick={guardCombatNav}
              onMouseEnter={() => setHoverImg(item.to)}
              onMouseLeave={() => setHoverImg(null)}
            >
              {({ isActive }) => (
                <img
                  src={hoverImg === item.to || isActive ? item.on : item.off}
                  alt={item.label}
                  className={styles.navImage}
                />
              )}
            </NavLink>
          ))}
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
            className={`${styles.navLink} ${styles.navImageLink} ${rangeOpen ? styles.navLinkActive : ''}`}
            onClick={() => { playClick(); toggleRange(); }}
            onMouseEnter={() => setHoverImg('range')}
            onMouseLeave={() => setHoverImg(null)}
            style={{ background: 'none', border: '1px solid transparent', cursor: 'pointer', padding: '2px 0' }}
            title="Shooting Range"
          >
            <img src={hoverImg === 'range' || rangeOpen ? polygonOn : polygonOff} alt="Shooting Range" className={styles.navImage} />
          </button>
          <button
            className={`${styles.navLink} ${styles.navImageLink} ${equipmentOpen ? styles.navLinkActive : ''}`}
            onClick={() => { playClick(); toggleEquipment(); }}
            onMouseEnter={() => setHoverImg('equipment')}
            onMouseLeave={() => setHoverImg(null)}
            style={{ background: 'none', border: '1px solid transparent', cursor: 'pointer', padding: '2px 0' }}
            title="Equipment"
          >
            <img src={hoverImg === 'equipment' || equipmentOpen ? equipmentOn : equipmentOff} alt="Equipment" className={styles.navImage} />
          </button>
          {/* Скрыта: нет картинки-кнопки для Backpack — код оставлен, вернуть = убрать display: 'none' */}
          <button
            className={styles.navLink}
            onClick={() => { playClick(); toggleBackpack(); }}
            style={{ display: 'none', background: 'none', border: '1px solid transparent', cursor: 'pointer', fontFamily: 'var(--wa-font-hud)', fontSize: 12 }}
          >
            🎒 Backpack
          </button>
          <button
            className={`${styles.navLink} ${styles.navImageLink} ${inventoryOpen ? styles.navLinkActive : ''}`}
            onClick={() => { playClick(); toggleInventory(); }}
            onMouseEnter={() => setHoverImg('inventory')}
            onMouseLeave={() => setHoverImg(null)}
            style={{ background: 'none', border: '1px solid transparent', cursor: 'pointer', padding: '2px 0' }}
            title="Inventory"
          >
            <img src={hoverImg === 'inventory' || inventoryOpen ? inventoryOn : inventoryOff} alt="Inventory" className={styles.navImage} />
          </button>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `${styles.navLink} ${styles.navImageLink} ${isActive ? styles.navLinkActive : ''}`
            }
            onClick={guardCombatNav}
            onMouseEnter={() => setHoverImg('/settings')}
            onMouseLeave={() => setHoverImg(null)}
          >
            {({ isActive }) => (
              <img
                src={hoverImg === '/settings' || isActive ? settingsOn : settingsOff}
                alt="Settings"
                className={styles.navImage}
              />
            )}
          </NavLink>
        </nav>
      </div>
      <div className={styles.right}>
        <div className={`${styles.stat} ${styles.hpBar}`} title={`HP ${Math.round(stats.currentHp)} / ${stats.maxHp}`}>
          <img src={hpIconImg} alt="HP" draggable={false} style={{ height: 31, width: 'auto', display: 'block' }} />
          <span className={styles.statValue} style={{ fontSize: 15, color: stats.currentHp / Math.max(1, stats.maxHp) < 0.3 ? '#f87171' : undefined }}>
            {Math.round(stats.currentHp)} / {stats.maxHp}
          </span>
        </div>
        <div className={styles.stat} title={`Стамина ${Math.round(stats.stamina)}`}>
          <img src={staminaPlateImg} alt="⚡" draggable={false} style={{ height: 34, width: 'auto', display: 'block' }} />
          <span className={styles.statValue} style={{ fontSize: 15 }}>{Math.round(stats.stamina)}</span>
        </div>
        <div className={styles.stat} style={{ fontSize: 20, gap: 8 }} title={`Уровень ${level}`}>
          <img src={levelIconImg} alt="Lv." draggable={false} style={{ height: 34, width: 'auto', display: 'block' }} />
          <span className={styles.statValue} style={{ fontSize: 15 }}>{level}</span>
        </div>
        <div className={styles.stat} style={{ fontSize: 20 }}>
          💾<span className={styles.statValue} style={{ fontSize: 15 }}>{dataChips}</span>
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
