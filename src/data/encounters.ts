import blockpostBg from '../assets/images/characters/Заброшенный Военный Блокпост.png';
import arsenalBg from '../assets/images/characters/Секретный Арсенал.png';
import warehouseBg from '../assets/images/characters/Военные склады.png';
import labBg from '../assets/images/characters/Химическая лаборатория.png';
import patrolBg from '../assets/images/characters/Военный патруль.png';

export type EnemyShortName = 'tank' | 'melee' | 'sniper' | 'drob' | 'original' | 'medic' | 'boss';

export interface RarityTier {
  name: string;
  tier: number;
  slBonus: number;
  weight: number;
  color: string;
}

export interface CardTemplate {
  id: string;
  name: string;
  image: string;
  enemyPool: { type: EnemyShortName; weight: number }[];
  slMin: number;
  slMax: number;
  enemyMin: number;
  enemyMax: number;
}

export interface GeneratedCard {
  id: string;
  templateId: string;
  name: string;
  image: string;
  sl: number;
  rarity: { name: string; tier: number; slBonus: number; color: string };
  totalSl: number;
  enemyTypes: EnemyShortName[];
  enemyCount: number;
  chipReward: number;
  xpReward: number;
  type: 'combat';
}

export const CARD_RARITY_TIERS: RarityTier[] = [
  { name: 'Обычный', tier: 0, slBonus: 0, weight: 33, color: 'white' },
  { name: 'Редкий', tier: 1, slBonus: 50, weight: 25, color: 'lime' },
  { name: 'Раритетный', tier: 2, slBonus: 100, weight: 18, color: 'deepskyblue' },
  { name: 'Эпический', tier: 3, slBonus: 150, weight: 12, color: 'mediumpurple' },
  { name: 'Смертоносный', tier: 4, slBonus: 200, weight: 7, color: 'red' },
  { name: 'Легендарный', tier: 5, slBonus: 250, weight: 4, color: 'gold' },
  { name: 'Божественный', tier: 6, slBonus: 300, weight: 1, color: 'cyan' },
];

export const ENEMY_TYPE_MULTIPLIERS: Record<EnemyShortName, number> = {
  original: 1.0,
  drob: 1.5,
  melee: 1.5,
  sniper: 2.0,
  tank: 2.0,
  medic: 2.0,
  boss: 5.0,
};

export const ENEMY_TYPE_TO_KEY: Record<EnemyShortName, string> = {
  tank: 'Военные (tank)',
  melee: 'Военные (melee)',
  sniper: 'Военные (sniper)',
  drob: 'Военные (drob)',
  original: 'Военные (original)',
  medic: 'Военные (medic)',
  boss: 'Военные (boss)',
};

const CARD_TEMPLATES: CardTemplate[] = [
  {
    id: 'blockpost',
    name: 'Заброшенный Военный Блокпост',
    image: blockpostBg,
    enemyPool: [
      { type: 'drob', weight: 25 },
      { type: 'original', weight: 50 },
      { type: 'medic', weight: 25 },
    ],
    slMin: 15, slMax: 30,
    enemyMin: 2, enemyMax: 5,
  },
  {
    id: 'arsenal',
    name: 'Секретный Арсенал',
    image: arsenalBg,
    enemyPool: [
      { type: 'tank', weight: 25 },
      { type: 'melee', weight: 25 },
      { type: 'original', weight: 50 },
    ],
    slMin: 30, slMax: 45,
    enemyMin: 2, enemyMax: 5,
  },
  {
    id: 'warehouse',
    name: 'Военные склады',
    image: warehouseBg,
    enemyPool: [
      { type: 'sniper', weight: 10 },
      { type: 'drob', weight: 15 },
      { type: 'original', weight: 25 },
      { type: 'medic', weight: 25 },
    ],
    slMin: 50, slMax: 70,
    enemyMin: 2, enemyMax: 6,
  },
  {
    id: 'lab',
    name: 'Химическая лаборатория',
    image: labBg,
    enemyPool: [
      { type: 'boss', weight: 100 },
    ],
    slMin: 200, slMax: 200,
    enemyMin: 1, enemyMax: 1,
  },
  {
    id: 'patrol',
    name: 'Военный патруль',
    image: patrolBg,
    enemyPool: [
      { type: 'tank', weight: 10 },
      { type: 'melee', weight: 10 },
      { type: 'sniper', weight: 10 },
      { type: 'drob', weight: 10 },
      { type: 'original', weight: 49 },
      { type: 'medic', weight: 10 },
      { type: 'boss', weight: 1 },
    ],
    slMin: 1, slMax: 100,
    enemyMin: 4, enemyMax: 12,
  },
];

function weightedRandom<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateEnemyTypes(pool: { type: EnemyShortName; weight: number }[], count: number): EnemyShortName[] {
  const enemies: EnemyShortName[] = [];
  for (let i = 0; i < count; i++) {
    enemies.push(weightedRandom(pool).type);
  }
  return enemies;
}

function calcChipReward(totalSl: number, enemyTypes: EnemyShortName[]): number {
  const avgMult = enemyTypes.reduce((s, t) => s + ENEMY_TYPE_MULTIPLIERS[t], 0) / enemyTypes.length;
  return Math.round(totalSl * enemyTypes.length * 0.5 * avgMult);
}

function calcXpReward(totalSl: number, enemyTypes: EnemyShortName[]): number {
  const avgMult = enemyTypes.reduce((s, t) => s + ENEMY_TYPE_MULTIPLIERS[t], 0) / enemyTypes.length;
  return Math.round(totalSl * enemyTypes.length * 0.8 * avgMult);
}

const LS_CARDS_KEY = 'militaryCards';
const LS_REFRESH_KEY = 'militaryCardsRefresh';
const REFRESH_INTERVAL = 300000;

export function generateCards(): GeneratedCard[] {
  const cards: GeneratedCard[] = [];
  for (let i = 0; i < 9; i++) {
    const template = CARD_TEMPLATES[Math.floor(Math.random() * CARD_TEMPLATES.length)];
    const sl = randInt(template.slMin, template.slMax);
    const rarity = weightedRandom(CARD_RARITY_TIERS);
    const totalSl = sl + rarity.slBonus;
    const enemyCount = randInt(template.enemyMin, template.enemyMax);
    const enemyTypes = generateEnemyTypes(template.enemyPool, enemyCount);

    cards.push({
      id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${i}`,
      templateId: template.id,
      name: template.name,
      image: template.image,
      sl,
      rarity: { name: rarity.name, tier: rarity.tier, slBonus: rarity.slBonus, color: rarity.color },
      totalSl,
      enemyTypes,
      enemyCount,
      chipReward: calcChipReward(totalSl, enemyTypes),
      xpReward: calcXpReward(totalSl, enemyTypes),
      type: 'combat',
    });
  }
  return cards;
}

export function getAvailableCards(): GeneratedCard[] {
  const stored = localStorage.getItem(LS_CARDS_KEY);
  const refreshStr = localStorage.getItem(LS_REFRESH_KEY);
  const now = Date.now();

  if (stored && refreshStr) {
    const lastRefresh = parseInt(refreshStr);
    if (now - lastRefresh < REFRESH_INTERVAL) {
      try {
        const parsed: GeneratedCard[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length === 9) return parsed;
      } catch {}
    }
  }

  const cards = generateCards();
  localStorage.setItem(LS_CARDS_KEY, JSON.stringify(cards));
  localStorage.setItem(LS_REFRESH_KEY, String(now));
  return cards;
}

export function getRefreshTime(): number {
  const refreshStr = localStorage.getItem(LS_REFRESH_KEY);
  if (!refreshStr) return 300;
  const elapsed = Date.now() - parseInt(refreshStr);
  const remaining = Math.max(0, REFRESH_INTERVAL - elapsed);
  return Math.ceil(remaining / 1000);
}

export function forceRefresh(): GeneratedCard[] {
  const cards = generateCards();
  localStorage.setItem(LS_CARDS_KEY, JSON.stringify(cards));
  localStorage.setItem(LS_REFRESH_KEY, String(Date.now()));
  return cards;
}
