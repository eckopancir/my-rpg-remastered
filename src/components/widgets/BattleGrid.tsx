import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useCombatGridStore, checkVisibility, getDist, isBossEnemy, popupLifeMs } from '../../stores/combatGridStore';
import { useMapEditorStore, editorCellClick, clampFootprint, footprintValid, campCellFree, paintDecal, finishZoneRect, LIGHT_LEVELS, FONAR_LIGHT } from '../../stores/mapEditorStore';
import { DecalLayer } from './DecalLayer';
import { usePlayerStore } from '../../stores/playerStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { playCombatSound } from '../../hooks/useSound';
import { RainOverlay } from './RainOverlay';
import { CrowFlight } from './CrowFlight';
import { AmbienceOverlay } from './AmbienceOverlay';
import { BirdFlock } from './BirdFlock';
import { LootBackpackWindow } from './LootBackpackWindow';
import { useUiStore } from '../../stores/uiStore';
import { useEnemyAI } from '../../hooks/useEnemyAI';
import { getEnemyImage, getBattleImage, getCharacterImage, getMapImage, images, petStrikeImage, meleeStrikeImage, petModelImage, petCorpseImage, campfireFrames, fieldFrames } from '../../assets/index';
import { pickPhrase, STALKER_THANKS } from '../../data/enemyChatter';
import { weaponRangeProfile } from '../../data/ammo';
import { type PetKind } from '../../data/pets';
import { ShotVolley } from './ShotVolley';
import pricelImg from '../../assets/images/ui/pricel-cursor.png';
import type { GridEnemy } from '../../stores/combatGridStore';
import styles from './BattleGrid.module.css';

const GRID_SIZE = 32;

/**
 * Ночная темнота с дырками света: игрок + лампы/фонари открывают местность,
 * как днём — без жёлтых засветов. Один canvas: заливаем темноту и вырезаем
 * (destination-out) круги с мягким краем. Перерисовка только при изменениях.
 */
const NightDarkness = () => {
  const isNightTime = useCombatGridStore((s) => s.isNightTime);
  const forceDay = useUiStore((s) => s.forceDay);
  const ref = useRef<HTMLCanvasElement>(null);
  const nightOn = isNightTime && !forceDay;

  useEffect(() => {
    if (!nightOn) return;
    const cv = ref.current;
    const parent = cv?.parentElement;
    if (!cv || !parent) return;
    let raf = 0;
    const render = (now: number) => {
      raf = requestAnimationFrame(render);
      if (document.hidden) return;
      const st = useCombatGridStore.getState();
      const W = parent.clientWidth || 800;
      const H = parent.clientHeight || 800;
      if (cv.width !== W || cv.height !== H) {
        cv.width = W;
        cv.height = H;
      }
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      const t = now / 1000;
      const playerPos = st.playerPos;
      const obstacles = (st as any).obstacles || [];
      const exploredCells = (st as any).exploredCells;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(2,10,4,0.84)';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'destination-out';
      const hole = (cxC: number, cyC: number, rPx: number) => {
        const cx = (cxC / GRID_SIZE) * W;
        const cy = (cyC / GRID_SIZE) * H;
        const R = Math.max(4, rPx);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(0.55, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fill();
      };
      // Широкий конус прожектора (100°): веер из 24 ломтиков с косинусным
      // профилем — гладко, как ночное зрение, без видимых переходов.
      const cone = (axC: number, ayC: number, angRad: number, lenPx: number, halfRad: number) => {
        const ax = (axC / GRID_SIZE) * W;
        const ay = (ayC / GRID_SIZE) * H;
        const N = 24;
        const ex0 = Math.cos(angRad);
        const ey0 = Math.sin(angRad);
        for (let i = 0; i < N; i++) {
          const f0 = i / N;
          const f1 = (i + 1) / N;
          const a0 = angRad - halfRad + f0 * 2 * halfRad;
          const a1 = angRad - halfRad + f1 * 2 * halfRad;
          const prof = Math.pow(Math.cos((((f0 + f1) / 2) - 0.5) * Math.PI), 1.5);
          if (prof <= 0.01) continue;
          const g = ctx.createLinearGradient(ax, ay, ax + ex0 * lenPx, ay + ey0 * lenPx);
          g.addColorStop(0, `rgba(0,0,0,${(0.55 * prof).toFixed(3)})`);
          g.addColorStop(0.65, `rgba(0,0,0,${(0.4 * prof).toFixed(3)})`);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(ax + Math.cos(a0) * lenPx, ay + Math.sin(a0) * lenPx);
          ctx.lineTo(ax + Math.cos(a1) * lenPx, ay + Math.sin(a1) * lenPx);
          ctx.closePath();
          ctx.fill();
        }
      };
      // Круг героя.
      hole(playerPos.x + 0.5, playerPos.y + 0.5, 202);
      const px = Math.min(W, H) / GRID_SIZE;
      const seen = (x: number, y: number) => {
        if (!exploredCells) return true;
        return !!(exploredCells as any)[`${x},${y}`];
      };
      for (const o of obstacles as any[]) {
        if (!seen(o.x, o.y)) continue;
        const key = o.imgKey as string | undefined;
        if (o.icon === 'light' && key && (LIGHT_LEVELS as any)[key]) {
          const L = (LIGHT_LEVELS as any)[key];
          hole(o.x + (o.w ?? 1) / 2, o.y + (o.h ?? 1) / 2, L.r * 1.3 * px);
        } else if (key === 'fonar') {
          // Прожектор: луч 100° качается ±45° от базового направления (Z), медленно.
          // Фаза от позиции — разные прожекторы не синхронны.
          // Моделька доворачивается за лучом напрямую через DOM (без шторма ре-рендеров).
          const base = ((o.rot || 0) % 360) * (Math.PI / 180);
          const ox = o.x + (o.w ?? 1) / 2;
          const oy = o.y + (o.h ?? 1) / 2;
          const ang = base + (Math.PI / 4) * Math.sin(((t * 2 * Math.PI) / 30) + ox + oy);
          cone(
            ox + Math.cos(ang) * 0.4, oy + Math.sin(ang) * 0.4,
            ang, FONAR_LIGHT.rNight * 1.3 * px, (50 * Math.PI) / 180,
          );
          const el = parent.querySelector(`[data-fonar="${o.id}"]`) as HTMLElement | null;
          if (el) el.style.transform = `rotate(${(ang * 180) / Math.PI}deg)`;
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    };
    raf = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(raf);
      // Ночь кончилась — вернуть модельки в базовый разворот.
      try {
        parent.querySelectorAll('[data-fonar]').forEach((el) => {
          const base = (el as HTMLElement).dataset.fonarBase || '0';
          (el as HTMLElement).style.transform = `rotate(${base}deg)`;
        });
      } catch { /* ignore */ }
    };
  }, [nightOn]);

  if (!nightOn) return null;
  return <canvas ref={ref} className={styles.fogCanvas} style={{ width: '100%', height: '100%' }} />;
};

/**
 * Стиль картинки препятствия с честным разворотом.
 * При 90/270 бокс транспонируется и центрируется на футпринт,
 * затем крутится вокруг центра — арт ложится ровно на клетки.
 * wBoost — уширение (машины +25% в ширину).
 */
const obstacleImgStyle = (w: number, h: number, rot: number, wBoost = 1): React.CSSProperties => {
  const bw = w * wBoost;
  const bh = h;
  const swap = ((rot % 180) + 180) % 180 !== 0;
  const ew = swap ? bh : bw;
  const eh = swap ? bw : bh;
  return {
    width: `${ew * 100}%`,
    height: `${eh * 100}%`,
    left: `${(w - ew) * 50}%`,
    top: `${(h - eh) * 50}%`,
    ...(rot ? { transform: `rotate(${rot}deg)`, transformOrigin: 'center' } : null),
  };
};
/** Центр клетки -> % арены (юниты рисуются по центрам клеток). */
const cellPct = (c: number): number => ((c + 0.5) / GRID_SIZE) * 100;

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
  Союзник: '#22d3ee',
  Нейтралы: '#9ca3af',
  Неизвестно: '#a1a1aa',
};

/** Искра попадания: картинка на клетке цели, гаснет сама (key = id для повторов). */
const PetHitSpark = () => {
  const hitFx = useCombatGridStore((s) => s.hitFx);
  if (!hitFx) return null;
  const src = hitFx.kind === 'melee' ? meleeStrikeImage() : petStrikeImage();
  if (!src) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 41 }}>
      <div style={{ position: 'absolute', left: `${cellPct(hitFx.x)}%`, top: `${cellPct(hitFx.y)}%`, width: 0, height: 0 }}>
        <img
          key={hitFx.id}
          src={src}
          alt=""
          draggable={false}
          className={styles.petHitPop}
          style={{ width: 45, height: 45, objectFit: 'contain', transform: 'translate(-50%,-50%)' }}
        />
      </div>
    </div>
  );
};

import { BIG_BUILDING_IMAGES, CAR_IMAGES, WOOD_IMAGES, SMALL_OBSTACLE_IMAGES, FENCE_IMAGE, FIELD_IMAGE, terrainSummary, isCellWalkable } from '../../engine/terrain';

export const BattleGrid = () => {
  const playerPos = useCombatGridStore((s) => s.playerPos);
  const enemies = useCombatGridStore((s) => s.enemies);
  const obstacles = useCombatGridStore((s) => s.obstacles);
  const isActive = useCombatGridStore((s) => s.isActive);
  const edActive = useMapEditorStore((s) => s.active);
  const edSelObId = useMapEditorStore((s) => s.selObId);
  const edSelUnitId = useMapEditorStore((s) => s.selUnitId);
  const edTool = useMapEditorStore((s) => s.tool);
  const edHover = useMapEditorStore((s) => s.hover);
  const edBehavior = useMapEditorStore((s) => s.behavior);
  const edSelCamp = useMapEditorStore((s) => s.selCamp);
  const edSelZoneId = useMapEditorStore((s) => s.selZoneId);
  const edZoneKind = useMapEditorStore((s) => s.zoneKind);
  const edDragStart = useMapEditorStore((s) => s.dragStart);
  const edBrushSize = useMapEditorStore((s) => s.brushSize);
  const edHoverF = useMapEditorStore((s) => s.hoverF);
  const edPeace = useCombatGridStore((s) => s.editorPeace);
  const battleBg = useCombatGridStore((s) => s.battleBg);
  const zones = useCombatGridStore((s) => s.zones);
  const fogLevel = useCombatGridStore((s) => s.fogLevel);
  const selectedEnemy = useCombatGridStore((s) => s.selectedEnemy);
  const petCommandMode = useCombatGridStore((s) => s.petCommandMode);
  const multiTargetIds = useCombatGridStore((s) => s.multiTargetIds);
  const turn = useCombatGridStore((s) => s.turn);
  const turnCount = useCombatGridStore((s) => s.turnCount);
  const isMoving = useCombatGridStore((s) => s.isMoving);
  const isSelected = useCombatGridStore((s) => s.isSelected);
  const playerRotation = useCombatGridStore((s) => s.playerRotation);
  const isPlayerHit = useCombatGridStore((s) => s.isPlayerHit);
  const isShaking = useCombatGridStore((s) => s.isShaking);
  const reserve = useCombatGridStore((s) => s.reserve);
  const popups = useCombatGridStore((s) => s.popups);
  const searchCast = useCombatGridStore((s) => s.searchCast);
  const campfire = useCombatGridStore((s) => s.campfire);
  const [fireFrame, setFireFrame] = useState(0);
  useEffect(() => {
    if (!isActive || !campfire) return;
    const t = setInterval(() => setFireFrame((f) => (f + 1) % campfireFrames.length), 250);
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
  const isRightMouseDown = useRef(false);
  // Зажата ли ПКМ прямо сейчас (стейт для перерисовки превью конуса).
  // Объявлено ДО использования в showConePreview (иначе TDZ-краш).
  const [rmbHeld, setRmbHeld] = useState(false);
  useEffect(() => {
    const up = () => { isRightMouseDown.current = false; rmbDownCell.current = null; setRmbHeld(false); };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);
  // Активный ствол для превью конуса (дробь/огнемёт).
  const activeGun = usePlayerStore((s) => s.getActiveWeapon());
  const coneProf = activeGun && (activeGun as any).ammoCapacity ? weaponRangeProfile(activeGun) : null;
  const showConePreview = rmbHeld && !!coneProf?.cone && !!cursorPos && turn === 'player';
  const movePlayer = useCombatGridStore((s) => s.movePlayer);
  const rotatePlayer = useCombatGridStore((s) => s.rotatePlayer);
  const selectEnemy = useCombatGridStore((s) => s.selectEnemy);
  const attackEnemy = useCombatGridStore((s) => s.attackEnemy);
  const selectedAbility = useCombatGridStore((s) => s.selectedAbility);
  const setPlannedPath = useCombatGridStore((s) => s.setPlannedPath);
  const lootingEnemy = useCombatGridStore((s) => s.lootingEnemy);
  const canFinish = useMemo(() => {
    // Союзники и нейтралы не блокируют финиш: все ВРАГИ мертвы + резерв пуст.
    const hostiles = enemies.filter((e) => e.faction !== 'Союзник' && !(e as any).isNeutral);
    return hostiles.length > 0 && hostiles.every((e) => e.dead) && reserve.length === 0;
  }, [enemies, reserve]);
  const celebration = useCombatGridStore((s) => s.celebration);
  // Победа + живые мусорщики → празднование вместо мгновенного финиша.
  useEffect(() => {
    if (!canFinish || celebration) return;
    const allies = useCombatGridStore.getState().enemies.filter(
      (e: any) => e.faction === 'Союзник' && !e.dead && (e.currentHp || 0) > 0 && !e.isPet,
    );
    if (allies.length > 0) useCombatGridStore.getState().startCelebration();
  }, [canFinish, celebration, enemies]);
  // Шаг празднования: союзники идут без AP и таймеров ходов.
  useEffect(() => {
    if (!celebration) return;
    const t = window.setInterval(() => {
      try { useCombatGridStore.getState().celebrationStep(); } catch { /* ignore */ }
    }, 2500);
    return () => window.clearInterval(t);
  }, [celebration]);
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
  const overlayRef = useRef<HTMLDivElement>(null);
  const lastStampRef = useRef<{ x: number; y: number } | null>(null);
  // Координаты кисти в клетках (дробные) из события мыши.
  const evToArena = (e: React.MouseEvent) => {
    const el = overlayRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    return {
      x: ((e.clientX - r.left) / r.width) * GRID_SIZE,
      y: ((e.clientY - r.top) / r.height) * GRID_SIZE,
    };
  };
  const fogCanvasRef = useRef<HTMLCanvasElement>(null);
  // Клетка нажатия ПКМ — для инспекции точки при клике без протяжки.
  const rmbDownCell = useRef<{ x: number; y: number } | null>(null);

  useEnemyAI();

  // Нейтралы (кабан): шаг раз в 10 сек + хрюк раз в 30 сек, вне пошаговости, пока бой активен.
  useEffect(() => {
    if (!isActive) return;
    const t = setInterval(() => {
      useCombatGridStore.getState().wanderNeutrals();
    }, 10000);
    const c = setInterval(() => {
      useCombatGridStore.getState().neutralChatter();
    }, 30000);
    return () => { clearInterval(t); clearInterval(c); };
  }, [isActive]);

  // -- Sound effects --
  const prevShotLine = useRef<typeof shotLine>(null);
  const prevPlayerHit = useRef(false);
  const prevPopupsLen = useRef(popups.length);
  const prevEnemiesDead = useRef<Set<number | string>>(new Set());
  // Активный залп живёт сам (ShotVolley гасится по таймеру): переживает очистку shotLine.
  const [volley, setVolley] = useState<typeof shotLine>(null);
  const volleySeq = useRef(0);
  const [volleyKey, setVolleyKey] = useState(0);

  useEffect(() => {
    if (shotLine) {
      volleySeq.current += 1;
      setVolleyKey(volleySeq.current);
      setVolley(shotLine);
      // Звук выстрела — от класса оружия (из данных игры); иначе старый shot1/2.
      // Играет на КАЖДЫЙ новый shotLine (включая бонус-выстрелы за скорость),
      // а не только по фронту null→set — таймеры залпов иначе глушат друг друга.
      // Канал арены, как у врагов (иначе тише через громкость UI).
      playCombatSound((shotLine.sound || (Math.random() > 0.5 ? 'shot1' : 'shot2')) as any, 0.4);
    }
    prevShotLine.current = shotLine;
  }, [shotLine]);

  useEffect(() => {
    if (isPlayerHit && !prevPlayerHit.current) playCombatSound('block', 0.4);
    prevPlayerHit.current = isPlayerHit;
  }, [isPlayerHit]);

  useEffect(() => {
    if (popups.length > prevPopupsLen.current && popups.length > 0) {
      const last = popups[popups.length - 1];
      if (last.type === 'CRIT') playCombatSound('crit', 0.4);
      else if (last.type === 'EVASION') playCombatSound('evasion', 0.4);
      else if (last.type === 'BLOCK') playCombatSound('block', 0.4);
    }
    prevPopupsLen.current = popups.length;
  }, [popups]);

  // Death sounds — when an enemy dies, play its soundAttack + optional death sound
  // (тихая смерть от скрытного убийства — без звуков).
  // Нейтрал (кабан) визжит сам в сторе — Вильгельма ему не даём, иначе дубль.
  useEffect(() => {
    for (const e of enemies) {
      if (e.dead && !prevEnemiesDead.current.has(e.id)) {
        prevEnemiesDead.current.add(e.id);
        if (!(e as any).silentDeath) {
          if (e.soundAttack) playCombatSound(e.soundAttack, 0.4);
          if (!(e as any).isNeutral) {
            const screamIdx = Math.floor(Math.random() * 5) + 1;
            playCombatSound(`wilhelm_scream${screamIdx}`, 0.3);
          }
          playCombatSound('chips', 0.4);
        }
      }
    }
    // Clear set when combat ends
    if (!isActive) prevEnemiesDead.current = new Set();
  }, [enemies, isActive]);

  // -- Helpers --
  // Проходимый декор прозрачности не даёт — только лес, поле и пеньки.
  const isPlayerInWoods = useMemo(() => {
    return obstacles.some(o => (((o.type === 'woods' || o.type === 'field') && o.isWalkable) || (o as any).stumpCenter) && playerPos.x >= o.x && playerPos.x < o.x + (o.w ?? 1) && playerPos.y >= o.y && playerPos.y < o.y + (o.h ?? 1));
  }, [obstacles, playerPos]);

  // -- Woods cells for enemy transparency (лес, поле и пеньки) --
  const woodsCells = useMemo(() => {
    const set = new Set<string>();
    for (const ob of obstacles) {
      if (((ob.type === 'woods' || ob.type === 'field') && ob.isWalkable) || (ob as any).stumpCenter) {
        for (let dx = 0; dx < (ob.w ?? 1); dx++) {
          for (let dy = 0; dy < (ob.h ?? 1); dy++) {
            set.add(`${ob.x + dx},${ob.y + dy}`);
          }
        }
      }
    }
    return set;
  }, [obstacles]);

  const stealth = useCombatGridStore((s) => s.stealth);

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
    // Режим конструктора: клики редактируют карту, а не бой.
    // Кисть/ластик/зона работают протяжкой (mousedown→mouseup).
    if (useMapEditorStore.getState().active) {
      const t = useMapEditorStore.getState().tool;
      if (t.kind !== 'brush' && t.kind !== 'eraser' && t.kind !== 'zone') editorCellClick(x, y);
      return;
    }
    if (turn !== 'player' || isMoving) return;
    if (useCombatGridStore.getState().isPlacingMine) {
      useCombatGridStore.getState().placeMine(x, y);
      return;
    }
    if (useCombatGridStore.getState().isTeleporting) {
      useCombatGridStore.getState().teleportTo(x, y);
      return;
    }
    // Стрелок «Залп из базуки»: клик по клетке — выстрел 3×3.
    if (useCombatGridStore.getState().isPlacingAoE) {
      useCombatGridStore.getState().placeAoE(x, y);
      return;
    }
    // Стрелок «Тройной выстрел»: набор целей по очереди, огонь на N-й.
    {
      const cs = useCombatGridStore.getState();
      const sel = cs.selectedAbility;
      const src = cs.selectedAbilitySource;
      const ab = sel !== null && sel !== undefined
        ? (src === 'skillBar' ? cs.skillBarAbilities[sel] : cs.playerAbilities[sel])
        : null;
      const need = (ab as any)?.multiTarget;
      if (need && sel !== null) {
        const target = enemies.find((e) => !e.dead && e.currentHp > 0 && e.pos.x === x && e.pos.y === y);
        if (!target || (target as any).isPet || target.faction === 'Союзник') return;
        const wasIncluded = cs.multiTargetIds.includes(target.id);
        cs.toggleMultiTarget(target.id, need);
        const after = useCombatGridStore.getState().multiTargetIds;
        // N-я новая цель набрана — огонь. Повторный клик снимает цель.
        if (!wasIncluded && after.length >= need) {
          cs.useAbility();
        }
        return;
      }
    }
    const enemy = enemies.find((e) => !e.dead && e.currentHp > 0 && e.pos.x === x && e.pos.y === y);
    if (enemy) {
      // Питомец: клик по своему зверю — вкл/выкл режим команды.
      if ((enemy as any).isPet) {
        const cs0 = useCombatGridStore.getState();
        cs0.setPetCommandMode(!cs0.petCommandMode);
        return;
      }
      // Режим команды: клик по врагу — питомец бежит атаковать, по своим — игнор.
      const cs0 = useCombatGridStore.getState();
      if (cs0.petCommandMode) {
        if (enemy.faction === 'Союзник') return;
        cs0.commandPetAttack(enemy.id);
        return;
      }
      // По своим не стреляем: мусорщики — друзья.
      // После победы клик по живому мусорщику — благодарность.
      if (enemy.faction === 'Союзник') {
        const cs = useCombatGridStore.getState();
        const hostilesLeft = cs.enemies.some((e) => !e.dead && e.currentHp > 0 && e.faction !== 'Союзник');
        if (!hostilesLeft) {
          cs.say(enemy.id, pickPhrase(STALKER_THANKS));
          cs.addBattleLog(`🤝 ${enemy.name} благодарит тебя за помощь!`);
        } else {
          cs.addMessage('🤝 Свои! В мусорщиков не стреляем.');
        }
        return;
      }
      const store = useCombatGridStore.getState();
      selectEnemy(enemy.id);
      if (store.selectedAbility !== null) {
        store.useAbility(enemy.id);
      } else {
        attackEnemy(enemy.id);
      }
      return;
    }
    // Combined loot from multiple corpses on same cell (нейтралы — только через E).
    const deadOnCell = enemies.filter((e) => e.dead && !(e as any).isNeutral && ((e.loot && e.loot.length > 0) || ((e as any).gear && (e as any).gear.length > 0)) && e.pos.x === x && e.pos.y === y);
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
        const combinedGear = deadOnCell.flatMap((e) => ((e as any).gear || []).map((item: any) => ({ ...item, parentEnemyId: e.id })));
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
          gear: combinedGear,
        } as GridEnemy);
      }
      return;
    }
    // Труп нейтрала (кабан): только через E, окно не открываем.
    {
      const boar = enemies.find((e: any) => e.dead && e.isNeutral && e.pos.x === x && e.pos.y === y && Array.isArray(e.loot) && e.loot.length > 0);
      if (boar) {
        useCombatGridStore.getState().addMessage('🥩 Подойди ближе и нажми E — собрать мясо');
        return;
      }
    }
    // Режим команды питомца: клик по пустой клетке — шаг зверя.
    if (useCombatGridStore.getState().petCommandMode) {
      useCombatGridStore.getState().commandPetMove(x, y);
      return;
    }
    if (isSelected) movePlayer(x, y);
  }, [turn, isMoving, enemies, isSelected, selectEnemy, attackEnemy, movePlayer, playerPos]);

  const handleCellHover = useCallback((x: number, y: number) => {
    useCombatGridStore.setState({ cursorPos: { x, y } });
    // Призрак редактора следует за мышкой.
    if (useMapEditorStore.getState().active) useMapEditorStore.getState().setHover({ x, y });
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
    const map = new Map<string, { icon: string; isAnchor: boolean; imgIndex?: number; imgKey?: string; w: number; h: number; blocks: boolean; hasLoot: boolean; stumpCenter?: boolean; rot?: number; obId?: number | string; random?: boolean }>();
    for (const ob of obstacles) {
      for (let dx = 0; dx < ob.w; dx++) {
        for (let dy = 0; dy < ob.h; dy++) {
          const isAnchor = dx === 0 && dy === 0;
          map.set(`${ob.x + dx},${ob.y + dy}`, { icon: ob.icon, isAnchor, imgIndex: ob.imgIndex, imgKey: (ob as any).imgKey, w: ob.w ?? 1, h: ob.h ?? 1, blocks: !!ob.blocks, hasLoot: !!(ob as any).searchLoot, stumpCenter: !!(ob as any).stumpCenter, rot: (ob as any).rot || 0, obId: (ob as any).id, random: !!(ob as any).editorRandom });
        }
      }
    }
    return map;
  }, [obstacles]);

  // Призрак редактора: футпринт за курсором (палитра или перенос выбранного).
  const ghost = useMemo(() => {
    if (!edActive || !edHover) return null;
    const pools: Record<string, string[]> = {
      building: BIG_BUILDING_IMAGES,
      car: CAR_IMAGES,
      woods: WOOD_IMAGES,
      small: SMALL_OBSTACLE_IMAGES,
      fence: [FENCE_IMAGE],
      field: [FIELD_IMAGE],
    };
    if (edTool.kind === 'brush' || edTool.kind === 'eraser') {
      const r = Math.floor(Math.max(1, edBrushSize || 1) / 2);
      const cells = new Set<string>();
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          const cx = edHover.x + dx;
          const cy = edHover.y + dy;
          if (cx < 0 || cx >= 32 || cy < 0 || cy >= 32) continue;
          cells.add(`${cx},${cy}`);
        }
      }
      return {
        kind: 'decal' as const, ax: edHover.x, ay: edHover.y,
        cells,
        valid: true, src: null as string | null, w: 1, h: 1,
      };
    }
    if (edTool.kind === 'route') {
      const selU = edSelUnitId !== null ? enemies.find((e: any) => e.id === edSelUnitId) : null;
      return {
        kind: 'route' as const, ax: edHover.x, ay: edHover.y,
        cells: new Set([`${edHover.x},${edHover.y}`]),
        valid: !!(selU && !(selU as any).dead), src: null as string | null, w: 1, h: 1,
      };
    }
    if (edTool.kind === 'campfire' || (edTool.kind === 'select' && edSelCamp)) {
      const valid = campCellFree(edHover.x, edHover.y);
      return {
        kind: 'camp' as const, ax: edHover.x, ay: edHover.y,
        cells: new Set([`${edHover.x},${edHover.y}`]),
        valid, src: null as string | null, w: 1, h: 1,
      };
    }
    if (edTool.kind === 'unit') {
      const busy = enemies.some((e: any) => e.pos.x === edHover.x && e.pos.y === edHover.y);
      const camp = (useCombatGridStore.getState() as any).campfire as { x: number; y: number } | null;
      const onCamp = !!camp && camp.x === edHover.x && camp.y === edHover.y;
      return {
        kind: 'unit' as const, ax: edHover.x, ay: edHover.y,
        cells: new Set([`${edHover.x},${edHover.y}`]),
        valid: !busy && !onCamp, src: null as string | null, w: 1, h: 1,
      };
    }
    let icon = '';
    let imgKey = '';
    let w = 0;
    let h = 0;
    let ghostRot = 0;
    let ignoreId: number | string | undefined;
    if (edTool.kind === 'obstacle') {
      icon = edTool.icon; imgKey = edTool.imgKey; w = edTool.w; h = edTool.h; ghostRot = edTool.rot || 0;
    } else if (edSelObId !== null) {
      const ob = (obstacles as any[]).find((o: any) => o.id === edSelObId);
      if (!ob) return null;
      icon = ob.icon; w = ob.w; h = ob.h; ignoreId = ob.id; ghostRot = (ob as any).rot || 0;
      imgKey = ob.imgKey || (pools[ob.icon] || [])[ob.imgIndex ?? 0] || '';
    } else {
      return null;
    }
    const { nx, ny } = clampFootprint(w, h, edHover.x, edHover.y);
    const valid = footprintValid(obstacles, w, h, nx, ny, ignoreId);
    const cells = new Set<string>();
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) cells.add(`${nx + dx},${ny + dy}`);
    }
    const key = imgKey || (pools[icon] || [])[0] || 'o1';
    let src: string | null = null;
    try { src = getBattleImage(key); } catch { src = null; }
    return { kind: 'ob' as const, ax: nx, ay: ny, cells, valid, src, w, h, rot: ghostRot, boost: icon === 'car' ? 1.25 : 1 };
  }, [edActive, edHover, edTool, edSelObId, edSelCamp, edBrushSize, obstacles, enemies]);

  // Зоны по клеткам (id зоны-якоря для выбора).
  const zoneTileMap = useMemo(() => {
    const map = new Map<string, { id: number | string; kind: string; ax: number; ay: number }[]>();
    for (const z of zones || []) {
      for (let dx = 0; dx < (z.w || 1); dx++) {
        for (let dy = 0; dy < (z.h || 1); dy++) {
          const k = `${z.x + dx},${z.y + dy}`;
          const arr = map.get(k) || [];
          arr.push({ id: (z as any).id, kind: (z as any).kind, ax: (z as any).x, ay: (z as any).y });
          map.set(k, arr);
        }
      }
    }
    return map;
  }, [zones]);

  // Точки маршрута выбранного юнита (номера).
  const selRouteMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!edActive || edSelUnitId === null) return map;
    const u = (enemies as any[]).find((e: any) => e.id === edSelUnitId);
    const r = (u as any)?.patrolRoute;
    if (Array.isArray(r)) r.forEach((p: any, i: number) => map.set(`${p.x},${p.y}`, i + 1));
    return map;
  }, [edActive, edSelUnitId, enemies]);

  // Прямоугольник рисуемой зоны (dragStart → курсор).
  const zoneDraft = useMemo(() => {
    if (!edActive || edTool.kind !== 'zone' || !edDragStart || !edHover) return null;
    const x1 = Math.max(0, Math.min(edDragStart.x, edHover.x));
    const y1 = Math.max(0, Math.min(edDragStart.y, edHover.y));
    const x2 = Math.min(31, Math.max(edDragStart.x, edHover.x));
    const y2 = Math.min(31, Math.max(edDragStart.y, edHover.y));
    const cells = new Set<string>();
    for (let x = x1; x <= x2; x++) {
      for (let y = y1; y <= y2; y++) cells.add(`${x},${y}`);
    }
    return { cells, x1, y1 };
  }, [edActive, edTool, edDragStart, edHover]);

  if (!isActive) return null;

  return (
    <div className={`${styles.container}${isShaking ? ` ${styles.arenaShake}` : ''}`}>
      <div className={styles.battleScreen} ref={gridRef} style={{ backgroundImage: `url(${getMapImage(battleBg || 'mapbattle') || images.mapBattle})`, marginTop: 30 }}>
        <NightDarkness />

        {/* Погодный туман карты (конструктор): молочно-серая пелена. */}
        {(fogLevel || 0) > 0 && (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 20,
            background: `linear-gradient(rgba(205,210,220,${((fogLevel || 0) / 100 * 0.5).toFixed(2)}), rgba(205,210,220,${((fogLevel || 0) / 100 * 0.5).toFixed(2)}))`,
          }} />
        )}

        {/* Darken background to hide map grid lines */}
        <div className={styles.bgDarken} />

        {/* Штампы кисти-ручки: canvas со сваркой пересечений (без швов). */}
        <DecalLayer />

        <div className={styles.gridOverlay}
          ref={overlayRef}
          onContextMenu={(e) => e.preventDefault()}
          style={{ cursor: `url("${pricelImg}") 12 12, crosshair` }}
          onMouseDown={(e) => {
            if (e.button === 2) { isRightMouseDown.current = true; setRmbHeld(true); return; }
            // Кисть-ручка: начало штриха в свободных координатах.
            if (e.button === 0 && useMapEditorStore.getState().active) {
              const ed = useMapEditorStore.getState();
              const pos = evToArena(e);
              if (pos && ed.tool.kind === 'brush') {
                ed.pushHistory();
                ed.setStrokeActive(true);
                paintDecal(pos.x, pos.y, ed.tool.imgKey, ed.brushSize);
                lastStampRef.current = pos;
              } else if (pos && ed.tool.kind === 'eraser') {
                ed.pushHistory();
                ed.setStrokeActive(true);
                paintDecal(pos.x, pos.y, null, ed.brushSize);
                lastStampRef.current = pos;
              }
            }
          }}
          onMouseMove={(e) => {
            if (!useMapEditorStore.getState().active) return;
            const ed = useMapEditorStore.getState();
            const pos = evToArena(e);
            if (!pos) return;
            ed.setHoverF({ x: pos.x, y: pos.y });
            if (ed.strokeActive && (ed.tool.kind === 'brush' || ed.tool.kind === 'eraser')) {
              const last = lastStampRef.current;
              const step = Math.max(0.1, ed.brushSize * ed.brushDensity);
              if (!last || Math.hypot(pos.x - last.x, pos.y - last.y) >= step) {
                paintDecal(pos.x, pos.y, ed.tool.kind === 'brush' ? ed.tool.imgKey : null, ed.brushSize);
                lastStampRef.current = pos;
              }
            }
          }}
          onMouseUp={(e) => {
            // Конструктор: конец штриха кисти / прямоугольника зоны.
            if (e.button === 0 && useMapEditorStore.getState().active) {
              const ed = useMapEditorStore.getState();
              lastStampRef.current = null;
              if (ed.strokeActive) ed.setStrokeActive(false);
              if (ed.dragStart && ed.tool.kind === 'zone') {
                const cur = useCombatGridStore.getState().cursorPos;
                finishZoneRect(cur?.x ?? ed.dragStart.x, cur?.y ?? ed.dragStart.y);
              }
            }
            if (e.button !== 2) return;
            isRightMouseDown.current = false;
            setRmbHeld(false);
            // В конструкторе ПКМ-клик без протяжки отменяет инструмент (возврат к «Выбрать»).
            // Протяжка — как обычно разворот персонажа.
            if (useMapEditorStore.getState().active) {
              const down = rmbDownCell.current;
              rmbDownCell.current = null;
              const cur = useCombatGridStore.getState().cursorPos;
              if (down && cur && down.x === cur.x && down.y === cur.y) {
                useMapEditorStore.getState().setTool({ kind: 'select' });
              }
              return;
            }
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
          onMouseLeave={() => { lastHoverRef.current = null; setPlannedPath([]); isRightMouseDown.current = false; rmbDownCell.current = null; setRmbHeld(false); lastStampRef.current = null; if (useMapEditorStore.getState().active) { const ed = useMapEditorStore.getState(); ed.setHover(null); ed.setHoverF(null); if (ed.strokeActive) ed.setStrokeActive(false); if (ed.dragStart) ed.setDragStart(null); } }}
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
            const isAllyCell = enemy?.faction === 'Союзник';
            const isNeutralCell = !!(enemy as any)?.isNeutral;
            const visible = isCellVisible(x, y);
            const edSel = edActive && ((obstacle && (obstacle as any).obId === edSelObId && obstacle.isAnchor) || (enemy && (enemy as any).id === edSelUnitId) || (edSelUnitId !== null && !enemy && (enemies as any[]).some((e: any) => e.id === edSelUnitId && e.dead && e.pos.x === x && e.pos.y === y)));
            const edGhost = edActive && ghost && ghost.kind !== 'decal' && ghost.cells.has(`${x},${y}`);
            const edGhostAnchor = edActive && ghost && ghost.kind !== 'decal' && ghost.ax === x && ghost.ay === y;
            const zoneHere = zoneTileMap.get(`${x},${y}`);
            const routeNum = selRouteMap.get(`${x},${y}`);
            const zoneDraftHere = edActive && zoneDraft?.cells.has(`${x},${y}`);

            return (
              <div
                key={i}
                className={`${styles.cell}${isSel ? ` ${styles.cellActive}` : ''}${pathPoint ? ` ${styles.pathActive}` : ''}${obstacle ? ` ${styles.obstacleCell}` : ''}${isPlayer ? ` ${styles.playerCell}` : ''}${isInRange && turn === 'player' ? ` ${styles.inRange}` : ''}${hovered && !isAllyCell ? ` ${styles.cellCrosshair}` : ''}${hovered && isAllyCell ? ` ${styles.allyCellCrosshair}` : ''}`}
                style={edSel ? { outline: '2px solid #ffd54a', outlineOffset: -2, zIndex: 5 } : undefined}
                onClick={() => handleCellClick(x, y)}
                onContextMenu={(e) => e.preventDefault()}
                onMouseDown={(e) => {
                  if (e.button === 2) { rmbDownCell.current = { x, y }; setRmbHeld(true); return; }
                  // Зона: начало прямоугольника (кисть стартует на оверлее).
                  if (e.button === 0 && useMapEditorStore.getState().active) {
                    const ed = useMapEditorStore.getState();
                    if (ed.tool.kind === 'zone') {
                      ed.setDragStart({ x, y });
                    }
                  }
                }}
                onMouseEnter={() => {
                  handleCellHover(x, y);
                  if (isRightMouseDown.current && !measureRef.current) rotatePlayer(x, y);
                }}
                data-invalid={pathPoint?.isInvalid ? 'true' : 'false'}
              >
                {/* Призрак редактора: футпринт за курсором, зелёный/красный. */}
                {edGhost && (
                  <div style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 4,
                    background: ghost!.valid ? 'rgba(80,220,100,0.35)' : 'rgba(220,60,60,0.35)',
                    border: ghost!.valid ? '1px dashed rgba(80,220,100,0.9)' : '1px dashed rgba(220,60,60,0.9)',
                  }} />
                )}
                {edGhostAnchor && ghost!.kind === 'ob' && ghost!.src && (
                  <img
                    src={ghost!.src}
                    alt=""
                    draggable={false}
                    style={{
                      position: 'absolute', pointerEvents: 'none', zIndex: 4,
                      ...obstacleImgStyle(ghost!.w, ghost!.h, (ghost! as any).rot || 0, (ghost! as any).boost || 1),
                      opacity: 0.55, objectFit: 'fill',
                    }}
                  />
                )}
                {edGhostAnchor && ghost!.kind === 'unit' && (
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, opacity: 0.8 }}>
                    {edBehavior === 'corpse' ? '💀' : edTool.kind === 'unit' && edTool.side === 'neutral' ? '🐗' : edTool.kind === 'unit' && edTool.side === 'ally' ? '🤝' : '👹'}
                  </div>
                )}
                {edGhostAnchor && ghost!.kind === 'camp' && (
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, opacity: 0.8 }}>
                    🔥
                  </div>
                )}
                {edGhostAnchor && (ghost!.kind === 'route' || ghost!.kind === 'decal') && ghost!.kind === 'route' && (
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, opacity: 0.85 }}>
                    📍
                  </div>
                )}
                {/* Зоны: в редакторе цветной контур + подпись, в игре только выход. */}
                {zoneHere && (edActive ? zoneHere : zoneHere.filter((z) => z.kind === 'exit')).map((z) => {
                  const col = z.id === edSelZoneId ? '#ffd54a' : z.kind === 'spawn' ? '#59d663' : z.kind === 'exit' ? '#ff9f43' : '#c77dff';
                  const isAnchor = z.ax === x && z.ay === y;
                  return (
                    <div key={`zone_${z.id}_${z.kind}`} style={{
                      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3,
                      border: `2px ${edActive ? 'dashed' : 'dotted'} ${col}`,
                      background: edActive ? `${col}22` : 'transparent',
                    }}>
                      {edActive && isAnchor && (
                        <span style={{ position: 'absolute', left: 0, top: 0, fontSize: 10, background: col, color: '#111', padding: '0 3px', borderRadius: 3 }}>
                          {z.kind === 'spawn' ? '🟢 спавн' : z.kind === 'exit' ? '🚪 выход' : '💜 триггер'}
                        </span>
                      )}
                    </div>
                  );
                })}
                {zoneDraftHere && (
                  <div style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 4,
                    background: edZoneKind === 'spawn' ? 'rgba(89,214,99,0.35)' : edZoneKind === 'exit' ? 'rgba(255,159,67,0.35)' : 'rgba(199,125,255,0.35)',
                    border: '1px dashed #fff',
                  }} />
                )}
                {/* Точки маршрута выбранного юнита. */}
                {routeNum && (
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, background: '#1c7ed6', color: '#fff', borderRadius: 8, padding: '0 5px' }}>{routeNum}</span>
                  </div>
                )}
                {obstacle?.isAnchor && (obstacle as any).icon === 'light' && edActive && edPeace && (
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }}>
                    {(() => {
                      const lvl = (LIGHT_LEVELS as any)[(obstacle as any).imgKey];
                      const r = lvl ? lvl.r : 2;
                      const num = String((obstacle as any).imgKey || '').replace('light', '') || '?';
                      return (
                        <>
                          <div style={{
                            position: 'absolute',
                            left: `${(0.5 - r) * 100}%`, top: `${(0.5 - r) * 100}%`,
                            width: `${2 * r * 100}%`, aspectRatio: '1',
                            borderRadius: '50%', border: '1px dashed rgba(255,213,74,0.8)',
                            background: 'rgba(255,213,74,0.07)',
                          }} />
                          <span style={{
                            position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
                            fontSize: 14, filter: 'drop-shadow(0 0 3px #000)',
                          }}>
                            💡{num}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                )}
                {obstacle?.isAnchor && (obstacle as any).icon !== 'light' && (
                  <img
                    src={getBattleImage(
                      (obstacle as any).imgKey ||
                      (obstacle.icon === 'building' ? BIG_BUILDING_IMAGES[obstacle.imgIndex ?? 0] :
                      obstacle.icon === 'car' ? CAR_IMAGES[obstacle.imgIndex ?? 0] :
                      obstacle.icon === 'woods' ? WOOD_IMAGES[obstacle.imgIndex ?? 0] :
                      obstacle.icon === 'small' ? SMALL_OBSTACLE_IMAGES[obstacle.imgIndex ?? 0] :
                      obstacle.icon === 'fence' ? FENCE_IMAGE :
                      obstacle.icon === 'field' ? FIELD_IMAGE :
                      'o1')
                    )}
                    alt=""
                    className={`${styles.obstacleImg} ${(obstacle as any).stumpCenter ? styles.obstacleWoodsImg : obstacle.icon === 'building' ? styles.obstacleBigImg : obstacle.icon === 'car' ? styles.obstacleCarImg : obstacle.icon === 'woods' ? styles.obstacleWoodsImg : styles.obstacleSmallImg}`}
                    // Здания, поле и проходимый декор — ровно футпринт; машины +25% в ширину.
                    // Разворот 90/270: бокс транспонируется (см. obstacleImgStyle).
                    // Обрезанные камни o1/o2 — чуть меньше клетки (85% по центру).
                    style={(() => {
                      const rot = obstacle.rot || 0;
                      const rotOnly = rot ? { transform: `rotate(${rot}deg)`, transformOrigin: 'center' } : null;
                      const key = (obstacle as any).imgKey
                        || (obstacle.icon === 'small' ? SMALL_OBSTACLE_IMAGES[obstacle.imgIndex ?? 0] : '');
                      // Реквизит (ящики, вертолёт, фонарь): весь футпринт, ходить нельзя, пули сквозь.
                      if (obstacle.icon === 'prop') {
                        return obstacleImgStyle(obstacle.w, obstacle.h, rot);
                      }
                      if (obstacle.icon === 'building' || obstacle.icon === 'field' || (obstacle.icon === 'small' && !obstacle.blocks)) {
                        return obstacleImgStyle(obstacle.w, obstacle.h, rot);
                      }
                      // Машины: в длину по футпринту, в ширину +25% по центру.
                      if (obstacle.icon === 'car') {
                        return obstacleImgStyle(obstacle.w, obstacle.h, rot, 1.25);
                      }
                      // Лес и забор тоже крутятся.
                      if (obstacle.icon === 'woods' || obstacle.icon === 'fence') {
                        return obstacleImgStyle(obstacle.w, obstacle.h, rot);
                      }
                      if (obstacle.icon === 'small' && ['o1', 'o1_2', 'o2'].includes(key ?? '')) {
                        return { width: '85%', height: '85%', left: '7.5%', top: '7.5%', ...rotOnly };
                      }
                      if (obstacle.icon === 'small' && ['o32_2', 'penek'].includes(key ?? '')) {
                        // Пенёк от срубленного дерева — вдвое меньше кроны, по центру футпринта.
                        // Кластерные — 42% по центру своей клетки.
                        if ((obstacle as any).stumpCenter) {
                          return { width: '85%', height: '85%', left: '57.5%', top: '57.5%', ...rotOnly };
                        }
                        return { width: '42%', height: '42%', left: '29%', top: '29%', ...rotOnly };
                      }
                      // Остальная блокирующая мелочь (o19, колодец) — 85% по центру.
                      if (obstacle.icon === 'small') {
                        return { width: '85%', height: '85%', left: '7.5%', top: '7.5%', ...rotOnly };
                      }
                      return undefined;
                    })()}
                    draggable={false}
                    {...((obstacle as any).imgKey === 'fonar'
                      ? { 'data-fonar': String((obstacle as any).obId ?? ''), 'data-fonar-base': String(obstacle.rot || 0) }
                      : null)}
                  />
                )}
                {/* Метка: объект можно обыскать (в нём есть лут). Деревья без метки — и так видно. */}
                {obstacle?.isAnchor && (obstacle as any).hasLoot && obstacle.icon !== 'woods' && (
                  <span className="searchable-dot" title="Можно обыскать (E)" />
                )}
                {/* Метка конструктора: объект встанет случайно при входе. */}
                {edActive && obstacle?.isAnchor && (obstacle as any).random && (
                  <span title="Случайное место при входе" style={{ position: 'absolute', right: 1, top: 1, zIndex: 6, fontSize: 13, pointerEvents: 'none' }}>🎲</span>
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
                      src={(deadEnemy as any).isNeutral ? (petCorpseImage() || getCharacterImage(deadEnemy.deadModel || 'dead')) : getCharacterImage(deadEnemy.deadModel || 'dead')}
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
                    className={`${styles.unit} ${styles.enemy}${isSel ? ` ${styles.selected}` : ''}${enemy.isInvisible ? ` ${styles.invisible}` : ''}${woodsCells.has(`${x},${y}`) ? ` ${styles.inWoods}` : ''}${hovered && isNeutralCell ? ` ${styles.neutralCrosshair}` : ''}${hovered && !isAllyCell && !isNeutralCell ? ` ${styles.enemyCrosshair}` : ''}${hovered && isAllyCell ? ` ${styles.allyCrosshair}` : ''}${isInRange && isNeutralCell ? ` ${styles.inRangeNeutral}` : ''}${isInRange && !isAllyCell && !isNeutralCell ? ` ${styles.inRangeEnemy}` : ''}${isInRange && isAllyCell ? ` ${styles.inRangeAlly}` : ''}`}
                    style={{ borderColor: ENEMY_COLORS[enemy.faction] || '#a1a1aa', width: enemy.bigModel || '100%', height: enemy.bigModel || '100%', zIndex: 5 }}
                    onMouseDown={(e) => { if (e.button === 2) { measureRef.current = true; setMeasuring({ x, y }); setRmbHeld(true); } }}
                  >
                    {enemy.isEnraged && <div className={styles.enemyStatusBadge}>💢</div>}
                    {enemy.isInvisible && <div className={styles.enemyStatusBadge}>👤</div>}
                    {((enemy as any).debuffs?.burn || (enemy as any).debuffs?.tox || (enemy as any).debuffs?.extro || (enemy as any).debuffs?.emi) && (
                      <div style={{
                        position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)',
                        display: 'flex', gap: 2, fontSize: 12, zIndex: 6, pointerEvents: 'none',
                        textShadow: '0 0 5px black',
                      }}>
                        {(enemy as any).stunned && <span title={`Стан: пропуск хода ${ (enemy as any).stunTurns || 1}`}>😵</span>}
                        {(enemy as any).debuffs?.burn && <span title="Горение: −3% HP каждый ход">🔥</span>}
                        {(enemy as any).debuffs?.tox && <span title="Токсин: −3% брони каждый ход">☠️</span>}
                        {(enemy as any).debuffs?.extro && <span title="Экстро: −25% атаки">💫</span>}
                        {(enemy as any).debuffs?.emi && <span title="ЭМИ: −50% блока">⚡</span>}
                      </div>
                    )}
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
                    {/* Мультитаргет «Тройного выстрела»: порядковый номер цели */}
                    {(() => {
                      const ord = multiTargetIds.indexOf(enemy.id);
                      if (ord < 0) return null;
                      return (
                        <div style={{
                          position: 'absolute', top: -32, right: -6,
                          width: 20, height: 20, borderRadius: '50%',
                          background: '#3b82f6', color: '#fff',
                          fontSize: 12, fontWeight: 800, lineHeight: '20px', textAlign: 'center',
                          border: '2px solid #fff', zIndex: 8, pointerEvents: 'none',
                          boxShadow: '0 0 8px rgba(59,130,246,0.8)',
                        }}>
                          {ord + 1}
                        </div>
                      );
                    })()}

                    <img
                      src={(() => {
                        const nm = (enemy as any).nowModel as string | undefined;
                        // Питомец: своя моделька для арены (медведь/волк/кабан).
                        if ((enemy as any).isPet) {
                          return petModelImage(((enemy as any).petKind as PetKind) || 'bear') || getEnemyImage(enemy.faction, enemy.name);
                        }
                        // Нейтральный кабан: модель кабана с арены.
                        if ((enemy as any).isNeutral) {
                          return petModelImage('boar') || getEnemyImage(enemy.faction, enemy.name);
                        }
                        // Союзник: строго своя моделька из спавна (без фолбэков наугад).
                        if (enemy.faction === 'Союзник' && nm) {
                          return getCharacterImage(nm) || getEnemyImage(enemy.faction, enemy.name);
                        }
                        return getEnemyImage(enemy.faction, enemy.name);
                      })()}
                      alt={enemy.name}
                      className={`${styles.humanSprite}${(enemy as any).isNeutral ? ` ${styles.neutralSprite}` : (enemy as any).isPet ? ` ${styles.petSprite}` : ''}${enemy.isSpinning ? ` ${styles.meleeSpin}` : ''}${enemy.isEnraged ? ` ${styles.enraged}` : ''}`}
                      draggable={false}
                      style={{
                        // База обычных спрайтов смотрит вниз; модели зверей:
                        // волк/кабан — вверх (+90°), медведь — влево (+180°).
                        // Нейтральный кабан смотрит вверх, как волк.
                        // Страж зверя (сет «Лесничий»): +25% размер.
                        transform: ((enemy as any).isPet
                          ? `rotate(${enemy.rotation + (((enemy as any).petKind === 'bear') ? 180 : 90)}deg)`
                          : (enemy as any).isNeutral
                            ? `rotate(${enemy.rotation + 90}deg)`
                            : `rotate(${enemy.rotation - 90}deg)`) + (((enemy as any).isPet && (enemy as any).guardTurns > 0) ? ' scale(1.25)' : ''),
                        // Страж зверя: зелёное горение.
                        filter: ((enemy as any).isPet && (enemy as any).guardTurns > 0) ? 'drop-shadow(0 0 12px #22ff66) brightness(1.25)' : 'none',
                        // Патруль вне боя — полупрозрачный (еле видно); в бою — 100%.
                        // Босс всегда 100%: он не прячется.
                        opacity: ((enemy.aiRole === 'patrol' || enemy.aiRole === 'reinforce') && !enemy.aggro && !isBossEnemy(enemy.name, (enemy as any).factionKey)) ? 0.5 : 1,
                        outline: (enemy as any).isPet && petCommandMode ? '2px solid #fbbf24' : 'none',
                        outlineOffset: 1,
                        borderRadius: 6,
                      }}
                    />
                    {(enemy as any).isPet && petCommandMode && (
                      <span style={{
                        position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)',
                        fontSize: 17, lineHeight: 1, zIndex: 8, pointerEvents: 'none',
                        filter: 'drop-shadow(0 0 5px #fbbf24)',
                      }}>
                        🎯
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Круг-призрак кисти-ручки (диаметр = размер кисти). */}
        {edActive && (edTool.kind === 'brush' || edTool.kind === 'eraser') && edHoverF && (
          <div style={{
            position: 'absolute',
            left: `${(edHoverF.x / GRID_SIZE) * 100}%`,
            top: `${(edHoverF.y / GRID_SIZE) * 100}%`,
            width: `${(edBrushSize / GRID_SIZE) * 100}%`,
            aspectRatio: '1',
            transform: 'translate(-50%,-50%)',
            borderRadius: '50%',
            border: `2px dashed ${edTool.kind === 'brush' ? 'rgba(120,220,255,0.95)' : 'rgba(255,120,120,0.95)'}`,
            background: edTool.kind === 'brush' ? 'rgba(120,220,255,0.12)' : 'rgba(255,120,120,0.12)',
            pointerEvents: 'none',
            zIndex: 15,
          }} />
        )}

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

        {/* Дождь поверх сцены (только при флаге погоды) */}
        <RainOverlay />
        {/* Эмбиент: туман, тени облаков, пыль, светлячки, дым и свет костра */}
        <AmbienceOverlay />
        {/* Ворон: пролёт из угла в угол */}
        <CrowFlight />
        {/* Стая вдали */}
        <BirdFlock />

        {/* Костёр лагеря — виден всегда (свет видно издалека), 12 кадров */}
        {campfire && campfireFrames.length > 0 && isCellVisible(campfire.x, campfire.y) && (
          <div style={{
            position: 'absolute',
            left: `${cellPct(campfire.x)}%`,
            top: `${cellPct(campfire.y)}%`,
            transform: 'translate(-50%, -62%)',
            width: '2.9%', aspectRatio: '1',
            zIndex: 4,
            pointerEvents: 'none',
            ...(edActive && edSelCamp ? { outline: '2px solid #ffd54a', outlineOffset: 2, borderRadius: 4 } : null),
          }}>
            <img
              src={campfireFrames[fireFrame % campfireFrames.length]}
              alt="campfire"
              draggable={false}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className="fire-spark"
                style={{
                  left: `${22 + i * 11}%`, width: 3, height: 3,
                  animationDuration: `${1.4 + (i % 3) * 0.4}s`,
                  animationDelay: `${(i * 0.35).toFixed(2)}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* Реплики и статусы — верхний слой: поверх тумана, костра и всех объектов */}
        {enemies.map((e) => {
          if (e.dead || !isCellVisible(e.pos.x, e.pos.y)) return null;
          const left = `${cellPct(e.pos.x)}%`;
          const top = `${cellPct(e.pos.y)}%`;
          const d = Math.hypot(e.pos.x - playerPos.x, e.pos.y - playerPos.y);
          // Подозрение: обычные 5 (в стелсе), часовые — 8, в стелсе 11-12.
          const susR = e.aiRole === 'sentry' ? (stealth ? 12 : 8) : 5;
          const detR = stealth
            ? (e.aiRole === 'sentry' ? 10 : 3)
            : (e.aiRole === 'sentry' ? 15 : 24);
          const showQ = !e.aggro && !e.sleeping && e.faction !== 'Союзник' && d <= susR && d > detR;
          // Часовой: белый «!» — только метка поста ВНЕ боя.
          // Воюющие без облачков: ни «!», ни «!!!» (вспышка тревоги — отдельно, 1 ход).
          const showExcl = (e.aiRole === 'sentry' || (e as any).wasSentry) && !e.aggro;
          // Вспышка тревоги «!!!» — только ~1 ход после подъёма (сам бой продолжается).
          const alertFlash = (e.alertTurn ?? -999) >= 0 && turnCount - (e.alertTurn ?? -999) <= 1;
          // Режим поиска трупа.
          const showSearch = !!e.searching && alertFlash;
          if (!e.speech && !e.sleeping && !showQ && !showExcl && !showSearch && !e.surrendering) return null;
          // Маркеры стопкой вверх (диалоги могут их перекрывать — так задумано).
          const exclB = 34;
          const zzzB = 34 + (showExcl ? 30 : 0);
          const qB = 34 + (showExcl ? 30 : 0) + (e.sleeping ? 30 : 0);
          const sB = 34 + (showExcl ? 30 : 0) + (e.sleeping ? 30 : 0) + (showQ ? 30 : 0);
          return (
            <div key={`estate-${e.id}`} style={{ position: 'absolute', left, top, width: 0, height: 0, zIndex: 60, pointerEvents: 'none' }}>
              {e.speech && Date.now() < ((e as any).speechUntil ?? Infinity) && (
                <div style={{
                  position: 'absolute', bottom: 10, left: 0, transform: 'translateX(-50%)',
                  maxWidth: 150, minWidth: 40, zIndex: 2,
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
              {showSearch && (
                <div title="Ищет труп" style={{
                  position: 'absolute', bottom: sB, left: 0, transform: 'translateX(-50%)',
                  background: '#7f1d1d', color: '#fff', fontSize: 12, fontWeight: 800,
                  padding: '1px 8px', borderRadius: 10, border: '1px solid rgba(248,113,113,0.8)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.5)', whiteSpace: 'nowrap',
                }}>
                  !!!
                </div>
              )}
              {e.surrendering && (
                <div style={{
                  position: 'absolute', bottom: 10, left: 0, transform: 'translateX(-50%)', zIndex: 2,
                  display: 'flex', gap: 6, alignItems: 'center',
                  background: '#f5f1e6', color: '#111', fontSize: 11, fontWeight: 700,
                  padding: '4px 8px', borderRadius: 9, border: '1px solid #8a8a8a',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.5)', pointerEvents: 'auto', whiteSpace: 'nowrap',
                }}>
                  <span>🏳️ Сдаюсь!</span>
                  <button
                    onClick={() => useCombatGridStore.getState().acceptSurrender(e.id)}
                    title="Принять плен (забрать лут)"
                    style={{ cursor: 'pointer', fontSize: 14, background: 'rgba(34,197,94,0.2)', border: '1px solid #22c55e', borderRadius: 6, padding: '0 6px' }}
                  >
                    ✅
                  </button>
                  <button
                    onClick={() => useCombatGridStore.getState().refuseSurrender(e.id)}
                    title="Отказать (бой продолжается)"
                    style={{ cursor: 'pointer', fontSize: 14, background: 'rgba(248,113,113,0.2)', border: '1px solid #f87171', borderRadius: 6, padding: '0 6px' }}
                  >
                    ❌
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Shot volley: muzzle flash + flying bullets (no more yellow line) */}
        {volley && <ShotVolley key={volleyKey} shot={volley} />}
        {/* Искра удара питомца на цели */}
        <PetHitSpark />

        {/* Превью конуса дробовика: зажатая ПКМ при активном стволе с конусом */}
        {showConePreview && coneProf && cursorPos && (() => {
          const R = coneProf.range;
          const baseA = Math.atan2(cursorPos.y - playerPos.y, cursorPos.x - playerPos.x);
          const pts: string[] = [`${cellPct(playerPos.x)}%,${cellPct(playerPos.y)}%`];
          for (let d = -30; d <= 30; d += 5) {
            const a = baseA + (d * Math.PI) / 180;
            const ex = Math.max(0, Math.min(31, playerPos.x + Math.cos(a) * R));
            const ey = Math.max(0, Math.min(31, playerPos.y + Math.sin(a) * R));
            pts.push(`${cellPct(ex)}%,${cellPct(ey)}%`);
          }
          return (
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 39 }}>
              <polygon
                points={pts.join(' ')}
                fill="rgba(251,146,60,0.18)"
                stroke="rgba(251,146,60,0.65)"
                strokeWidth="1.5"
              />
            </svg>
          );
        })()}

        {/* Flying grenade — animated trajectory from→to */}
        {flyingGrenade && (
          <div className={styles.grenadeFly} style={{
            left: `${cellPct(flyingGrenade.from.x)}%`,
            top: `${cellPct(flyingGrenade.from.y)}%`,
            transition: 'left 0.7s cubic-bezier(0.25, 1, 0.5, 1), top 0.7s cubic-bezier(0.25, 1, 0.5, 1)',
          }}>
            <div style={{
              position: 'absolute',
              left: 0, top: 0,
              transform: `translate(${(flyingGrenade.to.x - flyingGrenade.from.x) / GRID_SIZE * 100}%, ${(flyingGrenade.to.y - flyingGrenade.from.y) / GRID_SIZE * 100}%)`,
              transition: 'transform 0.7s cubic-bezier(0.25, 1, 0.5, 1)',
            }}>
              💣
            </div>
          </div>
        )}

        {/* Grenade explosion VFX */}
        {globalEffects.filter(e => e.type === 'GRENADE').map((eff, i) => (
          <div key={`explosion-${i}`} className={styles.explosionFx} style={{
            left: `${cellPct(eff.pos.x)}%`,
            top: `${cellPct(eff.pos.y)}%`,
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
                  left: `${cellPct(eff.pos.x)}%`,
                  top: `${cellPct(eff.pos.y)}%`,
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
                  left: `${cellPct(eff.pos.x)}%`,
                  top: `${cellPct(eff.pos.y)}%`,
                }}
              />
            );
          }
          return (
            <div
              key={i}
              className={`${styles.dangerZone} ${eff.type === 'REDZONE' ? styles.redZonePulse : styles.grenadeZone}`}
              style={{
                left: `${cellPct(eff.pos.x)}%`,
                top: `${cellPct(eff.pos.y)}%`,
              }}
            >
              {eff.type === 'REDZONE' && <div className={styles.dangerLabel}>☢️</div>}
            </div>
          );
        })}

        {/* Каст обыска у игрока */}
        {searchCast && (
          <div style={{
            position: 'absolute',
            left: `${cellPct(playerPos.x)}%`,
            top: `calc(${cellPct(playerPos.y)}% - 44px)`,
            transform: 'translateX(-50%)',
            zIndex: 60, pointerEvents: 'none',
            background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(251,191,36,0.5)',
            borderRadius: 4, padding: '3px 8px', whiteSpace: 'nowrap',
            fontSize: 10, fontWeight: 700, color: '#fbbf24',
          }}>
            <div style={{ marginBottom: 3 }}>🔍 {searchCast.label}</div>
            <div style={{ width: 110, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
              <div
                key={searchCast.startedAt}
                style={{
                  height: '100%', width: 0, background: '#fbbf24', borderRadius: 3,
                  transition: `width ${searchCast.totalMs}ms linear`,
                }}
                ref={(el) => {
                  if (el) requestAnimationFrame(() => requestAnimationFrame(() => { el.style.width = '100%'; }));
                }}
              />
            </div>
          </div>
        )}

        {/* Battle popups — offset vertically to avoid stacking */}
        {(() => {
          const posCount = new Map<string, number>();
          return popups.map((pop) => {
            const key = `${Math.round(pop.x)},${Math.round(pop.y)}`;
            const count = posCount.get(key) || 0;
            posCount.set(key, count + 1);
            // Хил-карточку (+50 💚 +5 🩸) поднимаем выше модельки.
            const lift = pop.type === 'HEALCARD' ? -34 : 0;
            // Разброс вокруг цели: детерминированный угол/радиус из id,
            // чтобы цифры не перекрывали друг друга.
            let dx = 0;
            let dy = 0;
            if (pop.type !== 'HEALCARD') {
              let h = 0;
              for (let i = 0; i < pop.id.length; i++) h = (h * 31 + pop.id.charCodeAt(i)) >>> 0;
              const ang = (h % 360) * Math.PI / 180;
              const rad = 0.45 + ((h >>> 8) % 5) * 0.12;
              dx = Math.cos(ang) * rad;
              dy = Math.sin(ang) * rad * 0.6 - 0.3;
            }
            return (
              <div key={pop.id} className={`${styles.battlePopup} ${styles[pop.type.toLowerCase()] || styles.normal}`} style={{
                left: `${cellPct(pop.x + dx)}%`,
                top: `calc(${cellPct(pop.y + dy)}% + ${count * -24 + lift}px)`,
                animationDuration: `${popupLifeMs(pop.type)}ms`,
              }}>
                {(pop as any).img && (
                  <img src={(pop as any).img} alt="" draggable={false} style={{ width: 26, height: 26, objectFit: 'contain', marginRight: 4, verticalAlign: 'middle' }} />
                )}
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
