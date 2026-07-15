export type MaterialType = 'scrap' | 'wires' | 'chip' | 'reagent' | 'alloy';

export const MATERIAL_NAMES: Record<MaterialType, string> = {
  scrap: 'Металлолом',
  wires: 'Провода',
  chip: 'Микросхема',
  reagent: 'Хим. реагент',
  alloy: 'Редкий сплав',
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
  gloves: ['damage', 'crit', 'speed', 'block', 'armor'],
  boots: ['speed', 'evasion', 'armor', 'block', 'regen'],
};

export const SLOT_LABELS: Record<string, string> = {
  weapon1: 'Холодное оружие',
  weapon2: 'Огнестрел',
  head: 'Шлем',
  armor: 'Броня',
  gloves: 'Перчатки',
  boots: 'Ботинки',
};

export const SLOT_ICONS: Record<string, string> = {
  weapon1: '⚔️',
  weapon2: '🔫',
  head: '⛑️',
  armor: '🛡️',
  gloves: '🧤',
  boots: '👢',
};

export interface CraftCost {
  scrap: number;
  wires: number;
  chip: number;
  reagent: number;
  alloy: number;
}

export const CRAFT_COST: Record<string, CraftCost> = {
  'Обычный': { scrap: 5, wires: 3, chip: 0, reagent: 0, alloy: 0 },
  'Редкий': { scrap: 8, wires: 5, chip: 2, reagent: 0, alloy: 0 },
  'Раритетный': { scrap: 12, wires: 8, chip: 4, reagent: 2, alloy: 0 },
  'Эпический': { scrap: 20, wires: 12, chip: 6, reagent: 4, alloy: 2 },
  'Смертоносный': { scrap: 30, wires: 18, chip: 10, reagent: 6, alloy: 4 },
  'Легендарный': { scrap: 45, wires: 25, chip: 15, reagent: 10, alloy: 6 },
  'Божественный': { scrap: 60, wires: 35, chip: 20, reagent: 15, alloy: 10 },
};

export const STAT_COUNT: Record<string, number> = {
  'Обычный': 1,
  'Редкий': 2,
  'Раритетный': 3,
  'Эпический': 4,
  'Смертоносный': 5,
  'Легендарный': 6,
  'Божественный': 8,
};

export const DISASSEMBLE_YIELD: Record<string, Partial<Record<MaterialType, [number, number]>>> = {
  'Обычный': { scrap: [2, 4], wires: [1, 2] },
  'Редкий': { scrap: [3, 5], wires: [2, 3], chip: [1, 1] },
  'Раритетный': { scrap: [4, 6], wires: [2, 4], chip: [1, 2], reagent: [1, 1] },
  'Эпический': { scrap: [5, 8], wires: [3, 5], chip: [2, 3], reagent: [1, 2], alloy: [1, 1] },
  'Смертоносный': { scrap: [6, 10], wires: [4, 6], chip: [3, 4], reagent: [2, 3], alloy: [1, 2] },
  'Легендарный': { scrap: [8, 12], wires: [5, 7], chip: [4, 5], reagent: [3, 4], alloy: [2, 3] },
  'Божественный': { scrap: [10, 15], wires: [6, 8], chip: [5, 6], reagent: [4, 5], alloy: [3, 4] },
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

export function rollYield(quality: string): Record<string, number> {
  const table = DISASSEMBLE_YIELD[quality];
  if (!table) return {};
  const result: Record<string, number> = {};
  for (const [mat, [min, max]] of Object.entries(table)) {
    result[mat] = Math.floor(Math.random() * (max - min + 1)) + min;
  }
  return result;
}
