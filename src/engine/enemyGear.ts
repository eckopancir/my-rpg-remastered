import { GAME_ITEMS } from '../data/GameItems';
import { generateItem, type ItemDefinition } from './items';
import { effectiveItemStats } from '../utils/itemStats';
import { ammoTypeForWeapon } from '../data/ammo';
import { CARD_RARITY_TIERS } from '../data/encounters';

/** Слоты одежды врага: полный комплект. */
export const ENEMY_CLOTH_SLOTS = ['head', 'armor', 'pants', 'gloves', 'boots'];

/** Шанс поломки слота при смерти (по умолчанию 90%). */
export const GEAR_BREAK_RATE = 0.9;

/** Множитель мощи надетого по тиру карточки: t0 +0%, далее +20% за тир. */
export const cardTierMult = (cardRarityName?: string | null): number => {
  const t = CARD_RARITY_TIERS.find((x) => x.name === cardRarityName);
  return 1 + 0.2 * (t ? t.tier : 0);
};

const groupOf = (def: ItemDefinition): string =>
  ammoTypeForWeapon({ name: def.name, ammoType: (def as any).ammoType });

/** Класс ствола по архетипу врага. */
export const weaponSpecFor = (factionKey?: string): { slot: 'weapon1' | 'weapon2'; group?: string } => {
  const k = factionKey || '';
  if (k.includes('sniper')) return { slot: 'weapon2', group: 'sniper' };
  if (k.includes('drob')) return { slot: 'weapon2', group: 'shell' };
  if (k.includes('melee') || k === 'Мутанты') return { slot: 'weapon1' };
  if (k.includes('tank')) return { slot: 'weapon2', group: 'pistol' };
  if (k.includes('medic')) return { slot: 'weapon2', group: 'pistol' };
  if (k.includes('boss')) return { slot: 'weapon2', group: 'rifle' };
  return { slot: 'weapon2', group: 'rifle' };
};

/**
 * Генерация экипировки врага обычной функцией лута (лотерея редкостей
 * как у игрока): ствол по архетипу + полный комплект одежды.
 * Уровень вещей = уровень игрока. forceRarity — форсированная редкость
 * (боссы минимум эпик).
 */
/** Фиксированный комплект босса: лучший пулемёт + весь Джаггернаут, всё божественное. */
const BOSS_GEAR_NAMES = [
  'M240',
  'Шлем джаггернаута',
  'Броня джаггернаута',
  'Штаны джаггернаута',
  'Перчатки джаггернаута',
  'Ботинки джаггернаута',
];

export const generateEnemyGear = (
  factionKey: string | undefined,
  playerLevel: number,
  forceRarity: string | null = null,
): any[] => {
  // Босс: прописанный божественный комплект (баланс — после смерти всё ломается 100%).
  if ((factionKey || '').includes('boss')) {
    const gear: any[] = [];
    for (const name of BOSS_GEAR_NAMES) {
      try {
        const def = (GAME_ITEMS as ItemDefinition[]).find((d) => d && d.name === name);
        if (!def) continue;
        const w: any = generateItem([def] as any, playerLevel, 'superepic' as any, 'Божественный', def.slot, null);
        if (w && typeof w.ammoCapacity === 'number') w.loadedAmmo = w.ammoCapacity;
        gear.push(w);
      } catch { /* ignore */ }
    }
    if (gear.length > 0) return gear;
    // Фолбэк — обычная генерация, если дефы не найдены.
  }
  const gear: any[] = [];
  const spec = weaponSpecFor(factionKey);
  // Кап качества: максимум Раритетный (боссам — полная лотерея).
  // Иначе смертоносное/божественное падает с каждого второго трупа.
  const maxQuality = (factionKey || '').includes('boss') ? null : 'Раритетный';
  try {
    const pool = (GAME_ITEMS as ItemDefinition[]).filter(
      (d) => d && d.slot === spec.slot && !(d as any).unique && (!spec.group || groupOf(d) === spec.group),
    );
    const src = pool.length > 0
      ? pool
      : (GAME_ITEMS as ItemDefinition[]).filter((d) => d && d.slot === spec.slot && !(d as any).unique);
    if (src.length > 0) {
      const w: any = generateItem(src as any, playerLevel, forceRarity as any, null, spec.slot, maxQuality);
      if (w && typeof w.ammoCapacity === 'number') w.loadedAmmo = w.ammoCapacity;
      gear.push(w);
    }
  } catch { /* ignore */ }
  for (const slot of ENEMY_CLOTH_SLOTS) {
    try {
      gear.push(generateItem(GAME_ITEMS as any, playerLevel, forceRarity as any, null, slot, maxQuality));
    } catch { /* ignore */ }
  }
  // Танк: дополнительный слот со щитом (как у игрока: сам щит +20 блока).
  if ((factionKey || '').includes('tank')) {
    try {
      gear.push(generateItem(GAME_ITEMS as any, playerLevel, forceRarity as any, null, 'shield', maxQuality));
    } catch { /* ignore */ }
  }
  return gear;
};

/** Сет одежды мусорщика-союзника: всегда полный комплект своих вещей. */
const ALLY_CLOTH_NAMES: Record<string, string> = {
  head: 'Шлем мусорщика',
  armor: 'Куртка мусорщика',
  pants: 'Штаны мусорщика',
  gloves: 'Перчатки мусорщика',
  boots: 'Ботинки мусорщика',
};

/** Ствол мусорщика: случайный — пистолет, автомат или дробовик. */
const ALLY_WEAPON_GROUPS = ['pistol', 'rifle', 'shell'];

/**
 * Экипировка мусорщика-союзника: фикс-сет «Мусорщик» + случайный ствол
 * обычной генерацией лута (как у врагов, кап качества Раритетный).
 */
export const generateAllyGear = (playerLevel: number): any[] => {
  const gear: any[] = [];
  const maxQuality = 'Раритетный';
  try {
    const group = ALLY_WEAPON_GROUPS[Math.floor(Math.random() * ALLY_WEAPON_GROUPS.length)];
    const pool = (GAME_ITEMS as ItemDefinition[]).filter(
      (d) => d && d.slot === 'weapon2' && !(d as any).unique && groupOf(d) === group,
    );
    const src = pool.length > 0
      ? pool
      : (GAME_ITEMS as ItemDefinition[]).filter((d) => d && d.slot === 'weapon2' && !(d as any).unique);
    if (src.length > 0) {
      const w: any = generateItem(src as any, playerLevel, null as any, null, 'weapon2', maxQuality);
      if (w && typeof w.ammoCapacity === 'number') w.loadedAmmo = w.ammoCapacity;
      gear.push(w);
    }
  } catch { /* ignore */ }
  for (const slot of ENEMY_CLOTH_SLOTS) {
    try {
      const def = (GAME_ITEMS as ItemDefinition[]).find((d) => d && d.name === ALLY_CLOTH_NAMES[slot]);
      const src = def ? [def] : GAME_ITEMS as any;
      gear.push(generateItem(src as any, playerLevel, null as any, null, slot, maxQuality));
    } catch { /* ignore */ }
  }
  return gear;
};

/** Сумма ЭФФЕКТИВНЫХ статов надетого (база + предустановленные сферы) —
 *  ровно то, что показывает тултип вещи. Враг 1в1 считается как мы. */
export const sumGearStats = (gear: any[]): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const g of gear || []) {
    if (!g) continue;
    let stats: Record<string, number>;
    try {
      stats = effectiveItemStats(g);
    } catch {
      stats = ((g as any)?.stats || {}) as Record<string, number>;
    }
    for (const k of Object.keys(stats)) {
      const v = stats[k];
      if (typeof v !== 'number') continue;
      out[k] = (out[k] || 0) + v;
    }
  }
  return out;
};

/** Ролл поломок при смерти: боссу ломается всё надетое (100%), остальным 75%. */
export const rollGearOnDeath = (enemy: any): any[] => {
  const isBoss = ((enemy?.factionKey || '') as string).includes('boss');
  return rollGearBreakage(enemy?.gear || [], isBoss ? 1 : GEAR_BREAK_RATE);
};
export const rollGearBreakage = (gear: any[], rate = GEAR_BREAK_RATE): any[] => {
  return (gear || []).map((g) => {
    if (!g || (g as any).broken) return g;
    return Math.random() < rate ? { ...g, broken: true } : g;
  });
};
