export interface Encounter {
  id: string;
  name: string;
  description: string;
  difficulty: number;
  enemyCount: number;
  rewards: string[];
  expReward: number;
  chipReward: number;
  type: 'combat' | 'loot' | 'event';
}

const encounterTemplates: Omit<Encounter, 'id'>[] = [
  { name: 'Разведка', description: 'Тихая разведка местности. Можно избежать боя.', difficulty: 1, enemyCount: 0, rewards: ['Информация'], expReward: 50, chipReward: 20, type: 'event' },
  { name: 'Засада', description: 'Враги устроили засаду! Приготовься к бою.', difficulty: 3, enemyCount: 2, rewards: ['Оружие', 'Боеприпасы'], expReward: 100, chipReward: 30, type: 'combat' },
  { name: 'Заброшенный склад', description: 'Старый склад с припасами. Много добычи.', difficulty: 2, enemyCount: 1, rewards: ['Припасы', 'Материалы'], expReward: 80, chipReward: 50, type: 'loot' },
  { name: 'Патруль', description: 'Враждебный патруль прочесывает территорию.', difficulty: 4, enemyCount: 3, rewards: ['Оружие', 'Броня'], expReward: 120, chipReward: 40, type: 'combat' },
  { name: 'Лагерь', description: 'Вражеский лагерь. Можно атаковать или обойти.', difficulty: 5, enemyCount: 4, rewards: ['Оружие', 'Чипы', 'Припасы'], expReward: 200, chipReward: 80, type: 'combat' },
  { name: 'Аномалия', description: 'Странная аномалия искажает реальность. Опасно.', difficulty: 6, enemyCount: 0, rewards: ['Редкие материалы'], expReward: 150, chipReward: 100, type: 'event' },
  { name: 'Караван', description: 'Разбитый караван. Можно обыскать.', difficulty: 1, enemyCount: 0, rewards: ['Чипы', 'Припасы', 'Оружие'], expReward: 60, chipReward: 100, type: 'loot' },
  { name: 'Укрепленная точка', description: 'Сильно укрепленная позиция. Штурм будет тяжелым.', difficulty: 7, enemyCount: 5, rewards: ['Легендарные предметы', 'Моды'], expReward: 300, chipReward: 150, type: 'combat' },
  { name: 'Торговец', description: 'Одинокий торговец ищет охрану.', difficulty: 1, enemyCount: 0, rewards: ['Чипы'], expReward: 40, chipReward: 200, type: 'event' },
  { name: 'Зараженная зона', description: 'Зона сильного заражения. Нужна защита.', difficulty: 4, enemyCount: 3, rewards: ['Медикаменты', 'Материалы'], expReward: 130, chipReward: 60, type: 'combat' },
  { name: 'Схрон', description: 'Чей-то тайник с припасами. Удача!', difficulty: 1, enemyCount: 0, rewards: ['Припасы', 'Боеприпасы', 'Чипы'], expReward: 30, chipReward: 80, type: 'loot' },
  { name: 'Босс-локация', description: 'Огромный монстр или элитный отряд. Максимальная награда.', difficulty: 9, enemyCount: 1, rewards: ['Легендарные предметы', 'Моды', 'Чипы'], expReward: 500, chipReward: 500, type: 'combat' },
];

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const LS_REFRESH_KEY = 'expeditionRefreshTime';
const LS_ENCOUNTERS_KEY = 'currentAvailableEncounters';
const LS_BLOCKED_CARDS_KEY = 'expeditionBlockedCards';

export const generateEncounters = (zoneDifficulty: number, count: number = 8): Encounter[] => {
  const storedRefresh = localStorage.getItem(LS_REFRESH_KEY);
  const storedEncounters = localStorage.getItem(LS_ENCOUNTERS_KEY);
  const now = Date.now();
  const refreshTime = storedRefresh ? parseInt(storedRefresh) : 0;

  if (storedEncounters && now - refreshTime < 6000000) {
    try {
      return JSON.parse(storedEncounters);
    } catch {}
  }

  const ALL_ENCOUNTERS = encounterTemplates.map((t, i) => ({ ...t, id: `enc_${i}` }));

  const suitable = ALL_ENCOUNTERS.filter((e) => e.difficulty <= zoneDifficulty + 3 && e.difficulty >= Math.max(1, zoneDifficulty - 2));

  const pool = suitable.length >= count ? suitable : ALL_ENCOUNTERS;
  const shuffled = shuffle(pool);
  const selected = shuffled.slice(0, count).map((e) => ({
    ...e,
    id: `${e.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  }));

  localStorage.setItem(LS_REFRESH_KEY, String(now));
  localStorage.setItem(LS_ENCOUNTERS_KEY, JSON.stringify(selected));

  return selected;
};

const BLOCK_DURATION = 60000; // 60 seconds

export const blockEncounter = (encounterId: string) => {
  const stored = localStorage.getItem(LS_BLOCKED_CARDS_KEY);
  const blocked: Record<string, { id: string; time: number }[]> = stored ? JSON.parse(stored) : {};
  const zoneKey = 'current';
  if (!blocked[zoneKey]) blocked[zoneKey] = [];
  // Remove expired block if exists
  blocked[zoneKey] = blocked[zoneKey].filter((e) => Date.now() - e.time < BLOCK_DURATION);
  blocked[zoneKey].push({ id: encounterId, time: Date.now() });
  localStorage.setItem(LS_BLOCKED_CARDS_KEY, JSON.stringify(blocked));
};

export const getBlockedEncounters = (): Set<string> => {
  const stored = localStorage.getItem(LS_BLOCKED_CARDS_KEY);
  if (!stored) return new Set();
  const blocked: Record<string, { id: string; time: number }[]> = JSON.parse(stored);
  const zoneKey = 'current';
  const list = blocked[zoneKey] || [];
  return new Set(list.filter((e) => Date.now() - e.time < BLOCK_DURATION).map((e) => e.id));
};

export const cleanupBlockedEncounters = () => {
  const stored = localStorage.getItem(LS_BLOCKED_CARDS_KEY);
  if (!stored) return;
  const blocked: Record<string, { id: string; time: number }[]> = JSON.parse(stored);
  for (const key of Object.keys(blocked)) {
    blocked[key] = blocked[key].filter((e) => Date.now() - e.time < BLOCK_DURATION);
  }
  localStorage.setItem(LS_BLOCKED_CARDS_KEY, JSON.stringify(blocked));
};
