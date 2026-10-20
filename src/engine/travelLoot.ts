import { GAME_ITEMS, GAME_RESOURCES } from '../data/GameItems';
import { generateItem, type GeneratedItem } from './items';
import { AMMO_GROUPS, makeBulletPack, type AmmoGroup } from '../data/ammo';
import { CONSUMABLE_DEFS, makeConsumable } from '../data/consumables';
import type { Item } from '../types/items';

/**
 * Профиль награды, который сервер кладёт в reward_data.
 * Сервер решает характер дропа — клиент только материализует предмет.
 */
export interface TravelRewardProfile {
  /** gear — снаряжение, resource — ресурсы/патроны/расходники. */
  pool: 'gear' | 'resource';
  /** Для resource: что именно падает. */
  kind?: 'material' | 'ammo' | 'consumable';
  /** Для gear: слот (weapon1/head/mod_* и т.п.). null — выбираем сами. */
  slot?: string | null;
  /** Для gear: потолок редкости (normal/epic/superepic). */
  rarity?: string | null;
  /** Для gear: потолок качества (потолок бонусных статов). */
  qualityCap?: string | null;
  /** Уровень предмета. */
  itemLevel?: number;
  /** Количество единиц в одной находке. */
  qty?: number;
}

/** Потолок качества для обычных находок в путешествии. */
export const TRAVEL_QUALITY_CAP = 'Раритетный';

const GEAR_SLOTS = [
  'weapon1', 'weapon2',
  'head', 'armor', 'pants', 'gloves', 'boots',
  'mod_blade', 'mod_handle', 'mod_scope', 'mod_barrel', 'mod_muzzle',
  'mod_receiver', 'mod_stock', 'mod_harness', 'mod_pommel',
  'mod_lining', 'mod_hardshell', 'mod_utility', 'mod_patch',
];

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** Материал (лом, вода, железо…) как предмет рюкзака. */
const makeMaterial = (name: string, qty: number): Item => {
  const def = GAME_RESOURCES.find((r) => r.name === name);
  return {
    id: `mat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: def?.name ?? name,
    // Количество не вписываем в подпись — его добавляет сетка рюкзака
    // (иначе в UI получается «Вода x2 ×2»).
    displayName: def?.name ?? name,
    type: 'material',
    slot: 'any',
    rarity: 'common',
    quality: 'Обычный',
    qualityColor: 'white',
    level: 1,
    stats: {},
    image: def?.image,
    quantity: qty,
  } as unknown as Item;
};

/**
 * Материализовать награду по профилю сервера.
 * resource → материал / патроны / расходник; gear → снаряжение с потолками.
 */
export const generateTravelReward = (
  profile: TravelRewardProfile | null | undefined,
  fallbackLevel: number,
): Item[] => {
  const level = Math.max(1, profile?.itemLevel ?? fallbackLevel ?? 1);

  if (!profile || profile.pool === 'gear') {
    const slot = profile?.slot ?? pick(GEAR_SLOTS);
    const rarity = profile?.rarity ?? 'normal';
    const cap = profile?.qualityCap ?? TRAVEL_QUALITY_CAP;
    const slotItems = GAME_ITEMS.filter((i) => i.slot === slot);
    const rarityItems = slotItems.filter((i) => i.rarity === rarity);
    // В слоте может не быть предметов нужной редкости — берём самый
    // частый редкостный вариант слота, чтобы не выпадать в «нож».
    const dominant = (() => {
      const counts: Record<string, number> = {};
      for (const i of slotItems) counts[i.rarity] = (counts[i.rarity] || 0) + 1;
      return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'normal';
    })();
    const item = rarityItems.length > 0
      ? generateItem(rarityItems, level, rarity as any, null, undefined, cap)
      : generateItem(slotItems, level, dominant as any, null, undefined, cap);
    return [item as unknown as Item];
  }

  const qty = Math.max(1, profile.qty ?? 1);
  const kind = profile.kind ?? 'material';
  if (kind === 'ammo') {
    const group = pick(AMMO_GROUPS).key as AmmoGroup;
    return [makeBulletPack(group, qty)];
  }
  if (kind === 'consumable') {
    const def = pick(CONSUMABLE_DEFS);
    return [makeConsumable(def.abilityId, qty)];
  }
  const mat = pick(GAME_RESOURCES);
  return [makeMaterial(mat.name, qty)];
};

/** Показать предмет в логе события (уже сгенерированный). */
export const asGenerated = (item: Item): GeneratedItem => item as unknown as GeneratedItem;
