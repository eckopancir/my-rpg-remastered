import { GAME_ITEMS } from '../data/GameItems';
import { generateItem, type ItemDefinition } from './items';
import { ammoTypeForWeapon } from '../data/ammo';
import { CARD_RARITY_TIERS } from '../data/encounters';

/** Слоты одежды врага: полный комплект. */
export const ENEMY_CLOTH_SLOTS = ['head', 'armor', 'pants', 'gloves', 'boots'];

/** Шанс поломки слота при смерти (по умолчанию 75%). */
export const GEAR_BREAK_RATE = 0.75;

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
  if (k.includes('tank')) return { slot: 'weapon2', group: 'mg' };
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
export const generateEnemyGear = (
  factionKey: string | undefined,
  playerLevel: number,
  forceRarity: string | null = null,
): any[] => {
  const gear: any[] = [];
  const spec = weaponSpecFor(factionKey);
  try {
    const pool = (GAME_ITEMS as ItemDefinition[]).filter(
      (d) => d && d.slot === spec.slot && (!spec.group || groupOf(d) === spec.group),
    );
    const src = pool.length > 0
      ? pool
      : (GAME_ITEMS as ItemDefinition[]).filter((d) => d && d.slot === spec.slot);
    if (src.length > 0) {
      const w: any = generateItem(src as any, playerLevel, forceRarity as any, null, spec.slot);
      if (w && typeof w.ammoCapacity === 'number') w.loadedAmmo = w.ammoCapacity;
      gear.push(w);
    }
  } catch { /* ignore */ }
  for (const slot of ENEMY_CLOTH_SLOTS) {
    try {
      gear.push(generateItem(GAME_ITEMS as any, playerLevel, forceRarity as any, null, slot));
    } catch { /* ignore */ }
  }
  return gear;
};

/** Сумма базовых статов надетого (без сфер/модов — предсказуемо для боя). */
export const sumGearStats = (gear: any[]): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const g of gear || []) {
    const stats = (g?.stats || {}) as Record<string, number>;
    for (const k of Object.keys(stats)) {
      const v = stats[k];
      if (typeof v !== 'number') continue;
      out[k] = (out[k] || 0) + v;
    }
  }
  return out;
};

/** Ролл поломок при смерти: каждый слот с шансом rate становится сломанным (иммутабельно). */
export const rollGearBreakage = (gear: any[], rate = GEAR_BREAK_RATE): any[] => {
  return (gear || []).map((g) => {
    if (!g || (g as any).broken) return g;
    return Math.random() < rate ? { ...g, broken: true } : g;
  });
};
