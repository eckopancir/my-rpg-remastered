import type { Item } from '../types/items';
import { BULLET_STACK } from './ammo';

// Каталог рюкзаков: 6 семейств × 5 градаций = 30 штук.
// Слоты = baseSlots + индекс качества предмета (Обычный 0 … Божественный 6).
// Редкость влияет ТОЛЬКО на слоты. Картинок пока нет — эмодзи-заглушка.
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
    prices: [200, 350, 550, 850, 1300],
  },
  {
    family: 'Медицинский', baseSlots: 5,
    names: ['Медицинский ранец', 'Медицинский ранец М', 'Медицинский ранец МК-2', 'Медицинский элитный', 'Медицинский прототип'],
    prices: [280, 450, 700, 1050, 1600],
  },
  {
    family: 'Рейдовый', baseSlots: 6,
    names: ['Рейдовый рюкзак', 'Рейдовый рюкзак М', 'Рейдовый рюкзак МК-2', 'Рейдовый элитный', 'Рейдовый прототип'],
    prices: [380, 600, 900, 1350, 2000],
  },
  {
    family: 'Сталкерский', baseSlots: 7,
    names: ['Сталкерский рюкзак', 'Сталкерский рюкзак М', 'Сталкерский рюкзак МК-2', 'Сталкерский элитный', 'Сталкерский прототип'],
    prices: [500, 750, 1100, 1650, 2400],
  },
  {
    family: 'Штурмовой', baseSlots: 8,
    names: ['Штурмовой рюкзак', 'Штурмовой рюкзак М', 'Штурмовой рюкзак МК-2', 'Штурмовой элитный', 'Штурмовой прототип'],
    prices: [650, 950, 1400, 2050, 3000],
  },
  {
    family: 'Тактический военный', baseSlots: 10,
    names: ['Тактический военный', 'Тактический военный М', 'Тактический военный МК-2', 'Тактический элитный', 'Тактический прототип'],
    prices: [900, 1300, 1900, 2700, 3900],
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
 * остальное — по 1 ячейке. Чистая функция.
 */
export const tryInsertInto = (contents: Item[], slots: number, item: Item): InsertResult => {
  const next = contents.map((c) => ({ ...c }));
  if (item.type === 'bullet') {
    let qty = (item.quantity ?? 1) as number;
    for (const c of next) {
      if (qty <= 0) break;
      if (c.type === 'bullet' && c.name === item.name && ((c.quantity ?? 1) as number) < BULLET_STACK) {
        const room = BULLET_STACK - ((c.quantity ?? 1) as number);
        const mv = Math.min(room, qty);
        c.quantity = ((c.quantity ?? 1) as number) + mv;
        qty -= mv;
      }
    }
    while (qty > 0) {
      if (next.length >= slots) break;
      const mv = Math.min(BULLET_STACK, qty);
      next.push({ ...item, id: `${item.id}_p${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, quantity: mv });
      qty -= mv;
    }
    return { contents: next, moved: qty < ((item.quantity ?? 1) as number), leftoverQty: qty };
  }
  if (next.length >= slots) return { contents: next, moved: false, leftoverQty: (item.quantity ?? 1) as number };
  next.push(item);
  return { contents: next, moved: true, leftoverQty: 0 };
};

export const backpackDefByName = (name: string): BackpackDef | undefined =>
  BACKPACK_DEFS.find((d) => d.name === name);

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
