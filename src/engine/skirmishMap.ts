import {
  EDITOR_POOLS, getCoverPenalty, isCellWalkable,
  isObstacleBlocking, isObstacleWalkable, isShootThrough, searchLootForProp,
} from './terrain';

/** Стычка: центр карты 20×20, левая половина — мы, правая — враг. */
export const SKIRMISH_ZONE = { x1: 6, y1: 6, x2: 25, y2: 25 };
export const SKIRMISH_LEFT = { x1: 6, x2: 15 };
export const SKIRMISH_RIGHT = { x1: 16, x2: 25 };

const GRID = 32;

/** Только малые объекты: без зданий (п.3 плана). */
const OUTSIDE_POOLS: Array<{ icon: string; keys: string[] }> = [
  { icon: 'small', keys: EDITOR_POOLS.small },
  { icon: 'woods', keys: EDITOR_POOLS.woods },
  { icon: 'car', keys: EDITOR_POOLS.car },
  { icon: 'fence', keys: EDITOR_POOLS.fence },
  { icon: 'prop', keys: EDITOR_POOLS.prop.filter((k) => !k.startsWith('ground_')) },
  { icon: 'light', keys: EDITOR_POOLS.light },
];

/** Внутри зоны расстановки — только проходимое/дающее укрытие (клетки должны ставиться). */
const INSIDE_POOLS: Array<{ icon: string; keys: string[] }> = [
  { icon: 'woods', keys: EDITOR_POOLS.woods },
  { icon: 'light', keys: EDITOR_POOLS.light },
  { icon: 'small', keys: ['o20', 'o21'] },
];

const inZone = (x: number, y: number) =>
  x >= SKIRMISH_ZONE.x1 && x <= SKIRMISH_ZONE.x2 && y >= SKIRMISH_ZONE.y1 && y <= SKIRMISH_ZONE.y2;

/** Случайная карта стычки из малых объектов. */
export function generateSkirmishObstacles(): any[] {
  const list: any[] = [];
  let id = 0;
  const occupied = new Set<string>();
  const mark = (x: number, y: number) => occupied.add(`${x},${y}`);

  const tryPlace = (pools: typeof OUTSIDE_POOLS, attempts: number, count: number) => {
    let placed = 0;
    for (let a = 0; a < attempts && placed < count; a++) {
      const x = Math.floor(Math.random() * GRID);
      const y = Math.floor(Math.random() * GRID);
      if (occupied.has(`${x},${y}`)) continue;
      const pool = pools[Math.floor(Math.random() * pools.length)];
      const imgKey = pool.keys[Math.floor(Math.random() * pool.keys.length)];
      if (!imgKey) continue;
      const blocks = isObstacleBlocking(pool.icon, imgKey);
      // Внутри зоны — только проходимое.
      if (inZone(x, y) && blocks && !isObstacleWalkable(pool.icon, imgKey)) continue;
      list.push({
        id: `sk_${id++}`, x, y, w: 1, h: 1,
        type: pool.icon, blocks, icon: pool.icon, imgKey,
        isWalkable: isObstacleWalkable(pool.icon, imgKey),
        isHigh: false, imgIndex: 0, rot: 0,
        shootThrough: isShootThrough(pool.icon, imgKey),
        searchLoot: searchLootForProp(pool.icon, imgKey),
      });
      mark(x, y);
      placed++;
    }
  };

  // Вне зоны — плотно малыми объектами, внутри — редкие проходимые укрытия.
  tryPlace(OUTSIDE_POOLS, 400, 34);
  tryPlace(INSIDE_POOLS, 120, 10);
  return list;
}

type Role = 'tank' | 'melee' | 'sniper' | 'ranged' | 'support';

const roleOf = (e: any): Role => {
  const k = `${e.factionKey || ''} ${e.name || ''}`.toLowerCase();
  if (k.includes('tank')) return 'tank';
  if (k.includes('melee')) return 'melee';
  if (k.includes('sniper')) return 'sniper';
  if (k.includes('medic') || k.includes('mechanic') || k.includes('медик')) return 'support';
  return 'ranged';
};

/**
 * Авторасстановка врага в правой половине (п.4 плана):
 * танк — ближе к нам (min x), мили — позади танка, снайпер — дальше всех + max укрытие,
 * саппорты — середина с укрытием.
 */
export function autoDeploySkirmishEnemies(enemies: any[], obstacles: any[]): void {
  const taken = new Set<string>();
  for (const o of obstacles) {
    if ((o as any).blocks && !(o as any).isWalkable) taken.add(`${o.x},${o.y}`);
  }
  const free: { x: number; y: number; cover: number }[] = [];
  for (let x = SKIRMISH_RIGHT.x1; x <= SKIRMISH_RIGHT.x2; x++) {
    for (let y = SKIRMISH_ZONE.y1; y <= SKIRMISH_ZONE.y2; y++) {
      if (taken.has(`${x},${y}`)) continue;
      if (!isCellWalkable(x, y, obstacles)) continue;
      free.push({ x, y, cover: getCoverPenalty({ x, y }, obstacles).penalty });
    }
  }
  if (free.length === 0) return;
  const byCoverDesc = [...free].sort((a, b) => b.cover - a.cover || b.x - a.x);
  const byFront = [...free].sort((a, b) => a.x - b.x || Math.abs(a.y - 16) - Math.abs(b.y - 16));

  const pick = (list: typeof free): { x: number; y: number } => {
    const c = list.find((f) => ![...taken].includes(`${f.x},${f.y}`)) || list[0];
    taken.add(`${c.x},${c.y}`);
    return { x: c.x, y: c.y };
  };

  const order: Role[] = ['tank', 'melee', 'sniper', 'support'];
  const sorted = [...enemies].sort((a, b) => order.indexOf(roleOf(a)) - order.indexOf(roleOf(b)));
  let tankPos = { x: SKIRMISH_RIGHT.x1, y: 16 };
  for (const e of sorted) {
    const r = roleOf(e);
    if (r === 'tank') {
      tankPos = pick(byFront);
      e.pos = { ...tankPos };
    } else if (r === 'melee') {
      // Позади танка: x+1..3, рядом по y.
      const near = free
        .filter((f) => f.x >= tankPos.x + 1 && f.x <= tankPos.x + 3 && Math.abs(f.y - tankPos.y) <= 3)
        .sort((a, b) => a.x - b.x);
      e.pos = necherpick(near, byFront, taken);
    } else if (r === 'sniper') {
      // Дальше всех + укрытие.
      const far = [...byCoverDesc].sort((a, b) => b.x - a.x || b.cover - a.cover);
      e.pos = necherpick(far, byCoverDesc, taken);
    } else {
      // Саппорт: середина правой половины с укрытием.
      const mid = [...byCoverDesc].sort(
        (a, b) => Math.abs(a.x - 20) - Math.abs(b.x - 20) || b.cover - a.cover,
      );
      e.pos = necherpick(mid, byCoverDesc, taken);
    }
    e.rotation = 180;
    e.aiRole = 'patrol';
    e.aggro = false;
    e.knowsPlayer = false;
    e.sleeping = false;
    e.speech = null;
  }
}

const necherpick = (
  pref: { x: number; y: number }[],
  fb: { x: number; y: number }[],
  taken: Set<string>,
): { x: number; y: number } => {
  const c = pref.find((f) => !taken.has(`${f.x},${f.y}`)) || fb.find((f) => !taken.has(`${f.x},${f.y}`)) || pref[0] || fb[0];
  taken.add(`${c.x},${c.y}`);
  return { x: c.x, y: c.y };
};

/** Свободные клетки левой половины для ручной расстановки. */
export function skirmishFreeLeft(obstacles: any[], enemies: any[], playerPos: { x: number; y: number }): Set<string> {
  const blocked = new Set<string>();
  for (const o of obstacles) {
    if ((o as any).blocks && !(o as any).isWalkable) blocked.add(`${o.x},${o.y}`);
  }
  for (const e of enemies) {
    if (!e.dead) blocked.add(`${e.pos.x},${e.pos.y}`);
  }
  blocked.add(`${playerPos.x},${playerPos.y}`);
  return blocked;
}
