import { type ReactNode } from 'react';
import styles from './GlassPanel.module.css';

interface GlassPanelProps {
  children: ReactNode;
  glow?: boolean;
  padding?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  style?: React.CSSProperties;
}

export const GlassPanel = ({
  children,
  glow = false,
  padding = 'md',
  className = '',
  style,
}: GlassPanelProps) => (
  <div
    className={`${styles.glass} ${glow ? styles.glow : ''} ${styles[`padding${padding.charAt(0).toUpperCase() + padding.slice(1)}`]} ${className}`}
    style={style}
  >
    {children}
  </div>
);
