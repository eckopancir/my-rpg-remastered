import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useCombatGridStore, checkVisibility, getDist } from '../../stores/combatGridStore';
import { usePlayerStore } from '../../stores/playerStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useSound } from '../../hooks/useSound';
import { LootBackpackWindow } from './LootBackpackWindow';
import { useUiStore } from '../../stores/uiStore';
import { useEnemyAI } from '../../hooks/useEnemyAI';
import { getEnemyImage, getBattleImage, getCharacterImage, images } from '../../assets/index';
import pricelImg from '../../assets/images/ui/pricel-cursor.png';
import type { GridEnemy } from '../../stores/combatGridStore';
import styles from './BattleGrid.module.css';

const GRID_SIZE = 32;

function offsetShotPoint(from: { x: number; y: number }, to: { x: number; y: number }, dist = 0.4) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.01) return { from, to };
  const nx = dx / len;
  const ny = dy / len;
  return {
    from: { x: from.x + nx * dist, y: from.y + ny * dist },
    to: { x: to.x - nx * dist, y: to.y - ny * dist },
  };
}

const ENEMY_COLORS: Record<string, string> = {
  Мутанты: '#7c3aed',
  Роботы: '#2563eb',
  Бандиты: '#dc2626',
  Военные: '#16a34a',
  Неизвестно: '#a1a1aa',
};

import { BIG_BUILDING_IMAGES, CAR_IMAGES, WOOD_IMAGES, SMALL_OBSTACLE_IMAGES, FENCE_IMAGE, terrainSummary, isCellWalkable } from '../../engine/terrain';

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
  const campfire = useCombatGridStore((s) => s.campfire);
  // Анимация костра: два кадра каждые 100мс.
  const [fireFrame, setFireFrame] = useState(0);
  useEffect(() => {
    if (!isActive || !campfire) return;
    const t = setInterval(() => setFireFrame((f) => (f + 1) % 2), 100);
    return () => clearInterval(t);
  }, [isActive, campfire]);
  const playerInvisible = useCombatGridStore((s) => s.playerInvisible);
  const shieldCharges = usePlayerStore((s) => s.stats.shieldCharges);
  const activeEffects = usePlayerStore((s) => s.activeEffects);
  const isBarrierActive = activeEffects.some((e) => e.statBoostsMult?.incomingDamageMult);
  const isEvasionActive = activeEffects.some((e) => e.statBoosts?.evasion);
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
  const selectedAbility = useCombatGridStore((s) => s.selectedAbility);
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
  const showEnemyHpNumbers = useUiStore((s) => s.showEnemyHpNumbers);
  // Дальность для замера: базовая +3 в защитном режиме (как в attackEnemy).
  const combatRange = useCombatGridStore((s) => s.range);
  const isDefensiveMode = useCombatGridStore((s) => s.isDefensiveMode);
  const effRange = combatRange + (isDefensiveMode ? 3 : 0);
  // Замер дистанции: зажатая ПКМ на враге показывает клеток до него.
  // Начало нажатия на враге — замер (без поворота), иначе — поворот как раньше.
  const [measuring, setMeasuring] = useState<{ x: number; y: number } | null>(null);
  const measureRef = useRef(false);
  useEffect(() => {
    if (!measuring) return;
    const up = () => { setMeasuring(null); measureRef.current = false; };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, [measuring]);
  const gridRef = useRef<HTMLDivElement>(null);
  const fogCanvasRef = useRef<HTMLCanvasElement>(null);
  const isRightMouseDown = useRef(false);
  // Клетка нажатия ПКМ — для инспекции точки при клике без протяжки.
  const rmbDownCell = useRef<{ x: number; y: number } | null>(null);

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

  // -- Woods cells for enemy transparency --
  const woodsCells = useMemo(() => {
    const set = new Set<string>();
    for (const ob of obstacles) {
      if (ob.type === 'woods' && ob.isWalkable) {
        for (let dx = 0; dx < ob.w; dx++) {
          for (let dy = 0; dy < ob.h; dy++) {
            set.add(`${ob.x + dx},${ob.y + dy}`);
          }
        }
      }
    }
    return set;
  }, [obstacles]);

  const isNightTime = useCombatGridStore((s) => s.isNightTime);
  const forceDay = useUiStore((s) => s.forceDay);
  const nightOn = isNightTime && !forceDay;
  const stealth = useCombatGridStore((s) => s.stealth);
  const playerXpct = (playerPos.x / 31) * 100;
  const playerYpct = (playerPos.y / 31) * 100;

  // -- Конус зрения как был (75° по направлению взгляда) + память тумана --
  // Видно: рядом (≤2) или конус checkVisibility. Разведанное копим в сторе
  // и подсвечиваем тускло, невиданное — почти черное (рисует canvas ниже).
  const exploredCells = useCombatGridStore((s) => s.exploredCells);
  // Низкие объекты (машины, леса, мелочь) туману не помеха — только высокие стены.
  const tallObstacles = useMemo(() => obstacles.filter((o) => o.isHigh), [obstacles]);
  const visibleSet = useMemo(() => {
    const set = new Set<string>();
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let y = 0; y < GRID_SIZE; y++) {
        if (getDist(playerPos, { x, y }) <= 2) { set.add(`${x},${y}`); continue; }
        if (checkVisibility(playerPos, playerRotation, { x, y }, tallObstacles)) {
          set.add(`${x},${y}`);
        }
      }
    }
    return set;
  }, [playerPos, playerRotation, tallObstacles]);

  // Разведанное складываем в стор (переживает ре-рендеры, новый бой сбрасывает).
  useEffect(() => {
    if (!isActive || visibleSet.size === 0) return;
    useCombatGridStore.getState().markExplored([...visibleSet]);
  }, [visibleSet, isActive]);

  // Гладкий туман: рисуем 32×32 в canvas, CSS-blur сглаживает пиксельные края.
  // Оттенок холодный синеватый: тёплая земля под чисто чёрным давала грязную
  // желтизну. Видно = прозрачно рядом, дальше — плавная дымка; разведанное =
  // тень памяти; невиданное = почти черное.
  useEffect(() => {
    const cv = fogCanvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(GRID_SIZE, GRID_SIZE);
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const k = `${x},${y}`;
        let a: number;
        if (visibleSet.has(k)) {
          const d = Math.min(1, getDist(playerPos, { x, y }) / 24);
          a = Math.round(40 * Math.pow(d, 1.5));
        } else {
          a = exploredCells[k] ? 120 : 232;
        }
        const idx = (y * GRID_SIZE + x) * 4;
        img.data[idx] = 16; img.data[idx + 1] = 22; img.data[idx + 2] = 38; img.data[idx + 3] = a;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [visibleSet, exploredCells, isActive, playerPos]);

  const isCellVisible = useCallback((x: number, y: number) => {
    return visibleSet.has(`${x},${y}`);
  }, [visibleSet]);

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
    if (useCombatGridStore.getState().isPlacingMine) {
      useCombatGridStore.getState().placeMine(x, y);
      return;
    }
    if (useCombatGridStore.getState().isTeleporting) {
      useCombatGridStore.getState().teleportTo(x, y);
      return;
    }
    const enemy = enemies.find((e) => !e.dead && e.currentHp > 0 && e.pos.x === x && e.pos.y === y);
    if (enemy) {
      const store = useCombatGridStore.getState();
      selectEnemy(enemy.id);
      if (store.selectedAbility !== null) {
        store.useAbility(enemy.id);
      } else {
        attackEnemy(enemy.id);
      }
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
      <div className={styles.battleScreen} ref={gridRef} style={{ backgroundImage: `url(${images.mapBattle})`, marginTop: 30 }}>
        {nightOn && (
          <div className={styles.fogCanvas} style={{
            background: `radial-gradient(circle 202px at ${playerXpct}% ${playerYpct}%, transparent 0%, rgba(0,10,0,0.7) 60%, rgba(0,0,0,0.9) 120%)`,
          }} />
        )}

        {/* Darken background to hide map grid lines */}
        <div className={styles.bgDarken} />

        <div className={styles.gridOverlay}
          onContextMenu={(e) => e.preventDefault()}
          style={{ cursor: `url("${pricelImg}") 12 12, crosshair` }}
          onMouseDown={(e) => { if (e.button === 2) isRightMouseDown.current = true; }}
          onMouseUp={(e) => {
            if (e.button !== 2) return;
            isRightMouseDown.current = false;
            // ПКМ-клик без протяжки — инспекция укрытий точки под курсором.
            const down = rmbDownCell.current;
            rmbDownCell.current = null;
            if (!down) return;
            const cur = useCombatGridStore.getState().cursorPos;
            if (!cur || cur.x !== down.x || cur.y !== down.y) return;
            const st = useCombatGridStore.getState();
            // На клетку встать нельзя — только красная метка, без бонусов.
            if (!isCellWalkable(down.x, down.y, st.obstacles)) {
              st.addPopup(down.x, down.y, '📍 ⛔', 'ERROR');
              st.addMessage(`(${down.x},${down.y}): сюда встать нельзя`);
              return;
            }
            const s = terrainSummary(down, st.obstacles);
            st.addPopup(down.x, down.y, s.text, 'BUFF');
            st.addMessage(s.detail);
          }}
          onMouseLeave={() => { lastHoverRef.current = null; setPlannedPath([]); isRightMouseDown.current = false; rmbDownCell.current = null; }}
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
                onMouseDown={(e) => { if (e.button === 2) rmbDownCell.current = { x, y }; }}
                onMouseEnter={() => {
                  handleCellHover(x, y);
                  if (isRightMouseDown.current && !measureRef.current) rotatePlayer(x, y);
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

                {/* Dead enemy with loot — виден и по памяти (неподвижен) */}
                {deadEnemy && (visible || exploredCells[`${x},${y}`]) && (
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
                  <div className={`${styles.unit} ${styles.player}${isPlayerInWoods ? ` ${styles.inWoods}` : ''}${playerLocating ? ` ${styles.locating}` : ''}${playerInvisible ? ` ${styles.invisible}` : ''}${shieldCharges > 0 ? ` ${styles.shieldActive}` : ''}${isBarrierActive ? ` ${styles.barrierActive}` : ''}${isEvasionActive ? ` ${styles.evasionActive}` : ''}`} style={{ zIndex: 10 }}>
                      <img src={images.hero} alt="hero" className={styles.playerSprite} draggable={false} style={{ transform: `rotate(${playerRotation - 90}deg)`, opacity: stealth ? 0.5 : 1 }} />
                  </div>
                )}

                {/* Living Enemy — только в прямом обзоре (по памяти позиции не палим) */}
                {enemy && visible && (
                  <div
                    className={`${styles.unit} ${styles.enemy}${isSel ? ` ${styles.selected}` : ''}${enemy.isInvisible ? ` ${styles.invisible}` : ''}${woodsCells.has(`${x},${y}`) ? ` ${styles.inWoods}` : ''}${hovered ? ` ${styles.enemyCrosshair}` : ''}${isInRange ? ` ${styles.inRangeEnemy}` : ''}`}
                    style={{ borderColor: ENEMY_COLORS[enemy.faction] || '#a1a1aa', width: enemy.bigModel || '100%', height: enemy.bigModel || '100%', zIndex: 5 }}
                    onMouseDown={(e) => { if (e.button === 2) { measureRef.current = true; setMeasuring({ x, y }); } }}
                  >
                    {enemy.isEnraged && <div className={styles.enemyStatusBadge}>💢</div>}
                    {enemy.isInvisible && <div className={styles.enemyStatusBadge}>👤</div>}
                    {isSel && <div className={styles.crosshairCircle} />}
                    {showEnemyHpNumbers && (
                      <div style={{
                        position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)',
                        fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, whiteSpace: 'nowrap',
                        color: '#fff', background: 'rgba(0,0,0,0.65)', padding: '0 5px', borderRadius: 4,
                        border: '1px solid rgba(255,255,255,0.2)', zIndex: 6, pointerEvents: 'none',
                      }}>
                        {Math.max(0, Math.round(enemy.currentHp))}/{Math.round(enemy.maxHp)}
                      </div>
                    )}
                    {/* Замер: зажатая ЛКМ — клеток до цели (зелёный = в дальности стрельбы) */}
                    {measuring && measuring.x === x && measuring.y === y && (() => {
                      const d = getDist(playerPos, { x, y });
                      const inRange = d <= effRange;
                      return (
                        <div style={{
                          position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)',
                          fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, whiteSpace: 'nowrap',
                          color: inRange ? '#4ade80' : '#f87171', background: 'rgba(0,0,0,0.75)', padding: '0 5px',
                          borderRadius: 4, border: `1px solid ${inRange ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.4)'}`,
                          zIndex: 7, pointerEvents: 'none',
                        }}>
                          {Number(d.toFixed(1))}
                        </div>
                      );
                    })()}

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
          <canvas
            ref={fogCanvasRef}
            width={GRID_SIZE}
            height={GRID_SIZE}
            style={{ width: '100%', height: '100%', filter: 'blur(6px)', transform: 'scale(1.04)' }}
          />
        </div>

        {/* Костёр лагеря — виден всегда (свет видно издалека), кадры 300мс */}
        {campfire && (images.campfire1 || images.campfire2) && (
          <div style={{
            position: 'absolute',
            left: `${(campfire.x / 31) * 100}%`,
            top: `${(campfire.y / 31) * 100}%`,
            transform: 'translate(-50%, -62%)',
            width: '6.25%', aspectRatio: '1',
            zIndex: 3, pointerEvents: 'none',
          }}>
            <img
              src={fireFrame === 0 ? (images.campfire1 || images.campfire2) : (images.campfire2 || images.campfire1)}
              alt="campfire"
              draggable={false}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
        )}

        {/* Реплики и статусы — верхний слой: поверх тумана, костра и всех объектов */}
        {enemies.map((e) => {
          if (e.dead || !isCellVisible(e.pos.x, e.pos.y)) return null;
          const left = `${(e.pos.x / 31) * 100}%`;
          const top = `${(e.pos.y / 31) * 100}%`;
          const d = Math.hypot(e.pos.x - playerPos.x, e.pos.y - playerPos.y);
          const susR = e.aiRole === 'sentry' ? 8 : 5;
          const detR = stealth ? (e.aiRole === 'sentry' ? 6 : 3) : 24;
          const showQ = !e.aggro && !e.sleeping && e.faction !== 'Союзник' && d <= susR && d > detR;
          // Часовой всегда с белым «!» — его метка.
          const showExcl = e.aiRole === 'sentry';
          if (!e.speech && !e.sleeping && !showQ && !showExcl) return null;
          // Маркеры стопкой вверх (диалоги могут их перекрывать — так задумано).
          const exclB = 34;
          const zzzB = 34 + (showExcl ? 30 : 0);
          const qB = 34 + (showExcl ? 30 : 0) + (e.sleeping ? 30 : 0);
          return (
            <div key={`estate-${e.id}`} style={{ position: 'absolute', left, top, width: 0, height: 0, zIndex: 60, pointerEvents: 'none' }}>
              {e.speech && (
                <div style={{
                  position: 'absolute', bottom: 10, left: 0, transform: 'translateX(-50%)',
                  maxWidth: 150, minWidth: 40,
                  background: '#f5f1e6', color: '#1a1a1a', fontSize: 10, lineHeight: 1.25,
                  padding: '4px 8px', borderRadius: 9, border: '1px solid #8a8a8a',
                  textAlign: 'center', whiteSpace: 'normal',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                }}>
                  {e.speech}
                </div>
              )}
              {showExcl && (
                <div title="Часовой" style={{
                  position: 'absolute', bottom: exclB, left: 0, transform: 'translateX(-50%)',
                  background: '#f5f1e6', color: '#111', fontSize: 12, fontWeight: 800,
                  padding: '1px 8px', borderRadius: 10, border: '1px solid #8a8a8a',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                }}>
                  !
                </div>
              )}
              {e.sleeping && (
                <div className={styles.zzzBubble} style={{ bottom: zzzB }}>
                  💤 z z z
                </div>
              )}
              {showQ && (
                <div style={{
                  position: 'absolute', bottom: qB, left: 0, transform: 'translateX(-50%)',
                  background: '#f5f1e6', color: '#111', fontSize: 13, fontWeight: 800,
                  padding: '1px 8px', borderRadius: 10, border: '1px solid #8a8a8a',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                }}>
                  ?
                </div>
              )}
            </div>
          );
        })}

        {/* Shot tracer */}
        {shotLine && (() => {
          const p = offsetShotPoint(shotLine.from, shotLine.to, 0.4);
          return (
            <svg className={styles.shotSvg}>
              <line
                x1={`${(p.from.x / 31) * 100}%`}
                y1={`${(p.from.y / 31) * 100}%`}
                x2={`${(p.to.x / 31) * 100}%`}
                y2={`${(p.to.y / 31) * 100}%`}
                className={`${styles.tracerLine}${shotLine.type === 'aim' ? ` ${styles.aimShot}` : ''}${shotLine.type === 'bazooka' ? ` ${styles.bazookaShot}` : ''}${shotLine.type === 'heal' ? ` ${styles.healShot}` : ''}`}
              />
            </svg>
          );
        })()}

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
        {globalEffects.map((eff, i) => {
          if (eff.type === 'TELEPORT_LAND') {
            return (
              <div
                key={i}
                className={styles.teleportLand}
                style={{
                  left: `${(eff.pos.x / 31) * 100}%`,
                  top: `${(eff.pos.y / 31) * 100}%`,
                }}
              >
                <div className={styles.teleportWave} />
              </div>
            );
          }
          if (eff.type === 'MINE') {
            return (
              <div
                key={i}
                className={styles.mine}
                style={{
                  left: `${(eff.pos.x / 31) * 100}%`,
                  top: `${(eff.pos.y / 31) * 100}%`,
                }}
              />
            );
          }
          return (
            <div
              key={i}
              className={`${styles.dangerZone} ${eff.type === 'REDZONE' ? styles.redZonePulse : styles.grenadeZone}`}
              style={{
                left: `${(eff.pos.x / 31) * 100}%`,
                top: `${(eff.pos.y / 31) * 100}%`,
              }}
            >
              {eff.type === 'REDZONE' && <div className={styles.dangerLabel}>☢️</div>}
            </div>
          );
        })}

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

        {/* Loot window — рюкзак трупа (6 слотов) <-> рюкзак игрока */}
        {lootingEnemy && (
          <LootBackpackWindow
            enemyId={lootingEnemy.id}
            onClose={closeLoot}
          />
        )}
      </div>
    </div>
  );
};
