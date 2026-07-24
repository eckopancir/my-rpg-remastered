import { type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import styles from './PageContainer.module.css';

interface PageContainerProps {
  children?: ReactNode;
}

export const PageContainer = ({ children }: PageContainerProps) => (
  <div className={styles.layout}>
    <Header />
    <div className={styles.body}>
      <Sidebar />
      <main className={styles.content}>
        {children || <Outlet />}
      </main>
    </div>
  </div>
);
