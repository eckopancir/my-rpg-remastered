import { generateItem, getItemQuality, QUALITY_TIERS, type ItemDefinition } from './items';
import { GAME_RESOURCES } from '../data/GameItems';
import { AMMO_GROUPS, makeBulletPack } from '../data/ammo';
import { CONSUMABLE_DEFS, makeConsumable } from '../data/consumables';
import { BACKPACK_DEFS, makeBackpack } from '../data/backpacks';

export type CorpseRank = 'mob' | 'officer' | 'boss';

export interface LootOptions {
  bonusQuality?: number;
  extraItemChance?: number;
  extraResourcePct?: number;
  doubleLootChance?: number;
  /** Ранговый лут с трупа на арене: скупой по рангу. Без rank — старое поведение. */
  rank?: CorpseRank;
}

// Рюкзак трупа — 10 ячеек: приоритет содержимого (предмет, рюкзак,
// расходник, патроны, ресурсы), лишнее не спавнится.
export const CORPSE_SLOTS = 10;

const RANK_TABLE: Record<CorpseRank, { itemChance: number; resTypes: number; resMin: number; resMax: number; bestOf: number; bulletChance: number; bulletPacks: number; bulletMin: number; bulletMax: number; consChance: number; consMax: number; packChance: number }> = {
  mob: { itemChance: 0.15, resTypes: 1, resMin: 1, resMax: 3, bestOf: 1, bulletChance: 0.2, bulletPacks: 1, bulletMin: 8, bulletMax: 12, consChance: 0.05, consMax: 1, packChance: 0 },
  officer: { itemChance: 0.3, resTypes: 2, resMin: 1, resMax: 3, bestOf: 1, bulletChance: 0.4, bulletPacks: 2, bulletMin: 8, bulletMax: 15, consChance: 0.12, consMax: 2, packChance: 0 },
  boss: { itemChance: 1, resTypes: 3, resMin: 2, resMax: 4, bestOf: 2, bulletChance: 1, bulletPacks: 2, bulletMin: 15, bulletMax: 30, consChance: 0.3, consMax: 2, packChance: 0.2 },
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
    // Босс: жирный гарант — 2-4 вещи, 1-2 ресурса, 1-2 расходника, 1 пачка, 1% рюкзак.
    if (options.rank === 'boss') {
      const eqN = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < eqN; i++) {
        const drop = generateItem(itemPool, enemyLevel);
        if (drop) items.push(drop);
      }
      const pool = [...GAME_RESOURCES];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const resN = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < Math.min(resN, pool.length); i++) {
        const def = pool[i];
        const quantity = 2 + Math.floor(Math.random() * 3);
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
      const consN = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < consN; i++) {
        const d = CONSUMABLE_DEFS[Math.floor(Math.random() * CONSUMABLE_DEFS.length)];
        items.push(makeConsumable(d.abilityId, 1));
      }
      const g = AMMO_GROUPS[Math.floor(Math.random() * AMMO_GROUPS.length)];
      items.push(makeBulletPack(g.key, 15 + Math.floor(Math.random() * 16)));
      if (Math.random() < 0.01) {
        const d = BACKPACK_DEFS[Math.floor(Math.random() * BACKPACK_DEFS.length)];
        const q = getItemQuality();
        items.push(makeBackpack(d.name, q.name, q.color, enemyLevel));
      }
      const prio = (it: any): number => {
        if (it.type === 'backpack') return 1;
        if (it.type === 'consumable') return 2;
        if (it.type === 'bullet') return 3;
        if (it.type === 'material') return 4;
        return 0;
      };
      items.sort((a, b) => prio(a) - prio(b));
      return items.slice(0, CORPSE_SLOTS);
    }
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
    // Патроны с трупов — пачки случайной группы.
    if (Math.random() < t.bulletChance) {
      for (let i = 0; i < t.bulletPacks; i++) {
        const g = AMMO_GROUPS[Math.floor(Math.random() * AMMO_GROUPS.length)];
        const qty = t.bulletMin + Math.floor(Math.random() * (t.bulletMax - t.bulletMin + 1));
        items.push(makeBulletPack(g.key, qty));
      }
    }
    // Расходники с трупов.
    for (let i = 0; i < t.consMax; i++) {
      if (Math.random() >= t.consChance) continue;
      const d = CONSUMABLE_DEFS[Math.floor(Math.random() * CONSUMABLE_DEFS.length)];
      items.push(makeConsumable(d.abilityId, 1));
    }
    // Рюкзак с босса (качество — пирамидой).
    if (t.packChance > 0 && Math.random() < t.packChance) {
      const d = BACKPACK_DEFS[Math.floor(Math.random() * BACKPACK_DEFS.length)];
      const q = getItemQuality();
      items.push(makeBackpack(d.name, q.name, q.color, enemyLevel));
    }
    // Рюкзак трупа — 6 ячеек: приоритет (предмет, рюкзак, расходник, патроны, ресурсы).
    const prio = (it: any): number => {
      if (it.type === 'backpack') return 1;
      if (it.type === 'consumable') return 2;
      if (it.type === 'bullet') return 3;
      if (it.type === 'material') return 4;
      return 0;
    };
    items.sort((a, b) => prio(a) - prio(b));
    return items.slice(0, CORPSE_SLOTS);
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
