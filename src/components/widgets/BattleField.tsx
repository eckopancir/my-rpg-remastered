import { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getEnemyImage, images } from '../../assets/index';

interface BattleFieldProps {
  playerName: string;
  playerHp: number;
  playerMaxHp: number;
  playerDamage: number;
  playerArmor: number;

  enemyName: string;
  enemyHp: number;
  enemyMaxHp: number;
  enemyDamage: number;
  enemyArmor: number;
  enemyFaction: string;

  turnCount: number;
  lastEnemyDmg: number;
  lastPlayerDmg: number;
  onAttack: () => void;
}

interface FloatingNumber {
  id: number;
  value: number;
  x: number;
  y: number;
  side: 'player' | 'enemy';
  type: 'damage' | 'heal' | 'miss';
}

const FACTION_SPRITES: Record<string, { color: string; shape: string; eyeColor: string }> = {
  Мутанты: { color: '#22c55e', shape: 'circle', eyeColor: '#facc15' },
  Рейдеры: { color: '#ef4444', shape: 'diamond', eyeColor: '#fff' },
  Роботы: { color: '#60a5fa', shape: 'hexagon', eyeColor: '#a78bfa' },
  Бандиты: { color: '#f97316', shape: 'triangle', eyeColor: '#fef08a' },
  Твари: { color: '#a855f7', shape: 'octagon', eyeColor: '#f472b6' },
};

const getFactionStyle = (faction: string) =>
  FACTION_SPRITES[faction] || { color: '#94a3b8', shape: 'circle', eyeColor: '#fff' };

export const BattleField = ({
  playerName, playerHp, playerMaxHp, playerDamage, playerArmor,
  enemyName, enemyHp, enemyMaxHp, enemyDamage, enemyArmor, enemyFaction, turnCount,
  lastPlayerDmg, lastEnemyDmg, onAttack,
}: BattleFieldProps) => {
  const [shake, setShake] = useState(false);
  const [attackAnim, setAttackAnim] = useState<'none' | 'player-attacks' | 'enemy-attacks'>('none');
  const [floatingNumbers, setFloatingNumbers] = useState<FloatingNumber[]>([]);
  const [lastLogLen, setLastLogLen] = useState(0);
  const idCounter = useRef(0);

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 300);
  }, []);

  const addFloatingNumber = useCallback((value: number, side: 'player' | 'enemy', type: 'damage' | 'heal' | 'miss') => {
    const id = idCounter.current++;
    const x = side === 'enemy' ? 65 + Math.random() * 20 : 15 + Math.random() * 20;
    const y = 20 + Math.random() * 20;
    setFloatingNumbers((prev) => [...prev, { id, value, x, y, side, type }]);
    setTimeout(() => {
      setFloatingNumbers((prev) => prev.filter((n) => n.id !== id));
    }, 1200);
  }, []);

  // Detect turns and trigger animations
  useEffect(() => {
    if (turnCount === 0) return;
    if (lastEnemyDmg !== 0) {
      setAttackAnim('enemy-attacks');
      triggerShake();
      if (lastEnemyDmg > 0) addFloatingNumber(lastEnemyDmg, 'player', 'damage');
      setTimeout(() => setAttackAnim('none'), 400);
    } else if (lastPlayerDmg !== 0) {
      setAttackAnim('player-attacks');
      if (lastPlayerDmg > 0) addFloatingNumber(lastPlayerDmg, 'enemy', 'damage');
      setTimeout(() => setAttackAnim('none'), 400);
    }
  }, [turnCount]);

  const factionStyle = getFactionStyle(enemyFaction);
  const hpPct = enemyMaxHp > 0 ? (enemyHp / enemyMaxHp) * 100 : 0;
  const playerHpPct = playerMaxHp > 0 ? (playerHp / playerMaxHp) * 100 : 0;

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-md)' }}>
      {/* == Arena Background == */}
      <div style={{
        position: 'relative', width: '100%', height: 320,
        background: 'radial-gradient(ellipse at 50% 60%, rgba(30,41,59,0.9) 0%, rgba(15,23,42,0.98) 100%)',
        border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        transform: shake ? 'translateX(-4px)' : 'translateX(0)',
        transition: 'transform 80ms ease',
      }}>
        {/* Grid lines */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.12, pointerEvents: 'none' }}>
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(129,140,248,0.3)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
        {/* Center glow */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 200, height: 200, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(129,140,248,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* == ENEMY (right side) == */}
        <div style={{ position: 'absolute', right: '15%', top: '50%', transform: 'translateY(-50%)', textAlign: 'center' }}>
          <motion.div
            animate={attackAnim === 'enemy-attacks' ? { x: [-20, 0], rotate: [0, -3, 3, 0] } : {}}
            transition={{ duration: 0.3 }}
            style={{ position: 'relative' }}
          >
            <div style={{
              width: 80, height: 80, margin: '0 auto', position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <img
                src={getEnemyImage(enemyFaction, enemyName)}
                alt={enemyName}
                style={{ width: 72, height: 72, objectFit: 'contain', imageRendering: 'pixelated', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: `2px solid ${factionStyle.color}`, boxShadow: `0 0 20px ${factionStyle.color}33` }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div style={{ position: 'absolute', bottom: -18, left: '50%', transform: 'translateX(-50%)', width: 80 }}>
                <div style={{ background: 'rgba(0,0,0,0.5)', borderRadius: 4, height: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <motion.div
                    animate={{ width: `${Math.max(0, hpPct)}%` }}
                    transition={{ duration: 0.3 }}
                    style={{
                      height: '100%',
                      background: `linear-gradient(90deg, ${hpPct > 50 ? '#22c55e' : hpPct > 25 ? '#facc15' : '#ef4444'}, ${factionStyle.color})`,
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: factionStyle.color, marginTop: 20 }}>{enemyName}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              DMG {enemyDamage.toFixed(0)} | ARM {enemyArmor.toFixed(1)}
            </div>
          </motion.div>
        </div>

        {/* == PLAYER (left side) == */}
        <div style={{ position: 'absolute', left: '15%', top: '50%', transform: 'translateY(-50%)', textAlign: 'center' }}>
          <motion.div
            animate={attackAnim === 'player-attacks' ? { x: [20, 0], rotate: [0, 3, -3, 0] } : {}}
            transition={{ duration: 0.3 }}
          >
            <div style={{
              width: 72, height: 80, margin: '0 auto', position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <img
                src={images.hero}
                alt="Hero"
                style={{ width: 64, height: 72, objectFit: 'contain', imageRendering: 'pixelated', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '2px solid rgba(129,140,248,0.6)', boxShadow: '0 0 20px rgba(129,140,248,0.2)' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div style={{ position: 'absolute', bottom: -18, left: '50%', transform: 'translateX(-50%)', width: 80 }}>
                <div style={{ background: 'rgba(0,0,0,0.5)', borderRadius: 4, height: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <motion.div
                    animate={{ width: `${Math.max(0, playerHpPct)}%` }}
                    transition={{ duration: 0.3 }}
                    style={{
                      height: '100%',
                      background: `linear-gradient(90deg, ${playerHpPct > 50 ? '#22c55e' : playerHpPct > 25 ? '#facc15' : '#ef4444'}, #818cf8)`,
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#818cf8', marginTop: 20 }}>{playerName}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              DMG {playerDamage.toFixed(0)} | ARM {playerArmor.toFixed(1)}
            </div>
          </motion.div>
        </div>

        {/* == Attack projectile == */}
        <AnimatePresence>
          {(attackAnim === 'player-attacks' || attackAnim === 'enemy-attacks') && (
            <motion.div
              key={`proj-${turnCount}`}
              initial={{
                x: attackAnim === 'player-attacks' ? '25%' : '75%',
                y: '40%',
                scale: 1, opacity: 1,
              }}
              animate={{
                x: attackAnim === 'player-attacks' ? '70%' : '30%',
                y: '40%',
                scale: [1, 1.5, 0.3],
                opacity: [1, 1, 0],
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: 'easeIn' }}
              style={{
                position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                width: 16, height: 16,
                borderRadius: '50%',
                background: attackAnim === 'player-attacks'
                  ? 'radial-gradient(circle, #a78bfa, #818cf8)'
                  : `radial-gradient(circle, ${factionStyle.color}, ${factionStyle.color}88)`,
                boxShadow: attackAnim === 'player-attacks'
                  ? '0 0 20px #818cf8, 0 0 40px #818cf888'
                  : `0 0 20px ${factionStyle.color}, 0 0 40px ${factionStyle.color}66`,
                zIndex: 10,
                pointerEvents: 'none',
              }}
            />
          )}
        </AnimatePresence>

        {/* == Floating damage numbers == */}
        {floatingNumbers.map((fn) => (
          <motion.div
            key={fn.id}
            initial={{ opacity: 1, y: 0, x: `${fn.x}%` }}
            animate={{ opacity: 0, y: -40 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            style={{
              position: 'absolute', top: `${fn.y}%`, left: 0,
              fontSize: fn.type === 'miss' ? 14 : 22,
              fontWeight: 800, fontFamily: 'var(--font-mono)',
              color: fn.type === 'heal' ? '#22c55e' : fn.type === 'miss' ? '#94a3b8' : '#ef4444',
              textShadow: '0 0 12px rgba(0,0,0,0.8), 0 0 4px rgba(239,68,68,0.5)',
              pointerEvents: 'none', zIndex: 20,
              whiteSpace: 'nowrap',
            }}
          >
            {fn.type === 'miss' ? 'MISS' : fn.type === 'heal' ? `+${fn.value}` : `-${fn.value}`}
          </motion.div>
        ))}

        {/* == VS text == */}
        <div style={{
          position: 'absolute', top: '46%', left: '50%', transform: 'translate(-50%,-50%)',
          fontSize: 14, fontWeight: 900, color: 'rgba(255,255,255,0.1)',
          letterSpacing: 4, fontFamily: 'var(--font-mono)',
          pointerEvents: 'none',
        }}>
          VS
        </div>

        {/* Turn counter */}
        <div style={{
          position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
          fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
          letterSpacing: 1, pointerEvents: 'none',
        }}>
          ХОД {turnCount}
        </div>
      </div>
    </div>
  );
};
