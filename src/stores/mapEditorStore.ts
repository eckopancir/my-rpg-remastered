import { create } from 'zustand';
import { useCombatGridStore } from './combatGridStore';
import { usePlayerStore } from './playerStore';
import { BIG_BUILDING_IMAGES, CAR_IMAGES, WOOD_IMAGES, SMALL_OBSTACLE_IMAGES, FENCE_IMAGE, FIELD_IMAGE } from '../engine/terrain';

export type EditorTool =
  | { kind: 'select' }
  | { kind: 'obstacle'; icon: string; imgKey: string; w: number; h: number }
  | { kind: 'unit'; side: 'enemy' | 'neutral' | 'ally'; factionKey: string };

export type SavedMapUnit = {
  factionKey: string;
  side: 'enemy' | 'neutral' | 'ally';
  x: number;
  y: number;
  behavior: string;
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
  obstacles: SavedMapObstacle[];
  units: SavedMapUnit[];
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
  randomSpawn: boolean;
  music: string;
  mapName: string;
  maps: SavedMap[];
  selObId: number | string | null;
  selUnitId: number | string | null;
  hover: { x: number; y: number } | null;
  setActive: (v: boolean) => void;
  setTool: (t: EditorTool) => void;
  setBehavior: (b: string) => void;
  setRandomSpawn: (v: boolean) => void;
  setMusic: (m: string) => void;
  setMapName: (n: string) => void;
  setSel: (obId: number | string | null, unitId: number | string | null) => void;
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
  randomSpawn: false,
  music: 'track',
  mapName: '',
  maps: loadSavedMaps(),
  selObId: null,
  selUnitId: null,
  hover: null,
  setActive: (active) => set({ active, selObId: null, selUnitId: null, tool: { kind: 'select' }, hover: null }),
  setTool: (tool) => set({ tool, selObId: null, selUnitId: null }),
  setBehavior: (behavior) => set({ behavior }),
  setRandomSpawn: (randomSpawn) => set({ randomSpawn }),
  setMusic: (music) => set({ music }),
  setMapName: (mapName) => set({ mapName }),
  setSel: (selObId, selUnitId) => set({ selObId, selUnitId }),
  setHover: (hover) => set({ hover }),
  rotateTool: () => {
    const t = get().tool;
    if (t.kind !== 'obstacle') return;
    set({ tool: { ...t, w: t.h, h: t.w } });
  },
  refreshMaps: () => set({ maps: loadSavedMaps() }),
  saveMap: (obstacles, units) => {
    const name = get().mapName.trim();
    if (!name) return 'Дай карте название';
    const maps = loadSavedMaps().filter((m) => m.name !== name);
    maps.push({
      name,
      music: get().music,
      obstacles: (obstacles || []).map((o: any) => ({
        icon: o.icon, imgKey: o.imgKey || '', x: o.x, y: o.y, w: o.w, h: o.h,
        rot: o.rot || 0, random: !!o.editorRandom,
      })),
      units: (units || []).map((u: any) => ({
        factionKey: (u as any).factionKey || (u as any).name || '',
        side: (u as any).isNeutral ? 'neutral' : (u as any).faction === 'Союзник' ? 'ally' : 'enemy',
        x: u.pos.x, y: u.pos.y, behavior: (u as any).aiRole || 'patrol',
      })),
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

/** Удалить выбранное (объект или юнит). */
export const deleteSelected = (): void => {
  const ed = useMapEditorStore.getState();
  const cs = useCombatGridStore;
  if (ed.selObId !== null) {
    const id = ed.selObId;
    cs.setState((s: any) => ({ obstacles: s.obstacles.filter((o: any) => o.id !== id) }));
    ed.setSel(null, null);
  } else if (ed.selUnitId !== null) {
    const id = ed.selUnitId;
    cs.setState((s: any) => ({ enemies: s.enemies.filter((e: any) => e.id !== id) }));
    ed.setSel(null, null);
  }
};

/** Переключить «случайное место при входе» у выбранного объекта. */
export const toggleSelectedRandom = (): void => {
  const ed = useMapEditorStore.getState();
  if (ed.selObId === null) return;
  const cs = useCombatGridStore;
  cs.setState((s: any) => ({
    obstacles: s.obstacles.map((o: any) => (o.id === ed.selObId ? { ...o, editorRandom: !o.editorRandom } : o)),
  }));
};

const buildObstacle = (icon: string, imgKey: string, w: number, h: number, x: number, y: number, random: boolean) => {
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
    rot: 0, editorRandom: random,
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
    const ob = buildObstacle(ed.tool.icon, ed.tool.imgKey, ed.tool.w, ed.tool.h, rx, ry, ed.randomSpawn);
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
  const findUnit = () => (st.enemies as any[]).find((e: any) => !e.dead && e.pos.x === x && e.pos.y === y);
  if (tool.kind === 'select') {
    if (ed.selObId !== null && ed.selUnitId === null) {
      const ob = (st.obstacles as any[]).find((o: any) => o.id === ed.selObId);
      if (ob) {
        const nx = Math.max(0, Math.min(32 - ob.w, x));
        const ny = Math.max(0, Math.min(32 - ob.h, y));
        const clash = (st.obstacles as any[]).some((o: any) =>
          o.id !== ob.id && rectsOverlap(nx, ny, ob.w, ob.h, o.x, o.y, o.w, o.h));
        if (!clash && !(nx <= 2 && ny <= 2 && 2 < nx + ob.w && 2 < ny + ob.h)) {
          cs.setState((s: any) => ({
            obstacles: s.obstacles.map((o: any) => (o.id === ob.id ? { ...o, x: nx, y: ny } : o)),
          }));
          return;
        }
      }
    }
    if (ed.selUnitId !== null && ed.selObId === null) {
      const u = (st.enemies as any[]).find((e: any) => e.id === ed.selUnitId);
      if (u && !u.dead) {
        cs.setState((s: any) => ({
          enemies: s.enemies.map((e: any) => (e.id === u.id ? { ...e, pos: { x, y } } : e)),
        }));
        return;
      }
    }
    const ob = findOb();
    const u = !ob ? findUnit() : undefined;
    ed.setSel(ob ? (ob as any).id : null, u ? (u as any).id : null);
    return;
  }
  if (tool.kind === 'obstacle') {
    const { nx, ny } = clampFootprint(tool.w, tool.h, x, y);
    if (!footprintValid(st.obstacles, tool.w, tool.h, nx, ny)) {
      usePlayerStore.getState().addLog('🧱 Тут занято', 'warning');
      return;
    }
    const ob = buildObstacle(tool.icon, tool.imgKey, tool.w, tool.h, nx, ny, ed.randomSpawn);
    cs.setState((s: any) => ({ obstacles: [...s.obstacles, ob] }));
    ed.setSel(ob.id, null);
    return;
  }
  const busy = (st.enemies as any[]).some((e: any) => !e.dead && e.pos.x === x && e.pos.y === y);
  if (busy) {
    usePlayerStore.getState().addLog('🧍 Клетка занята', 'warning');
    return;
  }
  try {
    cs.getState().spawnEditorUnit(tool.factionKey, tool.side, x, y, ed.behavior);
  } catch { /* ignore */ }
};
