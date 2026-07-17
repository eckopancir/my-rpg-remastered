import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { WapPanel } from '../components/ui/WapPanel';
import { Button } from '../components/ui/Button';
import { ProgressBar } from '../components/ui/ProgressBar';
import { BattleGrid } from '../components/widgets/BattleGrid';
import { usePlayerStore } from '../stores/playerStore';
import { useUiStore } from '../stores/uiStore';
import { useCombatGridStore } from '../stores/combatGridStore';
import { useSound, playCombatSound, stopCombatSound } from '../hooks/useSound';
import { getEnemyImage, images } from '../assets/index';

const LogPanel = () => {
  const battleLogs = useCombatGridStore((s) => s.battleLogs);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [battleLogs.length]);
  return (
    <div style={{ fontSize: 11, marginTop: 8 }}>
      <div style={{ fontSize: 10, opacity: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>📋 Лог боя</div>
      <div ref={ref} style={{
        maxHeight: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2,
        padding: '4px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)',
      }}>
        {battleLogs.length === 0 && <span style={{ opacity: 0.3 }}>—</span>}
        {battleLogs.map((msg, i) => (
          <span key={i} style={{ color: msg.startsWith('💀') ? '#ff6b6b' : msg.startsWith('📦') ? '#ffd93d' : msg.startsWith('⚠️') ? '#ffa94d' : msg.startsWith('🕊️') ? '#69db7c' : 'rgba(255,255,255,0.7)' }}>
            {msg}
          </span>
        ))}
      </div>
    </div>
  );
};

const ENEMY_COLORS: Record<string, string> = {
  Мутанты: '#7c3aed',
  Роботы: '#2563eb',
  Бандиты: '#dc2626',
  Военные: '#16a34a',
};

export const Battle = () => {
  const navigate = useNavigate();
  const combat = usePlayerStore((s) => s.combat);
  const stats = usePlayerStore((s) => s.stats);
  const activeEffects = usePlayerStore((s) => s.activeEffects);
  const travel = usePlayerStore((s) => s.travel);
  const cancelTravel = usePlayerStore((s) => s.cancelTravel);
  const isResting = useUiStore((s) => s.isResting);
  const powerBreakdown = usePlayerStore((s) => s.powerBreakdown);
  const { playClick, playSound } = useSound();

  const isActive = useCombatGridStore((s) => s.isActive);
  const ap = useCombatGridStore((s) => s.ap);
  const maxAp = useCombatGridStore((s) => s.maxAp);
  const ammo = useCombatGridStore((s) => s.ammo);
  const maxAmmo = useCombatGridStore((s) => s.maxAmmo);
  const turn = useCombatGridStore((s) => s.turn);
  const turnCount = useCombatGridStore((s) => s.turnCount);
  const message = useCombatGridStore((s) => s.message);
  const selectedEnemy = useCombatGridStore((s) => s.selectedEnemy);
  const enemies = useCombatGridStore((s) => s.enemies);
  const isDefensiveMode = useCombatGridStore((s) => s.isDefensiveMode);
  const isMoving = useCombatGridStore((s) => s.isMoving);
  const isSelected = useCombatGridStore((s) => s.isSelected);
  const cursorPos = useCombatGridStore((s) => s.cursorPos);
  const isVictory = useCombatGridStore((s) => s.isVictory);
  const isDefeat = useCombatGridStore((s) => s.isDefeat);

  const handleKeyboardMove = useCombatGridStore((s) => s.handleKeyboardMove);
  const selectMe = useCombatGridStore((s) => s.selectMe);
  const reload = useCombatGridStore((s) => s.reload);
  const toggleDefense = useCombatGridStore((s) => s.toggleDefense);
  const endTurn = useCombatGridStore((s) => s.endTurn);
  const attackEnemy = useCombatGridStore((s) => s.attackEnemy);
  const playerAbilities = useCombatGridStore((s) => s.playerAbilities);
  const abilityCooldowns = useCombatGridStore((s) => s.abilityCooldowns);
  const selectedAbility = useCombatGridStore((s) => s.selectedAbility);
  const selectAbility = useCombatGridStore((s) => s.selectAbility);
  const useAbility = useCombatGridStore((s) => s.useAbility);

  // Hovered enemy for Intel panel
  const [hoveredEnemy, setHoveredEnemy] = useState<typeof enemies[0] | null>(null);
  const [showPowerBreakdown, setShowPowerBreakdown] = useState(false);
  const [powerTooltipPos, setPowerTooltipPos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (!cursorPos) { setHoveredEnemy(null); return; }
    const e = enemies.find((en) => !en.dead && en.pos.x === cursorPos.x && en.pos.y === cursorPos.y);
    setHoveredEnemy(e || null);
  }, [cursorPos, enemies]);

  const handleEnemyAttack = useCallback(() => {
    if (selectedAbility !== null) {
      useAbility(selectedEnemy as number | string | undefined);
    } else if (selectedEnemy !== null) {
      attackEnemy(selectedEnemy as number | string);
    }
  }, [selectedAbility, selectedEnemy, attackEnemy, useAbility]);

  // Hold-to-walk WASD + keyboard shortcuts
  const heldDir = useRef<{ dx: number; dy: number } | null>(null);
  const moveInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (turn !== 'player' || isVictory || isDefeat) return;
      if (isMoving) return;

      let dx = 0, dy = 0;
      switch (e.code) {
        case 'KeyW': case 'ArrowUp':    e.preventDefault(); dx = 0; dy = -1; break;
        case 'KeyS': case 'ArrowDown':  e.preventDefault(); dx = 0; dy = 1; break;
        case 'KeyA': case 'ArrowLeft':  e.preventDefault(); dx = -1; dy = 0; break;
        case 'KeyD': case 'ArrowRight': e.preventDefault(); dx = 1; dy = 0; break;
        case 'Space': e.preventDefault(); endTurn(); break;
        case 'KeyR': reload(); playSound('reload'); break;
        case 'KeyF': toggleDefense(); break;
        case 'Enter': e.preventDefault(); selectMe(); break;
        case 'Digit1': selectAbility(0); break;
        case 'Digit2': selectAbility(1); break;
        case 'Digit3': selectAbility(2); break;
        case 'Digit4': selectAbility(3); break;
      }

      if (dx !== 0 || dy !== 0) {
        heldDir.current = { dx, dy };
        handleKeyboardMove(dx, dy);
        if (!moveInterval.current) {
          moveInterval.current = setInterval(() => {
            const s = useCombatGridStore.getState();
            if (s.turn !== 'player' || s.ap <= 0 || s.isMoving || s.isVictory || s.isDefeat) {
              if (moveInterval.current) { clearInterval(moveInterval.current); moveInterval.current = null; }
              stopCombatSound('run');
              return;
            }
            if (heldDir.current) {
              handleKeyboardMove(heldDir.current.dx, heldDir.current.dy);
            }
          }, 220);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp':
        case 'KeyS': case 'ArrowDown':
        case 'KeyA': case 'ArrowLeft':
        case 'KeyD': case 'ArrowRight':
          heldDir.current = null;
          if (moveInterval.current) {
            clearInterval(moveInterval.current);
            moveInterval.current = null;
          }
          stopCombatSound('run');
          break;
      }
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      if (moveInterval.current) { clearInterval(moveInterval.current); moveInterval.current = null; }
    };
  }, [turn, isVictory, isMoving, handleKeyboardMove, selectMe, reload, toggleDefense, endTurn, playSound, selectAbility]);

  const selectedEnemyData = enemies.find((e) => selectedEnemy !== null && e.id === selectedEnemy);
  const hoverTarget = hoveredEnemy || selectedEnemyData;
  const aliveEnemies = enemies.filter((e) => !e.dead);

  if (!combat.isFighting && !travel.isTraveling && !isResting) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
        <WapPanel variant="metal" padding="lg" glow="amber" style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Боевая арена</div>
          <div style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
            Отправляйся в экспедицию через карту, чтобы начать бой.
          </div>
          <Button variant="primary" onClick={() => { playClick(); navigate('/map'); }}>🗺️ Карта</Button>
        </WapPanel>
      </motion.div>
    );
  }

  if (travel.isTraveling) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <WapPanel variant="metal" padding="lg" glow="amber" style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>🚀 В пути...</div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Направляемся к {travel.destination}
          </div>
          <ProgressBar value={travel.total - travel.remaining} max={travel.total} variant="accent" label={`${travel.remaining} сек. осталось`} />
          <div style={{ marginTop: 16 }}>
            <Button variant="danger" size="sm" onClick={() => { playClick(); cancelTravel(); }}>❌ Прервать путь</Button>
          </div>
        </WapPanel>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'flex', gap: 0, alignItems: 'flex-start' }}>
      {/* Left PDA Control Panel */}
      {isActive && (
        <div style={{
          width: 260, flexShrink: 0,
          background: 'rgba(10,10,12,0.95)', border: '1px solid rgba(255,255,255,0.1)',
          fontFamily: "'Courier New', monospace", color: '#ccc',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ fontSize: 13, fontWeight: 'bold', letterSpacing: 1, textTransform: 'uppercase' }}>
              {turn === 'player' ? '⭐ ТВОЙ ХОД' : '⏳ ХОД ВРАГА'}
            </div>
            <div style={{ fontSize: 12, opacity: 0.5 }}>РАУНД #{turnCount}</div>
          </div>

          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* AP + Ammo */}
            <div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>AP</div>
              <div style={{ display: 'flex', gap: 2, height: 10, marginBottom: 6 }}>
                {Array.from({ length: maxAp }).map((_, i) => (
                  <div key={i} style={{
                    flex: 1, background: i < ap ? '#fff' : 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    transition: 'all 0.3s ease',
                  }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16 }}>
                <span>⚡ {ap}/{maxAp}</span>
                <span>🔫 {ammo}/{maxAmmo}</span>
                {isDefensiveMode && <span style={{ color: '#8cf' }}>🛡️</span>}
              </div>
            </div>

            {/* Message */}
            {message && (
              <div style={{ fontSize: 13, textAlign: 'center', padding: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}>
                <span style={{ animation: message ? 'pulseText 2s infinite' : 'none' }}>{message}</span>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div
                onClick={() => { playClick(); selectMe(); }}
                style={{
                  padding: '9px', border: `1px solid ${isSelected ? '#fff' : 'rgba(255,255,255,0.15)'}`,
                  background: isSelected ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.03)',
                  color: isSelected ? '#fff' : '#aaa',
                  cursor: turn !== 'player' ? 'not-allowed' : 'pointer',
                  fontSize: 14, textAlign: 'center', textTransform: 'uppercase',
                  opacity: turn !== 'player' ? 0.4 : 1,
                }}
              >
                🎯 ВЫБОР [SPACE] {isSelected ? '(ВКЛ)' : '(ВЫКЛ)'}
              </div>

              <div
                onClick={() => { playClick(); playSound('reload'); reload(); }}
                style={{
                  padding: '9px', border: `1px solid ${turn !== 'player' || ap < 3 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.15)'}`,
                  background: 'rgba(255,255,255,0.03)',
                  color: turn !== 'player' || ap < 3 ? 'rgba(255,255,255,0.2)' : '#aaa',
                  cursor: turn !== 'player' || ap < 3 ? 'not-allowed' : 'pointer',
                  fontSize: 14, textAlign: 'center', textTransform: 'uppercase',
                  opacity: turn !== 'player' || ap < 3 ? 0.4 : 1,
                }}
              >
                🔁 ПЕРЕЗАРЯДКА (3 AP) [R]
              </div>

              <div
                onClick={() => { playClick(); toggleDefense(); }}
                style={{
                  padding: '9px', border: `1px solid ${isDefensiveMode ? '#fff' : 'rgba(255,255,255,0.15)'}`,
                  background: isDefensiveMode ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.03)',
                  color: isDefensiveMode ? '#fff' : '#aaa',
                  cursor: turn !== 'player' || ap < 2 ? 'not-allowed' : 'pointer',
                  fontSize: 14, textAlign: 'center', textTransform: 'uppercase',
                  opacity: turn !== 'player' || ap < 2 ? 0.4 : 1,
                }}
              >
                🛡️ ЗАЩИТА (2 AP) [F] {isDefensiveMode ? '(ВКЛ)' : ''}
              </div>

              <div
                onClick={() => { playClick(); handleEnemyAttack(); }}
                style={{
                  padding: '9px', border: '1px solid rgba(255,255,255,0.15)',
                  background: selectedAbility !== null ? 'rgba(255,255,50,0.08)' : 'rgba(255,255,255,0.03)',
                  color: turn !== 'player' || (selectedAbility === null && (ap < 1 || selectedEnemy === null)) ? 'rgba(255,255,255,0.2)' : '#ccc',
                  cursor: turn !== 'player' || (selectedAbility === null && (ap < 1 || selectedEnemy === null)) ? 'not-allowed' : 'pointer',
                  fontSize: 14, textAlign: 'center', textTransform: 'uppercase',
                  opacity: turn !== 'player' || (selectedAbility === null && (ap < 1 || selectedEnemy === null)) ? 0.4 : 1,
                  animation: turn === 'player' && ((selectedAbility !== null) || (ap >= 1 && selectedEnemy !== null)) ? 'pulseBorder 2s infinite' : 'none',
                }}
              >
                {selectedAbility !== null ? '✨ ПРИМЕНИТЬ [КЛИК]' : '🔫 АТАКА (1 AP) [КЛИК]'}
              </div>

              <div
                onClick={() => { playClick(); endTurn(); }}
                style={{
                  padding: '12px', border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#ccc', fontWeight: 'bold',
                  cursor: turn !== 'player' ? 'not-allowed' : 'pointer',
                  fontSize: 16, textAlign: 'center', textTransform: 'uppercase',
                  letterSpacing: 1, opacity: turn !== 'player' ? 0.4 : 1,
                  marginTop: 6,
                }}
              >
                ⏭ КОНЕЦ ХОДА [SPACE]
              </div>
            </div>

            {/* Ability panel */}
            {playerAbilities.some((a) => a !== null) && (
              <div>
                <div style={{ fontSize: 10, opacity: 0.4, textTransform: 'uppercase', marginBottom: 6, letterSpacing: 1 }}>💎 Способности</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {playerAbilities.map((ab, i) => {
                    if (!ab) return <div key={i} style={{ width: 64, height: 72, border: '1px solid rgba(255,255,255,0.05)', borderRadius: 4 }} />;
                    const cd = abilityCooldowns[i];
                    const isReady = cd <= 0 && ap >= ab.apCost;
                    const isSelected = selectedAbility === i;
                    const canAfford = ap >= ab.apCost;
                    const statusText = cd > 0 ? `КД: ${cd}` : !canAfford ? `нужно ${ab.apCost}AP` : 'ГОТОВО';
                    const statusColor = cd > 0 ? '#ff6b6b' : !canAfford ? 'rgba(255,255,255,0.3)' : '#69db7c';
                    return (
                      <div key={i}
                        onClick={() => { playClick(); selectAbility(i); }}
                        title={`[${i + 1}] ${ab.name} — ${ab.description}\n${ab.apCost} AP | КД: ${ab.cooldown} хода\n⭐ Сила: ${ab.powerRating}`}
                        style={{
                          width: 64, height: 72, display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'space-between',
                          padding: '4px 2px',
                          border: `1px solid ${isSelected ? '#fbbf24' : isReady ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'}`,
                          background: isSelected ? 'rgba(251,191,36,0.12)' : isReady ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.015)',
                          cursor: turn !== 'player' || !isReady ? 'not-allowed' : 'pointer',
                          opacity: turn !== 'player' || !isReady ? 0.35 : 1,
                          borderRadius: 4, position: 'relative',
                        }}
                      >
                        <span style={{ fontSize: 20, lineHeight: 1 }}>{ab.icon}</span>
                        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 1.1, maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ab.name}
                        </div>
                        <div style={{ fontSize: 8, color: statusColor, fontWeight: cd > 0 ? 'bold' : 400, lineHeight: 1 }}>
                          {statusText}
                        </div>
                        <div style={{
                          position: 'absolute', bottom: 1, right: 3,
                          fontSize: 8, color: 'rgba(255,255,255,0.2)',
                        }}>
                          {i + 1}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Key hint badges */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center', marginBottom: 6 }}>
              {[
                { key: 'WASD', label: 'Движение' },
                { key: 'SPACE', label: 'Конец хода' },
                { key: 'R', label: 'Перезарядка' },
                { key: 'F', label: 'Защита' },
                { key: 'ENTER', label: 'Выбор' },
                { key: 'RMB', label: 'Поворот' },
              ].map((h) => (
                <span key={h.key} style={{
                  padding: '2px 5px', fontSize: 9, border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.05)', fontFamily: "'Courier New', monospace",
                  textTransform: 'uppercase', letterSpacing: 0.5,
                }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>{h.key}</span>
                  <span style={{ opacity: 0.4, marginLeft: 3 }}>{h.label}</span>
                </span>
              ))}
            </div>

            {/* Battle Logs */}
            <LogPanel />

            {/* Enemies count */}
            <div style={{ fontSize: 12, opacity: 0.5, marginTop: 'auto' }}>
              👾 Противников: {aliveEnemies.length}
            </div>
          </div>
        </div>
      )}

      {/* Center - Battle Grid */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <BattleGrid />
        {/* CRT scanline overlay */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1000,
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)',
        }} />
      </div>

      {/* Right Enemy Intel Panel */}
      {isActive && (
        <div style={{
          width: 273, flexShrink: 0,
          background: 'rgba(10,10,12,0.95)', border: '1px solid rgba(255,255,255,0.1)',
          fontFamily: "'Courier New', monospace", color: '#ccc',
        }}>
          {hoverTarget ? (
            <div style={{ position: 'relative', overflow: 'hidden' }}>
              {/* Intel scanline */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                background: 'linear-gradient(90deg, transparent, rgba(0,255,0,0.3), transparent)',
                zIndex: 5, pointerEvents: 'none',
                animation: 'scanlineMove 2s ease-in-out infinite',
              }} />
              {/* Header */}
              <div style={{ padding: '8px 13px', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: 13, textTransform: 'uppercase', background: 'rgba(255,255,255,0.03)' }}>
                🎯 СКАНИРОВАНИЕ: {hoverTarget.name}
              </div>
              {/* Avatar */}
              <div style={{ textAlign: 'center', padding: '13px' }}>
                <img src={getEnemyImage(hoverTarget.faction, hoverTarget.name)} alt={hoverTarget.name}
                  style={{ width: 64, height: 64, objectFit: 'contain' }} />
              </div>
              {/* HP */}
              <div style={{ padding: '0 13px 10px' }}>
                <div style={{ fontSize: 13, marginBottom: 3 }}>❤️ HP</div>
                <ProgressBar value={Math.max(0, Math.round(hoverTarget.currentHp))} max={hoverTarget.maxHp}
                  variant={hoverTarget.currentHp / hoverTarget.maxHp < 0.3 ? 'danger' : 'hp'} />
                <div style={{ fontSize: 13, marginTop: 3 }}>{Math.max(0, Math.round(hoverTarget.currentHp))} / {hoverTarget.maxHp}</div>
              </div>
              {/* Stats */}
              <div style={{ padding: '0 13px 13px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 10px', fontSize: 13 }}>
                <span>⚔️ DPS: {Math.round(hoverTarget.damage)}</span>
                <span>🛡️ Броня: {Math.round(hoverTarget.armor)}</span>
                <span>🎯 Метк: {Math.round((hoverTarget.accuracy || 0) * 100)}%</span>
                <span>💥 Крит: {Math.round((hoverTarget.crit || 0) * 100)}%</span>
                <span>🌀 Уворот: {Math.round((hoverTarget.evasion || 0) * 100)}%</span>
                <span>🛡️ Блок: {Math.round((hoverTarget.block || 0) * 100)}%</span>
                <span>👊 Пробив: {Math.round((hoverTarget.punching || 0) * 100)}%</span>
                <span>🩸 Вампир: {Math.round((hoverTarget.vampir || 0) * 100)}%</span>
                <span>📏 Дальн: {hoverTarget.rangeDistance || 7}</span>
                <span>💨 AP: {hoverTarget.runAp || 5}</span>
              </div>
              {/* Power */}
              <div style={{ padding: '0 13px 8px', display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: '#fbbf24', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, marginTop: 4 }}>
                <span>🟡 МОЩНОСТЬ</span>
                <span>{(
                  Math.round(hoverTarget.damage) * 3 +
                  Math.round(hoverTarget.maxHp / 10) +
                  Math.round(hoverTarget.armor) * 2 +
                  Math.round((hoverTarget.evasion || 0) * 100) * 5 +
                  Math.round((hoverTarget.block || 0) * 100) * 3 +
                  Math.round((hoverTarget.crit || 0) * 100) * 2 +
                  Math.round((hoverTarget.punching || 0) * 100) * 2
                ).toLocaleString()}</span>
              </div>
              {/* Faction */}
              <div style={{ padding: '0 13px 13px', fontSize: 13, color: ENEMY_COLORS[hoverTarget.faction] || '#fff' }}>
                {hoverTarget.faction}
              </div>
              {/* Skills */}
              {hoverTarget.skillUse && hoverTarget.skillUse.length > 0 && (
                <div style={{ padding: '0 13px 13px' }}>
                  <div style={{ fontSize: 12, textTransform: 'uppercase', marginBottom: 6, opacity: 0.5 }}>🧠 Способности</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {hoverTarget.skillUse.map((sk: string, i: number) => {
                      const cd = hoverTarget.cooldowns?.[sk] || 0;
                      const SKILL_ICONS: Record<string, string> = {
                        rage: '💢', aimShot: '🎯', invisibility: '👤', ram: '🏃',
                        madness: '🌀', grenade: '💣', redZone: '🚨', suppression: '🔥',
                        stimulant: '💉', summoner: '👥',
                      };
                      return (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px',
                          fontSize: 12, borderLeft: `3px solid ${cd > 0 ? '#ff4d4d' : 'rgba(255,255,255,0.2)'}`,
                          background: cd > 0 ? 'rgba(255,77,77,0.05)' : 'transparent',
                        }}>
                          <span>{SKILL_ICONS[sk] || '❓'}</span>
                          <span style={{ flex: 1 }}>{sk}</span>
                          {cd > 0 && <span style={{ color: '#ff4d4d', fontSize: 10 }}>⏳{cd}</span>}
                          {cd === 0 && <span style={{ color: '#4ade80', fontSize: 10 }}>ГОТОВ</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: 26, textAlign: 'center', fontSize: 13, opacity: 0.4, position: 'relative', overflow: 'hidden' }}>
              {/* Scanner line */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                pointerEvents: 'none', zIndex: 5,
                animation: 'scanlineMove 3s ease-in-out infinite',
              }} />
              ОЖИДАНИЕ ДАННЫХ...
            </div>
          )}

          {/* Player Status */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 'auto' }}>
            <div style={{ padding: '8px 13px', fontSize: 13, textTransform: 'uppercase', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.1)', position: 'relative', overflow: 'hidden' }}>
              {/* Scanner line */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: '1px',
                background: 'linear-gradient(90deg, transparent, rgba(0,255,100,0.4), transparent)',
                pointerEvents: 'none', zIndex: 5,
                animation: 'scanlineMove 2.5s ease-in-out infinite',
              }} />
              👤 СТАТУС: ОПЕРАТОР
            </div>
            <div style={{ padding: 13 }}>
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <img src={images.hero} alt="hero" style={{ width: 64, height: 64, objectFit: 'contain' }} />
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 13, marginBottom: 3 }}>❤️ HP</div>
                <ProgressBar value={Math.round(stats.currentHp)} max={stats.maxHp}
                  variant={stats.currentHp / stats.maxHp < 0.3 ? 'danger' : 'hp'} />
                <div style={{ fontSize: 13, marginTop: 3 }}>{Math.round(stats.currentHp)} / {stats.maxHp}</div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 13, marginBottom: 3 }}>⚡ Стамина</div>
                <ProgressBar value={Math.round(stats.stamina || 0)} max={stats.maxStamina || 100}
                  variant={(stats.stamina || 0) / (stats.maxStamina || 100) < 0.1 ? 'danger' : 'stamina'} />
                <div style={{ fontSize: 13, marginTop: 3 }}>{Math.round(stats.stamina || 0)} / {stats.maxStamina || 100}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 10px', fontSize: 13 }}>
                <span>⚡ AP: {ap}/{maxAp}</span>
                <span>🔫 {ammo}/{maxAmmo}</span>
                <span>⚔️ {Math.round(stats.damage)}</span>
                <span>🛡️ {Math.round(stats.armor)}</span>
                <span>🎯 {Math.round((stats.accuracy || 0) * 100)}%</span>
                <span>💥 {Math.round((stats.crit || 0) * 100)}%</span>
                <span>🌀 {Math.round((stats.evasion || 0) * 100)}%</span>
                <span>🛡️ {Math.round((stats.block || 0) * 100)}%</span>
                <span>👊 {Math.round((stats.punching || 0) * 100)}%</span>
                <span>🩸 {Math.round((stats.vampir || 0) * 100)}%</span>
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: '#fbbf24', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 4, textAlign: 'center' }}>
                🟡 МОЩНОСТЬ:{' '}
                <span
                  style={{ fontWeight: 700, cursor: 'help', borderBottom: '1px dashed rgba(251,191,36,0.3)' }}
                  onMouseEnter={(e) => { setShowPowerBreakdown(true); setPowerTooltipPos({ x: e.clientX, y: e.clientY }); }}
                  onMouseMove={(e) => setPowerTooltipPos({ x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setShowPowerBreakdown(false)}
                >
                  {Math.round(stats.power || 0).toLocaleString()}
                </span>
              </div>
              {activeEffects.length > 0 && (
                <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6 }}>
                  <div style={{ fontSize: 10, opacity: 0.4, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>✨ Эффекты</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {activeEffects.map((ef) => (
                      <div key={ef.id} style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 10, color: '#fbbf24',
                        background: 'rgba(217,119,6,0.08)', borderRadius: 3,
                        padding: '2px 6px',
                      }}>
                        <span style={{ fontWeight: 600 }}>{ef.name}</span>
                        <span style={{ color: ef.remaining <= 1 ? '#ff6b6b' : 'rgba(255,255,255,0.4)', marginLeft: 'auto' }}>
                          {ef.remaining} хода
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ fontSize: 13, marginTop: 8, textAlign: 'center', opacity: 0.6, animation: turn === 'player' ? 'pulseText 2s infinite' : 'none' }}>
                {turn === 'player' ? '>>> ВАШ ХОД <<<' : 'ОЖИДАНИЕ ХОДА...'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Power breakdown tooltip */}
      {showPowerBreakdown && (
        <div style={{
          position: 'fixed',
          left: Math.min(powerTooltipPos.x + 14, window.innerWidth - 300),
          top: Math.min(powerTooltipPos.y - 8, window.innerHeight - 300),
          zIndex: 9999, width: 260,
          background: '#12121a', border: '1px solid rgba(251,191,36,0.3)',
          borderRadius: 4, padding: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5), 0 0 12px rgba(251,191,36,0.1)',
          pointerEvents: 'none', fontSize: 11,
        }}>
          <div style={{ fontWeight: 600, color: '#fbbf24', marginBottom: 6, fontSize: 12 }}>🟡 Разбор мощности</div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
            <span>⚔️ Атака (DPS ×3):</span>
            <span style={{ color: 'var(--text-primary)' }}>+{powerBreakdown.offensiveScore.toLocaleString()}</span>
          </div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
            <span>🛡️ Защита (EHP /10):</span>
            <span style={{ color: 'var(--text-primary)' }}>+{powerBreakdown.defensiveScore.toLocaleString()}</span>
          </div>
          {powerBreakdown.itemPowers.length > 0 && (
            <>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6, marginBottom: 4 }}>
                <div style={{ color: '#fbbf24', marginBottom: 4, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>⚙️ Предметы</div>
                {powerBreakdown.itemPowers.map((ip, i) => (
                  <div key={i} style={{ color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginBottom: 2, fontSize: 10 }}>
                    <span>{ip.slot} <span style={{ opacity: 0.4 }}>({ip.itemName})</span></span>
                    <span style={{ color: '#fbbf24' }}>+{ip.power}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {powerBreakdown.abilityItems.length > 0 && (
            <>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6, marginBottom: 4 }}>
                <div style={{ color: '#fbbf24', marginBottom: 4, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>💎 Способности амуниции</div>
                {powerBreakdown.abilityItems.map((ai, i) => (
                  <div key={i} style={{ color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginBottom: 2, fontSize: 10 }}>
                    <span>{ai.abilityName} <span style={{ opacity: 0.4 }}>({ai.itemName})</span></span>
                    <span style={{ color: '#fbbf24' }}>+{ai.power}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6, marginTop: 2, display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
            <span style={{ color: 'var(--text-primary)' }}>Итого</span>
            <span style={{ color: '#fbbf24' }}>{Math.round(stats.power || 0).toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Defeat overlay */}
      {isDefeat && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.85)',
          fontFamily: "'Courier New', monospace",
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💀</div>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: '#ff4444', letterSpacing: 4, textTransform: 'uppercase', marginBottom: 8 }}>
              П О Р А Ж Е Н И Е
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 30 }}>
              Ты пал в бою... Отряд эвакуирует тело.
            </div>
            <div
              onClick={() => {
                const player = usePlayerStore.getState();
                player.addLog('💀 Поражение... Возвращение на базу.', 'warning');
                usePlayerStore.setState((st: any) => ({
                  stats: { ...st.stats, currentHp: Math.floor(st.stats.maxHp * 0.3) },
                  combat: { ...st.combat, isFighting: false },
                }));
                useCombatGridStore.getState().cleanup();
              }}
              style={{
                display: 'inline-block', padding: '12px 36px',
                border: '1px solid #ff4444', color: '#ff4444',
                cursor: 'pointer', fontSize: 16, textTransform: 'uppercase',
                letterSpacing: 2, background: 'rgba(255,50,50,0.1)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,50,50,0.2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,50,50,0.1)'; }}
            >
              🏳️ Покинуть локацию
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};
