import { generateItem, QUALITY_TIERS, type ItemDefinition } from './items';
import { GAME_RESOURCES } from '../data/GameItems';

export type CorpseRank = 'mob' | 'officer' | 'boss';

export interface LootOptions {
  bonusQuality?: number;
  extraItemChance?: number;
  extraResourcePct?: number;
  doubleLootChance?: number;
  /** Ранговый лут с трупа на арене: скупой по рангу. Без rank — старое поведение. */
  rank?: CorpseRank;
}

const RANK_TABLE: Record<CorpseRank, { itemChance: number; resTypes: number; resMin: number; resMax: number; bestOf: number }> = {
  mob: { itemChance: 0.15, resTypes: 1, resMin: 1, resMax: 3, bestOf: 1 },
  officer: { itemChance: 0.3, resTypes: 2, resMin: 1, resMax: 3, bestOf: 1 },
  boss: { itemChance: 1, resTypes: 3, resMin: 2, resMax: 4, bestOf: 2 },
};

const tierIndex = (qualityName: string): number => {
  const i = QUALITY_TIERS.findIndex((t) => t.name === qualityName);
  return i === -1 ? 0 : i;
};

/** Ранг врага по ключу фракции: boss / medic+sniper=офицеры / остальные=мобы. */
export const rankOfEnemy = (factionKey?: string, name?: string): CorpseRank => {
  const s = `${factionKey || ''} ${name || ''}`.toLowerCase();
  if (s.includes('boss')) return 'boss';
  if (s.includes('medic') || s.includes('sniper')) return 'officer';
  return 'mob';
};

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

  // Ранговый режим: скупой лут по рангу трупа.
  if (options?.rank) {
    const t = RANK_TABLE[options.rank];
    if (Math.random() < t.itemChance) {
      let best: any = null;
      for (let i = 0; i < t.bestOf; i++) {
        const drop = generateItem(itemPool, enemyLevel);
        if (drop && (!best || tierIndex(drop.quality) > tierIndex(best.quality))) best = drop;
      }
      if (best) items.push(best);
    }
    const pool = [...GAME_RESOURCES];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    for (let i = 0; i < Math.min(t.resTypes, pool.length); i++) {
      const def = pool[i];
      const quantity = t.resMin + Math.floor(Math.random() * (t.resMax - t.resMin + 1));
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
    return items;
  }

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
