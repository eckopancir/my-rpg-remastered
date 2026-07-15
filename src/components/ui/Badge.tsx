import { type ReactNode } from 'react';
import styles from './Badge.module.css';

interface BadgeProps {
  children: ReactNode;
  variant?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

export const Badge = ({ children, variant = 'info', className = '' }: BadgeProps) => (
  <span className={`${styles.badge} ${styles[variant]} ${className}`}>
    {children}
  </span>
);
