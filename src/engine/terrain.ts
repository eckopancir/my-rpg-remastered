// Бонусы укрытий на арене 2D: лес даёт уворот внутри, машины/мелочь/заборы —
// броню рядом, здания — блок рядом. Действует и на игрока, и на врагов.

export const BIG_BUILDING_IMAGES = ['o8', 'o9', 'o10', 'o11', 'o12', 'o13', 'o14', 'o16', 'o17', 'o18'];
export const CAR_IMAGES = ['o6', 'o6_2', 'o7', 'o7_2', 'o22', 'o23', 'o24', 'o29', 'o33'];
export const WOOD_IMAGES = ['o3', 'o4', 'o25', 'o26', 'o3z', 'o3z2', 'o30', 'o31', 'o32'];
export const SMALL_OBSTACLE_IMAGES = ['o1', 'o1_2', 'o2', 'o19', 'o20', 'o21', 'o28', 'o32_2', 'penek'];
export const FENCE_IMAGE = 'o5';
export const FIELD_IMAGE = 'green1';

// Точные наборы из дизайна (не весь icon-тип, а конкретные картинки).
const EVADE_INSIDE = new Set(['o3', 'o4', 'o25', 'o26', 'o3z', 'o3z2', 'o30', 'o31', 'o32', 'o3zz']);
const ARMOR_NEAR = new Set(['o24', 'o23', 'o19', 'o7', 'o6', 'o5', 'o2', 'o1', 'o1_2', 'o28', 'o29',
  'o5_2', 'o5_3', 'o5_4', 'o5_5', 'o5_6', 'o5_7', 'o5_8', 'o47', 'o42', 'o43', 'o40', 'o44', 'o45', 'o46', 'o41',
  'trash_pile', 'trash_pile2', 'trash_tank', 'trash_can', 'ice_kiosks', 'bus', 'bus_stop']);
const BLOCK_NEAR = new Set(['o8', 'o9', 'o10', 'o11', 'o12', 'o13', 'o14', 'o15', 'o16', 'o17', 'o18', 'o27', 'o48',
  'etazh5', 'etazh9', 'etazh5_2', 'etazh5_3', 'etazh5_4', 'school_big']);

// Дебаф меткости от укрытий: здания −5%, лес внутри −3%, остальное −4%. Кап суммы −30%.
// Укрытие считается рядом (≤1 кл), лес — только стоя внутри. Действует на всех стрелков симметрично.
export const COVER_PENALTY_BUILDING = 0.05;
export const COVER_PENALTY_WOODS = 0.03;
export const COVER_PENALTY_OTHER = 0.04;
export const COVER_PENALTY_CAP = 0.30;
/** Машины-укрытия вне старого сета (давали 0 — чиним заодно). */
const EXTRA_COVER_CARS = new Set(['o6_2', 'o7_2', 'o22', 'o33']);

export interface CoverInfo {
  penalty: number;
  count: number;
  sources: string[];
}

/** Суммарный дебаф меткости стрелков по цели на клетке (стакается, с капом). */
export const getCoverPenalty = (
  pos: { x: number; y: number },
  obstacles: TerrainObstacle[],
): CoverInfo => {
  const out: CoverInfo = { penalty: 0, count: 0, sources: [] };
  for (const o of obstacles) {
    const key = obstacleImageKey(o);
    if (!key) continue;
    const label = labelOf(o);
    const d = distToRect(pos.x, pos.y, o);
    if (d > 1) continue;
    if (BLOCK_NEAR.has(key)) {
      out.penalty += COVER_PENALTY_BUILDING;
      out.count += 1;
      out.sources.push(`${label}: −5% меткости стрелкам`);
    } else if (EVADE_INSIDE.has(key)) {
      if (d > 0) continue;
      out.penalty += COVER_PENALTY_WOODS;
      out.count += 1;
      out.sources.push(`${label}: −3% меткости стрелкам (внутри)`);
    } else if (ARMOR_NEAR.has(key) || EXTRA_COVER_CARS.has(key)) {
      out.penalty += COVER_PENALTY_OTHER;
      out.count += 1;
      out.sources.push(`${label}: −4% меткости стрелкам`);
    }
  }
  out.penalty = Math.min(COVER_PENALTY_CAP, Math.round(out.penalty * 1000) / 1000);
  return out;
};

export interface TerrainBonus {
  evasion: number;
  armor: number;
  block: number;
  sources: string[];
}

export interface TerrainObstacle {
  x: number;
  y: number;
  w?: number;
  h?: number;
  icon?: string;
  imgIndex?: number;
  isWalkable?: boolean;
}

const ICON_LABELS: Record<string, string> = {
  building: '🏢 Здание',
  car: '🚗 Машина',
  woods: '🌲 Лес',
  small: '📦 Хлам',
  fence: '🧱 Забор',
  prop: '📦 Реквизит',
  light: '💡 Свет',
};

/** Реквизит, сквозь который можно ходить (декор без коллизии). */
export const WALK_THROUGH_PROPS = new Set(['o45', 'o46', 'lamp_post']);

/** Большой забор: реквизит, но пули не пропускает (как o5). */
export const SHOTSTOP_PROPS = new Set(['o5_2', 'o5_3']);

/** Простреливается ли реквизит насквозь. */
export const isShootThrough = (icon?: string, imgKey?: string): boolean =>
  icon === 'prop' && !SHOTSTOP_PROPS.has(imgKey || '');

/** Проходимая мелочь (декор): o20/o21, зимний o20z, площадка и дороги-плашки. */
export const WALKABLE_SMALL = new Set(['o20', 'o21', 'o20z', 'playground', 'ground_road7', 'ground_road6']);

/** Проходимо ли препятствие (можно встать/пройти). */
export const isObstacleWalkable = (icon?: string, imgKey?: string): boolean =>
  icon === 'light' || icon === 'woods' || icon === 'field' ||
  (icon === 'prop' && WALK_THROUGH_PROPS.has(imgKey || '')) ||
  (icon === 'small' && WALKABLE_SMALL.has(imgKey || ''));

/** Блочит ли препятствие движение (лампы и проходимый декор — нет; лес/поле блочат флагом как в генерации, но проходимы). */
export const isObstacleBlocking = (icon?: string, imgKey?: string): boolean => {
  if (icon === 'light') return false;
  if (icon === 'prop' && WALK_THROUGH_PROPS.has(imgKey || '')) return false;
  if (icon === 'small' && WALKABLE_SMALL.has(imgKey || '')) return false;
  return true;
};

/** Лут-метка объекта конструктора (паритет с генерацией): лес — дерево, машины — лут, колодец — вода, ящик o47 — патроны. */
export const searchLootForProp = (icon?: string, imgKey?: string): { kind: string; charges?: number } | null => {
  if (icon === 'woods') return { kind: 'tree' };
  if (icon === 'car') return { kind: 'car' };
  if (icon === 'small' && imgKey === 'o28') return { kind: 'well', charges: 3 };
  if (icon === 'prop' && imgKey === 'o47') return { kind: 'ammo_crate' };
  return null;
};

/** Пулы картинок конструктора (включая арты вне генерации). */
export const EDITOR_POOLS: Record<string, string[]> = {
  building: [...BIG_BUILDING_IMAGES, 'o15', 'o27', 'o48', 'etazh5', 'etazh9', 'etazh5_2', 'etazh5_3', 'etazh5_4', 'school_big'],
  car: CAR_IMAGES,
  woods: [...WOOD_IMAGES, 'o3zz'],
  small: [...SMALL_OBSTACLE_IMAGES, 'o20z', 'playground', 'ground_road7', 'ground_road6'],
  fence: [FENCE_IMAGE],
  field: [FIELD_IMAGE],
  prop: ['o5_2', 'o5_3', 'o5_4', 'o5_5', 'o5_6', 'o5_7', 'o5_8', 'o47', 'o42', 'o43', 'o40', 'o44', 'o45', 'o46', 'o41', 'fonar', 'trash_pile', 'trash_pile2', 'trash_tank', 'trash_can', 'ice_kiosks', 'lamp_post', 'bus', 'bus_stop'],
  light: ['light1', 'light2', 'light3', 'light4', 'light5'],
};

/** Ключ картинки препятствия — та же логика, что в рендере BattleGrid. */
export const obstacleImageKey = (o: TerrainObstacle): string => {
  // Объекты конструктора несут свой ключ (включая арты вне пулов генерации).
  const own = (o as any).imgKey as string | undefined;
  if (own) return own;
  const i = o.imgIndex ?? 0;
  if (o.icon === 'building') return BIG_BUILDING_IMAGES[i] ?? '';
  if (o.icon === 'car') return CAR_IMAGES[i] ?? '';
  if (o.icon === 'woods') return WOOD_IMAGES[i] ?? '';
  if (o.icon === 'small') return SMALL_OBSTACLE_IMAGES[i] ?? '';
  if (o.icon === 'fence') return FENCE_IMAGE;
  return '';
};

const labelOf = (o: TerrainObstacle): string => ICON_LABELS[o.icon || ''] || 'Объект';

/** Чебышевская дистанция от клетки до прямоугольника препятствия. */
export const distToRect = (px: number, py: number, o: TerrainObstacle): number => {
  const w = o.w ?? 1;
  const h = o.h ?? 1;
  const dx = Math.max(o.x - px, 0, px - (o.x + w - 1));
  const dy = Math.max(o.y - py, 0, py - (o.y + h - 1));
  return Math.max(dx, dy);
};

/** Прицепить к статам цели дебаф укрытий (для формулы урона). */
export const applyTerrainToTarget = <T extends { evasion?: number; armor?: number; block?: number }>(
  target: T,
  pos: { x: number; y: number },
  obstacles: TerrainObstacle[],
): T & { coverPenalty: number } => {
  const c = getCoverPenalty(pos, obstacles);
  return { ...target, coverPenalty: c.penalty };
};

/** Короткая строка дебафа точки для попапа инспекции (ПКМ). */
export const terrainSummary = (
  pos: { x: number; y: number },
  obstacles: TerrainObstacle[],
): { text: string; detail: string } => {
  const c = getCoverPenalty(pos, obstacles);
  if (c.penalty <= 0) return { text: '📍 —', detail: `(${pos.x},${pos.y}): укрытий рядом нет` };
  return {
    text: `📍 🎯−${Math.round(c.penalty * 100)}% (${c.count})`,
    detail: `(${pos.x},${pos.y}): ${c.sources.join('; ')}`,
  };
};

/** Можно ли встать на клетку (нет блокирующего препятствия; дырки openCells проходимы). */
export const isCellWalkable = (
  x: number,
  y: number,
  obstacles: Array<TerrainObstacle & { blocks?: boolean }>,
): boolean => {
  for (const o of obstacles) {
    if (!o.blocks || o.isWalkable) continue;
    const w = o.w ?? 1;
    const h = o.h ?? 1;
    if (x >= o.x && x < o.x + w && y >= o.y && y < o.y + h) {
      if (isOpenCell(o as any, x, y)) continue;
      return false;
    }
  }
  return true;
};

/** Дырка (проходимая клетка) внутри футпринта: openCells [{dx,dy}]. */
export const isOpenCell = (o: { x: number; y: number; openCells?: { dx: number; dy: number }[] }, x: number, y: number): boolean => {
  const cells = (o as any)?.openCells;
  if (!Array.isArray(cells) || cells.length === 0) return false;
  return cells.some((c: any) => o.x + (c.dx || 0) === x && o.y + (c.dy || 0) === y);
};

/** Укрытие: клетка-дырка с cover=true — юнит накрывается артом. */
export const isCoverCell = (o: { x: number; y: number; openCells?: { dx: number; dy: number; cover?: boolean }[] }, x: number, y: number): boolean => {
  const cells = (o as any)?.openCells;
  if (!Array.isArray(cells) || cells.length === 0) return false;
  return cells.some((c: any) => c.cover === true && o.x + (c.dx || 0) === x && o.y + (c.dy || 0) === y);
};
export const rotateOpenCells = (cells: { dx: number; dy: number; cover?: boolean }[] | undefined, w: number, h: number): { dx: number; dy: number; cover?: boolean }[] | undefined => {
  if (!Array.isArray(cells) || cells.length === 0) return cells;
  return cells.map((c) => ({ dx: h - 1 - (c.dy || 0), dy: c.dx || 0, ...(c.cover ? { cover: true as const } : null) }));
};
