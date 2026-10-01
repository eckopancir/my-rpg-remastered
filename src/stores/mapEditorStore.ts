import { create } from 'zustand';
import { useCombatGridStore } from './combatGridStore';
import { usePlayerStore } from './playerStore';
import { useAuthStore } from './authStore';
import { BIG_BUILDING_IMAGES, CAR_IMAGES, WOOD_IMAGES, SMALL_OBSTACLE_IMAGES, FENCE_IMAGE, FIELD_IMAGE, EDITOR_POOLS, isObstacleWalkable, isObstacleBlocking, isShootThrough, isOpenCell, searchLootForProp, rotateOpenCells } from '../engine/terrain';

export type EditorTool =
  | { kind: 'select' }
  | { kind: 'obstacle'; icon: string; imgKey: string; w: number; h: number; rot: number }
  | { kind: 'unit'; side: 'enemy' | 'neutral' | 'ally'; factionKey: string }
  | { kind: 'campfire' }
  | { kind: 'brush'; imgKey: string }
  | { kind: 'eraser' }
  | { kind: 'zone' }
  | { kind: 'route' }
  | { kind: 'holes' };

export type SavedMapUnit = {
  factionKey: string;
  side: 'enemy' | 'neutral' | 'ally';
  x: number;
  y: number;
  behavior: string;
  corpseLoot?: boolean;
  patrolRoute?: { x: number; y: number }[];
};

/** Юнит гарнизона (подкрепление): на карте не стоит, приходит в свой ход. */
export type SavedMapGarrison = {
  factionKey: string;
  side: 'enemy' | 'neutral' | 'ally';
  behavior: string;
  corpseLoot?: boolean;
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
  openCells?: { dx: number; dy: number; cover?: boolean }[];
};

export interface SavedMap {
  name: string;
  music: string;
  music2?: string;
  musicCombatOnly?: boolean;
  introBarks?: string[];
  bg: string;
  weather: { rain: boolean; night: boolean; fog: number };
  obstacles: SavedMapObstacle[];
  units: SavedMapUnit[];
  decals: { x: number; y: number; imgKey: string; size?: number }[];
  zones: { id: string; kind: 'spawn' | 'exit' | 'trigger' | 'reinforce'; x: number; y: number; w: number; h: number; text?: string }[];
  garrison: SavedMapGarrison[];
  reinforceTurn: number;
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
  { id: 'normal', label: 'Обычный' },
  { id: 'patrol', label: 'Патруль' },
  { id: 'camp', label: 'Лагерь' },
  { id: 'sentry', label: 'Часовой' },
  { id: 'sleeping', label: 'Спит' },
  { id: 'corpse', label: '💀 Труп' },
];

/** Треки для карты. */
export const MAP_MUSIC = [
  { id: 'track', label: 'Обычная' },
  { id: 'basic music', label: 'Основная (basic music)' },
  { id: 'redfaction2', label: 'Red Faction 2' },
  { id: 'red_faction_2_41 - Multiplayer 2', label: 'RF2 Multiplayer 2' },
  { id: 'red_faction_2_42 - Multiplayer 3', label: 'RF2 Multiplayer 3' },
  { id: 'Miguel Johnson - Good Day To Die', label: 'Good Day To Die' },
  { id: 'zemlya-mutantov', label: 'Земля мутантов' },
  { id: 'zvuki-prirody-1_-kapli-dozhdya', label: 'Дождь' },
  { id: 'zvuki-sverchkov1', label: 'Ночь (сверчки)' },
  { id: '__none', label: '🔇 Без музыки' },
];

interface MapEditorStore {
  active: boolean;
  tool: EditorTool;
  behavior: string;
  corpseLoot: boolean;
  randomSpawn: boolean;
  music: string;
  music2: string;
  musicCombatOnly: boolean;
  introBarks: string;
  mapName: string;
  maps: SavedMap[];
  selObId: number | string | null;
  selUnitId: number | string | null;
  selCamp: boolean;
  selZoneId: number | string | null;
  zoneKind: 'spawn' | 'exit' | 'trigger' | 'reinforce';
  toReinforce: boolean;
  dragStart: { x: number; y: number } | null;
  strokeActive: boolean;
  brushSize: number;
  hover: { x: number; y: number } | null;
  setActive: (v: boolean) => void;
  setTool: (t: EditorTool) => void;
  setBehavior: (b: string) => void;
  setCorpseLoot: (v: boolean) => void;
  setRandomSpawn: (v: boolean) => void;
  setMusic: (m: string) => void;
  setMusic2: (m: string) => void;
  setMusicCombatOnly: (v: boolean) => void;
  setIntroBarks: (s: string) => void;
  setMapName: (n: string) => void;
  setSel: (obId: number | string | null, unitId: number | string | null) => void;
  setSelCamp: (v: boolean) => void;
  setSelZone: (id: number | string | null) => void;
  setZoneKind: (k: 'spawn' | 'exit' | 'trigger' | 'reinforce') => void;
  setToReinforce: (v: boolean) => void;
  holeMode: 'open' | 'cover';
  setHoleMode: (m: 'open' | 'cover') => void;
  /** Полный свет в конструкторе: без ночи и тумана конуса. */
  fullLight: boolean;
  setFullLight: (v: boolean) => void;
  setReinforceTurn: (n: number) => void;
  addGarrison: (g: SavedMapGarrison) => void;
  removeGarrison: (idx: number) => void;
  setGarrison: (g: SavedMapGarrison[]) => void;
  setDragStart: (p: { x: number; y: number } | null) => void;
  setStrokeActive: (v: boolean) => void;
  setBrushSize: (n: number) => void;
  /** Плотность штампов: доля диаметра между соседними (0.15–1). */
  brushDensity: number;
  setBrushDensity: (n: number) => void;
  /** Свободная позиция курсора (дробные клетки) для круг-призрака. */
  hoverF: { x: number; y: number } | null;
  setHoverF: (h: { x: number; y: number } | null) => void;
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
  /** Импорт карты из JSON-файла (валидация + sanitize). */
  importMap: (m: SavedMap) => string | null;
  /** Карты на сервере (метаданные). */
  serverMaps: { name: string; updatedAt: string; obstacles: number; units: number }[];
  refreshServerMaps: () => Promise<string | null>;
  /** Залить текущую карту на сервер (видно разработчику). */
  uploadCurrentMap: () => Promise<string | null>;
  /** Скачать карту с сервера в локальный список. */
  downloadServerMap: (name: string) => Promise<string | null>;
  deleteServerMap: (name: string) => Promise<string | null>;
}

export const useMapEditorStore = create<MapEditorStore>()((set, get) => ({
  active: false,
  tool: { kind: 'select' },
  behavior: 'patrol',
  corpseLoot: true,
  randomSpawn: false,
  music: 'track',
  music2: '__none',
  musicCombatOnly: false,
  introBarks: '',
  mapName: '',
  maps: loadSavedMaps(),
  past: [],
  future: [],
  selObId: null,
  selUnitId: null,
  selCamp: false,
  selZoneId: null,
  zoneKind: 'spawn',
  toReinforce: false,
  garrison: [],
  reinforceTurn: 39,
  dragStart: null,
  strokeActive: false,
  brushSize: 2,
  brushDensity: 0.35,
  hoverF: null,
  hover: null,
  setActive: (active) => {
    if (active) get().clearHistory();
    set({ active, selObId: null, selUnitId: null, selCamp: false, selZoneId: null, tool: { kind: 'select' }, hover: null, hoverF: null, dragStart: null, strokeActive: false });
  },
  setTool: (tool) => set({ tool, selObId: null, selUnitId: null, selCamp: false, selZoneId: null, dragStart: null, strokeActive: false }),
  setBehavior: (behavior) => set({ behavior }),
  setCorpseLoot: (corpseLoot) => set({ corpseLoot }),
  setRandomSpawn: (randomSpawn) => set({ randomSpawn }),
  setMusic: (music) => set({ music }),
  setMusic2: (music2) => set({ music2 }),
  setMusicCombatOnly: (musicCombatOnly) => set({ musicCombatOnly }),
  setIntroBarks: (introBarks) => set({ introBarks }),
  setMapName: (mapName) => set({ mapName }),
  setSel: (selObId, selUnitId) => set({ selObId, selUnitId, selCamp: false, selZoneId: null }),
  setSelCamp: (selCamp) => set({ selCamp, selObId: null, selUnitId: null, selZoneId: null }),
  setSelZone: (selZoneId) => set({ selZoneId, selObId: null, selUnitId: null, selCamp: false }),
  setZoneKind: (zoneKind) => set({ zoneKind }),
  setToReinforce: (toReinforce) => set({ toReinforce }),
  /** Режим дырок: проход (зелёные) или укрытие (оранжевые, накрывают юнита). */
  holeMode: 'open' as 'open' | 'cover',
  setHoleMode: (holeMode: 'open' | 'cover') => set({ holeMode }),
  fullLight: false,
  setFullLight: (fullLight) => set({ fullLight }),
  setReinforceTurn: (n) => set({ reinforceTurn: Math.max(1, Math.min(200, Math.round(n) || 39)) }),
  addGarrison: (g) => {
    get().pushHistory();
    set((s: any) => ({ garrison: [...(s.garrison || []), g] }));
  },
  removeGarrison: (idx) => {
    get().pushHistory();
    set((s: any) => ({ garrison: (s.garrison || []).filter((_: any, i: number) => i !== idx) }));
  },
  setGarrison: (garrison) => set({ garrison: [...garrison] }),
  setDragStart: (dragStart) => set({ dragStart }),
  setStrokeActive: (strokeActive) => set({ strokeActive }),
  setBrushSize: (n) => set({ brushSize: Math.max(1, Math.min(5, Math.round(n) || 1)) }),
  setBrushDensity: (n) => set({ brushDensity: Math.max(0.15, Math.min(1, n || 0.35)) }),
  setHoverF: (hoverF) => {
    const cur = get().hoverF;
    if (cur && hoverF && Math.abs(cur.x - hoverF.x) < 0.05 && Math.abs(cur.y - hoverF.y) < 0.05) return;
    if (!cur && !hoverF) return;
    set({ hoverF });
  },
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
    maps.push(buildMapObject(name, get().music, obstacles, units));
    persistMaps(maps);
    set({ maps });
    return null;
  },
  deleteMap: (name) => {
    const maps = loadSavedMaps().filter((m) => m.name !== name);
    persistMaps(maps);
    set({ maps });
  },
  importMap: (m) => {
    const src = m as any;
    if (!src || typeof src.name !== 'string' || !src.name.trim()) return 'Нет названия карты';
    if (!Array.isArray(src.obstacles) || !Array.isArray(src.units)) return 'Битый файл карты';
    const maps = loadSavedMaps().filter((x) => x.name !== src.name.trim());
    maps.push({
      name: src.name.trim(),
      music: typeof src.music === 'string' ? src.music : 'track',
      music2: typeof src.music2 === 'string' ? src.music2 : '__none',
      musicCombatOnly: !!src.musicCombatOnly,
      introBarks: Array.isArray(src.introBarks) ? src.introBarks.filter((s: any) => typeof s === 'string').map((s: string) => s.slice(0, 80)).slice(0, 20) : [],
      bg: typeof src.bg === 'string' ? src.bg : 'mapbattle',
      weather: {
        rain: !!src.weather?.rain,
        night: !!src.weather?.night,
        fog: Math.max(0, Math.min(100, Number(src.weather?.fog) || 0)),
      },
      obstacles: src.obstacles,
      units: src.units,
      decals: Array.isArray(src.decals) ? src.decals : [],
      zones: Array.isArray(src.zones) ? src.zones : [],
      garrison: Array.isArray(src.garrison) ? src.garrison : [],
      reinforceTurn: Math.max(1, Math.min(200, Number(src.reinforceTurn) || 39)),
      campfire: src.campfire && typeof src.campfire.x === 'number' ? { x: src.campfire.x, y: src.campfire.y } : null,
      createdAt: Date.now(),
    });
    persistMaps(maps);
    set({ maps });
    return null;
  },
  serverMaps: [],
  refreshServerMaps: async () => {
    try {
      const data = await mapsApi('list.php');
      set({ serverMaps: Array.isArray(data.maps) ? data.maps : [] });
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  },
  uploadCurrentMap: async () => {
    try {
      const st = get();
      const name = st.mapName.trim();
      if (!name) return 'Дай карте название';
      const cs = useCombatGridStore.getState();
      const map = buildMapObject(name, st.music, (cs as any).obstacles, (cs as any).enemies);
      await mapsApi('save.php', { method: 'POST', body: JSON.stringify({ name, map }) });
      await get().refreshServerMaps();
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  },
  downloadServerMap: async (name: string) => {
    try {
      const data = await mapsApi(`load.php?name=${encodeURIComponent(name)}`);
      if (!data || !data.map) return 'Пустой ответ сервера';
      return get().importMap(data.map as SavedMap);
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  },
  deleteServerMap: async (name: string) => {
    try {
      await mapsApi('delete.php', { method: 'POST', body: JSON.stringify({ name }) });
      await get().refreshServerMaps();
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  },
  pushHistory: () => {
    const cs = useCombatGridStore.getState() as any;
    const snap = JSON.parse(JSON.stringify({
      obstacles: cs.obstacles, enemies: cs.enemies, campfire: cs.campfire,
      decals: cs.decals, zones: cs.zones, garrison: (get() as any).garrison || [],
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
      decals: cs.decals, zones: cs.zones, garrison: st.garrison || [],
    }));
    const prev = st.past[st.past.length - 1];
    useCombatGridStore.setState({
      obstacles: prev.obstacles, enemies: prev.enemies, campfire: prev.campfire,
      decals: prev.decals, zones: prev.zones,
    } as any);
    set({ past: st.past.slice(0, -1), future: [...(st.future || []), cur].slice(-50), garrison: prev.garrison || [] });
    get().setSel(null, null);
  },
  redo: () => {
    const st = get() as any;
    if (!st.future || st.future.length === 0) return;
    const cs = useCombatGridStore.getState() as any;
    const cur = JSON.parse(JSON.stringify({
      obstacles: cs.obstacles, enemies: cs.enemies, campfire: cs.campfire,
      decals: cs.decals, zones: cs.zones, garrison: st.garrison || [],
    }));
    const next = st.future[st.future.length - 1];
    useCombatGridStore.setState({
      obstacles: next.obstacles, enemies: next.enemies, campfire: next.campfire,
      decals: next.decals, zones: next.zones,
    } as any);
    set({ past: [...(st.past || []), cur].slice(-50), future: st.future.slice(0, -1), garrison: next.garrison || [] });
    get().setSel(null, null);
  },
  clearHistory: () => set({ past: [], future: [] } as any),
  canUndo: () => ((get() as any).past || []).length > 0,
  canRedo: () => ((get() as any).future || []).length > 0,
}));

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Объект карты для сохранения (локально/файл/сервер) из текущего состояния боя. */
export const buildMapObject = (name: string, music: string, obstacles: any[], units: any[]): SavedMap => {
  const cs = useCombatGridStore.getState() as any;
  const camp = cs.campfire as { x: number; y: number } | null;
  return {
    name,
    music,
    music2: useMapEditorStore.getState().music2 || '__none',
    musicCombatOnly: !!useMapEditorStore.getState().musicCombatOnly,
    introBarks: useMapEditorStore.getState().introBarks.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 20),
    bg: cs.battleBg || 'mapbattle',
    weather: {
      rain: !!cs.isRaining,
      night: !!cs.isNightTime,
      fog: cs.fogLevel || 0,
    },
    obstacles: (obstacles || []).map((o: any) => ({
      icon: o.icon, imgKey: o.imgKey || '', x: o.x, y: o.y, w: o.w, h: o.h,
      rot: o.rot || 0, random: !!o.editorRandom,
      openCells: Array.isArray(o.openCells) && o.openCells.length > 0
        ? o.openCells.map((c: any) => ({ dx: c.dx || 0, dy: c.dy || 0, ...(c.cover ? { cover: true } : null) }))
        : undefined,
    })),
    units: (units || []).map((u: any) => ({
      factionKey: (u as any).factionKey || (u as any).name || '',
      side: (u as any).isNeutral ? 'neutral' : (u as any).faction === 'Союзник' ? 'ally' : 'enemy',
      x: u.pos.x, y: u.pos.y,
      behavior: u.dead ? 'corpse' : (u.sleeping ? 'sleeping' : ((u as any).aiRole || 'patrol')), // Сон — флаг: иначе спящий сохранялся как patrol.
      corpseLoot: u.dead ? !!((u as any).loot && (u as any).loot.length) : undefined,
      patrolRoute: Array.isArray((u as any).patrolRoute) && (u as any).patrolRoute.length >= 2
        ? (u as any).patrolRoute.map((p: any) => ({ x: p.x, y: p.y }))
        : undefined,
    })),
    decals: (cs.decals || []).map((d: any) => ({
      x: Math.round((d.x ?? 0) * 100) / 100, y: Math.round((d.y ?? 0) * 100) / 100,
      imgKey: d.imgKey, size: d.size || 1,
    })),
    zones: (cs.zones || []).map((z: any) => ({
      id: String(z.id), kind: z.kind, x: z.x, y: z.y, w: z.w, h: z.h, text: z.text || '',
    })),
    garrison: [...((useMapEditorStore.getState() as any).garrison || [])],
    reinforceTurn: (useMapEditorStore.getState() as any).reinforceTurn || 39,
    campfire: camp ? { x: camp.x, y: camp.y } : null,
    createdAt: Date.now(),
  };
};

/** Запрос к API карт (авторизация по токену). */
const mapsApi = async (path: string, init?: RequestInit): Promise<any> => {
  const token = useAuthStore.getState().token;
  if (!token) throw new Error('Войди в аккаунт');
  const res = await fetch(`/api/maps/${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...((init && init.headers) || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data as any).error) throw new Error((data as any).error || `HTTP ${res.status}`);
  return data;
};

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

/** Валиден ли футпринт (без пересечений и спавна). Невидимый свет не мешает.
 * Пересечение с дырками чужого объекта — можно (ставить на крышу/внутрь). */
export const footprintValid = (obstacles: any[], w: number, h: number, nx: number, ny: number, ignoreId?: number | string): boolean => {
  if (hitsSpawn(nx, ny, w, h)) return false;
  return !(obstacles as any[]).some((o: any) => {
    if (o.id === ignoreId || o.icon === 'light') return false;
    if (!rectsOverlap(nx, ny, w, h, o.x, o.y, o.w, o.h)) return false;
    // Все общие клетки — дырки? Тогда встаём поверх, клаша нет.
    const x0 = Math.max(nx, o.x);
    const x1 = Math.min(nx + w, o.x + o.w);
    const y0 = Math.max(ny, o.y);
    const y1 = Math.min(ny + h, o.y + o.h);
    for (let cx = x0; cx < x1; cx++) {
      for (let cy = y0; cy < y1; cy++) {
        if (!isOpenCell(o, cx, cy)) return true;
      }
    }
    return false;
  });
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
      ? { ...o, w: nw, h: nh, x: nx, y: ny, rot: ((o.rot || 0) + 90) % 360, openCells: rotateOpenCells(o.openCells, o.w, o.h) }
      : o)),
  }));
};

/** Сбросить дырки выбранного объекта. */
export const clearOpenCells = (): void => {
  const ed = useMapEditorStore.getState();
  if (ed.selObId === null) return;
  ed.pushHistory();
  useCombatGridStore.setState((s: any) => ({
    obstacles: s.obstacles.map((o: any) => (o.id === ed.selObId ? { ...o, openCells: [] } : o)),
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

/** Свободна ли клетка под костёр (в границах, без объектов и юнитов; дырки — можно; свет не мешает). */
export const campCellFree = (x: number, y: number): boolean => {
  if (x < 0 || x >= 32 || y < 0 || y >= 32) return false;
  const st = useCombatGridStore.getState();
  const hitOb = (st.obstacles as any[]).some((o: any) => o.icon !== 'light' && x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h && !isOpenCell(o, x, y));
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

/** Штрих кисти-ручки: свободный штамп (x,y дробные, size — диаметр в клетках). Ластик стирает всё в радиусе. Кап 2000 штампов. */
export const paintDecal = (x: number, y: number, imgKey: string | null, size = 1): void => {
  if (x < -1 || x > 33 || y < -1 || y > 33) return;
  const cs = useCombatGridStore;
  const r2 = (size / 2) * (size / 2);
  if (imgKey === null) {
    const cur = (cs.getState().decals || []) as any[];
    const left = cur.filter((d: any) => (d.x - x) * (d.x - x) + (d.y - y) * (d.y - y) > r2 + 0.04);
    if (left.length === cur.length) return;
    cs.setState({ decals: left } as any);
    return;
  }
  const cur = ((cs.getState().decals || []) as any[]).slice();
  if (cur.length >= 2000) {
    usePlayerStore.getState().addLog('🖌 Лимит 2000 штампов', 'warning');
    return;
  }
  cur.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, imgKey, size });
  cs.setState({ decals: cur } as any);
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

/** Реквизит конструктора: ходить нельзя, стрелять сквозь можно. */
export const PROP_IMAGES = [
  'o5_2', 'o5_3', 'o5_4', 'o5_5', 'o5_6', 'o5_7', 'o5_8',
  'o47', 'o42', 'o43', 'o40', 'o44', 'o45', 'o46', 'o41', 'fonar',
];
/** Футпринты реквизита (проверены по аспекту арта). */
export const PROP_SIZES: Record<string, { w: number; h: number }> = {
  o5_2: { w: 2, h: 2 },
  o5_3: { w: 2, h: 1 },
  o5_4: { w: 1, h: 1 },
  o5_5: { w: 1, h: 1 },
  o5_6: { w: 1, h: 1 },
  o5_7: { w: 1, h: 2 },
  o5_8: { w: 1, h: 1 },
  o47: { w: 1, h: 1 },
  o42: { w: 3, h: 4 },
  o43: { w: 2, h: 3 },
  o40: { w: 2, h: 3 },
  o44: { w: 2, h: 4 },
  o45: { w: 3, h: 3 },
  o46: { w: 3, h: 3 },
  o41: { w: 6, h: 6 },
  fonar: { w: 1, h: 1 },
  trash_pile: { w: 2, h: 2 },
  trash_pile2: { w: 2, h: 2 },
  trash_tank: { w: 2, h: 1 },
  trash_can: { w: 1, h: 1 },
  ice_kiosks: { w: 4, h: 4 },
  lamp_post: { w: 1, h: 2 },
  bus: { w: 2, h: 4 },
  bus_stop: { w: 4, h: 2 },
};
/** Невидимые лампы: уровень света (радиус в клетках, альфа днём/ночью). */
export const LIGHT_LEVELS: Record<string, { r: number; day: number; night: number }> = {
  light1: { r: 2, day: 0.10, night: 0.22 },
  light2: { r: 3, day: 0.12, night: 0.30 },
  light3: { r: 4.5, day: 0.14, night: 0.38 },
  light4: { r: 6, day: 0.16, night: 0.46 },
  light5: { r: 8, day: 0.18, night: 0.55 },
};
/** Прожектор фонаря: смещение света от центра корпуса (кл), радиус, альфа. */
export const FONAR_LIGHT = { dx: 1.2, dy: 0, r: 3.2, rNight: 4.6, day: 0.15, night: 0.5 };

const buildObstacle = (icon: string, imgKey: string, w: number, h: number, x: number, y: number, random: boolean, rot = 0) => {
  const pools: Record<string, string[]> = EDITOR_POOLS;
  const walkThrough = isObstacleWalkable(icon, imgKey);
  return {
    id: `edob_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    x, y, w, h,
    type: icon === 'woods' ? 'woods' : icon === 'field' ? 'field' : icon === 'fence' ? 'fence' : icon === 'car' ? 'car' : 'small',
    blocks: isObstacleBlocking(icon, imgKey), icon, imgKey,
    isWalkable: walkThrough,
    isHigh: icon === 'building' || icon === 'fence',
    imgIndex: Math.max(0, (pools[icon] || []).indexOf(imgKey)),
    rot, editorRandom: random,
    shootThrough: isShootThrough(icon, imgKey),
    searchLoot: searchLootForProp(icon, imgKey),
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
        // Перенос — та же проверка, что установка (дырки чужих объектов — можно).
        if (footprintValid(st.obstacles, ob.w, ob.h, nx, ny, ob.id) && !footprintHitsCamp(ob.w, ob.h, nx, ny)) {
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
    // Приоритет выбора: сначала юнит (стоит на объекте/дырках), потом объект.
    const u = findUnit();
    const ob = !u ? findOb() : undefined;
    ed.setSel(ob ? (ob as any).id : null, u ? (u as any).id : null);
    return;
  }
  if (tool.kind === 'campfire') {
    const err = placeCampfire(x, y);
    if (err) usePlayerStore.getState().addLog('🔥 Тут занято', 'warning');
    return;
  }
  // Дырки: клик по клетке объекта вкл/выкл проходимость+прострел.
  // Режим немой: ничего не выбираем, иначе конфликт с «выбрать».
  // Тип из holeMode: проход (open) или укрытие (cover, накрывает юнита артом).
  if (tool.kind === 'holes') {
    const ob = findOb();
    if (!ob) {
      usePlayerStore.getState().addLog('🕳 Кликни по клетке объекта', 'warning');
      return;
    }
    ed.pushHistory();
    const dx = x - ob.x;
    const dy = y - ob.y;
    const cur = Array.isArray(ob.openCells) ? ob.openCells : [];
    const found = cur.find((c: any) => c.dx === dx && c.dy === dy);
    const wantCover = ed.holeMode === 'cover';
    // Та же клетка тем же типом — снять; другим типом — переключить; нет — добавить.
    const next = !found
      ? [...cur, wantCover ? { dx, dy, cover: true } : { dx, dy }]
      : (found.cover === true) === wantCover
        ? cur.filter((c: any) => !(c.dx === dx && c.dy === dy))
        : cur.map((c: any) => (c.dx === dx && c.dy === dy ? (wantCover ? { dx, dy, cover: true } : { dx, dy }) : c));
    cs.setState((s: any) => ({
      obstacles: s.obstacles.map((o: any) => (o.id === ob.id ? { ...o, openCells: next } : o)),
    }));
    return;
  }
  if (tool.kind === 'brush') {
    ed.pushHistory();
    paintDecal(x + 0.5, y + 0.5, tool.imgKey, ed.brushSize);
    return;
  }
  if (tool.kind === 'eraser') {
    ed.pushHistory();
    paintDecal(x + 0.5, y + 0.5, null, ed.brushSize);
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
  // В гарнизон (подкрепление): на карту не встаёт, уйдёт в списке.
  if (tool.kind === 'unit' && ed.toReinforce) {
    ed.addGarrison({
      factionKey: tool.factionKey, side: tool.side,
      behavior: ed.behavior === 'corpse' ? 'patrol' : ed.behavior,
      corpseLoot: ed.behavior === 'corpse' ? ed.corpseLoot : undefined,
    });
    usePlayerStore.getState().addLog(
      `📦 В гарнизон: ${tool.side === 'neutral' ? 'Кабан' : tool.side === 'ally' ? 'Мусорщик' : tool.factionKey} (${ed.behavior})`,
      'info',
    );
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
