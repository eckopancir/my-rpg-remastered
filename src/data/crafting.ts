export type MaterialType = 'scrap' | 'wires' | 'chip' | 'reagent' | 'alloy' | 'powder';

export const MATERIAL_NAMES: Record<MaterialType, string> = {
  scrap: 'Металлолом',
  wires: 'Провода',
  chip: 'Микросхема',
  reagent: 'Хим. реагент',
  alloy: 'Редкий сплав',
  powder: 'Порох',
};

export const QUALITY_ORDER = [
  'Обычный', 'Редкий', 'Раритетный', 'Эпический',
  'Смертоносный', 'Легендарный', 'Божественный',
];

export const SLOT_STAT_POOL: Record<string, string[]> = {
  weapon1: ['damage', 'crit', 'speed', 'block', 'punching', 'vampir'],
  weapon2: ['damage', 'crit', 'speed', 'accuracy', 'punching', 'vampir'],
  head: ['armor', 'evasion', 'regen', 'maxHp', 'accuracy'],
  armor: ['armor', 'evasion', 'regen', 'maxHp', 'block'],
  pants: ['armor', 'evasion', 'regen', 'maxHp', 'speed'],
  gloves: ['damage', 'crit', 'speed', 'block', 'armor'],
  boots: ['speed', 'evasion', 'armor', 'block', 'regen'],
};

export const SLOT_LABELS: Record<string, string> = {
  weapon1: 'Холодное оружие',
  weapon2: 'Огнестрел',
  head: 'Шлем',
  armor: 'Броня',
  pants: 'Штаны',
  gloves: 'Перчатки',
  boots: 'Ботинки',
};

export const SLOT_ICONS: Record<string, string> = {
  weapon1: '⚔️',
  weapon2: '🔫',
  head: '⛑️',
  armor: '🛡️',
  pants: '👖',
  gloves: '🧤',
  boots: '👢',
};

export interface CraftCost {
  scrap: number;
  wires: number;
  chip: number;
  reagent: number;
  alloy: number;
  powder: number;
}

/** Категория предмета для крафта/разбора: броня / оружие / мод. */
export type CraftCategory = 'armor' | 'weapon' | 'mod';

export const craftCategoryOf = (item: { slot?: string; type?: string }): CraftCategory => {
  const slot = (item as any).slot || '';
  if ((item as any).type === 'mod' || slot.startsWith('mod_')) return 'mod';
  if (slot === 'weapon1' || slot === 'weapon2' || slot.startsWith('gun_')) return 'weapon';
  return 'armor';
};

const GEAR_COST: Record<CraftCategory, Record<string, CraftCost>> = {
  // Броня: металлолом, провода, реагент, сплав.
  armor: {
    'Обычный': { scrap: 5, wires: 3, chip: 0, reagent: 0, alloy: 0, powder: 0 },
    'Редкий': { scrap: 8, wires: 5, chip: 0, reagent: 0, alloy: 0, powder: 0 },
    'Раритетный': { scrap: 12, wires: 8, chip: 0, reagent: 2, alloy: 0, powder: 0 },
    'Эпический': { scrap: 20, wires: 12, chip: 0, reagent: 4, alloy: 2, powder: 0 },
    'Смертоносный': { scrap: 30, wires: 18, chip: 0, reagent: 6, alloy: 4, powder: 0 },
    'Легендарный': { scrap: 45, wires: 25, chip: 0, reagent: 10, alloy: 6, powder: 0 },
    'Божественный': { scrap: 60, wires: 35, chip: 0, reagent: 15, alloy: 10, powder: 0 },
  },
  // Оружие: металлолом, сплав, порох, микросхемы.
  weapon: {
    'Обычный': { scrap: 5, wires: 0, chip: 0, reagent: 0, alloy: 0, powder: 3 },
    'Редкий': { scrap: 8, wires: 0, chip: 2, reagent: 0, alloy: 0, powder: 5 },
    'Раритетный': { scrap: 12, wires: 0, chip: 4, reagent: 0, alloy: 0, powder: 8 },
    'Эпический': { scrap: 20, wires: 0, chip: 6, reagent: 0, alloy: 2, powder: 12 },
    'Смертоносный': { scrap: 30, wires: 0, chip: 10, reagent: 0, alloy: 4, powder: 18 },
    'Легендарный': { scrap: 45, wires: 0, chip: 15, reagent: 0, alloy: 6, powder: 25 },
    'Божественный': { scrap: 60, wires: 0, chip: 20, reagent: 0, alloy: 10, powder: 35 },
  },
  // Модификации: металлолом, микросхемы, провода (UI создания модов — следующий шаг).
  mod: {
    'Обычный': { scrap: 2, wires: 3, chip: 1, reagent: 0, alloy: 0, powder: 0 },
    'Редкий': { scrap: 3, wires: 5, chip: 2, reagent: 0, alloy: 0, powder: 0 },
    'Раритетный': { scrap: 4, wires: 8, chip: 4, reagent: 0, alloy: 0, powder: 0 },
    'Эпический': { scrap: 6, wires: 12, chip: 6, reagent: 0, alloy: 1, powder: 0 },
    'Смертоносный': { scrap: 8, wires: 18, chip: 10, reagent: 0, alloy: 2, powder: 0 },
    'Легендарный': { scrap: 10, wires: 25, chip: 15, reagent: 0, alloy: 3, powder: 0 },
    'Божественный': { scrap: 12, wires: 35, chip: 20, reagent: 0, alloy: 4, powder: 0 },
  },
};

/** Цена создания по слоту и качеству (категория из слота). */
export const craftCostFor = (slot: string, quality: string): CraftCost =>
  GEAR_COST[craftCategoryOf({ slot })][quality] || GEAR_COST.armor['Обычный'];

// Совместимость: старая плоская таблица (броня).
export const CRAFT_COST: Record<string, CraftCost> = GEAR_COST.armor;

export const STAT_COUNT: Record<string, number> = {
  'Обычный': 1,
  'Редкий': 2,
  'Раритетный': 3,
  'Эпический': 4,
  'Смертоносный': 5,
  'Легендарный': 6,
  'Божественный': 8,
};

/** Выход разбора по категории предмета (плоские диапазоны, от качества не зависят). */
export type DisassembleCategory = 'armor' | 'weapon' | 'mod' | 'bullet' | 'energyCell';

export const disassembleCategoryOf = (item: { slot?: string; type?: string; ammoGroup?: string }): DisassembleCategory => {
  if ((item as any).type === 'bullet') {
    return (item as any).ammoGroup === 'energy' ? 'energyCell' : 'bullet';
  }
  const slot = (item as any).slot || '';
  if ((item as any).type === 'mod' || slot.startsWith('mod_')) return 'mod';
  if (slot === 'weapon1' || slot === 'weapon2' || slot.startsWith('gun_')) return 'weapon';
  return 'armor';
};

const DISASSEMBLE_TABLE: Record<DisassembleCategory, Partial<Record<MaterialType, [number, number]>>> = {
  // Броня: лом, сплав, реагент, иногда провода.
  armor: { scrap: [3, 5], alloy: [2, 3], reagent: [1, 2], wires: [0, 1] },
  // Оружие: лом, сплав, порох, иногда микросхема.
  weapon: { scrap: [3, 5], alloy: [2, 3], powder: [1, 2], chip: [0, 1] },
  // Модификации: микросхемы, провода, немного лома.
  mod: { chip: [3, 5], wires: [3, 5], scrap: [1, 2] },
  // Патроны: лом + 5 пороха, схем не бывает.
  bullet: { scrap: [2, 3], powder: [5, 5] },
  // Энергоячейки: лом + 2 реагента.
  energyCell: { scrap: [1, 2], reagent: [2, 2] },
};

/** Старая таблица по качеству — фолбэк для прочего (рюкзаки и т.п.). */
export const DISASSEMBLE_YIELD: Record<string, Partial<Record<MaterialType, [number, number]>>> = {
  'Обычный': { scrap: [2, 4], wires: [1, 2], powder: [1, 2] },
  'Редкий': { scrap: [3, 5], wires: [2, 3], chip: [1, 1], powder: [1, 2] },
  'Раритетный': { scrap: [4, 6], wires: [2, 4], chip: [1, 2], reagent: [1, 1], powder: [2, 3] },
  'Эпический': { scrap: [5, 8], wires: [3, 5], chip: [2, 3], reagent: [1, 2], alloy: [1, 1], powder: [2, 4] },
  'Смертоносный': { scrap: [6, 10], wires: [4, 6], chip: [3, 4], reagent: [2, 3], alloy: [1, 2], powder: [3, 4] },
  'Легендарный': { scrap: [8, 12], wires: [5, 7], chip: [4, 5], reagent: [3, 4], alloy: [2, 3], powder: [3, 5] },
  'Божественный': { scrap: [10, 15], wires: [6, 8], chip: [5, 6], reagent: [4, 5], alloy: [3, 4], powder: [4, 6] },
};

/** Рецепты патронов: цена полного стака обычной пачки. Энергоячейки — без пороха. */
export const AMMO_CRAFT_COST: Record<string, { powder: number; scrap: number; reagent?: number }> = {
  pistol: { powder: 5, scrap: 3 },
  rifle: { powder: 10, scrap: 3 },
  sniper: { powder: 8, scrap: 3 },
  shell: { powder: 8, scrap: 3 },
  mg: { powder: 20, scrap: 3 },
  energy: { powder: 0, scrap: 3, reagent: 2 },
};

export const BLUEPRINT_DROP_CHANCE: Record<string, number> = {
  'Обычный': 15,
  'Редкий': 25,
  'Раритетный': 35,
  'Эпический': 45,
  'Смертоносный': 55,
  'Легендарный': 65,
  'Божественный': 75,
};

export const BLUEPRINT_DROP: Record<string, Record<string, number>> = {
  'Обычный': { 'Обычный': 30 },
  'Редкий': { 'Обычный': 40, 'Редкий': 15 },
  'Раритетный': { 'Обычный': 30, 'Редкий': 25, 'Раритетный': 10 },
  'Эпический': { 'Обычный': 20, 'Редкий': 30, 'Раритетный': 20, 'Эпический': 5 },
  'Смертоносный': { 'Обычный': 15, 'Редкий': 25, 'Раритетный': 25, 'Эпический': 15, 'Смертоносный': 5 },
  'Легендарный': { 'Обычный': 10, 'Редкий': 20, 'Раритетный': 25, 'Эпический': 20, 'Смертоносный': 10, 'Легендарный': 5 },
  'Божественный': { 'Обычный': 5, 'Редкий': 15, 'Раритетный': 20, 'Эпический': 25, 'Смертоносный': 15, 'Легендарный': 10, 'Божественный': 5 },
};

export const QUALITY_COLORS: Record<string, string> = {
  'Обычный': '#a0a0a0',
  'Редкий': '#4ade80',
  'Раритетный': '#60a5fa',
  'Эпический': '#a855f7',
  'Смертоносный': '#ef4444',
  'Легендарный': '#fbbf24',
  'Божественный': '#22d3ee',
};

export function getNextQuality(quality: string): string | null {
  const idx = QUALITY_ORDER.indexOf(quality);
  if (idx === -1 || idx >= QUALITY_ORDER.length - 1) return null;
  return QUALITY_ORDER[idx + 1];
}

export function rollBlueprint(quality: string): string | null {
  const dropChance = BLUEPRINT_DROP_CHANCE[quality];
  if (!dropChance || Math.random() * 100 > dropChance) return null;
  const table = BLUEPRINT_DROP[quality];
  if (!table) return null;
  const entries = Object.entries(table);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  let r = Math.random() * total;
  for (const [q, chance] of entries) {
    r -= chance;
    if (r <= 0) return q;
  }
  return null;
}

export function rollYield(quality: string, item?: { slot?: string; type?: string; ammoGroup?: string }): Record<string, number> {
  // Категорийная таблица (броня/оружие/моды/патроны/ячейки), масштабируется редкостью:
  // Обычный ×1, далее +50% за ранг (Божественный ×4).
  // Прочее (рюкзаки и т.п.) — старая шкала по качеству.
  const table = item ? DISASSEMBLE_TABLE[disassembleCategoryOf(item)] : undefined;
  const src = table || DISASSEMBLE_YIELD[quality];
  if (!src) return {};
  const mult = table ? 1 + 0.5 * Math.max(0, QUALITY_ORDER.indexOf(quality)) : 1;
  const result: Record<string, number> = {};
  for (const [mat, [min, max]] of Object.entries(src)) {
    const lo = Math.round(min * mult);
    const hi = Math.round(max * mult);
    result[mat] = lo >= hi ? lo : lo + Math.floor(Math.random() * (hi - lo + 1));
  }
  return result;
}
