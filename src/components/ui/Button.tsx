import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  children: ReactNode;
}

export const Button = ({
  variant = 'secondary',
  size = 'md',
  children,
  className = '',
  ...props
}: ButtonProps) => (
  <button
    className={`${styles.btn} ${styles[variant]} ${size !== 'md' ? styles[size] : ''} ${className}`}
    {...props}
  >
    {children}
  </button>
);
