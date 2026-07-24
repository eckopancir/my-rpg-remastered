import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { images } from '../assets/index';
import { MusicPlayer } from '../components/widgets/MusicPlayer';

export const Login = () => {
  const navigate = useNavigate();
  const { login, register, loading, error, clearError } = useAuthStore();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();

    if (!username.trim() || !password) return;

    if (!isLogin && password !== confirmPassword) {
      useAuthStore.setState({ error: 'Пароли не совпадают' });
      return;
    }

    let success: boolean;
    if (isLogin) {
      success = await login(username.trim(), password);
    } else {
      success = await register(username.trim(), password);
    }

    if (success) {
      navigate('/', { replace: true });
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    clearError();
  };

  return (
    <>
      <MusicPlayer track="zemlya-mutantov" />
      <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', width: '100vw',
      background: images.background ? `url(${images.background})` : 'var(--wa-bg-deep)',
      backgroundSize: 'cover', backgroundPosition: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Dark overlay */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'rgba(0,0,0,0.6)',
      }} />

      {/* Scanlines */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1,
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
      }} />

      {/* Vignette */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1,
        background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.7) 100%)',
      }} />

      {/* Background glow */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 600, height: 600,
        background: 'radial-gradient(circle, rgba(217,119,6,0.06) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          position: 'relative', zIndex: 2,
          width: 400, maxWidth: '90vw',
        }}
      >
        {/* Logo */}
        <div style={{
          textAlign: 'center', marginBottom: 32,
        }}>
          <div style={{
            fontFamily: 'var(--wa-font-display)',
            fontSize: 36, fontWeight: 900,
            color: 'var(--wa-accent-amber)',
            letterSpacing: 6,
            textTransform: 'uppercase',
            textShadow: '0 0 40px rgba(217,119,6,0.4), 0 0 80px rgba(217,119,6,0.15), 0 4px 8px rgba(0,0,0,0.6), 2px 2px 0 rgba(0,0,0,0.3)',
            marginBottom: 8,
          }}>
            Wasteland
          </div>
          <div style={{
            fontFamily: 'var(--wa-font-terminal)',
            fontSize: 13,
            color: 'var(--text-secondary)',
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}>
            {isLogin ? 'Вход в систему' : 'Регистрация'}
          </div>
          <div style={{
            width: 60, height: 2,
            background: 'linear-gradient(90deg, transparent, var(--wa-accent-amber), transparent)',
            margin: '12px auto 0',
          }} />
        </div>

        {/* Form card */}
        <div style={{
          background: 'rgba(18, 16, 14, 0.92)',
          border: '1px solid rgba(146, 64, 14, 0.3)',
          borderRadius: 8,
          padding: 32,
          boxShadow: '0 16px 48px rgba(0,0,0,0.5), 0 0 20px rgba(217,119,6,0.08)',
          backdropFilter: 'blur(8px)',
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Username */}
            <div>
              <label style={{
                display: 'block',
                fontFamily: 'var(--wa-font-hud)',
                fontSize: 11,
                color: 'var(--wa-accent-amber)',
                letterSpacing: 2,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}>
                Логин
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="wastelander"
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(146,64,14,0.25)',
                  borderRadius: 4,
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 14,
                  outline: 'none',
                  transition: 'border-color 200ms ease',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(217,119,6,0.5)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(146,64,14,0.25)'; }}
              />
            </div>

            {/* Password */}
            <div>
              <label style={{
                display: 'block',
                fontFamily: 'var(--wa-font-hud)',
                fontSize: 11,
                color: 'var(--wa-accent-amber)',
                letterSpacing: 2,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}>
                Пароль
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: '10px 36px 10px 14px',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(146,64,14,0.25)',
                    borderRadius: 4,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 14,
                    outline: 'none',
                    transition: 'border-color 200ms ease',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(217,119,6,0.5)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(146,64,14,0.25)'; }}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                    fontSize: 16, lineHeight: 1, opacity: showPassword ? 0.8 : 0.4,
                    transition: 'opacity 200ms',
                    color: 'var(--text-secondary)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = showPassword ? '0.8' : '0.4'; }}
                >
                  👁
                </button>
              </div>
            </div>

            {/* Confirm password (register only) */}
            {!isLogin && (
              <div>
                <label style={{
                  display: 'block',
                  fontFamily: 'var(--wa-font-hud)',
                  fontSize: 11,
                  color: 'var(--wa-accent-amber)',
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}>
                  Подтверждение пароля
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{
                      width: '100%',
                      padding: '10px 36px 10px 14px',
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(146,64,14,0.25)',
                      borderRadius: 4,
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 14,
                      outline: 'none',
                      transition: 'border-color 200ms ease',
                    }}
                    onFocus={(e) => { e.target.style.borderColor = 'rgba(217,119,6,0.5)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(146,64,14,0.25)'; }}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowConfirm(!showConfirm)}
                    style={{
                      position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                      fontSize: 16, lineHeight: 1, opacity: showConfirm ? 0.8 : 0.4,
                      transition: 'opacity 200ms',
                      color: 'var(--text-secondary)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = showConfirm ? '0.8' : '0.4'; }}
                  >
                    👁
                  </button>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  padding: '8px 12px',
                  background: 'rgba(248,113,113,0.08)',
                  border: '1px solid rgba(248,113,113,0.2)',
                  borderRadius: 4,
                  color: '#f87171',
                  fontSize: 12,
                  fontFamily: 'var(--wa-font-terminal)',
                  textAlign: 'center',
                }}
              >
                {error}
              </motion.div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              style={{
                width: '100%',
                padding: '12px',
                background: loading
                  ? 'rgba(200,200,200,0.05)'
                  : 'rgba(200,200,200,0.06)',
                border: '1px solid rgba(200,200,200,0.12)',
                borderRadius: 4,
                color: loading ? 'var(--text-muted)' : 'var(--text-secondary)',
                fontFamily: 'var(--wa-font-hud)',
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: 3,
                textTransform: 'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 200ms ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = 'rgba(217,119,6,0.15)';
                  e.currentTarget.style.borderColor = 'rgba(217,119,6,0.3)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(200,200,200,0.06)';
                e.currentTarget.style.borderColor = 'rgba(200,200,200,0.12)';
              }}
            >
              {loading ? (
                <>
                  <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
                  Обработка...
                </>
              ) : (
                isLogin ? 'ВОЙТИ' : 'ЗАРЕГИСТРИРОВАТЬСЯ'
              )}
            </button>
          </form>

          {/* Divider */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0',
          }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(146,64,14,0.2)' }} />
            <span style={{
              fontFamily: 'var(--wa-font-terminal)',
              fontSize: 10, color: 'var(--text-muted)',
              letterSpacing: 2, textTransform: 'uppercase',
            }}>
              или
            </span>
            <div style={{ flex: 1, height: 1, background: 'rgba(146,64,14,0.2)' }} />
          </div>

          {/* Switch mode */}
          <button
            onClick={switchMode}
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px',
              background: 'transparent',
              border: '1px solid rgba(200,200,200,0.08)',
              borderRadius: 4,
              color: loading ? 'var(--text-muted)' : 'var(--text-secondary)',
              fontFamily: 'var(--wa-font-hud)',
              fontSize: 12,
              letterSpacing: 1,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 200ms ease',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.borderColor = 'rgba(217,119,6,0.2)';
                e.currentTarget.style.color = 'var(--wa-accent-amber)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(200,200,200,0.08)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            {isLogin ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
          </button>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center', marginTop: 20,
          fontFamily: 'var(--wa-font-terminal)',
          fontSize: 10, color: 'var(--text-muted)',
          opacity: 0.4, letterSpacing: 1,
        }}>
          Wasteland Remastered — Post-Apocalyptic RPG
        </div>
      </motion.div>

      {/* Spin animation + input placeholder color */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        input::placeholder {
          color: rgba(148, 163, 184, 0.3);
        }
      `}</style>
    </div>
    </>
  );
};
