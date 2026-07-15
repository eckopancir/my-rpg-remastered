import type { ReactNode } from 'react';
import styles from './WapFrame.module.css';

interface WapFrameProps {
  children: ReactNode;
  border?: 'rust' | 'metal' | 'screen' | 'none';
  corners?: 'screws' | 'rivets' | 'none';
  glow?: 'amber' | 'teal' | 'green' | 'none';
  className?: string;
  style?: React.CSSProperties;
}

export const WapFrame = ({
  children,
  border = 'rust',
  corners = 'rivets',
  glow = 'none',
  className = '',
  style,
}: WapFrameProps) => (
  <div
    className={`${styles.frame} ${styles[`border-${border}`]} ${styles[`corners-${corners}`]} ${styles[`glow-${glow}`]} ${className}`}
    style={style}
  >
    <div className={styles.cornerTL} />
    <div className={styles.cornerTR} />
    {children}
    <div className={styles.cornerBL} />
    <div className={styles.cornerBR} />
  </div>
);