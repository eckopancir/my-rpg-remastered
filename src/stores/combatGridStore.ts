import { create } from 'zustand';
import { usePlayerStore } from './playerStore';
import { useInventoryStore } from './inventoryStore';
import { generateEnemy, ENEMY_BASE_STATS } from '../engine/enemies';
import { generateLoot } from '../engine/loot';
import { GAME_ITEMS } from '../data/GameItems';
import { playCombatSound } from '../hooks/useSound';
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

export interface ShotLine {
  from: { x: number; y: number };
  to: { x: number; y: number };
  type?: string;
}

export interface GrenadeAnim {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export interface GlobalEffect {
  type: 'GRENADE' | 'REDZONE';
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

  playerAbilities: (AccessoryAbility | null)[];
  abilityCooldowns: number[];
  selectedAbility: number | null;

  initCombat: (difficulty: number, encounteredFaction?: string) => void;
  movePlayer: (x: number, y: number) => void;
  handleKeyboardMove: (dx: number, dy: number) => void;
  rotatePlayer: (x: number, y: number) => void;
  selectMe: () => void;
  selectEnemy: (id: number | string | null) => void;
  attackEnemy: (enemyId: number | string) => void;
  reload: () => void;
  toggleDefense: () => void;
  selectAbility: (index: number) => void;
  useAbility: (enemyId?: number | string) => void;
  tickAbilityCooldowns: () => void;
  endTurn: () => void;
  cleanup: () => void;
  addMessage: (msg: string) => void;
  addPopup: (x: number, y: number, text: string, type?: string) => void;
  addBattleLog: (msg: string) => void;
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
  const { range = 24, fov = 75, clearRange = 8, clearFov = 130, isShallowCheck = false } = config || {};
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
        obs.isHigh &&
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

export const calculateCombatResult = (attacker: any, target: any) => {
  let dmg = attacker.dps || attacker.damage || 0;
  let text = '';
  let type = 'NORMAL';
  let sound: string | null = null;

  const currentHour = new Date().getHours();
  const isNightTime = currentHour >= 0 && currentHour < 6;
  const nightPenalty = isNightTime && !attacker.isPlayer ? 0.2 : 0;
  const finalAccuracy = Math.max(0, (attacker.accuracy || 0) - nightPenalty);

  if (Math.random() > finalAccuracy && finalAccuracy < 1) {
    return { damage: 0, type: 'MISS', text: 'ПРОМАХ', sound: null };
  }

  const effectiveEnemyArmor = (target.armor || 0) * (1 - (attacker.punching || 0));
  dmg = Math.max(0, dmg - effectiveEnemyArmor);

  let evasionChance = target.evasion || 0;
  if (finalAccuracy > 1) {
    if (Math.random() < finalAccuracy - 1) evasionChance = 0;
  }
  if (Math.random() < evasionChance) {
    playCombatSound('evasion', 0.3);
    return { damage: 0, type: 'EVASION', text: 'УВОРОТ', sound: null };
  }

  const critVal = attacker.crit || 0;
  let critMultiplier = 1;
  let isCrit = false;
  if (critVal > 0) {
    isCrit = true;
    const baseTier = Math.floor(critVal);
    const chance = Math.min(critVal - baseTier, 1);
    critMultiplier = Math.random() < chance ? baseTier + 2 : baseTier + 1;
    dmg *= critMultiplier;
    type = 'CRIT';
    sound = 'crit';
  }

  const blockVal = target.block || 0;
  let isBlocked = false;
  let currentBlockReduction = 0.5;
  if (blockVal > 0 && Math.random() < Math.min(1, blockVal)) {
    isBlocked = true;
    if (blockVal >= 3.0) currentBlockReduction = 0.9;
    else if (blockVal >= 2.0) currentBlockReduction = 0.8;
    else currentBlockReduction = 0.5;
    dmg *= 1 - currentBlockReduction;
    if (!sound) sound = 'block';
  }

  // Incoming damage multiplier (barrier — reduces damage)
  if (target.incomingDamageMult !== undefined && target.incomingDamageMult < 1) {
    dmg *= target.incomingDamageMult;
  }

  const displayDmg = Math.round(dmg);

  if (isCrit && isBlocked) {
    text = `💥 КРИТ ЗАБЛОКИРОВАН! -${displayDmg}`;
    type = 'BLOCK';
    sound = 'block';
  } else if (isCrit) {
    text = `🔥 КРИТ x${critMultiplier}! -${displayDmg}`;
  } else if (isBlocked) {
    text = `🛡️ БЛОК -${(currentBlockReduction * 100).toFixed(0)}%! -${displayDmg}`;
    type = 'BLOCK';
  } else {
    text = `-${displayDmg}`;
  }

  return { damage: displayDmg, type, text, sound };
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
  selectedEnemy: null,
  cursorPos: null,
  message: '',
  isVictory: false,
  isDefeat: false,
  isNightTime: new Date().getHours() >= 0 && new Date().getHours() < 6,
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
  playerAbilities: [],
  abilityCooldowns: [],
  selectedAbility: null,

  addMessage: (msg) => set({ message: msg }),

  addBattleLog: (msg) => set((s) => ({ battleLogs: [...s.battleLogs.slice(-199), msg] })),

  addPopup: (x, y, text, type = 'NORMAL') => {
    const id = `popup-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    set((s) => ({ popups: [...s.popups, { id, x, y, text, type }] }));
    setTimeout(() => {
      set((s) => ({ popups: s.popups.filter((p) => p.id !== id) }));
    }, 1200);
  },

  triggerShake: () => {
    set({ isShaking: true });
    setTimeout(() => set({ isShaking: false }), 500);
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

  initCombat: (difficulty, encounteredFaction) => {
    const player = usePlayerStore.getState();
    const enemyCount = Math.min(1 + Math.floor(difficulty / 4), 6);

    // Player starts at (2,2) like original
    const playerPos = { x: 2, y: 2 };

    // Determine which faction keys to use
    const allFactionKeys = Object.keys(ENEMY_BASE_STATS);
    let validKeys = allFactionKeys;
    if (encounteredFaction) {
      const matched = allFactionKeys.filter((k) => k === encounteredFaction || ENEMY_BASE_STATS[k].faction === encounteredFaction);
      if (matched.length > 0) validKeys = matched;
    }

    const enemies: GridEnemy[] = [];
    for (let i = 0; i < enemyCount; i++) {
      const factionKey = validKeys[Math.floor(Math.random() * validKeys.length)];
      const base = ENEMY_BASE_STATS[factionKey];
      const levelScale = difficulty || 1;
      const scaledHealth = base.health * (1 + (levelScale - 1) * 0.15);
      const scaledDamage = base.damage * (1 + (levelScale - 1) * 0.1);
      const spawnX = Math.min(GRID - 3, Math.max(20, GRID - 3 - (i % 2) * 2));
      const spawnY = 20 + (i % 3) * 3 + Math.floor(i / 3) * 4;
      const abilities = base.skillUse && base.skillUse.length > 0 && base.skillUse[0] !== ''
        ? base.skillUse
        : [];

      let enemyLoot: any[] = [];
      try {
        enemyLoot = generateLoot(GAME_ITEMS, player.level).map((item) => ({ ...item, parentEnemyId: i }));
      } catch (e) { /* ignore */ }

      enemies.push({
        id: i,
        name: factionKey,
        faction: base.faction || 'Неизвестно',
        dps: base.damage * (1 + (base.speed || 0)),
        speed: base.speed || 0,
        currentHp: scaledHealth,
        maxHp: scaledHealth,
        health: base.health,
        damage: scaledDamage,
        armor: base.armor,
        accuracy: base.accuracy,
        evasion: base.evasion,
        block: base.block,
        punching: base.punching,
        vampir: base.vampir,
        crit: base.crit,
        regen: base.regen || 0,
        pos: { x: spawnX, y: spawnY + i },
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
      });
    }

    // Generate obstacles with safe zones around player and enemies
    const obstacles = generateObstacles(playerPos, enemies);

    const playerAbilities = [...usePlayerStore.getState().accessoryAbilities];
    const abilityCooldowns = playerAbilities.map(() => 0);

    set({
      isActive: true, playerPos, enemies, obstacles,
      playerAbilities, abilityCooldowns, selectedAbility: null,
      turn: 'player', ap: BASE_AP, maxAp: BASE_AP, ammo: MAX_AMMO,
      range: ATTACK_RANGE, isDefensiveMode: false,
      turnCount: 0, selectedEnemy: null, message: '⚔️ Твой ход',
      isVictory: false, isDefeat: false, isMoving: false, isSelected: false,
      playerRotation: 90, popups: [], shotLine: null,
      flyingGrenade: null, globalEffects: [], lootingEnemy: null,
      plannedPath: [], reserve: [], battleLogs: ['⚔️ Бой начался!'],
    });
    get().addBattleLog(`⚔️ Бой начался! Противников: ${enemies.length}`);
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
        playCombatSound('run', 0.2);
        if (newAp <= 0) {
          const s = get();
          const hasEnemies = s.enemies.some((e) => !e.dead) || s.reserve.length > 0;
          if (hasEnemies) get().endTurn();
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
    if (newAp <= 0) {
      const s = get();
      const hasEnemies = s.enemies.some((e) => !e.dead) || s.reserve.length > 0;
      if (hasEnemies) get().endTurn();
    }
  },

  rotatePlayer: (x, y) => {
    const state = get();
    if (state.turn !== 'player' || state.isMoving) return;
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

    const targetEnemy = enemyId != null
      ? state.enemies.find((e) => e.id === enemyId)
      : null;

    // If ability has damage effects, require a target
    const needsTarget = ability.effects.some((ef) => ef.type === 'damage' || ef.type === 'mark_zone');
    if (needsTarget && !targetEnemy) {
      get().addMessage('❌ Выбери цель для этой способности');
      set({ selectedAbility: null });
      return;
    }

    // Execute all effects
    for (const effect of ability.effects) {
      const type = effect.type;

      if (type === 'heal_percent') {
        const player = usePlayerStore.getState();
        const healAmt = Math.round(player.stats.maxHp * (effect as AbilityEffect & { type: 'heal_percent' }).value / 100);
        usePlayerStore.setState((st: any) => ({
          stats: { ...st.stats, currentHp: Math.min(st.stats.maxHp, st.stats.currentHp + healAmt) },
        }));
        usePlayerStore.getState().recalcStats();
        get().addPopup(state.playerPos.x, state.playerPos.y, `+${healAmt} ❤️`, 'HEAL');
        get().addBattleLog(`🩹 ${ability.name}: +${healAmt} HP`);
      }

      if (type === 'heal_flat') {
        const val = (effect as AbilityEffect & { type: 'heal_flat' }).value;
        usePlayerStore.setState((st: any) => ({
          stats: { ...st.stats, currentHp: Math.min(st.stats.maxHp, st.stats.currentHp + val) },
        }));
        usePlayerStore.getState().recalcStats();
        get().addPopup(state.playerPos.x, state.playerPos.y, `+${val} ❤️`, 'HEAL');
      }

      if (type === 'damage') {
        const dmgEffect = effect as AbilityEffect & { type: 'damage' };
        if (targetEnemy) {
          const baseDmg = usePlayerStore.getState().stats.damage || 5;
          const dmg = Math.round(baseDmg * dmgEffect.multiplier);
          const aoe = dmgEffect.aoe || 1;
          if (aoe > 1) {
            // Area damage
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
            const finalDmg = Math.round(Math.max(1, dmg * (1 - targetEnemy.armor * 0.01)));
            targetEnemy.currentHp = Math.max(0, targetEnemy.currentHp - finalDmg);
            targetEnemy.isHit = true;
            get().addPopup(targetEnemy.pos.x, targetEnemy.pos.y, `-${finalDmg} 🎯`, 'DMG');
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
        if (statusEffect.id === 'evasion' || statusEffect.id === 'invisibility' || statusEffect.id === 'shield' || statusEffect.id === 'stun') {
          get().addBattleLog(`👤 ${ability.name} активирована (${statusEffect.id})`);
          // Store status in player store via effects
          usePlayerStore.getState().addEffect({
            id: `ability_${statusEffect.id}`,
            name: ability.name,
            duration: statusEffect.duration,
            remaining: statusEffect.duration,
            statBoosts: statusEffect.id === 'evasion' ? { evasion: 1 } : {},
          });
        }
      }

      if (type === 'teleport') {
        get().addBattleLog(`✨ ${ability.name}: выбери клетку для телепортации`);
        // Teleport target selection is done in UI; for now just log
      }

      if (type === 'create_decoy') {
        const decoy: GridObstacle = {
          id: Date.now(),
          x: state.playerPos.x + 1,
          y: state.playerPos.y,
          w: 1, h: 1,
          type: 'decoy',
          blocks: false,
          icon: '🎭',
        };
        set((s) => ({ obstacles: [...s.obstacles, decoy] }));
        get().addBattleLog(`🎭 ${ability.name}: создана приманка`);
      }

      if (type === 'summon') {
        const player = usePlayerStore.getState();
        const summon: GridEnemy = {
          id: `summon_${Date.now()}`,
          name: 'Миньон',
          faction: 'Союзник',
          currentHp: 100,
          maxHp: 100,
          damage: player.stats.damage * 0.5,
          dps: player.stats.damage * 0.5,
          armor: 0,
          accuracy: 0.8,
          evasion: 0,
          block: 0,
          punching: 0,
          vampir: 0,
          crit: 0.05,
          regen: 0,
          pos: { x: state.playerPos.x + 1, y: state.playerPos.y },
          isHit: false,
          dead: false,
          runAp: 4,
          rotation: 90,
          rangeDistance: 5,
          shotPrice: 1,
          skillUse: [],
          cooldowns: {},
          isInvisible: false,
          invisTurns: 0,
          baseEvasion: 0,
          isEnraged: false,
          rageTurns: 0,
          hasSummoned: false,
          bigModel: '80%',
          isSpinning: false,
          loot: [],
          looted: false,
          isMinion: true,
        };
        set((s) => ({ enemies: [...s.enemies, summon] }));
        get().addBattleLog(`👥 ${ability.name}: призван миньон`);
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
        usePlayerStore.getState().addEffect({
          id: `ability_sprint`,
          name: ability.name,
          duration: sprint.duration,
          remaining: sprint.duration,
          statBoosts: { speed: 0.5 },
        });
        get().addBattleLog(`🏃 ${ability.name}: x2 перемещение на ${sprint.duration} хода`);
        // Double the AP pool for this turn
        set((s) => ({ maxAp: s.maxAp * 2, ap: s.ap * 2 }));
      }
    }

    // Apply costs and cooldown
    const newCooldowns = [...state.abilityCooldowns];
    newCooldowns[idx] = ability.cooldown;
    const newAp = state.ap - ability.apCost;
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

  setIsSelected: (v) => set({ isSelected: v }),

  attackEnemy: (enemyId) => {
    const state = get();
    if (state.turn !== 'player' || state.isMoving) return;
    const shotCost = 1;
    if (state.ap < shotCost) { get().addMessage('❌ Не хватает AP'); return; }
    if (state.ammo <= 0) { get().addMessage('❌ Нет патронов! Нажми R для перезарядки'); return; }

    const enemy = state.enemies.find((e) => e.id === enemyId);
    if (!enemy || enemy.dead) return;

    const dist = getDist(state.playerPos, enemy.pos);
    const effectiveRange = state.isDefensiveMode ? state.range + 5 : state.range;
    if (dist > effectiveRange) { get().addMessage('❌ Вне радиуса атаки'); return; }

    const player = usePlayerStore.getState();
    const angle = getAngle(state.playerPos, enemy.pos);
    set({ playerRotation: angle, shotLine: { from: state.playerPos, to: enemy.pos } });
    setTimeout(() => set({ shotLine: null }), 400);

    // Calculate effective DPS with faction bonus
    let effectiveDps = player.stats.damage;
    const faction = enemy.faction;
    if (faction === 'Мутанты') effectiveDps = Math.max(effectiveDps, player.stats.dpsToxis || 0);
    else if (faction === 'Роботы') effectiveDps = Math.max(effectiveDps, player.stats.dpsEmi || 0);
    else if (['Бандиты', 'Военные'].includes(faction)) {
      effectiveDps = Math.max(effectiveDps, player.stats.dpsExtro || 0, player.stats.dpsFire || 0);
    }
    if (player.stats.stamina < 0.1 * player.stats.maxStamina) effectiveDps *= 0.5;

    const attackerStats = {
      dps: effectiveDps,
      crit: player.stats.crit,
      accuracy: player.stats.accuracy,
      punching: player.stats.punching,
      vampir: player.stats.vampir,
      isPlayer: true,
    };
    const targetStats = {
      armor: enemy.armor,
      evasion: enemy.evasion,
      block: enemy.block,
    };

    const result = calculateCombatResult(attackerStats, targetStats);
    const actualDmg = Math.round(result.damage);
    const vampHeal = Math.round(actualDmg * (player.stats.vampir || 0));

    set((s) => ({
      ap: s.ap - shotCost,
      ammo: s.ammo - 1,
      enemies: s.enemies.map((e) =>
        e.id === enemyId ? { ...e, currentHp: Math.max(0, e.currentHp - actualDmg), isHit: true } : e
      ),
      message: `💥 ${result.text}`,
      selectedEnemy: null,
    }));

    get().addPopup(enemy.pos.x, enemy.pos.y, result.text, result.type);

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
      const st = get();
      const en = st.enemies.find((en) => en.id === enemyId);
      if (!en || en.dead || en.currentHp <= 0) break;

      const pStats = usePlayerStore.getState().stats;
      let effDps = pStats.damage;
      const fac = en.faction;
      if (fac === 'Мутанты') effDps = Math.max(effDps, pStats.dpsToxis || 0);
      else if (fac === 'Роботы') effDps = Math.max(effDps, pStats.dpsEmi || 0);
      else if (['Бандиты', 'Военные'].includes(fac)) {
        effDps = Math.max(effDps, pStats.dpsExtro || 0, pStats.dpsFire || 0);
      }
      if (pStats.stamina < 0.1 * pStats.maxStamina) effDps *= 0.5;

      const atkStat = { dps: effDps, crit: pStats.crit, accuracy: pStats.accuracy, punching: pStats.punching, vampir: pStats.vampir, isPlayer: true };
      const tgtStat = { armor: en.armor, evasion: en.evasion, block: en.block };
      const res = calculateCombatResult(atkStat, tgtStat);
      const dmg = Math.round(res.damage);

      set({ shotLine: { from: st.playerPos, to: en.pos } });
      setTimeout(() => set({ shotLine: null }), 400);

      set((s) => ({
        enemies: s.enemies.map((e) =>
          e.id === enemyId ? { ...e, currentHp: Math.max(0, e.currentHp - dmg), isHit: true } : e
        ),
      }));

      get().addPopup(en.pos.x, en.pos.y, res.text, res.type);
      get().addPopup(st.playerPos.x, st.playerPos.y, '+1 🏃', 'BUFF');

      setTimeout(() => {
        set((s) => ({ enemies: s.enemies.map((e) => e.id === enemyId ? { ...e, isHit: false } : e) }));
      }, 300);

      const vamp = Math.round(dmg * (pStats.vampir || 0));
      if (vamp > 0) {
        usePlayerStore.setState((st) => ({ stats: { ...st.stats, currentHp: Math.min(st.stats.maxHp, st.stats.currentHp + vamp) } }));
        get().addPopup(st.playerPos.x, st.playerPos.y, `+${vamp} 🩸`, 'VAMP');
      }
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
          freshLoot = generateLoot(GAME_ITEMS, usePlayerStore.getState().level);
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

    // Auto end turn if AP runs out
    const nextAp = state.ap - shotCost;
    if (nextAp < 1) {
      setTimeout(() => {
        const s = get();
        const enemiesAlive = s.enemies.some((e) => !e.dead);
        const hasReserve = s.reserve.length > 0;
        if (enemiesAlive || hasReserve) get().endTurn();
      }, 800);
    }
  },

  finishBattle: () => {
    const playerStore = usePlayerStore.getState();
    const expReward = Math.floor(playerStore.combat.enemyExpReward * (1 + playerStore.level * 0.1));
    const chipReward = playerStore.combat.enemyChipReward;
    playerStore.addExp(expReward);
    playerStore.addChips(chipReward);
    playerStore.addLog(`🏆 Победа! +${expReward} опыта, +${chipReward} чипов`, 'loot');
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
      const base = generateEnemy('zone', 1);
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
        dps: base.dps || base.damage,
        currentHp: base.scaledHealth,
        maxHp: base.scaledHealth,
        health: base.health,
        damage: base.scaledDamage,
        armor: base.armor,
        accuracy: base.accuracy,
        evasion: base.evasion,
        block: base.block,
        punching: base.punching,
        vampir: base.vampir,
        crit: base.crit,
        regen: base.regen || 0,
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
      });
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
    if (state.ap < 3) { get().addMessage('❌ Нужно 3 AP для перезарядки'); return; }
    if (state.ammo >= state.maxAmmo) { get().addMessage('✅ Патроны полны'); return; }
    set((s) => ({ ap: s.ap - 3, ammo: s.maxAmmo, message: '🔁 Перезарядился (AP -3)' }));
    get().addPopup(state.playerPos.x, state.playerPos.y, '🔁 ПЕРЕЗАРЯДКА', 'RELOAD');
  },

  toggleDefense: () => {
    const state = get();
    if (state.turn !== 'player') return;
    if (state.ap < 2) { get().addMessage('❌ Нужно 2 AP'); return; }
    set((s) => ({ ap: s.ap - 2, isDefensiveMode: !s.isDefensiveMode }));
    get().addMessage(get().isDefensiveMode ? '🛡️ Защитный режим' : '⚔️ Обычный режим');
  },

  endTurn: () => {
    const state = get();
    if (state.turn !== 'player' || state.isMoving) return;
    // Check all dead + no reserve -> free movement
    const allDead = state.enemies.every((e) => e.dead);
    const noReserve = state.reserve.length === 0;
    if (allDead && noReserve) {
      set({
        ap: BASE_AP,
        message: '🕊️ Поле зачищено. Свободное перемещение.',
        turnCount: state.turnCount + 1,
      });
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
    set({ turn: 'enemy', ap: 0, isDefensiveMode: false, isSelected: false, turnCount: nextTurnCount, message: '🤖 Ход врага...' });
  },

  cleanup: () => set({
    isActive: false, enemies: [], obstacles: [], turn: 'player',
    ap: BASE_AP, turnCount: 0, selectedEnemy: null, message: '',
    cursorPos: null, isVictory: false, isMoving: false, popups: [],
    shotLine: null, flyingGrenade: null, globalEffects: [], lootingEnemy: null,
    plannedPath: [], isShaking: false, isPlayerHit: false, playerRotation: 90,
    playerAbilities: [], abilityCooldowns: [], selectedAbility: null,
    ammo: MAX_AMMO, isDefensiveMode: false, isSelected: false, reserve: [],
  }),
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

  const combatSkills = ['aimShot', 'madness', 'grenade', 'redZone', 'suppression', 'ram', 'invisibility'];
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
        shotLine: { from: enemy.pos, to: pPos, type: 'aim' },
      }));
      setTimeout(() => set({ shotLine: null }), 800);
      get().triggerShake();
      const aimDps = (enemy.dps || enemy.damage * (1 + (enemy.speed || 0))) * 2.0;
      const attackerStats = { dps: aimDps, accuracy: (enemy.accuracy || 1) + 2.0, crit: enemy.crit, punching: enemy.punching, vampir: enemy.vampir, isPlayer: false };
      const result = calculateCombatResult(attackerStats, { armor: playerStats.armor, evasion: playerStats.evasion, block: playerStats.block, incomingDamageMult: playerStats.incomingDamageMult });
      if (result.damage > 0) {
        const finalDmg = Math.round(result.damage);
        usePlayerStore.setState((st: any) => ({
          stats: { ...st.stats, currentHp: Math.max(0, st.stats.currentHp - finalDmg) },
        }));
        get().addPopup(pPos.x, pPos.y, result.text, result.type);
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
          const finalDmg = Math.round(result.damage);
          usePlayerStore.setState((st: any) => ({
            stats: { ...st.stats, currentHp: Math.max(0, st.stats.currentHp - finalDmg) },
          }));
          get().triggerShake();
          get().addPopup(pPos.x, pPos.y, `БА-БАХ! ${result.text}`, result.type);
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
        set({ shotLine: { from: enemy.pos, to: rndPos } });
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
        set((s: any) => ({
          enemies: s.enemies.map((e: GridEnemy) =>
            e.id === enemy.id ? { ...e, currentHp: Math.min(e.maxHp, e.currentHp + healAmount) } : e,
          ),
        }));
        enemy.currentHp = Math.min(enemy.maxHp, enemy.currentHp + healAmount);
        if (!enemy.cooldowns) enemy.cooldowns = {};
        enemy.cooldowns['stimulant'] = 10;
        setCd('stimulant', 10);
        return { costAp: 4 };
      }
      break;
    }

    case 'summoner': {
      if (enemy.currentHp < enemy.maxHp * 0.6 && !enemy.hasSummoned) {
        const minionBase = generateEnemy('zone', 0);
        const minion = {
          ...minionBase,
          id: `minion-${Date.now()}`,
          name: `${enemy.name} (помощник)`,
          dps: (minionBase.scaledDamage || 5) * (1 + (minionBase.speed || 0)),
          speed: minionBase.speed || 0,
          currentHp: minionBase.scaledHealth || 200,
          maxHp: minionBase.scaledHealth || 200,
          damage: minionBase.scaledDamage || 5,
          armor: minionBase.armor || 1,
          accuracy: minionBase.accuracy || 0.7,
          evasion: minionBase.evasion || 0.03,
          block: minionBase.block || 0,
          punching: minionBase.punching || 0,
          vampir: minionBase.vampir || 0.001,
          crit: minionBase.crit || 0,
          regen: minionBase.regen || 0,
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

    case 'redZone': {
      if (enemy.cooldowns?.['redZone'] > 0) return null;
      set((s: any) => ({
        globalEffects: [
          ...s.globalEffects,
          { type: 'REDZONE' as const, pos: { x: pPos.x, y: pPos.y }, damage: enemy.damage * 10, ownerId: enemy.id, timer: 2 },
        ],
      }));
      if (!enemy.cooldowns) enemy.cooldowns = {};
      enemy.cooldowns['redZone'] = 6;
      setCd('redZone', 6);
      return { spendAllAp: true };
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
  }
  return null;
}
