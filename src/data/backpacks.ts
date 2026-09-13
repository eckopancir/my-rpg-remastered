import type { Item } from '../types/items';
import { maxStackFor, isBulletOfGroup, AMMO_GROUP_MAP, type AmmoGroup } from './ammo';

// Каталог рюкзаков: 11 семейств × 5 градаций = 55 штук.
// Слоты = baseSlots + индекс качества предмета (Обычный 0 … Божественный 6).
// Редкость влияет ТОЛЬКО на слоты. Картинки — pack_*.png по семейству (getBackpackImage).
export interface BackpackDef {
  name: string;
  family: string;
  baseSlots: number;
  price: number;
}

const FAMILIES: { family: string; baseSlots: number; names: [string, string, string, string, string]; prices: [number, number, number, number, number] }[] = [
  {
    family: 'Походный', baseSlots: 4,
    names: ['Походный рюкзак', 'Походный рюкзак М', 'Походный рюкзак МК-2', 'Походный элитный', 'Походный прототип'],
    prices: [300, 525, 825, 1275, 1950],
  },
  {
    family: 'Полевой', baseSlots: 5,
    names: ['Полевой ранец', 'Полевой ранец М', 'Полевой ранец МК-2', 'Полевой элитный', 'Полевой прототип'],
    prices: [420, 675, 1050, 1575, 2400],
  },
  {
    family: 'Рейдовый', baseSlots: 6,
    names: ['Рейдовый рюкзак', 'Рейдовый рюкзак М', 'Рейдовый рюкзак МК-2', 'Рейдовый элитный', 'Рейдовый прототип'],
    prices: [570, 900, 1350, 2025, 3000],
  },
  {
    family: 'Сталкерский', baseSlots: 7,
    names: ['Сталкерский рюкзак', 'Сталкерский рюкзак М', 'Сталкерский рюкзак МК-2', 'Сталкерский элитный', 'Сталкерский прототип'],
    prices: [750, 1125, 1650, 2475, 3600],
  },
  {
    family: 'Штурмовой', baseSlots: 8,
    names: ['Штурмовой рюкзак', 'Штурмовой рюкзак М', 'Штурмовой рюкзак МК-2', 'Штурмовой элитный', 'Штурмовой прототип'],
    prices: [975, 1425, 2100, 3075, 4500],
  },
  {
    family: 'Десантный', baseSlots: 9,
    names: ['Десантный рюкзак', 'Десантный рюкзак М', 'Десантный рюкзак МК-2', 'Десантный элитный', 'Десантный прототип'],
    prices: [1150, 1700, 2450, 3550, 5150],
  },
  {
    family: 'Тактический военный', baseSlots: 10,
    names: ['Тактический военный', 'Тактический военный М', 'Тактический военный МК-2', 'Тактический элитный', 'Тактический прототип'],
    prices: [1350, 1950, 2850, 4050, 5850],
  },
  {
    family: 'Армейский', baseSlots: 12,
    names: ['Армейский рюкзак', 'Армейский рюкзак М', 'Армейский рюкзак МК-2', 'Армейский элитный', 'Армейский прототип'],
    prices: [1800, 2600, 3700, 5300, 7600],
  },
  {
    family: 'Экспедиционный', baseSlots: 14,
    names: ['Экспедиционный рюкзак', 'Экспедиционный рюкзак М', 'Экспедиционный рюкзак МК-2', 'Экспедиционный элитный', 'Экспедиционный прототип'],
    prices: [2300, 3300, 4700, 6700, 9600],
  },
  {
    family: 'Ветеранский', baseSlots: 16,
    names: ['Ветеранский рюкзак', 'Ветеранский рюкзак М', 'Ветеранский рюкзак МК-2', 'Ветеранский элитный', 'Ветеранский прототип'],
    prices: [5200, 7500, 11000, 16000, 23000],
  },
  {
    family: 'Экзо', baseSlots: 20,
    names: ['Экзо рюкзак', 'Экзо рюкзак М', 'Экзо рюкзак МК-2', 'Экзо элитный', 'Экзо прототип'],
    prices: [9000, 13000, 19000, 27000, 39000],
  },
];

export const BACKPACK_DEFS: BackpackDef[] = FAMILIES.flatMap((f) =>
  f.names.map((name, i) => ({ name, family: f.family, baseSlots: f.baseSlots, price: f.prices[i] })),
);

const QUALITY_SLOT_BONUS: Record<string, number> = {
  'Обычный': 0, 'Редкий': 1, 'Раритетный': 2, 'Эпический': 3,
  'Смертоносный': 4, 'Легендарный': 5, 'Божественный': 6,
};

/** Итоговые слоты рюкзака с учётом качества. */
export const backpackSlots = (def: BackpackDef, qualityName?: string): number =>
  def.baseSlots + (QUALITY_SLOT_BONUS[qualityName ?? 'Обычный'] ?? 0);

/** Слоты надетого рюкзака; неизвестный — 4 как у походного. */
export const backpackSlotsFor = (item: { name?: string; quality?: string } | null | undefined): number => {
  if (!item) return 0;
  const def = backpackDefByName(item.name || '');
  if (!def) return 4;
  return backpackSlots(def, item.quality);
};

export interface InsertResult {
  contents: Item[];
  /** Что-то переехало (целиком или частично). */
  moved: boolean;
  /** Остаток количества, не влезший (для патронов). 0 — влезло всё. */
  leftoverQty: number;
}

/**
 * Положить предмет в содержимое рюкзака.
 * Патроны добивают неполные стаки (до 30) и занимают новые ячейки;
 * расходники досыпаются в стак той же способности (слота не требуют);
 * остальное — по 1 ячейке. Чистая функция.
 */
export const tryInsertInto = (contents: Item[], slots: number, item: Item): InsertResult => {
  const next = contents.map((c) => ({ ...c }));
  if (item.type === 'bullet') {
    const cap = maxStackFor(((item as any).ammoGroup as AmmoGroup) || 'rifle');
    const bq = (item as any).quality || 'Обычный';
    const bgroup = ((item as any).ammoGroup as AmmoGroup) || 'rifle';
    let qty = (item.quantity ?? 1) as number;
    for (const c of next) {
      if (qty <= 0) break;
      if (isBulletOfGroup(c as any, bgroup) && ((c as any).quality || 'Обычный') === bq && ((c.quantity ?? 1) as number) < cap) {
        const room = cap - ((c.quantity ?? 1) as number);
        const mv = Math.min(room, qty);
        c.quantity = ((c.quantity ?? 1) as number) + mv;
        qty -= mv;
        // Ленивая миграция старых имён («Пачка ...») на новые.
        const newName = AMMO_GROUP_MAP[bgroup].packName;
        c.name = newName;
        c.displayName = bq === 'Обычный' ? `${newName} x${c.quantity}` : `${newName} x${c.quantity} · ${bq}`;
      }
    }
    while (qty > 0) {
      if (next.length >= slots) break;
      const mv = Math.min(cap, qty);
      next.push({ ...item, id: `${item.id}_p${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, quantity: mv });
      qty -= mv;
    }
    return { contents: next, moved: qty < ((item.quantity ?? 1) as number), leftoverQty: qty };
  }
  // Расходники: досыпать в стак той же способности (как патроны) — слот не нужен.
  if (item.type === 'consumable') {
    const origQty = ((item.quantity ?? 1) as number);
    let qty = origQty;
    const aid = (item as any).abilityId;
    for (const c of next) {
      if (qty <= 0) break;
      if (c.type === 'consumable' && c.name === item.name && (c as any).abilityId === aid) {
        const nq = ((c.quantity ?? 1) as number) + qty;
        c.quantity = nq;
        c.displayName = `${c.name} x${nq}`;
        qty = 0;
      }
    }
    if (qty > 0) {
      if (next.length >= slots) return { contents: next, moved: qty < origQty, leftoverQty: qty };
      next.push({ ...item, quantity: qty, displayName: qty > 1 ? `${item.name} x${qty}` : item.name });
      qty = 0;
    }
    return { contents: next, moved: true, leftoverQty: 0 };
  }
  if (next.length >= slots) return { contents: next, moved: false, leftoverQty: (item.quantity ?? 1) as number };
  next.push(item);
  return { contents: next, moved: true, leftoverQty: 0 };
};

/** Старые имена медранцев (были «Медицинский*») → новые «Полевой*» (сейвы до переименования). */
const BACKPACK_NAME_ALIASES: Record<string, string> = {
  'Медицинский ранец': 'Полевой ранец',
  'Медицинский ранец М': 'Полевой ранец М',
  'Медицинский ранец МК-2': 'Полевой ранец МК-2',
  'Медицинский элитный': 'Полевой элитный',
  'Медицинский прототип': 'Полевой прототип',
};

export const backpackDefByName = (name: string): BackpackDef | undefined =>
  BACKPACK_DEFS.find((d) => d.name === (BACKPACK_NAME_ALIASES[name] ?? name));

let backpackSeq = 0;

/** Предмет-рюкзак в инвентарь (слот/экипировка — следующим этапом). */
export const makeBackpack = (name: string, quality = 'Обычный', qualityColor = 'white', level = 1): Item => {
  const def = backpackDefByName(name);
  if (!def) throw new Error(`unknown backpack: ${name}`);
  const slots = backpackSlots(def, quality);
  return {
    id: `pack_${Date.now()}_${backpackSeq++}_${Math.random().toString(36).slice(2, 6)}`,
    name: def.name,
    displayName: `${def.name} · ${slots} сл.`,
    type: 'backpack',
    slot: 'backpack',
    rarity: 'normal',
    quality,
    qualityColor,
    level,
    stats: {},
    description: `Рюкзак ${def.family.toLowerCase()}: ${slots} слотов (${def.baseSlots} база + качество). Двойной клик в экипировке — открыть.`,
    price: def.price,
  } as Item;
};

// ─── 2D Grid (Tetris-style) ──────────────────────────────────────────

const GRID_W = 5;

export const isBigItem = (item: Item): boolean => {
  const s = (item.slot || '') as string;
  return s === 'weapon1' || s === 'weapon2' || s.startsWith('gun_')
    || s === 'head' || s === 'armor' || s === 'pants' || s === 'gloves' || s === 'boots';
};

export interface BackpackGrid {
  w: number;
  h: number;
  cells: (string | null)[][];
  items: Item[];
}

/** Создать пустую сетку на N слотов (5 колонок, rows = ceil(slots/5)). */
export const createGrid = (slots: number): BackpackGrid => {
  const w = GRID_W;
  const h = Math.max(1, Math.ceil(slots / w));
  const cells: (string | null)[][] = Array.from({ length: h }, () => Array(w).fill(null));
  return { w, h, cells, items: [] };
};

/** Проверить, свободны ли ячейки (x..x+w-1, y..y+h-1). */
export const canPlaceAt = (grid: BackpackGrid, x: number, y: number, w: number, h: number): boolean => {
  if (x < 0 || y < 0 || x + w > grid.w || y + h > grid.h) return false;
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      if (grid.cells[y + dy][x + dx] !== null) return false;
    }
  }
  return true;
};

/** Найти первую свободную позицию для предмета w×h ( scan top-left ). */
export const findFreeSlot = (grid: BackpackGrid, w: number, h: number): { x: number; y: number } | null => {
  for (let y = 0; y <= grid.h - h; y++) {
    for (let x = 0; x <= grid.w - w; x++) {
      if (canPlaceAt(grid, x, y, w, h)) return { x, y };
    }
  }
  return null;
};

/** Положить предмет в сетку на позицию. Предмет должен влезать. */
export const placeItemAt = (grid: BackpackGrid, item: Item, x: number, y: number): BackpackGrid => {
  const w = item.gridW ?? 1;
  const h = item.gridH ?? 1;
  const cells = grid.cells.map((row) => [...row]);
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      cells[y + dy][x + dx] = item.id;
    }
  }
  const placed = { ...item, gridX: x, gridY: y, gridW: w, gridH: h };
  return { ...grid, cells, items: [...grid.items, placed] };
};

/** Убрать предмет из сетки по id. */
export const removeItemFromGrid = (grid: BackpackGrid, itemId: string): BackpackGrid => {
  const cells = grid.cells.map((row) => [...row]);
  for (let y = 0; y < grid.h; y++) {
    for (let x = 0; x < grid.w; x++) {
      if (cells[y][x] === itemId) cells[y][x] = null;
    }
  }
  return { ...grid, cells, items: grid.items.filter((i) => i.id !== itemId) };
};

/** Попробовать положить предмет в сетку (auto-place). Патроны/расходники стакаются. */
export const tryInsertIntoGrid = (grid: BackpackGrid, item: Item): { grid: BackpackGrid; moved: boolean; leftoverQty: number } => {
  // Буллеты: стак в существующий неполный стак
  if (item.type === 'bullet') {
    const cap = maxStackFor(((item as any).ammoGroup as AmmoGroup) || 'rifle');
    const bq = (item as any).quality || 'Обычный';
    const bgroup = ((item as any).ammoGroup as AmmoGroup) || 'rifle';
    let qty = (item.quantity ?? 1) as number;
    const cells = grid.cells.map((row) => [...row]);
    const items = grid.items.map((i) => ({ ...i }));
    for (const it of items) {
      if (qty <= 0) break;
      if (isBulletOfGroup(it as any, bgroup) && ((it as any).quality || 'Обычный') === bq && ((it.quantity ?? 1) as number) < cap) {
        const room = cap - ((it.quantity ?? 1) as number);
        const mv = Math.min(room, qty);
        it.quantity = ((it.quantity ?? 1) as number) + mv;
        qty -= mv;
        const newName = AMMO_GROUP_MAP[bgroup].packName;
        it.name = newName;
        it.displayName = bq === 'Обычный' ? `${newName} x${it.quantity}` : `${newName} x${it.quantity} · ${bq}`;
      }
    }
    while (qty > 0) {
      const slot = findFreeSlot({ ...grid, cells, items }, 1, 1);
      if (!slot) break;
      const mv = Math.min(cap, qty);
      const id = `${item.id}_p${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const bulletItem = { ...item, id, quantity: mv, gridX: slot.x, gridY: slot.y, gridW: 1, gridH: 1 };
      cells[slot.y][slot.x] = id;
      items.push(bulletItem);
      qty -= mv;
    }
    return { grid: { ...grid, cells, items }, moved: qty < ((item.quantity ?? 1) as number), leftoverQty: qty };
  }
  // Расходники: стак в существующий
  if (item.type === 'consumable') {
    const items = grid.items.map((i) => ({ ...i }));
    const aid = (item as any).abilityId;
    let qty = (item.quantity ?? 1) as number;
    for (const it of items) {
      if (qty <= 0) break;
      if (it.type === 'consumable' && it.name === item.name && (it as any).abilityId === aid) {
        it.quantity = ((it.quantity ?? 1) as number) + qty;
        it.displayName = `${it.name} x${it.quantity}`;
        qty = 0;
      }
    }
    if (qty > 0) {
      const slot = findFreeSlot(grid, 1, 1);
      if (!slot) return { grid, moved: qty < (item.quantity ?? 1), leftoverQty: qty };
      const cells = grid.cells.map((row) => [...row]);
      const id = `${item.id}_p${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const consItem = { ...item, id, quantity: qty, displayName: qty > 1 ? `${item.name} x${qty}` : item.name, gridX: slot.x, gridY: slot.y, gridW: 1, gridH: 1 };
      cells[slot.y][slot.x] = id;
      items.push(consItem);
      return { grid: { ...grid, cells, items }, moved: true, leftoverQty: 0 };
    }
    return { grid: { ...grid, items }, moved: true, leftoverQty: 0 };
  }
  // Обычные предметы: 1×1 или 2×2
  const w = isBigItem(item) ? 2 : 1;
  const h = isBigItem(item) ? 2 : 1;
  const slot = findFreeSlot(grid, w, h);
  if (!slot) return { grid, moved: false, leftoverQty: (item.quantity ?? 1) as number };
  const placed = placeItemAt(grid, { ...item, gridW: w, gridH: h }, slot.x, slot.y);
  return { grid: placed, moved: true, leftoverQty: 0 };
};
