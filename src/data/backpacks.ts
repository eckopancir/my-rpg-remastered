import type { Item } from '../types/items';
import { maxStackFor, type AmmoGroup } from './ammo';

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
    let qty = (item.quantity ?? 1) as number;
    for (const c of next) {
      if (qty <= 0) break;
      if (c.type === 'bullet' && c.name === item.name && ((c as any).quality || 'Обычный') === bq && ((c.quantity ?? 1) as number) < cap) {
        const room = cap - ((c.quantity ?? 1) as number);
        const mv = Math.min(room, qty);
        c.quantity = ((c.quantity ?? 1) as number) + mv;
        qty -= mv;
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
