import { create } from 'zustand';
import { useCombatGridStore } from './combatGridStore';
import { usePlayerStore } from './playerStore';
import { BIG_BUILDING_IMAGES, CAR_IMAGES, WOOD_IMAGES, SMALL_OBSTACLE_IMAGES, FENCE_IMAGE, FIELD_IMAGE } from '../engine/terrain';

export type EditorTool =
  | { kind: 'select' }
  | { kind: 'obstacle'; icon: string; imgKey: string; w: number; h: number; rot: number }
  | { kind: 'unit'; side: 'enemy' | 'neutral' | 'ally'; factionKey: string }
  | { kind: 'campfire' }
  | { kind: 'brush'; imgKey: string }
  | { kind: 'eraser' }
  | { kind: 'zone' }
  | { kind: 'route' };

export type SavedMapUnit = {
  factionKey: string;
  side: 'enemy' | 'neutral' | 'ally';
  x: number;
  y: number;
  behavior: string;
  corpseLoot?: boolean;
  patrolRoute?: { x: number; y: number }[];
};

export type SavedMapObstacle = {
  icon: string;
  imgKey: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  random: boolean;
};

export interface SavedMap {
  name: string;
  music: string;
  bg: string;
  weather: { rain: boolean; night: boolean; fog: number };
  obstacles: SavedMapObstacle[];
  units: SavedMapUnit[];
  decals: { x: number; y: number; imgKey: string }[];
  zones: { id: string; kind: 'spawn' | 'exit' | 'trigger'; x: number; y: number; w: number; h: number; text?: string }[];
  campfire: { x: number; y: number } | null;
  createdAt: number;
}

const MAPS_KEY = 'rpg.customMaps';

export const loadSavedMaps = (): SavedMap[] => {
  try {
    const raw = localStorage.getItem(MAPS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
};

const persistMaps = (maps: SavedMap[]) => {
  try {
    localStorage.setItem(MAPS_KEY, JSON.stringify(maps));
  } catch { /* ignore */ }
};

/** Поведения из движка ИИ. */
export const UNIT_BEHAVIORS = [
  { id: 'patrol', label: 'Патруль' },
  { id: 'camp', label: 'Лагерь' },
  { id: 'sentry', label: 'Часовой' },
  { id: 'sleeping', label: 'Спит' },
  { id: 'corpse', label: '💀 Труп' },
];

/** Треки для карты. */
export const MAP_MUSIC = [
  { id: 'track', label: 'Обычная' },
  { id: 'zemlya-mutantov', label: 'Земля мутантов' },
  { id: 'zvuki-prirody-1_-kapli-dozhdya', label: 'Дождь' },
  { id: 'zvuki-sverchkov1', label: 'Ночь (сверчки)' },
];

interface MapEditorStore {
  active: boolean;
  tool: EditorTool;
  behavior: string;
  corpseLoot: boolean;
  randomSpawn: boolean;
  music: string;
  mapName: string;
  maps: SavedMap[];
  selObId: number | string | null;
  selUnitId: number | string | null;
  selCamp: boolean;
  selZoneId: number | string | null;
  zoneKind: 'spawn' | 'exit' | 'trigger';
  dragStart: { x: number; y: number } | null;
  strokeActive: boolean;
  hover: { x: number; y: number } | null;
  setActive: (v: boolean) => void;
  setTool: (t: EditorTool) => void;
  setBehavior: (b: string) => void;
  setCorpseLoot: (v: boolean) => void;
  setRandomSpawn: (v: boolean) => void;
  setMusic: (m: string) => void;
  setMapName: (n: string) => void;
  setSel: (obId: number | string | null, unitId: number | string | null) => void;
  setSelCamp: (v: boolean) => void;
  setSelZone: (id: number | string | null) => void;
  setZoneKind: (k: 'spawn' | 'exit' | 'trigger') => void;
  setDragStart: (p: { x: number; y: number } | null) => void;
  setStrokeActive: (v: boolean) => void;
  /** Снимок для undo/redo. */
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  past: any[];
  future: any[];
  setHover: (h: { x: number; y: number } | null) => void;
  rotateTool: () => void;
  refreshMaps: () => void;
  saveMap: (obstacles: any[], units: any[]) => string | null;
  deleteMap: (name: string) => void;
}

export const useMapEditorStore = create<MapEditorStore>()((set, get) => ({
  active: false,
  tool: { kind: 'select' },
  behavior: 'patrol',
  corpseLoot: true,
  randomSpawn: false,
  music: 'track',
  mapName: '',
  maps: loadSavedMaps(),
  past: [],
  future: [],
  selObId: null,
  selUnitId: null,
  selCamp: false,
  selZoneId: null,
  zoneKind: 'spawn',
  dragStart: null,
  strokeActive: false,
  hover: null,
  setActive: (active) => {
    if (active) get().clearHistory();
    set({ active, selObId: null, selUnitId: null, selCamp: false, selZoneId: null, tool: { kind: 'select' }, hover: null, dragStart: null, strokeActive: false });
  },
  setTool: (tool) => set({ tool, selObId: null, selUnitId: null, selCamp: false, selZoneId: null, dragStart: null, strokeActive: false }),
  setBehavior: (behavior) => set({ behavior }),
  setCorpseLoot: (corpseLoot) => set({ corpseLoot }),
  setRandomSpawn: (randomSpawn) => set({ randomSpawn }),
  setMusic: (music) => set({ music }),
  setMapName: (mapName) => set({ mapName }),
  setSel: (selObId, selUnitId) => set({ selObId, selUnitId, selCamp: false, selZoneId: null }),
  setSelCamp: (selCamp) => set({ selCamp, selObId: null, selUnitId: null, selZoneId: null }),
  setSelZone: (selZoneId) => set({ selZoneId, selObId: null, selUnitId: null, selCamp: false }),
  setZoneKind: (zoneKind) => set({ zoneKind }),
  setDragStart: (dragStart) => set({ dragStart }),
  setStrokeActive: (strokeActive) => set({ strokeActive }),
  setHover: (hover) => set({ hover }),
  rotateTool: () => {
    const t = get().tool;
    if (t.kind !== 'obstacle') return;
    set({ tool: { ...t, w: t.h, h: t.w, rot: ((t.rot || 0) + 90) % 360 } });
  },
  refreshMaps: () => set({ maps: loadSavedMaps() }),
  saveMap: (obstacles, units) => {
    const name = get().mapName.trim();
    if (!name) return 'Дай карте название';
    const maps = loadSavedMaps().filter((m) => m.name !== name);
    const camp = (useCombatGridStore.getState() as any).campfire as { x: number; y: number } | null;
    maps.push({
      name,
      music: get().music,
      bg: (useCombatGridStore.getState() as any).battleBg || 'mapbattle',
      weather: {
        rain: !!(useCombatGridStore.getState() as any).isRaining,
        night: !!(useCombatGridStore.getState() as any).isNightTime,
        fog: (useCombatGridStore.getState() as any).fogLevel || 0,
      },
      obstacles: (obstacles || []).map((o: any) => ({
        icon: o.icon, imgKey: o.imgKey || '', x: o.x, y: o.y, w: o.w, h: o.h,
        rot: o.rot || 0, random: !!o.editorRandom,
      })),
      units: (units || []).map((u: any) => ({
        factionKey: (u as any).factionKey || (u as any).name || '',
        side: (u as any).isNeutral ? 'neutral' : (u as any).faction === 'Союзник' ? 'ally' : 'enemy',
        x: u.pos.x, y: u.pos.y,
        behavior: u.dead ? 'corpse' : ((u as any).aiRole || 'patrol'),
        corpseLoot: u.dead ? !!((u as any).loot && (u as any).loot.length) : undefined,
        patrolRoute: Array.isArray((u as any).patrolRoute) && (u as any).patrolRoute.length >= 2
          ? (u as any).patrolRoute.map((p: any) => ({ x: p.x, y: p.y }))
          : undefined,
      })),
      decals: ((useCombatGridStore.getState() as any).decals || []).map((d: any) => ({ x: d.x, y: d.y, imgKey: d.imgKey })),
      zones: ((useCombatGridStore.getState() as any).zones || []).map((z: any) => ({
        id: String(z.id), kind: z.kind, x: z.x, y: z.y, w: z.w, h: z.h, text: z.text || '',
      })),
      campfire: camp ? { x: camp.x, y: camp.y } : null,
      createdAt: Date.now(),
    });
    persistMaps(maps);
    set({ maps });
    return null;
  },
  deleteMap: (name) => {
    const maps = loadSavedMaps().filter((m) => m.name !== name);
    persistMaps(maps);
    set({ maps });
  },
  pushHistory: () => {
    const cs = useCombatGridStore.getState() as any;
    const snap = JSON.parse(JSON.stringify({
      obstacles: cs.obstacles, enemies: cs.enemies, campfire: cs.campfire,
      decals: cs.decals, zones: cs.zones,
    }));
    set((s: any) => ({
      past: [...((s as any).past || []), snap].slice(-50),
      future: [],
    }));
  },
  undo: () => {
    const st = get() as any;
    if (!st.past || st.past.length === 0) return;
    const cs = useCombatGridStore.getState() as any;
    const cur = JSON.parse(JSON.stringify({
      obstacles: cs.obstacles, enemies: cs.enemies, campfire: cs.campfire,
      decals: cs.decals, zones: cs.zones,
    }));
    const prev = st.past[st.past.length - 1];
    useCombatGridStore.setState({
      obstacles: prev.obstacles, enemies: prev.enemies, campfire: prev.campfire,
      decals: prev.decals, zones: prev.zones,
    } as any);
    set({ past: st.past.slice(0, -1), future: [...(st.future || []), cur].slice(-50) });
    get().setSel(null, null);
  },
  redo: () => {
    const st = get() as any;
    if (!st.future || st.future.length === 0) return;
    const cs = useCombatGridStore.getState() as any;
    const cur = JSON.parse(JSON.stringify({
      obstacles: cs.obstacles, enemies: cs.enemies, campfire: cs.campfire,
      decals: cs.decals, zones: cs.zones,
    }));
    const next = st.future[st.future.length - 1];
    useCombatGridStore.setState({
      obstacles: next.obstacles, enemies: next.enemies, campfire: next.campfire,
      decals: next.decals, zones: next.zones,
    } as any);
    set({ past: [...(st.past || []), cur].slice(-50), future: st.future.slice(0, -1) });
    get().setSel(null, null);
  },
  clearHistory: () => set({ past: [], future: [] } as any),
  canUndo: () => ((get() as any).past || []).length > 0,
  canRedo: () => ((get() as any).future || []).length > 0,
}));

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Пересечение прямоугольников. */
const rectsOverlap = (
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

/** Кламп футпринта в сетку 32×32 (как при установке кликом). */
export const clampFootprint = (w: number, h: number, x: number, y: number) => ({
  nx: Math.max(0, Math.min(32 - w, x)),
  ny: Math.max(0, Math.min(32 - h, y)),
});

/** Точка спавна игрока (2,2) внутри футпринта? */
export const hitsSpawn = (nx: number, ny: number, w: number, h: number) =>
  nx <= 2 && ny <= 2 && 2 < nx + w && 2 < ny + h;

/** Валиден ли футпринт (без пересечений и спавна). */
export const footprintValid = (obstacles: any[], w: number, h: number, nx: number, ny: number, ignoreId?: number | string): boolean => {
  if (hitsSpawn(nx, ny, w, h)) return false;
  return !(obstacles as any[]).some((o: any) =>
    o.id !== ignoreId && rectsOverlap(nx, ny, w, h, o.x, o.y, o.w, o.h));
};

/** Повернуть выбранный объект на 90° (w/h swap + rot). */
export const rotateSelected = (): void => {
  const ed = useMapEditorStore.getState();
  if (ed.selObId === null) return;
  ed.pushHistory();
  const cs = useCombatGridStore;
  const ob = (cs.getState().obstacles as any[]).find((o: any) => o.id === ed.selObId);
  if (!ob) return;
  const nw = ob.h;
  const nh = ob.w;
  const { nx, ny } = clampFootprint(nw, nh, ob.x, ob.y);
  if (!footprintValid(cs.getState().obstacles, nw, nh, nx, ny, ob.id)) {
    usePlayerStore.getState().addLog('🧱 Не повернуть — занято', 'warning');
    return;
  }
  cs.setState((s: any) => ({
    obstacles: s.obstacles.map((o: any) => (o.id === ob.id
      ? { ...o, w: nw, h: nh, x: nx, y: ny, rot: ((o.rot || 0) + 90) % 360 }
      : o)),
  }));
};

/** Удалить выбранное (объект, юнит, костёр или зона). */
export const deleteSelected = (): void => {
  const ed = useMapEditorStore.getState();
  const cs = useCombatGridStore;
  if (ed.selZoneId !== null) {
    ed.pushHistory();
    const id = ed.selZoneId;
    cs.setState((s: any) => ({ zones: (s.zones || []).filter((z: any) => z.id !== id) }));
    ed.setSelZone(null);
    return;
  }
  if (ed.selCamp) {
    ed.pushHistory();
    cs.setState({ campfire: null } as any);
    ed.setSelCamp(false);
    return;
  }
  if (ed.selObId !== null) {
    ed.pushHistory();
    const id = ed.selObId;
    cs.setState((s: any) => ({ obstacles: s.obstacles.filter((o: any) => o.id !== id) }));
    ed.setSel(null, null);
  } else if (ed.selUnitId !== null) {
    ed.pushHistory();
    const id = ed.selUnitId;
    cs.setState((s: any) => ({ enemies: s.enemies.filter((e: any) => e.id !== id) }));
    ed.setSel(null, null);
  }
};

/** Переключить «случайное место при входе» у выбранного объекта. */
export const toggleSelectedRandom = (): void => {
  const ed = useMapEditorStore.getState();
  if (ed.selObId === null) return;
  ed.pushHistory();
  const cs = useCombatGridStore;
  cs.setState((s: any) => ({
    obstacles: s.obstacles.map((o: any) => (o.id === ed.selObId ? { ...o, editorRandom: !o.editorRandom } : o)),
  }));
};

/** Задевает ли футпринт костёр. */
export const footprintHitsCamp = (w: number, h: number, nx: number, ny: number): boolean => {
  const camp = (useCombatGridStore.getState() as any).campfire as { x: number; y: number } | null;
  return !!camp && rectsOverlap(nx, ny, w, h, camp.x, camp.y, 1, 1);
};

/** Свободна ли клетка под костёр (в границах, без объектов и юнитов). */
export const campCellFree = (x: number, y: number): boolean => {
  if (x < 0 || x >= 32 || y < 0 || y >= 32) return false;
  const st = useCombatGridStore.getState();
  const hitOb = (st.obstacles as any[]).some((o: any) => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h);
  if (hitOb) return false;
  const busy = (st.enemies as any[]).some((e: any) => !e.dead && e.pos.x === x && e.pos.y === y);
  if (busy) return false;
  return true;
};

/** Поставить/перенести костёр. Возвращает текст ошибки или null. */
export const placeCampfire = (x: number, y: number): string | null => {
  if (!campCellFree(x, y)) return 'Тут занято';
  useMapEditorStore.getState().pushHistory();
  useCombatGridStore.setState({ campfire: { x, y } } as any);
  useMapEditorStore.getState().setSelCamp(true);
  return null;
};

/** Штрих кисти: поставить/снять декаль (историю пушит начало штриха). */
export const paintDecal = (x: number, y: number, imgKey: string | null): void => {
  if (x < 0 || x >= 32 || y < 0 || y >= 32) return;
  const cs = useCombatGridStore;
  if (imgKey === null) {
    const has = (cs.getState().decals || []).some((d: any) => d.x === x && d.y === y);
    if (!has) return;
    cs.setState((s: any) => ({ decals: (s.decals || []).filter((d: any) => !(d.x === x && d.y === y)) }));
    return;
  }
  const cur = (cs.getState().decals || []).find((d: any) => d.x === x && d.y === y);
  if (cur && cur.imgKey === imgKey) return;
  cs.setState((s: any) => ({
    decals: [...(s.decals || []).filter((d: any) => !(d.x === x && d.y === y)), { x, y, imgKey }],
  }));
};

/** Завершить прямоугольник зоны из dragStart в точку (x,y). */
export const finishZoneRect = (x: number, y: number): string | null => {
  const ed = useMapEditorStore.getState();
  const start = ed.dragStart;
  ed.setDragStart(null);
  if (!start) return 'Нет начала';
  const x1 = Math.max(0, Math.min(start.x, x));
  const y1 = Math.max(0, Math.min(start.y, y));
  const x2 = Math.min(31, Math.max(start.x, x));
  const y2 = Math.min(31, Math.max(start.y, y));
  ed.pushHistory();
  const cs = useCombatGridStore;
  if (ed.zoneKind === 'spawn') {
    // Спавн один: старый сносим.
    const z = { id: `zone_${Date.now()}`, kind: 'spawn', x: x1, y: y1, w: x2 - x1 + 1, h: y2 - y1 + 1 };
    cs.setState((s: any) => ({ zones: [...(s.zones || []).filter((zz: any) => zz.kind !== 'spawn'), z] }));
    ed.setSelZone(z.id);
  } else {
    const z = { id: `zone_${Date.now()}_${Math.floor(Math.random() * 1e6)}`, kind: ed.zoneKind, x: x1, y: y1, w: x2 - x1 + 1, h: y2 - y1 + 1, text: '' };
    cs.setState((s: any) => ({ zones: [...(s.zones || []), z] }));
    ed.setSelZone(z.id);
  }
  return null;
};

/** Добавить точку маршрута выбранному юниту (макс 12). */
export const appendRoutePoint = (unitId: number | string, x: number, y: number): void => {
  const ed = useMapEditorStore.getState();
  const u = (useCombatGridStore.getState().enemies as any[]).find((e: any) => e.id === unitId);
  if (!u || u.dead) return;
  const route = [...((u as any).patrolRoute || [])];
  const last = route[route.length - 1];
  if (last && last.x === x && last.y === y) return;
  if (route.length >= 12) return;
  ed.pushHistory();
  route.push({ x, y });
  useCombatGridStore.setState((s: any) => ({
    enemies: s.enemies.map((e: any) => (e.id === unitId ? { ...e, patrolRoute: route, patrolIdx: 0, aiRole: 'patrol' } : e)),
  }));
};

/** Очистить маршрут юнита. */
export const clearRoute = (unitId: number | string): void => {
  useMapEditorStore.getState().pushHistory();
  useCombatGridStore.setState((s: any) => ({
    enemies: s.enemies.map((e: any) => (e.id === unitId ? { ...e, patrolRoute: undefined, patrolIdx: 0 } : e)),
  }));
};

/** Направление взгляда юнита (фиксируется; часовой не вертится). */
export const setUnitFacing = (unitId: number | string, deg: number): void => {
  useMapEditorStore.getState().pushHistory();
  useCombatGridStore.setState((s: any) => ({
    enemies: s.enemies.map((e: any) => (e.id === unitId ? { ...e, rotation: deg, fixedRotation: true } : e)),
  }));
};

/** Текст триггера (без истории — правится по буквам). */
export const setZoneText = (zoneId: number | string, text: string): void => {
  useCombatGridStore.setState((s: any) => ({
    zones: (s.zones || []).map((z: any) => (z.id === zoneId ? { ...z, text } : z)),
  }));
};

const buildObstacle = (icon: string, imgKey: string, w: number, h: number, x: number, y: number, random: boolean, rot = 0) => {
  const pools: Record<string, string[]> = {
    building: BIG_BUILDING_IMAGES,
    car: CAR_IMAGES,
    woods: WOOD_IMAGES,
    small: SMALL_OBSTACLE_IMAGES,
    fence: [FENCE_IMAGE],
    field: [FIELD_IMAGE],
  };
  return {
    id: `edob_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    x, y, w, h,
    type: icon === 'woods' ? 'woods' : icon === 'field' ? 'field' : icon === 'fence' ? 'fence' : icon === 'car' ? 'car' : 'small',
    blocks: true, icon, imgKey,
    isWalkable: icon === 'woods' || icon === 'field',
    isHigh: icon === 'building' || icon === 'fence',
    imgIndex: Math.max(0, (pools[icon] || []).indexOf(imgKey)),
    rot, editorRandom: random,
  };
};

/**
 * ДОБАВИТЬ: кладёт выбранный в палитре объект на случайное свободное место.
 * Галочка «случайное место при входе» решает, будет ли он случайным при каждом
 * входе на карту (random=true) или зафиксируется там, где встал (random=false).
 */
export const addRandomObstacle = (): string | null => {
  const ed = useMapEditorStore.getState();
  if (ed.tool.kind !== 'obstacle') return 'Выбери объект в палитре';
  const cs = useCombatGridStore;
  const st = cs.getState();
  for (let a = 0; a < 200; a++) {
    const rx = Math.floor(Math.random() * (32 - ed.tool.w + 1));
    const ry = Math.floor(Math.random() * (32 - ed.tool.h + 1));
    if (!footprintValid(st.obstacles, ed.tool.w, ed.tool.h, rx, ry)) continue;
    if (footprintHitsCamp(ed.tool.w, ed.tool.h, rx, ry)) continue;
    const ob = buildObstacle(ed.tool.icon, ed.tool.imgKey, ed.tool.w, ed.tool.h, rx, ry, ed.randomSpawn, ed.tool.rot || 0);
    ed.pushHistory();
    cs.setState((s: any) => ({ obstacles: [...s.obstacles, ob] }));
    ed.setSel(ob.id, null);
    return null;
  }
  return 'Нет свободного места';
};

/** Клик по клетке в режиме конструктора: поставить/выбрать/перенести. */
export const editorCellClick = (x: number, y: number): void => {
  const ed = useMapEditorStore.getState();
  if (!ed.active) return;
  const cs = useCombatGridStore;
  const st = cs.getState();
  const tool = ed.tool;
  const findOb = () => (st.obstacles as any[]).find((o: any) => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h);
  // Трупы тоже выбираются и переносятся.
  const findUnit = () => (st.enemies as any[]).find((e: any) => e.pos.x === x && e.pos.y === y);
  if (tool.kind === 'select') {
    // Перенос выбранного костра.
    if (ed.selCamp) {
      if (campCellFree(x, y)) {
        ed.pushHistory();
        cs.setState({ campfire: { x, y } } as any);
        return;
      }
      // Занято — падаем ниже и перевыбираем.
    }
    if (ed.selObId !== null && ed.selUnitId === null) {
      const ob = (st.obstacles as any[]).find((o: any) => o.id === ed.selObId);
      if (ob) {
        const nx = Math.max(0, Math.min(32 - ob.w, x));
        const ny = Math.max(0, Math.min(32 - ob.h, y));
        const clash = (st.obstacles as any[]).some((o: any) =>
          o.id !== ob.id && rectsOverlap(nx, ny, ob.w, ob.h, o.x, o.y, o.w, o.h));
        if (!clash && !footprintHitsCamp(ob.w, ob.h, nx, ny) && !(nx <= 2 && ny <= 2 && 2 < nx + ob.w && 2 < ny + ob.h)) {
          ed.pushHistory();
          cs.setState((s: any) => ({
            obstacles: s.obstacles.map((o: any) => (o.id === ob.id ? { ...o, x: nx, y: ny } : o)),
          }));
          return;
        }
      }
    }
    if (ed.selUnitId !== null && ed.selObId === null) {
      const u = (st.enemies as any[]).find((e: any) => e.id === ed.selUnitId);
      if (u) {
        const busy = (st.enemies as any[]).some((e: any) => e.id !== u.id && e.pos.x === x && e.pos.y === y);
        const camp = (st as any).campfire as { x: number; y: number } | null;
        if (!busy && !(camp && camp.x === x && camp.y === y)) {
          ed.pushHistory();
          cs.setState((s: any) => ({
            enemies: s.enemies.map((e: any) => (e.id === u.id ? { ...e, pos: { x, y } } : e)),
          }));
          return;
        }
      }
    }
    const camp = (st as any).campfire as { x: number; y: number } | null;
    if (camp && camp.x === x && camp.y === y) {
      ed.setSelCamp(true);
      return;
    }
    const zoneHit = ((st as any).zones || []).find((z: any) => x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h);
    if (zoneHit && !findOb()) {
      ed.setSelZone((zoneHit as any).id);
      return;
    }
    const ob = findOb();
    const u = !ob ? findUnit() : undefined;
    ed.setSel(ob ? (ob as any).id : null, u ? (u as any).id : null);
    return;
  }
  if (tool.kind === 'campfire') {
    const err = placeCampfire(x, y);
    if (err) usePlayerStore.getState().addLog('🔥 Тут занято', 'warning');
    return;
  }
  if (tool.kind === 'brush') {
    ed.pushHistory();
    paintDecal(x, y, tool.imgKey);
    return;
  }
  if (tool.kind === 'eraser') {
    ed.pushHistory();
    paintDecal(x, y, null);
    return;
  }
  if (tool.kind === 'route') {
    if (ed.selUnitId === null) {
      // Без выбранного юнита — выбираем кликом.
      const u = findUnit();
      if (u && !(u as any).dead) ed.setSel(null, (u as any).id);
      else usePlayerStore.getState().addLog('📍 Сначала выбери живого юнита', 'warning');
      return;
    }
    appendRoutePoint(ed.selUnitId, x, y);
    return;
  }
  if (tool.kind === 'zone') {
    // Зоны рисуются протяжкой (mousedown→mouseup); одиночный клик — 1×1.
    ed.pushHistory();
    const z = { id: `zone_${Date.now()}_${Math.floor(Math.random() * 1e6)}`, kind: ed.zoneKind, x, y, w: 1, h: 1, text: '' };
    if (ed.zoneKind === 'spawn') {
      cs.setState((s: any) => ({ zones: [...(s.zones || []).filter((zz: any) => zz.kind !== 'spawn'), z] }));
    } else {
      cs.setState((s: any) => ({ zones: [...(s.zones || []), z] }));
    }
    ed.setSelZone(z.id);
    return;
  }
  if (tool.kind === 'obstacle') {
    const { nx, ny } = clampFootprint(tool.w, tool.h, x, y);
    if (!footprintValid(st.obstacles, tool.w, tool.h, nx, ny) || footprintHitsCamp(tool.w, tool.h, nx, ny)) {
      usePlayerStore.getState().addLog('🧱 Тут занято', 'warning');
      return;
    }
    const ob = buildObstacle(tool.icon, tool.imgKey, tool.w, tool.h, nx, ny, ed.randomSpawn, tool.rot || 0);
    ed.pushHistory();
    cs.setState((s: any) => ({ obstacles: [...s.obstacles, ob] }));
    ed.setSel(ob.id, null);
    return;
  }
  // Труп тоже занимает клетку; на костёр не ставим.
  const busy = (st.enemies as any[]).some((e: any) => e.pos.x === x && e.pos.y === y);
  const campNow = (st as any).campfire as { x: number; y: number } | null;
  if (busy || (campNow && campNow.x === x && campNow.y === y)) {
    usePlayerStore.getState().addLog('🧍 Клетка занята', 'warning');
    return;
  }
  try {
    ed.pushHistory();
    cs.getState().spawnEditorUnit(tool.factionKey, tool.side, x, y, ed.behavior, ed.corpseLoot);
  } catch { /* ignore */ }
};
