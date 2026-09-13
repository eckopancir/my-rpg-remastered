export type ItemSlot =
  | 'weapon'
  | 'offhand'
  | 'helmet'
  | 'chest'
  | 'gloves'
  | 'boots'
  | 'ring'
  | 'amulet'
  | 'backpack';

export type ItemType = 'weapon' | 'armor' | 'accessory' | 'consumable' | 'mod' | 'material' | 'blueprint' | 'chest' | 'backpack' | 'bullet';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface ItemStat {
  base: number;
  modBonus: number;
}

export interface ItemStats {
  [key: string]: ItemStat;
}

export interface Item {
  id: string;
  name: string;
  displayName?: string;
  type?: ItemType;
  slot: ItemSlot | 'any' | string | null;
  rarity: string;
  blueprintRarity?: string;
  level: number;
  icon?: string;
  quality?: string;
  qualityColor?: string;
  image?: string;
  stats: Record<string, number>;
  description?: string;
  price?: number;
  mods?: Record<string, Item>;
  stackable?: boolean;
  quantity?: number;
  damage?: string;
  timeLimit?: number;
  set?: string;
  abilityId?: string;
  ammoCapacity?: number;
  ammoGroup?: string;
  // Магазин огнестрела: сколько патронов заряжено (игра помнит всегда).
  loadedAmmo?: number;
  // Качество патронов в магазине (Обычный по умолчанию).
  loadedAmmoQuality?: string;
  // Разбивка патронов в магазине по качествам: { quality: count }.
  loadedAmmoBreakdown?: Record<string, number>;
  // Уникальная броня: плашка «УНИК», может нести штраф скорости и перки.
  unique?: boolean;
  // Перековка: гнёзда под сферы (максимум) и вставленные сферы.
  socketSlots?: number;
  sockets?: { stat: string; pct: number }[];
  // База статов 1 ур. для подъёма уровня перековкой.
  baseStats?: Record<string, number>;
  // Сфера: какой стат усиливает.
  blueprintStat?: string;
  // Перековка: предмет лежит в слоте ('weapon' — большой, 'bp' — малый).
  inReforge?: string;
}


