import type { ReactNode } from 'react';
import styles from './WapHeader.module.css';

interface WapHeaderProps {
  title: string;
  subtitle?: string;
  icon?: string;
  glow?: 'amber' | 'teal' | 'green' | 'none';
  children?: ReactNode;
  onMouseDown?: React.MouseEventHandler<HTMLDivElement>;
  style?: React.CSSProperties;
}

export const WapHeader = ({ title, subtitle, icon, glow = 'amber', children, onMouseDown, style }: WapHeaderProps) => (
  <div className={`${styles.header} ${styles[`glow-${glow}`]}`} onMouseDown={onMouseDown} style={style}>
    <div className={styles.indicator} />
    <div className={styles.content}>
      <div className={styles.titleRow}>
        {icon && <span className={styles.icon}>{icon}</span>}
        <span className={styles.title}>{title}</span>
      </div>
      {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
    </div>
    {children && <div className={styles.children}>{children}</div>}
    <div className={styles.indicator} />
  </div>
);