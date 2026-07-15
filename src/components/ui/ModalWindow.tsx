import { useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './ModalWindow.module.css';

interface ModalWindowProps {
  open: boolean;
  onClose?: () => void;
  title?: string;
  icon?: string;
  variant?: 'metal' | 'rust' | 'screen';
  glow?: 'amber' | 'teal' | 'green' | 'none';
  width?: number | string;
  children: ReactNode;
  footer?: ReactNode;
}

export const ModalWindow = ({
  open,
  onClose,
  title,
  icon,
  variant = 'metal',
  glow = 'amber',
  width = 480,
  children,
  footer,
}: ModalWindowProps) => {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const glowClass = glow !== 'none' ? styles[`glow-${glow}`] : '';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}
        >
          <motion.div
            className={`${styles.frame} ${styles[variant]} ${glowClass}`}
            style={{ width: typeof width === 'number' ? width : width, maxWidth: '90vw' }}
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28, mass: 0.8 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Corner decorations */}
            <div className={`${styles.corners} ${glowClass}`} />
            <div className={`${styles.cornerBl} ${glowClass}`} />
            <div className={`${styles.cornerBr} ${glowClass}`} />

            {/* Header */}
            <div className={styles.header}>
              <div className={styles.headerLeft}>
                <div className={`${styles.diamond} ${glowClass}`} />
                <div className={styles.headerLine} />
              </div>
              <div className={styles.headerContent}>
                {icon && <span className={styles.headerIcon}>{icon}</span>}
                {title && <span className={styles.headerTitle}>{title}</span>}
              </div>
              <div className={styles.headerRight}>
                <div className={styles.headerLine} />
                <div className={`${styles.diamond} ${glowClass}`} />
                {onClose && (
                  <button className={styles.closeBtn} onClick={onClose}>✕</button>
                )}
              </div>
            </div>

            {/* Body */}
            <div className={styles.body}>
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className={styles.footer}>
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
