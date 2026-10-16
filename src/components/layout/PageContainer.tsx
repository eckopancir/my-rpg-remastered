import { type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useCombatGridStore } from '../../stores/combatGridStore';
import { useMapEditorStore } from '../../stores/mapEditorStore';
import styles from './PageContainer.module.css';

interface PageContainerProps {
  children?: ReactNode;
}

export const PageContainer = ({ children }: PageContainerProps) => {
  // Театр боя: хедер и журнал скрыты, всё место — арене.
  const battleActive = useCombatGridStore((s) => s.isActive);
  const editorActive = useMapEditorStore((s) => s.active);
  const theater = battleActive && !editorActive;
  return (
    <div className={`${styles.layout}${theater ? ` ${styles.theater}` : ''}`}>
      {!theater && <Header />}
      <div className={styles.body}>
        {!theater && <Sidebar />}
        <main className={styles.content}>
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};
