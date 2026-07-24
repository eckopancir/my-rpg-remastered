import { type ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps {
  children: ReactNode;
  clickable?: boolean;
  rarity?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  header?: ReactNode;
  footer?: ReactNode;
}

const rarityMap: Record<string, string> = {
  common: styles.rarityCommon,
  uncommon: styles.rarityUncommon,
  rare: styles.rarityRare,
  epic: styles.rarityEpic,
  legendary: styles.rarityLegendary,
};

export const Card = ({
  children,
  clickable = false,
  rarity,
  className = '',
  style,
  onClick,
  header,
  footer,
}: CardProps) => (
  <div
    className={`${styles.card} ${clickable ? styles.clickable : ''} ${rarity ? rarityMap[rarity] || '' : ''} ${className}`}
    style={style}
    onClick={onClick}
  >
    {header && <div className={styles.header}>{header}</div>}
    <div className={styles.body}>{children}</div>
    {footer && <div className={styles.footer}>{footer}</div>}
  </div>
);
