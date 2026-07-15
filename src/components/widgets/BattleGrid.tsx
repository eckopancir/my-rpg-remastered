import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useCombatGridStore, checkVisibility, getDist } from '../../stores/combatGridStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useSound } from '../../hooks/useSound';
import { useEnemyAI } from '../../hooks/useEnemyAI';
import { getEnemyImage, getBattleImage, getCharacterImage, images } from '../../assets/index';
import type { GridEnemy } from '../../stores/combatGridStore';
import styles from './BattleGrid.module.css';

const GRID_SIZE = 32;

const ENEMY_COLORS: Record<string, string> = {
  Мутанты: '#7c3aed',
  Роботы: '#2563eb',
  Бандиты: '#dc2626',
  Военные: '#16a34a',
  Неизвестно: '#a1a1aa',
};

const BIG_BUILDING_IMAGES = ['o8', 'o10', 'o11', 'o12', 'o13', 'o14', 'o15', 'o16', 'o17', 'o18', 'o27'];
const CAR_IMAGES = ['o6', 'o7', 'o22', 'o23', 'o24'];
const WOOD_IMAGES = ['o3', 'o4', 'o25', 'o26'];
const SMALL_OBSTACLE_IMAGES = ['o1', 'o2', 'o19', 'o20', 'o21'];
const FENCE_IMAGE = 'o5';

export const BattleGrid = () => {
  const playerPos = useCombatGridStore((s) => s.playerPos);
  const enemies = useCombatGridStore((s) => s.enemies);
  const obstacles = useCombatGridStore((s) => s.obstacles);
  const isActive = useCombatGridStore((s) => s.isActive);
  const selectedEnemy = useCombatGridStore((s) => s.selectedEnemy);
  const turn = useCombatGridStore((s) => s.turn);
  const isMoving = useCombatGridStore((s) => s.isMoving);
  const isSelected = useCombatGridStore((s) => s.isSelected);
  const playerRotation = useCombatGridStore((s) => s.playerRotation);
  const isPlayerHit = useCombatGridStore((s) => s.isPlayerHit);
  const isShaking = useCombatGridStore((s) => s.isShaking);
  const reserve = useCombatGridStore((s) => s.reserve);
  const popups = useCombatGridStore((s) => s.popups);
  const shotLine = useCombatGridStore((s) => s.shotLine);
  const flyingGrenade = useCombatGridStore((s) => s.flyingGrenade);
  const globalEffects = useCombatGridStore((s) => s.globalEffects);
  const plannedPath = useCombatGridStore((s) => s.plannedPath);
  const ap = useCombatGridStore((s) => s.ap);
  const cursorPos = useCombatGridStore((s) => s.cursorPos);
  const movePlayer = useCombatGridStore((s) => s.movePlayer);
  const rotatePlayer = useCombatGridStore((s) => s.rotatePlayer);
  const selectEnemy = useCombatGridStore((s) => s.selectEnemy);
  const attackEnemy = useCombatGridStore((s) => s.attackEnemy);
  const setPlannedPath = useCombatGridStore((s) => s.setPlannedPath);
  const lootingEnemy = useCombatGridStore((s) => s.lootingEnemy);
  const canFinish = useMemo(() => {
    return enemies.length > 0 && enemies.every((e) => e.dead) && reserve.length === 0;
  }, [enemies, reserve]);
  const [hoveredDeadId, setHoveredDeadId] = useState<number | string | null>(null);
  const [playerLocating, setPlayerLocating] = useState(false);
  const isSelectedPrev = useRef(false);
  useEffect(() => {
    if (isSelected && !isSelectedPrev.current) {
      setPlayerLocating(true);
      setTimeout(() => setPlayerLocating(false), 800);
    }
    isSelectedPrev.current = isSelected;
  }, [isSelected]);
  const setLootingEnemy = (e: GridEnemy | null) => useCombatGridStore.setState({ lootingEnemy: e });
  const lootEnemy = useCombatGridStore((s) => s.lootEnemy);
  const closeLoot = useCombatGridStore((s) => s.closeLoot);
  const setLooted = useCombatGridStore((s) => s.setLooted);
  const setEnemyLootById = useCombatGridStore((s) => s.setEnemyLootById);
  const { playSound } = useSound();
  const gridRef = useRef<HTMLDivElement>(null);
  const isRightMouseDown = useRef(false);

  useEnemyAI();

  // -- Sound effects --
  const prevShotLine = useRef<typeof shotLine>(null);
  const prevPlayerHit = useRef(false);
  const prevPopupsLen = useRef(popups.length);
  const prevEnemiesDead = useRef<Set<number | string>>(new Set());

  useEffect(() => {
    if (shotLine && !prevShotLine.current) {
      playSound(Math.random() > 0.5 ? 'shot1' : 'shot2');
    }
    prevShotLine.current = shotLine;
  }, [shotLine, playSound]);

  useEffect(() => {
    if (isPlayerHit && !prevPlayerHit.current) playSound('block');
    prevPlayerHit.current = isPlayerHit;
  }, [isPlayerHit, playSound]);

  useEffect(() => {
    if (popups.length > prevPopupsLen.current && popups.length > 0) {
      const last = popups[popups.length - 1];
      if (last.type === 'CRIT') playSound('crit');
      else if (last.type === 'EVASION') playSound('evasion');
      else if (last.type === 'BLOCK') playSound('block');
    }
    prevPopupsLen.current = popups.length;
  }, [popups, playSound]);

  // Death sounds — when an enemy dies, play its soundAttack + optional death sound
  useEffect(() => {
    for (const e of enemies) {
      if (e.dead && !prevEnemiesDead.current.has(e.id)) {
        prevEnemiesDead.current.add(e.id);
        if (e.soundAttack) playSound(e.soundAttack);
        const screamIdx = Math.floor(Math.random() * 5) + 1;
        playSound(`wilhelm_scream${screamIdx}`);
        playSound('chips');
      }
    }
    // Clear set when combat ends
    if (!isActive) prevEnemiesDead.current = new Set();
  }, [enemies, isActive, playSound]);

  // -- Helpers --
  const isPlayerInWoods = useMemo(() => {
    return obstacles.some(o => o.type === 'woods' && o.isWalkable && playerPos.x >= o.x && playerPos.x < o.x + o.w && playerPos.y >= o.y && playerPos.y < o.y + o.h);
  }, [obstacles, playerPos]);

  const isNightTime = useCombatGridStore((s) => s.isNightTime);
  const playerXpct = (playerPos.x / 31) * 100;
  const playerYpct = (playerPos.y / 31) * 100;

  // -- Per-cell visibility check (like original) --
  const isCellVisible = useCallback((x: number, y: number) => {
    return checkVisibility(playerPos, playerRotation, { x, y }, obstacles);
  }, [playerPos, playerRotation, obstacles]);

  // -- Hover state for crosshair --
  const hoveredEnemy = useMemo(() => {
    if (!cursorPos) return null;
    return enemies.find((e) => !e.dead && e.pos.x === cursorPos.x && e.pos.y === cursorPos.y) || null;
  }, [cursorPos, enemies]);

  // -- In-range cells glow --
  const inRangeCells = useMemo(() => {
    if (turn !== 'player') return new Set<string>();
    const range = 10;
    const set = new Set<string>();
    const minX = Math.max(0, playerPos.x - range);
    const maxX = Math.min(GRID_SIZE - 1, playerPos.x + range);
    const minY = Math.max(0, playerPos.y - range);
    const maxY = Math.min(GRID_SIZE - 1, playerPos.y + range);
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        if (Math.sqrt((x - playerPos.x) ** 2 + (y - playerPos.y) ** 2) <= range) {
          set.add(`${x},${y}`);
        }
      }
    }
    return set;
  }, [turn, playerPos]);

  // -- Waypoint markers on path --
  const waypointMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!plannedPath || plannedPath.length === 0) return map;
    for (let i = 1; i < plannedPath.length; i++) {
      const p = plannedPath[i];
      if (i > ap) continue;
      map.set(`${p.x},${p.y}`, i);
    }
    return map;
  }, [plannedPath, ap]);

  const plannedPathWithInvalid = useMemo(() => {
    return plannedPath.map((p, index) => ({
      ...p,
      isInvalid: index > ap,
    }));
  }, [plannedPath, ap]);

  const handleCellClick = useCallback((x: number, y: number) => {
    if (turn !== 'player' || isMoving) return;
    const enemy = enemies.find((e) => !e.dead && e.currentHp > 0 && e.pos.x === x && e.pos.y === y);
    if (enemy) {
      selectEnemy(enemy.id);
      attackEnemy(enemy.id);
      return;
    }
    // Combined loot from multiple corpses on same cell
    const deadOnCell = enemies.filter((e) => e.dead && e.loot && e.loot.length > 0 && e.pos.x === x && e.pos.y === y);
    // Must be within 1 cell to loot (like original)
    if (deadOnCell.length > 0) {
      const lootDist = getDist(playerPos, { x, y });
      if (lootDist > 1) {
        useCombatGridStore.getState().addMessage('❌ Слишком далеко, чтобы обыскать');
        return;
      }
    }
    if (deadOnCell.length > 0) {
      if (deadOnCell.length === 1) {
        setLootingEnemy(deadOnCell[0]);
      } else {
        const combinedLoot = deadOnCell.flatMap((e) => e.loot.map((item) => ({ ...item, parentEnemyId: e.id })));
        setLootingEnemy({
          id: 'combined-loot',
          name: 'Обыск тел',
          faction: '',
          currentHp: 0, maxHp: 0, damage: 0, dps: 0, armor: 0,
          accuracy: 0, evasion: 0, block: 0, punching: 0, vampir: 0,
          crit: 0, regen: 0, pos: { x, y }, isHit: false, dead: true,
          runAp: 0, rotation: 0, rangeDistance: 0, shotPrice: 0,
          skillUse: [], cooldowns: {}, isInvisible: false,
          invisTurns: 0, baseEvasion: 0, isEnraged: false,
          rageTurns: 0, hasSummoned: false, bigModel: '100%',
          isSpinning: false, loot: combinedLoot, looted: false,
        } as GridEnemy);
      }
      return;
    }
    if (isSelected) movePlayer(x, y);
  }, [turn, isMoving, enemies, isSelected, selectEnemy, attackEnemy, movePlayer, playerPos]);

  const handleCellHover = useCallback((x: number, y: number) => {
    useCombatGridStore.setState({ cursorPos: { x, y } });
  }, []);

  const lastHoverRef = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const state = useCombatGridStore.getState();
    if (!state.isSelected || state.isMoving || state.turn !== 'player' || state.ap <= 0) return;
    const cp = state.cursorPos;
    if (!cp || (lastHoverRef.current?.x === cp.x && lastHoverRef.current?.y === cp.y)) return;
    lastHoverRef.current = cp;
    const path = state.findPath(state.playerPos, cp);
    if (path && path.length > 0) {
      setPlannedPath(path);
    } else {
      setPlannedPath([]);
    }
  }, [isSelected, isMoving, turn, ap]);

  const enemyMap = useMemo(() => {
    const map = new Map<string, GridEnemy>();
    for (const e of enemies) {
      if (!e.dead) map.set(`${e.pos.x},${e.pos.y}`, e);
    }
    return map;
  }, [enemies]);

  const deadEnemyMap = useMemo(() => {
    const map = new Map<string, GridEnemy>();
    for (const e of enemies) {
      if (e.dead) map.set(`${e.pos.x},${e.pos.y}`, e);
    }
    return map;
  }, [enemies]);

  const obstacleTileMap = useMemo(() => {
    const map = new Map<string, { icon: string; isAnchor: boolean; imgIndex?: number }>();
    for (const ob of obstacles) {
      for (let dx = 0; dx < ob.w; dx++) {
        for (let dy = 0; dy < ob.h; dy++) {
          const isAnchor = dx === 0 && dy === 0;
          map.set(`${ob.x + dx},${ob.y + dy}`, { icon: ob.icon, isAnchor, imgIndex: ob.imgIndex });
        }
      }
    }
    return map;
  }, [obstacles]);

  if (!isActive) return null;

  return (
    <div className={`${styles.container}${isShaking ? ` ${styles.arenaShake}` : ''}`}>
      <div className={styles.battleScreen} ref={gridRef} style={{ backgroundImage: `url(${images.mapBattle})` }}>
        {isNightTime && (
          <div className={styles.fogCanvas} style={{
            background: `radial-gradient(circle 202px at ${playerXpct}% ${playerYpct}%, transparent 0%, rgba(0,10,0,0.7) 60%, rgba(0,0,0,0.9) 120%)`,
          }} />
        )}

        {/* Darken background to hide map grid lines */}
        <div className={styles.bgDarken} />

        <div className={styles.gridOverlay}
          onContextMenu={(e) => e.preventDefault()}
          onMouseDown={(e) => { if (e.button === 2) isRightMouseDown.current = true; }}
          onMouseUp={(e) => { if (e.button === 2) isRightMouseDown.current = false; }}
          onMouseLeave={() => { lastHoverRef.current = null; setPlannedPath([]); isRightMouseDown.current = false; }}
        >
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
            const x = i % GRID_SIZE;
            const y = Math.floor(i / GRID_SIZE);
            const isPlayer = playerPos.x === x && playerPos.y === y;
            const enemy = enemyMap.get(`${x},${y}`);
            const deadEnemy = deadEnemyMap.get(`${x},${y}`);
            const obstacle = obstacleTileMap.get(`${x},${y}`);
            const isSel = selectedEnemy !== null && enemy?.id === selectedEnemy;
            const pathPoint = plannedPathWithInvalid.find((p) => p.x === x && p.y === y);
            const waypointNum = waypointMap.get(`${x},${y}`);
            const isInRange = inRangeCells.has(`${x},${y}`);
            const hovered = hoveredEnemy && enemy?.id === hoveredEnemy.id;
            const visible = isCellVisible(x, y);

            return (
              <div
                key={i}
                className={`${styles.cell}${isSel ? ` ${styles.cellActive}` : ''}${pathPoint ? ` ${styles.pathActive}` : ''}${obstacle ? ` ${styles.obstacleCell}` : ''}${isPlayer ? ` ${styles.playerCell}` : ''}${isInRange && turn === 'player' ? ` ${styles.inRange}` : ''}${hovered ? ` ${styles.cellCrosshair}` : ''}`}
                onClick={() => handleCellClick(x, y)}
                onContextMenu={(e) => e.preventDefault()}
                onMouseEnter={() => {
                  handleCellHover(x, y);
                  if (isRightMouseDown.current) rotatePlayer(x, y);
                }}
                data-invalid={pathPoint?.isInvalid ? 'true' : 'false'}
              >
                {obstacle?.isAnchor && (
                  <img
                    src={getBattleImage(
                      obstacle.icon === 'building' ? BIG_BUILDING_IMAGES[obstacle.imgIndex ?? 0] :
                      obstacle.icon === 'car' ? CAR_IMAGES[obstacle.imgIndex ?? 0] :
                      obstacle.icon === 'woods' ? WOOD_IMAGES[obstacle.imgIndex ?? 0] :
                      obstacle.icon === 'small' ? SMALL_OBSTACLE_IMAGES[obstacle.imgIndex ?? 0] :
                      obstacle.icon === 'fence' ? FENCE_IMAGE :
                      'o1'
                    )}
                    alt=""
                    className={`${styles.obstacleImg} ${obstacle.icon === 'building' ? styles.obstacleBigImg : obstacle.icon === 'car' ? styles.obstacleCarImg : obstacle.icon === 'woods' ? styles.obstacleWoodsImg : styles.obstacleSmallImg}`}
                    draggable={false}
                  />
                )}
                {waypointNum && !isPlayer && !enemy && (
                  <div className={styles.waypointDot}>{waypointNum}</div>
                )}

                {/* Dead enemy with loot */}
                {deadEnemy && (
                  <div className={styles.unit} style={{ zIndex: 1, cursor: 'help' }}
                    onClick={() => handleCellClick(x, y)}
                    onMouseEnter={() => setHoveredDeadId(deadEnemy.id)}
                    onMouseLeave={() => setHoveredDeadId(null)}
                  >
                    <img
                      src={getCharacterImage(deadEnemy.deadModel || 'dead')}
                      alt="dead"
                      className={`${styles.deadSprite}${hoveredDeadId === deadEnemy.id ? ` ${styles.deadHovered}` : ''}`}
                      draggable={false}
                    />
                  </div>
                )}

                {/* Player */}
                {isPlayer && (
                  <div className={`${styles.unit} ${styles.player}${isPlayerInWoods ? ` ${styles.inWoods}` : ''}${playerLocating ? ` ${styles.locating}` : ''}`} style={{ zIndex: 10 }}>
                    <img src={images.hero} alt="hero" className={styles.playerSprite} draggable={false} style={{ transform: `rotate(${playerRotation - 90}deg)` }} />
                  </div>
                )}

                {/* Living Enemy */}
                {enemy && (
                  <div
                    className={`${styles.unit} ${styles.enemy}${isSel ? ` ${styles.selected}` : ''}${enemy.isInvisible ? ` ${styles.invisible}` : ''}${hovered ? ` ${styles.enemyCrosshair}` : ''}${isInRange ? ` ${styles.inRangeEnemy}` : ''}`}
                    style={{ borderColor: ENEMY_COLORS[enemy.faction] || '#a1a1aa', width: enemy.bigModel || '100%', height: enemy.bigModel || '100%', zIndex: 5 }}
                  >
                    {enemy.isEnraged && <div className={styles.enemyStatusBadge}>💢</div>}
                    {enemy.isInvisible && <div className={styles.enemyStatusBadge}>👤</div>}
                    {isSel && <div className={styles.crosshairCircle} />}
                    <img
                      src={getEnemyImage(enemy.faction, enemy.name)}
                      alt={enemy.name}
                      className={`${styles.humanSprite}${enemy.isSpinning ? ` ${styles.meleeSpin}` : ''}${enemy.isEnraged ? ` ${styles.enraged}` : ''}`}
                      draggable={false}
                      style={{ transform: `rotate(${enemy.rotation - 90}deg)` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Hit flash overlay */}
        {isPlayerHit && <div className={styles.hitFlash} />}

        {/* Global fog overlay (above all cells, prevents obstacle overflow) */}
        <div className={styles.globalFog}>
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
            const fx = i % GRID_SIZE;
            const fy = Math.floor(i / GRID_SIZE);
            if (!isCellVisible(fx, fy)) {
              return <div key={`fog-${i}`} className={styles.fogCell} style={{ left: `${(fx / (GRID_SIZE - 1)) * 100}%`, top: `${(fy / (GRID_SIZE - 1)) * 100}%` }} />;
            }
            return null;
          })}
        </div>

        {/* Shot tracer */}
        {shotLine && (
          <svg className={styles.shotSvg}>
            <line
              x1={`${(shotLine.from.x / 31) * 100}%`}
              y1={`${(shotLine.from.y / 31) * 100}%`}
              x2={`${(shotLine.to.x / 31) * 100}%`}
              y2={`${(shotLine.to.y / 31) * 100}%`}
              className={`${styles.tracerLine}${shotLine.type === 'aim' ? ` ${styles.aimShot}` : ''}`}
            />
          </svg>
        )}

        {/* Flying grenade — animated trajectory from→to */}
        {flyingGrenade && (
          <div className={styles.grenadeFly} style={{
            left: `${(flyingGrenade.from.x / 31) * 100}%`,
            top: `${(flyingGrenade.from.y / 31) * 100}%`,
            transition: 'left 0.7s cubic-bezier(0.25, 1, 0.5, 1), top 0.7s cubic-bezier(0.25, 1, 0.5, 1)',
          }}>
            <div style={{
              position: 'absolute',
              left: 0, top: 0,
              transform: `translate(${((flyingGrenade.to.x - flyingGrenade.from.x) / 31) * 100}%, ${((flyingGrenade.to.y - flyingGrenade.from.y) / 31) * 100}%)`,
              transition: 'transform 0.7s cubic-bezier(0.25, 1, 0.5, 1)',
            }}>
              💣
            </div>
          </div>
        )}

        {/* Grenade explosion VFX */}
        {globalEffects.filter(e => e.type === 'GRENADE').map((eff, i) => (
          <div key={`explosion-${i}`} className={styles.explosionFx} style={{
            left: `${(eff.pos.x / 31) * 100}%`,
            top: `${(eff.pos.y / 31) * 100}%`,
          }}>
            <div className={styles.explosionRing} />
            <div className={styles.explosionFlash} />
          </div>
        ))}

        {/* Global effects */}
        {globalEffects.map((eff, i) => (
          <div key={i} className={`${styles.dangerZone} ${eff.type === 'REDZONE' ? styles.redZonePulse : styles.grenadeZone}`} style={{
            left: `${(eff.pos.x / 31) * 100}%`,
            top: `${(eff.pos.y / 31) * 100}%`,
          }}>
            {eff.type === 'REDZONE' && <div className={styles.dangerLabel}>☢️</div>}
          </div>
        ))}

        {/* Battle popups — offset vertically to avoid stacking */}
        {(() => {
          const posCount = new Map<string, number>();
          return popups.map((pop) => {
            const key = `${Math.round(pop.x)},${Math.round(pop.y)}`;
            const count = posCount.get(key) || 0;
            posCount.set(key, count + 1);
            return (
              <div key={pop.id} className={`${styles.battlePopup} ${styles[pop.type.toLowerCase()] || styles.normal}`} style={{
                left: `${(pop.x / 31) * 100}%`,
                top: `calc(${(pop.y / 31) * 100}% + ${count * -24}px)`,
              }}>
                {pop.text}
              </div>
            );
          });
        })()}



        {/* Finish button (when all dead, no reserve) */}
        {canFinish && (
          <div className={styles.finishBtn} onClick={() => {
            useCombatGridStore.getState().finishBattle();
          }}>
            🏁 ЗАВЕРШИТЬ ВЫЛАЗКУ
          </div>
        )}

        {/* Loot window */}
        {lootingEnemy && (
          <div className={styles.lootOverlay} onClick={closeLoot}>
            <div className={styles.lootWindow} onClick={(e) => e.stopPropagation()}>
              <div className={styles.lootHeader}>📦 {lootingEnemy.name} — лут</div>
              {lootingEnemy.loot.length === 0 ? (
                <div className={styles.lootEmpty}>Пусто</div>
              ) : (
                lootingEnemy.loot.map((item: any, idx: number) => (
                  <div key={item.id || idx} className={styles.lootRow} onClick={() => {
                    const realEnemyId = item.parentEnemyId ?? lootingEnemy.id;
                    useInventoryStore.getState().addItem(item);
                    setEnemyLootById(realEnemyId, item.id);
                    setLooted(realEnemyId);
                    // Update the local looting window state
                    setLootingEnemy({
                      ...lootingEnemy,
                      loot: lootingEnemy.loot.filter((_: any, i: number) => i !== idx),
                    });
                    if (!(lootingEnemy.loot.length > 1)) closeLoot();
                  }}>
                    <span className={styles.lootName} style={{ color: item.qualityColor || '#fff' }}>
                      {item.displayName || item.name}
                    </span>
                    <span className={styles.lootQty}>{item.quantity > 1 ? `x${item.quantity}` : ''}</span>
                    <button className={styles.lootTakeBtn}>ВЗЯТЬ</button>
                  </div>
                ))
              )}
              <div className={styles.lootCloseBtn} onClick={closeLoot}>ЗАКРЫТЬ</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
