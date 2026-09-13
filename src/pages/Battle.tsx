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
import { ammoTypeForWeapon, ammoGroupName, countAmmo } from '../data/ammo';
import { getTerrainBonus } from '../engine/terrain';
import { useSound, playCombatSound, stopCombatSound } from '../hooks/useSound';
import { getEnemyImage, getCharacterImage, images } from '../assets/index';

const LogPanel = () => {
  const battleLogs = useCombatGridStore((s) => s.battleLogs);
  const logSize = useUiStore((s) => s.battleLogSize ?? 20);
  const visible = battleLogs.slice(-logSize);
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
        {visible.length === 0 && <span style={{ opacity: 0.3 }}>—</span>}
        {visible.map((msg, i) => (
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
  Союзник: '#22d3ee',
};

const SKILL_ICONS: Record<string, string> = {
  rage: '💢', aimShot: '🎯', invisibility: '👤', ram: '🏃',
  madness: '🌀', grenade: '💣', redZone: '🚨', suppression: '🔥',
  stimulant: '💉', summoner: '👥',
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
  // Запас патронов группы АКТИВНОГО оружия (живой подсчёт из рюкзака).
  const battleWeapon = usePlayerStore((s) => s.getActiveWeapon());
  const battleAmmoGroup = battleWeapon && (battleWeapon as any).ammoCapacity ? ammoTypeForWeapon(battleWeapon) : null;
  const battleAmmoReserve = usePlayerStore((s) => (battleAmmoGroup ? countAmmo(s.backpackGrid.items, battleAmmoGroup) : 0));
  const packContents = usePlayerStore((s) => s.backpackGrid.items);
  // В бою инвентарь недоступен: открыт — принудительно закрываем, открыть не даём.
  const inventoryOpen = useUiStore((s) => s.inventoryOpen);
  useEffect(() => {
    if (isActive && inventoryOpen) useUiStore.getState().setInventoryOpen(false);
  }, [isActive, inventoryOpen]);
  const consumableCount = (abilityId?: string) => {
    if (!abilityId) return -1;
    let n = 0;
    for (const i of packContents) {
      if (i.type === 'consumable' && (i as any).abilityId === abilityId) n += ((i as any).quantity ?? 1);
    }
    return n;
  };
  const combatRange = useCombatGridStore((s) => s.range);
  const turn = useCombatGridStore((s) => s.turn);
  const turnCount = useCombatGridStore((s) => s.turnCount);
  const pendingReinforce = useCombatGridStore((s) => s.pendingReinforce);
  const reinforceSpawned = useCombatGridStore((s) => s.reinforceSpawned);
  const message = useCombatGridStore((s) => s.message);
  const selectedEnemy = useCombatGridStore((s) => s.selectedEnemy);
  const enemies = useCombatGridStore((s) => s.enemies);
  const isMoving = useCombatGridStore((s) => s.isMoving);
  const isSelected = useCombatGridStore((s) => s.isSelected);
  const cursorPos = useCombatGridStore((s) => s.cursorPos);
  const playerPos = useCombatGridStore((s) => s.playerPos);
  const obstacles = useCombatGridStore((s) => s.obstacles);
  const myTerrain = getTerrainBonus(playerPos, obstacles);
  const myTerrainText = [
    myTerrain.evasion > 0 ? `🌀+${Math.round(myTerrain.evasion * 100)}%` : '',
    myTerrain.armor > 0 ? `🛡️+${Math.round(myTerrain.armor * 100)}%` : '',
    myTerrain.block > 0 ? `🧱+${Math.round(myTerrain.block * 10)}%` : '',
  ].filter(Boolean).join(' ');
  const isVictory = useCombatGridStore((s) => s.isVictory);
  const isDefeat = useCombatGridStore((s) => s.isDefeat);

  const handleKeyboardMove = useCombatGridStore((s) => s.handleKeyboardMove);
  const selectMe = useCombatGridStore((s) => s.selectMe);
  const reload = useCombatGridStore((s) => s.reload);
  const cycleWeapon = useCombatGridStore((s) => s.cycleWeapon);
  const activeWeaponName = usePlayerStore((s) => s.getActiveWeapon()?.displayName || s.getActiveWeapon()?.name || 'Кулаки');
  const toggleStealth = useCombatGridStore((s) => s.toggleStealth);
  const stealth = useCombatGridStore((s) => s.stealth);
  const stealthKill = useCombatGridStore((s) => s.stealthKill);
  const endTurn = useCombatGridStore((s) => s.endTurn);
  const attackEnemy = useCombatGridStore((s) => s.attackEnemy);
  const gridEnemies = useCombatGridStore((s) => s.enemies);
  const gridReserve = useCombatGridStore((s) => s.reserve);

  // Пустой активный бой (0 врагов, 0 резерва) — автовыход через победу, а не вис.
  useEffect(() => {
    if (isActive && gridEnemies.length === 0 && (gridReserve?.length ?? 0) === 0 && !isVictory && !isDefeat) {
      const t = setTimeout(() => {
        const st = useCombatGridStore.getState();
        if (st.isActive && st.enemies.length === 0 && (st.reserve?.length ?? 0) === 0) st.finishBattle();
      }, 800);
      return () => clearTimeout(t);
    }
  }, [isActive, gridEnemies.length, gridReserve?.length, isVictory, isDefeat]);

  // Ручной сброс зависшего боя — всегда доступен в бою.
  const resetStuckCombat = useCallback(() => {
    if (!window.confirm('Сбросить текущий бой? Прогресс боя будет потерян.')) return;
    playClick();
    useCombatGridStore.getState().cleanup();
    usePlayerStore.setState((st: any) => ({ combat: { ...st.combat, isFighting: false } }));
  }, [playClick]);
  const playerAbilities = useCombatGridStore((s) => s.playerAbilities);
  const abilityCooldowns = useCombatGridStore((s) => s.abilityCooldowns);
  const selectedAbility = useCombatGridStore((s) => s.selectedAbility);
  const selectAbility = useCombatGridStore((s) => s.selectAbility);
  const useAbility = useCombatGridStore((s) => s.useAbility);

  // Hovered enemy for Intel panel
  const [hoveredEnemy, setHoveredEnemy] = useState<typeof enemies[0] | null>(null);
  const [showLog, setShowLog] = useState(false);
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
        case 'KeyR': reload(); playSound('reloading'); break;
        case 'KeyF': playClick(); toggleStealth(); break;
        case 'KeyC': stealthKill(); break;
        case 'KeyQ': cycleWeapon(); break;
        case 'Enter': e.preventDefault(); selectMe(); break;
        case 'KeyE': selectMe(); break;
        case 'Digit1': selectAbility(0); break;
        case 'Digit2': selectAbility(1); break;
        case 'Digit3': selectAbility(2); break;
        case 'Digit4': selectAbility(3); break;
        case 'Digit5': selectAbility(4); break;
        case 'Digit6': selectAbility(5); break;
        case 'Digit7': selectAbility(6); break;
        case 'Digit8': selectAbility(7); break;
        case 'Digit9': selectAbility(8); break;
        case 'Digit0': selectAbility(9); break;
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
  }, [turn, isVictory, isMoving, handleKeyboardMove, selectMe, reload, cycleWeapon, toggleStealth, stealthKill, endTurn, playSound, playClick, selectAbility]);

  const selectedEnemyData = enemies.find((e) => selectedEnemy !== null && e.id === selectedEnemy);
  const hoverTarget = hoveredEnemy || selectedEnemyData;
  const aliveEnemies = enemies.filter((e) => !e.dead && e.faction !== 'Союзник');
  const aliveAllies = enemies.filter((e) => !e.dead && e.faction === 'Союзник');

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

  // Флаг боя взведён, а сетка пуста (зависший бой) — экран восстановления вместо пустоты.
  if (combat.isFighting && !isActive) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
        <WapPanel variant="metal" padding="lg" glow="amber" style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>⚠️ Бой не загрузился</div>
          <div style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
            Флаг боя взведён, а арена пуста — это зависший бой. Убери его и начни новый.
          </div>
          <Button variant="danger" onClick={resetStuckCombat}>🧹 Убрать зависший бой</Button>
        </WapPanel>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'flex', gap: 0, alignItems: 'flex-start' }}>
      {/* Left PDA Control Panel */}
      {isActive && (
        <div style={{
          width: 264, flexShrink: 0,
          background: 'linear-gradient(180deg, rgb(20,12,8), rgb(10,8,5))',
          border: '2px solid rgba(217,119,6,0.2)',
          borderRadius: 8,
          boxShadow: '0 0 0 1px rgba(217,119,6,0.3), 0 12px 48px rgba(0,0,0,0.6)',
          color: 'var(--text-secondary)',
          position: 'relative', overflow: 'hidden',
          fontFamily: 'var(--font-sans)',
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(180deg, rgb(217,119,6), rgb(146,64,14))',
            padding: '8px 10px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
              {turn === 'player' ? '⭐ Твой ход' : '⏳ Ход врага'}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontFamily: 'var(--font-mono)' }}>Раунд #{turnCount}</div>
          </div>

          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* AP + боезапас */}
            <div style={{
              padding: '10px 12px', borderRadius: 8,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 6 }}>⚡ Очки действий</div>
              <div style={{ display: 'flex', gap: 2, height: 10, marginBottom: 8 }}>
                {Array.from({ length: maxAp }).map((_, i) => (
                  <div key={i} style={{
                    flex: 1, background: i < ap ? 'linear-gradient(180deg,#fbbf24,#d97706)' : 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(217,119,6,0.35)', borderRadius: 2,
                    boxShadow: i < ap ? '0 0 6px rgba(251,191,36,0.5)' : 'none',
                    transition: 'all 0.3s ease',
                  }} />
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 13 }}>
                <span title="Очки действий">⚡ <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{ap}/{maxAp}</b></span>
                <span title="Дальность стрельбы">📏 <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{combatRange}</b></span>
                <span title={battleAmmoGroup ? `Магазин · ${ammoGroupName(battleAmmoGroup)}` : 'Без оружия'}>🔫 <b style={{ color: '#f87171', fontFamily: 'var(--font-mono)' }}>{ammo}/{maxAmmo}</b></span>
                <span title={battleAmmoGroup ? `Запас: ${ammoGroupName(battleAmmoGroup)}` : 'Без оружия'}>📦 <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{battleAmmoReserve}</b></span>
              </div>
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>
                  <span>🔋 Энергия (стамина)</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{Math.round(stats.stamina || 0)}/{stats.maxStamina || 100}</span>
                </div>
                <ProgressBar value={Math.round(stats.stamina || 0)} max={stats.maxStamina || 100}
                  variant={(stats.stamina || 0) / (stats.maxStamina || 100) < 0.1 ? 'danger' : 'stamina'} />
              </div>
            </div>

            {/* Message — бегущая строка вместо лога */}
            {message && (
              <div style={{ fontSize: 12, textAlign: 'center', padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(251,191,36,0.25)', background: 'rgba(217,119,6,0.08)', color: 'var(--text-primary)' }}>
                <span style={{ animation: message ? 'pulseText 2s infinite' : 'none' }}>{message}</span>
              </div>
            )}
            {/* Счётчик подкрепления (идёт на 40 ходу) */}
            {pendingReinforce.length > 0 && !reinforceSpawned && (
              <div style={{ fontSize: 12, textAlign: 'center', padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(248,113,113,0.4)', background: 'rgba(248,113,113,0.08)', color: '#fca5a5' }}>
                ⚠️ Подкрепление ({pendingReinforce.length}) через {Math.max(0, 39 - turnCount)} ход.
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div
                onClick={() => { playClick(); selectMe(); }}
                style={{
                  padding: '9px', borderRadius: 6,
                  border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'rgba(255,255,255,0.12)'}`,
                  background: isSelected ? 'rgba(217,119,6,0.15)' : 'rgba(255,255,255,0.03)',
                  color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  cursor: turn !== 'player' ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 600, textAlign: 'center', textTransform: 'uppercase',
                  opacity: turn !== 'player' ? 0.4 : 1,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span>🎯 Выбор</span>
                <span style={{ fontSize: 10, opacity: 0.5, fontFamily: 'var(--font-mono)' }}>E {isSelected ? '●' : '○'}</span>
              </div>

              <div
                onClick={() => { playClick(); playSound('reloading'); reload(); }}
                style={{
                  padding: '9px', borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.03)',
                  color: turn !== 'player' || ap < 1 ? 'rgba(255,255,255,0.2)' : 'var(--text-secondary)',
                  cursor: turn !== 'player' || ap < 1 ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 600, textAlign: 'center', textTransform: 'uppercase',
                  opacity: turn !== 'player' || ap < 1 ? 0.4 : 1,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span>🔁 Перезарядка · 1 AP</span>
                <span style={{ fontSize: 10, opacity: 0.5, fontFamily: 'var(--font-mono)' }}>R</span>
              </div>

              <div
                onClick={() => { playClick(); cycleWeapon(); }}
                style={{
                  padding: '9px', borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.03)',
                  color: turn !== 'player' ? 'rgba(255,255,255,0.2)' : 'var(--text-secondary)',
                  cursor: turn !== 'player' ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 600, textAlign: 'center', textTransform: 'uppercase',
                  opacity: turn !== 'player' ? 0.4 : 1,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
                title="Смена оружия (магазин текущего сохраняется)"
              >
                <span>🔫 {activeWeaponName}</span>
                <span style={{ fontSize: 10, opacity: 0.5, fontFamily: 'var(--font-mono)' }}>Q</span>
              </div>

              <div
                onClick={() => { playClick(); toggleStealth(); }}
                style={{
                  padding: '9px', borderRadius: 6,
                  border: `1px solid ${stealth ? 'var(--accent-primary)' : 'rgba(255,255,255,0.12)'}`,
                  background: stealth ? 'rgba(217,119,6,0.15)' : 'rgba(255,255,255,0.03)',
                  color: stealth ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  cursor: turn !== 'player' ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 600, textAlign: 'center', textTransform: 'uppercase',
                  opacity: turn !== 'player' ? 0.4 : 1,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
                title="Скрытность: обычные замечают в 3, часовые — в 10 клетках. Слетает при выстреле. Только вне боя."
              >
                <span>🕵️ Скрытность {stealth ? '(АКТИВНО)' : ''}</span>
                <span style={{ fontSize: 10, opacity: 0.5, fontFamily: 'var(--font-mono)' }}>F</span>
              </div>

              {/* Скрытное убийство — видно только в скрытности */}
              {stealth && (
                <div
                  onClick={() => { playClick(); stealthKill(); }}
                  style={{
                    padding: '9px', borderRadius: 6,
                    border: '1px solid rgba(248,113,113,0.4)',
                    background: 'rgba(248,113,113,0.08)',
                    color: turn !== 'player' ? 'rgba(255,255,255,0.2)' : '#f87171',
                    cursor: turn !== 'player' ? 'not-allowed' : 'pointer',
                    fontSize: 13, fontWeight: 600, textAlign: 'center', textTransform: 'uppercase',
                    opacity: turn !== 'player' ? 0.4 : 1,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                  title="Тихо убивает спящего врага рядом (2 AP). Стелс не слетает."
                >
                  <span>🔪 Скрытное убийство · 2 AP</span>
                  <span style={{ fontSize: 10, opacity: 0.5, fontFamily: 'var(--font-mono)' }}>C</span>
                </div>
              )}

              <div
                onClick={() => { playClick(); handleEnemyAttack(); }}
                style={{
                  padding: '9px', borderRadius: 6,
                  border: '1px solid rgba(248,113,113,0.4)',
                  background: selectedAbility !== null ? 'rgba(251,191,36,0.12)' : 'rgba(248,113,113,0.08)',
                  color: turn !== 'player' || (selectedAbility === null && (ap < 1 || selectedEnemy === null)) ? 'rgba(255,255,255,0.2)' : '#f87171',
                  cursor: turn !== 'player' || (selectedAbility === null && (ap < 1 || selectedEnemy === null)) ? 'not-allowed' : 'pointer',
                  fontSize: 14, fontWeight: 800, textAlign: 'center', textTransform: 'uppercase',
                  opacity: turn !== 'player' || (selectedAbility === null && (ap < 1 || selectedEnemy === null)) ? 0.4 : 1,
                  animation: turn === 'player' && ((selectedAbility !== null) || (ap >= 1 && selectedEnemy !== null)) ? 'pulseBorder 2s infinite' : 'none',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span>{selectedAbility !== null ? '✨ Применить' : '🔫 Атака · 1 AP'}</span>
                <span style={{ fontSize: 10, opacity: 0.5, fontFamily: 'var(--font-mono)' }}>КЛИК</span>
              </div>

              <div
                onClick={() => { playClick(); endTurn(); }}
                style={{
                  padding: '10px', borderRadius: 6,
                  border: '1px solid rgba(217,119,6,0.4)',
                  background: 'linear-gradient(180deg, rgb(180,100,10), rgb(120,60,8))',
                  color: '#fff', fontWeight: 800,
                  cursor: turn !== 'player' ? 'not-allowed' : 'pointer',
                  fontSize: 13, textAlign: 'center', textTransform: 'uppercase',
                  letterSpacing: 1, opacity: turn !== 'player' ? 0.4 : 1,
                  marginTop: 2,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span>⏭ Конец хода</span>
                <span style={{ fontSize: 10, opacity: 0.7, fontFamily: 'var(--font-mono)' }}>SPACE</span>
              </div>

              <div
                onClick={resetStuckCombat}
                title="Если бой завис — сбросить его и выйти"
                style={{
                  padding: '6px 9px', border: '1px solid rgba(255,80,80,0.25)',
                  background: 'rgba(255,50,50,0.04)',
                  color: 'rgba(255,120,120,0.6)',
                  cursor: 'pointer',
                  fontSize: 11, textTransform: 'uppercase',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span>🧹 Сбросить бой</span>
                <span style={{ fontSize: 10, opacity: 0.5, fontFamily: 'var(--font-mono)' }}>—</span>
              </div>
            </div>

            {/* Ability panel */}
            {playerAbilities.some((a) => a !== null) && (
              <div style={{
                padding: '10px 12px', borderRadius: 8,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 6 }}>💎 СПОСОБНОСТИ</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 48px)', gap: 4, justifyContent: 'start' }}>
                  {playerAbilities.map((ab, i) => {
                    if (!ab) return <div key={i} style={{ width: 48, height: 53, border: '1px solid rgba(255,255,255,0.05)', borderRadius: 6 }} />;
                    const cd = abilityCooldowns[i];
                    const isReady = cd <= 0 && ap >= ab.apCost;
                    const isSelected = selectedAbility === i;
                    const canAfford = ap >= ab.apCost;
                    const statusText = cd > 0 ? `КД ${cd}` : !canAfford ? `${ab.apCost}AP` : '●';
                    const statusColor = cd > 0 ? '#ff6b6b' : !canAfford ? 'rgba(255,255,255,0.3)' : '#69db7c';
                    // Остаток расходника в рюкзаке (-1 = пассивка, бесплатно).
                    const consLeft = ab.passive ? -1 : consumableCount(ab.id);
                    const outOfStock = consLeft === 0;
                    return (
                      <div key={i}
                        onClick={() => { playClick(); selectAbility(i); }}
                        title={`[${i + 1}] ${ab.name} — ${ab.description}\n${ab.apCost} AP | КД: ${ab.cooldown} хода\n⭐ Сила: ${ab.powerRating}${consLeft >= 0 ? `\n📦 Расходник: осталось ${consLeft}` : ''}`}
                        style={{
                          width: 48, height: 53, display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center', gap: 0,
                          padding: '3px 2px',
                          border: `1px solid ${isSelected ? 'var(--accent-primary)' : outOfStock ? 'rgba(248,113,113,0.4)' : isReady ? 'rgba(217,119,6,0.4)' : 'rgba(255,255,255,0.06)'}`,
                          background: isSelected ? 'rgba(217,119,6,0.18)' : outOfStock ? 'rgba(248,113,113,0.05)' : isReady ? 'rgba(217,119,6,0.06)' : 'rgba(255,255,255,0.015)',
                          boxShadow: isSelected ? '0 0 10px rgba(217,119,6,0.4)' : 'none',
                          cursor: turn !== 'player' || !isReady ? 'not-allowed' : 'pointer',
                          opacity: turn !== 'player' || !isReady ? 0.35 : 1,
                          borderRadius: 6, position: 'relative',
                        }}
                      >
                        <span style={{ fontSize: 17, lineHeight: 1 }}>{ab.icon}</span>
                        <div style={{ fontSize: 9, color: statusColor, fontWeight: 700, lineHeight: 1, fontFamily: 'var(--font-mono)' }}>
                          {ab.apCost > 0 ? `${ab.apCost}AP` : 'FREE'}
                        </div>
                        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', lineHeight: 1, fontFamily: 'var(--font-mono)' }}>
                          {cd > 0 ? `КД${cd}` : outOfStock ? 'НЕТ' : statusText}
                        </div>
                        <div style={{
                          position: 'absolute', bottom: 1, left: 3,
                          fontSize: 8, color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-mono)',
                        }}>
                          {i + 1}
                        </div>
                        {consLeft >= 0 && (
                          <div style={{
                            position: 'absolute', top: 1, right: 3,
                            fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
                            color: consLeft > 0 ? '#4ade80' : '#f87171',
                            background: 'rgba(0,0,0,0.65)', padding: '0 4px', borderRadius: 3,
                          }}>
                            x{consLeft}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Battle log — таб, свёрнут по умолчанию */}
            <div style={{
              borderRadius: 8, overflow: 'hidden',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <div
                onClick={() => { playClick(); setShowLog((v) => !v); }}
                style={{
                  padding: '6px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  letterSpacing: 1, color: 'var(--text-muted)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span>📋 ЛОГ БОЯ</span>
                <span style={{ fontSize: 10 }}>{showLog ? '▲' : '▼'}</span>
              </div>
              {showLog && <div style={{ padding: '0 8px 8px' }}><LogPanel /></div>}
            </div>

            {/* Enemies count */}
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 'auto', textAlign: 'center' }}>
              👾 Противников: <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{aliveEnemies.length}</b>
              {aliveAllies.length > 0 && (
                <div style={{ marginTop: 2 }}>
                  🤝 Союзников: <b style={{ color: '#22d3ee', fontFamily: 'var(--font-mono)' }}>{aliveAllies.length}</b>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Center - Battle Grid */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <BattleGrid />
        {/* Vignette */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1000,
          background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%)',
        }} />
      </div>

      {/* Right Enemy Intel Panel */}
      {isActive && (
        <div style={{
          width: 276, flexShrink: 0,
          background: 'linear-gradient(180deg, rgb(20,12,8), rgb(10,8,5))',
          border: '2px solid rgba(217,119,6,0.2)',
          borderRadius: 8,
          boxShadow: '0 0 0 1px rgba(217,119,6,0.3), 0 12px 48px rgba(0,0,0,0.6)',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-sans)',
        }}>
          {hoverTarget ? (() => {
            const ePow = Math.round(hoverTarget.damage) * 3 +
              Math.round(hoverTarget.maxHp / 10) +
              Math.round(hoverTarget.armor) * 2 +
              Math.round((hoverTarget.evasion || 0) * 100) * 5 +
              Math.round((hoverTarget.block || 0) * 10) * 3 +
              Math.round((hoverTarget.crit || 0) * 100) * 2 +
              Math.round((hoverTarget.punching || 0) * 100) * 2;
            const ratio = ePow / Math.max(1, Math.round(stats.power || 0));
            const threat = ratio < 0.4 ? { t: 'D', c: '#4ade80' }
              : ratio < 0.8 ? { t: 'C', c: '#a3e635' }
              : ratio < 1.2 ? { t: 'B', c: '#fbbf24' }
              : ratio < 2 ? { t: 'A', c: '#fb923c' }
              : { t: 'S', c: '#f87171' };
            const eShots = Math.max(1, Math.floor((hoverTarget.runAp || 5) / (hoverTarget.shotPrice || 1)));
            const myTurnDmg = Math.max(1, Math.round((stats.damage || 0) * Math.max(1, ap)));
            const turnsToKill = Math.max(1, Math.ceil(Math.max(0, hoverTarget.currentHp) / myTurnDmg));
            return (
            <div style={{ position: 'relative', overflow: 'hidden' }}>
              {/* Header */}
              <div style={{
                background: 'linear-gradient(180deg, rgb(217,119,6), rgb(146,64,14))',
                padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, color: '#fff', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  🎯 {hoverTarget.name}
                </span>
                <span title={`Угроза относительно твоей мощи (${Math.round(stats.power || 0)})`} style={{
                  fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-mono)',
                  color: threat.c, border: `1px solid ${threat.c}`, borderRadius: 4,
                  padding: '0 6px', background: 'rgba(0,0,0,0.4)', flexShrink: 0, marginLeft: 6,
                }}>
                  {threat.t}
                </span>
              </div>
              {/* Avatar + HP */}
              <div style={{ display: 'flex', gap: 10, padding: '10px 12px 8px', alignItems: 'center' }}>
                <img src={(() => {
                  const nm = (hoverTarget as any).nowModel || (hoverTarget as any).avatar;
                  // Союзник: та же моделька, что на поле (без фолбэков наугад).
                  if (hoverTarget.faction === 'Союзник' && nm) {
                    return getCharacterImage(nm) || getEnemyImage(hoverTarget.faction, hoverTarget.name);
                  }
                  return getEnemyImage(hoverTarget.faction, hoverTarget.name);
                })()} alt={hoverTarget.name}
                  style={{
                    width: 84, height: 84, objectFit: 'contain', flexShrink: 0,
                    border: `2px solid ${ENEMY_COLORS[hoverTarget.faction] || '#a1a1aa'}`,
                    borderRadius: 8, background: 'rgba(0,0,0,0.4)',
                  }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: ENEMY_COLORS[hoverTarget.faction] || '#fff', marginBottom: 4 }}>
                    {hoverTarget.faction}
                  </div>
                  {(hoverTarget as any).callsign && (
                    <div style={{ fontSize: 11, color: '#fbbf24', marginBottom: 4 }}>
                      🎖️ Позывной «{(hoverTarget as any).callsign}»
                    </div>
                  )}
                  <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginBottom: 4 }}>
                    {Math.max(0, Math.round(hoverTarget.currentHp))} / {hoverTarget.maxHp}
                  </div>
                  <ProgressBar value={Math.max(0, Math.round(hoverTarget.currentHp))} max={hoverTarget.maxHp}
                    variant={hoverTarget.currentHp / hoverTarget.maxHp < 0.3 ? 'danger' : 'hp'} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 10, color: 'var(--text-muted)' }}>
                    <span title="Примерно выстрелов за ход врага">🔫≈{eShots}/ход</span>
                    <span title="Примерно твоих ходов до убийства">💀≈{turnsToKill} {turnsToKill === 1 ? 'ход' : 'хода'}</span>
                  </div>
                </div>
              </div>
              {/* Stats */}
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--text-muted)', padding: '0 12px 4px' }}>📊 ВРАГ</div>
              <div style={{ padding: '0 12px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 10px', fontSize: 12 }}>
                <span>⚔️ Атака <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{Math.round(hoverTarget.damage)}</b></span>
                <span>🛡️ Броня <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{Math.round(hoverTarget.armor)}</b></span>
                <span>🎯 Метк. <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{Math.round((hoverTarget.accuracy || 0) * 100)}%</b></span>
                <span>💥 Крит <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{Math.round((hoverTarget.crit || 0) * 100)}%</b></span>
                <span>🌀 Увор. <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{Math.round((hoverTarget.evasion || 0) * 100)}%</b></span>
                <span>🧱 Блок <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{Math.round((hoverTarget.block || 0) * 10)}%</b></span>
                <span>👊 Проб. <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{Math.round((hoverTarget.punching || 0) * 100)}%</b></span>
                <span>🩸 Вамп. <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{Math.round((hoverTarget.vampir || 0) * 100)}%</b></span>
                <span>📏 Дальн. <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{hoverTarget.rangeDistance || 7}</b></span>
                <span>💨 ОД <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{hoverTarget.runAp || 5}</b></span>
              </div>
              {(() => {
                const et = getTerrainBonus(hoverTarget.pos, obstacles);
                const etext = [
                  et.evasion > 0 ? `🌀+${Math.round(et.evasion * 100)}%` : '',
                  et.armor > 0 ? `🛡️+${Math.round(et.armor * 100)}%` : '',
                  et.block > 0 ? `🧱+${Math.round(et.block * 10)}%` : '',
                ].filter(Boolean).join(' ');
                return etext ? (
                  <div title={et.sources.join('; ')} style={{ fontSize: 11, color: '#4ade80', padding: '0 12px 8px' }}>
                    🛡️ Укрытие врага: <b style={{ fontFamily: 'var(--font-mono)' }}>{etext}</b>
                  </div>
                ) : null;
              })()}
              {/* Power */}
              <div style={{ padding: '0 12px 8px', display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: '#fbbf24', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, margin: '0 12px', paddingLeft: 0, paddingRight: 0 }}>
                <span>🟡 МОЩНОСТЬ</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{ePow.toLocaleString()}</span>
              </div>
              {((hoverTarget as any).debuffs?.burn || (hoverTarget as any).debuffs?.tox || (hoverTarget as any).debuffs?.extro || (hoverTarget as any).debuffs?.emi) && (
                <div style={{ padding: '0 12px 8px', fontSize: 12, color: '#fca5a5' }}>
                  {(hoverTarget as any).debuffs?.burn && <div>🔥 Горение: −3% HP каждый ход</div>}
                  {(hoverTarget as any).debuffs?.tox && <div>☠️ Токсин: −3% брони каждый ход (сейч. {Math.round(hoverTarget.armor)})</div>}
                  {(hoverTarget as any).debuffs?.extro && <div>💫 Экстро: −25% атаки</div>}
                  {(hoverTarget as any).debuffs?.emi && <div>⚡ ЭМИ: −50% блока</div>}
                </div>
              )}
              {/* Skills — иконки в ряд */}
              {hoverTarget.skillUse && hoverTarget.skillUse.length > 0 && (
                <div style={{ padding: '0 12px 12px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 6 }}>🧠 СПОСОБНОСТИ</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {hoverTarget.skillUse.map((sk: string, i: number) => {
                      const cd = hoverTarget.cooldowns?.[sk] || 0;
                      return (
                        <div key={i} title={`${sk}${cd > 0 ? ` — КД ${cd}` : ' — готов'}`}
                          style={{
                            width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 20, borderRadius: 6, position: 'relative',
                            border: `1px solid ${cd > 0 ? 'rgba(255,77,77,0.4)' : 'rgba(74,222,128,0.4)'}`,
                            background: cd > 0 ? 'rgba(255,77,77,0.06)' : 'rgba(74,222,128,0.06)',
                          }}>
                          <span style={{ opacity: cd > 0 ? 0.4 : 1 }}>{SKILL_ICONS[sk] || '❓'}</span>
                          {cd > 0 && (
                            <span style={{
                              position: 'absolute', bottom: -4, right: -4, fontSize: 9, fontWeight: 700,
                              fontFamily: 'var(--font-mono)', color: '#fff', background: '#dc2626',
                              borderRadius: 6, padding: '0 4px',
                            }}>
                              {cd}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            );
          })() : (
            <div style={{ padding: 26, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', position: 'relative', overflow: 'hidden' }}>
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
          <div style={{ borderTop: '1px solid rgba(217,119,6,0.25)', marginTop: 'auto' }}>
            <div style={{
              padding: '7px 12px', fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase',
              background: 'linear-gradient(180deg, rgb(217,119,6), rgb(146,64,14))', color: '#fff',
              textShadow: '0 1px 3px rgba(0,0,0,0.6)',
            }}>
              👤 Оператор
            </div>
            <div style={{ padding: 12 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                <img src={images.hero} alt="hero" style={{ width: 56, height: 56, objectFit: 'contain', flexShrink: 0, border: '2px solid rgba(217,119,6,0.5)', borderRadius: 8, background: 'rgba(0,0,0,0.4)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>
                    <span>❤️ HP</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{Math.round(stats.currentHp)} / {stats.maxHp}</span>
                  </div>
                  <ProgressBar value={Math.round(stats.currentHp)} max={stats.maxHp}
                    variant={stats.currentHp / stats.maxHp < 0.3 ? 'danger' : 'hp'} />
                </div>
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 4 }}>📊 ОПЕРАТОР</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 10px', fontSize: 12 }}>
                <span>⚡ ОД: <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{ap}/{maxAp}</b></span>
                <span>🔫 Маг.: <b style={{ color: '#f87171', fontFamily: 'var(--font-mono)' }}>{ammo}/{maxAmmo}</b></span>
                <span>⚔️ Атака: <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{Math.round(stats.damage)}</b></span>
                <span>🛡️ Броня: <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{Math.round(stats.armor)}</b></span>
                <span>🎯 Метк.: <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{Math.round((stats.accuracy || 0) * 100)}%</b></span>
                <span>💥 Крит: <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{Math.round((stats.crit || 0) * 100)}%</b></span>
                <span>🌀 Увор.: <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{Math.round((stats.evasion || 0) * 100)}%</b></span>
                <span>🧱 Блок: <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{Math.round((stats.block || 0) * 10)}%</b></span>
                <span>👊 Проб.: <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{Math.round((stats.punching || 0) * 100)}%</b></span>
                <span>🩸 Вамп.: <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{Math.round((stats.vampir || 0) * 100)}%</b></span>
              </div>
              {myTerrainText && (
                <div title={myTerrain.sources.join('; ')} style={{ marginTop: 6, fontSize: 11, color: '#4ade80', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6, textAlign: 'center' }}>
                  🛡️ Укрытие: <b style={{ fontFamily: 'var(--font-mono)' }}>{myTerrainText}</b>
                </div>
              )}
              <div style={{ marginTop: 6, fontSize: 12, color: '#fbbf24', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6, textAlign: 'center' }}>
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
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 4 }}>✨ ЭФФЕКТЫ</div>
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
              <div style={{
                fontSize: 12, fontWeight: 700, marginTop: 8, textAlign: 'center', letterSpacing: 1,
                color: turn === 'player' ? 'var(--accent-primary)' : 'var(--text-muted)',
                animation: turn === 'player' ? 'pulseText 2s infinite' : 'none',
              }}>
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
                const lost = player.backpackGrid.items.length;
                player.addLog('💀 Поражение... Возвращение на базу.', 'warning');
                if (lost > 0) player.addLog(`🎒 Рюкзак потерян в бою: вещей ${lost} сгинуло!`, 'warning');
                player.clearBackpack();
                usePlayerStore.setState((st: any) => ({
                  stats: { ...st.stats, currentHp: 1 },
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
