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
  setActive: (v: boolean) => void;
  setTool: (t: EditorTool) => void;
  setBehavior: (b: string) => void;
  setRandomSpawn: (v: boolean) => void;
  setMusic: (m: string) => void;
  setMapName: (n: string) => void;
  setSel: (obId: number | string | null, unitId: number | string | null) => void;
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
  setActive: (active) => set({ active, selObId: null, selUnitId: null, tool: { kind: 'select' } }),
  setTool: (tool) => set({ tool, selObId: null, selUnitId: null }),
  setBehavior: (behavior) => set({ behavior }),
  setRandomSpawn: (randomSpawn) => set({ randomSpawn }),
  setMusic: (music) => set({ music }),
  setMapName: (mapName) => set({ mapName }),
  setSel: (selObId, selUnitId) => set({ selObId, selUnitId }),
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
    const nx = Math.max(0, Math.min(32 - tool.w, x));
    const ny = Math.max(0, Math.min(32 - tool.h, y));
    if (nx <= 2 && ny <= 2 && 2 < nx + tool.w && 2 < ny + tool.h) return;
    const clash = (st.obstacles as any[]).some((o: any) => rectsOverlap(nx, ny, tool.w, tool.h, o.x, o.y, o.w, o.h));
    if (clash) {
      usePlayerStore.getState().addLog('🧱 Тут занято', 'warning');
      return;
    }
    const pools: Record<string, string[]> = {
      building: BIG_BUILDING_IMAGES,
      car: CAR_IMAGES,
      woods: WOOD_IMAGES,
      small: SMALL_OBSTACLE_IMAGES,
      fence: [FENCE_IMAGE],
      field: [FIELD_IMAGE],
    };
    const imgIdx = Math.max(0, (pools[tool.icon] || []).indexOf(tool.imgKey));
    const oid = `edob_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    cs.setState((s: any) => ({
      obstacles: [...s.obstacles, {
        id: oid, x: nx, y: ny, w: tool.w, h: tool.h,
        type: tool.icon === 'woods' ? 'woods' : tool.icon === 'field' ? 'field' : tool.icon === 'fence' ? 'fence' : tool.icon === 'car' ? 'car' : 'small',
        blocks: true, icon: tool.icon, imgKey: tool.imgKey,
        isWalkable: tool.icon === 'woods' || tool.icon === 'field',
        isHigh: tool.icon === 'building' || tool.icon === 'fence',
        imgIndex: imgIdx, rot: 0, editorRandom: ed.randomSpawn,
      }],
    }));
    ed.setSel(oid, null);
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
