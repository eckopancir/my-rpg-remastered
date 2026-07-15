import type { ReactNode } from 'react';
import styles from './WapPanel.module.css';

interface WapPanelProps {
  variant?: 'metal' | 'rust' | 'screen';
  glow?: 'amber' | 'teal' | 'green' | 'none';
  padding?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const WapPanel = ({
  variant = 'metal',
  glow = 'none',
  padding = 'md',
  children,
  className = '',
  style,
}: WapPanelProps) => (
  <div
    className={`${styles.panel} ${styles[variant]} ${styles[`glow-${glow}`]} ${styles[`pad-${padding}`]} ${className}`}
    style={style}
  >
    {children}
  </div>
);