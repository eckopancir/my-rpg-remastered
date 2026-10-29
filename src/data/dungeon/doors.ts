/**
 * Двери, награды и кузница карточного данжа.
 * 30 дверей, боссы на 10/20/30.
 */

import { CARDS, type CardDef } from './cards';
import { enemyCountForDoor, tierMult } from './enemies';

export type DoorType = 'battle' | 'elite' | 'forge' | 'rest' | 'event' | 'boss';

export interface DoorOption {
  id: string;
  type: DoorType;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
}

export const DOOR_META: Record<DoorType, { title: string; icon: string; color: string; desc: string }> = {
  battle: { title: 'Бой', icon: '⚔️', color: '#f87171', desc: 'Случайные враги из пула' },
  elite: { title: 'Элита', icon: '💀', color: '#c084fc', desc: 'Усиленный враг и гарантированная карта' },
  forge: { title: 'Кузница', icon: '🔨', color: '#fbbf24', desc: 'Апгрейд карт за чипы' },
  rest: { title: 'Отдых', icon: '🔥', color: '#4ade80', desc: 'Лечение 30% HP всем наёмникам' },
  event: { title: 'Событие', icon: '❓', color: '#38bdf8', desc: 'Риск и награда' },
  boss: { title: 'Босс', icon: '👑', color: '#ef4444', desc: 'Хозяин акта' },
};

const makeDoor = (type: DoorType, door: number): DoorOption => {
  const meta = DOOR_META[type];
  let subtitle = meta.desc;
  if (type === 'battle') subtitle = `Врагов: ${enemyCountForDoor(door)}`;
  if (type === 'boss') subtitle = door === 30 ? 'Финальный босс' : 'Босс акта';
  return {
    id: `${type}_${door}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    title: meta.title,
    subtitle,
    icon: meta.icon,
    color: meta.color,
  };
};

const pickWeighted = (entries: [DoorType, number][]): DoorType => {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [type, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return type;
  }
  return entries[entries.length - 1][0];
};

/** 2–3 двери на выбор. Босс — единственная дверь. */
export const generateDoors = (door: number, act: number): DoorOption[] => {
  if (door % 10 === 0) return [makeDoor('boss', door)];
  if (door === 1) return [makeDoor('battle', door), makeDoor('rest', door)];

  const weights: Record<number, [DoorType, number][]> = {
    0: [['battle', 55], ['elite', 10], ['forge', 12], ['rest', 12], ['event', 11]],
    1: [['battle', 45], ['elite', 15], ['forge', 12], ['rest', 10], ['event', 18]],
    2: [['battle', 40], ['elite', 20], ['forge', 12], ['rest', 8], ['event', 20]],
  };
  const table = weights[act] ?? weights[0];
  const count = 2 + (Math.random() < 0.55 ? 1 : 0);
  const types: DoorType[] = [];
  let guard = 0;
  while (types.length < count && guard < 40) {
    guard += 1;
    const t = pickWeighted(table);
    if (!types.includes(t)) types.push(t);
  }
  if (types.length === 0) types.push('battle');
  return types.map((t) => makeDoor(t, door));
};

/** Награда чипами за дверь (до множителя тира). */
export const doorChips = (type: DoorType, tier: number): number => {
  const tm = tierMult(tier).reward;
  const base =
    type === 'elite' ? 150 + Math.random() * 70
      : type === 'boss' ? 400 + Math.random() * 200
        : 50 + Math.random() * 30;
  return Math.round(base * tm);
};

/** Шанс карты в награде. */
export const cardChance = (type: DoorType): number => {
  if (type === 'elite' || type === 'boss') return 1;
  return 0.4;
};

const rewardPool: CardDef[] = CARDS;

export const rollRewardCards = (count = 3): string[] => {
  const ids = new Set<string>();
  let guard = 0;
  while (ids.size < count && guard < 80) {
    guard += 1;
    ids.add(rewardPool[Math.floor(Math.random() * rewardPool.length)].id);
  }
  return Array.from(ids);
};

/** Стоимость апгрейда карты до targetLevel (2..7). */
export const upgradeCost = (power: number, targetLevel: number): number => {
  const table = [0, 0, 200, 500, 1000, 2000, 4000, 8000];
  const base = table[Math.max(0, Math.min(7, targetLevel))] || 0;
  // Мягкий множитель: дорогие карты не улетают в космос по цене.
  return Math.round(base * (0.5 + power / 200));
};

export const upgradeCostFor = (card: CardDef, currentLevel: number): number =>
  upgradeCost(card.power, Math.min(7, currentLevel + 1));

export interface DungeonEvent {
  id: string;
  title: string;
  text: string;
  choices: { label: string; hint: string }[];
}

export const DUNGEON_EVENTS: DungeonEvent[] = [
  {
    id: 'cache',
    title: 'Схрон сталкера',
    text: 'В паутине у стены висит вскрытый рюкзак. Внутри — горсть чипов и завёрнутый в промасленную тряпку ремкомплект. Хозяин схрона так и не вышел из улья.',
    choices: [
      { label: 'Забрать чипы', hint: '+120 чипов забега' },
      { label: 'Забрать ремкомплект', hint: 'Лечит всех на 25%' },
    ],
  },
  {
    id: 'eggs',
    title: 'Кладка в углу',
    text: 'Тёплый кокон с яйцами тихо пульсирует. Если раздавить — улей почует потерю. Если обойти — можно пройти тихо.',
    choices: [
      { label: 'Раздавить кладку', hint: '+200 чипов, но все враги в следующем бою сильнее' },
      { label: 'Обойти стороной', hint: 'Ничего не происходит' },
    ],
  },
  {
    id: 'silk',
    title: 'Шёлковый карман',
    text: 'В стене — дупло, затянутое плотным шёлком. За ним угадывается старый армейский ящик. Шёлк липкий и тёплый.',
    choices: [
      { label: 'Разрезать шёлк', hint: 'Случайная карта в колоду' },
      { label: 'Не трогать', hint: 'Лечит всех на 15%' },
    ],
  },
];

export const rollEvent = (): DungeonEvent =>
  DUNGEON_EVENTS[Math.floor(Math.random() * DUNGEON_EVENTS.length)];

export const doorTypeLabel = (type: DoorType): string => DOOR_META[type].title;
