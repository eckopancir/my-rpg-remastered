import { ALL_ABILITIES } from '../data/accessoryAbilities';

export type RarityKey = 'normal' | 'epic' | 'superepic';

export const RARITY_CHANCES: Record<string, number> = {
  normal: 33,
  epic: 33,
  superepic: 34,
};

export interface QualityTier {
  name: string;
  chance: number;
  bonusStatsCount: number;
  color: string;
  timeLimitMultiplier: number;
}

export const QUALITY_TIERS: QualityTier[] = [
  { name: 'Обычный', chance: 45, bonusStatsCount: 0, color: 'white', timeLimitMultiplier: 1 },
  { name: 'Редкий', chance: 20, bonusStatsCount: 1, color: 'lime', timeLimitMultiplier: 2 },
  { name: 'Раритетный', chance: 15, bonusStatsCount: 2, color: 'deepskyblue', timeLimitMultiplier: 3 },
  { name: 'Эпический', chance: 10, bonusStatsCount: 3, color: 'mediumpurple', timeLimitMultiplier: 4 },
  { name: 'Смертоносный', chance: 6, bonusStatsCount: 5, color: 'red', timeLimitMultiplier: 5 },
  { name: 'Легендарный', chance: 3, bonusStatsCount: 7, color: 'gold', timeLimitMultiplier: 6 },
  { name: 'Божественный', chance: 1, bonusStatsCount: 10, color: 'cyan', timeLimitMultiplier: 7 },
];

export const QUALITY_BONUSES: Record<string, Record<string, number>> = {
  weapon1: { crit: 0.005, vampir: 0.005, punching: 0.005, accuracy: 0.005, damage: 2 },
  weapon2: {
    crit: 0.005, vampir: 0.005, punching: 0.005, accuracy: 0.005,
    dpsExtro: 2, dpsFire: 2, dpsEmi: 2, dpsToxis: 2, damage: 3,
  },
  head: { regen: 2, block: 0.005, evasion: 0.004, armor: 2, health: 250 },
  armor: { regen: 2, block: 0.005, evasion: 0.004, armor: 2, health: 250 },
  gloves: { regen: 2, block: 0.005, evasion: 0.004, armor: 2, health: 250 },
  boots: { regen: 2, block: 0.005, evasion: 0.004, armor: 2, health: 250 },
  ammo: { regen: 0.01, block: 0.003, evasion: 0.002, armor: 0.5, health: 20, damage: 0.5 },
  mod: {
    regen: 0.005, block: 0.005, evasion: 0.004, armor: 2, health: 250, damage: 2,
    crit: 0.005, vampir: 0.005, punching: 0.005, accuracy: 0.005,
    dpsExtro: 1, dpsFire: 1, dpsEmi: 1, dpsToxis: 1,
    ammoCapacity: 5,
  },
};

export interface ItemDefinition {
  name: string;
  rarity: string;
  slot: string;
  stats: Record<string, number>;
  image?: string;
  icon?: string;
  type?: string;
  timeLimit?: number;
  damage?: string;
  mods?: Record<string, unknown>;
  set?: string;
  armorType?: string;
  abilityId?: string;
  ammoCapacity?: number;
}

export interface GeneratedItem {
  id: string;
  name: string;
  displayName: string;
  rarity: string;
  slot: string;
  stats: Record<string, number>;
  image?: string;
  icon?: string;
  type?: string;
  timeLimit?: number;
  quality: string;
  qualityColor: string;
  level: number;
  damage?: string;
  mods?: Record<string, unknown>;
  set?: string;
  armorType?: string;
  abilityId?: string;
  ammoCapacity?: number;
}

const assignRandomAbility = (item: GeneratedItem) => {
  if (item.abilityId) return;
  const slot = item.slot || '';
  if (slot === 'ammo') {
    const abilityIds = ALL_ABILITIES.map((a) => a.id);
    item.abilityId = abilityIds[Math.floor(Math.random() * abilityIds.length)];
  }
};

const selectByChance = (chances: Record<string, number>): string => {
  const total = Object.values(chances).reduce((sum, chance) => sum + chance, 0);
  let randomValue = Math.random() * total;
  for (const key in chances) {
    randomValue -= chances[key];
    if (randomValue <= 0) return key;
  }
  return Object.keys(chances)[0];
};

export const getItemQuality = (): QualityTier => {
  const totalChance = QUALITY_TIERS.reduce((sum, tier) => sum + tier.chance, 0);
  let randomValue = Math.random() * totalChance;
  for (const tier of QUALITY_TIERS) {
    randomValue -= tier.chance;
    if (randomValue <= 0) return tier;
  }
  return QUALITY_TIERS[0];
};

let _idCounter = 0;

const uniqueId = () => String(Date.now()) + '_' + (++_idCounter) + '_' + Math.random().toString(36).slice(2, 8);

// Дробные статы (шансы/множители) уровнем НЕ масштабируются — иначе
// точность 0.1 превращается в 1.0+ и всё ломается. Только плоские.
const NO_LEVEL_SCALE = new Set([
  'accuracy', 'crit', 'evasion', 'block', 'vampir', 'speed', 'punching',
]);

export const generateItem = (
  items: ItemDefinition[],
  playerLevel: number,
  guaranteedRarity: RarityKey | null = null,
  guaranteedQualityName: string | null = null,
  slotFilter?: string,
): GeneratedItem => {
  let selectedRarity: string;
  if (guaranteedRarity) {
    selectedRarity = guaranteedRarity;
  } else {
    selectedRarity = selectByChance(RARITY_CHANCES);
  }

  let filteredItems: ItemDefinition[];
  if (slotFilter) {
    filteredItems = items.filter((item) => item.slot === slotFilter);
  } else {
    filteredItems = items.filter((item) => item.rarity === selectedRarity);
  }
  if (filteredItems.length === 0) {
    const fallbackItem = items.find((i) => i.name === 'Нож') || items[0];
    let qualityTier: QualityTier | undefined;
    if (guaranteedQualityName) qualityTier = QUALITY_TIERS.find((t) => t.name === guaranteedQualityName);
    const fallback: GeneratedItem = {
      ...fallbackItem,
      id: uniqueId(),
      displayName: fallbackItem.name,
      quality: qualityTier?.name || 'Обычный',
      qualityColor: qualityTier?.color || 'white',
      level: playerLevel,
      slot: slotFilter || fallbackItem.slot,
    };
    assignRandomAbility(fallback);
    return fallback;
  }

  const randomIndex = Math.floor(Math.random() * filteredItems.length);
  const baseItem = filteredItems[randomIndex];

  const generatedItem: GeneratedItem = {
    ...baseItem,
    id: uniqueId(),
    level: playerLevel,
    quality: 'Обычный',
    qualityColor: 'white',
    displayName: baseItem.name,
  };
  assignRandomAbility(generatedItem);

  let qualityTier: QualityTier | undefined;
  if (guaranteedQualityName) {
    qualityTier = QUALITY_TIERS.find((t) => t.name === guaranteedQualityName);
  }
  if (!qualityTier) {
    qualityTier = getItemQuality();
  }

  generatedItem.quality = qualityTier.name;
  generatedItem.qualityColor = qualityTier.color;

  // Apply quality bonus stats (before early returns, so timeLimit/over items also get them)
  let finalStats = { ...generatedItem.stats };
  let slotKey: string;
  if (generatedItem.slot.startsWith('mod_')) {
    slotKey = 'mod';
  } else if (generatedItem.slot.startsWith('ammo')) {
    slotKey = 'ammo';
  } else {
    slotKey = generatedItem.slot;
  }
  const bonusSource = QUALITY_BONUSES[slotKey] || {};
  let bonusKeys: string[];
  let procMultiplier: number;

  if (generatedItem.slot.startsWith('mod_')) {
    const baseStatKeys = Object.keys(generatedItem.stats).filter((k) => (generatedItem.stats[k] || 0) > 0);
    bonusKeys = baseStatKeys.length > 0 ? baseStatKeys : Object.keys(bonusSource);
    procMultiplier = 0.3;
  } else if (generatedItem.slot.startsWith('ammo')) {
    const baseStatKeys = Object.keys(generatedItem.stats).filter((k) => (generatedItem.stats[k] || 0) > 0);
    bonusKeys = baseStatKeys.length > 0
      ? baseStatKeys.filter((k) => k in bonusSource)
      : Object.keys(bonusSource);
    procMultiplier = 1;
  } else {
    bonusKeys = Object.keys(bonusSource);
    procMultiplier = 1;
  }

  for (let i = 0; i < qualityTier.bonusStatsCount; i++) {
    if (bonusKeys.length === 0) break;
    const randomStatKey = bonusKeys[Math.floor(Math.random() * bonusKeys.length)];
    const baseBonusValue = generatedItem.slot.startsWith('mod_')
      ? (generatedItem.stats[randomStatKey] || 0)
      : (bonusSource[randomStatKey] || 0);
    // Дробные бонусы не скейлятся уровнем.
    const levelMultiplier = NO_LEVEL_SCALE.has(randomStatKey) ? 1 : 1 + (playerLevel - 1) * 0.1;
    const totalBonus = baseBonusValue * procMultiplier * levelMultiplier;
    finalStats[randomStatKey] = (finalStats[randomStatKey] || 0) + totalBonus;
  }

  if (selectedRarity === 'over') {
    generatedItem.stats = finalStats;
    return {
      ...generatedItem,
      id: uniqueId(),
      displayName: baseItem.name,
    };
  }

  generatedItem.displayName = `${qualityTier.name} ${baseItem.name} ${playerLevel} ур.`;

  if (generatedItem.timeLimit) {
    const multiplier = qualityTier.timeLimitMultiplier || 1;
    generatedItem.timeLimit = generatedItem.timeLimit * multiplier;
    for (const statKey in finalStats) {
      const originalBaseStat = baseItem.stats[statKey] || 0;
      if (originalBaseStat !== 0 && !NO_LEVEL_SCALE.has(statKey)) {
        const levelMultiplier = 1 + (playerLevel - 1) * 0.1;
        finalStats[statKey] += originalBaseStat * levelMultiplier - originalBaseStat;
      }
      // Штрафы (отрицательные) сохраняются — не зануляем.
      finalStats[statKey] = parseFloat(finalStats[statKey].toFixed(3));
    }
    generatedItem.stats = finalStats;
    return generatedItem;
  }

  for (const statKey in finalStats) {
    const originalBaseStat = baseItem.stats[statKey] || 0;
    if (originalBaseStat !== 0 && !NO_LEVEL_SCALE.has(statKey)) {
      const levelMultiplier = 1 + (playerLevel - 1) * 0.1;
      finalStats[statKey] += originalBaseStat * levelMultiplier - originalBaseStat;
    }
    // Штрафы (отрицательные) сохраняются — не зануляем.
    finalStats[statKey] = parseFloat(finalStats[statKey].toFixed(3));
  }

  generatedItem.stats = finalStats;

  return generatedItem;
};
