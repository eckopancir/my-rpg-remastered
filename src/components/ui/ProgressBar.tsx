import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  value: number;
  max: number;
  variant?: 'hp' | 'stamina' | 'exp' | 'accent';
  label?: string;
  showPercent?: boolean;
  className?: string;
}

export const ProgressBar = ({
  value,
  max,
  variant = 'accent',
  label,
  showPercent = false,
  className = '',
}: ProgressBarProps) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={`${styles.wrapper} ${className}`}>
      {label && (
        <div className={styles.label}>
          <span>{label}</span>
          <span>{showPercent ? `${Math.round(pct)}%` : `${Math.round(value)} / ${max}`}</span>
        </div>
      )}
      <div className={styles.track}>
        <div className={`${styles.fill} ${styles[variant]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};
