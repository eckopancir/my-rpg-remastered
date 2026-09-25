import { ALL_ABILITIES } from '../data/accessoryAbilities';
import { schemePctFor, schemeFlatFor } from '../data/schematics';

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
  { name: 'Обычный', chance: 60, bonusStatsCount: 0, color: 'white', timeLimitMultiplier: 1 },
  { name: 'Редкий', chance: 22, bonusStatsCount: 1, color: 'lime', timeLimitMultiplier: 2 },
  { name: 'Раритетный', chance: 10, bonusStatsCount: 2, color: 'deepskyblue', timeLimitMultiplier: 3 },
  { name: 'Эпический', chance: 5, bonusStatsCount: 3, color: 'mediumpurple', timeLimitMultiplier: 4 },
  { name: 'Смертоносный', chance: 2, bonusStatsCount: 5, color: 'red', timeLimitMultiplier: 5 },
  { name: 'Легендарный', chance: 0.9, bonusStatsCount: 7, color: 'gold', timeLimitMultiplier: 6 },
  { name: 'Божественный', chance: 0.1, bonusStatsCount: 10, color: 'cyan', timeLimitMultiplier: 7 },
];

export const QUALITY_BONUSES: Record<string, Record<string, number>> = {
  weapon1: { crit: 0.005, vampir: 0.005, punching: 0.005, accuracy: 0.005, damage: 2 },
  weapon2: {
    crit: 0.005, vampir: 0.005, punching: 0.005, accuracy: 0.005, speed: 0.02,
    dpsExtro: 2, dpsFire: 2, dpsEmi: 2, dpsToxis: 2, damage: 3,
  },
  head: { regen: 2, block: 0.005, evasion: 0.0004, armor: 2, maxHp: 250, stamina: 1.5 },
  armor: { regen: 2, block: 0.005, evasion: 0.0004, armor: 2, maxHp: 250, stamina: 1.5 },
  shield: { regen: 2, evasion: 0.0004, armor: 2, maxHp: 250 },
  gloves: { regen: 2, block: 0.005, evasion: 0.0004, armor: 2, maxHp: 250, stamina: 1.5 },
  boots: { regen: 2, block: 0.005, evasion: 0.0004, armor: 2, maxHp: 250, stamina: 1.5 },
  pants: { stamina: 1.5 },
  ammo: { regen: 0.01, block: 0.003, evasion: 0.002, armor: 0.5, maxHp: 20, damage: 0.5 },
  mod: {
    regen: 0.005, block: 0.005, evasion: 0.0004, armor: 2, maxHp: 250, damage: 2,
    crit: 0.005, vampir: 0.005, punching: 0.005, accuracy: 0.0025,
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
  unique?: boolean;
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
  unique?: boolean;
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

/**
 * Множитель статов мода от его качества (редкость снова имеет смысл).
 * Обычный ×1 … Божественный ×2.
 */
export const QUALITY_MOD_MULT: Record<string, number> = {
  'Обычный': 1,
  'Редкий': 1.1,
  'Раритетный': 1.25,
  'Эпический': 1.4,
  'Смертоносный': 1.6,
  'Легендарный': 1.8,
  'Божественный': 2.0,
};

/**
 * Второй стат мода из пула (мутабельно в stats): совпал с сигнатурой — дабл.
 * Используется генерацией и дебагом, чтобы моды всегда были 2-параметровые.
 */
export const rollModExtraStat = (
  stats: Record<string, number>,
  slot: string,
  weaponSlots: string[] = ['mod_blade', 'mod_handle', 'mod_pommel', 'mod_harness', 'mod_scope', 'mod_barrel', 'mod_receiver', 'mod_muzzle', 'mod_stock'],
  armorSlots: string[] = ['mod_lining', 'mod_hardshell', 'mod_utility', 'mod_patch'],
  weaponPool: Record<string, number> = { damage: 3, crit: 0.04, speed: 0.04, accuracy: 0.02, punching: 0.04, vampir: 0.04 },
  armorPool: Record<string, number> = { armor: 2.5, maxHp: 250, regen: 2, evasion: 0.004, block: 0.04 },
): void => {
  if (slot === 'mod_magazine') return;
  const pool = weaponSlots.includes(slot) ? weaponPool : armorPool;
  const keys = Object.keys(pool);
  const pick = keys[Math.floor(Math.random() * keys.length)];
  stats[pick] = (stats[pick] || 0) + pool[pick];
};

let _idCounter = 0;

const uniqueId = () => String(Date.now()) + '_' + (++_idCounter) + '_' + Math.random().toString(36).slice(2, 8);

// Скалирование как раньше: ВСЕ базовые статы растут с уровнем.
// Штрафы (отрицательные) при этом НЕ растут и НЕ зануляются.

// Стихийный урон может появиться на оружии с уровнем, даже если его
// не было в базе. Выносливость — только на броне (слот armor-класса).
// Остальные новые характеристики — нет.
const ROLLABLE_NEW_STATS = new Set([
  'dpsEmi', 'dpsToxis', 'dpsExtro', 'dpsFire',
]);
// Вампиризм может появиться заново, но только на оружии.
const WEAPON_ROLLABLE_NEW_STATS = new Set(['vampir']);
const ARMOR_NEW_STATS = new Set(['stamina']);
const ARMOR_POOL_SLOTS = new Set(['head', 'armor', 'pants', 'gloves', 'boots', 'shield']);

const WEAPON_SPHERE_PCT = ['damage', 'crit', 'speed', 'punching', 'accuracy', 'vampir'];
const WEAPON_SPHERE_FLAT = ['dpsEmi', 'dpsFire', 'dpsToxis', 'dpsExtro'];
const ARMOR_SPHERE_PCT = ['armor', 'evasion', 'block', 'vampir', 'regen', 'maxHp', 'stamina'];

/**
 * Предустановленные сферы с дропа: оружие 25%/10%/2% (1/2/3 шт.),
 * броня 15%/5% (1/2 шт.), не больше гнёзд. Ось: оружию — атакующие
 * (% — только из имеющихся в базе, стихийка — всегда), броне — защитные.
 * Качество сферы — обычной пирамидой.
 */
export const rollPreinstalledSpheres = (
  slot: string,
  socketSlots: number,
  stats: Record<string, number>,
): { stat: string; pct: number }[] => {
  if (!socketSlots || socketSlots <= 0) return [];
  const isW = slot === 'weapon1' || slot === 'weapon2' || slot.startsWith('gun_');
  const isA = ['head', 'armor', 'pants', 'gloves', 'boots'].includes(slot);
  if (!isW && !isA) return [];
  const r = Math.random();
  let n = 0;
  if (isW) {
    if (r < 0.02) n = 3; else if (r < 0.12) n = 2; else if (r < 0.37) n = 1;
  } else {
    if (r < 0.05) n = 2; else if (r < 0.20) n = 1;
  }
  n = Math.min(n, socketSlots);
  if (n <= 0) return [];
  const pctPool = (isW ? WEAPON_SPHERE_PCT : ARMOR_SPHERE_PCT).filter((k) => (stats[k] || 0) > 0);
  const flatPool = isW ? WEAPON_SPHERE_FLAT : [];
  if (pctPool.length === 0 && flatPool.length === 0) return [];
  const out: { stat: string; pct: number }[] = [];
  for (let i = 0; i < n; i++) {
    // Стихийка имбовая и была всегда в пуле — теперь ей отдельная ветка 25%,
    // остальные 75% — равномерный пик из характеристик, уже есть на предмете.
    // Если один пул пуст — берём из другого.
    const useFlat = flatPool.length > 0 && (pctPool.length === 0 || Math.random() < 0.25);
    const pool = useFlat ? flatPool : pctPool.length > 0 ? pctPool : flatPool;
    const stat = pool[Math.floor(Math.random() * pool.length)];
    const q = getItemQuality();
    out.push({ stat, pct: flatPool.includes(stat) ? schemeFlatFor(stat, q.name) : schemePctFor(stat, q.name) });
  }
  return out;
};

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
  // С уровня падают бонусы ТОЛЬКО к тем статам, что уже есть в базе.
  // Исключение — стихийный урон: он может появиться заново.
  // Выносливость может появиться заново, но только на броне.
  // (+5 брони или +15% крита из ниоткуда — нельзя.)
  const slotIsArmor = ARMOR_POOL_SLOTS.has(generatedItem.slot);
  const slotIsWeapon = generatedItem.slot.startsWith('weapon') || generatedItem.slot.startsWith('gun_');
  bonusKeys = bonusKeys.filter((k) => (finalStats[k] || 0) !== 0 || ROLLABLE_NEW_STATS.has(k) || (slotIsArmor && ARMOR_NEW_STATS.has(k)) || (slotIsWeapon && WEAPON_ROLLABLE_NEW_STATS.has(k)));

  // Мод: сигнатура из дефа + ОДИН случайный второй стат из пула.
  // Совпал с сигнатурой — дабл (крит+крит). Магазины — только +патроны.
  const isModSlot = generatedItem.slot.startsWith('mod_');
  const isMagazineMod = generatedItem.slot === 'mod_magazine';
  if (isModSlot && !isMagazineMod) {
    rollModExtraStat(finalStats, generatedItem.slot);
    // Редкость мода усиливает оба его параметра.
    const qmult = QUALITY_MOD_MULT[qualityTier?.name || 'Обычный'] || 1;
    if (qmult !== 1) {
      for (const k of Object.keys(finalStats)) {
        finalStats[k] = Math.round(finalStats[k] * qmult * 10000) / 10000;
      }
    }
    // Метка нового образца: старые без метки чистятся миграцией.
    (generatedItem as any)._modv = 2;
  }

  for (let i = 0; i < qualityTier.bonusStatsCount; i++) {
    if (bonusKeys.length === 0) break;
    // Модам качественные бонус-роллы не положены: у них уже есть второй стат.
    if (isModSlot) break;
    const randomStatKey = bonusKeys[Math.floor(Math.random() * bonusKeys.length)];
    const baseBonusValue = generatedItem.slot.startsWith('mod_')
      ? (generatedItem.stats[randomStatKey] || 0)
      : (bonusSource[randomStatKey] || 0);
    // Дробные бонусы скейлятся как раньше (откат). Новые ключи — только стихийка.
    const levelMultiplier = 1 + (playerLevel - 1) * 0.05;
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
      // Моды хранят базу: скейлит рантайм по уровню мода. Тут не масштабируем.
      if (generatedItem.slot.startsWith('mod_')) break;
      if (originalBaseStat !== 0 && originalBaseStat > 0) {
        const levelMultiplier = 1 + (playerLevel - 1) * 0.05;
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
    // Моды хранят базу: скейлит рантайм по уровню мода. Тут не масштабируем.
    if (generatedItem.slot.startsWith('mod_')) break;
    // Штрафы не растут с уровнем (остаются как в базе) и не зануляются.
    if (originalBaseStat !== 0 && originalBaseStat > 0) {
      const levelMultiplier = 1 + (playerLevel - 1) * 0.05;
      finalStats[statKey] += originalBaseStat * levelMultiplier - originalBaseStat;
    }
    // Штрафы (отрицательные) сохраняются — не зануляем.
    finalStats[statKey] = parseFloat(finalStats[statKey].toFixed(3));
  }

  generatedItem.stats = finalStats;

  // Гнёзда под сферы: оружие 1–5, броня 1–3 (модам, уникам и щитам не положены).
  const isGear = generatedItem.slot === 'weapon1' || generatedItem.slot === 'weapon2'
    || generatedItem.slot.startsWith('gun_')
    || ['head', 'armor', 'pants', 'gloves', 'boots'].includes(generatedItem.slot);
  if (isGear && !(generatedItem as any).unique) {
    const isW = generatedItem.slot === 'weapon1' || generatedItem.slot === 'weapon2' || generatedItem.slot.startsWith('gun_');
    (generatedItem as any).socketSlots = isW ? 1 + Math.floor(Math.random() * 5) : 1 + Math.floor(Math.random() * 3);
  }

  // Предустановленные сферы с дропа (поверх гнёзд).
  if (isGear && !(generatedItem as any).unique) {
    const pre = rollPreinstalledSpheres(generatedItem.slot, (generatedItem as any).socketSlots || 0, finalStats);
    if (pre.length > 0) (generatedItem as any).sockets = pre;
  }

  return generatedItem;
};
