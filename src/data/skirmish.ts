import {
  CARD_RARITY_TIERS, ENEMY_TYPE_TO_KEY,
  type EnemyShortName, type RarityTier,
} from './encounters';

export type SkirmishDamager = 'melee' | 'sniper' | 'original' | 'drob';
export type SkirmishRole = 'tank' | 'medic' | 'damager' | 'mechanic';

export interface SkirmishCard {
  id: string;
  name: string;
  rarity: RarityTier;
  tierMult: number;
  damager: SkirmishDamager;
  enemyKeys: string[];
  chipReward: number;
  xpReward: number;
  /** Кастомная карта конструктора (маленькая, с ареной). */
  customMapName?: string;
}

const DAMAGERS: SkirmishDamager[] = ['melee', 'sniper', 'original', 'drob'];

const rollRarity = (): RarityTier => {
  const total = CARD_RARITY_TIERS.reduce((s, t) => s + (t as any).weight, 0);
  let r = Math.random() * total;
  for (const t of CARD_RARITY_TIERS) {
    r -= (t as any).weight;
    if (r <= 0) return t;
  }
  return CARD_RARITY_TIERS[0];
};

const rollDamager = (): SkirmishDamager =>
  DAMAGERS[Math.floor(Math.random() * DAMAGERS.length)];

/** Состав врага 4×4: танк, хил, дамагер-ролл, механик. */
export const SKIRMISH_COMP: Array<{ role: SkirmishRole; short: EnemyShortName | 'mechanic' }> = [
  { role: 'tank', short: 'tank' },
  { role: 'medic', short: 'medic' },
  { role: 'damager', short: 'original' },
  { role: 'mechanic', short: 'mechanic' },
];

export const MECHANIC_FACTION_KEY = 'Военные (mechanic)';

/** Стычечный множитель тира поверх карточного: редкость решает «во много раз». */
export const skirmishTierMult = (tier: number): number => 1 + 0.5 * Math.max(0, tier);

/** Итоговая мощь карточки (показываем на карте): карточный × стычечный. */
export const skirmishPowerMult = (tier: number): number =>
  Math.round((1 + 0.2 * Math.max(0, tier)) * skirmishTierMult(tier) * 10) / 10;

const shortToKey = (s: EnemyShortName | 'mechanic'): string =>
  s === 'mechanic' ? MECHANIC_FACTION_KEY : ENEMY_TYPE_TO_KEY[s];

/** 3 карточки стычек: редкость роллится, тир жмёт награду и врагов (как MAP). */
export function generateSkirmishCards(): SkirmishCard[] {
  let customs: any[] = [];
  try {
    const raw = localStorage.getItem('rpg.customMaps');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) customs = arr.filter((m: any) => m && m.arena && typeof m.arena.x1 === 'number');
    }
  } catch { /* ignore */ }
  const cards: SkirmishCard[] = [];
  for (let i = 0; i < 3; i++) {
    const rarity = rollRarity();
    const tierMult = 1 + 0.2 * rarity.tier;
    const damager = rollDamager();
    const comp = SKIRMISH_COMP.map((c) =>
      c.role === 'damager' ? shortToKey(damager) : shortToKey(c.short),
    );
    // Иногда стычка — на кастомной маленькой карте конструктора.
    const custom = customs.length > 0 && Math.random() < 0.35
      ? customs[Math.floor(Math.random() * customs.length)]
      : null;
    cards.push({
      id: `sk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${i}`,
      name: custom ? `Стычка 4×4: ${custom.name}` : 'Стычка 4×4',
      rarity,
      tierMult,
      damager,
      enemyKeys: comp,
      chipReward: Math.round(400 * tierMult),
      xpReward: Math.round(1200 * tierMult),
      customMapName: custom ? custom.name : undefined,
    });
  }
  return cards;
}
