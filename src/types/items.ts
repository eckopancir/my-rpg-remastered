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

export type ItemType = 'weapon' | 'armor' | 'accessory' | 'consumable' | 'mod' | 'material' | 'blueprint';

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
}


