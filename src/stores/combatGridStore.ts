import { create } from 'zustand';
import { usePlayerStore } from './playerStore';
import { useUiStore } from './uiStore';
import { useInventoryStore } from './inventoryStore';
import { generateEnemy, ENEMY_BASE_STATS } from '../engine/enemies';
import { generateLoot, rankOfEnemy } from '../engine/loot';
import { GAME_ITEMS } from '../data/GameItems';
import { createChest } from '../data/chests';
import { CONSUMABLE_MAP } from '../data/consumables';
import { ammoTypeForWeapon, ammoGroupName, weaponRangeProfile, effectiveAmmoCapacity, bulletDamageMult, worseQuality } from '../data/ammo';
import { applyTerrainToTarget, isCellWalkable } from '../engine/terrain';
import { REINFORCE_BARK, CORPSE_ALARM, CALLSIGNS, LEGENDARY_BOSS_SKILLS, pickPhrase } from '../data/enemyChatter';
import { playCombatSound, stopCombatSound } from '../hooks/useSound';
import { calcExtraShots } from '../utils/itemPower';
import type { AccessoryAbility, AbilityEffect } from '../types/abilities';
import { ALL_ABILITIES } from '../data/accessoryAbilities';

const GRID = 32;
const BASE_AP = 5;
const MAX_AMMO = 30;
const ATTACK_RANGE = 10;

export { GRID, BASE_AP, MAX_AMMO, ATTACK_RANGE };


export interface GridEnemy {
  id: number | string;
  name: string;
  faction: string;
  currentHp: number;
  maxHp: number;
  damage: number;
  dps: number;
  armor: number;
  accuracy: number;
  evasion: number;
  block: number;
  punching: number;
  vampir: number;
  crit: number;
  regen: number;
  pos: { x: number; y: number };
  isHit: boolean;
  dead: boolean;
  runAp: number;
  rotation: number;
  rangeDistance: number;
  shotPrice: number;
  skillUse: string[];
  cooldowns: Record<string, number>;
  isInvisible: boolean;
  invisTurns: number;
  baseEvasion: number;
  isEnraged: boolean;
  rageTurns: number;
  hasSummoned: boolean;
  bigModel: string;
  isSpinning: boolean;
  loot: any[];
  looted: boolean;
  lastSeenPlayerPos?: { x: number; y: number };
  speed?: number;
  soundAttack?: string;
  nowModel?: string;
  deadModel?: string;
  avatar?: string;
  level?: number;
  health?: number;
  isMinion?: boolean;
  factionKey?: string;
  stunned?: boolean;
  stunTurns?: number;
  lifetime?: number;
  // Camp life: роль в лагере, сон, агро, облачко реплики.
  aiRole?: 'camp' | 'sentry' | 'patrol' | 'reinforce';
  sleeping?: boolean;
  aggro?: boolean;
  coverSeeker?: boolean;
  patrolDir?: { dx: number; dy: number };
  speech?: string | null;
  // Срок жизни облачка (мс эпохи): рендер прячет просроченные, даже если
  // цикл ИИ воскресил текст из stale-копии после таймера очистки.
  speechUntil?: number;
  // Знает о игроке (видел/стрелял): стелс не включить, пока жив хоть один знающий.
  knowsPlayer?: boolean;
  // Естественный сон: осталось ходов (undefined — спит до побудки).
  sleepTurns?: number;
  // Режим поиска трупа (!!!): идёт к найденному телу.
  searching?: boolean;
  // Ход поднятия тревоги: вспышка «!!!» рисуется только ~1 ход (turnCount - alertTurn <= 1).
  alertTurn?: number;
  // Был часовым до тревоги: белый «!» остаётся и в бою.
  wasSentry?: boolean;
  // Тихая смерть (скрытное убийство): без крика и звуков смерти.
  silentDeath?: boolean;
  // Стихийные дебафы игрока (горение/токсин/экстро/ЭМИ): живут весь бой.
  debuffs?: { burn?: boolean; tox?: boolean; extro?: boolean; emi?: boolean };
  // Позывной (досье), отступление к медику/костру, сдача в плен.
  callsign?: string;
  retreating?: boolean;
  surrendering?: boolean;
  surrenderOffered?: boolean;
}

export interface GridObstacle {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  type: string;
  blocks: boolean;
  icon: string;
  isWalkable?: boolean;
  isHigh?: boolean;
  imgIndex?: number;
}

export interface BattlePopup {
  id: string;
  x: number;
  y: number;
  text: string;
  type: string;
}

export type ShotKind = 'single' | 'burst' | 'spread' | 'boss' | 'heal';

export interface ShotLine {
  from: { x: number; y: number };
  to: { x: number; y: number };
  type?: string;
  kind?: ShotKind;
  count?: number;
  power?: number;
  fast?: boolean;
  sound?: string | null;
}

/** Паттерн выстрела по классу врага: снайпер — 1 пуля, дробь — веер, босс — ливень. */
export const shotKindForEnemy = (e: { name?: string; factionKey?: string }): { kind: ShotKind; count: number; power: number; fast?: boolean } => {
  const s = `${e.name || ''} ${e.factionKey || ''}`.toLowerCase();
  if (s.includes('boss') || s.includes('босс')) return { kind: 'boss', count: 6, power: 1.6 };
  if (s.includes('sniper') || s.includes('снайпер')) return { kind: 'single', count: 1, power: 1.2 };
  if (/m134|m60|m249|pkm|миниган|пулем/.test(s)) return { kind: 'burst', count: 3, power: 1.1, fast: true };
  if (s.includes('drob') || s.includes('дроб') || s.includes('shotgun') || s.includes('аа-12') || s.includes('aa-12') || s.includes('spas') || s.includes('remington') || s.includes('двустволка')) return { kind: 'spread', count: 8, power: 1.1 };
  return { kind: 'burst', count: 2, power: 1 };
};

/** Паттерн выстрела игрока по его оружию: дробь — веер, снайпа — 1, пулемёт — очередь. */
export const shotKindForPlayerWeapon = (): { kind: ShotKind; count: number; power: number; fast?: boolean; sound?: string } => {
  const w = usePlayerStore.getState().getActiveWeapon();
  if (!w) return { kind: 'single', count: 1, power: 1, sound: 'melee' };
  const n = (w.name || '').toLowerCase();
  // Звуки — из данных игры (как у врагов): пистолет/снайпер/дробь/пулемёт/базука.
  if (/базук|рпг|гп-25|гранатом|milkor|m79/.test(n)) return { kind: 'single', count: 1, power: 1.8, sound: 'bazooka_sound_effect' };
  if (/огнемет|огнемёт|flame/.test(n)) return { kind: 'spread', count: 5, power: 1.1, sound: 'drob' };
  const g = ammoTypeForWeapon(w);
  if (g === 'shell') return { kind: 'spread', count: 8, power: 1.1, sound: 'drob' };
  if (g === 'sniper') return { kind: 'single', count: 1, power: 1.3, sound: 'sniper' };
  if (g === 'mg') return { kind: 'burst', count: 3, power: 1.1, fast: true, sound: 'm134' };
  if (g === 'pistol') return { kind: 'single', count: 1, power: 1, sound: 'pistol' };
  return { kind: 'single', count: 1, power: 1, sound: 'shotenemy' };
};

export interface GrenadeAnim {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export interface GlobalEffect {
  type: 'GRENADE' | 'REDZONE' | 'TELEPORT' | 'TELEPORT_LAND' | 'MINE';
  pos: { x: number; y: number };
  damage: number;
  timer: number;
  ownerId?: number;
}

export interface CombatGridStore {
  isActive: boolean;
  playerPos: { x: number; y: number };
  enemies: GridEnemy[];
  obstacles: GridObstacle[];
  turn: 'player' | 'enemy';
  ap: number;
  maxAp: number;
  ammo: number;
  maxAmmo: number;
  range: number;
  isDefensiveMode: boolean;
  turnCount: number;
  // Ход последнего выстрела (с любой стороны): защита от зависания боя.
  lastShotTurn: number;
  selectedEnemy: number | string | null;
  cursorPos: { x: number; y: number } | null;
  message: string;
  isVictory: boolean;
  isDefeat: boolean;
  isNightTime: boolean;
  isPlayerHit: boolean;
  isShaking: boolean;
  isMoving: boolean;
  isSelected: boolean;
  playerRotation: number;
  popups: BattlePopup[];
  shotLine: ShotLine | null;
  flyingGrenade: GrenadeAnim | null;
  globalEffects: GlobalEffect[];
  lootingEnemy: GridEnemy | null;
  plannedPath: { x: number; y: number }[];
  reserve: GridEnemy[];
  battleLogs: string[];
  // Туман войны с памятью: разведанные клетки остаются тускло видны.
  exploredCells: Record<string, true>;
  markExplored: (cells: string[]) => void;
  // Camp life: костёр лагеря, отложенное подкрепление (20 ход), id боя для таймеров.
  campfire: { x: number; y: number } | null;
  pendingReinforce: GridEnemy[];
  reinforceSpawned: boolean;
  battleId: number;
  say: (enemyId: number | string, text: string, ms?: number) => void;
  spawnReinforcements: () => void;
  // Волна агро: все враги (кроме союзников) в радиусе R от точки вступают в бой.
  aggroWave: (center: { x: number; y: number }, radius?: number) => void;
  // Скрытное убийство спящего рядом (2 AP, тихо, стелс остаётся).
  stealthKill: () => void;
  // Сдача в плен: принять (лут как с трупа) / отказаться (бой дальше).
  acceptSurrender: (id: number | string) => void;
  refuseSurrender: (id: number | string) => void;
  // Поиск трупа: точка найденного тела, флаг общей тревоги, запрет сна до конца боя.
  corpseSearch: { x: number; y: number } | null;
  alarmRaised: boolean;
  noSleep: boolean;
  raiseCorpseAlarm: (finderId: number | string) => void;
  // Скрытность: моделька полупрозрачна, замечают только в упор. Слетает при выстреле/обнаружении.
  stealth: boolean;
  toggleStealth: () => void;

  playerAbilities: (AccessoryAbility | null)[];
  abilityCooldowns: number[];
  selectedAbility: number | null;
  playerInvisible: boolean;
  playerInvisTurns: number;
  isTeleporting: boolean;
  isPlacingMine: boolean;
  immortalityTurns: number;

  cardRarityName: string | null;
  initCombat: (difficulty: number, encounteredFaction?: string, cardEnemyKeys?: string[], cardRewards?: { chipReward: number; xpReward: number; cardRarityName: string }, allyCount?: number) => boolean;
  teleportTo: (x: number, y: number) => void;
  placeMine: (x: number, y: number) => void;
  checkAutoTriggers: () => void;
  movePlayer: (x: number, y: number) => void;
  handleKeyboardMove: (dx: number, dy: number) => void;
  rotatePlayer: (x: number, y: number) => void;
  selectMe: () => void;
  selectEnemy: (id: number | string | null) => void;
  attackEnemy: (enemyId: number | string) => void;
  reload: () => void;
  // Смена оружия в бою (Q): пишет магазин текущего, заряжает следующее.
  cycleWeapon: () => void;
  selectAbility: (index: number) => void;
  useAbility: (enemyId?: number | string) => void;
  tickAbilityCooldowns: () => void;
  endTurn: () => void;
  cleanup: () => void;
  addMessage: (msg: string) => void;
  addPopup: (x: number, y: number, text: string, type?: string) => void;
  addBattleLog: (msg: string) => void;
  procElementalDebuffs: (targetId: string | number) => void;
  tickEnemyDebuffs: () => void;
  isCellBlocked: (x: number, y: number, ignoreEnemyId?: number) => boolean;
  findPath: (from: { x: number; y: number }, to: { x: number; y: number }) => { x: number; y: number }[];
  triggerShake: () => void;
  setIsSelected: (v: boolean) => void;
  setPlannedPath: (path: { x: number; y: number }[]) => void;
  finishBattle: () => void;
  lootEnemy: (enemyId: number | string, itemIndex: number) => void;
  closeLoot: () => void;
  spawnWave: (count: number) => Promise<void>;
  setLooted: (enemyId: number | string) => void;
}

export const getDist = (p1: { x: number; y: number }, p2: { x: number; y: number }) =>
  Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

export const getAngle = (from: { x: number; y: number }, to: { x: number; y: number }) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.atan2(dy, dx) * (180 / Math.PI);
};

const isValidCell = (x: number, y: number) => x >= 0 && x < GRID && y >= 0 && y < GRID;

export const checkVisibility = (
  viewerPos: { x: number; y: number },
  viewerRotation: number,
  targetPos: { x: number; y: number },
  obstacles: GridObstacle[],
  config?: { range?: number; fov?: number; clearRange?: number; clearFov?: number; isShallowCheck?: boolean },
) => {
  const { range = 24, fov = 90, clearRange = 10, clearFov = 130, isShallowCheck = false } = config || {};
  const dist = getDist(viewerPos, targetPos);
  if (dist > range) return false;
  if (dist <= 1) return true;
  const angleToTarget = getAngle(viewerPos, targetPos);
  let diff = Math.abs(angleToTarget - viewerRotation);
  if (diff > 180) diff = 360 - diff;
  if (dist <= clearRange && diff <= clearFov / 2) return true;
  if (diff > fov / 2) return false;
  if (isShallowCheck) return true;
  const dx = targetPos.x - viewerPos.x;
  const dy = targetPos.y - viewerPos.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy)) * 2;
  for (let i = 1; i < steps; i++) {
    const checkX = Math.round(viewerPos.x + (dx * i) / steps);
    const checkY = Math.round(viewerPos.y + (dy * i) / steps);
    if (!isValidCell(checkX, checkY)) continue;
    const isBlocking = obstacles.some(
      (obs) =>
        (obs.isHigh || (obs.blocks && !obs.isWalkable)) &&
        obs.x === checkX &&
        obs.y === checkY &&
        !(checkX === viewerPos.x && checkY === viewerPos.y) &&
        !(checkX === targetPos.x && checkY === targetPos.y),
    );
    if (isBlocking) return false;
  }
  return true;
};

function findFreeSpotForCorpse(
  startPos: { x: number; y: number },
  enemies: GridEnemy[],
  obstacles: GridObstacle[],
  excludeId?: number | string,
): { x: number; y: number } {
  const offsets = [
    { x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 },
    { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
  ];
  for (const off of offsets) {
    const nx = startPos.x + off.x;
    const ny = startPos.y + off.y;
    if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) continue;
    if (isCellBlockedBy(nx, ny, obstacles)) continue;
    const hasEntity = enemies.some(
      (e) => e.id !== excludeId && e.pos.x === nx && e.pos.y === ny && !e.dead,
    );
    if (hasEntity) continue;
    const hasCorpse = enemies.some((e) => e.dead && e.pos.x === nx && e.pos.y === ny);
    if (!hasCorpse) return { x: nx, y: ny };
  }
  return startPos;
}

function isCellBlockedBy(x: number, y: number, obstacles: GridObstacle[]): boolean {
  for (const ob of obstacles) {
    if (!ob.blocks || ob.isWalkable) continue;
    if (x >= ob.x && x < ob.x + ob.w && y >= ob.y && y < ob.y + ob.h) return true;
  }
  return false;
}

/** Ближайшая свободная клетка к точке (спиралью). Занятость — множество "x,y". */
function findFreeCellNear(
  x: number,
  y: number,
  taken: Set<string>,
): { x: number; y: number } {
  const cx = Math.max(0, Math.min(GRID - 1, Math.round(x)));
  const cy = Math.max(0, Math.min(GRID - 1, Math.round(y)));
  if (!taken.has(`${cx},${cy}`)) return { x: cx, y: cy };
  for (let r = 1; r < GRID; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
        if (!taken.has(`${nx},${ny}`)) return { x: nx, y: ny };
      }
    }
  }
  return { x: cx, y: cy };
}

/** Ближний бой по имени (Военные (melee) и т.п.). */
const isMeleeEnemy = (name: string): boolean => /melle|melee/i.test(name || '');

/** Босс по имени/ключу фракции. */
export const isBossEnemy = (name: string, factionKey?: string): boolean =>
  /boss|босс/i.test(`${name || ''} ${factionKey || ''}`);

export function findPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  obstacles: GridObstacle[],
  maxIter = 3000,
): { x: number; y: number }[] {
  const queue: { x: number; y: number; path: { x: number; y: number }[] }[] = [{ x: from.x, y: from.y, path: [from] }];
  const visited = new Set<string>();
  visited.add(`${from.x},${from.y}`);
  let iter = 0;
  while (queue.length > 0 && iter < maxIter) {
    iter++;
    const cur = queue.shift()!;
    if (cur.x === to.x && cur.y === to.y) return cur.path;
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const key = `${nx},${ny}`;
      if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) continue;
      if (visited.has(key)) continue;
      if (isCellBlockedBy(nx, ny, obstacles)) continue;
      visited.add(key);
      queue.push({ x: nx, y: ny, path: [...cur.path, { x: nx, y: ny }] });
    }
  }
  return [];
}

// Enemy-aware pathfinding — treats other enemies as obstacles, skips self
export function findPathForEnemy(
  from: { x: number; y: number },
  to: { x: number; y: number },
  obstacles: GridObstacle[],
  allEnemies: GridEnemy[],
  selfId: number | string,
  maxIter = 3000,
  maxSteps = 100,
): { x: number; y: number }[] {
  const queue: { x: number; y: number; path: { x: number; y: number }[] }[] = [{ x: from.x, y: from.y, path: [from] }];
  const visited = new Set<string>();
  visited.add(`${from.x},${from.y}`);
  let iter = 0;
  while (queue.length > 0 && iter < maxIter) {
    iter++;
    const cur = queue.shift()!;
    if (cur.x === to.x && cur.y === to.y) return cur.path;
    if (cur.path.length > maxSteps + 1) continue;
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const key = `${nx},${ny}`;
      if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) continue;
      if (visited.has(key)) continue;
      if (isCellBlockedBy(nx, ny, obstacles)) continue;
      // Check other enemies (but not self, and not the target cell)
      const isTargetCell = nx === to.x && ny === to.y;
      const blockedByEnemy = allEnemies.some((e) =>
        !e.dead && e.id !== selfId && !(isTargetCell && e.pos.x === nx && e.pos.y === ny) && e.pos.x === nx && e.pos.y === ny,
      );
      if (blockedByEnemy) continue;
      visited.add(key);
      queue.push({ x: nx, y: ny, path: [...cur.path, { x: nx, y: ny }] });
    }
  }
  return [];
}

function generateObstacles(
  playerPos: { x: number; y: number },
  enemies: { pos: { x: number; y: number } }[],
): GridObstacle[] {
  const list: GridObstacle[] = [];
  let id = 0;
  const occupied = new Set<string>();

  const isAreaFree = (sx: number, sy: number, w: number, h: number) => {
    for (let x = sx; x < sx + w; x++) {
      for (let y = sy; y < sy + h; y++) {
        if (x < 0 || x >= GRID || y < 0 || y >= GRID) return false;
        if (occupied.has(`${x},${y}`)) return false;
      }
    }
    return true;
  };

  const markArea = (sx: number, sy: number, w: number, h: number) => {
    for (let x = sx; x < sx + w; x++) {
      for (let y = sy; y < sy + h; y++) {
        occupied.add(`${x},${y}`);
      }
    }
  };

  // Safe zones 3x3 around player and each enemy
  markArea(playerPos.x - 1, playerPos.y - 1, 3, 3);
  for (const enemy of enemies) {
    markArea(enemy.pos.x - 1, enemy.pos.y - 1, 3, 3);
  }

  // Big buildings (6x5) — isHigh, random image
  const bigBuildingImagesCount = 11;
  const bigCount = Math.floor(Math.random() * 2) + 3;
  for (let i = 0; i < bigCount; i++) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const x = Math.floor(Math.random() * (GRID - 6));
      const y = Math.floor(Math.random() * (GRID - 5));
      if (isAreaFree(x, y, 6, 5)) {
        list.push({
          id: id++, x, y, w: 6, h: 5, type: 'building', blocks: true, icon: 'building',
          isHigh: true, imgIndex: Math.floor(Math.random() * bigBuildingImagesCount),
        });
        markArea(x, y, 6, 5);
        break;
      }
    }
  }

  // Cars (1x2, anchor at bottom cell, extends up) — NOT isHigh, random image
  const carImagesCount = 5;
  const carCount = Math.floor(Math.random() * 5) + 3;
  for (let i = 0; i < carCount; i++) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = Math.floor(Math.random() * GRID);
      const y = Math.floor(Math.random() * (GRID - 1)) + 1;
      if (isAreaFree(x, y - 1, 1, 2)) {
        list.push({
          id: id++, x, y: y - 1, w: 1, h: 2, type: 'car', blocks: true, icon: 'car',
          isHigh: false, imgIndex: Math.floor(Math.random() * carImagesCount),
        });
        markArea(x, y - 1, 1, 2);
        break;
      }
    }
  }

  // Woods (2x2 walkable) — NOT isHigh, random image
  const woodImagesCount = 4;
  const woodsCount = Math.floor(Math.random() * 50) + 10;
  for (let i = 0; i < woodsCount; i++) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const x = Math.floor(Math.random() * (GRID - 1));
      const y = Math.floor(Math.random() * (GRID - 1));
      if (isAreaFree(x, y, 2, 2)) {
        list.push({
          id: id++, x, y, w: 2, h: 2, type: 'woods', blocks: true, icon: 'woods',
          isWalkable: true, isHigh: false, imgIndex: Math.floor(Math.random() * woodImagesCount),
        });
        markArea(x, y, 2, 2);
        break;
      }
    }
  }

  // Fences — L-shaped, 5 cells in 3×3 area, each a separate 1×1 obstacle, all isHigh
  for (let i = 0; i < 4; i++) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const x = Math.floor(Math.random() * (GRID - 3));
      const y = Math.floor(Math.random() * (GRID - 3));
      if (isAreaFree(x, y, 3, 3)) {
        const isLshape = Math.random() > 0.5;
        // 5 cells
        const fenceCells: { dx: number; dy: number }[] = [];
        for (let j = 0; j < 5; j++) {
          const dx = isLshape && j > 2 ? 1 : j;
          const dy = isLshape && j > 2 ? j - 2 : 0;
          fenceCells.push({ dx, dy });
        }
        for (const { dx, dy } of fenceCells) {
          list.push({
            id: id++, x: x + dx, y: y + dy, w: 1, h: 1, type: 'fence', blocks: true, icon: 'fence',
            isHigh: true,
          });
        }
        // Mark all 9 cells of the 3×3 area as occupied
        markArea(x, y, 3, 3);
        break;
      }
    }
  }

  // Small obstacles (1×1) — up to 50, random image, NOT isHigh
  const smallObstacleImagesCount = 5;
  let smallCount = 0;
  let attempts = 0;
  while (smallCount < 50 && attempts < 70) {
    attempts++;
    const x = Math.floor(Math.random() * GRID);
    const y = Math.floor(Math.random() * GRID);
    if (isAreaFree(x, y, 1, 1)) {
      list.push({
        id: id++, x, y, w: 1, h: 1, type: 'small', blocks: true, icon: 'small',
        isHigh: false, imgIndex: Math.floor(Math.random() * smallObstacleImagesCount),
      });
      markArea(x, y, 1, 1);
      smallCount++;
    }
  }

  return list;
}

// Чистый стихийный урон по фракции цели: ТОКС — мутанты, ЭМИ — роботы,
// ОГОНЬ — люди (Бандиты/Военные), ЭКСТРО — все. Игнорирует броню и все защиты.
export const calcPureDamage = (pStats: any, faction?: string): number => {
  const extro = pStats?.dpsExtro || 0;
  if (faction === 'Мутанты') return Math.round((pStats?.dpsToxis || 0) + extro);
  if (faction === 'Роботы') return Math.round((pStats?.dpsEmi || 0) + extro);
  if (faction === 'Бандиты' || faction === 'Военные') return Math.round(extro + (pStats?.dpsFire || 0));
  return Math.round(extro);
};

export const calculateCombatResult = (attacker: any, target: any) => {
  let dmg = attacker.dps || attacker.damage || 0;
  let text = '';
  let type = 'NORMAL';
  let sound: string | null = null;

  const currentHour = new Date().getHours();
  // DEBUG forceDay: для тестов всегда день (без ночного штрафа).
  const isNightTime = currentHour >= 0 && currentHour < 6 && !useUiStore.getState().forceDay;
  const nightPenalty = isNightTime && !attacker.isPlayer ? 0.2 : 0;
  const finalAccuracy = Math.max(0, (attacker.accuracy || 0) - nightPenalty);
  // Форсированный крит (первый выстрел из скрытности): всегда попадает и критует.
  const forcedMult = (attacker as any).forceCritMult || 0;

  if (Math.random() > finalAccuracy && finalAccuracy < 1 && !forcedMult) {
    return { damage: 0, type: 'MISS', text: 'ПРОМАХ', sound: null };
  }

  // Уворот проверяется до расчёта урона: промах — 0 (чистый урон мимо уворота).
  let evasionChance = target.evasion || 0;
  if (finalAccuracy > 1) {
    if (Math.random() < finalAccuracy - 1) evasionChance = 0;
  }
  if (Math.random() < evasionChance && !forcedMult) {
    playCombatSound('evasion', 0.3);
    const pureDmg = Math.round(attacker.pure || 0);
    if (pureDmg > 0) return { damage: pureDmg, type: 'EVASION', text: `УВОРОТ −${pureDmg}`, sound: null };
    return { damage: 0, type: 'EVASION', text: 'УВОРОТ', sound: null };
  }

  // 1) КРИТ сначала: множитель применяется к базовому урону.
  const critVal = attacker.crit || 0;
  let critMultiplier = 1;
  let isCrit = false;
  if (forcedMult > 0) {
    isCrit = true;
    critMultiplier = forcedMult;
    dmg *= critMultiplier;
    type = 'CRIT';
    sound = 'crit';
  } else if (critVal > 0 && Math.random() < Math.min(1, critVal)) {
    isCrit = true;
    const baseTier = Math.floor(critVal);
    const chance = Math.min(critVal - baseTier, 1);
    critMultiplier = baseTier > 0
      ? (Math.random() < chance ? baseTier + 2 : baseTier + 1)
      : 2;
    dmg *= critMultiplier;
    type = 'CRIT';
    sound = 'crit';
  }

  // 2) БРОНЯ после крита: вычитаем effectiveEnemyArmor из уже умноженного урона.
  const p = attacker.punching || 0;
  let pierceFactor: number;
  if (p >= 2.0) pierceFactor = 0.7;
  else if (p >= 1.0) pierceFactor = 0.5;
  else pierceFactor = p * 0.5;
  const effectiveEnemyArmor = (target.armor || 0) * (1 - pierceFactor);
  dmg = Math.max(0, dmg - effectiveEnemyArmor);

  // 3) БЛОК после брони.
  const blockVal = target.block || 0;
  let isBlocked = false;
  let currentBlockReduction = 0.5;
  if (blockVal > 0 && Math.random() < Math.min(1, blockVal)) {
    isBlocked = true;
    if (blockVal >= 3.0) currentBlockReduction = 0.9;
    else if (blockVal >= 2.0) currentBlockReduction = 0.8;
    else if (blockVal >= 1.0) currentBlockReduction = 0.7;
    else currentBlockReduction = 0.5;
    dmg *= 1 - currentBlockReduction;
    if (!sound) sound = 'block';
  }

  // 4) Барьер (incoming damage multiplier).
  if (target.incomingDamageMult !== undefined && target.incomingDamageMult < 1) {
    dmg *= target.incomingDamageMult;
  }

  // 5) Чистый урон: мимо брони/блока/уворота/барьера, крит умножает всю сумму.
  const pureTotal = Math.round((attacker.pure || 0) * critMultiplier);
  const displayDmg = Math.round(dmg) + pureTotal;

  const isRealCrit = isCrit && critMultiplier > 1;
  if (isRealCrit && isBlocked) {
    text = `💥 КРИТ ЗАБЛОКИРОВАН! -${displayDmg}`;
    type = 'BLOCK';
    sound = 'block';
  } else if (isRealCrit) {
    text = `🔥 КРИТ x${critMultiplier}! -${displayDmg}`;
  } else if (isBlocked) {
    text = `🛡️ БЛОК -${(currentBlockReduction * 100).toFixed(0)}%! -${displayDmg}`;
  } else {
    text = `-${displayDmg}`;
  }

  return { damage: displayDmg, type, text, sound };
};

/** Проверяет щит игрока перед получением урона. Если щит активен — поглощает атаку, возвращает true */
export const absorbWithShield = (pos: { x: number; y: number }): boolean => {
  const playerStats = usePlayerStore.getState().stats;
  if (playerStats.shieldCharges > 0) {
    usePlayerStore.setState((st: any) => ({
      stats: { ...st.stats, shieldCharges: st.stats.shieldCharges - 1 },
    }));
    const store = useCombatGridStore.getState();
    store.addPopup(pos.x, pos.y, '🛡️ ЩИТ! Атака поглощена!', 'BLOCK');
    store.addBattleLog('🛡️ ЩИТ поглотил атаку');
    return true;
  }
  return false;
};

export const useCombatGridStore = create<CombatGridStore>()((set, get) => ({
  isActive: false,
  playerPos: { x: 2, y: 2 },
  enemies: [],
  obstacles: [],
  turn: 'player',
  ap: BASE_AP,
  maxAp: BASE_AP,
  ammo: MAX_AMMO,
  maxAmmo: MAX_AMMO,
  range: ATTACK_RANGE,
  isDefensiveMode: false,
  turnCount: 0,
  lastShotTurn: 0,
  selectedEnemy: null,
  cursorPos: null,
  message: '',
  isVictory: false,
  isDefeat: false,
  isNightTime: !useUiStore.getState().forceDay && new Date().getHours() >= 0 && new Date().getHours() < 6,
  isPlayerHit: false,
  isShaking: false,
  isMoving: false,
  isSelected: false,
  playerRotation: 90,
  popups: [],
  shotLine: null,
  flyingGrenade: null,
  globalEffects: [],
  lootingEnemy: null,
  plannedPath: [],
  reserve: [],
  battleLogs: [],
  exploredCells: {},
  campfire: null,
  pendingReinforce: [],
  reinforceSpawned: false,
  battleId: 0,
  corpseSearch: null,
  alarmRaised: false,
  noSleep: false,
  stealth: false,
  toggleStealth: () => {
    const s = get();
    if (s.turn !== 'player') return;
    if (s.stealth) {
      set({ stealth: false });
      get().addMessage('👁️ Скрытность снята');
      return;
    }
    const fighting = s.enemies.some((e) => !e.dead && e.currentHp > 0 && e.aggro);
    if (fighting) {
      get().addMessage('❌ Нельзя скрыться — идёт бой');
      return;
    }
    // Раскрыли: повторно скрыться можно, только когда все свидетели мертвы.
    const witnessed = s.enemies.some((e) => !e.dead && e.currentHp > 0 && e.knowsPlayer);
    if (witnessed) {
      get().addMessage('❌ Тебя раскрыли — убей тех, кто тебя видел');
      return;
    }
    set({ stealth: true });
    get().addMessage('🕵️ Скрытность: обычные замечают в 3, часовые — в 10 клетках');
  },
  markExplored: (cells) => set((s) => {
    let changed = false;
    const next = { ...s.exploredCells };
    for (const c of cells) {
      if (!next[c]) { next[c] = true; changed = true; }
    }
    return changed ? { exploredCells: next } : s;
  }),
  // Облачко реплики над врагом (висит 5 секунд).
  // Спящие не болтают: их реплики глушатся.
  say: (enemyId, text, ms = 5000) => {
    const bid = get().battleId;
    const target = get().enemies.find((e) => e.id === enemyId);
    if (!target || target.sleeping) return;
    const until = Date.now() + ms;
    set((s) => ({ enemies: s.enemies.map((e) => (e.id === enemyId ? { ...e, speech: text, speechUntil: until } : e)) }));
    setTimeout(() => {
      if (get().battleId !== bid) return;
      set((s) => ({
        enemies: s.enemies.map((e) => (e.id === enemyId && e.speech === text ? { ...e, speech: null } : e)),
      }));
    }, ms);
  },
  // Подкрепление с угла карты (20 ход): отложенные в pendingReinforce враги.
  spawnReinforcements: () => {
    const s = get();
    if (s.reinforceSpawned || s.pendingReinforce.length === 0) return;
    const corners = [{ x: 1, y: 30 }, { x: 30, y: 30 }, { x: 30, y: 1 }];
    const corner = corners[Math.floor(Math.random() * corners.length)];
    const taken = new Set<string>();
    taken.add(`${s.playerPos.x},${s.playerPos.y}`);
    for (const e of s.enemies) taken.add(`${e.pos.x},${e.pos.y}`);
    for (const o of s.obstacles) {
      for (let dx = 0; dx < (o.w || 1); dx++) {
        for (let dy = 0; dy < (o.h || 1); dy++) taken.add(`${o.x + dx},${o.y + dy}`);
      }
    }
    const pDirs = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
      { dx: 1, dy: 1 }, { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 },
    ];
    // Подкрепление всегда прибывает патрулём с общим направлением:
    // не спит, позиции игрока не знает (в стелсе — тем более), ищет по детекту.
    const sharedDir = pDirs[Math.floor(Math.random() * pDirs.length)];
    const placed = s.pendingReinforce.map((e) => {
      const spot = findFreeCellNear(corner.x, corner.y, taken);
      taken.add(`${spot.x},${spot.y}`);
      return {
        ...e, pos: spot, aiRole: 'reinforce' as const, aggro: false, sleeping: false,
        sleepTurns: undefined, speech: null, knowsPlayer: false,
        patrolDir: { ...sharedDir },
        rotation: Math.atan2(sharedDir.dy, sharedDir.dx) * (180 / Math.PI),
      };
    });
    set((st) => ({
      enemies: [...st.enemies, ...placed],
      pendingReinforce: [],
      reinforceSpawned: true,
      message: `⚠️ Подкрепление врага (${placed.length})! Патрулирует карту`,
      battleLogs: [...st.battleLogs.slice(-199), `⚠️ Подкрепление (${placed.length}) прибыло с угла карты — патрулирует!`],
    }));
    if (placed[0]) get().say(placed[0].id, pickPhrase(REINFORCE_BARK));
  },
  // Нашёл труп: общая тревога. Всех будим, переводим в поисковый патруль
  // (позиции игрока не знают), сон запрещён до конца боя.
  raiseCorpseAlarm: (finderId) => {
    const s = get();
    if (s.alarmRaised) return;
    const pDirs = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
      { dx: 1, dy: 1 }, { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 },
    ];
    set((st) => ({
      alarmRaised: true,
      noSleep: true,
      enemies: st.enemies.map((e) => {
        if (e.dead || e.currentHp <= 0) return e;
        const next: GridEnemy = { ...e, sleeping: false, sleepTurns: undefined, searching: false };
        // Не в бою — в поисковый патруль (лагерь и часовые тоже ищут).
        // Часовые помнят пост: флаг wasSentry держит белый «!» и в бою.
        if (!e.aggro && e.aiRole && e.aiRole !== 'reinforce') {
          const d = pDirs[Math.floor(Math.random() * pDirs.length)];
          next.aiRole = 'patrol';
          next.patrolDir = { ...d };
          if (e.aiRole === 'sentry') next.wasSentry = true;
        }
        return next;
      }),
      message: '🚨 Тревога! Враги прочёсывают карту!',
      battleLogs: [...st.battleLogs.slice(-199), '🚨 Враг нашёл труп! Все ищут тебя!'],
    }));
    get().say(finderId, pickPhrase(CORPSE_ALARM));
  },
  // Волна агро: стрельба будит всех в радиусе — бегут в бой (и запоминают игрока).
  aggroWave: (center, radius = 9) => {
    set((s) => ({
      enemies: s.enemies.map((e) => {
        if (e.dead || e.currentHp <= 0 || e.faction === 'Союзник') return e;
        if (e.aggro && e.knowsPlayer && !e.sleeping) return e;
        if (Math.hypot(e.pos.x - center.x, e.pos.y - center.y) > radius) return e;
        return { ...e, aggro: true, sleeping: false, knowsPlayer: true, alertTurn: get().turnCount };
      }),
    }));
  },
  // Скрытное убийство: только в стелсе, жертва спит и стоит рядом.
  // Тихо: без волны агро, стелс не слетает.
  stealthKill: () => {
    const s = get();
    if (s.turn !== 'player' || s.isMoving) return;
    if (!s.stealth) { get().addMessage('❌ Скрытное убийство — только в скрытности'); return; }
    if (s.ap < 2) { get().addMessage('❌ Нужно 2 AP для скрытного убийства'); return; }
    const isValid = (e: GridEnemy) =>
      !e.dead && e.currentHp > 0 && e.sleeping && e.faction !== 'Союзник'
      && Math.max(Math.abs(e.pos.x - s.playerPos.x), Math.abs(e.pos.y - s.playerPos.y)) <= 1;
    const victim = s.enemies.find((e) => e.id === s.selectedEnemy && isValid(e))
      || [...s.enemies].filter(isValid).sort((a, b) =>
        Math.hypot(a.pos.x - s.playerPos.x, a.pos.y - s.playerPos.y)
        - Math.hypot(b.pos.x - s.playerPos.x, b.pos.y - s.playerPos.y))[0];
    if (!victim) { get().addMessage('❌ Рядом нет спящего врага'); return; }
    let freshLoot: any[] = [];
    try {
      freshLoot = generateLoot(GAME_ITEMS, usePlayerStore.getState().level, {
        rank: rankOfEnemy((victim as any).factionKey, victim.name),
      });
    } catch { /* ignore */ }
    const corpsePos = findFreeSpotForCorpse(victim.pos, s.enemies, s.obstacles, victim.id);
    playCombatSound('1bbfc9b5f4347f2', 0.5);
    set((st) => ({
      ap: st.ap - 2,
      enemies: st.enemies.map((e) =>
        e.id === victim.id
          ? { ...e, currentHp: 0, dead: true, sleeping: false, sleepTurns: undefined, speech: null, silentDeath: true, loot: freshLoot, looted: false, pos: corpsePos }
          : e),
      message: `🔪 Скрытное убийство: ${victim.name}`,
      selectedEnemy: null,
    }));
    get().addBattleLog(`🔪 Скрытное убийство: ${victim.name}`);
    get().addPopup(corpsePos.x, corpsePos.y, '🔪 Тихо устранён', 'SPECIAL');
    // Тело найдут: точка поиска трупа для режима «!!!».
    set({ corpseSearch: { ...corpsePos } });
    const rest = get();
    if (rest.enemies.every((e) => e.dead) && rest.reserve.length === 0 && rest.pendingReinforce.length === 0) {
      get().addMessage('🕊️ Поле зачищено. Свободное перемещение.');
    }
  },
  // Пленник сдался: забираем лут как с трупа (тихо), открываем окно обыска.
  acceptSurrender: (id) => {
    const s = get();
    const captive = s.enemies.find((e) => e.id === id);
    if (!captive || captive.dead) return;
    let freshLoot: any[] = [];
    try {
      freshLoot = generateLoot(GAME_ITEMS, usePlayerStore.getState().level, {
        rank: rankOfEnemy((captive as any).factionKey, captive.name),
      });
    } catch { /* ignore */ }
    const done = { ...captive, currentHp: 0, dead: true, sleeping: false, sleepTurns: undefined, speech: null, silentDeath: true, surrendering: false, loot: freshLoot, looted: false };
    set((st) => ({
      enemies: st.enemies.map((e) => (e.id === id ? done : e)),
      lootingEnemy: done,
      message: `🏳️ ${captive.name} сдался в плен! Забирай лут`,
    }));
    get().addBattleLog(`🏳️ ${captive.name} сдался в плен`);
  },
  // Отказ: бой продолжается, больше не предлагать.
  refuseSurrender: (id) => {
    set((s) => ({
      enemies: s.enemies.map((e) => (e.id === id ? { ...e, surrendering: false, surrenderOffered: true } : e)),
      message: '⚔️ Пощады не будет!',
    }));
    get().addBattleLog('⚔️ Пленник отвергнут — бой продолжается');
  },
  playerAbilities: [],
  abilityCooldowns: [],
  selectedAbility: null,
  playerInvisible: false,
  playerInvisTurns: 0,
  isTeleporting: false,
  isPlacingMine: false,
  immortalityTurns: 0,
  cardRarityName: null,

  addMessage: (msg) => set({ message: msg }),

  addBattleLog: (msg) => set((s) => ({ battleLogs: [...s.battleLogs.slice(-199), msg] })),

  addPopup: (x, y, text, type = 'NORMAL') => {
    // Настройка «Цифры урона»: числовые попапы (урон/крит/блок) можно скрыть.
    if ((type === 'NORMAL' || type === 'CRIT' || type === 'BLOCK') && useUiStore.getState().showDamageNumbers === false) return;
    const id = `popup-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    set((s) => ({ popups: [...s.popups, { id, x, y, text, type }] }));
    setTimeout(() => {
      set((s) => ({ popups: s.popups.filter((p) => p.id !== id) }));
    }, 1000);
  },

  triggerShake: () => {
    set({ isShaking: true });
    setTimeout(() => set({ isShaking: false }), 500);
  },

  // Прок стихийных дебафов после попадания: шанс = значение стихии (кап 100%).
  // Огонь/токсин — флаги на весь бой (тик в useEnemyAI), экстро/ЭМИ — разовые срезы.
  procElementalDebuffs: (targetId) => {
    const pStats = usePlayerStore.getState().stats;
    const en = get().enemies.find((e) => e.id === targetId);
    if (!en || en.dead || (en.currentHp || 0) <= 0) return;
    const roll = (val: number) => (val || 0) > 0 && Math.random() * 100 < Math.min(100, val);
    const db = { ...((en as GridEnemy).debuffs || {}) };
    const notes: string[] = [];
    if (!db.burn && roll(pStats.dpsFire || 0)) { db.burn = true; notes.push('🔥 ГОРЕНИЕ'); }
    if (!db.tox && roll(pStats.dpsToxis || 0)) { db.tox = true; notes.push('☠️ ТОКСИН'); }
    if (!db.extro && roll(pStats.dpsExtro || 0)) {
      db.extro = true; notes.push('💫 −25% АТАКА');
      set((s) => ({ enemies: s.enemies.map((e) => e.id === targetId ? { ...e, damage: (e.damage || 0) * 0.75, dps: (e.dps || 0) * 0.75 } : e) }));
    }
    if (!db.emi && roll(pStats.dpsEmi || 0)) {
      db.emi = true; notes.push('⚡ −50% БЛОК');
      set((s) => ({ enemies: s.enemies.map((e) => e.id === targetId ? { ...e, block: (e.block || 0) * 0.5 } : e) }));
    }
    if (notes.length === 0) return;
    set((s) => ({ enemies: s.enemies.map((e) => e.id === targetId ? { ...e, debuffs: db } : e) }));
    for (const n of notes) get().addPopup(en.pos.x, en.pos.y, n, 'DEBUFF');
    get().addBattleLog(`☠️ ${en.name}: ${notes.join(', ')}`);
  },

  // Тик дебафов в начале хода врагов (зовёт useEnemyAI): горение бьёт,
  // токсин точит броню. Смерть от горения — полноценная, с лутом.
  tickEnemyDebuffs: () => {
    const st = get();
    let changed = false;
    let wavesCheck = false;
    const enemies = st.enemies.map((e) => {
      const n = e as GridEnemy;
      if (n.dead || !n.debuffs) return e;
      let next: GridEnemy = { ...n };
      if (next.debuffs?.burn && (next.currentHp || 0) > 0) {
        const dmg = Math.max(1, Math.round((next.maxHp || 1) * 0.03));
        next.currentHp = Math.max(0, (next.currentHp || 0) - dmg);
        get().addPopup(next.pos.x, next.pos.y, `🔥−${dmg}`, 'DMG');
        get().addBattleLog(`🔥 ${next.name} горит: −${dmg}`);
        changed = true;
        if (next.currentHp <= 0) {
          let freshLoot: any[] = [];
          try {
            freshLoot = generateLoot(GAME_ITEMS, usePlayerStore.getState().level, {
              rank: rankOfEnemy((next as any).factionKey, next.name),
            });
          } catch { /* ignore */ }
          const screamIdx = Math.floor(Math.random() * 5) + 1;
          playCombatSound(`wilhelm_scream${screamIdx}`, 0.3);
          next = { ...next, dead: true, loot: freshLoot, looted: false, isHit: false };
          get().addBattleLog(`💀 ${next.name} сгорел!`);
          get().addMessage(`💀 ${next.name} сгорел! Кликни для лута`);
          wavesCheck = true;
        }
      }
      if (!next.dead && next.debuffs?.tox && (next.currentHp || 0) > 0 && (next.armor || 0) > 0) {
        next = { ...next, armor: Math.max(0, +((next.armor || 0) * 0.97).toFixed(3)) };
        if (get().turnCount % 3 === 0) {
          get().addPopup(next.pos.x, next.pos.y, '☠️−броня', 'DEBUFF');
          get().addBattleLog(`☠️ ${next.name}: броня разъедена (${next.armor})`);
        }
        changed = true;
      }
      return next;
    });
    if (changed) set({ enemies });
    if (wavesCheck) {
      const allDead = get().enemies.every((e) => e.dead);
      if (allDead && get().reserve.length > 0) get().spawnWave(2);
    }
  },

  isCellBlocked: (x, y, ignoreEnemyId?) => {
    const state = get();
    if (x < 0 || x >= GRID || y < 0 || y >= GRID) return true;
    if (isCellBlockedBy(x, y, state.obstacles)) return true;
    for (const e of state.enemies) {
      if (!e.dead && e.pos.x === x && e.pos.y === y && e.id !== ignoreEnemyId) return true;
    }
    return false;
  },

  findPath: (from, to) => findPath(from, to, get().obstacles),

  initCombat: (difficulty, encounteredFaction, cardEnemyKeys, cardRewards, allyCount) => {
    try {
    // Reset combat-only player state
    usePlayerStore.setState((st: any) => ({
      stats: { ...st.stats, shieldCharges: 0 },
      activeEffects: (st.activeEffects || []).filter((e: any) => !e.id.startsWith('ability_')),
    }));
    // Способности боя — из расходников рюкзака (до 12).
    usePlayerStore.getState().recalcAbilities();
    const player = usePlayerStore.getState();

    // Активное оружие (выбранное, Q — смена): магазин/дальность/урон с него.
    const gunSlot = usePlayerStore.getState().activeWeaponSlot;
    const gun = usePlayerStore.getState().getActiveWeapon();
    const gunIsMelee = gun && (gun as any).slot === 'weapon1' && !(gun as any).ammoCapacity;
    // Вместимость с учётом магазина-мода.
    let ammoCap = gun ? effectiveAmmoCapacity(gun) || 30 : 30;
    // Магазин живёт в оружии (loadedAmmo): рюкзак не трогаем.
    // Первая зарядка (loadedAmmo нет): полный магазин из рюкзака, запоминаем.
    // Кулаки/ближний бой без патронов — виртуальный магазин.
    let startAmmo: number;
    let tookFromPack = 0;
    let tookQuality = 'Обычный';
    if (!gun || gunIsMelee) {
      startAmmo = ammoCap;
    } else if (typeof gun.loadedAmmo === 'number') {
      startAmmo = Math.max(0, Math.min(ammoCap, gun.loadedAmmo));
    } else {
      const res = usePlayerStore.getState().takeAmmoFromPack(ammoTypeForWeapon(gun), ammoCap);
      startAmmo = res.taken;
      tookFromPack = startAmmo;
      tookQuality = res.quality;
      const gs = gunSlot;
      usePlayerStore.setState((st: any) => ({
        equipment: {
          ...st.equipment,
          [gs]: st.equipment[gs] ? { ...st.equipment[gs], loadedAmmo: startAmmo, loadedAmmoQuality: tookQuality, loadedAmmoBreakdown: res.breakdown } : st.equipment[gs],
        },
      }));
      usePlayerStore.getState().syncEquippedItem(gs);
    }

    // Override rewards with card values when in card mode
    if (cardRewards) {
      usePlayerStore.setState((st: any) => ({
        combat: {
          ...st.combat,
          enemyChipReward: cardRewards.chipReward,
          enemyExpReward: cardRewards.xpReward,
        },
      }));
      set({ cardRarityName: cardRewards.cardRarityName });
    }

    // Player starts at (2,2) like original
    const playerPos = { x: 2, y: 2 };

    const playerLevel = player.level;
    const levelMult = 1 + 0.2 * (Math.max(1, playerLevel) - 1);
    const extraMult = 1 + (difficulty || 0) / 100;
    const accuracyAdd = (playerLevel - 1) * 0.001;

    const allFactionKeys = Object.keys(ENEMY_BASE_STATS);
    let factionKeysPool: string[];
    let enemyCount: number;

    if (cardEnemyKeys && cardEnemyKeys.length > 0) {
      enemyCount = cardEnemyKeys.length;
      factionKeysPool = cardEnemyKeys;
    } else {
      enemyCount = Math.min(1 + Math.floor(difficulty / 4), 6);
      factionKeysPool = allFactionKeys;
      if (encounteredFaction) {
        const matched = allFactionKeys.filter((k) => k === encounteredFaction || ENEMY_BASE_STATS[k].faction === encounteredFaction);
        if (matched.length > 0) factionKeysPool = matched;
      }
    }

    const enemies: GridEnemy[] = [];
    // Колода позывных: тасуем, раздаём без повторов в бою.
    const callsignDeck = [...CALLSIGNS].sort(() => Math.random() - 0.5);
    let callsignIdx = 0;
    const dealCallsign = (): string => {
      const c = callsignDeck[callsignIdx % callsignDeck.length];
      callsignIdx++;
      return c;
    };
    for (let i = 0; i < enemyCount; i++) {
      const factionKey = cardEnemyKeys ? cardEnemyKeys[i] : factionKeysPool[Math.floor(Math.random() * factionKeysPool.length)];
      const base = ENEMY_BASE_STATS[factionKey];
      if (!base) continue;
      const totalMult = levelMult * extraMult;
      const scaledHealth = Math.round(base.health * totalMult);
      const scaledDamage = Math.round(base.damage * totalMult);
      const spawnX = Math.min(GRID - 3, Math.max(1, GRID - 3 - (i % 4) * 2));
      // Кламп в карту: иначе индекс 9+ улетает за край (y до 55 при сетке 32)
      // и «остался 1 противник» висит вечно.
      const rawY = 20 + (i % 3) * 3 + Math.floor(i / 3) * 4 + i;
      const spawnY = 2 + (rawY % (GRID - 4));
      const abilities = base.skillUse && base.skillUse.length > 0 && base.skillUse[0] !== ''
        ? base.skillUse
        : [];

      let enemyLoot: any[] = [];
      try {
        enemyLoot = generateLoot(GAME_ITEMS, player.level, {
          rank: rankOfEnemy(factionKey, factionKey),
        }).map((item) => ({ ...item, parentEnemyId: i }));
      } catch (e) { /* ignore */ }

      enemies.push({
        id: i,
        name: factionKey,
        faction: base.faction || 'Неизвестно',
        dps: scaledDamage * (1 + (base.speed * totalMult || 0)),
        speed: base.speed * totalMult,
        currentHp: scaledHealth,
        maxHp: scaledHealth,
        health: base.health,
        damage: scaledDamage,
        armor: Math.round(base.armor * totalMult),
        accuracy: Math.min(2, base.accuracy + accuracyAdd),
        evasion: Math.min(1, base.evasion * totalMult),
        block: base.block * totalMult,
        punching: base.punching * totalMult,
        vampir: base.vampir * totalMult,
        crit: base.crit * totalMult,
        regen: (base.regen || 0) * totalMult,
        pos: { x: spawnX, y: spawnY },
        isHit: false,
        dead: false,
        runAp: base.runAp || 4,
        rotation: 270,
        rangeDistance: base.rangeDistance || 7,
        shotPrice: base.shotPrice || 1,
        skillUse: abilities,
        cooldowns: {},
        isInvisible: false,
        invisTurns: 0,
        baseEvasion: base.evasion || 0,
        isEnraged: false,
        rageTurns: 0,
        hasSummoned: false,
        bigModel: base.bigModel || '100%',
        isSpinning: false,
        loot: enemyLoot,
        looted: false,
        soundAttack: base.soundAttack || 'shotenemy',
        nowModel: base.nowModel || 'enemy',
        deadModel: base.dead || 'dead',
        avatar: base.avatar || 'enemy',
        level: base.level || 1,
        factionKey,
        callsign: dealCallsign(),
      });
    }

    // Бой без врагов (битые ключи карт) — не стартуем, иначе вечный пустой бой.
    if (enemies.length === 0) throw new Error('initCombat: no enemies generated');

    // --- Camp life: 1,2,3 — лагерь у костра (1 спит), 4,5,6 — часовые,
    // 7,8,9 — патруль, 10+ — подкрепление на 40 ход. ---
    const activeEnemies = enemies.slice(0, 10);
    const pendingReinforce: GridEnemy[] = enemies.slice(10).map((e) => ({
      ...e, aiRole: 'reinforce' as const, aggro: false, sleeping: false, speech: null, knowsPlayer: false,
    }));
    const taken = new Set<string>([`${playerPos.x},${playerPos.y}`]);
    for (const e of activeEnemies) taken.add(`${e.pos.x},${e.pos.y}`);

    // Костёр рядом с первой тройкой.
    const campGroup = activeEnemies.slice(0, 3);
    // Костёр — в любом месте карты, но не ближе 20 клеток от героя.
    // Первая тройка встаёт кольцом уже вокруг него.
    let fireSpot = { x: 20, y: 20 };
    for (let a = 0; a < 80; a++) {
      const rx = 2 + Math.floor(Math.random() * (GRID - 4));
      const ry = 2 + Math.floor(Math.random() * (GRID - 4));
      if (taken.has(`${rx},${ry}`)) continue;
      if (Math.hypot(rx - playerPos.x, ry - playerPos.y) < 20) continue;
      fireSpot = { x: rx, y: ry };
      break;
    }
    let campfire = findFreeCellNear(fireSpot.x, fireSpot.y, taken);

    // Лагерь: кольцо вокруг костра.
    const ringDirs = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
      { dx: 1, dy: 1 }, { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 },
    ];
    campGroup.forEach((e, k) => {
      const d = ringDirs[k % ringDirs.length];
      const spot = findFreeCellNear(campfire.x + d.dx, campfire.y + d.dy, taken);
      taken.add(`${spot.x},${spot.y}`);
      e.pos = spot;
      e.aiRole = 'camp';
      e.aggro = false;
      e.sleeping = false;
      e.speech = null;
      e.rotation = Math.atan2(campfire.y - spot.y, campfire.x - spot.x) * (180 / Math.PI);
    });
    // Спящий у костра: всегда 1 (если лагерь не пуст).
    const sleepCount = campGroup.length >= 1 ? 1 : 0;
    const shuffled = [...campGroup].sort(() => Math.random() - 0.5);
    for (let s = 0; s < sleepCount; s++) shuffled[s].sleeping = true;

    // Часовые: дальние свободные точки (20+ клеток от игрока), стоят и крутятся.
    for (let k = 3; k < Math.min(6, activeEnemies.length); k++) {
      const e = activeEnemies[k];
      let spot = { x: 30, y: 30 };
      for (let a = 0; a < 80; a++) {
        const rx = 4 + Math.floor(Math.random() * (GRID - 8));
        const ry = 4 + Math.floor(Math.random() * (GRID - 8));
        if (taken.has(`${rx},${ry}`)) continue;
        if (Math.hypot(rx - playerPos.x, ry - playerPos.y) < 20) continue;
        spot = { x: rx, y: ry };
        break;
      }
      const free = findFreeCellNear(spot.x, spot.y, taken);
      taken.add(`${free.x},${free.y}`);
      e.pos = free;
      e.aiRole = 'sentry';
      e.aggro = false;
      e.sleeping = false;
      e.speech = null;
      e.rotation = Math.floor(Math.random() * 360);
    }

    // Патруль: рядом, одно случайное направление на всех (индекс 9 тоже сюда,
    // иначе остаётся без роли и стоит столбом).
    const patrolIdx: number[] = [];
    for (let k = 6; k < Math.min(10, activeEnemies.length); k++) patrolIdx.push(k);
    if (patrolIdx.length > 0) {
      const anchor = findFreeCellNear(10 + Math.floor(Math.random() * 12), 8 + Math.floor(Math.random() * 12), taken);
      const pDirs = [
        { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
        { dx: 1, dy: 1 }, { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 },
      ];
      const sharedDir = pDirs[Math.floor(Math.random() * pDirs.length)];
      patrolIdx.forEach((k, j) => {
        const e = activeEnemies[k];
        const off = ringDirs[j % ringDirs.length];
        const spot = findFreeCellNear(anchor.x + off.dx, anchor.y + off.dy, taken);
        taken.add(`${spot.x},${spot.y}`);
        e.pos = spot;
        e.aiRole = 'patrol';
        e.aggro = false;
        e.sleeping = false;
        e.speech = null;
        e.patrolDir = { ...sharedDir };
        e.rotation = Math.atan2(sharedDir.dy, sharedDir.dx) * (180 / Math.PI);
      });
    }

    // Дальники (не ближний бой, не медики): 50% занимают укрытия в бою.
    for (const e of activeEnemies) {
      const nm = `${e.name} ${e.factionKey || ''}`;
      const isMedic = nm.toLowerCase().includes('medic') || nm.toLowerCase().includes('медик');
      e.coverSeeker = !isMeleeEnemy(nm) && !isMedic && (e.rangeDistance || 7) >= 5 && Math.random() < 0.5;
    }

    // Боссы: всегда патрулируют (не спят, не сидят, не сторожат),
    // скиллы — шквал+рейдж и 1 случайная легендарка (всего 3, суммон удалён).
    const bossDirs = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
      { dx: 1, dy: 1 }, { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 },
    ];
    for (const e of activeEnemies) {
      if (!isBossEnemy(e.name, (e as any).factionKey)) continue;
      const d = bossDirs[Math.floor(Math.random() * bossDirs.length)];
      e.aiRole = 'patrol';
      e.sleeping = false;
      e.sleepTurns = undefined;
      e.aggro = false;
      e.speech = null;
      e.searching = false;
      e.patrolDir = { ...d };
      e.rotation = Math.atan2(d.dy, d.dx) * (180 / Math.PI);
      e.skillUse = ['madness', 'rage', LEGENDARY_BOSS_SKILLS[Math.floor(Math.random() * LEGENDARY_BOSS_SKILLS.length)]];
    }

    // --- Мусорщики-союзники (карточка помощи): рядом с героем, статы обычных
    // стрелков военных, сразу в бой (aggro + knowsPlayer), модель-сталкер наугад.
    const allyNum = Math.max(0, Math.min(6, Math.floor(allyCount || 0)));
    if (allyNum > 0 && ENEMY_BASE_STATS['Военные (original)']) {
      const aBase = ENEMY_BASE_STATS['Военные (original)'];
      const aTotalMult = levelMult * extraMult;
      const stalkerModels = ['stalker1', 'stalker2', 'stalker3'];
      for (let a = 0; a < allyNum; a++) {
        const ax = Math.max(1, Math.min(GRID - 2, playerPos.x + 2 + (a % 3)));
        const ay = Math.max(1, Math.min(GRID - 2, playerPos.y + 1 + Math.floor(a / 3)));
        const spot = findFreeCellNear(ax, ay, taken);
        taken.add(`${spot.x},${spot.y}`);
        const model = stalkerModels[Math.floor(Math.random() * stalkerModels.length)];
        // Мусорщики крепче обычных стрелков: +30% к здоровью.
        const aHp = Math.round(aBase.health * aTotalMult * 1.3);
        // Хабар с мёртвого мусорщика — как с обычного стрелка.
        let aLoot: any[] = [];
        try {
          aLoot = generateLoot(GAME_ITEMS, playerLevel, { rank: 'regular' });
        } catch { /* ignore */ }
        const aDmg = Math.round(aBase.damage * aTotalMult);
        activeEnemies.push({
          id: `ally_${a}_${Date.now()}`,
          name: 'Мусорщик',
          faction: 'Союзник',
          factionKey: 'Мусорщики',
          dps: aDmg * (1 + (aBase.speed * aTotalMult || 0)),
          speed: aBase.speed * aTotalMult,
          currentHp: aHp,
          maxHp: aHp,
          health: aBase.health,
          damage: aDmg,
          armor: Math.round(aBase.armor * aTotalMult),
          accuracy: Math.min(2, aBase.accuracy + accuracyAdd),
          evasion: Math.min(1, aBase.evasion * aTotalMult),
          block: aBase.block * aTotalMult,
          punching: aBase.punching * aTotalMult,
          vampir: aBase.vampir * aTotalMult,
          crit: aBase.crit * aTotalMult,
          regen: (aBase.regen || 0) * aTotalMult,
          pos: spot,
          isHit: false,
          dead: false,
          runAp: aBase.runAp || 4,
          rotation: 0,
          rangeDistance: aBase.rangeDistance || 7,
          shotPrice: aBase.shotPrice || 1,
          skillUse: [],
          cooldowns: {},
          isInvisible: false,
          invisTurns: 0,
          baseEvasion: aBase.evasion || 0,
          isEnraged: false,
          rageTurns: 0,
          hasSummoned: false,
          bigModel: '100%',
          isSpinning: false,
          loot: aLoot,
          looted: false,
          soundAttack: aBase.soundAttack || 'shotenemy',
          nowModel: model,
          deadModel: 'dead',
          avatar: model,
          aiRole: 'patrol',
          aggro: true,
          knowsPlayer: true,
          alertTurn: 0,
          speech: null,
          patrolDir: { dx: 1, dy: 0 },
          callsign: dealCallsign(),
        });
      }
      get().addBattleLog(`🤝 Мусорщики пришли на помощь (${allyNum})! В своих не стрелять.`);
    }

    // Generate obstacles with safe zones around player and enemies
    const obstacles = generateObstacles(playerPos, activeEnemies);

    // Костёр не должен оказаться внутри стены: сдвигаем на свободную.
    if (!isCellWalkable(campfire.x, campfire.y, obstacles)) {
      const blocked = new Set<string>(taken);
      for (const o of obstacles) {
        for (let dx = 0; dx < (o.w || 1); dx++) {
          for (let dy = 0; dy < (o.h || 1); dy++) blocked.add(`${o.x + dx},${o.y + dy}`);
        }
      }
      campfire = findFreeCellNear(campfire.x, campfire.y, blocked);
    }

    const playerAbilities = [...usePlayerStore.getState().accessoryAbilities].filter((a) => a && !a.passive);
    const abilityCooldowns = playerAbilities.map(() => 0);
    // Дальность — от ствола; ближний бой и кулаки: клетка вокруг.
    const startRange = gun && !gunIsMelee ? weaponRangeProfile(gun).range : 1.5;

    set({
      isActive: true, playerPos, enemies: activeEnemies, obstacles,
      playerAbilities, abilityCooldowns, selectedAbility: null,
      playerInvisible: false, playerInvisTurns: 0, immortalityTurns: 0,
      turn: 'player', ap: BASE_AP, maxAp: BASE_AP, ammo: startAmmo, maxAmmo: ammoCap,
      range: startRange, isDefensiveMode: false,
      turnCount: 0, lastShotTurn: 0, selectedEnemy: null,
      message: gun && !gunIsMelee && startAmmo <= 0 ? `❌ Нет патронов (${ammoGroupName(ammoTypeForWeapon(gun))})!` : '⚔️ Твой ход',
      isVictory: false, isDefeat: false, isMoving: false, isSelected: false,
      playerRotation: 90, popups: [], shotLine: null,
      flyingGrenade: null, globalEffects: [], lootingEnemy: null,
      plannedPath: [], reserve: [], battleLogs: ['⚔️ Бой начался!'],
      exploredCells: {},
      campfire, pendingReinforce, reinforceSpawned: false,
      corpseSearch: null, alarmRaised: false, noSleep: false,
      battleId: get().battleId + 1,
      stealth: false,
    });
    get().addBattleLog(`⚔️ Бой начался! Противников: ${activeEnemies.filter((e) => e.faction !== 'Союзник').length}`);
    return true;
    } catch (e) {
      console.error('[initCombat]', e);
      // Первая зарядка уже списана из рюкзака — вернуть в рюкзак и обнулить
      // магазин (иначе дубли: и в рюкзаке, и в оружии).
      try {
        if (tookFromPack > 0 && gun && !gunIsMelee) {
          usePlayerStore.getState().returnAmmoToPack(ammoTypeForWeapon(gun), tookFromPack, tookQuality);
          const gs = gunSlot;
          usePlayerStore.setState((st: any) => ({
            equipment: {
              ...st.equipment,
              [gs]: st.equipment[gs] ? { ...st.equipment[gs], loadedAmmo: 0, loadedAmmoQuality: 'Обычный', loadedAmmoBreakdown: undefined } : st.equipment[gs],
            },
          }));
          usePlayerStore.getState().syncEquippedItem(gs);
        }
      } catch { /* ignore */ }
      // Не оставляем полуживой бой: чистим сетку, caller решит что дальше.
      try { get().cleanup(); } catch { /* ignore */ }
      return false;
    }
  },

  movePlayer: (x, y) => {
    const state = get();
    if (state.turn !== 'player' || state.ap <= 0 || state.isMoving) return;
    if (!state.isSelected) return;
    const path = findPath({ x: state.playerPos.x, y: state.playerPos.y }, { x, y }, state.obstacles);
    if (path.length === 0) return;
    if (path.length - 1 > state.ap) { get().addMessage('❌ Не хватает AP'); return; }

    // Check cell isn't occupied by living enemy
    for (const e of state.enemies) {
      if (!e.dead && e.pos.x === x && e.pos.y === y) return;
    }

    set({ isDefensiveMode: false, isMoving: true, isSelected: false, plannedPath: [] });
    playCombatSound('run', 0.15);
    const stepsTaken = path.length - 1;

    // Animate movement with steps
    let step = 1;
    const animateInterval = setInterval(() => {
      if (step >= path.length) {
        clearInterval(animateInterval);
        const newAp = state.ap - stepsTaken;
        set((s) => ({
          playerPos: { x: path[path.length - 1].x, y: path[path.length - 1].y },
          ap: newAp,
          playerRotation: getAngle(path[path.length - 2] || path[0], path[path.length - 1]),
          isMoving: false,
          message: `🚶 Шагнул (AP: ${newAp}/${s.maxAp})`,
        }));
        stopCombatSound('run');
        if (newAp <= 0) {
          // AP кончились — ход завершается сам. Одни на поле: endTurn просто
          // вернёт полный AP и свободное перемещение; есть враги: ход врага.
          get().endTurn();
        }
        return;
      }
      const prev = path[step - 1];
      const curr = path[step];
      set({
        playerPos: { x: curr.x, y: curr.y },
        playerRotation: getAngle(prev, curr),
      });
      playCombatSound('run', 0.15);
      step++;
    }, 220);
  },

  handleKeyboardMove: (dx, dy) => {
    const state = get();
    if (state.turn !== 'player' || state.ap <= 0 || state.isMoving) return;
    const nx = state.playerPos.x + dx;
    const ny = state.playerPos.y + dy;
    if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) return;
    for (const e of state.enemies) {
      if (!e.dead && e.pos.x === nx && e.pos.y === ny) return;
    }
    if (state.isCellBlocked(nx, ny)) {
      get().addMessage('❌ Путь преграждён');
      return;
    }
    const angle = getAngle(state.playerPos, { x: nx, y: ny });
    const newAp = state.ap - 1;
    set({
      playerPos: { x: nx, y: ny },
      ap: newAp,
      playerRotation: angle,
      isDefensiveMode: false,
      message: `🚶 Шаг (AP: ${newAp}/${state.maxAp})`,
    });
    playCombatSound('run', 0.15);
    if (newAp <= 0) {
      // Одни на поле — тоже самозавершение: endTurn вернёт AP и свободный бег.
      get().endTurn();
    }
  },

  rotatePlayer: (x, y) => {
    const state = get();
    // Вертеться можно всегда (и на ходу врага) — остальное заблокировано как было.
    if (state.isMoving) return;
    const angle = getAngle(state.playerPos, { x, y });
    set({ playerRotation: angle });
  },

  selectMe: () => {
    const state = get();
    if (state.turn !== 'player' || state.isMoving) return;
    set({ isSelected: !state.isSelected, plannedPath: [] });
    if (!state.isSelected) get().addMessage('🎯 Выбери клетку для перемещения');
    else get().addMessage('');
  },

  setPlannedPath: (path) => set({ plannedPath: path }),

  selectAbility: (index) => {
    const s = get();
    if (s.turn !== 'player') return;
    const ability = s.playerAbilities[index];
    if (!ability) return;
    if (s.abilityCooldowns[index] > 0) return;
    if (s.ap < ability.apCost) { get().addMessage('❌ Не хватает AP'); return; }
    set({ selectedAbility: s.selectedAbility === index ? null : index });
  },

  useAbility: (enemyId) => {
    const state = get();
    if (state.turn !== 'player' || state.isMoving) return;
    const idx = state.selectedAbility;
    if (idx === null || idx === undefined) { get().addMessage('❌ Выбери способность'); return; }
    const ability = state.playerAbilities[idx];
    if (!ability) { set({ selectedAbility: null }); return; }
    if (state.abilityCooldowns[idx] > 0) { get().addMessage('❌ Способность перезаряжается'); set({ selectedAbility: null }); return; }
    if (state.ap < ability.apCost) { get().addMessage('❌ Не хватает AP'); return; }

    // Активные способности требуют расходник из рюкзака (пассивки ammo_* — бесплатно).
    if (!ability.passive) {
      const ps = usePlayerStore.getState();
      const stack = ps.backpackContents.find((i) => i.type === 'consumable' && (i as any).abilityId === ability.id);
      if (!stack) {
        const need = CONSUMABLE_MAP[ability.id]?.name || ability.name;
        get().addMessage(`❌ Нужен расходник: ${need}`);
        set({ selectedAbility: null });
        return;
      }
      if (!ps.consumeFromPack(stack.id)) {
        get().addMessage(`❌ Нужен расходник: ${stack.displayName || stack.name}`);
        set({ selectedAbility: null });
        return;
      }
      get().addBattleLog(`🧪 Использован расходник: ${stack.displayName || stack.name}`);
    }

    // Barrage: fire 20 random shots, no target needed
    if (ability.id === 'barrage') {
      const alive = state.enemies.filter((e) => !e.dead && e.currentHp > 0);
      if (alive.length === 0) { set({ selectedAbility: null }); return; }
      playCombatSound('m134', 0.3);
      get().addBattleLog(`🌊 ${ability.name}: 20 выстрелов по случайным целям!`);
      const baseDmg = usePlayerStore.getState().stats.damage || 5;
      for (let i = 0; i < 20; i++) {
        setTimeout(() => {
          const s = get();
          const targets = s.enemies.filter((e) => !e.dead && e.currentHp > 0);
          if (targets.length === 0) return;
          const pick = targets[Math.floor(Math.random() * targets.length)];
          const rawDmg = Math.round(Math.max(1, baseDmg * 0.5 * (1 - pick.armor * 0.01)));
          pick.currentHp = Math.max(0, pick.currentHp - rawDmg);
          pick.isHit = true;
          set({ shotLine: { from: s.playerPos, to: pick.pos, kind: 'burst', count: 1 } });
          setTimeout(() => { const st = get(); if (st.shotLine?.to === pick.pos) set({ shotLine: null }); }, 300);
          get().addPopup(pick.pos.x, pick.pos.y, `-${rawDmg} 🌊`, 'DMG');
          if (pick.currentHp <= 0) {
            pick.dead = true;
            pick.isHit = false;
            get().addBattleLog(`💀 ${pick.name} уничтожен!`);
          }
          if (i === 19) set({ enemies: [...get().enemies] });
          else set({ enemies: [...s.enemies] });
        }, i * 200);
      }
      const newCooldowns = [...state.abilityCooldowns];
      newCooldowns[idx] = ability.cooldown;
      set({ abilityCooldowns: newCooldowns, ap: state.ap - ability.apCost, selectedAbility: null, selectedEnemy: null, message: `🌊 ${ability.name} (AP: ${state.ap - ability.apCost})` });
      return;
    }

    const targetEnemy = enemyId != null
      ? state.enemies.find((e) => e.id === enemyId)
      : null;

    // По своим способностями не бьём: мусорщики — друзья.
    if (targetEnemy && targetEnemy.faction === 'Союзник') {
      get().addMessage('🤝 Свои! В мусорщиков не стреляем.');
      set({ selectedAbility: null });
      return;
    }

    // If ability has damage effects or requiresTarget flag, require a target
    const needsTarget = ability.effects.some((ef) => ef.type === 'damage' || ef.type === 'mark_zone') || ability.requiresTarget;
    if (needsTarget && !targetEnemy) {
      get().addMessage('❌ Выбери цель для этой способности');
      set({ selectedAbility: null });
      return;
    }

    // Per-ability range check
    if (targetEnemy && ability.range != null) {
      const dist = getDist(state.playerPos, targetEnemy.pos);
      if (dist > ability.range) {
        get().addMessage(`❌ ${ability.name}: цель вне радиуса (${ability.range})`);
        set({ selectedAbility: null });
        return;
      }
    }

    // Visibility check for targeted abilities
    if (needsTarget && targetEnemy) {
      if (!checkVisibility(state.playerPos, state.playerRotation, targetEnemy.pos, state.obstacles, { fov: 360 })) {
        get().addMessage(`❌ ${ability.name}: цель за препятствием`);
        set({ selectedAbility: null });
        return;
      }
    }

    // Mine: place on grid instead of effect processing
    if (ability.id === 'mine') {
      set({ isPlacingMine: true, message: '💣 Выбери клетку для мины' });
      get().addBattleLog('💣 Мина: выбери клетку для установки');
      const newCooldowns = [...state.abilityCooldowns];
      newCooldowns[idx] = ability.cooldown;
      const newAp = get().ap - ability.apCost;
      set({
        abilityCooldowns: newCooldowns,
        ap: newAp,
        selectedAbility: null,
        selectedEnemy: null,
        message: `💣 ${ability.name} (AP: ${newAp})`,
        enemies: [...state.enemies],
      });
      return;
    }

    // Execute all effects
    for (const effect of ability.effects) {
      const type = effect.type;

      if (type === 'heal_percent') {
        const player = usePlayerStore.getState();
        const healAmt = Math.round(player.stats.maxHp * (effect as AbilityEffect & { type: 'heal_percent' }).value / 100);
        playCombatSound('medshot4', 0.4);
        usePlayerStore.setState((st: any) => ({
          stats: { ...st.stats, currentHp: Math.min(st.stats.maxHp, st.stats.currentHp + healAmt) },
        }));
        get().addPopup(state.playerPos.x, state.playerPos.y, `+${healAmt} ❤️`, 'HEAL');
        get().addBattleLog(`🩹 ${ability.name}: +${healAmt} HP`);
      }

      if (type === 'heal_flat') {
        const val = (effect as AbilityEffect & { type: 'heal_flat' }).value;
        usePlayerStore.setState((st: any) => ({
          stats: { ...st.stats, currentHp: Math.min(st.stats.maxHp, st.stats.currentHp + val) },
        }));
        get().addPopup(state.playerPos.x, state.playerPos.y, `+${val} ❤️`, 'HEAL');
      }

      if (type === 'damage') {
        const dmgEffect = effect as AbilityEffect & { type: 'damage' };
        if (targetEnemy) {
          const baseDmg = usePlayerStore.getState().stats.damage || 5;
          const dmg = Math.round(baseDmg * dmgEffect.multiplier);
          const aoe = dmgEffect.aoe || 1;

          // Snipe: 4s aim delay, x15 damage
          if (ability.id === 'snipe') {
            playCombatSound('snayperskoy', 0.4);
            set({ shotLine: { from: state.playerPos, to: targetEnemy.pos, type: 'aim' } });
            get().addBattleLog(`🎯 ${ability.name}: прицеливание...`);
            setTimeout(() => {
              const s = get();
              const tgt = s.enemies.find((e: GridEnemy) => e.id === targetEnemy.id);
              if (!tgt || tgt.dead || tgt.currentHp <= 0) { set({ shotLine: null }); return; }
              // Прилёт: вторая вспышка + пуля в момент урона.
              set({ shotLine: { from: s.playerPos, to: tgt.pos, kind: 'single', count: 1, power: 1.6 } });
              setTimeout(() => set({ shotLine: null }), 600);
              const rawDmg = Math.round(Math.max(1, dmg * (1 - tgt.armor * 0.01)));
              tgt.currentHp = Math.max(0, tgt.currentHp - rawDmg);
              tgt.isHit = true;
              set({ shotLine: null, enemies: [...s.enemies] });
              get().addPopup(tgt.pos.x, tgt.pos.y, `-${rawDmg} 🎯`, 'DMG');
              if (tgt.currentHp <= 0) {
                tgt.dead = true; tgt.isHit = false;
                get().addBattleLog(`💀 ${tgt.name} уничтожен!`);
              }
              get().triggerShake();
            }, 4000);
            continue;
          }

          // Bazooka (shock): 2s delay, red line, screen shake
          if (ability.id === 'shock') {
            playCombatSound('bazooka_sound_effect', 0.4);
            set({ shotLine: { from: state.playerPos, to: targetEnemy.pos, type: 'bazooka', kind: 'single', count: 1, power: 1.8 } });
            get().addBattleLog(`🚀 ${ability.name}: выстрел...`);
            setTimeout(() => {
              const s = get();
              const tgt = s.enemies.find((e: GridEnemy) => e.id === targetEnemy.id);
              if (!tgt || tgt.dead || tgt.currentHp <= 0) { set({ shotLine: null }); return; }
              // Прилёт базуки в момент урона.
              set({ shotLine: { from: s.playerPos, to: tgt.pos, kind: 'single', count: 1, power: 1.8 } });
              setTimeout(() => set({ shotLine: null }), 600);
              const rawDmg = Math.round(Math.max(1, dmg * (1 - tgt.armor * 0.01)));
              get().triggerShake();
              s.enemies.forEach((e: GridEnemy) => {
                if (e.dead) return;
                const dist = Math.abs(e.pos.x - tgt.pos.x) + Math.abs(e.pos.y - tgt.pos.y);
                if (dist <= 3) {
                  const splashDmg = Math.round(rawDmg * (1 - dist * 0.15));
                  e.currentHp = Math.max(0, e.currentHp - splashDmg);
                  e.isHit = true;
                  get().addPopup(e.pos.x, e.pos.y, `-${splashDmg} 💥`, 'DMG');
                  if (e.currentHp <= 0) { e.dead = true; e.isHit = false; get().addBattleLog(`💀 ${e.name} уничтожен!`); }
                }
              });
              set({ enemies: [...s.enemies] });
            }, 2000);
            continue;
          }

          // Berserker sacrifice: lose 30% HP, deal 50% enemy HP as damage (custom handler, not standard damage)
          if (ability.id === 'berserk_sacrifice') {
            playCombatSound('Maim', 0.4);
            const s = get();
            const tgt = s.enemies.find((e: GridEnemy) => e.id === targetEnemy.id);
            if (!tgt || tgt.dead || tgt.currentHp <= 0) continue;
            const playerStats = usePlayerStore.getState().stats;
            const hpCost = Math.round(playerStats.currentHp * 0.3);
            usePlayerStore.setState((st: any) => ({
              stats: { ...st.stats, currentHp: Math.max(1, st.stats.currentHp - hpCost) },
            }));
            get().addPopup(s.playerPos.x, s.playerPos.y, `💀 -${hpCost} HP`, 'DMG');
            get().addBattleLog(`💀 ${ability.name}: потеряно ${hpCost} HP`);
            const pctDmg = Math.round(tgt.currentHp * 0.5);
            tgt.currentHp = Math.max(0, tgt.currentHp - pctDmg);
            tgt.isHit = true;
            set({ shotLine: { from: s.playerPos, to: tgt.pos, kind: 'single', count: 1, power: 1.2 } });
            setTimeout(() => set({ shotLine: null }), 400);
            get().addPopup(tgt.pos.x, tgt.pos.y, `💀 -${pctDmg}`, 'DMG');
            get().addBattleLog(`💀 ${ability.name}: ${tgt.name} теряет ${pctDmg} HP`);
            if (tgt.currentHp <= 0) {
              tgt.dead = true; tgt.isHit = false;
              get().addBattleLog(`💀 ${tgt.name} уничтожен!`);
            }
            set({ enemies: [...s.enemies] });
            continue;
          }

          if (ability.id === 'grenade') {
            // Animated grenade: 2s flight + explosion
            playCombatSound('grenadegun', 0.4);
            set({ flyingGrenade: { from: state.playerPos, to: targetEnemy.pos } });
            get().addBattleLog(`💣 ${ability.name}: бросок...`);
            setTimeout(() => {
              const s = get();
              set({ flyingGrenade: null });
              const radius = Math.ceil(Math.sqrt(2) / 2);
              const enemies = s.enemies.map((e: GridEnemy) => {
                if (e.dead) return e;
                const dist = Math.abs(e.pos.x - targetEnemy.pos.x) + Math.abs(e.pos.y - targetEnemy.pos.y);
                if (dist <= radius) {
                  const finalDmg = Math.round(dmg * (1 - dist * 0.15));
                  e.currentHp = Math.max(0, e.currentHp - finalDmg);
                  get().addPopup(e.pos.x, e.pos.y, `-${finalDmg}`, 'DMG');
                  if (e.currentHp <= 0) {
                    e.dead = true; e.isHit = false;
                    get().addBattleLog(`💀 ${e.name} уничтожен!`);
                  }
                }
                return e;
              });
              set({ enemies });
              get().triggerShake();
              // Add explosion global effect
              set((st: any) => ({
                globalEffects: [...st.globalEffects, { type: 'GRENADE' as const, pos: { ...targetEnemy.pos }, damage: 0, timer: 2 }],
              }));
              setTimeout(() => set((st: any) => ({ globalEffects: st.globalEffects.filter((g: any) => g.timer > 1) })), 2000);
            }, 2000);
            continue;
          }

          if (aoe > 1) {
            // Area damage (non-grenade AOE)
            const radius = Math.ceil(Math.sqrt(aoe) / 2);
            for (const e of state.enemies) {
              if (e.dead) continue;
              const dist = Math.abs(e.pos.x - targetEnemy.pos.x) + Math.abs(e.pos.y - targetEnemy.pos.y);
              if (dist <= radius) {
                const finalDmg = Math.round(dmg * (1 - dist * 0.15));
                e.currentHp = Math.max(0, e.currentHp - finalDmg);
                get().addPopup(e.pos.x, e.pos.y, `-${finalDmg}`, 'DMG');
                if (e.currentHp <= 0) {
                  e.dead = true;
                  e.isHit = false;
                  get().addBattleLog(`💀 ${e.name} уничтожен!`);
                }
              }
            }
          } else {
            // Single target
            if (ability.id === 'aimshot') {
              playCombatSound('Silvertarget', 0.4);
            set({ shotLine: { from: state.playerPos, to: targetEnemy.pos, type: 'aim', kind: 'single', count: 1, power: 1.6 } });
              setTimeout(() => set({ shotLine: null }), 600);
              const finalDmg = Math.round(Math.max(1, dmg));
              targetEnemy.currentHp = Math.max(0, targetEnemy.currentHp - finalDmg);
              targetEnemy.isHit = true;
              get().addPopup(targetEnemy.pos.x, targetEnemy.pos.y, `-${finalDmg} 🎯`, 'DMG');
            } else {
              if (ability.id === 'hammer_strike') playCombatSound('Corruption', 0.4);
              const finalDmg = Math.round(Math.max(1, dmg * (1 - targetEnemy.armor * 0.01)));
              targetEnemy.currentHp = Math.max(0, targetEnemy.currentHp - finalDmg);
              targetEnemy.isHit = true;
              get().addPopup(targetEnemy.pos.x, targetEnemy.pos.y, `-${finalDmg} 🎯`, 'DMG');
            }

            // Ram: knockback 2 cells + stun
            if (ability.id === 'ram') {
              playCombatSound('SkullBasher', 0.4);
              const dx = targetEnemy.pos.x - state.playerPos.x;
              const dy = targetEnemy.pos.y - state.playerPos.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist > 0) {
                const nx = Math.round(dx / dist);
                const ny = Math.round(dy / dist);
                let pushX = targetEnemy.pos.x + nx * 2;
                let pushY = targetEnemy.pos.y + ny * 2;
                const obs = get().obstacles;
                const blocked = obs.some((o) => o.x === pushX && o.y === pushY && o.blocks);
                const occupied = get().enemies.some((e) => e.id !== targetEnemy.id && !e.dead && e.pos.x === pushX && e.pos.y === pushY);
                if (blocked || occupied) {
                  pushX = targetEnemy.pos.x + nx;
                  pushY = targetEnemy.pos.y + ny;
                }
                targetEnemy.pos.x = pushX;
                targetEnemy.pos.y = pushY;
                get().triggerShake();
                get().addPopup(pushX, pushY, '💥 ОТБРОС!', 'SPECIAL');
              }
              playCombatSound('melee', 0.4);
            }

            if (targetEnemy.currentHp <= 0) {
              targetEnemy.dead = true;
              targetEnemy.isHit = false;
              get().addBattleLog(`💀 ${targetEnemy.name} уничтожен!`);
            }
          }
          get().triggerShake();
        }
      }

      if (type === 'stat_boost') {
        const boost = effect as AbilityEffect & { type: 'stat_boost' };
        // Enemy debuff (acid armor reduction)
        if (boost.stat === 'enemyArmorReduction' && targetEnemy) {
          if (ability.id === 'acid') playCombatSound('arci', 0.4);
          const reduction = targetEnemy.armor * boost.value;
          targetEnemy.armor = Math.max(0, targetEnemy.armor - reduction);
          get().addPopup(targetEnemy.pos.x, targetEnemy.pos.y, `☠️ Броня -${Math.round(boost.value * 100)}%`, 'DEBUFF');
          get().addBattleLog(`☠️ ${ability.name}: броня ${targetEnemy.name} снижена на ${Math.round(boost.value * 100)}% (${boost.duration} хода)`);
          continue;
        }
        if (ability.id === 'armor_shred') playCombatSound('Battle_Fury', 0.4);
        if (ability.id === 'vampiric') playCombatSound('Mask_of_Madness', 0.4);
        if (ability.id === 'block_stance') playCombatSound('Armlet', 0.4);
        if (ability.id === 'wind_speed') playCombatSound('speed1', 0.4);
        const player = usePlayerStore.getState();
        const existing = player.activeEffects.find((e) => e.id === `ability_${ability.id}`);
        if (existing) {
          existing.remaining = Math.max(existing.remaining, boost.duration);
        } else {
          usePlayerStore.getState().addEffect({
            id: `ability_${ability.id}`,
            name: ability.name,
            duration: boost.duration,
            remaining: boost.duration,
            statBoosts: { [boost.stat]: boost.value },
          });
        }
        get().addPopup(state.playerPos.x, state.playerPos.y, `✨ ${boost.stat}+${boost.value}`, 'BUFF');
        get().addBattleLog(`✨ ${ability.name}: ${boost.stat} +${boost.value} на ${boost.duration} хода`);
      }

      if (type === 'stat_boost_mult') {
        const boost = effect as AbilityEffect & { type: 'stat_boost_mult' };
        if (ability.id === 'barrier') playCombatSound('Buckler', 0.4);
        if (ability.id === 'rage') playCombatSound('BlackKing', 0.4);
        if (ability.id === 'fortify') playCombatSound('442', 0.4);
        if (ability.id === 'adrenaline') playCombatSound('Bottle_Pour', 0.4);
        const player = usePlayerStore.getState();
        const existing = player.activeEffects.find((e) => e.id === `ability_${ability.id}`);
        if (existing) {
          existing.remaining = Math.max(existing.remaining, boost.duration);
        } else {
          usePlayerStore.getState().addEffect({
            id: `ability_${ability.id}`,
            name: ability.name,
            duration: boost.duration,
            remaining: boost.duration,
            statBoosts: {},
            statBoostsMult: { [boost.stat]: boost.value },
          });
        }
        const multText = boost.stat === 'incomingDamageMult' ? `${Math.round((1 - boost.value) * 100)}%` : `×${1 + boost.value}`;
        get().addPopup(state.playerPos.x, state.playerPos.y, `✨ ${boost.stat} ${multText}`, 'BUFF');
        get().addBattleLog(`✨ ${ability.name}: ${boost.stat} ${multText} на ${boost.duration} хода`);
      }

      if (type === 'heal_over_time') {
        if (ability.id === 'regen') playCombatSound('tablets', 0.4);
        const hot = effect as AbilityEffect & { type: 'heal_over_time' };
        const player = usePlayerStore.getState();
        const existing = player.activeEffects.find((e) => e.id === `ability_${ability.id}`);
        if (existing) {
          existing.remaining = Math.max(existing.remaining, hot.duration);
        } else {
          usePlayerStore.getState().addEffect({
            id: `ability_${ability.id}`,
            name: ability.name,
            duration: hot.duration,
            remaining: hot.duration,
            statBoosts: {},
            statBoostsMult: { healOverTime: hot.value },
          });
        }
        get().addPopup(state.playerPos.x, state.playerPos.y, `💚 +${Math.round(hot.value * 100)}%/ход`, 'HEAL');
        get().addBattleLog(`💚 ${ability.name}: +${Math.round(hot.value * 100)}% HP/ход на ${hot.duration} хода`);
      }

      if (type === 'status') {
        const statusEffect = effect as AbilityEffect & { type: 'status' };
        if (statusEffect.id === 'evasion') {
          playCombatSound('LotusOrbcast', 0.4);
          get().addBattleLog(`👤 ${ability.name} активирована (${statusEffect.id})`);
          usePlayerStore.getState().addEffect({
            id: `ability_${statusEffect.id}`,
            name: ability.name,
            duration: statusEffect.duration,
            remaining: statusEffect.duration,
            statBoosts: { evasion: 1 },
          });
        }
        if (statusEffect.id === 'shield') {
          playCombatSound('MaximumArmor', 0.4);
          usePlayerStore.setState((st: any) => ({
            stats: { ...st.stats, shieldCharges: 3 },
          }));
          get().addPopup(state.playerPos.x, state.playerPos.y, '🛡️ ЩИТ (3 атаки)!', 'BUFF');
          get().addBattleLog(`🛡️ ${ability.name}: поглощает 3 атаки`);
        }
        if (statusEffect.id === 'invisibility') {
          playCombatSound('invis', 0.4);
          set({ playerInvisible: true, playerInvisTurns: statusEffect.duration });
          get().addPopup(state.playerPos.x, state.playerPos.y, '👻 НЕВИДИМОСТЬ!', 'BUFF');
          get().addBattleLog(`👻 ${ability.name}: невидимость на ${statusEffect.duration} хода`);
        }
        if (statusEffect.id === 'stun' && targetEnemy) {
          playCombatSound('Echo_Sabre', 0.4);
          targetEnemy.stunned = true;
          targetEnemy.stunTurns = statusEffect.duration;
          get().addPopup(targetEnemy.pos.x, targetEnemy.pos.y, '⚡ СТАН!', 'SPECIAL');
          get().addBattleLog(`⚡ ${ability.name}: цель оглушена на ${statusEffect.duration} ход`);
        }
      }

      if (type === 'teleport') {
        set({ isTeleporting: true, message: '✨ Выбери клетку для телепортации' });
        get().addBattleLog(`✨ ${ability.name}: выбери клетку для телепортации`);
      }

      if (type === 'summon') {
        const player = usePlayerStore.getState();
        const spawnPos = { x: state.playerPos.x + 1, y: state.playerPos.y };
        get().addPopup(spawnPos.x, spawnPos.y, '👥 ПРИЗЫВ!', 'SPECIAL');
        const clone: GridEnemy = {
          id: `clone_${Date.now()}`,
          name: 'Клон',
          faction: 'Союзник',
          currentHp: Math.max(500, Math.round((player.stats.maxHp || 200) * 0.5)),
          maxHp: Math.max(500, Math.round((player.stats.maxHp || 200) * 0.5)),
          damage: Math.round((player.stats.damage || 10) * 0.5),
          dps: Math.round((player.stats.damage || 10) * 0.5),
          armor: Math.round((player.stats.armor || 0) * 0.5),
          accuracy: player.stats.accuracy || 0.8,
          evasion: (player.stats.evasion || 0) * 0.5,
          block: (player.stats.block || 0) * 0.5,
          punching: (player.stats.punching || 0) * 0.5,
          vampir: (player.stats.vampir || 0) * 0.5,
          crit: (player.stats.crit || 0) * 0.5,
          regen: (player.stats.regen || 0) * 0.5,
          pos: spawnPos,
          isHit: false, dead: false,
          runAp: 4, rotation: 90, rangeDistance: 5, shotPrice: 1,
          skillUse: [], cooldowns: {},
          isInvisible: false, invisTurns: 0, baseEvasion: (player.stats.evasion || 0) * 0.5,
          isEnraged: false, rageTurns: 0, hasSummoned: false,
          bigModel: '100%', isSpinning: false,
          loot: [], looted: false,
          isMinion: true,
          lifetime: 3,
        };
        set((s) => ({ enemies: [...s.enemies, clone] }));
        get().addBattleLog(`👥 ${ability.name}: призван клон (${Math.max(500, Math.round((player.stats.maxHp || 200) * 0.5))} HP, ${Math.round((player.stats.damage || 10) * 0.5)} DMG, 3 хода)`);
      }

      if (type === 'mark_zone') {
        const mark = effect as AbilityEffect & { type: 'mark_zone' };
        if (targetEnemy) {
          const zone: GlobalEffect = {
            type: 'REDZONE',
            pos: { x: targetEnemy.pos.x, y: targetEnemy.pos.y },
            damage: (usePlayerStore.getState().stats.damage || 5) * mark.damageMultiplier,
            timer: mark.duration,
            ownerId: undefined,
          };
          set((s) => ({ globalEffects: [...s.globalEffects, zone] }));
          get().addBattleLog(`🚨 ${ability.name}: красная зона отмечена (${mark.duration} хода)`);
        }
      }

      if (type === 'sprint_boost') {
        const sprint = effect as AbilityEffect & { type: 'sprint_boost' };
        const bonusAp = sprint.value ?? 10;
        usePlayerStore.getState().addEffect({
          id: `ability_sprint`,
          name: ability.name,
          duration: sprint.duration,
          remaining: sprint.duration,
          statBoosts: { speed: 0.5 },
        });
        if (ability.id === 'stimulant') playCombatSound('Butterfly', 0.4);
        playCombatSound('Phase_Boots', 0.4);
        get().addBattleLog(`🏃 ${ability.name}: +${bonusAp} AP на ${sprint.duration} ход`);
        set((s) => ({ maxAp: s.maxAp + bonusAp, ap: s.ap + bonusAp }));
      }
    }

    // Block stance: reduce maxAp by 1
    if (ability.id === 'block_stance') {
      set((s) => ({ maxAp: Math.max(1, s.maxAp - 1), ap: Math.min(s.ap, s.maxAp - 1) }));
    }

    // Second wind: sacrifice 90% HP, gain immortality for 3 turns
    if (ability.id === 'second_wind') {
      const player = usePlayerStore.getState();
      const newHp = Math.round(player.stats.maxHp * 0.1);
      const sacrifice = player.stats.currentHp - newHp;
      usePlayerStore.setState((st) => ({ stats: { ...st.stats, currentHp: newHp } }));
      set({ immortalityTurns: 3 });
      playCombatSound('Aeon_Disk', 0.4);
      get().addPopup(state.playerPos.x, state.playerPos.y, `💀 -${sacrifice} HP`, 'DAMAGE');
      get().addPopup(state.playerPos.x, state.playerPos.y, '🛡️ БЕССМЕРТИЕ! (3 хода)', 'BUFF');
      get().addBattleLog(`💀 ${ability.name}: -${sacrifice} HP, бессмертие 3 хода`);
    }

    // Apply costs and cooldown
    const newCooldowns = [...state.abilityCooldowns];
    newCooldowns[idx] = ability.cooldown;
    const newAp = get().ap - ability.apCost;
    set({
      abilityCooldowns: newCooldowns,
      ap: newAp,
      selectedAbility: null,
      selectedEnemy: null,
      message: `✨ ${ability.name} (AP: ${newAp})`,
      enemies: [...state.enemies],
    });

    // Skip turn if required
    if (ability.skipTurn) {
      get().addBattleLog(`⏭️ ${ability.name}: ход пропущен`);
      const hasEnemies = get().enemies.some((e) => !e.dead) || get().reserve.length > 0;
      if (hasEnemies) {
        setTimeout(() => get().endTurn(), 300);
      }
    }
  },

  tickAbilityCooldowns: () => {
    set((s) => ({
      abilityCooldowns: s.abilityCooldowns.map((c) => Math.max(0, c - 1)),
    }));
  },

  selectEnemy: (id) => set({ selectedEnemy: id }),

  teleportTo: (x, y) => {
    const state = get();
    if (!state.isTeleporting) return;
    const isBlocked = state.enemies.some((e: any) => !e.dead && e.pos.x === x && e.pos.y === y)
      || state.obstacles.some((o: any) => o.x === x && o.y === y && o.blocks);
    if (isBlocked) { get().addMessage('❌ Клетка занята'); return; }
    const visible = checkVisibility(state.playerPos, state.playerRotation, { x, y }, state.obstacles);
    if (!visible) { get().addMessage('❌ Клетка не видна'); return; }
    const angle = getAngle(state.playerPos, { x, y });
    set({ playerPos: { x, y }, playerRotation: angle, isTeleporting: false, isSelected: false, plannedPath: [], message: '✨ Телепорт!' });
    playCombatSound('Blink', 0.4);
    get().addPopup(x, y, '✨ ТЕЛЕПОРТ!', 'SPECIAL');
    get().addBattleLog(`✨ Телепорт на (${x}, ${y})`);
    // Teleport landing visual effect
    set((st: any) => ({
      globalEffects: [...st.globalEffects, { type: 'TELEPORT_LAND' as const, pos: { x, y }, damage: 0, timer: 2 }],
    }));
    setTimeout(() => set((st: any) => ({ globalEffects: st.globalEffects.filter((g: any) => g.type !== 'TELEPORT_LAND') })), 2000);
  },

  placeMine: (x, y) => {
    const state = get();
    if (!state.isPlacingMine) return;
    if (getDist(state.playerPos, { x, y }) > 3) { get().addMessage('❌ Слишком далеко (макс 3)'); return; }
    const isBlocked = state.enemies.some((e: any) => !e.dead && e.pos.x === x && e.pos.y === y)
      || state.obstacles.some((o: any) => o.x === x && o.y === y && o.blocks);
    if (isBlocked) { get().addMessage('❌ Клетка занята'); return; }
    const playerStats = usePlayerStore.getState().stats;
    const mineDmg = Math.round(playerStats.damage * 10);
    set((st: any) => ({
      globalEffects: [...st.globalEffects, { type: 'MINE', pos: { x, y }, damage: mineDmg, timer: 999 }],
      isPlacingMine: false, isSelected: false, message: '💣 Мина установлена!',
    }));
    get().addPopup(x, y, '💣 МИНА', 'SPECIAL');
    get().addBattleLog(`💣 Мина установлена на (${x}, ${y})`);
  },

  checkAutoTriggers: () => {
  },

  setIsSelected: (v) => set({ isSelected: v }),

  attackEnemy: (enemyId) => {
    const state = get();
    if (state.turn !== 'player' || state.isMoving) return;
    const shotCost = 1;
    if (state.ap < shotCost) { get().addMessage('❌ Не хватает AP'); return; }
    if (state.ammo <= 0) {
      // Магазин пуст: без оружия — кулаки (бесплатно), с оружием — нужны патроны группы.
      const w0 = usePlayerStore.getState().getActiveWeapon();
      const grp0 = w0 && w0.ammoCapacity ? ammoTypeForWeapon(w0) : null;
      if (grp0) {
        if (useUiStore.getState().autoReload !== false) get().reload();
        if (get().ammo <= 0) {
          get().addMessage(`❌ Нет патронов (${ammoGroupName(grp0)})!`);
          return;
        }
      } else if (useUiStore.getState().autoReload !== false) { get().reload(); return; }
      else { get().addMessage('❌ Нет патронов! Нажми R для перезарядки'); return; }
    }
    // Автоперезарядка выше могла съесть последний AP — перепроверить,
    // иначе выстрел уходит в минус (-1/5).
    if (get().ap < shotCost) { get().addMessage('❌ Не хватает AP'); return; }

    const enemy = state.enemies.find((e) => e.id === enemyId);
    if (!enemy || enemy.dead) return;
    // По своим не стреляем: мусорщики — друзья.
    if (enemy.faction === 'Союзник') {
      get().addMessage('🤝 Свои! В мусорщиков не стреляем.');
      return;
    }

    const dist = getDist(state.playerPos, enemy.pos);
    const effectiveRange = state.range;
    if (dist > effectiveRange) { get().addMessage('❌ Вне радиуса атаки'); return; }

    if (!checkVisibility(state.playerPos, state.playerRotation, enemy.pos, state.obstacles, { fov: 360 })) {
      get().addMessage('❌ Цель за препятствием');
      return;
    }

    // Ближний бой активен (холодное или кулаки): удар по 3 клеткам спереди.
    // Без пуль и трассеров, звук клинка из игры.
    const meleeW = usePlayerStore.getState().getActiveWeapon();
    const isMeleeAttack = !meleeW || ((meleeW as any).slot === 'weapon1' && !(meleeW as any).ammoCapacity);
    if (isMeleeAttack) {
      const player = usePlayerStore.getState();
      const angle = getAngle(state.playerPos, enemy.pos);
      set({ playerRotation: angle, lastShotTurn: get().turnCount });
      playCombatSound('melee', 0.5);
      get().triggerShake();
      // 3 клетки спереди: вперёд + две по бокам от вектора взгляда.
      const rad = (angle * Math.PI) / 180;
      const fdx = Math.round(Math.cos(rad));
      const fdy = Math.round(Math.sin(rad));
      const px = state.playerPos.x;
      const py = state.playerPos.y;
      const cells = [
        { x: px + fdx, y: py + fdy },
        { x: px + fdx - fdy, y: py + fdy + fdx },
        { x: px + fdx + fdy, y: py + fdy - fdx },
      ];
      let effectiveDps = player.stats.damage;
      const faction = enemy.faction;
      const pureDmg = calcPureDamage(player.stats, faction);
      if (player.stats.stamina < 0.1 * player.stats.maxStamina) effectiveDps *= 0.5;
      const attackerStats = {
        dps: effectiveDps,
        pure: pureDmg,
        crit: player.stats.crit,
        accuracy: player.stats.accuracy,
        punching: player.stats.punching,
        vampir: player.stats.vampir,
        isPlayer: true,
        forceCritMult: state.stealth ? 5 : 0,
      };
      const hitIds = new Set<string | number>();
      const strikeOne = (t: GridEnemy) => {
        const targetStats = applyTerrainToTarget(
          { armor: t.armor, evasion: t.evasion, block: t.block },
          t.pos,
          state.obstacles,
        );
        const result = calculateCombatResult(attackerStats, targetStats);
        const actualDmg = Math.round(result.damage);
        hitIds.add(t.id);
        set((s) => ({
          ap: s.ap,
          ammo: s.ammo,
          enemies: s.enemies.map((e) =>
            e.id === t.id ? { ...e, currentHp: Math.max(0, e.currentHp - actualDmg), isHit: true, sleeping: false, aggro: true, knowsPlayer: true, alertTurn: get().turnCount } : e
          ),
          message: `🗡️ ${result.text}`,
          selectedEnemy: null,
          stealth: false,
        }));
        get().addPopup(t.pos.x, t.pos.y, result.text, result.type);
        const vampHeal = Math.round(actualDmg * (player.stats.vampir || 0));
        if (vampHeal > 0) {
          usePlayerStore.setState((st: any) => ({
            stats: { ...st.stats, currentHp: Math.min(st.stats.maxHp, st.stats.currentHp + vampHeal) },
          }));
          get().addPopup(t.pos.x, t.pos.y, `+${vampHeal} 🩸`, 'VAMP');
        }
      };
      for (const c of cells) {
        const targets = get().enemies.filter((e) =>
          !e.dead && e.currentHp > 0 && e.faction !== 'Союзник' && e.pos.x === c.x && e.pos.y === c.y,
        );
        for (const t of targets) strikeOne(t);
      }
      // Страховка: кликнутого соседнего врага бьём всегда, даже если
      // геометрия дуги его не накрыла (мертвая зона диагоналей и т.п.).
      if (hitIds.size === 0) {
        const fb = get().enemies.find((e) => e.id === enemy.id && !e.dead && e.currentHp > 0);
        if (fb && getDist(state.playerPos, fb.pos) <= 1.5) {
          strikeOne(fb);
        } else {
          get().addMessage('🗡️ Мимо! Рядом никого.');
        }
      }
      // Смерти + добивка резерва как в огнестреле.
      setTimeout(() => {
        let killed = 0;
        set((s2) => ({
          enemies: s2.enemies.map((e) => {
            if (hitIds.has(e.id) && !e.dead && e.currentHp <= 0) {
              killed += 1;
              return { ...e, dead: true, isHit: false };
            }
            return e;
          }),
        }));
        if (killed > 0) get().addBattleLog(`🗡️ Удар ближнего боя: убито ${killed}`);
        const allDead = get().enemies.every((e) => e.dead);
        if (allDead && get().reserve.length > 0) {
          get().spawnWave(2);
        }
      }, 200);
      const nextAp = get().ap;
      if (nextAp < 1) {
        setTimeout(() => {
          get().endTurn();
        }, 800);
      }
      return;
    }

    const player = usePlayerStore.getState();
    const angle = getAngle(state.playerPos, enemy.pos);
    const pshot = shotKindForPlayerWeapon();
    set({ playerRotation: angle, shotLine: { from: state.playerPos, to: enemy.pos, kind: pshot.kind, count: pshot.count, power: pshot.power, fast: pshot.fast, sound: pshot.sound }, lastShotTurn: get().turnCount });
    setTimeout(() => set({ shotLine: null }), 400);

    // Физа идёт через формулу одна; стихия фракции — чистым уроном поверх.
    let effectiveDps = player.stats.damage;
    const faction = enemy.faction;
    const pureDmg = calcPureDamage(player.stats, faction);
    if (player.stats.stamina < 0.1 * player.stats.maxStamina) effectiveDps *= 0.5;

    // +30% damage for low-capacity weapons (1-3 rounds, с учётом магазина-мода)
    const gunNow = usePlayerStore.getState().getActiveWeapon();
    if (gunNow && effectiveAmmoCapacity(gunNow) <= 3 && (gunNow as any).ammoCapacity) {
      effectiveDps *= 1.3;
    }
    // Качество патронов в магазине: +0% и далее +5% за ранг.
    const ammoMult = bulletDamageMult((gunNow as any)?.loadedAmmoQuality);
    if (ammoMult > 1) effectiveDps *= ammoMult;

    const attackerStats = {
      dps: effectiveDps,
      pure: pureDmg,
      crit: player.stats.crit,
      accuracy: player.stats.accuracy,
      punching: player.stats.punching,
      vampir: player.stats.vampir,
      isPlayer: true,
      // Первый выстрел из скрытности — всегда критический x5.
      forceCritMult: state.stealth ? 5 : 0,
    };
    const targetStats = applyTerrainToTarget(
      {
        armor: enemy.armor,
        evasion: enemy.evasion,
        block: enemy.block,
      },
      enemy.pos,
      state.obstacles,
    );

    const result = calculateCombatResult(attackerStats, targetStats);
    const actualDmg = Math.round(result.damage);
    const vampHeal = Math.round(actualDmg * (player.stats.vampir || 0));

    set((s) => ({
      ap: Math.max(0, s.ap - shotCost),
      ammo: Math.max(0, s.ammo - 1),
      enemies: s.enemies.map((e) =>
        e.id === enemyId ? { ...e, currentHp: Math.max(0, e.currentHp - actualDmg), isHit: true, sleeping: false, aggro: true, knowsPlayer: true, alertTurn: get().turnCount } : e
      ),
      message: ammoMult > 1 ? `💥 ${result.text} (+${Math.round((ammoMult - 1) * 100)}% патроны)` : `💥 ${result.text}`,
      selectedEnemy: null,
      // Выстрел срывает скрытность.
      stealth: false,
    }));

    get().addPopup(enemy.pos.x, enemy.pos.y, result.text, result.type);

    // Стихийные дебафы: шанс = значение стихии (только если попали и цель жива).
    if (actualDmg > 0) get().procElementalDebuffs(enemyId);

    // Выстрел услышали все в радиусе 20 от жертвы — бегут в бой.
    get().aggroWave(enemy.pos);

    // Vamp + regen
    usePlayerStore.setState((st) => ({
      stats: {
        ...st.stats,
        currentHp: Math.min(st.stats.maxHp, st.stats.currentHp + vampHeal + (player.stats.regen || 0)),
      },
    }));

    if (vampHeal > 0) get().addPopup(state.playerPos.x, state.playerPos.y, `+${vampHeal} 🩸`, 'VAMP');
    if ((player.stats.regen || 0) > 0) get().addPopup(state.playerPos.x, state.playerPos.y, `+${Math.round(player.stats.regen || 0)} HP`, 'HEAL');

    // Extra shots from speed (no AP/ammo cost)
    const bonusShots = calcExtraShots(player.stats.speed || 0);
    for (let i = 0; i < bonusShots; i++) {
      const delay = 500 * (i + 1);
      setTimeout(() => {
        const st = get();
        const en = st.enemies.find((en) => en.id === enemyId);
        if (!en || en.dead || en.currentHp <= 0) return;
        // Бонус-выстрел тоже ест патрон из магазина (с оружием); пусто — пропуск.
        const w2b = usePlayerStore.getState().getActiveWeapon();
        if (w2b && w2b.ammoCapacity) {
          if (get().ammo <= 0) return;
          set((s) => ({ ammo: s.ammo - 1 }));
        }

        const pStats = usePlayerStore.getState().stats;
        let effDps = pStats.damage;
        const fac = en.faction;
        const pureBonus = calcPureDamage(pStats, fac);
        if (pStats.stamina < 0.1 * pStats.maxStamina) effDps *= 0.5;

        // +30% damage for low-capacity weapons (1-3 rounds, с учётом магазина-мода)
        const pState = usePlayerStore.getState();
        const w2 = pState.getActiveWeapon();
        if (w2 && (w2 as any).ammoCapacity && effectiveAmmoCapacity(w2) <= 3) {
          effDps *= 1.3;
        }
        // Качество патронов в магазине.
        const bAmmoMult = bulletDamageMult((w2 as any)?.loadedAmmoQuality);
        if (bAmmoMult > 1) effDps *= bAmmoMult;

        const atkStat = { dps: effDps, pure: pureBonus, crit: pStats.crit, accuracy: pStats.accuracy, punching: pStats.punching, vampir: pStats.vampir, isPlayer: true };
        const tgtStat = applyTerrainToTarget(
          { armor: en.armor, evasion: en.evasion, block: en.block },
          en.pos,
          st.obstacles,
        );
        const res = calculateCombatResult(atkStat, tgtStat);
        const dmg = Math.round(res.damage);

        const bshot = shotKindForPlayerWeapon();
        set({ shotLine: { from: st.playerPos, to: en.pos, kind: bshot.kind, count: bshot.count, power: bshot.power, fast: bshot.fast, sound: bshot.sound } });
        setTimeout(() => set({ shotLine: null }), 400);

        set((s) => ({
          enemies: s.enemies.map((e) =>
            e.id === enemyId ? { ...e, currentHp: Math.max(0, e.currentHp - dmg), isHit: true } : e
          ),
        }));

        get().addPopup(en.pos.x, en.pos.y, res.text, res.type);
        get().addPopup(st.playerPos.x, st.playerPos.y, '+1 🏃', 'BUFF');
        // Стихийные дебафы и на бонус-выстрелах.
        if (dmg > 0) get().procElementalDebuffs(enemyId);

        setTimeout(() => {
          set((s) => ({ enemies: s.enemies.map((e) => e.id === enemyId ? { ...e, isHit: false } : e) }));
        }, 300);

        const vamp = Math.round(dmg * (pStats.vampir || 0));
        if (vamp > 0) {
          usePlayerStore.setState((st) => ({ stats: { ...st.stats, currentHp: Math.min(st.stats.maxHp, st.stats.currentHp + vamp) } }));
          get().addPopup(st.playerPos.x, st.playerPos.y, `+${vamp} 🩸`, 'VAMP');
        }
      }, delay);
    }

    setTimeout(() => {
      set((s) => ({ enemies: s.enemies.map((e) => e.id === enemyId ? { ...e, isHit: false } : e) }));
    }, 300);

    // Check death
    setTimeout(() => {
      const s = get();
      const updatedEnemy = s.enemies.find((e) => e.id === enemyId);
      if (updatedEnemy && updatedEnemy.currentHp <= 0) {
        // Corpse separation
        const hasCorpseOnCell = s.enemies.some(
          (e) => e.id !== enemyId && e.dead && e.pos.x === updatedEnemy.pos.x && e.pos.y === updatedEnemy.pos.y,
        );
        let corpsePos = { ...updatedEnemy.pos };
        if (hasCorpseOnCell) {
          corpsePos = findFreeSpotForCorpse(updatedEnemy.pos, s.enemies, s.obstacles, enemyId);
        }

        let freshLoot: any[] = [];
        try {
          freshLoot = generateLoot(GAME_ITEMS, usePlayerStore.getState().level, {
            rank: rankOfEnemy((updatedEnemy as any).factionKey, updatedEnemy.name),
          });
        } catch (e) { /* ignore */ }
        const screamIdx = Math.floor(Math.random() * 5) + 1;
        playCombatSound(`wilhelm_scream${screamIdx}`, 0.3);
        set((s2) => ({
          enemies: s2.enemies.map((e) =>
            e.id === enemyId ? { ...e, dead: true, loot: freshLoot, looted: false, pos: corpsePos } : e
          ),
          message: `💀 ${updatedEnemy.name} уничтожен! Кликни для лута`,
        }));
        get().addBattleLog(`💀 ${updatedEnemy.name} уничтожен!`);
        const allDead = get().enemies.every((e) => e.dead);
        if (allDead) {
          const hasReserve = get().reserve.length > 0;
          if (hasReserve) {
            get().spawnWave(2);
          }
        }
      }
    }, 200);

    // Конус (дробь/огнемёт) и площадь (базуки): задевают соседей основной цели.
    // Своих не задевает. Патрон уже списан один — за всю очередь.
    try {
      const w2fx = usePlayerStore.getState().getActiveWeapon();
      const wprof = w2fx ? weaponRangeProfile(w2fx) : null;
      if (wprof && (wprof.cone || wprof.aoe) && actualDmg > 0) {
        const px = state.playerPos.x;
        const py = state.playerPos.y;
        const splashTargets: GridEnemy[] = [];
        if (wprof.cone) {
          const baseA = Math.atan2(enemy.pos.y - py, enemy.pos.x - px);
          for (const o of get().enemies) {
            if (o.id === enemy.id || o.dead || o.currentHp <= 0 || o.faction === 'Союзник') continue;
            if (getDist(state.playerPos, o.pos) > effectiveRange + 0.5) continue;
            let da = Math.abs(Math.atan2(o.pos.y - py, o.pos.x - px) - baseA);
            da = Math.min(da, Math.PI * 2 - da);
            if (da <= Math.PI / 6) splashTargets.push(o);
          }
        } else if (wprof.aoe) {
          for (const o of get().enemies) {
            if (o.id === enemy.id || o.dead || o.currentHp <= 0 || o.faction === 'Союзник') continue;
            const dd = Math.max(Math.abs(o.pos.x - enemy.pos.x), Math.abs(o.pos.y - enemy.pos.y));
            if (dd <= (wprof.aoe || 1)) splashTargets.push(o);
          }
        }
        if (splashTargets.length > 0) {
          const splashIds = new Set(splashTargets.map((o) => o.id));
          const dealt = new Map<string | number, number>();
          set((s) => ({
            enemies: s.enemies.map((e) => {
              if (!splashIds.has(e.id)) return e;
              const dd = Math.max(Math.abs(e.pos.x - enemy.pos.x), Math.abs(e.pos.y - enemy.pos.y));
              const d = wprof.cone ? actualDmg : Math.round(actualDmg * (1 - dd * 0.15));
              dealt.set(e.id, d);
              const hp = Math.max(0, e.currentHp - d);
              return { ...e, currentHp: hp, isHit: true, dead: hp <= 0, sleeping: false, aggro: true, knowsPlayer: true };
            }),
          }));
          for (const o of splashTargets) {
            get().addPopup(o.pos.x, o.pos.y, `-${dealt.get(o.id) ?? actualDmg}`, 'DMG');
          }
          setTimeout(() => {
            set((s) => ({ enemies: s.enemies.map((e) => (splashIds.has(e.id) ? { ...e, isHit: false } : e)) }));
          }, 300);
          const deadSplash = splashTargets.filter((o) => (dealt.get(o.id) ?? 0) >= o.currentHp);
          if (deadSplash.length > 0) get().addBattleLog(`💥 ${wprof.cone ? 'Конус задел' : 'Взрыв задел'}: ${deadSplash.map((o) => o.name).join(', ')}`);
        }
      }
    } catch { /* best effort */ }

    // Auto end turn if AP runs out (одни на поле — тоже: вернёт AP и свободный бег).
    // AP уже списан выше (ap - shotCost): вычитать ещё раз нельзя, иначе ход
    // кончается на 1 AP раньше (баг: выстрел при 2 AP завершал ход).
    const nextAp = get().ap;
    if (nextAp < 1) {
      setTimeout(() => {
        get().endTurn();
      }, 800);
    }
  },

  finishBattle: () => {
    const state = get();
    const playerStore = usePlayerStore.getState();
    const lu = playerStore.skillUtility();
    const expReward = Math.floor(playerStore.combat.enemyExpReward * (1 + playerStore.level * 0.1) * lu.xpMultiplier);
    const chipReward = Math.floor(playerStore.combat.enemyChipReward * lu.chipMultiplier);
    playerStore.addExp(expReward);
    playerStore.addChips(chipReward);
    playerStore.addLog(`🏆 Победа! +${expReward} опыта, +${chipReward} чипов`, 'loot');

    // Награда за карту: сундук качества карты (уровень зафиксирован) вместо предмета.
    if (state.cardRarityName) {
      try {
        const chest = createChest(state.cardRarityName, playerStore.level);
        useInventoryStore.getState().addItem(chest);
        playerStore.addLog(`🎁 Награда: ${chest.displayName || chest.name} — открой двойным кликом в инвентаре`, 'loot');
      } catch (e) { /* ignore */ }
    }

    playerStore.addLog('🚀 Возвращаемся на базу...', 'loot');
    playerStore.startReturnHome();
    usePlayerStore.setState((st) => ({
      combat: { ...st.combat, isFighting: false },
    }));
    get().cleanup();
  },

  lootEnemy: (enemyId, itemId) => {
    const state = get();
    const enemy = state.enemies.find((e) => e.id === enemyId);
    if (!enemy || !enemy.loot) return;
    const itemIndex = enemy.loot.findIndex((li: any) => li.id === itemId);
    if (itemIndex === -1) return;
    const item = enemy.loot[itemIndex];
    try { useInventoryStore.getState().addItem(item); } catch (e) { /* ignore */ }
    const newLoot = [...enemy.loot];
    newLoot.splice(itemIndex, 1);
    set((s) => ({
      enemies: s.enemies.map((e) => e.id === enemyId ? { ...e, loot: newLoot } : e),
    }));
    const displayName = item.displayName || item.name || 'предмет';
    get().addPopup(enemy.pos.x, enemy.pos.y, `📦 ВЗЯТО: ${displayName}`, 'SUCCESS');
    get().addBattleLog(`📦 Взято: ${displayName}`);
  },

  closeLoot: () => set({ lootingEnemy: null }),

  setLooted: (enemyId) => {
    set((s) => ({
      enemies: s.enemies.map((e) => e.id === enemyId ? { ...e, looted: true } : e),
    }));
  },

  setEnemyLootById: (enemyId, itemId) => {
    set((s) => ({
      enemies: s.enemies.map((e) => {
        if (e.id !== enemyId || !e.loot) return e;
        const newLoot = e.loot.filter((li: any) => li.id !== itemId);
        return { ...e, loot: newLoot };
      }),
    }));
  },

  spawnWave: async (count) => {
    const state = get();
    const newEnemies: GridEnemy[] = [];
    const usedCells = new Set<string>();
    for (const e of state.enemies) {
      usedCells.add(`${e.pos.x},${e.pos.y}`);
    }

    for (let i = 0; i < count; i++) {
      const playerLevel = usePlayerStore.getState().level;
      const base = generateEnemy(playerLevel, 1);
      // Позывной без повторов с живыми в бою (включая свою же волну).
      const used = new Set([...state.enemies, ...newEnemies].map((e) => (e as GridEnemy).callsign));
      const free = CALLSIGNS.filter((c) => !used.has(c));
      const waveCallsign = free.length > 0
        ? free[Math.floor(Math.random() * free.length)]
        : pickPhrase(CALLSIGNS);
      let attempts = 0;
      let spawnX: number, spawnY: number;
      do {
        spawnX = GRID - 3 - Math.floor(Math.random() * 4);
        spawnY = 15 + Math.floor(Math.random() * 10);
        attempts++;
      } while (usedCells.has(`${spawnX},${spawnY}`) && attempts < 50);
      usedCells.add(`${spawnX},${spawnY}`);

      const newId = `wave-${Date.now()}-${i}`;
      newEnemies.push({
        id: newId,
        name: base.faction || 'Враг',
        faction: base.faction || 'Неизвестно',
        dps: base.scaledDamage * (1 + base.scaledSpeed),
        speed: base.scaledSpeed,
        currentHp: base.scaledHealth,
        maxHp: base.scaledHealth,
        health: base.health,
        damage: base.scaledDamage,
        armor: base.scaledArmor,
        accuracy: base.scaledAccuracy,
        evasion: base.scaledEvasion,
        block: base.scaledBlock,
        punching: base.scaledPunching,
        vampir: base.scaledVampir,
        crit: base.scaledCrit,
        regen: base.scaledRegen,
        pos: { x: spawnX, y: spawnY },
        isHit: false,
        dead: false,
        runAp: base.runAp || 4,
        rotation: 270,
        rangeDistance: base.rangeDistance || 7,
        shotPrice: base.shotPrice || 1,
        skillUse: [],
        cooldowns: {},
        isInvisible: false,
        invisTurns: 0,
        baseEvasion: base.evasion || 0,
        isEnraged: false,
        rageTurns: 0,
        hasSummoned: false,
        bigModel: '100%',
        isSpinning: false,
        loot: [],
        looted: false,
        soundAttack: base.soundAttack || 'shotenemy',
        nowModel: base.nowModel || 'enemy',
        deadModel: base.dead || 'dead',
        avatar: base.avatar || 'enemy',
        level: base.level || 1,
        callsign: waveCallsign,
      });
    }

    // Боссы из волн: тоже патруль + легендарка, без сна.
    for (const e of newEnemies) {
      if (!isBossEnemy(e.name, (e as any).factionKey)) continue;
      const d = { dx: 1, dy: 0 };
      e.aiRole = 'patrol';
      e.sleeping = false;
      e.aggro = false;
      e.patrolDir = { ...d };
      e.skillUse = ['madness', 'rage', LEGENDARY_BOSS_SKILLS[Math.floor(Math.random() * LEGENDARY_BOSS_SKILLS.length)]];
    }

    set((s) => ({
      enemies: [...s.enemies, ...newEnemies],
      isVictory: false,
      message: `⚠️ Подкрепление! ${count} врагов прибыло`,
      battleLogs: [...get().battleLogs.slice(-199), `⚠️ Подкрепление! ${count} врагов прибыло`],
      turn: 'enemy',
      reserve: s.reserve.length > count ? s.reserve.slice(count) : [],
    }));
  },

  reload: () => {
    const state = get();
    if (state.turn !== 'player') return;
    if (state.ap < 1) { get().addMessage('❌ Нужно 1 AP для перезарядки'); return; }
    if (state.ammo >= state.maxAmmo) { get().addMessage('✅ Патроны полны'); return; }
    // Дозарядка из запаса: без оружия — бесплатно (кулаки), иначе — патроны группы.
    // Магазин — у АКТИВНОГО оружия (Q — смена).
    const w2 = usePlayerStore.getState().getActiveWeapon();
    const wslot = usePlayerStore.getState().activeWeaponSlot;
    if (!w2 || !w2.ammoCapacity) {
      set((s) => ({ ap: s.ap - 1, ammo: s.maxAmmo, message: '🔁 Перезарядился (AP -1)' }));
      get().addPopup(state.playerPos.x, state.playerPos.y, '🔁 ПЕРЕЗАРЯДКА', 'RELOAD');
      return;
    }
    const group = ammoTypeForWeapon(w2);
    const need = state.maxAmmo - state.ammo;
    const res = usePlayerStore.getState().takeAmmoFromPack(group, need);
    const took = res.taken;
    if (took <= 0) {
      get().addMessage(`❌ Нет патронов (${ammoGroupName(group)})!`);
      return;
    }
    // Качество магазина: пустой — качество взятых, дозарядка — худшее из двух.
    const oldQ = (w2 as any).loadedAmmoQuality || 'Обычный';
    const newQ = state.ammo <= 0 ? res.quality : worseQuality(oldQ, res.quality);
    usePlayerStore.setState((st: any) => {
      const cur = st.equipment[wslot];
      if (!cur) return st;
      const bd = { ...((cur as any).loadedAmmoBreakdown || {}) };
      for (const [q, cnt] of Object.entries(res.breakdown)) {
        bd[q] = (bd[q] || 0) + cnt;
      }
      return {
        equipment: {
          ...st.equipment,
          [wslot]: { ...cur, loadedAmmoQuality: newQ, loadedAmmoBreakdown: bd },
        },
      };
    });
    set((s) => ({ ap: s.ap - 1, ammo: s.ammo + took, message: `🔁 +${took} (AP -1)` }));
    // Магазин в оружии = итог после дозарядки (не инкремент: в бою тратился state.ammo).
    const magAfter = get().ammo;
    usePlayerStore.setState((st: any) => ({
      equipment: {
        ...st.equipment,
        [wslot]: st.equipment[wslot] ? { ...st.equipment[wslot], loadedAmmo: magAfter } : st.equipment[wslot],
      },
    }));
    usePlayerStore.getState().syncEquippedItem(wslot);
    get().addPopup(state.playerPos.x, state.playerPos.y, '🔁 ПЕРЕЗАРЯДКА', 'RELOAD');
  },

  cycleWeapon: () => {
    const state = get();
    if (!state.isActive || state.turn !== 'player' || state.isMoving) return;
    const pst = usePlayerStore.getState();
    const order = ['weapon1', 'weapon2', 'gun_pistol', 'gun_shotgun', 'gun_sniper', 'gun_heavy'] as const;
    const owned = order.filter((s) => (pst.equipment as any)[s]);
    if (owned.length === 0) { get().addMessage('❌ Нет оружия'); return; }
    if (owned.length === 1) { get().addMessage('❌ Только один ствол'); return; }
    const curIdx = owned.indexOf(pst.activeWeaponSlot as any);
    const next = owned[(curIdx + 1) % owned.length] as any;
    // Пишем магазин текущего.
    const curSlot = pst.activeWeaponSlot;
    const curGun = (pst.equipment as any)[curSlot];
    if (curGun && curGun.ammoCapacity) {
      // Сортируем breakdown: убираемqualities с нулевым количеством.
      const curBd = (curGun as any).loadedAmmoBreakdown;
      const cleanBd = curBd ? Object.fromEntries(Object.entries(curBd).filter(([, v]) => (v as number) > 0)) : undefined;
      usePlayerStore.setState((st: any) => ({
        equipment: {
          ...st.equipment,
          [curSlot]: { ...st.equipment[curSlot], loadedAmmo: state.ammo, loadedAmmoBreakdown: cleanBd },
        },
      }));
      pst.syncEquippedItem(curSlot);
    }
    // Берём следующее: свой магазин или первая зарядка из рюкзака.
    const nw = (usePlayerStore.getState().equipment as any)[next];
    let cap = (nw ? effectiveAmmoCapacity(nw) : 0) || 30;    let mag: number;
    if (!nw || !nw.ammoCapacity) {
      mag = cap;
    } else if (typeof nw.loadedAmmo === 'number') {
      mag = Math.max(0, Math.min(cap, nw.loadedAmmo));
    } else {
      const res = usePlayerStore.getState().takeAmmoFromPack(ammoTypeForWeapon(nw), cap);
      mag = res.taken;
      usePlayerStore.setState((st: any) => ({
        equipment: { ...st.equipment, [next]: { ...st.equipment[next], loadedAmmo: mag, loadedAmmoQuality: res.quality, loadedAmmoBreakdown: res.breakdown } },
      }));
      usePlayerStore.getState().syncEquippedItem(next);
    }
    usePlayerStore.setState({ activeWeaponSlot: next });
    usePlayerStore.getState().recalcStats();
    const prof = nw && nw.ammoCapacity ? weaponRangeProfile(nw) : null;
    set({
      ammo: mag,
      maxAmmo: cap,
      range: prof ? prof.range : 1.5,
      selectedEnemy: null,
      message: `🔫 ${nw?.displayName || nw?.name || 'Кулаки'}`,
    });
    get().addBattleLog(`🔫 Смена оружия: ${nw?.displayName || nw?.name || 'кулаки'} (${mag}/${cap})`);
    playCombatSound('85175', 0.5);
  },

  endTurn: () => {
    stopCombatSound('run');
    const state = get();
    if (state.turn !== 'player' || state.isMoving) return;
    // Check all dead + no reserve -> free movement (союзники не в счёт).
    const allDead = state.enemies.every((e) => e.dead || e.faction === 'Союзник');
    const noReserve = state.reserve.length === 0;
    if (allDead && noReserve) {
      set({
        ap: BASE_AP,
        message: '🕊️ Поле зачищено. Свободное перемещение.',
        turnCount: state.turnCount + 1,
      });
      return;
    }
    // Защита от зависания: остался 1-2 противника, 50 ходов ни одного выстрела
    // ни с чьей стороны (застрял/за картой/не достать) — сбежали, бой окончен.
    const hostiles = state.enemies.filter((e) => !e.dead && e.currentHp > 0 && e.faction !== 'Союзник');
    if (hostiles.length >= 1 && hostiles.length <= 2
      && state.reserve.length === 0 && state.pendingReinforce.length === 0
      && (state.turnCount - (state.lastShotTurn ?? 0)) >= 50) {
      const fledIds = new Set(hostiles.map((e) => e.id));
      set((s) => ({ enemies: s.enemies.filter((e) => !fledIds.has(e.id)) }));
      get().addBattleLog(`🏃 Остатки врагов (${hostiles.length}) сбежали с поля боя!`);
      get().addMessage('🏃 Противники сбежали! Бой окончен.');
      get().finishBattle();
      return;
    }
    // Wave every 2 rounds
    const nextTurnCount = state.turnCount + 1;
    if (nextTurnCount % 2 === 0 && state.reserve.length > 0) {
      state.spawnWave(Math.min(3, state.reserve.length));
    }
    get().tickAbilityCooldowns();
    // Tick player effects per turn instead of per real second
    usePlayerStore.getState().tickEffects();
    // Reset maxAp if sprint/rush effect expired
    const st = get();
    const hasRush = usePlayerStore.getState().activeEffects.some((e: any) => e.id === 'ability_sprint');
    if (!hasRush && st.maxAp > BASE_AP && st.maxAp <= BASE_AP + 10) {
      set({ maxAp: BASE_AP, ap: Math.min(st.ap, BASE_AP) });
    }
    // Restore maxAp if block stance effect expired
    const hasBlockStance = usePlayerStore.getState().activeEffects.some((e: any) => e.id === 'ability_block_stance');
    if (!hasBlockStance && st.maxAp < BASE_AP) {
      set({ maxAp: BASE_AP, ap: Math.min(st.ap, BASE_AP) });
    }
    set({ turn: 'enemy', ap: 0, isDefensiveMode: false, isSelected: false, turnCount: nextTurnCount, message: '🤖 Ход врага...' });
  },

  cleanup: () => {
    usePlayerStore.setState((st: any) => ({
      stats: {
        ...st.stats,
        shieldCharges: 0,
        // Целые HP/стамина на выходе из боя (без дробных хвостов).
        currentHp: Math.round(st.stats.currentHp),
        stamina: Math.round(st.stats.stamina),
      },
      activeEffects: (st.activeEffects || []).filter((e: any) => !e.id.startsWith('ability_')),
    }));
    // Остаток магазина — записать в оружие (магазин живёт в оружии, не в рюкзаке).
    // Даже на поражении: рюкзак вайпнут, а оружие остаётся при герое.
    const cs = get();
    if (cs.isActive) {
      const wslot = usePlayerStore.getState().activeWeaponSlot;
      const w2 = usePlayerStore.getState().getActiveWeapon();
      if (w2 && w2.ammoCapacity) {
        try {
          const leftAmmo = cs.ammo;
          usePlayerStore.setState((st: any) => {
            const cur = st.equipment[wslot];
            if (!cur) return st;
            const oldBd: Record<string, number> = (cur as any).loadedAmmoBreakdown || {};
            const oldTotal = Object.values(oldBd).reduce((a, b) => a + (b as number), 0) as number;
            let newBd: Record<string, number> | undefined;
            if (leftAmmo <= 0) {
              newBd = undefined;
            } else if (oldTotal > 0) {
              // Пропорционально уменьшаем breakdown под leftAmmo.
              newBd = {};
              let assigned = 0;
              const entries = Object.entries(oldBd).filter(([, v]) => (v as number) > 0);
              for (let i = 0; i < entries.length; i++) {
                const [q, cnt] = entries[i];
                const share = i === entries.length - 1
                  ? leftAmmo - assigned
                  : Math.round((cnt as number) / oldTotal * leftAmmo);
                if (share > 0) { newBd[q] = share; assigned += share; }
              }
            } else {
              newBd = undefined;
            }
            return {
              equipment: {
                ...st.equipment,
                [wslot]: { ...cur, loadedAmmo: leftAmmo, loadedAmmoQuality: leftAmmo <= 0 ? 'Обычный' : ((w2 as any).loadedAmmoQuality || 'Обычный'), loadedAmmoBreakdown: newBd },
              },
            };
          });
          usePlayerStore.getState().syncEquippedItem(wslot);
        } catch { /* best effort */ }
      }
    }
    set({
      isActive: false, enemies: [], obstacles: [], turn: 'player',
      ap: BASE_AP, turnCount: 0, lastShotTurn: 0, selectedEnemy: null, message: '',
      cursorPos: null, isVictory: false, isMoving: false, popups: [],
      shotLine: null, flyingGrenade: null, globalEffects: [], lootingEnemy: null,
      exploredCells: {}, campfire: null, pendingReinforce: [], reinforceSpawned: false, stealth: false,
      corpseSearch: null, alarmRaised: false, noSleep: false,
      plannedPath: [], isShaking: false, isPlayerHit: false, playerRotation: 90,
      playerAbilities: [], abilityCooldowns: [], selectedAbility: null,
      playerInvisible: false, playerInvisTurns: 0, isTeleporting: false, isPlacingMine: false, immortalityTurns: 0, cardRarityName: null,
      ammo: MAX_AMMO, maxAmmo: MAX_AMMO, isDefensiveMode: false, isSelected: false, reserve: [],
    });
  },
}));

// Enemy skill execution
export async function executeSkill(
  skillName: string,
  enemy: GridEnemy,
  pPos: { x: number; y: number },
  set: any,
  get: any,
  playerStats: any,
): Promise<any> {
  if (enemy.cooldowns?.[skillName] && enemy.cooldowns[skillName] > 0) return null;
  const dist = getDist(enemy.pos, pPos);

  const combatSkills = ['aimShot', 'madness', 'grenade', 'suppression', 'ram', 'invisibility'];
  if (combatSkills.includes(skillName)) {
    let maxRange = enemy.rangeDistance || 7;
    if (skillName === 'ram') maxRange = 8;
    if (skillName === 'aimShot') maxRange = (enemy.rangeDistance || 7) + 3;
    if (dist > maxRange) return null;
  }

  const setCd = (name: string, turns: number) => {
    set((s: any) => ({
      enemies: s.enemies.map((e: GridEnemy) =>
        e.id === enemy.id ? { ...e, cooldowns: { ...e.cooldowns, [name]: turns } } : e,
      ),
    }));
  };

  switch (skillName) {
    case 'rage':
      if (enemy.currentHp < enemy.maxHp * 0.5 && !enemy.isEnraged) {
        enemy.isEnraged = true;
        const currentScale = parseInt(enemy.bigModel) || 100;
        set((s: any) => ({
          enemies: s.enemies.map((e: GridEnemy) =>
            e.id === enemy.id
              ? { ...e, isEnraged: true, rageTurns: 4, bigModel: `${currentScale + 20}%`, regen: (e.regen || 0) * 10, runAp: (e.runAp || 5) * 2 }
              : e,
          ),
        }));
        return { costAp: 0, boostAp: true };
      }
      break;

    case 'aimShot': {
      const aimRange = (enemy.rangeDistance || 7) + 2;
      if (dist > aimRange) return null;
      const angle = getAngle(enemy.pos, pPos);
      playCombatSound('aimShot', 0.4);
      set((s: any) => ({
        enemies: s.enemies.map((e: GridEnemy) => e.id === enemy.id ? { ...e, rotation: angle } : e),
        shotLine: { from: enemy.pos, to: pPos, type: 'aim', kind: 'single', count: 1, power: 1.5 },
      }));
      setTimeout(() => set({ shotLine: null }), 800);
      get().triggerShake();
      const aimDps = (enemy.dps || enemy.damage * (1 + (enemy.speed || 0))) * 2.0;
      const attackerStats = { dps: aimDps, accuracy: (enemy.accuracy || 1) + 2.0, crit: enemy.crit, punching: enemy.punching, vampir: enemy.vampir, isPlayer: false };
      const result = calculateCombatResult(attackerStats, { armor: playerStats.armor, evasion: playerStats.evasion, block: playerStats.block, incomingDamageMult: playerStats.incomingDamageMult });
      if (result.damage > 0) {
        if (!absorbWithShield(pPos)) {
          const finalDmg = Math.round(result.damage);
          usePlayerStore.setState((st: any) => ({
            stats: { ...st.stats, currentHp: Math.max(0, st.stats.currentHp - finalDmg) },
          }));
          get().addPopup(pPos.x, pPos.y, result.text, result.type);
        }
      } else {
        get().addPopup(pPos.x, pPos.y, result.text, 'SPECIAL');
      }
      setCd('aimShot', 5);
      if (!enemy.cooldowns) enemy.cooldowns = {};
      enemy.cooldowns['aimShot'] = 5;
      return { spendAllAp: true };
    }

    case 'invisibility': {
      playCombatSound('invis', 0.4);
      set((s: any) => ({
        enemies: s.enemies.map((e: GridEnemy) =>
          e.id === enemy.id ? { ...e, isInvisible: true, invisTurns: 2, baseEvasion: e.evasion || 0, evasion: 1.0 } : e,
        ),
      }));
      setCd('invisibility', 5);
      if (!enemy.cooldowns) enemy.cooldowns = {};
      enemy.cooldowns['invisibility'] = 5;
      return { costAp: 1 };
    }

    case 'ram': {
      if (Math.round(dist) <= 8 && Math.round(dist) >= 2) {
        const angle = getAngle(enemy.pos, pPos);
        playCombatSound('melee', 0.4);
        set((s: any) => ({
          enemies: s.enemies.map((e: GridEnemy) =>
            e.id === enemy.id ? { ...e, rotation: angle } : e,
          ),
        }));
        const path = findPath(enemy.pos, pPos, get().obstacles, 100);
        if (path && path.length > 1) {
          const finalStep = path[path.length - 2];
          for (let i = 0; i < path.length - 1; i++) {
            const step = path[i];
            set((s: any) => ({
              enemies: s.enemies.map((e: GridEnemy) => e.id === enemy.id ? { ...e, pos: step, rotation: angle } : e),
            }));
            await new Promise((r) => setTimeout(r, 40));
          }
          const ramDps = (enemy.dps || enemy.damage * (1 + (enemy.speed || 0))) * 2;
          const result = calculateCombatResult({ dps: ramDps, accuracy: enemy.accuracy, crit: enemy.crit, punching: enemy.punching, vampir: enemy.vampir, isPlayer: false }, { armor: playerStats.armor, evasion: playerStats.evasion, block: playerStats.block, incomingDamageMult: playerStats.incomingDamageMult });
          get().triggerShake();
          if (result.damage > 0 && !absorbWithShield(pPos)) {
            const finalDmg = Math.round(result.damage);
            usePlayerStore.setState((st: any) => ({
              stats: { ...st.stats, currentHp: Math.max(0, st.stats.currentHp - finalDmg) },
            }));
            get().addPopup(pPos.x, pPos.y, `БА-БАХ! ${result.text}`, result.type);
          } else {
            get().addPopup(pPos.x, pPos.y, `🛡️ ЩИТ выдержал таран!`, 'BLOCK');
          }
          enemy.pos = finalStep;
          setCd('ram', 8);
          if (!enemy.cooldowns) enemy.cooldowns = {};
          enemy.cooldowns['ram'] = 8;
          return { costAp: 3, forcedPos: finalStep, spendAllAp: false };
        }
      }
      break;
    }

    case 'madness': {
      const angle = getAngle(enemy.pos, pPos);
      playCombatSound('m134', 0.3);
      set((s: any) => ({
        enemies: s.enemies.map((e: GridEnemy) => e.id === enemy.id ? { ...e, rotation: angle } : e),
      }));
      for (let i = 0; i < 50; i++) {
        const rndPos = { x: pPos.x + (Math.random() * 1.2 - 0.6), y: pPos.y + (Math.random() * 1.2 - 0.6) };
        set({ shotLine: { from: enemy.pos, to: rndPos, kind: 'boss', count: 2, power: 1.1 } });
        setTimeout(() => set({ shotLine: null }), 100);
        if (Math.random() < 0.25) {
          const basePartDmg = enemy.damage * 1;
          const finalDmg = Math.max(1, basePartDmg - playerStats.armor * 0.2);
          usePlayerStore.setState((st: any) => ({
            stats: { ...st.stats, currentHp: Math.max(0, st.stats.currentHp - finalDmg) },
          }));
          get().addPopup(pPos.x, pPos.y, `-${Math.round(finalDmg)}`, 'ERROR');
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      setCd('madness', 5);
      if (!enemy.cooldowns) enemy.cooldowns = {};
      enemy.cooldowns['madness'] = 5;
      return { costAp: 3 };
    }

    case 'stimulant': {
      if (enemy.currentHp < enemy.maxHp * 0.5 && !(enemy.cooldowns?.['stimulant'] > 0)) {
        const healAmount = enemy.maxHp * 0.3;
        playCombatSound('tablets', 0.4);
        set((s: any) => ({
          enemies: s.enemies.map((e: GridEnemy) =>
            e.id === enemy.id ? { ...e, currentHp: Math.min(e.maxHp, e.currentHp + healAmount) } : e,
          ),
        }));
        enemy.currentHp = Math.min(enemy.maxHp, enemy.currentHp + healAmount);
        if (!enemy.cooldowns) enemy.cooldowns = {};
        enemy.cooldowns['stimulant'] = 10;
        setCd('stimulant', 10);
        get().addPopup(enemy.pos.x, enemy.pos.y, `+${Math.round(healAmount)} 💉 СТИМУЛЯТОР`, 'HEAL');
        get().addBattleLog(`💉 ${enemy.name} вколол стимулятор (+${Math.round(healAmount)} HP)`);
        return { costAp: 4 };
      }
      break;
    }

    case 'summoner': {
      if (enemy.currentHp < enemy.maxHp * 0.6 && !enemy.hasSummoned) {
        const playerLevel = usePlayerStore.getState().level;
        const minionBase = generateEnemy(playerLevel, -80);
        const minion = {
          ...minionBase,
          id: `minion-${Date.now()}`,
          name: `${enemy.name} (помощник)`,
          dps: minionBase.scaledDamage * (1 + minionBase.scaledSpeed),
          speed: minionBase.scaledSpeed,
          currentHp: minionBase.scaledHealth || 200,
          maxHp: minionBase.scaledHealth || 200,
          damage: minionBase.scaledDamage || 5,
          armor: minionBase.scaledArmor || 1,
          accuracy: minionBase.scaledAccuracy || 0.7,
          evasion: minionBase.scaledEvasion || 0.03,
          block: minionBase.scaledBlock || 0,
          punching: minionBase.scaledPunching || 0,
          vampir: minionBase.scaledVampir || 0.001,
          crit: minionBase.scaledCrit || 0,
          regen: minionBase.scaledRegen || 0,
          pos: { x: enemy.pos.x + 1, y: enemy.pos.y },
          isHit: false,
          dead: false,
          runAp: minionBase.runAp || 3,
          rotation: 270,
          rangeDistance: minionBase.rangeDistance || 5,
          shotPrice: 1,
          skillUse: [],
          cooldowns: {},
          isInvisible: false,
          invisTurns: 0,
          baseEvasion: minionBase.evasion || 0,
          isEnraged: false,
          rageTurns: 0,
          hasSummoned: false,
          bigModel: '65%',
          isSpinning: false,
          faction: minionBase.faction || 'Военные',
          loot: [],
          isMinion: true,
        };
        set((s: any) => ({
          enemies: [
            ...s.enemies.map((e: GridEnemy) => e.id === enemy.id ? { ...e, hasSummoned: true } : e),
            minion,
          ],
        }));
        return { costAp: 2 };
      }
      break;
    }

    case 'grenade': {
      if (enemy.cooldowns?.['grenade'] > 0) return null;
      set({ flyingGrenade: { from: enemy.pos, to: { ...pPos } } });
      await new Promise((r) => setTimeout(r, 800));
      set({ flyingGrenade: null });
      set((s: any) => ({
        globalEffects: [
          ...s.globalEffects,
          { type: 'GRENADE' as const, pos: { ...pPos }, damage: enemy.damage * 10, timer: 2 },
        ],
      }));
      setCd('grenade', 8);
      if (!enemy.cooldowns) enemy.cooldowns = {};
      enemy.cooldowns['grenade'] = 8;
      return { costAp: 0 };
    }

      case 'suppression': {
        const isTargetStill = enemy.lastSeenPlayerPos && enemy.lastSeenPlayerPos.x === pPos.x && enemy.lastSeenPlayerPos.y === pPos.y;
        if (isTargetStill) {
          const newCrit = Number(((enemy.crit || 0) + 0.02).toFixed(2));
          const newSpeed = Number(((enemy.speed || 0) + 0.02).toFixed(2));
          const baseDmg = enemy.damage || 0;
          const newDps = Number((baseDmg * (1 + newSpeed)).toFixed(1));
          enemy.crit = newCrit;
          enemy.speed = newSpeed;
          enemy.dps = newDps;
        set((s: any) => ({
          enemies: s.enemies.map((e: GridEnemy) =>
            e.id === enemy.id ? { ...e, crit: newCrit, speed: newSpeed, dps: newDps, lastSeenPlayerPos: { ...pPos } } : e,
          ),
        }));
      } else {
        set((s: any) => ({
          enemies: s.enemies.map((e: GridEnemy) =>
            e.id === enemy.id ? { ...e, lastSeenPlayerPos: { ...pPos } } : e,
          ),
        }));
      }
      return { costAp: 0 };
    }

    // --- Легендарные способности босса (по 1 случайной в бою) ---
    case 'artillery': {
      // Армагеддон: 3 артудара вокруг игрока (зоны с таймером).
      const artRange = (enemy.rangeDistance || 8) + 6;
      if (dist > artRange || enemy.cooldowns?.['artillery'] > 0) return null;
      playCombatSound('grenadeBoom', 0.5);
      get().say(enemy.id, 'Небо падает!');
      get().triggerShake();
      const spots = [{ ...pPos }];
      for (let k = 0; k < 2; k++) {
        spots.push({
          x: Math.max(0, Math.min(31, pPos.x + Math.floor(Math.random() * 5) - 2)),
          y: Math.max(0, Math.min(31, pPos.y + Math.floor(Math.random() * 5) - 2)),
        });
      }
      set((s: any) => ({
        globalEffects: [
          ...s.globalEffects,
          ...spots.map((pos) => ({ type: 'REDZONE' as const, pos, damage: enemy.damage * 6, ownerId: enemy.id, timer: 2 })),
        ],
      }));
      setCd('artillery', 8);
      if (!enemy.cooldowns) enemy.cooldowns = {};
      enemy.cooldowns['artillery'] = 8;
      return { costAp: 3 };
    }

    case 'leadenrain': {
      // Свинцовый дождь: 4 прицельных выстрела подряд.
      if (dist > (enemy.rangeDistance || 8) + 2 || enemy.cooldowns?.['leadenrain'] > 0) return null;
      playCombatSound('m134', 0.4);
      get().say(enemy.id, 'Свинца не жалеть!');
      set({ shotLine: { from: enemy.pos, to: { ...pPos }, kind: 'single', count: 1, power: 1.2 } });
      const rainDps = (enemy.dps || enemy.damage * (1 + (enemy.speed || 0))) * 1.2;
      for (let k = 0; k < 4; k++) {
        const result = calculateCombatResult(
          { dps: rainDps, accuracy: enemy.accuracy, crit: enemy.crit, punching: enemy.punching, vampir: enemy.vampir, isPlayer: false },
          { armor: playerStats.armor, evasion: playerStats.evasion, block: playerStats.block, incomingDamageMult: playerStats.incomingDamageMult },
        );
        if (result.damage > 0 && !absorbWithShield(pPos)) {
          const finalDmg = Math.round(result.damage);
          usePlayerStore.setState((st: any) => ({
            stats: { ...st.stats, currentHp: Math.max(0, st.stats.currentHp - finalDmg) },
          }));
          get().addPopup(pPos.x, pPos.y, result.text, result.type);
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      setTimeout(() => set({ shotLine: null }), 200);
      setCd('leadenrain', 7);
      if (!enemy.cooldowns) enemy.cooldowns = {};
      enemy.cooldowns['leadenrain'] = 7;
      return { costAp: 3 };
    }

    case 'minefield': {
      // Минное поле: 3 мины вокруг игрока.
      if (enemy.cooldowns?.['minefield'] > 0) return null;
      playCombatSound('install', 0.4);
      get().say(enemy.id, 'Земля горит под ногами!');
      const st = get();
      const taken = new Set(st.enemies.filter((e: GridEnemy) => !e.dead).map((e: GridEnemy) => `${e.pos.x},${e.pos.y}`));
      taken.add(`${st.playerPos.x},${st.playerPos.y}`);
      const mines: { x: number; y: number }[] = [];
      for (let k = 0; k < 3; k++) {
        const spot = findFreeCellNear(
          Math.max(0, Math.min(31, pPos.x + Math.floor(Math.random() * 11) - 5)),
          Math.max(0, Math.min(31, pPos.y + Math.floor(Math.random() * 11) - 5)),
          taken,
        );
        taken.add(`${spot.x},${spot.y}`);
        mines.push(spot);
      }
      set((s: any) => ({
        globalEffects: [
          ...s.globalEffects,
          ...mines.map((pos) => ({ type: 'MINE' as const, pos, damage: enemy.damage * 8, timer: 999 })),
        ],
      }));
      get().addBattleLog('💣 Босс заминировал местность!');
      setCd('minefield', 8);
      if (!enemy.cooldowns) enemy.cooldowns = {};
      enemy.cooldowns['minefield'] = 8;
      return { costAp: 2 };
    }

    case 'shockwave': {
      // Ударная волна: тяжёлый удар + сброс AP игрока.
      if (dist > 10 || enemy.cooldowns?.['shockwave'] > 0) return null;
      playCombatSound('grenadeBoom', 0.5);
      get().say(enemy.id, 'Лежать!');
      get().triggerShake();
      const waveDps = (enemy.dps || enemy.damage * (1 + (enemy.speed || 0))) * 3;
      const result = calculateCombatResult(
        { dps: waveDps, accuracy: (enemy.accuracy || 1) + 1.0, crit: enemy.crit, punching: enemy.punching, vampir: enemy.vampir, isPlayer: false },
        { armor: playerStats.armor, evasion: playerStats.evasion, block: playerStats.block, incomingDamageMult: playerStats.incomingDamageMult },
      );
      if (result.damage > 0 && !absorbWithShield(pPos)) {
        const finalDmg = Math.round(result.damage);
        usePlayerStore.setState((st: any) => ({
          stats: { ...st.stats, currentHp: Math.max(0, st.stats.currentHp - finalDmg) },
        }));
        get().addPopup(pPos.x, pPos.y, `💥 УДАРНАЯ ВОЛНА! ${result.text}`, result.type);
      }
      set((s: any) => ({ ap: 0 }));
      get().addPopup(pPos.x, pPos.y, '😵 Оглушение: AP 0', 'SPECIAL');
      setCd('shockwave', 7);
      if (!enemy.cooldowns) enemy.cooldowns = {};
      enemy.cooldowns['shockwave'] = 7;
      return { costAp: 2 };
    }
  }
  return null;
}
