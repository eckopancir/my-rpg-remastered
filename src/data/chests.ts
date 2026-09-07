import { GAME_ITEMS, GAME_RESOURCES } from './GameItems';
import { generateItem, QUALITY_TIERS } from '../engine/items';
import type { Item } from '../types/items';
import type { GeneratedItem } from '../engine/items';
import chestEpicClosed from '../assets/images/ui/chest-epic-closed.png';
import chestEpicOpen from '../assets/images/ui/chest-epic-open.png';
import chestNormalClosed from '../assets/images/ui/chest-normal-closed.png';
import chestNormalOpen from '../assets/images/ui/chest-normal-open.png';

export type ChestArt = 'normal' | 'epic';

export const CHEST_ART: Record<ChestArt, { closed: string; open: string }> = {
  normal: { closed: chestNormalClosed, open: chestNormalOpen },
  epic: { closed: chestEpicClosed, open: chestEpicOpen },
};

export interface ChestConfig {
  art: ChestArt;
  resTypes: number;
  chipBase: number;
  chipPerLevel: number;
  qtyBase: number;
}

// Чем выше редкость сундука — тем больше видов ресурсов, чипов и пачек.
export const CHEST_CONFIG: Record<string, ChestConfig> = {
  'Обычный': { art: 'normal', resTypes: 3, chipBase: 10, chipPerLevel: 5, qtyBase: 2 },
  'Редкий': { art: 'normal', resTypes: 4, chipBase: 20, chipPerLevel: 7, qtyBase: 2 },
  'Раритетный': { art: 'epic', resTypes: 5, chipBase: 30, chipPerLevel: 10, qtyBase: 3 },
  'Эпический': { art: 'epic', resTypes: 5, chipBase: 30, chipPerLevel: 10, qtyBase: 3 },
  'Смертоносный': { art: 'epic', resTypes: 6, chipBase: 60, chipPerLevel: 15, qtyBase: 4 },
  'Легендарный': { art: 'epic', resTypes: 7, chipBase: 100, chipPerLevel: 20, qtyBase: 5 },
  'Божественный': { art: 'epic', resTypes: 8, chipBase: 150, chipPerLevel: 30, qtyBase: 6 },
};

export const configForQuality = (qualityName: string): ChestConfig =>
  CHEST_CONFIG[qualityName] ?? CHEST_CONFIG['Эпический'];

export const artForQuality = (qualityName: string): ChestArt =>
  configForQuality(qualityName).art;

let chestSeq = 0;

const uniqueChestId = () =>
  `chest_${Date.now()}_${chestSeq++}_${Math.random().toString(36).slice(2, 8)}`;

/** Сундук фиксирует уровень в момент дропа — лут всегда уровня сундука, не игрока. */
export const createChest = (qualityName: string, level: number): Item => {
  const cfg = configForQuality(qualityName);
  const tier = QUALITY_TIERS.find((t) => t.name === qualityName);
  const lvl = Math.max(1, Math.floor(level));
  return {
    id: uniqueChestId(),
    name: `Сундук · ${qualityName}`,
    displayName: `Сундук · ${qualityName} (ур. ${lvl})`,
    type: 'chest',
    slot: 'chest',
    rarity: qualityName,
    quality: qualityName,
    qualityColor: tier?.color ?? 'white',
    level: lvl,
    stats: {},
    image: cfg.art === 'epic' ? chestEpicClosed : chestNormalClosed,
    description: `Двойной клик — открыть. Предметы внутри ${lvl} уровня.`,
    chestQuality: qualityName,
    chestLevel: lvl,
  } as Item;
};

export const getChestQuality = (chest: Item): string =>
  (chest as unknown as Record<string, unknown>).chestQuality as string ?? chest.quality ?? 'Эпический';

export const getChestLevel = (chest: Item): number => {
  const v = (chest as unknown as Record<string, unknown>).chestLevel;
  return Math.max(1, Math.floor((typeof v === 'number' ? v : chest.level) ?? 1));
};

export type ChestDrop =
  | { key: string; kind: 'item'; item: GeneratedItem }
  | { key: string; kind: 'resource'; def: (typeof GAME_RESOURCES)[number]; quantity: number }
  | { key: string; kind: 'chips'; amount: number };

let dropSeq = 0;
const dropKey = () => `drop_${Date.now()}_${dropSeq++}`;

/** Ролл лута сундука: 1 предмет 100% качества сундука + ресурсы + чипы. */
export const rollChestLoot = (chest: Item): ChestDrop[] => {
  const quality = getChestQuality(chest);
  const level = getChestLevel(chest);
  const cfg = configForQuality(quality);
  const drops: ChestDrop[] = [];

  // 1 предмет гарантированного качества, уровня сундука.
  const item = generateItem(GAME_ITEMS, level, null, quality);
  drops.push({ key: dropKey(), kind: 'item', item });

  // N разных ресурсов, пачка растёт с уровнем сундука.
  const pool = [...GAME_RESOURCES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const resCount = Math.min(cfg.resTypes, pool.length);
  for (let i = 0; i < resCount; i++) {
    const quantity = cfg.qtyBase + Math.floor(level / 2) + Math.floor(Math.random() * 3);
    drops.push({ key: dropKey(), kind: 'resource', def: pool[i], quantity });
  }

  // Чипы.
  drops.push({ key: dropKey(), kind: 'chips', amount: cfg.chipBase + level * cfg.chipPerLevel });

  return drops;
};

/** Превратить дроп-ресурс в предмет инвентаря. */
export const makeResourceItem = (def: (typeof GAME_RESOURCES)[number], quantity: number): Item => ({
  id: `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  name: def.name,
  displayName: def.name,
  type: 'material',
  slot: 'any',
  rarity: def.rarity,
  quality: 'Обычный',
  qualityColor: 'white',
  level: 1,
  stats: {},
  image: def.image,
  quantity,
} as Item);
