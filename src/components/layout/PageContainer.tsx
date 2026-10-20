import { type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useCombatGridStore } from '../../stores/combatGridStore';
import { useMapEditorStore } from '../../stores/mapEditorStore';
import styles from './PageContainer.module.css';

interface PageContainerProps {
  children?: ReactNode;
}

/** Страницы путешествия: свой интерфейс на всю ширину, журнал слева мешает. */
const WIDE_ROUTES = ['/explore', '/adventure'];

export const PageContainer = ({ children }: PageContainerProps) => {
  // Театр боя: хедер и журнал скрыты, всё место — арене.
  const battleActive = useCombatGridStore((s) => s.isActive);
  const editorActive = useMapEditorStore((s) => s.active);
  const theater = battleActive && !editorActive;
  // Путешествие: хедер оставляем (навигация нужна), журнал убираем.
  const location = useLocation();
  const wide = WIDE_ROUTES.some((p) => location.pathname.startsWith(p));
  return (
    <div className={`${styles.layout}${theater ? ` ${styles.theater}` : ''}${wide ? ` ${styles.wide}` : ''}`}>
      {!theater && <Header />}
      <div className={styles.body}>
        {!theater && !wide && <Sidebar />}
        <main className={styles.content}>
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};
