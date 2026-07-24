import { type ReactNode, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

interface AuthGuardProps {
  children: ReactNode;
}

export const AuthGuard = ({ children }: AuthGuardProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const loading = useAuthStore((s) => s.loading);

  useEffect(() => {
    if (!loading && !user && !token) {
      navigate('/login', { replace: true, state: { from: location } });
    }
  }, [user, token, loading, navigate, location]);

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--wa-bg-deep)',
        fontFamily: 'var(--wa-font-terminal)', color: 'var(--wa-accent-amber)',
        flexDirection: 'column', gap: 16,
      }}>
        <div style={{ fontSize: 48, opacity: 0.6 }}>⏳</div>
        <div style={{ fontSize: 14, letterSpacing: 2, textTransform: 'uppercase' }}>Загрузка...</div>
      </div>
    );
  }

  if (!user && !token) {
    return null;
  }

  return <>{children}</>;
};
