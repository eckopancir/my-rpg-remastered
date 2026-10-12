import {
  EDITOR_POOLS, getCoverPenalty, isCellWalkable,
  isObstacleBlocking, isObstacleWalkable, isShootThrough, searchLootForProp,
} from './terrain';

/** Стычка: центр карты 20×20, левая половина — мы, правая — враг. */
export const SKIRMISH_ZONE = { x1: 6, y1: 6, x2: 25, y2: 25 };
export const SKIRMISH_LEFT = { x1: 6, x2: 15 };
export const SKIRMISH_RIGHT = { x1: 16, x2: 25 };

export interface SkirmishArena { x1: number; y1: number; x2: number; y2: number }

/** Половины произвольной арены: левая — мы, правая — враг. */
export const arenaHalves = (a: SkirmishArena): { left: { x1: number; x2: number }; right: { x1: number; x2: number } } => {
  const w = a.x2 - a.x1 + 1;
  const midX = a.x1 + Math.floor(w / 2) - 1;
  return { left: { x1: a.x1, x2: midX }, right: { x1: midX + 1, x2: a.x2 } };
};

const inArena = (a: SkirmishArena, x: number, y: number) =>
  x >= a.x1 && x <= a.x2 && y >= a.y1 && y <= a.y2;

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

/** Сохранённые карты стычек (с ареной) из localStorage конструктора. */
export function loadSavedSkirmishMaps(): any[] {
  try {
    const raw = localStorage.getItem('rpg.customMaps');
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((m: any) => m && typeof m.name === 'string' && m.arena && typeof m.arena.x1 === 'number');
  } catch {
    return [];
  }
}

/** Перевод препятствий кастомной карты в боевые (зеркало enterCustomMap). */
export function translateSavedObstacles(map: any, arena: SkirmishArena): any[] {
  const pools: Record<string, string[]> = EDITOR_POOLS;
  const list: any[] = [];
  let oid = 0;
  const inR = (x: number, y: number, w: number, h: number) =>
    x + w > arena.x1 && x < arena.x2 + 1 && y + h > arena.y1 && y < arena.y2 + 1;
  for (const o of map.obstacles || []) {
    if (!o || typeof o.x !== 'number') continue;
    const w = Math.max(1, o.w || 1);
    const h = Math.max(1, o.h || 1);
    // Вне арены — выкидываем.
    if (!inR(o.x, o.y, w, h)) continue;
    const place = (sx: number, sy: number) => {
      const imgIdx = Math.max(0, (pools[o.icon] || []).indexOf(o.imgKey));
      list.push({
        id: `sk_cm_${oid++}`, x: sx, y: sy, w, h,
        type: o.icon === 'woods' ? 'woods' : o.icon === 'field' ? 'field' : o.icon === 'fence' ? 'fence' : o.icon === 'car' ? 'car' : 'small',
        blocks: isObstacleBlocking(o.icon, o.imgKey || ''), icon: o.icon, imgKey: o.imgKey || '',
        isWalkable: isObstacleWalkable(o.icon, o.imgKey || ''),
        isHigh: o.icon === 'building' || o.icon === 'fence',
        imgIndex: imgIdx, rot: o.rot || 0, shootThrough: isShootThrough(o.icon, o.imgKey || ''), searchLoot: searchLootForProp(o.icon, o.imgKey || ''),
        openCells: Array.isArray((o as any).openCells) ? (o as any).openCells.map((c: any) => ({ dx: c.dx || 0, dy: c.dy || 0, ...(c.cover ? { cover: true } : null) })) : undefined,
      });
    };
    if (o.random) {
      let done = false;
      for (let a = 0; a < 60 && !done; a++) {
        const rx = arena.x1 + Math.floor(Math.random() * (arena.x2 - arena.x1 + 1 - w + 1));
        const ry = arena.y1 + Math.floor(Math.random() * (arena.y2 - arena.y1 + 1 - h + 1));
        let busy = false;
        for (const q of list) {
          if (rx < q.x + (q.w || 1) && rx + w > q.x && ry < q.y + (q.h || 1) && ry + h > q.y) { busy = true; break; }
        }
        if (busy) continue;
        place(rx, ry);
        done = true;
      }
    } else {
      place(
        Math.max(arena.x1, Math.min(arena.x2 - w + 1, o.x)),
        Math.max(arena.y1, Math.min(arena.y2 - h + 1, o.y)),
      );
    }
  }
  return list;
}

/** Случайная карта стычки из малых объектов. */
export function generateSkirmishObstacles(arena: SkirmishArena = SKIRMISH_ZONE): any[] {
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
      if (inArena(arena, x, y) && blocks && !isObstacleWalkable(pool.icon, imgKey)) continue;
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

  // Кольцо арены: забор по периметру зоны. Держит всех внутри механиками
  // (блок хода и выстрелов), а не кодом — и выглядит как арена.
  const fence = (x: number, y: number) => {
    if (occupied.has(`${x},${y}`)) return;
    list.push({
      id: `sk_ring_${id++}`, x, y, w: 1, h: 1,
      type: 'fence', blocks: true, icon: 'fence', imgKey: 'o5',
      isWalkable: false, isHigh: true, imgIndex: 0, rot: 0,
      shootThrough: false, searchLoot: null,
    });
    mark(x, y);
  };
  for (let x = arena.x1 - 1; x <= arena.x2 + 1; x++) {
    fence(x, arena.y1 - 1);
    fence(x, arena.y2 + 1);
  }
  for (let y = arena.y1; y <= arena.y2; y++) {
    fence(arena.x1 - 1, y);
    fence(arena.x2 + 1, y);
  }
  return list;
}

/** Кольцо забора вокруг арены (для кастомных карт стычек). */
export function skirmishRing(arena: SkirmishArena, fromId = 0): any[] {
  const ring: any[] = [];
  let id = fromId;
  const fence = (x: number, y: number) => {
    ring.push({
      id: `sk_ring_${id++}`, x, y, w: 1, h: 1,
      type: 'fence', blocks: true, icon: 'fence', imgKey: 'o5',
      isWalkable: false, isHigh: true, imgIndex: 0, rot: 0,
      shootThrough: false, searchLoot: null,
    });
  };
  for (let x = arena.x1 - 1; x <= arena.x2 + 1; x++) {
    fence(x, arena.y1 - 1);
    fence(x, arena.y2 + 1);
  }
  for (let y = arena.y1; y <= arena.y2; y++) {
    fence(arena.x1 - 1, y);
    fence(arena.x2 + 1, y);
  }
  return ring;
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
export function autoDeploySkirmishEnemies(enemies: any[], obstacles: any[], arena: SkirmishArena = SKIRMISH_ZONE): void {
  const { right } = arenaHalves(arena);
  const taken = new Set<string>();
  for (const o of obstacles) {
    if ((o as any).blocks && !(o as any).isWalkable) taken.add(`${o.x},${o.y}`);
  }
  const free: { x: number; y: number; cover: number }[] = [];
  for (let x = right.x1; x <= right.x2; x++) {
    for (let y = arena.y1; y <= arena.y2; y++) {
      if (taken.has(`${x},${y}`)) continue;
      if (!isCellWalkable(x, y, obstacles)) continue;
      free.push({ x, y, cover: getCoverPenalty({ x, y }, obstacles).penalty });
    }
  }
  if (free.length === 0) return;
  const byCoverDesc = [...free].sort((a, b) => b.cover - a.cover || b.x - a.x);
  const midY = Math.round((arena.y1 + arena.y2) / 2);
  const midX = Math.round((arena.x1 + arena.x2) / 2);
  const byFront = [...free].sort((a, b) => a.x - b.x || Math.abs(a.y - midY) - Math.abs(b.y - midY));

  const pick = (list: typeof free): { x: number; y: number } => {
    const c = list.find((f) => ![...taken].includes(`${f.x},${f.y}`)) || list[0];
    taken.add(`${c.x},${c.y}`);
    return { x: c.x, y: c.y };
  };

  const order: Role[] = ['tank', 'melee', 'sniper', 'support'];
  const sorted = [...enemies].sort((a, b) => order.indexOf(roleOf(a)) - order.indexOf(roleOf(b)));
  let tankPos = { x: right.x1, y: Math.round((arena.y1 + arena.y2) / 2) };
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
        (a, b) => Math.abs(a.x - midX) - Math.abs(b.x - midX) || b.cover - a.cover,
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
