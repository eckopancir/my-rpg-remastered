// Бонусы укрытий на арене 2D: лес даёт уворот внутри, машины/мелочь/заборы —
// броню рядом, здания — блок рядом. Действует и на игрока, и на врагов.

export const BIG_BUILDING_IMAGES = ['o8', 'o10', 'o11', 'o12', 'o13', 'o14', 'o15', 'o16', 'o17', 'o18', 'o27'];
export const CAR_IMAGES = ['o6', 'o7', 'o22', 'o23', 'o24'];
export const WOOD_IMAGES = ['o3', 'o4', 'o25', 'o26'];
export const SMALL_OBSTACLE_IMAGES = ['o1', 'o2', 'o19', 'o20', 'o21'];
export const FENCE_IMAGE = 'o5';

// Точные наборы из дизайна (не весь icon-тип, а конкретные картинки).
const EVADE_INSIDE = new Set(['o3', 'o4', 'o25', 'o26']);
const ARMOR_NEAR = new Set(['o24', 'o23', 'o19', 'o7', 'o6', 'o5', 'o2', 'o1']);
const BLOCK_NEAR = new Set(['o8', 'o10', 'o11', 'o12', 'o13', 'o14', 'o15', 'o16', 'o17', 'o18']);

export const EVASION_WOODS_BONUS = 0.05;
export const ARMOR_NEAR_BONUS = 0.05;
export const BLOCK_NEAR_BONUS = 0.05;

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
};

/** Ключ картинки препятствия — та же логика, что в рендере BattleGrid. */
export const obstacleImageKey = (o: TerrainObstacle): string => {
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
const distToRect = (px: number, py: number, o: TerrainObstacle): number => {
  const w = o.w ?? 1;
  const h = o.h ?? 1;
  const dx = Math.max(o.x - px, 0, px - (o.x + w - 1));
  const dy = Math.max(o.y - py, 0, py - (o.y + h - 1));
  return Math.max(dx, dy);
};

/** Суммарные бонусы точки с учётом всех укрытий рядом (стакаются). */
export const getTerrainBonus = (
  pos: { x: number; y: number },
  obstacles: TerrainObstacle[],
): TerrainBonus => {
  const out: TerrainBonus = { evasion: 0, armor: 0, block: 0, sources: [] };
  for (const o of obstacles) {
    const key = obstacleImageKey(o);
    if (!key) continue;
    const label = labelOf(o);
    if (EVADE_INSIDE.has(key) && distToRect(pos.x, pos.y, o) <= 0) {
      out.evasion += EVASION_WOODS_BONUS;
      out.sources.push(`${label}: +5% к уклонению (внутри)`);
    }
    if (distToRect(pos.x, pos.y, o) <= 1) {
      if (ARMOR_NEAR.has(key)) {
        out.armor += ARMOR_NEAR_BONUS;
        out.sources.push(`${label}: +5% к броне (рядом)`);
      }
      if (BLOCK_NEAR.has(key)) {
        out.block += BLOCK_NEAR_BONUS;
        out.sources.push(`${label}: +5% к блоку (рядом)`);
      }
    }
  }
  // Округление против накопления float-мусора.
  out.evasion = Math.round(out.evasion * 1000) / 1000;
  out.armor = Math.round(out.armor * 1000) / 1000;
  out.block = Math.round(out.block * 1000) / 1000;
  return out;
};

/** Применить бонусы точки к защитным статам цели (для формулы урона). */
export const applyTerrainToTarget = <T extends { evasion?: number; armor?: number; block?: number }>(
  target: T,
  pos: { x: number; y: number },
  obstacles: TerrainObstacle[],
): T => {
  const b = getTerrainBonus(pos, obstacles);
  if (b.evasion === 0 && b.armor === 0 && b.block === 0) return target;
  return {
    ...target,
    evasion: (target.evasion || 0) + b.evasion,
    armor: (target.armor || 0) + b.armor,
    block: (target.block || 0) + b.block,
  };
};

/** Короткая строка бонусов точки для попапа инспекции (ПКМ). */
export const terrainSummary = (
  pos: { x: number; y: number },
  obstacles: TerrainObstacle[],
): { text: string; detail: string } => {
  const b = getTerrainBonus(pos, obstacles);
  const parts: string[] = [];
  if (b.evasion > 0) parts.push(`🌀+${Math.round(b.evasion * 100)}%`);
  if (b.armor > 0) parts.push(`🛡️+${Math.round(b.armor * 100)}%`);
  if (b.block > 0) parts.push(`🧱+${Math.round(b.block * 100)}%`);
  if (parts.length === 0) return { text: '📍 —', detail: `(${pos.x},${pos.y}): укрытий рядом нет` };
  return {
    text: `📍 ${parts.join(' ')}`,
    detail: `(${pos.x},${pos.y}): ${b.sources.join('; ')}`,
  };
};

/** Можно ли встать на клетку (нет блокирующего препятствия). */
export const isCellWalkable = (
  x: number,
  y: number,
  obstacles: Array<TerrainObstacle & { blocks?: boolean }>,
): boolean => {
  for (const o of obstacles) {
    if (!o.blocks || o.isWalkable) continue;
    const w = o.w ?? 1;
    const h = o.h ?? 1;
    if (x >= o.x && x < o.x + w && y >= o.y && y < o.y + h) return false;
  }
  return true;
};
