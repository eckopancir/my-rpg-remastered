import { generateItem, type ItemDefinition } from './items';
import { GAME_RESOURCES } from '../data/GameItems';

export interface LootOptions {
  bonusQuality?: number;
  extraItemChance?: number;
  extraResourcePct?: number;
  doubleLootChance?: number;
}

export const generateLoot = (
  itemPool: ItemDefinition[],
  enemyLevel: number,
  options?: LootOptions,
): Array<{
  id: string;
  name: string;
  displayName: string;
  rarity: string;
  slot: string;
  stats: Record<string, number>;
  quality: string;
  qualityColor: string;
  level: number;
  type?: string;
  quantity?: number;
}> => {
  const {
    bonusQuality = 0.5,
    extraItemChance = 0,
    extraResourcePct = 0,
    doubleLootChance = 0,
  } = options ?? {};

  const items: Array<any> = [];
  let count = Math.floor(Math.random() * 3) + 1;
  if (Math.random() < extraItemChance) count += 1;
  if (Math.random() < extraItemChance && Math.random() < doubleLootChance) count += 1;

  for (let i = 0; i < count; i++) {
    const drop = generateItem(itemPool, enemyLevel);
    if (drop) items.push(drop);
  }

  // Resource drops
  let resourceCount = Math.floor(Math.random() * 3) + 1;
  resourceCount += Math.floor(resourceCount * extraResourcePct);
  for (let i = 0; i < resourceCount; i++) {
    const def = GAME_RESOURCES[Math.floor(Math.random() * GAME_RESOURCES.length)];
    let quantity = Math.floor(Math.random() * 5) + 1;
    quantity += Math.floor(quantity * extraResourcePct);
    const existing = items.find((it) => it.name === def.name && it.type === 'material');
    if (existing) {
      existing.quantity = (existing.quantity || 1) + quantity;
    } else {
      items.push({
        id: `res_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: def.name,
        displayName: def.name,
        rarity: def.rarity,
        slot: def.slot,
        stats: {},
        quality: 'Обычный',
        qualityColor: '#a0a0a0',
        level: 1,
        type: 'material',
        quantity,
        image: def.image,
      });
    }
  }

  return items;
};

export const generateResources = (
  level: number,
  count: number = 3,
): Array<{
  id: string;
  name: string;
  displayName: string;
  rarity: string;
  slot: string;
  stats: Record<string, number>;
  quality: string;
  qualityColor: string;
  level: number;
  type: string;
  quantity: number;
}> => {
  const items: Array<any> = [];
  for (let i = 0; i < count; i++) {
    const def = GAME_RESOURCES[Math.floor(Math.random() * GAME_RESOURCES.length)];
    const quantity = Math.floor(Math.random() * 3) + 1;
    const existing = items.find((it) => it.name === def.name);
    if (existing) {
      existing.quantity += quantity;
    } else {
      items.push({
        id: `res_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: def.name,
        displayName: def.name,
        rarity: def.rarity,
        slot: 'any',
        stats: {},
        quality: 'Обычный',
        qualityColor: '#a0a0a0',
        level: 1,
        type: 'material',
        quantity,
        image: def.image,
      });
    }
  }
  return items;
};
