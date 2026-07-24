import styles from './WapHudBar.module.css';

interface WapHudBarProps {
  label: string;
  value: number;
  max: number;
  variant?: 'hp' | 'stamina' | 'xp' | 'armor';
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const WapHudBar = ({
  label,
  value,
  max,
  variant = 'hp',
  showIcon = true,
  size = 'md',
}: WapHudBarProps) => {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const icons: Record<string, string> = {
    hp: '❤️', stamina: '⚡', xp: '⭐', armor: '🛡️',
  };

  return (
    <div className={`${styles.bar} ${styles[variant]} ${styles[`size-${size}`]}`}>
      {showIcon && <span className={styles.icon}>{icons[variant] || '📊'}</span>}
      <span className={styles.label}>{label}</span>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.value}>{Math.round(value)}/{max}</span>
    </div>
  );
};