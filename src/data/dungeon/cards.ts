/**
 * Пул карт карточного данжа.
 *
 * v2: карта описывается списком эффектов (`effects`), а не плоскими полями.
 * Это позволяет держать 300 карт без гигантского switch в движке боя.
 *
 * Числа — заглушки для баланса: арт и финальные цифры будут позже.
 * Цена мощности (power) — бюджет сборки колоды, в бою не используется.
 * Цена энергии (cost) — трата 5 энергии за ход.
 * Апгрейд 1–7: числовые эффекты ×(1 + 0.1×(уровень−1)), цена мощности не меняется.
 */

export type CardKind = 'attack' | 'aoe' | 'heal' | 'shield' | 'debuff' | 'buff' | 'control' | 'utility';
export type CardTarget = 'enemy' | 'merc' | 'allEnemies' | 'allMercs' | 'none';

/** Сет — тематическая группа карт (арт-стиль + фильтр в конструкторе). */
export type CardSet = 'ballistics' | 'engineering' | 'medicine' | 'chemistry' | 'web' | 'tactics' | 'relics';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/** Ключевые слова карт. */
export type Keyword =
  | 'retain' | 'ethereal' | 'innate' | 'combo' | 'xcost'
  | 'echo' | 'revive' | 'transform' | 'overheat' | 'once';

/** Статусы на врагах и наёмниках. */
export type StatusId =
  | 'vuln' | 'weak' | 'stun' | 'burn' | 'poison' | 'bleed' | 'armorBreak' | 'web'
  | 'barrier' | 'regen' | 'thorns' | 'taunt' | 'dodge' | 'cleanse' | 'healDown' | 'armorDown';

export type Effect =
  | {
      t: 'damage';
      v: number;
      /** Сколько ударов. */
      hits?: number;
      /** Цель: один враг (по умолчанию), все враги, случайный враг. */
      target?: 'enemy' | 'allEnemies' | 'randomEnemy';
      /** Игнорирует броню. */
      pierce?: boolean;
    }
  | { t: 'heal'; v: number; target?: 'merc' | 'allMercs' | 'front' }
  | { t: 'shield'; v: number; target?: 'merc' | 'allMercs' | 'front'; woundedBonus?: number }
  | { t: 'maxArmor'; v: number; target?: 'merc' | 'allMercs' }
  | {
      t: 'status';
      on: 'enemy' | 'allEnemies' | 'randomEnemy' | 'merc' | 'allMercs';
      id: StatusId;
      /** Сила статуса (урон горения/яда, барьер, шипы…). */
      v?: number;
      /** Длительность в ходах. */
      turns?: number;
    }
  | { t: 'draw'; v: number }
  | { t: 'energy'; v: number }
  | { t: 'discard'; v: number }
  | { t: 'scry'; v: number }
  /** Поднимает павшего наёмника с долей HP `v` (0.5 = 50%). */
  | { t: 'revive'; v: number }
  /** Превращает `v` случайных карт в руке в другие карты. */
  | { t: 'transform'; v: number };

/** Патч карты на 4-м / 7-м уровне. */
export interface LevelPatch extends Partial<Omit<CardDef, 'effects' | 'l4' | 'l7'>> {
  /** Добавить эффекты к базовым. */
  add?: Effect[];
  /** Полностью заменить список эффектов. */
  replaceEffects?: Effect[];
}

export interface CardDef {
  id: string;
  name: string;
  set: CardSet;
  rarity: Rarity;
  kind: CardKind;
  /** Цена сборки колоды. */
  power: number;
  /** Цена в бою (0..5). */
  cost: number;
  target: CardTarget;
  icon: string;
  effects: Effect[];
  keywords?: Keyword[];
  /** Порог казни (доля HP цели). */
  exec?: number;
  execMult?: number;
  /** Бонус, если у цели меньше 50% HP. */
  bonusLow?: number;
  /** Бонус по элите/боссу. */
  bonusBoss?: number;
  /** Шанс крита, % — урон карты ×critMult. */
  critChance?: number;
  critMult?: number;
  /** Шанс ярости, % — +rageMult к урону наёмников до конца боя. */
  rageChance?: number;
  rageMult?: number;
  /** Доп. эффекты, если в этот ход уже сыграна карта. */
  combo?: Effect[];
  /** Тратит всю энергию; числа эффектов умножаются на потраченную энергию. */
  xcost?: boolean;
  /** +N урона за каждое предыдущее применение в этом бою. */
  overheat?: number;
  /** Можно сыграть только один раз за бой: после игры все копии изгоняются. */
  once?: boolean;
  /** Изгоняется после игры. */
  exhaust?: boolean;
  /** Ручной оверрайд текста (иначе собирается из effects). */
  text?: string;
  add4?: string;
  add7?: string;
  l4?: LevelPatch;
  l7?: LevelPatch;
  /** Арт карты (пока нет — процедурная заглушка). */
  art?: string;
}

export const MAX_CARD_LEVEL = 7;
/** Лимит колоды: при переполнении предлагаем заменить карту. */
export const MAX_DECK = 25;

export const RARITY_META: Record<Rarity, { label: string; color: string }> = {
  common: { label: 'Обычная', color: '#9ca3af' },
  uncommon: { label: 'Необычная', color: '#4ade80' },
  rare: { label: 'Редкая', color: '#38bdf8' },
  epic: { label: 'Эпическая', color: '#c084fc' },
  legendary: { label: 'Легендарная', color: '#fbbf24' },
};

export const SET_META: Record<CardSet, { label: string; color: string; icon: string }> = {
  ballistics: { label: 'Баллистика', color: '#f97316', icon: '🎯' },
  engineering: { label: 'Инженерия', color: '#38bdf8', icon: '🔧' },
  medicine: { label: 'Медицина', color: '#4ade80', icon: '💉' },
  chemistry: { label: 'Химия', color: '#a3e635', icon: '⚗️' },
  web: { label: 'Паутина', color: '#c084fc', icon: '🕸️' },
  tactics: { label: 'Тактика', color: '#fbbf24', icon: '📢' },
  relics: { label: 'Реликвии улья', color: '#f472b6', icon: '🏺' },
};

const CARD_LIST: CardDef[] = [
  // -------------------------------------------------------------------------
  // Баллистика
  // -------------------------------------------------------------------------
  {
    id: 'shot', name: 'Короткая очередь', set: 'ballistics', rarity: 'common', kind: 'attack',
    power: 50, cost: 1, target: 'enemy', icon: '🔫',
    effects: [{ t: 'damage', v: 10 }],
    l4: { add: [{ t: 'status', on: 'enemy', id: 'vuln', turns: 1 }] },
    l7: { replaceEffects: [{ t: 'damage', v: 10 }, { t: 'status', on: 'enemy', id: 'vuln', turns: 2 }] },
  },
  {
    id: 'snipe', name: 'Прицельный выстрел', set: 'ballistics', rarity: 'uncommon', kind: 'attack',
    power: 75, cost: 1, target: 'enemy', icon: '🎯',
    effects: [{ t: 'damage', v: 14 }],
    bonusLow: 6,
    l7: { add: [{ t: 'status', on: 'enemy', id: 'vuln', turns: 1 }] },
  },
  {
    id: 'shotgun', name: 'Дробовик в упор', set: 'ballistics', rarity: 'uncommon', kind: 'attack',
    power: 125, cost: 2, target: 'enemy', icon: '💥',
    effects: [{ t: 'damage', v: 26 }],
  },
  {
    id: 'heavy', name: 'Крупный калибр', set: 'ballistics', rarity: 'rare', kind: 'attack',
    power: 125, cost: 2, target: 'enemy', icon: '🪓',
    effects: [{ t: 'damage', v: 20 }],
    bonusBoss: 8,
    l7: { add: [{ t: 'status', on: 'enemy', id: 'weak', turns: 1 }] },
  },
  {
    id: 'grenade', name: 'Граната', set: 'ballistics', rarity: 'uncommon', kind: 'aoe',
    power: 150, cost: 2, target: 'allEnemies', icon: '🧨',
    effects: [{ t: 'damage', v: 14, target: 'allEnemies' }],
    l7: { add: [{ t: 'status', on: 'allEnemies', id: 'vuln', turns: 1 }] },
  },
  {
    id: 'burst', name: 'Шквал', set: 'ballistics', rarity: 'rare', kind: 'attack',
    power: 200, cost: 3, target: 'enemy', icon: '🌀',
    effects: [{ t: 'damage', v: 42 }],
    l7: { add: [{ t: 'draw', v: 1 }] },
  },
  {
    id: 'execute', name: 'Казнь', set: 'ballistics', rarity: 'epic', kind: 'attack',
    power: 200, cost: 3, target: 'enemy', icon: '☠️',
    effects: [{ t: 'damage', v: 30 }],
    exec: 0.3, execMult: 2,
    l4: { exec: 0.35 },
    l7: { exec: 0.4 },
  },
  {
    id: 'tracers', name: 'Трассеры', set: 'ballistics', rarity: 'uncommon', kind: 'attack',
    power: 100, cost: 2, target: 'enemy', icon: '✳️',
    effects: [{ t: 'damage', v: 8, hits: 3 }],
    l7: { replaceEffects: [{ t: 'damage', v: 8, hits: 4 }] },
  },
  {
    id: 'overload', name: 'Перегрузка', set: 'engineering', rarity: 'rare', kind: 'aoe',
    power: 200, cost: 3, target: 'allEnemies', icon: '⚡',
    effects: [{ t: 'damage', v: 20, target: 'allEnemies' }],
    exhaust: true,
  },
  {
    id: 'flashbang', name: 'Оглушающая граната', set: 'ballistics', rarity: 'uncommon', kind: 'aoe',
    power: 150, cost: 2, target: 'allEnemies', icon: '💫',
    effects: [
      { t: 'damage', v: 8, target: 'allEnemies' },
      { t: 'status', on: 'randomEnemy', id: 'stun', turns: 1 },
    ],
    l7: {
      replaceEffects: [
        { t: 'damage', v: 8, target: 'allEnemies' },
        { t: 'status', on: 'randomEnemy', id: 'stun', turns: 2 },
      ],
    },
  },
  {
    id: 'headshot', name: 'Выстрел в голову', set: 'ballistics', rarity: 'common', kind: 'attack',
    power: 90, cost: 1, target: 'enemy', icon: '🩸',
    effects: [{ t: 'damage', v: 12 }],
    critChance: 10, critMult: 2,
  },

  // -------------------------------------------------------------------------
  // Тактика
  // -------------------------------------------------------------------------
  {
    id: 'dash', name: 'Рывок', set: 'tactics', rarity: 'common', kind: 'attack',
    power: 100, cost: 1, target: 'enemy', icon: '🏃',
    effects: [{ t: 'damage', v: 12 }, { t: 'shield', v: 10, target: 'front' }],
  },
  {
    id: 'mark', name: 'Метка снайпера', set: 'tactics', rarity: 'common', kind: 'debuff',
    power: 50, cost: 0, target: 'enemy', icon: '🔻',
    effects: [{ t: 'status', on: 'enemy', id: 'vuln', turns: 2 }],
    l4: { replaceEffects: [{ t: 'status', on: 'enemy', id: 'vuln', turns: 3 }] },
    l7: { add: [{ t: 'draw', v: 1 }] },
  },
  {
    id: 'smoke', name: 'Дымовая завеса', set: 'chemistry', rarity: 'common', kind: 'debuff',
    power: 100, cost: 1, target: 'allEnemies', icon: '🌫️',
    effects: [{ t: 'status', on: 'allEnemies', id: 'weak', turns: 2 }],
    l7: { add: [{ t: 'damage', v: 6, target: 'allEnemies' }] },
  },
  {
    id: 'cover', name: 'Прикрытие', set: 'tactics', rarity: 'common', kind: 'shield',
    power: 75, cost: 1, target: 'merc', icon: '🛡️',
    effects: [{ t: 'shield', v: 25, target: 'merc' }],
    l7: { add: [{ t: 'maxArmor', v: 5, target: 'merc' }] },
  },
  {
    id: 'lastStand', name: 'Последний рубеж', set: 'tactics', rarity: 'rare', kind: 'shield',
    power: 150, cost: 2, target: 'merc', icon: '🪨',
    effects: [{ t: 'shield', v: 50, target: 'merc', woundedBonus: 25 }],
    l7: { add: [{ t: 'maxArmor', v: 5, target: 'merc' }] },
  },
  {
    id: 'order', name: 'Тактический приказ', set: 'tactics', rarity: 'rare', kind: 'utility',
    power: 100, cost: 0, target: 'none', icon: '📢',
    effects: [{ t: 'energy', v: 1 }, { t: 'draw', v: 1 }],
    l4: { replaceEffects: [{ t: 'energy', v: 1 }, { t: 'draw', v: 2 }] },
    l7: { replaceEffects: [{ t: 'energy', v: 2 }, { t: 'draw', v: 2 }] },
  },
  {
    id: 'scout', name: 'Разведка', set: 'tactics', rarity: 'common', kind: 'utility',
    power: 75, cost: 1, target: 'none', icon: '🔭',
    effects: [{ t: 'draw', v: 2 }],
    l4: { replaceEffects: [{ t: 'draw', v: 3 }] },
    l7: { add: [{ t: 'energy', v: 1 }] },
  },
  {
    id: 'berserk', name: 'Удар берсерка', set: 'tactics', rarity: 'uncommon', kind: 'attack',
    power: 150, cost: 2, target: 'enemy', icon: '🪓',
    effects: [{ t: 'damage', v: 22 }],
    rageChance: 25, rageMult: 0.1,
  },

  // -------------------------------------------------------------------------
  // Инженерия / Медицина
  // -------------------------------------------------------------------------
  {
    id: 'repair', name: 'Ремонт брони', set: 'engineering', rarity: 'common', kind: 'heal',
    power: 100, cost: 1, target: 'merc', icon: '🔧',
    effects: [{ t: 'heal', v: 28, target: 'merc' }],
    l7: { add: [{ t: 'draw', v: 1 }] },
  },
  {
    id: 'stim', name: 'Стимулятор', set: 'medicine', rarity: 'uncommon', kind: 'heal',
    power: 125, cost: 1, target: 'merc', icon: '💉',
    effects: [{ t: 'heal', v: 18, target: 'merc' }, { t: 'draw', v: 1 }],
    l7: { replaceEffects: [{ t: 'heal', v: 18, target: 'merc' }, { t: 'draw', v: 2 }] },
  },
  {
    id: 'medkit', name: 'Медпакет', set: 'medicine', rarity: 'uncommon', kind: 'heal',
    power: 150, cost: 2, target: 'allMercs', icon: '🧰',
    effects: [{ t: 'heal', v: 16, target: 'allMercs' }],
    l7: { add: [{ t: 'draw', v: 1 }] },
  },

  // =========================================================================
  // Пул II: 78 карт. id совпадают с промтами в docs/dungeon-card-prompts.md.
  // =========================================================================

  // -------------------------------------------------------------------------
  // Баллистика
  // -------------------------------------------------------------------------
  {
    id: 'suppressive', name: 'Подавление', set: 'ballistics', rarity: 'common', kind: 'debuff',
    power: 90, cost: 1, target: 'allEnemies', icon: '🔻',
    effects: [
      { t: 'damage', v: 5, target: 'allEnemies' },
      { t: 'status', on: 'allEnemies', id: 'weak', turns: 2 },
    ],
    l7: { add: [{ t: 'status', on: 'allEnemies', id: 'weak', turns: 1 }] },
  },
  {
    id: 'ricochet', name: 'Рикошет', set: 'ballistics', rarity: 'common', kind: 'attack',
    power: 90, cost: 1, target: 'enemy', icon: '↩️',
    effects: [
      { t: 'damage', v: 9 },
      { t: 'damage', v: 6, target: 'randomEnemy' },
    ],
    l4: { add: [{ t: 'damage', v: 4, target: 'randomEnemy' }] },
  },
  {
    id: 'ammoCrate', name: 'Ящик патронов', set: 'ballistics', rarity: 'common', kind: 'utility',
    power: 60, cost: 0, target: 'none', icon: '📦',
    effects: [{ t: 'draw', v: 2 }],
    exhaust: true,
    l7: { add: [{ t: 'energy', v: 1 }] },
  },
  {
    id: 'pierceRound', name: 'Бронебойный', set: 'ballistics', rarity: 'uncommon', kind: 'debuff',
    power: 110, cost: 1, target: 'enemy', icon: '🎯',
    effects: [
      { t: 'damage', v: 12, pierce: true },
      { t: 'status', on: 'enemy', id: 'armorBreak', turns: 2 },
    ],
    l7: { add: [{ t: 'damage', v: 6, pierce: true }] },
  },
  {
    id: 'gunnerTrance', name: 'Транс стрелка', set: 'ballistics', rarity: 'uncommon', kind: 'buff',
    power: 110, cost: 1, target: 'allEnemies', icon: '🌀',
    effects: [
      { t: 'status', on: 'allEnemies', id: 'vuln', turns: 2 },
      { t: 'draw', v: 1 },
    ],
    l7: { add: [{ t: 'status', on: 'allEnemies', id: 'vuln', turns: 1 }] },
  },
  {
    id: 'fragStorm', name: 'Осколочный шторм', set: 'ballistics', rarity: 'rare', kind: 'aoe',
    power: 170, cost: 3, target: 'allEnemies', icon: '💣',
    effects: [
      { t: 'damage', v: 10, target: 'allEnemies' },
      { t: 'status', on: 'allEnemies', id: 'bleed', v: 3 },
    ],
    l7: { add: [{ t: 'damage', v: 5, target: 'allEnemies' }] },
  },

  // -------------------------------------------------------------------------
  // Инженерия
  // -------------------------------------------------------------------------
  {
    id: 'plateWeld', name: 'Наварка брони', set: 'engineering', rarity: 'common', kind: 'shield',
    power: 90, cost: 1, target: 'merc', icon: '🛠️',
    effects: [
      { t: 'shield', v: 18, target: 'merc' },
      { t: 'maxArmor', v: 3, target: 'merc' },
    ],
    once: true,
    keywords: ['once'],
  },
  {
    id: 'capacitor', name: 'Конденсатор', set: 'engineering', rarity: 'common', kind: 'utility',
    power: 50, cost: 0, target: 'none', icon: '🔋',
    effects: [{ t: 'energy', v: 1 }],
    exhaust: true,
    l7: { add: [{ t: 'draw', v: 1 }] },
  },
  {
    id: 'reroute', name: 'Перекоммутация', set: 'engineering', rarity: 'common', kind: 'utility',
    power: 75, cost: 0, target: 'none', icon: '🔌',
    effects: [{ t: 'energy', v: 1 }, { t: 'draw', v: 1 }],
    exhaust: true,
  },
  {
    id: 'arcWelder', name: 'Дуговая сварка', set: 'engineering', rarity: 'common', kind: 'attack',
    power: 80, cost: 1, target: 'enemy', icon: '⚡',
    effects: [
      { t: 'damage', v: 11 },
      { t: 'status', on: 'enemy', id: 'armorBreak', turns: 1 },
    ],
  },
  {
    id: 'overclock', name: 'Разгон', set: 'engineering', rarity: 'common', kind: 'buff',
    power: 90, cost: 1, target: 'none', icon: '⚙️',
    effects: [{ t: 'energy', v: 2 }],
    exhaust: true,
  },
  {
    id: 'turret', name: 'Турель', set: 'engineering', rarity: 'uncommon', kind: 'attack',
    power: 130, cost: 2, target: 'enemy', icon: '🔫',
    effects: [{ t: 'damage', v: 8, hits: 3 }],
    l7: { add: [{ t: 'status', on: 'enemy', id: 'armorBreak', turns: 2 }] },
  },
  {
    id: 'servoBoost', name: 'Сервоусиление', set: 'engineering', rarity: 'uncommon', kind: 'buff',
    power: 120, cost: 1, target: 'merc', icon: '🦾',
    effects: [
      { t: 'shield', v: 15, target: 'merc' },
      { t: 'status', on: 'merc', id: 'thorns', v: 6 },
    ],
    once: true,
    keywords: ['once'],
  },
  {
    id: 'drone', name: 'Дрон-разведчик', set: 'engineering', rarity: 'uncommon', kind: 'utility',
    power: 100, cost: 1, target: 'none', icon: '🛸',
    effects: [{ t: 'draw', v: 3 }],
    exhaust: true,
  },
  {
    id: 'aegisField', name: 'Поле «Эгида»', set: 'engineering', rarity: 'rare', kind: 'shield',
    power: 160, cost: 2, target: 'allMercs', icon: '🔵',
    effects: [{ t: 'shield', v: 30, target: 'allMercs' }],
    l7: { add: [{ t: 'status', on: 'allMercs', id: 'barrier', v: 10 }] },
  },
  {
    id: 'teslaCoil', name: 'Катушка Теслы', set: 'engineering', rarity: 'rare', kind: 'aoe',
    power: 165, cost: 2, target: 'allEnemies', icon: '🌩️',
    effects: [
      { t: 'damage', v: 11, target: 'allEnemies' },
      { t: 'status', on: 'randomEnemy', id: 'stun', turns: 1 },
    ],
  },
  {
    id: 'bulwark', name: 'Бастион', set: 'engineering', rarity: 'rare', kind: 'shield',
    power: 180, cost: 3, target: 'allMercs', icon: '🧱',
    effects: [
      { t: 'shield', v: 35, target: 'allMercs' },
      { t: 'maxArmor', v: 5, target: 'allMercs' },
    ],
    once: true,
    keywords: ['once'],
  },
  {
    id: 'scrapNova', name: 'Шквал шрапнели', set: 'engineering', rarity: 'epic', kind: 'aoe',
    power: 200, cost: 3, target: 'allEnemies', icon: '💥',
    effects: [{ t: 'damage', v: 22, target: 'allEnemies' }],
    exhaust: true,
  },

  // -------------------------------------------------------------------------
  // Медицина
  // -------------------------------------------------------------------------
  {
    id: 'triage', name: 'Сортировка', set: 'medicine', rarity: 'common', kind: 'heal',
    power: 80, cost: 0, target: 'allMercs', icon: '🏷️',
    effects: [{ t: 'heal', v: 10, target: 'allMercs' }],
    l7: { add: [{ t: 'status', on: 'allMercs', id: 'cleanse' }] },
  },
  {
    id: 'painkiller', name: 'Обезболивающее', set: 'medicine', rarity: 'common', kind: 'buff',
    power: 60, cost: 0, target: 'merc', icon: '💊',
    effects: [{ t: 'status', on: 'merc', id: 'barrier', v: 12 }],
    l7: { add: [{ t: 'status', on: 'merc', id: 'cleanse' }] },
  },
  {
    id: 'antidote', name: 'Противоядие', set: 'medicine', rarity: 'common', kind: 'utility',
    power: 55, cost: 0, target: 'allMercs', icon: '🧪',
    effects: [{ t: 'status', on: 'allMercs', id: 'cleanse' }],
    exhaust: true,
  },
  {
    id: 'sterileField', name: 'Стерильное поле', set: 'medicine', rarity: 'common', kind: 'shield',
    power: 90, cost: 1, target: 'allMercs', icon: '🟢',
    effects: [
      { t: 'shield', v: 12, target: 'allMercs' },
      { t: 'status', on: 'allMercs', id: 'cleanse' },
    ],
  },
  {
    id: 'narcosis', name: 'Наркоз', set: 'medicine', rarity: 'uncommon', kind: 'debuff',
    power: 120, cost: 1, target: 'enemy', icon: '😴',
    effects: [
      { t: 'status', on: 'enemy', id: 'stun', turns: 1 },
      { t: 'status', on: 'enemy', id: 'weak', turns: 2 },
    ],
    l7: { replaceEffects: [
      { t: 'status', on: 'enemy', id: 'stun', turns: 2 },
      { t: 'status', on: 'enemy', id: 'weak', turns: 2 },
    ] },
  },
  {
    id: 'transfusion', name: 'Переливание', set: 'medicine', rarity: 'uncommon', kind: 'heal',
    power: 125, cost: 2, target: 'merc', icon: '🩸',
    effects: [{ t: 'heal', v: 40, target: 'merc' }],
    l7: { add: [{ t: 'heal', v: 12, target: 'merc' }] },
  },
  {
    id: 'adrenaline', name: 'Адреналин', set: 'medicine', rarity: 'uncommon', kind: 'heal',
    power: 130, cost: 1, target: 'merc', icon: '💉',
    effects: [
      { t: 'heal', v: 12, target: 'merc' },
      { t: 'energy', v: 1 },
      { t: 'draw', v: 1 },
    ],
    exhaust: true,
  },
  {
    id: 'regenSerum', name: 'Сыворотка регенерации', set: 'medicine', rarity: 'rare', kind: 'buff',
    power: 140, cost: 1, target: 'merc', icon: '🧬',
    effects: [{ t: 'status', on: 'merc', id: 'regen', v: 8, turns: 3 }],
    l7: { add: [{ t: 'status', on: 'merc', id: 'regen', v: 4, turns: 2 }] },
  },
  {
    id: 'fieldSurgery', name: 'Полевая хирургия', set: 'medicine', rarity: 'epic', kind: 'heal',
    power: 190, cost: 2, target: 'merc', icon: '🔪',
    effects: [{ t: 'heal', v: 55, target: 'merc' }],
    exhaust: true,
    l7: { add: [{ t: 'status', on: 'merc', id: 'cleanse' }] },
  },
  {
    id: 'vitaChamber', name: 'Вита-камера', set: 'medicine', rarity: 'legendary', kind: 'heal',
    power: 250, cost: 3, target: 'allMercs', icon: '🛏️',
    effects: [
      { t: 'revive', v: 0.5 },
      { t: 'heal', v: 25, target: 'allMercs' },
    ],
    exhaust: true,
  },

  // -------------------------------------------------------------------------
  // Химия
  // -------------------------------------------------------------------------
  {
    id: 'acidFlask', name: 'Кислотная колба', set: 'chemistry', rarity: 'common', kind: 'attack',
    power: 85, cost: 1, target: 'enemy', icon: '🧫',
    effects: [
      { t: 'damage', v: 8 },
      { t: 'status', on: 'enemy', id: 'poison', v: 3 },
    ],
  },
  {
    id: 'bleedCutter', name: 'Кровопуск', set: 'chemistry', rarity: 'common', kind: 'debuff',
    power: 80, cost: 1, target: 'enemy', icon: '🗡️',
    effects: [
      { t: 'damage', v: 6 },
      { t: 'status', on: 'enemy', id: 'bleed', v: 4 },
    ],
    l7: { add: [{ t: 'status', on: 'enemy', id: 'bleed', v: 2 }] },
  },
  {
    id: 'solvent', name: 'Растворитель', set: 'chemistry', rarity: 'common', kind: 'utility',
    power: 75, cost: 0, target: 'allEnemies', icon: '🫗',
    effects: [{ t: 'status', on: 'allEnemies', id: 'web', turns: 2 }],
    l7: { add: [{ t: 'draw', v: 1 }] },
  },
  {
    id: 'blister', name: 'Волдырь', set: 'chemistry', rarity: 'common', kind: 'debuff',
    power: 90, cost: 1, target: 'enemy', icon: '🟡',
    effects: [
      { t: 'status', on: 'enemy', id: 'weak', turns: 2 },
      { t: 'status', on: 'enemy', id: 'poison', v: 3 },
    ],
  },
  {
    id: 'burnMix', name: 'Горючая смесь', set: 'chemistry', rarity: 'common', kind: 'attack',
    power: 90, cost: 1, target: 'enemy', icon: '🔥',
    effects: [
      { t: 'damage', v: 9 },
      { t: 'status', on: 'enemy', id: 'burn', v: 4 },
    ],
  },
  {
    id: 'venom', name: 'Яд', set: 'chemistry', rarity: 'uncommon', kind: 'debuff',
    power: 105, cost: 1, target: 'enemy', icon: '☠️',
    effects: [{ t: 'status', on: 'enemy', id: 'poison', v: 7 }],
    l7: { add: [{ t: 'status', on: 'enemy', id: 'poison', v: 3 }] },
  },
  {
    id: 'corrosion', name: 'Коррозия', set: 'chemistry', rarity: 'uncommon', kind: 'debuff',
    power: 110, cost: 1, target: 'enemy', icon: '🧪',
    effects: [
      { t: 'status', on: 'enemy', id: 'armorBreak', turns: 3 },
      { t: 'status', on: 'enemy', id: 'vuln', turns: 2 },
    ],
  },
  {
    id: 'toxinCloud', name: 'Токсичное облако', set: 'chemistry', rarity: 'uncommon', kind: 'aoe',
    power: 130, cost: 2, target: 'allEnemies', icon: '☁️',
    effects: [{ t: 'status', on: 'allEnemies', id: 'poison', v: 4 }],
    l7: { add: [{ t: 'status', on: 'allEnemies', id: 'weak', turns: 1 }] },
  },
  {
    id: 'catalyst', name: 'Катализатор', set: 'chemistry', rarity: 'rare', kind: 'buff',
    power: 135, cost: 0, target: 'allEnemies', icon: '⚗️',
    effects: [
      { t: 'status', on: 'allEnemies', id: 'poison', v: 3 },
      { t: 'draw', v: 1 },
    ],
    exhaust: true,
  },
  {
    id: 'napalm', name: 'Напалм', set: 'chemistry', rarity: 'rare', kind: 'aoe',
    power: 175, cost: 2, target: 'allEnemies', icon: '🔥',
    effects: [
      { t: 'damage', v: 6, target: 'allEnemies' },
      { t: 'status', on: 'allEnemies', id: 'burn', v: 5 },
    ],
  },
  {
    id: 'gasGrenade', name: 'Газ в окоп', set: 'chemistry', rarity: 'epic', kind: 'aoe',
    power: 200, cost: 3, target: 'allEnemies', icon: '💨',
    effects: [
      { t: 'status', on: 'allEnemies', id: 'poison', v: 6 },
      { t: 'status', on: 'allEnemies', id: 'weak', turns: 2 },
    ],
  },
  {
    id: 'volatileBrew', name: 'Нестабильная смесь', set: 'chemistry', rarity: 'epic', kind: 'aoe',
    power: 210, cost: 2, target: 'allEnemies', icon: '💥',
    effects: [
      { t: 'damage', v: 16, target: 'allEnemies' },
      { t: 'status', on: 'allEnemies', id: 'burn', v: 6 },
    ],
    exhaust: true,
  },

  // -------------------------------------------------------------------------
  // Паутина
  // -------------------------------------------------------------------------
  {
    id: 'webShot', name: 'Паутина', set: 'web', rarity: 'common', kind: 'control',
    power: 70, cost: 1, target: 'enemy', icon: '🕸️',
    effects: [{ t: 'status', on: 'enemy', id: 'web', turns: 2 }],
    l7: { add: [{ t: 'status', on: 'enemy', id: 'web', turns: 1 }] },
  },
  {
    id: 'chitinPlate', name: 'Хитиновая пластина', set: 'web', rarity: 'common', kind: 'shield',
    power: 85, cost: 1, target: 'merc', icon: '🪲',
    effects: [{ t: 'maxArmor', v: 8, target: 'merc' }],
    l7: { add: [{ t: 'shield', v: 10, target: 'merc' }] },
    once: true,
    keywords: ['once'],
  },
  {
    id: 'venomBite', name: 'Укус', set: 'web', rarity: 'common', kind: 'attack',
    power: 85, cost: 1, target: 'enemy', icon: '🦷',
    effects: [
      { t: 'damage', v: 8 },
      { t: 'status', on: 'enemy', id: 'poison', v: 3 },
    ],
  },
  {
    id: 'silkSnare', name: 'Силки', set: 'web', rarity: 'common', kind: 'control',
    power: 90, cost: 1, target: 'allEnemies', icon: '🧶',
    effects: [{ t: 'status', on: 'allEnemies', id: 'web', turns: 1 }],
    l7: { add: [{ t: 'status', on: 'allEnemies', id: 'web', turns: 1 }] },
  },
  {
    id: 'eggSac', name: 'Кокон с яйцами', set: 'web', rarity: 'common', kind: 'utility',
    power: 90, cost: 1, target: 'allMercs', icon: '🥚',
    effects: [
      { t: 'heal', v: 10, target: 'allMercs' },
      { t: 'draw', v: 1 },
    ],
  },
  {
    id: 'silkWhip', name: 'Шёлковый хлыст', set: 'web', rarity: 'uncommon', kind: 'attack',
    power: 105, cost: 1, target: 'enemy', icon: '🪢',
    effects: [
      { t: 'damage', v: 10 },
      { t: 'status', on: 'enemy', id: 'weak', turns: 1 },
    ],
  },
  {
    id: 'molt', name: 'Линька', set: 'web', rarity: 'uncommon', kind: 'utility',
    power: 115, cost: 1, target: 'allMercs', icon: '🐚',
    effects: [
      { t: 'status', on: 'allMercs', id: 'cleanse' },
      { t: 'shield', v: 14, target: 'allMercs' },
    ],
    exhaust: true,
  },
  {
    id: 'spinneret', name: 'Прядильный орган', set: 'web', rarity: 'uncommon', kind: 'attack',
    power: 130, cost: 2, target: 'enemy', icon: '🕷️',
    effects: [
      { t: 'damage', v: 11, pierce: true },
      { t: 'status', on: 'enemy', id: 'web', turns: 2 },
    ],
  },
  {
    id: 'cocoon', name: 'Кокон', set: 'web', rarity: 'rare', kind: 'control',
    power: 150, cost: 2, target: 'enemy', icon: '🪤',
    effects: [{ t: 'status', on: 'enemy', id: 'stun', turns: 2 }],
    l7: { add: [{ t: 'status', on: 'enemy', id: 'web', turns: 2 }] },
  },
  {
    id: 'webWall', name: 'Паутинная стена', set: 'web', rarity: 'rare', kind: 'control',
    power: 160, cost: 2, target: 'allEnemies', icon: '🧱',
    effects: [
      { t: 'shield', v: 24, target: 'allMercs' },
      { t: 'status', on: 'allEnemies', id: 'web', turns: 1 },
    ],
  },
  {
    id: 'broodCall', name: 'Зов выводка', set: 'web', rarity: 'rare', kind: 'utility',
    power: 150, cost: 1, target: 'none', icon: '📣',
    effects: [{ t: 'draw', v: 2 }, { t: 'energy', v: 1 }],
    exhaust: true,
  },
  {
    id: 'spiderSense', name: 'Паучье чутьё', set: 'web', rarity: 'rare', kind: 'buff',
    power: 155, cost: 1, target: 'merc', icon: '👁️',
    effects: [
      { t: 'status', on: 'merc', id: 'dodge', v: 30, turns: 2 },
      { t: 'draw', v: 1 },
    ],
  },
  {
    id: 'weaverCurse', name: 'Проклятие ткача', set: 'web', rarity: 'epic', kind: 'debuff',
    power: 195, cost: 2, target: 'enemy', icon: '🕸️',
    effects: [
      { t: 'status', on: 'enemy', id: 'vuln', turns: 3 },
      { t: 'status', on: 'enemy', id: 'weak', turns: 3 },
      { t: 'status', on: 'enemy', id: 'web', turns: 2 },
    ],
  },
  {
    id: 'queenWill', name: 'Воля матки', set: 'web', rarity: 'epic', kind: 'buff',
    power: 205, cost: 3, target: 'allMercs', icon: '👑',
    effects: [
      { t: 'status', on: 'allMercs', id: 'thorns', v: 8 },
      { t: 'maxArmor', v: 8, target: 'allMercs' },
    ],
    once: true,
    keywords: ['once'],
  },

  // -------------------------------------------------------------------------
  // Тактика
  // -------------------------------------------------------------------------
  {
    id: 'warCry', name: 'Боевой клич', set: 'tactics', rarity: 'common', kind: 'buff',
    power: 70, cost: 0, target: 'allEnemies', icon: '📢',
    effects: [{ t: 'status', on: 'allEnemies', id: 'weak', turns: 1 }],
    l7: { add: [{ t: 'status', on: 'allEnemies', id: 'weak', turns: 1 }] },
  },
  {
    id: 'flank', name: 'Обход', set: 'tactics', rarity: 'common', kind: 'attack',
    power: 90, cost: 1, target: 'enemy', icon: '🗡️',
    effects: [
      { t: 'damage', v: 8 },
      { t: 'status', on: 'enemy', id: 'vuln', turns: 2 },
    ],
  },
  {
    id: 'rally', name: 'Перегруппировка', set: 'tactics', rarity: 'common', kind: 'buff',
    power: 90, cost: 1, target: 'allMercs', icon: '🚩',
    effects: [
      { t: 'maxArmor', v: 4, target: 'allMercs' },
      { t: 'heal', v: 8, target: 'allMercs' },
    ],
    once: true,
    keywords: ['once'],
  },
  {
    id: 'retreat', name: 'Отход', set: 'tactics', rarity: 'uncommon', kind: 'utility',
    power: 110, cost: 1, target: 'allMercs', icon: '🏃',
    effects: [
      { t: 'shield', v: 18, target: 'allMercs' },
      { t: 'draw', v: 1 },
    ],
  },
  {
    id: 'volley', name: 'Залп', set: 'tactics', rarity: 'uncommon', kind: 'attack',
    power: 130, cost: 2, target: 'enemy', icon: '🎇',
    effects: [{ t: 'damage', v: 7, hits: 4 }],
  },
  {
    id: 'focusFire', name: 'Сосредоточенный огонь', set: 'tactics', rarity: 'rare', kind: 'attack',
    power: 170, cost: 2, target: 'enemy', icon: '🎯',
    effects: [{ t: 'damage', v: 12, hits: 3 }],
    l7: { add: [{ t: 'status', on: 'enemy', id: 'vuln', turns: 2 }] },
  },
  {
    id: 'ambush', name: 'Засада', set: 'tactics', rarity: 'rare', kind: 'attack',
    power: 175, cost: 2, target: 'enemy', icon: '🌑',
    effects: [{ t: 'damage', v: 20 }],
    critChance: 25, critMult: 2,
  },
  {
    id: 'phalanx', name: 'Фаланга', set: 'tactics', rarity: 'epic', kind: 'shield',
    power: 195, cost: 2, target: 'allMercs', icon: '🛡️',
    effects: [
      { t: 'shield', v: 26, target: 'allMercs' },
      { t: 'status', on: 'allMercs', id: 'thorns', v: 4 },
    ],
    once: true,
    keywords: ['once'],
  },
  {
    id: 'commander', name: 'Командир', set: 'tactics', rarity: 'epic', kind: 'buff',
    power: 205, cost: 2, target: 'allMercs', icon: '🎖️',
    effects: [
      { t: 'energy', v: 2 },
      { t: 'draw', v: 2 },
      { t: 'maxArmor', v: 4, target: 'allMercs' },
    ],
    exhaust: true,
    once: true,
    keywords: ['once'],
  },

  // -------------------------------------------------------------------------
  // Реликвии улья
  // -------------------------------------------------------------------------
  {
    id: 'amberShard', name: 'Янтарный осколок', set: 'relics', rarity: 'common', kind: 'utility',
    power: 55, cost: 0, target: 'none', icon: '🟠',
    effects: [{ t: 'draw', v: 1 }],
    l7: { add: [{ t: 'energy', v: 1 }] },
  },
  {
    id: 'waxCandle', name: 'Восковая свеча', set: 'relics', rarity: 'common', kind: 'buff',
    power: 65, cost: 0, target: 'allMercs', icon: '🕯️',
    effects: [{ t: 'heal', v: 8, target: 'allMercs' }],
    exhaust: true,
  },
  {
    id: 'huskMask', name: 'Маска пустышки', set: 'relics', rarity: 'common', kind: 'debuff',
    power: 90, cost: 1, target: 'enemy', icon: '🎭',
    effects: [
      { t: 'status', on: 'enemy', id: 'web', turns: 2 },
      { t: 'status', on: 'enemy', id: 'weak', turns: 2 },
    ],
  },
  {
    id: 'pheromone', name: 'Феромон', set: 'relics', rarity: 'common', kind: 'buff',
    power: 95, cost: 1, target: 'allMercs', icon: '🟡',
    effects: [
      { t: 'status', on: 'allMercs', id: 'taunt', turns: 2 },
      { t: 'shield', v: 10, target: 'allMercs' },
    ],
  },
  {
    id: 'chitinIdol', name: 'Хитиновый идол', set: 'relics', rarity: 'common', kind: 'buff',
    power: 85, cost: 1, target: 'allMercs', icon: '🗿',
    effects: [{ t: 'status', on: 'allMercs', id: 'thorns', v: 4 }],
    l7: { add: [{ t: 'status', on: 'allMercs', id: 'thorns', v: 3 }] },
    once: true,
    keywords: ['once'],
  },
  {
    id: 'echoChamber', name: 'Эхо-камера', set: 'relics', rarity: 'uncommon', kind: 'aoe',
    power: 120, cost: 1, target: 'allEnemies', icon: '📯',
    effects: [
      { t: 'damage', v: 5, target: 'allEnemies' },
      { t: 'status', on: 'randomEnemy', id: 'stun', turns: 1 },
    ],
  },
  {
    id: 'resinSeal', name: 'Смоляная печать', set: 'relics', rarity: 'uncommon', kind: 'shield',
    power: 120, cost: 1, target: 'merc', icon: '🟤',
    effects: [
      { t: 'shield', v: 20, target: 'merc' },
      { t: 'status', on: 'merc', id: 'barrier', v: 10 },
    ],
  },
  {
    id: 'silkReliquary', name: 'Реликварий шёлка', set: 'relics', rarity: 'uncommon', kind: 'utility',
    power: 115, cost: 1, target: 'none', icon: '📿',
    effects: [{ t: 'draw', v: 2 }, { t: 'scry', v: 2 }],
  },
  {
    id: 'runeCarapace', name: 'Рунный панцирь', set: 'relics', rarity: 'rare', kind: 'shield',
    power: 155, cost: 2, target: 'merc', icon: '🔰',
    effects: [
      { t: 'maxArmor', v: 10, target: 'merc' },
      { t: 'shield', v: 20, target: 'merc' },
    ],
    once: true,
    keywords: ['once'],
  },
  {
    id: 'relicFang', name: 'Реликтовый клык', set: 'relics', rarity: 'rare', kind: 'attack',
    power: 160, cost: 2, target: 'enemy', icon: '🦴',
    effects: [
      { t: 'damage', v: 14, pierce: true },
      { t: 'status', on: 'enemy', id: 'bleed', v: 3 },
    ],
  },
  {
    id: 'hiveMind', name: 'Разум улья', set: 'relics', rarity: 'rare', kind: 'buff',
    power: 175, cost: 2, target: 'none', icon: '🧠',
    effects: [{ t: 'energy', v: 1 }, { t: 'draw', v: 3 }],
    exhaust: true,
  },
  {
    id: 'ancientEgg', name: 'Древнее яйцо', set: 'relics', rarity: 'rare', kind: 'control',
    power: 180, cost: 3, target: 'allEnemies', icon: '🥚',
    effects: [{ t: 'status', on: 'allEnemies', id: 'stun', turns: 1 }],
    exhaust: true,
    l7: { replaceEffects: [{ t: 'status', on: 'allEnemies', id: 'stun', turns: 2 }] },
  },
  {
    id: 'broodHeart', name: 'Сердце выводка', set: 'relics', rarity: 'rare', kind: 'utility',
    power: 185, cost: 2, target: 'allMercs', icon: '❤️',
    effects: [
      { t: 'heal', v: 20, target: 'allMercs' },
      { t: 'energy', v: 1 },
      { t: 'draw', v: 1 },
    ],
    exhaust: true,
  },
  {
    id: 'queensTear', name: 'Слеза матки', set: 'relics', rarity: 'legendary', kind: 'heal',
    power: 250, cost: 2, target: 'allMercs', icon: '💧',
    effects: [
      { t: 'heal', v: 45, target: 'allMercs' },
      { t: 'status', on: 'allMercs', id: 'cleanse' },
    ],
    exhaust: true,
  },
  {
    id: 'rebirth', name: 'Перерождение', set: 'relics', rarity: 'legendary', kind: 'utility',
    power: 250, cost: 3, target: 'allMercs', icon: '🦋',
    effects: [
      { t: 'revive', v: 0.5 },
      { t: 'heal', v: 15, target: 'allMercs' },
    ],
    exhaust: true,
  },

  // =========================================================================
  // Пул III: карты на combo / xcost / echo / overheat / transform.
  // =========================================================================

  {
    id: 'doubleTap', name: 'Двойной выстрел', set: 'ballistics', rarity: 'uncommon', kind: 'attack',
    power: 110, cost: 1, target: 'enemy', icon: '🔫',
    effects: [{ t: 'damage', v: 9 }],
    combo: [{ t: 'damage', v: 9 }],
    keywords: ['combo'],
  },
  {
    id: 'hailOfLead', name: 'Свинцовый град', set: 'ballistics', rarity: 'rare', kind: 'aoe',
    power: 170, cost: 0, target: 'allEnemies', icon: '🌪️',
    effects: [{ t: 'damage', v: 4, target: 'allEnemies' }],
    xcost: true,
    keywords: ['xcost'],
  },
  {
    id: 'lastRound', name: 'Последний патрон', set: 'ballistics', rarity: 'rare', kind: 'attack',
    power: 150, cost: 1, target: 'enemy', icon: '🪙',
    effects: [{ t: 'damage', v: 10 }],
    overheat: 4,
    keywords: ['overheat'],
  },
  {
    id: 'feedbackLoop', name: 'Петля обратной связи', set: 'engineering', rarity: 'rare', kind: 'shield',
    power: 160, cost: 1, target: 'allMercs', icon: '🔁',
    effects: [{ t: 'shield', v: 14, target: 'allMercs' }],
    keywords: ['echo'],
  },
  {
    id: 'naniteSwarm', name: 'Рой нанитов', set: 'engineering', rarity: 'rare', kind: 'heal',
    power: 155, cost: 1, target: 'allMercs', icon: '🦠',
    effects: [{ t: 'heal', v: 10, target: 'allMercs' }],
    overheat: 3,
    keywords: ['overheat'],
  },
  {
    id: 'volatileChain', name: 'Цепная реакция', set: 'chemistry', rarity: 'rare', kind: 'debuff',
    power: 165, cost: 1, target: 'allEnemies', icon: '⛓️',
    effects: [{ t: 'status', on: 'allEnemies', id: 'poison', v: 3 }],
    keywords: ['echo'],
  },
  {
    id: 'silkWeave', name: 'Плетение', set: 'web', rarity: 'rare', kind: 'utility',
    power: 140, cost: 0, target: 'none', icon: '🧵',
    effects: [{ t: 'transform', v: 1 }, { t: 'draw', v: 2 }],
    keywords: ['transform'],
  },
  {
    id: 'endlessWeb', name: 'Бесконечная сеть', set: 'web', rarity: 'uncommon', kind: 'control',
    power: 130, cost: 1, target: 'enemy', icon: '🕸️',
    effects: [{ t: 'status', on: 'enemy', id: 'web', turns: 1 }],
    overheat: 1,
    keywords: ['overheat'],
  },
  {
    id: 'charge', name: 'Натиск', set: 'tactics', rarity: 'uncommon', kind: 'attack',
    power: 120, cost: 1, target: 'enemy', icon: '🐗',
    effects: [{ t: 'damage', v: 11 }],
    combo: [{ t: 'damage', v: 8 }, { t: 'shield', v: 8, target: 'front' }],
    keywords: ['combo'],
  },
  {
    id: 'allIn', name: 'Ва-банк', set: 'tactics', rarity: 'rare', kind: 'attack',
    power: 175, cost: 0, target: 'enemy', icon: '🎲',
    effects: [{ t: 'damage', v: 6 }],
    xcost: true,
    keywords: ['xcost'],
  },
  {
    id: 'echoRelic', name: 'Эхо реликвии', set: 'relics', rarity: 'uncommon', kind: 'attack',
    power: 130, cost: 1, target: 'enemy', icon: '📯',
    effects: [{ t: 'damage', v: 8 }],
    keywords: ['echo'],
  },
  {
    id: 'moltCycle', name: 'Круговорот', set: 'relics', rarity: 'rare', kind: 'utility',
    power: 150, cost: 1, target: 'none', icon: '♻️',
    effects: [{ t: 'transform', v: 2 }, { t: 'draw', v: 1 }],
    keywords: ['transform'],
  },

  // =========================================================================
  // Пул IV: 108 карт (Баллистика, Инженерия, Медицина, Химия).
  // id с префиксом b2_/e2_/m2_/c2_ — гарантированно не пересекаются со старыми.
  // =========================================================================

  // -------------------------------------------------------------------------
  // Баллистика II
  // -------------------------------------------------------------------------
  {
    id: 'b2_snapShot', name: 'Быстрый выстрел', set: 'ballistics', rarity: 'common', kind: 'attack',
    power: 50, cost: 1, target: 'enemy', icon: '🔫',
    effects: [{ t: 'damage', v: 7 }],
  },
  {
    id: 'b2_coverFire', name: 'Огонь на подавление', set: 'ballistics', rarity: 'common', kind: 'debuff',
    power: 85, cost: 1, target: 'allEnemies', icon: '🔻',
    effects: [
      { t: 'damage', v: 4, target: 'allEnemies' },
      { t: 'status', on: 'allEnemies', id: 'weak', turns: 1 },
    ],
  },
  {
    id: 'b2_magSwap', name: 'Смена магазина', set: 'ballistics', rarity: 'common', kind: 'utility',
    power: 55, cost: 0, target: 'none', icon: '🔄',
    effects: [{ t: 'draw', v: 2 }],
    exhaust: true,
  },
  {
    id: 'b2_hollowPoint', name: 'Экспансивная', set: 'ballistics', rarity: 'common', kind: 'attack',
    power: 85, cost: 1, target: 'enemy', icon: '🩸',
    effects: [
      { t: 'damage', v: 9 },
      { t: 'status', on: 'enemy', id: 'bleed', v: 2 },
    ],
  },
  {
    id: 'b2_quickDraw', name: 'Навскидку', set: 'ballistics', rarity: 'common', kind: 'attack',
    power: 70, cost: 1, target: 'enemy', icon: '⚡',
    effects: [{ t: 'damage', v: 6 }, { t: 'draw', v: 1 }],
  },
  {
    id: 'b2_tracerBurst', name: 'Трассерная очередь', set: 'ballistics', rarity: 'common', kind: 'attack',
    power: 80, cost: 1, target: 'enemy', icon: '✨',
    effects: [{ t: 'damage', v: 3, hits: 3 }],
  },
  {
    id: 'b2_smokeRound', name: 'Дымовой патрон', set: 'ballistics', rarity: 'common', kind: 'control',
    power: 80, cost: 1, target: 'enemy', icon: '💨',
    effects: [
      { t: 'damage', v: 5 },
      { t: 'status', on: 'enemy', id: 'web', turns: 1 },
    ],
  },
  {
    id: 'b2_scopeIn', name: 'Прицеливание', set: 'ballistics', rarity: 'common', kind: 'buff',
    power: 70, cost: 1, target: 'enemy', icon: '🔭',
    effects: [{ t: 'status', on: 'enemy', id: 'vuln', turns: 2 }],
  },
  {
    id: 'b2_incendiary', name: 'Зажигательный', set: 'ballistics', rarity: 'common', kind: 'attack',
    power: 90, cost: 1, target: 'enemy', icon: '🔥',
    effects: [
      { t: 'damage', v: 7 },
      { t: 'status', on: 'enemy', id: 'burn', v: 3 },
    ],
  },
  {
    id: 'b2_suppressFire', name: 'Подавить огнём', set: 'ballistics', rarity: 'common', kind: 'debuff',
    power: 80, cost: 1, target: 'allEnemies', icon: '🔇',
    effects: [{ t: 'status', on: 'allEnemies', id: 'weak', turns: 2 }],
  },
  {
    id: 'b2_buckShot', name: 'Картечь', set: 'ballistics', rarity: 'common', kind: 'aoe',
    power: 90, cost: 2, target: 'allEnemies', icon: '💥',
    effects: [{ t: 'damage', v: 6, target: 'allEnemies' }],
  },
  {
    id: 'b2_doubleFeed', name: 'Двойная подача', set: 'ballistics', rarity: 'uncommon', kind: 'attack',
    power: 115, cost: 1, target: 'enemy', icon: '🔁',
    effects: [{ t: 'damage', v: 8 }],
    combo: [{ t: 'damage', v: 8 }],
    keywords: ['combo'],
  },
  {
    id: 'b2_apBurst', name: 'Бронебойная очередь', set: 'ballistics', rarity: 'uncommon', kind: 'attack',
    power: 125, cost: 2, target: 'enemy', icon: '🎯',
    effects: [{ t: 'damage', v: 5, hits: 3, pierce: true }],
  },
  {
    id: 'b2_markedTarget', name: 'Отмеченная цель', set: 'ballistics', rarity: 'uncommon', kind: 'debuff',
    power: 120, cost: 1, target: 'enemy', icon: '🚩',
    effects: [
      { t: 'status', on: 'enemy', id: 'vuln', turns: 3 },
      { t: 'status', on: 'enemy', id: 'armorBreak', turns: 2 },
    ],
  },
  {
    id: 'b2_chainShot', name: 'Цепной выстрел', set: 'ballistics', rarity: 'uncommon', kind: 'attack',
    power: 120, cost: 1, target: 'enemy', icon: '↩️',
    effects: [
      { t: 'damage', v: 10 },
      { t: 'damage', v: 5, target: 'randomEnemy' },
    ],
  },
  {
    id: 'b2_overwatch', name: 'Наблюдение', set: 'ballistics', rarity: 'uncommon', kind: 'utility',
    power: 115, cost: 1, target: 'none', icon: '👁️',
    effects: [{ t: 'draw', v: 2 }, { t: 'energy', v: 1 }],
    exhaust: true,
  },
  {
    id: 'b2_railPierce', name: 'Рельсовый залп', set: 'ballistics', rarity: 'uncommon', kind: 'attack',
    power: 130, cost: 2, target: 'enemy', icon: '🛤️',
    effects: [{ t: 'damage', v: 16, pierce: true }],
  },
  {
    id: 'b2_drumMag', name: 'Барабанный магазин', set: 'ballistics', rarity: 'uncommon', kind: 'utility',
    power: 120, cost: 1, target: 'none', icon: '🥁',
    effects: [{ t: 'draw', v: 3 }],
    exhaust: true,
  },
  {
    id: 'b2_fireDiscipline', name: 'Огневая дисциплина', set: 'ballistics', rarity: 'uncommon', kind: 'attack',
    power: 130, cost: 1, target: 'enemy', icon: '🎖️',
    effects: [{ t: 'damage', v: 8 }],
    rageChance: 20,
    rageMult: 0.1,
  },
  {
    id: 'b2_ricochetVolley', name: 'Рикошетный залп', set: 'ballistics', rarity: 'rare', kind: 'aoe',
    power: 165, cost: 2, target: 'allEnemies', icon: '🪃',
    effects: [
      { t: 'damage', v: 8, target: 'allEnemies' },
      { t: 'damage', v: 6, target: 'randomEnemy' },
    ],
  },
  {
    id: 'b2_killZone', name: 'Зона поражения', set: 'ballistics', rarity: 'rare', kind: 'aoe',
    power: 170, cost: 2, target: 'allEnemies', icon: '🎯',
    effects: [
      { t: 'damage', v: 6, target: 'allEnemies' },
      { t: 'status', on: 'allEnemies', id: 'bleed', v: 3 },
    ],
  },
  {
    id: 'b2_steadyAim', name: 'Точный выстрел', set: 'ballistics', rarity: 'rare', kind: 'attack',
    power: 175, cost: 2, target: 'enemy', icon: '🎯',
    effects: [{ t: 'damage', v: 22 }],
    critChance: 20,
    critMult: 2,
  },
  {
    id: 'b2_ammoBelt', name: 'Патронная лента', set: 'ballistics', rarity: 'rare', kind: 'utility',
    power: 160, cost: 1, target: 'none', icon: '🧵',
    effects: [{ t: 'energy', v: 2 }, { t: 'draw', v: 2 }],
    exhaust: true,
  },
  {
    id: 'b2_headhunter', name: 'Охотник за головами', set: 'ballistics', rarity: 'rare', kind: 'attack',
    power: 180, cost: 2, target: 'enemy', icon: '💀',
    effects: [{ t: 'damage', v: 14 }],
    exec: 0.25,
    execMult: 2,
  },
  {
    id: 'b2_barrage', name: 'Шквальный огонь', set: 'ballistics', rarity: 'epic', kind: 'aoe',
    power: 185, cost: 3, target: 'allEnemies', icon: '🌪️',
    effects: [{ t: 'damage', v: 5, hits: 4, target: 'allEnemies' }],
  },
  {
    id: 'b2_deadeye', name: 'Мёртвый глаз', set: 'ballistics', rarity: 'epic', kind: 'attack',
    power: 210, cost: 3, target: 'enemy', icon: '👁️',
    effects: [{ t: 'damage', v: 28, pierce: true }],
    critChance: 25,
    critMult: 2,
  },
  {
    id: 'b2_lastStand', name: 'Последний рубеж', set: 'ballistics', rarity: 'legendary', kind: 'attack',
    power: 250, cost: 3, target: 'enemy', icon: '🏁',
    effects: [{ t: 'damage', v: 30 }],
    bonusLow: 15,
    once: true,
    keywords: ['once'],
  },

  // -------------------------------------------------------------------------
  // Инженерия II
  // -------------------------------------------------------------------------
  {
    id: 'e2_fieldRepair', name: 'Полевой ремонт', set: 'engineering', rarity: 'common', kind: 'heal',
    power: 60, cost: 1, target: 'merc', icon: '🔧',
    effects: [{ t: 'heal', v: 12, target: 'merc' }],
  },
  {
    id: 'e2_boltTrap', name: 'Болт-ловушка', set: 'engineering', rarity: 'common', kind: 'attack',
    power: 80, cost: 1, target: 'enemy', icon: '🔩',
    effects: [
      { t: 'damage', v: 9 },
      { t: 'status', on: 'enemy', id: 'web', turns: 1 },
    ],
  },
  {
    id: 'e2_insulation', name: 'Изоляция', set: 'engineering', rarity: 'common', kind: 'shield',
    power: 70, cost: 1, target: 'merc', icon: '🧤',
    effects: [{ t: 'shield', v: 14, target: 'merc' }],
  },
  {
    id: 'e2_powerCell', name: 'Энергоячейка', set: 'engineering', rarity: 'common', kind: 'utility',
    power: 50, cost: 0, target: 'none', icon: '🔋',
    effects: [{ t: 'energy', v: 1 }],
    exhaust: true,
  },
  {
    id: 'e2_wrench', name: 'Гаечный ключ', set: 'engineering', rarity: 'common', kind: 'attack',
    power: 75, cost: 1, target: 'enemy', icon: '🔧',
    effects: [
      { t: 'damage', v: 8 },
      { t: 'status', on: 'enemy', id: 'armorBreak', turns: 1 },
    ],
  },
  {
    id: 'e2_plating', name: 'Наплавка', set: 'engineering', rarity: 'common', kind: 'shield',
    power: 80, cost: 1, target: 'merc', icon: '🛡️',
    effects: [{ t: 'maxArmor', v: 4, target: 'merc' }],
    once: true,
    keywords: ['once'],
  },
  {
    id: 'e2_coolant', name: 'Хладагент', set: 'engineering', rarity: 'common', kind: 'utility',
    power: 85, cost: 1, target: 'allMercs', icon: '❄️',
    effects: [
      { t: 'status', on: 'allMercs', id: 'cleanse' },
      { t: 'shield', v: 8, target: 'allMercs' },
    ],
  },
  {
    id: 'e2_calibrate', name: 'Калибровка', set: 'engineering', rarity: 'common', kind: 'utility',
    power: 65, cost: 0, target: 'none', icon: '📐',
    effects: [{ t: 'draw', v: 1 }, { t: 'energy', v: 1 }],
    exhaust: true,
  },
  {
    id: 'e2_shockProd', name: 'Электрошок', set: 'engineering', rarity: 'common', kind: 'control',
    power: 85, cost: 1, target: 'enemy', icon: '⚡',
    effects: [
      { t: 'damage', v: 4 },
      { t: 'status', on: 'enemy', id: 'stun', turns: 1 },
    ],
  },
  {
    id: 'e2_magnet', name: 'Магнит', set: 'engineering', rarity: 'common', kind: 'utility',
    power: 75, cost: 0, target: 'none', icon: '🧲',
    effects: [{ t: 'scry', v: 2 }, { t: 'draw', v: 1 }],
  },
  {
    id: 'e2_reinforce', name: 'Укрепление', set: 'engineering', rarity: 'common', kind: 'shield',
    power: 85, cost: 1, target: 'allMercs', icon: '🧱',
    effects: [{ t: 'shield', v: 10, target: 'allMercs' }],
  },
  {
    id: 'e2_droneStrike', name: 'Удар дрона', set: 'engineering', rarity: 'uncommon', kind: 'attack',
    power: 115, cost: 1, target: 'enemy', icon: '🛸',
    effects: [
      { t: 'damage', v: 6, hits: 2 },
      { t: 'status', on: 'enemy', id: 'armorBreak', turns: 1 },
    ],
  },
  {
    id: 'e2_autoTurret', name: 'Автотурель', set: 'engineering', rarity: 'uncommon', kind: 'attack',
    power: 125, cost: 2, target: 'enemy', icon: '🔫',
    effects: [{ t: 'damage', v: 5, hits: 4 }],
  },
  {
    id: 'e2_shieldGen', name: 'Генератор щита', set: 'engineering', rarity: 'uncommon', kind: 'shield',
    power: 125, cost: 1, target: 'merc', icon: '🔵',
    effects: [
      { t: 'shield', v: 22, target: 'merc' },
      { t: 'status', on: 'merc', id: 'barrier', v: 8 },
    ],
  },
  {
    id: 'e2_arcNet', name: 'Дуговая сеть', set: 'engineering', rarity: 'uncommon', kind: 'aoe',
    power: 130, cost: 2, target: 'allEnemies', icon: '🌐',
    effects: [
      { t: 'damage', v: 7, target: 'allEnemies' },
      { t: 'status', on: 'allEnemies', id: 'web', turns: 1 },
    ],
  },
  {
    id: 'e2_nanoPatch', name: 'Нано-заплатка', set: 'engineering', rarity: 'uncommon', kind: 'heal',
    power: 130, cost: 1, target: 'merc', icon: '🦠',
    effects: [
      { t: 'heal', v: 20, target: 'merc' },
      { t: 'status', on: 'merc', id: 'regen', v: 5, turns: 2 },
    ],
  },
  {
    id: 'e2_overdrive', name: 'Форсаж', set: 'engineering', rarity: 'uncommon', kind: 'utility',
    power: 120, cost: 0, target: 'none', icon: '⚙️',
    effects: [{ t: 'energy', v: 2 }, { t: 'draw', v: 1 }],
    exhaust: true,
  },
  {
    id: 'e2_hardpoint', name: 'Твердая точка', set: 'engineering', rarity: 'uncommon', kind: 'shield',
    power: 125, cost: 1, target: 'merc', icon: '🔩',
    effects: [
      { t: 'maxArmor', v: 6, target: 'merc' },
      { t: 'shield', v: 12, target: 'merc' },
    ],
    once: true,
    keywords: ['once'],
  },
  {
    id: 'e2_empBlast', name: 'ЭМИ-удар', set: 'engineering', rarity: 'uncommon', kind: 'aoe',
    power: 135, cost: 2, target: 'allEnemies', icon: '💥',
    effects: [
      { t: 'damage', v: 9, target: 'allEnemies' },
      { t: 'status', on: 'randomEnemy', id: 'stun', turns: 1 },
    ],
  },
  {
    id: 'e2_siegeMode', name: 'Осадный режим', set: 'engineering', rarity: 'rare', kind: 'attack',
    power: 170, cost: 3, target: 'enemy', icon: '🏰',
    effects: [
      { t: 'damage', v: 10, hits: 3 },
      { t: 'status', on: 'enemy', id: 'armorBreak', turns: 2 },
    ],
  },
  {
    id: 'e2_bastion', name: 'Опорный пункт', set: 'engineering', rarity: 'rare', kind: 'shield',
    power: 175, cost: 2, target: 'allMercs', icon: '🧱',
    effects: [
      { t: 'shield', v: 30, target: 'allMercs' },
      { t: 'maxArmor', v: 4, target: 'allMercs' },
    ],
    once: true,
    keywords: ['once'],
  },
  {
    id: 'e2_reactor', name: 'Реактор', set: 'engineering', rarity: 'rare', kind: 'utility',
    power: 155, cost: 0, target: 'none', icon: '☢️',
    effects: [{ t: 'energy', v: 3 }],
    exhaust: true,
  },
  {
    id: 'e2_repairDrone', name: 'Ремонтный дрон', set: 'engineering', rarity: 'rare', kind: 'heal',
    power: 165, cost: 2, target: 'allMercs', icon: '🤖',
    effects: [{ t: 'heal', v: 30, target: 'allMercs' }],
  },
  {
    id: 'e2_teslaGrid', name: 'Сетка Теслы', set: 'engineering', rarity: 'epic', kind: 'aoe',
    power: 180, cost: 2, target: 'allEnemies', icon: '🌩️',
    effects: [{ t: 'damage', v: 10, target: 'allEnemies' }],
    keywords: ['echo'],
  },
  {
    id: 'e2_railTurret', name: 'Рельсовая турель', set: 'engineering', rarity: 'epic', kind: 'attack',
    power: 175, cost: 3, target: 'enemy', icon: '🛤️',
    effects: [{ t: 'damage', v: 24, pierce: true }],
  },
  {
    id: 'e2_fortress', name: 'Крепость', set: 'engineering', rarity: 'epic', kind: 'shield',
    power: 215, cost: 3, target: 'allMercs', icon: '🏯',
    effects: [
      { t: 'shield', v: 40, target: 'allMercs' },
      { t: 'status', on: 'allMercs', id: 'barrier', v: 15 },
    ],
    once: true,
    keywords: ['once'],
  },
  {
    id: 'e2_omniForge', name: 'Универсальный горн', set: 'engineering', rarity: 'legendary', kind: 'utility',
    power: 260, cost: 3, target: 'allMercs', icon: '🔥',
    effects: [
      { t: 'heal', v: 25, target: 'allMercs' },
      { t: 'energy', v: 2 },
      { t: 'draw', v: 2 },
    ],
    once: true,
    keywords: ['once'],
  },

  // -------------------------------------------------------------------------
  // Медицина II
  // -------------------------------------------------------------------------
  {
    id: 'm2_bandage', name: 'Бинт', set: 'medicine', rarity: 'common', kind: 'heal',
    power: 45, cost: 0, target: 'merc', icon: '🩹',
    effects: [{ t: 'heal', v: 10, target: 'merc' }],
  },
  {
    id: 'm2_stim', name: 'Стимулятор', set: 'medicine', rarity: 'common', kind: 'buff',
    power: 60, cost: 0, target: 'none', icon: '💉',
    effects: [{ t: 'energy', v: 1 }, { t: 'draw', v: 1 }],
    exhaust: true,
  },
  {
    id: 'm2_antiseptic', name: 'Антисептик', set: 'medicine', rarity: 'common', kind: 'utility',
    power: 55, cost: 0, target: 'merc', icon: '🧴',
    effects: [{ t: 'status', on: 'merc', id: 'cleanse' }],
  },
  {
    id: 'm2_suture', name: 'Шов', set: 'medicine', rarity: 'common', kind: 'heal',
    power: 70, cost: 1, target: 'merc', icon: '🪡',
    effects: [{ t: 'heal', v: 14, target: 'merc' }],
  },
  {
    id: 'm2_bloodBag', name: 'Пакет крови', set: 'medicine', rarity: 'common', kind: 'heal',
    power: 75, cost: 1, target: 'allMercs', icon: '🩸',
    effects: [{ t: 'heal', v: 8, target: 'allMercs' }],
  },
  {
    id: 'm2_analgesic', name: 'Анальгетик', set: 'medicine', rarity: 'common', kind: 'buff',
    power: 60, cost: 0, target: 'merc', icon: '💊',
    effects: [{ t: 'status', on: 'merc', id: 'barrier', v: 10 }],
  },
  {
    id: 'm2_vitamins', name: 'Витамины', set: 'medicine', rarity: 'common', kind: 'buff',
    power: 70, cost: 1, target: 'merc', icon: '🍊',
    effects: [{ t: 'status', on: 'merc', id: 'regen', v: 4, turns: 2 }],
  },
  {
    id: 'm2_tourniquet', name: 'Жгут', set: 'medicine', rarity: 'common', kind: 'heal',
    power: 80, cost: 1, target: 'merc', icon: '🩹',
    effects: [
      { t: 'heal', v: 12, target: 'merc' },
      { t: 'status', on: 'merc', id: 'cleanse' },
    ],
  },
  {
    id: 'm2_plasma', name: 'Плазма', set: 'medicine', rarity: 'common', kind: 'heal',
    power: 85, cost: 1, target: 'merc', icon: '🩸',
    effects: [{ t: 'heal', v: 18, target: 'merc' }],
  },
  {
    id: 'm2_triage2', name: 'Быстрая сортировка', set: 'medicine', rarity: 'common', kind: 'heal',
    power: 80, cost: 1, target: 'allMercs', icon: '🏷️',
    effects: [
      { t: 'heal', v: 6, target: 'allMercs' },
      { t: 'draw', v: 1 },
    ],
  },
  {
    id: 'm2_immunity', name: 'Иммунитет', set: 'medicine', rarity: 'common', kind: 'utility',
    power: 85, cost: 1, target: 'allMercs', icon: '🛡️',
    effects: [{ t: 'status', on: 'allMercs', id: 'cleanse' }],
    exhaust: true,
  },
  {
    id: 'm2_nanoSuture', name: 'Нано-шов', set: 'medicine', rarity: 'uncommon', kind: 'heal',
    power: 120, cost: 1, target: 'merc', icon: '🪡',
    effects: [
      { t: 'heal', v: 22, target: 'merc' },
      { t: 'status', on: 'merc', id: 'regen', v: 6, turns: 2 },
    ],
  },
  {
    id: 'm2_adrenalShot', name: 'Адреналиновый укол', set: 'medicine', rarity: 'uncommon', kind: 'buff',
    power: 125, cost: 0, target: 'merc', icon: '💉',
    effects: [
      { t: 'heal', v: 10, target: 'merc' },
      { t: 'energy', v: 2 },
    ],
    exhaust: true,
  },
  {
    id: 'm2_fieldDressing', name: 'Полевая перевязка', set: 'medicine', rarity: 'uncommon', kind: 'heal',
    power: 130, cost: 2, target: 'allMercs', icon: '🧰',
    effects: [{ t: 'heal', v: 18, target: 'allMercs' }],
  },
  {
    id: 'm2_painBlock', name: 'Блокада боли', set: 'medicine', rarity: 'uncommon', kind: 'buff',
    power: 125, cost: 1, target: 'merc', icon: '🛡️',
    effects: [
      { t: 'status', on: 'merc', id: 'barrier', v: 25 },
      { t: 'status', on: 'merc', id: 'taunt', turns: 2 },
    ],
  },
  {
    id: 'm2_regenPod', name: 'Реген-капсула', set: 'medicine', rarity: 'uncommon', kind: 'buff',
    power: 135, cost: 2, target: 'allMercs', icon: '🧬',
    effects: [{ t: 'status', on: 'allMercs', id: 'regen', v: 8, turns: 3 }],
  },
  {
    id: 'm2_defib', name: 'Дефибриллятор', set: 'medicine', rarity: 'uncommon', kind: 'heal',
    power: 140, cost: 2, target: 'allMercs', icon: '⚡',
    effects: [{ t: 'revive', v: 0.3 }],
    exhaust: true,
  },
  {
    id: 'm2_serum', name: 'Сыворотка', set: 'medicine', rarity: 'uncommon', kind: 'buff',
    power: 130, cost: 1, target: 'allMercs', icon: '🧪',
    effects: [{ t: 'status', on: 'allMercs', id: 'thorns', v: 5 }],
    once: true,
    keywords: ['once'],
  },
  {
    id: 'm2_bloodPact', name: 'Кровный договор', set: 'medicine', rarity: 'uncommon', kind: 'heal',
    power: 120, cost: 1, target: 'merc', icon: '🩸',
    effects: [{ t: 'heal', v: 25, target: 'merc' }],
  },
  {
    id: 'm2_massTransfusion', name: 'Массовое переливание', set: 'medicine', rarity: 'rare', kind: 'heal',
    power: 170, cost: 2, target: 'allMercs', icon: '🩸',
    effects: [{ t: 'heal', v: 30, target: 'allMercs' }],
  },
  {
    id: 'm2_emergencyWard', name: 'Экстренный блок', set: 'medicine', rarity: 'rare', kind: 'shield',
    power: 175, cost: 2, target: 'allMercs', icon: '🏥',
    effects: [
      { t: 'shield', v: 28, target: 'allMercs' },
      { t: 'status', on: 'allMercs', id: 'cleanse' },
    ],
  },
  {
    id: 'm2_medBay', name: 'Медотсек', set: 'medicine', rarity: 'rare', kind: 'heal',
    power: 180, cost: 3, target: 'allMercs', icon: '🏥',
    effects: [
      { t: 'heal', v: 20, target: 'allMercs' },
      { t: 'status', on: 'allMercs', id: 'regen', v: 6, turns: 3 },
    ],
  },
  {
    id: 'm2_resuscitate', name: 'Реанимация', set: 'medicine', rarity: 'rare', kind: 'heal',
    power: 185, cost: 2, target: 'allMercs', icon: '💓',
    effects: [{ t: 'revive', v: 0.5 }],
    exhaust: true,
  },
  {
    id: 'm2_combatStim', name: 'Боевой стимулятор', set: 'medicine', rarity: 'rare', kind: 'buff',
    power: 180, cost: 1, target: 'allMercs', icon: '💉',
    effects: [
      { t: 'energy', v: 2 },
      { t: 'draw', v: 2 },
      { t: 'heal', v: 10, target: 'allMercs' },
    ],
    exhaust: true,
  },
  {
    id: 'm2_steroidCycle', name: 'Курс стероидов', set: 'medicine', rarity: 'rare', kind: 'buff',
    power: 175, cost: 2, target: 'allMercs', icon: '💪',
    effects: [
      { t: 'maxArmor', v: 6, target: 'allMercs' },
      { t: 'status', on: 'allMercs', id: 'thorns', v: 4 },
    ],
    once: true,
    keywords: ['once'],
  },
  {
    id: 'm2_phoenixProtocol', name: 'Протокол «Феникс»', set: 'medicine', rarity: 'epic', kind: 'heal',
    power: 220, cost: 3, target: 'allMercs', icon: '🔥',
    effects: [
      { t: 'revive', v: 0.6 },
      { t: 'heal', v: 20, target: 'allMercs' },
    ],
    exhaust: true,
  },
  {
    id: 'm2_eternalLife', name: 'Вечная жизнь', set: 'medicine', rarity: 'legendary', kind: 'heal',
    power: 265, cost: 3, target: 'allMercs', icon: '♾️',
    effects: [
      { t: 'revive', v: 1 },
      { t: 'heal', v: 30, target: 'allMercs' },
    ],
    once: true,
    keywords: ['once'],
  },

  // -------------------------------------------------------------------------
  // Химия II
  // -------------------------------------------------------------------------
  {
    id: 'c2_acidSpray', name: 'Кислотный спрей', set: 'chemistry', rarity: 'common', kind: 'attack',
    power: 75, cost: 1, target: 'enemy', icon: '🧫',
    effects: [
      { t: 'damage', v: 6 },
      { t: 'status', on: 'enemy', id: 'poison', v: 2 },
    ],
  },
  {
    id: 'c2_toxinDart', name: 'Токсин-дротик', set: 'chemistry', rarity: 'common', kind: 'attack',
    power: 80, cost: 1, target: 'enemy', icon: '🎯',
    effects: [
      { t: 'damage', v: 5 },
      { t: 'status', on: 'enemy', id: 'poison', v: 4 },
    ],
  },
  {
    id: 'c2_fireBomb', name: 'Зажигательная бомба', set: 'chemistry', rarity: 'common', kind: 'aoe',
    power: 85, cost: 2, target: 'allEnemies', icon: '💣',
    effects: [
      { t: 'damage', v: 5, target: 'allEnemies' },
      { t: 'status', on: 'allEnemies', id: 'burn', v: 2 },
    ],
  },
  {
    id: 'c2_bleedVial', name: 'Флакон кровопуска', set: 'chemistry', rarity: 'common', kind: 'debuff',
    power: 65, cost: 1, target: 'enemy', icon: '🩸',
    effects: [{ t: 'status', on: 'enemy', id: 'bleed', v: 4 }],
  },
  {
    id: 'c2_solventSpray', name: 'Растворитель-спрей', set: 'chemistry', rarity: 'common', kind: 'debuff',
    power: 80, cost: 1, target: 'allEnemies', icon: '🫗',
    effects: [{ t: 'status', on: 'allEnemies', id: 'armorBreak', turns: 2 }],
  },
  {
    id: 'c2_smokeFlask', name: 'Дымовая колба', set: 'chemistry', rarity: 'common', kind: 'control',
    power: 75, cost: 1, target: 'allEnemies', icon: '💨',
    effects: [{ t: 'status', on: 'allEnemies', id: 'web', turns: 1 }],
  },
  {
    id: 'c2_stimVial', name: 'Колба бодрости', set: 'chemistry', rarity: 'common', kind: 'buff',
    power: 55, cost: 0, target: 'none', icon: '🧪',
    effects: [{ t: 'energy', v: 1 }, { t: 'draw', v: 1 }],
    exhaust: true,
  },
  {
    id: 'c2_acidBath', name: 'Кислотная ванна', set: 'chemistry', rarity: 'common', kind: 'attack',
    power: 85, cost: 1, target: 'enemy', icon: '🛁',
    effects: [
      { t: 'damage', v: 7 },
      { t: 'status', on: 'enemy', id: 'armorBreak', turns: 2 },
    ],
  },
  {
    id: 'c2_nerveGas', name: 'Нервный газ', set: 'chemistry', rarity: 'common', kind: 'debuff',
    power: 85, cost: 1, target: 'enemy', icon: '☠️',
    effects: [
      { t: 'status', on: 'enemy', id: 'weak', turns: 2 },
      { t: 'status', on: 'enemy', id: 'poison', v: 2 },
    ],
  },
  {
    id: 'c2_napalmFlask', name: 'Напалмовая колба', set: 'chemistry', rarity: 'common', kind: 'aoe',
    power: 90, cost: 2, target: 'allEnemies', icon: '🔥',
    effects: [
      { t: 'damage', v: 4, target: 'allEnemies' },
      { t: 'status', on: 'allEnemies', id: 'burn', v: 3 },
    ],
  },
  {
    id: 'c2_antitoxin', name: 'Антитоксин', set: 'chemistry', rarity: 'common', kind: 'utility',
    power: 80, cost: 1, target: 'allMercs', icon: '🧪',
    effects: [
      { t: 'status', on: 'allMercs', id: 'cleanse' },
      { t: 'heal', v: 6, target: 'allMercs' },
    ],
  },
  {
    id: 'c2_venomCoat', name: 'Ядовитое покрытие', set: 'chemistry', rarity: 'uncommon', kind: 'buff',
    power: 115, cost: 1, target: 'merc', icon: '🟢',
    effects: [{ t: 'status', on: 'merc', id: 'thorns', v: 6 }],
    once: true,
    keywords: ['once'],
  },
  {
    id: 'c2_corrosive', name: 'Коррозийный состав', set: 'chemistry', rarity: 'uncommon', kind: 'debuff',
    power: 120, cost: 1, target: 'enemy', icon: '🧪',
    effects: [
      { t: 'status', on: 'enemy', id: 'armorBreak', turns: 3 },
      { t: 'status', on: 'enemy', id: 'vuln', turns: 2 },
    ],
  },
  {
    id: 'c2_toxicBurst', name: 'Токсичный разрыв', set: 'chemistry', rarity: 'uncommon', kind: 'aoe',
    power: 125, cost: 2, target: 'allEnemies', icon: '☣️',
    effects: [{ t: 'status', on: 'allEnemies', id: 'poison', v: 5 }],
  },
  {
    id: 'c2_plagueBomb', name: 'Чумная бомба', set: 'chemistry', rarity: 'uncommon', kind: 'aoe',
    power: 130, cost: 2, target: 'allEnemies', icon: '💣',
    effects: [
      { t: 'damage', v: 6, target: 'allEnemies' },
      { t: 'status', on: 'allEnemies', id: 'poison', v: 3 },
    ],
  },
  {
    id: 'c2_chemBurn', name: 'Химический ожог', set: 'chemistry', rarity: 'uncommon', kind: 'attack',
    power: 125, cost: 2, target: 'enemy', icon: '🔥',
    effects: [
      { t: 'damage', v: 12 },
      { t: 'status', on: 'enemy', id: 'burn', v: 6 },
    ],
  },
  {
    id: 'c2_volatileFlask', name: 'Летучая колба', set: 'chemistry', rarity: 'uncommon', kind: 'attack',
    power: 125, cost: 1, target: 'enemy', icon: '🧨',
    effects: [
      { t: 'damage', v: 10 },
      { t: 'damage', v: 8, target: 'randomEnemy' },
    ],
  },
  {
    id: 'c2_reagent', name: 'Реагент', set: 'chemistry', rarity: 'uncommon', kind: 'utility',
    power: 115, cost: 0, target: 'none', icon: '⚗️',
    effects: [{ t: 'draw', v: 2 }, { t: 'scry', v: 2 }],
  },
  {
    id: 'c2_acidRain', name: 'Кислотный дождь', set: 'chemistry', rarity: 'uncommon', kind: 'aoe',
    power: 130, cost: 2, target: 'allEnemies', icon: '🌧️',
    effects: [
      { t: 'damage', v: 7, target: 'allEnemies' },
      { t: 'status', on: 'allEnemies', id: 'armorBreak', turns: 1 },
    ],
  },
  {
    id: 'c2_inferno', name: 'Инферно', set: 'chemistry', rarity: 'rare', kind: 'aoe',
    power: 170, cost: 2, target: 'allEnemies', icon: '🔥',
    effects: [
      { t: 'damage', v: 8, target: 'allEnemies' },
      { t: 'status', on: 'allEnemies', id: 'burn', v: 5 },
    ],
  },
  {
    id: 'c2_toxinStorm', name: 'Токсичный шторм', set: 'chemistry', rarity: 'epic', kind: 'aoe',
    power: 175, cost: 3, target: 'allEnemies', icon: '☣️',
    effects: [
      { t: 'damage', v: 4, hits: 2, target: 'allEnemies' },
      { t: 'status', on: 'allEnemies', id: 'poison', v: 4 },
    ],
  },
  {
    id: 'c2_meltdown', name: 'Расплав', set: 'chemistry', rarity: 'rare', kind: 'debuff',
    power: 165, cost: 2, target: 'enemy', icon: '🫠',
    effects: [
      { t: 'status', on: 'enemy', id: 'armorBreak', turns: 4 },
      { t: 'status', on: 'enemy', id: 'vuln', turns: 3 },
      { t: 'status', on: 'enemy', id: 'web', turns: 2 },
    ],
  },
  {
    id: 'c2_gasChamber', name: 'Газовая камера', set: 'chemistry', rarity: 'epic', kind: 'aoe',
    power: 175, cost: 3, target: 'allEnemies', icon: '💨',
    effects: [
      { t: 'status', on: 'allEnemies', id: 'poison', v: 7 },
      { t: 'status', on: 'allEnemies', id: 'weak', turns: 2 },
    ],
  },
  {
    id: 'c2_acidEngine', name: 'Кислотный движок', set: 'chemistry', rarity: 'rare', kind: 'attack',
    power: 170, cost: 2, target: 'enemy', icon: '⚙️',
    effects: [
      { t: 'damage', v: 20, pierce: true },
      { t: 'status', on: 'enemy', id: 'armorBreak', turns: 3 },
    ],
  },
  {
    id: 'c2_bioWeapon', name: 'Биооружие', set: 'chemistry', rarity: 'rare', kind: 'buff',
    power: 180, cost: 2, target: 'allMercs', icon: '☣️',
    effects: [
      { t: 'status', on: 'allMercs', id: 'thorns', v: 8 },
      { t: 'maxArmor', v: 4, target: 'allMercs' },
    ],
    once: true,
    keywords: ['once'],
  },
  {
    id: 'c2_plague', name: 'Чума', set: 'chemistry', rarity: 'epic', kind: 'aoe',
    power: 215, cost: 3, target: 'allEnemies', icon: '🦠',
    effects: [{ t: 'status', on: 'allEnemies', id: 'poison', v: 9 }],
    keywords: ['echo'],
  },
  {
    id: 'c2_catalystPrime', name: 'Первичный катализатор', set: 'chemistry', rarity: 'legendary', kind: 'aoe',
    power: 260, cost: 3, target: 'allEnemies', icon: '⚗️',
    effects: [
      { t: 'damage', v: 14, target: 'allEnemies' },
      { t: 'status', on: 'allEnemies', id: 'burn', v: 8 },
      { t: 'status', on: 'allEnemies', id: 'poison', v: 8 },
    ],
    once: true,
    keywords: ['once'],
  },

  // =========================================================================
  // Пул V: 80 карт (Паутина, Тактика, Реликвии улья).
  // =========================================================================

  // -------------------------------------------------------------------------
  // Паутина II
  // -------------------------------------------------------------------------
  {
    id: 'w2_webSpit', name: 'Плевок паутиной', set: 'web', rarity: 'common', kind: 'control',
    power: 60, cost: 1, target: 'enemy', icon: '🕸️',
    effects: [{ t: 'status', on: 'enemy', id: 'web', turns: 2 }],
  },
  {
    id: 'w2_chitinShard', name: 'Хитиновый осколок', set: 'web', rarity: 'common', kind: 'attack',
    power: 60, cost: 1, target: 'enemy', icon: '🪲',
    effects: [{ t: 'damage', v: 8 }],
  },
  {
    id: 'w2_silkThread', name: 'Шёлковая нить', set: 'web', rarity: 'common', kind: 'utility',
    power: 55, cost: 0, target: 'none', icon: '🧵',
    effects: [{ t: 'draw', v: 2 }],
    exhaust: true,
  },
  {
    id: 'w2_broodling', name: 'Выводок', set: 'web', rarity: 'common', kind: 'attack',
    power: 75, cost: 1, target: 'enemy', icon: '🕷️',
    effects: [
      { t: 'damage', v: 6 },
      { t: 'status', on: 'enemy', id: 'poison', v: 2 },
    ],
  },
  {
    id: 'w2_nestGuard', name: 'Страж гнезда', set: 'web', rarity: 'common', kind: 'shield',
    power: 80, cost: 1, target: 'merc', icon: '🪲',
    effects: [
      { t: 'shield', v: 12, target: 'merc' },
      { t: 'maxArmor', v: 2, target: 'merc' },
    ],
  },
  {
    id: 'w2_venomSac', name: 'Ядовитый мешок', set: 'web', rarity: 'common', kind: 'debuff',
    power: 65, cost: 1, target: 'enemy', icon: '☠️',
    effects: [{ t: 'status', on: 'enemy', id: 'poison', v: 4 }],
  },
  {
    id: 'w2_skitter', name: 'Скольжение', set: 'web', rarity: 'common', kind: 'buff',
    power: 70, cost: 1, target: 'merc', icon: '👣',
    effects: [{ t: 'status', on: 'merc', id: 'dodge', v: 20, turns: 1 }],
  },
  {
    id: 'w2_webTrap', name: 'Паутинная ловушка', set: 'web', rarity: 'common', kind: 'control',
    power: 80, cost: 1, target: 'enemy', icon: '🪤',
    effects: [
      { t: 'damage', v: 4 },
      { t: 'status', on: 'enemy', id: 'web', turns: 2 },
    ],
  },
  {
    id: 'w2_carapace', name: 'Панцирь', set: 'web', rarity: 'common', kind: 'shield',
    power: 80, cost: 1, target: 'merc', icon: '🛡️',
    effects: [{ t: 'maxArmor', v: 6, target: 'merc' }],
    once: true,
    keywords: ['once'],
  },
  {
    id: 'w2_eggCluster', name: 'Кладка', set: 'web', rarity: 'common', kind: 'heal',
    power: 75, cost: 1, target: 'allMercs', icon: '🥚',
    effects: [{ t: 'heal', v: 8, target: 'allMercs' }],
  },
  {
    id: 'w2_silkBind', name: 'Шёлковые путы', set: 'web', rarity: 'common', kind: 'control',
    power: 85, cost: 1, target: 'enemy', icon: '🧶',
    effects: [{ t: 'status', on: 'enemy', id: 'stun', turns: 1 }],
  },
  {
    id: 'w2_broodRush', name: 'Набег выводка', set: 'web', rarity: 'uncommon', kind: 'attack',
    power: 115, cost: 1, target: 'enemy', icon: '🕷️',
    effects: [{ t: 'damage', v: 7, hits: 2 }],
  },
  {
    id: 'w2_webCocoon', name: 'Опутывание', set: 'web', rarity: 'uncommon', kind: 'control',
    power: 120, cost: 2, target: 'enemy', icon: '🪤',
    effects: [
      { t: 'status', on: 'enemy', id: 'stun', turns: 1 },
      { t: 'status', on: 'enemy', id: 'web', turns: 2 },
    ],
  },
  {
    id: 'w2_venomFang', name: 'Ядовитый клык', set: 'web', rarity: 'uncommon', kind: 'attack',
    power: 125, cost: 1, target: 'enemy', icon: '🦷',
    effects: [
      { t: 'damage', v: 12 },
      { t: 'status', on: 'enemy', id: 'poison', v: 5 },
    ],
  },
  {
    id: 'w2_hiveGuard', name: 'Стража улья', set: 'web', rarity: 'uncommon', kind: 'shield',
    power: 125, cost: 2, target: 'allMercs', icon: '🛡️',
    effects: [
      { t: 'shield', v: 20, target: 'allMercs' },
      { t: 'status', on: 'allMercs', id: 'taunt', turns: 1 },
    ],
  },
  {
    id: 'w2_silkArmor', name: 'Шёлковая броня', set: 'web', rarity: 'uncommon', kind: 'shield',
    power: 120, cost: 1, target: 'merc', icon: '🧵',
    effects: [
      { t: 'maxArmor', v: 8, target: 'merc' },
      { t: 'shield', v: 12, target: 'merc' },
    ],
    once: true,
    keywords: ['once'],
  },
  {
    id: 'w2_spiderling', name: 'Паучок-носильщик', set: 'web', rarity: 'uncommon', kind: 'utility',
    power: 115, cost: 1, target: 'none', icon: '🕷️',
    effects: [{ t: 'draw', v: 2 }, { t: 'energy', v: 1 }],
    exhaust: true,
  },
  {
    id: 'w2_webNova', name: 'Паутинная нова', set: 'web', rarity: 'uncommon', kind: 'aoe',
    power: 130, cost: 2, target: 'allEnemies', icon: '🕸️',
    effects: [
      { t: 'damage', v: 6, target: 'allEnemies' },
      { t: 'status', on: 'allEnemies', id: 'web', turns: 1 },
    ],
  },
  {
    id: 'w2_queensMark', name: 'Метка матки', set: 'web', rarity: 'uncommon', kind: 'debuff',
    power: 125, cost: 1, target: 'enemy', icon: '👑',
    effects: [
      { t: 'status', on: 'enemy', id: 'vuln', turns: 3 },
      { t: 'status', on: 'enemy', id: 'web', turns: 2 },
    ],
  },
  {
    id: 'w2_broodMother', name: 'Матка', set: 'web', rarity: 'rare', kind: 'heal',
    power: 165, cost: 2, target: 'allMercs', icon: '🕷️',
    effects: [
      { t: 'heal', v: 18, target: 'allMercs' },
      { t: 'status', on: 'allMercs', id: 'regen', v: 6, turns: 2 },
    ],
  },
  {
    id: 'w2_webFortress', name: 'Паутинная крепость', set: 'web', rarity: 'rare', kind: 'shield',
    power: 175, cost: 2, target: 'allMercs', icon: '🏯',
    effects: [
      { t: 'shield', v: 28, target: 'allMercs' },
      { t: 'status', on: 'allMercs', id: 'thorns', v: 4 },
    ],
    once: true,
    keywords: ['once'],
  },
  {
    id: 'w2_venomFlood', name: 'Ядовитый потоп', set: 'web', rarity: 'rare', kind: 'aoe',
    power: 170, cost: 2, target: 'allEnemies', icon: '☠️',
    effects: [
      { t: 'status', on: 'allEnemies', id: 'poison', v: 6 },
      { t: 'status', on: 'allEnemies', id: 'weak', turns: 1 },
    ],
  },
  {
    id: 'w2_silkStorm', name: 'Шёлковый шторм', set: 'web', rarity: 'epic', kind: 'aoe',
    power: 175, cost: 3, target: 'allEnemies', icon: '🌪️',
    effects: [
      { t: 'damage', v: 9, target: 'allEnemies' },
      { t: 'status', on: 'allEnemies', id: 'web', turns: 2 },
    ],
  },
  {
    id: 'w2_chitinWall', name: 'Хитиновая стена', set: 'web', rarity: 'epic', kind: 'shield',
    power: 175, cost: 3, target: 'allMercs', icon: '🧱',
    effects: [
      { t: 'shield', v: 24, target: 'allMercs' },
      { t: 'maxArmor', v: 5, target: 'allMercs' },
    ],
    once: true,
    keywords: ['once'],
  },
  {
    id: 'w2_spiderQueen', name: 'Королева пауков', set: 'web', rarity: 'epic', kind: 'buff',
    power: 180, cost: 2, target: 'allMercs', icon: '👑',
    effects: [
      { t: 'status', on: 'allMercs', id: 'thorns', v: 7 },
      { t: 'status', on: 'allMercs', id: 'dodge', v: 20, turns: 2 },
    ],
    once: true,
    keywords: ['once'],
  },
  {
    id: 'w2_broodTide', name: 'Волна выводка', set: 'web', rarity: 'epic', kind: 'aoe',
    power: 215, cost: 3, target: 'allEnemies', icon: '🕷️',
    effects: [
      { t: 'damage', v: 12, target: 'allEnemies' },
      { t: 'status', on: 'allEnemies', id: 'web', turns: 2 },
    ],
  },
  {
    id: 'w2_queenAscend', name: 'Возвышение матки', set: 'web', rarity: 'legendary', kind: 'buff',
    power: 265, cost: 3, target: 'allMercs', icon: '👑',
    effects: [
      { t: 'status', on: 'allMercs', id: 'thorns', v: 10 },
      { t: 'maxArmor', v: 10, target: 'allMercs' },
      { t: 'heal', v: 25, target: 'allMercs' },
    ],
    once: true,
    keywords: ['once'],
  },

  // -------------------------------------------------------------------------
  // Тактика II
  // -------------------------------------------------------------------------
  {
    id: 't2_quickStep', name: 'Быстрый шаг', set: 'tactics', rarity: 'common', kind: 'attack',
    power: 70, cost: 1, target: 'enemy', icon: '👟',
    effects: [{ t: 'damage', v: 7 }, { t: 'draw', v: 1 }],
  },
  {
    id: 't2_guardStance', name: 'Стойка охраны', set: 'tactics', rarity: 'common', kind: 'shield',
    power: 75, cost: 1, target: 'merc', icon: '🛡️',
    effects: [
      { t: 'shield', v: 12, target: 'merc' },
      { t: 'maxArmor', v: 2, target: 'merc' },
    ],
  },
  {
    id: 't2_battlePlan', name: 'План боя', set: 'tactics', rarity: 'common', kind: 'utility',
    power: 60, cost: 0, target: 'none', icon: '📝',
    effects: [{ t: 'draw', v: 1 }, { t: 'energy', v: 1 }],
    exhaust: true,
  },
  {
    id: 't2_probe', name: 'Разведка боем', set: 'tactics', rarity: 'common', kind: 'debuff',
    power: 60, cost: 1, target: 'enemy', icon: '🔍',
    effects: [{ t: 'status', on: 'enemy', id: 'vuln', turns: 2 }],
  },
  {
    id: 't2_feint', name: 'Финт', set: 'tactics', rarity: 'common', kind: 'attack',
    power: 75, cost: 1, target: 'enemy', icon: '🌀',
    effects: [
      { t: 'damage', v: 6 },
      { t: 'status', on: 'enemy', id: 'weak', turns: 1 },
    ],
  },
  {
    id: 't2_rallyCry', name: 'Ободряющий клич', set: 'tactics', rarity: 'common', kind: 'buff',
    power: 65, cost: 1, target: 'allMercs', icon: '📢',
    effects: [{ t: 'heal', v: 6, target: 'allMercs' }],
  },
  {
    id: 't2_holdLine', name: 'Держать строй', set: 'tactics', rarity: 'common', kind: 'shield',
    power: 85, cost: 1, target: 'allMercs', icon: '🧱',
    effects: [{ t: 'shield', v: 10, target: 'allMercs' }],
  },
  {
    id: 't2_flankShot', name: 'Выстрел во фланг', set: 'tactics', rarity: 'common', kind: 'attack',
    power: 85, cost: 1, target: 'enemy', icon: '🎯',
    effects: [{ t: 'damage', v: 9 }],
    combo: [{ t: 'damage', v: 6 }],
    keywords: ['combo'],
  },
  {
    id: 't2_smokeStep', name: 'Дымный шаг', set: 'tactics', rarity: 'common', kind: 'buff',
    power: 70, cost: 0, target: 'merc', icon: '💨',
    effects: [{ t: 'status', on: 'merc', id: 'dodge', v: 25, turns: 1 }],
  },
  {
    id: 't2_supplyDrop', name: 'Сброс припасов', set: 'tactics', rarity: 'common', kind: 'utility',
    power: 55, cost: 0, target: 'none', icon: '📦',
    effects: [{ t: 'draw', v: 2 }],
    exhaust: true,
  },
  {
    id: 't2_pressOn', name: 'Не сбавлять темп', set: 'tactics', rarity: 'common', kind: 'utility',
    power: 70, cost: 0, target: 'none', icon: '🏃',
    effects: [{ t: 'energy', v: 1 }, { t: 'draw', v: 1 }],
    exhaust: true,
  },
  {
    id: 't2_pincer', name: 'Клещи', set: 'tactics', rarity: 'uncommon', kind: 'attack',
    power: 120, cost: 1, target: 'enemy', icon: '🦀',
    effects: [{ t: 'damage', v: 8, hits: 2 }],
    combo: [{ t: 'damage', v: 8 }],
    keywords: ['combo'],
  },
  {
    id: 't2_shieldWall', name: 'Стена щитов', set: 'tactics', rarity: 'uncommon', kind: 'shield',
    power: 125, cost: 2, target: 'allMercs', icon: '🛡️',
    effects: [
      { t: 'shield', v: 18, target: 'allMercs' },
      { t: 'maxArmor', v: 3, target: 'allMercs' },
    ],
    once: true,
    keywords: ['once'],
  },
  {
    id: 't2_counterStrike', name: 'Контрудар', set: 'tactics', rarity: 'uncommon', kind: 'buff',
    power: 120, cost: 1, target: 'allMercs', icon: '↩️',
    effects: [{ t: 'status', on: 'allMercs', id: 'thorns', v: 6 }],
    once: true,
    keywords: ['once'],
  },
  {
    id: 't2_warDrums', name: 'Боевые барабаны', set: 'tactics', rarity: 'uncommon', kind: 'attack',
    power: 130, cost: 1, target: 'enemy', icon: '🥁',
    effects: [{ t: 'damage', v: 10 }],
    rageChance: 25,
    rageMult: 0.1,
  },
  {
    id: 't2_ambush2', name: 'Внезапный удар', set: 'tactics', rarity: 'uncommon', kind: 'attack',
    power: 125, cost: 2, target: 'enemy', icon: '🌑',
    effects: [{ t: 'damage', v: 14 }],
    critChance: 20,
    critMult: 2,
  },
  {
    id: 't2_tacticalRetreat', name: 'Тактический отход', set: 'tactics', rarity: 'uncommon', kind: 'shield',
    power: 120, cost: 1, target: 'allMercs', icon: '🏃',
    effects: [
      { t: 'shield', v: 16, target: 'allMercs' },
      { t: 'draw', v: 1 },
    ],
  },
  {
    id: 't2_commandSquad', name: 'Командир отряда', set: 'tactics', rarity: 'uncommon', kind: 'buff',
    power: 125, cost: 1, target: 'allMercs', icon: '🎖️',
    effects: [
      { t: 'energy', v: 1 },
      { t: 'maxArmor', v: 3, target: 'allMercs' },
    ],
    once: true,
    keywords: ['once'],
  },
  {
    id: 't2_executioner', name: 'Палач', set: 'tactics', rarity: 'uncommon', kind: 'attack',
    power: 130, cost: 2, target: 'enemy', icon: '🪓',
    effects: [{ t: 'damage', v: 16 }],
    exec: 0.3,
    execMult: 2,
  },
  {
    id: 't2_blitz', name: 'Блиц', set: 'tactics', rarity: 'rare', kind: 'attack',
    power: 175, cost: 2, target: 'enemy', icon: '⚡',
    effects: [{ t: 'damage', v: 6, hits: 4 }],
    combo: [{ t: 'damage', v: 3, hits: 4 }],
    keywords: ['combo'],
  },
  {
    id: 't2_lastOrder', name: 'Последний приказ', set: 'tactics', rarity: 'epic', kind: 'buff',
    power: 180, cost: 2, target: 'allMercs', icon: '📜',
    effects: [
      { t: 'energy', v: 2 },
      { t: 'draw', v: 2 },
      { t: 'heal', v: 12, target: 'allMercs' },
    ],
    exhaust: true,
    once: true,
    keywords: ['once'],
  },
  {
    id: 't2_ironDiscipline', name: 'Железная дисциплина', set: 'tactics', rarity: 'rare', kind: 'shield',
    power: 170, cost: 2, target: 'allMercs', icon: '🛡️',
    effects: [
      { t: 'shield', v: 26, target: 'allMercs' },
      { t: 'status', on: 'allMercs', id: 'cleanse' },
    ],
  },
  {
    id: 't2_overrun', name: 'Прорыв', set: 'tactics', rarity: 'epic', kind: 'attack',
    power: 175, cost: 2, target: 'enemy', icon: '🏇',
    effects: [
      { t: 'damage', v: 22 },
      { t: 'status', on: 'enemy', id: 'vuln', turns: 2 },
    ],
  },
  {
    id: 't2_battleTrance', name: 'Боевой транс', set: 'tactics', rarity: 'epic', kind: 'attack',
    power: 180, cost: 2, target: 'enemy', icon: '🌀',
    effects: [
      { t: 'damage', v: 8 },
      { t: 'status', on: 'allMercs', id: 'thorns', v: 6 },
    ],
    rageChance: 30,
    rageMult: 0.1,
    once: true,
    keywords: ['once'],
  },
  {
    id: 't2_grandStrategy', name: 'Великая стратегия', set: 'tactics', rarity: 'rare', kind: 'utility',
    power: 170, cost: 1, target: 'none', icon: '🧠',
    effects: [
      { t: 'draw', v: 3 },
      { t: 'energy', v: 1 },
      { t: 'scry', v: 3 },
    ],
  },
  {
    id: 't2_warlord', name: 'Военачальник', set: 'tactics', rarity: 'epic', kind: 'buff',
    power: 220, cost: 2, target: 'allMercs', icon: '🎖️',
    effects: [
      { t: 'energy', v: 2 },
      { t: 'maxArmor', v: 6, target: 'allMercs' },
      { t: 'status', on: 'allMercs', id: 'thorns', v: 5 },
    ],
    once: true,
    keywords: ['once'],
  },
  {
    id: 't2_apexPredator', name: 'Высший хищник', set: 'tactics', rarity: 'legendary', kind: 'attack',
    power: 265, cost: 3, target: 'enemy', icon: '🦁',
    effects: [{ t: 'damage', v: 34 }],
    exec: 0.4,
    execMult: 2,
    critChance: 30,
    critMult: 2,
    once: true,
    keywords: ['once'],
  },

  // -------------------------------------------------------------------------
  // Реликвии улья II
  // -------------------------------------------------------------------------
  {
    id: 'r2_amberBead', name: 'Янтарная бусина', set: 'relics', rarity: 'common', kind: 'utility',
    power: 45, cost: 0, target: 'none', icon: '🟠',
    effects: [{ t: 'draw', v: 1 }],
  },
  {
    id: 'r2_waxSeal', name: 'Восковая печать', set: 'relics', rarity: 'common', kind: 'shield',
    power: 60, cost: 1, target: 'merc', icon: '🕯️',
    effects: [{ t: 'shield', v: 10, target: 'merc' }],
  },
  {
    id: 'r2_hiveSigil', name: 'Знак улья', set: 'relics', rarity: 'common', kind: 'debuff',
    power: 60, cost: 1, target: 'enemy', icon: '🕸️',
    effects: [{ t: 'status', on: 'enemy', id: 'web', turns: 2 }],
  },
  {
    id: 'r2_chitinCoin', name: 'Хитиновая монета', set: 'relics', rarity: 'common', kind: 'utility',
    power: 50, cost: 0, target: 'none', icon: '🪙',
    effects: [{ t: 'energy', v: 1 }],
    exhaust: true,
  },
  {
    id: 'r2_resinDrop', name: 'Капля смолы', set: 'relics', rarity: 'common', kind: 'heal',
    power: 55, cost: 0, target: 'merc', icon: '🟤',
    effects: [{ t: 'heal', v: 10, target: 'merc' }],
  },
  {
    id: 'r2_silkCharm', name: 'Шёлковый оберег', set: 'relics', rarity: 'common', kind: 'buff',
    power: 65, cost: 0, target: 'merc', icon: '🧿',
    effects: [{ t: 'status', on: 'merc', id: 'dodge', v: 15, turns: 1 }],
  },
  {
    id: 'r2_boneTotem', name: 'Костяной тотем', set: 'relics', rarity: 'common', kind: 'buff',
    power: 75, cost: 1, target: 'merc', icon: '🦴',
    effects: [{ t: 'status', on: 'merc', id: 'thorns', v: 4 }],
    once: true,
    keywords: ['once'],
  },
  {
    id: 'r2_eggShard', name: 'Осколок яйца', set: 'relics', rarity: 'common', kind: 'attack',
    power: 75, cost: 1, target: 'enemy', icon: '🥚',
    effects: [
      { t: 'damage', v: 7 },
      { t: 'status', on: 'enemy', id: 'poison', v: 2 },
    ],
  },
  {
    id: 'r2_pheromoneVial', name: 'Флакон феромона', set: 'relics', rarity: 'common', kind: 'buff',
    power: 75, cost: 1, target: 'allMercs', icon: '🟡',
    effects: [
      { t: 'status', on: 'allMercs', id: 'taunt', turns: 2 },
      { t: 'shield', v: 8, target: 'allMercs' },
    ],
  },
  {
    id: 'r2_relicDust', name: 'Реликтовая пыль', set: 'relics', rarity: 'common', kind: 'debuff',
    power: 80, cost: 1, target: 'enemy', icon: '✨',
    effects: [
      { t: 'status', on: 'enemy', id: 'weak', turns: 2 },
      { t: 'status', on: 'enemy', id: 'vuln', turns: 1 },
    ],
  },
  {
    id: 'r2_ancientCoin', name: 'Древняя монета', set: 'relics', rarity: 'common', kind: 'utility',
    power: 70, cost: 0, target: 'none', icon: '🪙',
    effects: [{ t: 'scry', v: 2 }, { t: 'draw', v: 1 }],
  },
  {
    id: 'r2_echoStone', name: 'Эхо-камень', set: 'relics', rarity: 'uncommon', kind: 'attack',
    power: 115, cost: 1, target: 'enemy', icon: '📯',
    effects: [{ t: 'damage', v: 7 }],
    keywords: ['echo'],
  },
  {
    id: 'r2_silkIdol', name: 'Шёлковый идол', set: 'relics', rarity: 'uncommon', kind: 'buff',
    power: 120, cost: 1, target: 'allMercs', icon: '🗿',
    effects: [{ t: 'status', on: 'allMercs', id: 'thorns', v: 5 }],
    once: true,
    keywords: ['once'],
  },
  {
    id: 'r2_hiveLens', name: 'Линза улья', set: 'relics', rarity: 'uncommon', kind: 'utility',
    power: 115, cost: 0, target: 'none', icon: '🔍',
    effects: [{ t: 'draw', v: 2 }, { t: 'scry', v: 2 }],
  },
  {
    id: 'r2_relicBlade', name: 'Реликтовый клинок', set: 'relics', rarity: 'uncommon', kind: 'attack',
    power: 125, cost: 1, target: 'enemy', icon: '🗡️',
    effects: [{ t: 'damage', v: 13, pierce: true }],
  },
  {
    id: 'r2_amberWard', name: 'Янтарный оберег', set: 'relics', rarity: 'uncommon', kind: 'shield',
    power: 125, cost: 1, target: 'merc', icon: '🟠',
    effects: [
      { t: 'shield', v: 20, target: 'merc' },
      { t: 'status', on: 'merc', id: 'barrier', v: 10 },
    ],
  },
  {
    id: 'r2_broodCharm', name: 'Оберег выводка', set: 'relics', rarity: 'uncommon', kind: 'heal',
    power: 130, cost: 2, target: 'allMercs', icon: '❤️',
    effects: [
      { t: 'heal', v: 16, target: 'allMercs' },
      { t: 'status', on: 'allMercs', id: 'cleanse' },
    ],
  },
  {
    id: 'r2_queenSigil', name: 'Печать матки', set: 'relics', rarity: 'uncommon', kind: 'buff',
    power: 120, cost: 1, target: 'allMercs', icon: '👑',
    effects: [{ t: 'maxArmor', v: 5, target: 'allMercs' }],
    once: true,
    keywords: ['once'],
  },
  {
    id: 'r2_echoPulse', name: 'Эхо-импульс', set: 'relics', rarity: 'uncommon', kind: 'aoe',
    power: 130, cost: 1, target: 'allEnemies', icon: '📡',
    effects: [{ t: 'damage', v: 6, target: 'allEnemies' }],
    keywords: ['echo'],
  },
  {
    id: 'r2_relicArmor', name: 'Реликтовая броня', set: 'relics', rarity: 'rare', kind: 'shield',
    power: 170, cost: 2, target: 'merc', icon: '🔰',
    effects: [
      { t: 'maxArmor', v: 10, target: 'merc' },
      { t: 'shield', v: 22, target: 'merc' },
    ],
    once: true,
    keywords: ['once'],
  },
  {
    id: 'r2_hiveBanner', name: 'Знамя улья', set: 'relics', rarity: 'rare', kind: 'buff',
    power: 165, cost: 1, target: 'allMercs', icon: '🚩',
    effects: [
      { t: 'energy', v: 1 },
      { t: 'status', on: 'allMercs', id: 'thorns', v: 6 },
    ],
    once: true,
    keywords: ['once'],
  },
  {
    id: 'r2_amberHeart', name: 'Янтарное сердце', set: 'relics', rarity: 'rare', kind: 'heal',
    power: 170, cost: 2, target: 'allMercs', icon: '🟠',
    effects: [{ t: 'heal', v: 30, target: 'allMercs' }],
  },
  {
    id: 'r2_silkCrown', name: 'Шёлковая корона', set: 'relics', rarity: 'rare', kind: 'buff',
    power: 175, cost: 2, target: 'allMercs', icon: '👑',
    effects: [
      { t: 'status', on: 'allMercs', id: 'dodge', v: 25, turns: 2 },
      { t: 'shield', v: 20, target: 'allMercs' },
    ],
    once: true,
    keywords: ['once'],
  },
  {
    id: 'r2_relicStorm', name: 'Реликтовый шторм', set: 'relics', rarity: 'rare', kind: 'aoe',
    power: 175, cost: 3, target: 'allEnemies', icon: '🌪️',
    effects: [
      { t: 'damage', v: 11, target: 'allEnemies' },
      { t: 'status', on: 'allEnemies', id: 'web', turns: 1 },
    ],
  },
  {
    id: 'r2_ancientIdol', name: 'Древний идол', set: 'relics', rarity: 'epic', kind: 'buff',
    power: 215, cost: 3, target: 'allMercs', icon: '🗿',
    effects: [
      { t: 'maxArmor', v: 8, target: 'allMercs' },
      { t: 'status', on: 'allMercs', id: 'thorns', v: 7 },
    ],
    once: true,
    keywords: ['once'],
  },
  {
    id: 'r2_hiveAscendant', name: 'Улей возвышенный', set: 'relics', rarity: 'legendary', kind: 'heal',
    power: 265, cost: 3, target: 'allMercs', icon: '🐝',
    effects: [
      { t: 'heal', v: 40, target: 'allMercs' },
      { t: 'revive', v: 0.5 },
      { t: 'energy', v: 2 },
    ],
    once: true,
    keywords: ['once'],
  },
];

export const CARDS: CardDef[] = CARD_LIST;
export const CARD_MAP: Record<string, CardDef> = Object.fromEntries(CARD_LIST.map((c) => [c.id, c]));

export const powerColor = (power: number): string => {
  if (power >= 200) return '#fbbf24';
  if (power >= 150) return '#fb923c';
  if (power >= 125) return '#c084fc';
  if (power >= 100) return '#38bdf8';
  if (power >= 75) return '#4ade80';
  return '#9ca3af';
};

export const cardLevelMult = (level: number): number => {
  const lvl = Math.max(1, Math.min(MAX_CARD_LEVEL, Math.round(level || 1)));
  return 1 + 0.1 * (lvl - 1);
};

const scaleEffect = (e: Effect, mult: number): Effect => {
  switch (e.t) {
    case 'damage':
      return { ...e, v: Math.round(e.v * mult) };
    case 'heal':
      return { ...e, v: Math.round(e.v * mult) };
    case 'shield':
      return {
        ...e,
        v: Math.round(e.v * mult),
        ...(e.woundedBonus ? { woundedBonus: Math.round(e.woundedBonus * mult) } : null),
      };
    case 'maxArmor':
      return { ...e, v: Math.round(e.v * mult) };
    default:
      return { ...e };
  }
};

/** Карта на конкретном уровне: мерж l4/l7 + линейный скейл чисел эффектов. */
export const effectiveCard = (def: CardDef, level: number): CardDef => {
  const lvl = Math.max(1, Math.min(MAX_CARD_LEVEL, Math.round(level || 1)));
  let effects: Effect[] = def.effects.map((e) => ({ ...e }));
  let merged: CardDef = { ...def, effects: [] };

  for (const patch of [lvl >= 4 ? def.l4 : null, lvl >= 7 ? def.l7 : null]) {
    if (!patch) continue;
    const { add, replaceEffects, ...rest } = patch;
    merged = { ...merged, ...rest } as CardDef;
    if (replaceEffects) effects = replaceEffects.map((e) => ({ ...e }));
    else if (add) effects = [...effects, ...add.map((e) => ({ ...e }))];
  }

  const mult = cardLevelMult(lvl);
  merged.effects = effects.map((e) => scaleEffect(e, mult));
  for (const key of ['bonusLow', 'bonusBoss'] as const) {
    const value = merged[key];
    if (typeof value === 'number') merged[key] = Math.round(value * mult);
  }
  return merged;
};

// ---------------------------------------------------------------------------
// Текст карты
// ---------------------------------------------------------------------------

const plural = (n: number, one: string, few: string, many: string): string => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};

const STATUS_LABEL: Record<StatusId, string> = {
  vuln: 'уязвимость',
  weak: 'слабость',
  stun: 'оглушение',
  burn: 'горение',
  poison: 'яд',
  bleed: 'кровотечение',
  armorBreak: 'пробой брони',
  web: 'паутина',
  barrier: 'барьер',
  regen: 'регенерация',
  thorns: 'шипы',
  taunt: 'провокация',
  dodge: 'уклонение',
  cleanse: 'очищение',
  healDown: '−хил',
  armorDown: '−броня',
};

const statusNoun = (id: StatusId, v: number, turns: number): string => {
  const t = `${turns} ${plural(turns, 'ход', 'хода', 'ходов')}`;
  switch (id) {
    case 'vuln': return `уязвимость на ${t}`;
    case 'weak': return `слабость на ${t}`;
    case 'stun': return `оглушение на ${t}`;
    case 'armorBreak': return `пробой брони на ${t}`;
    case 'web': return `паутину на ${t}`;
    case 'healDown': return `−50% хила на ${t}`;
    case 'armorDown': return `−50% восстановления брони на ${t}`;
    case 'taunt': return `провокацию на ${t}`;
    default: return `${STATUS_LABEL[id]} ${v}`;
  }
};

const effectText = (e: Effect, def: CardDef, firstDamage: boolean): string => {
  switch (e.t) {
    case 'damage': {
      const all = e.target === 'allEnemies';
      const many = e.target === 'randomEnemy';
      let text = e.hits && e.hits > 1 ? `${e.hits}×${e.v}` : `${e.v}`;
      text += all ? ' урона всем врагам' : many ? ' урона случайному врагу' : ' урона';
      if (e.pierce) text += ' (игнорирует броню)';
      if (firstDamage) {
        if (def.bonusLow) text += `, +${def.bonusLow} по раненым`;
        if (def.bonusBoss) text += `, +${def.bonusBoss} по элите и боссу`;
        if (def.exec) text += `, ×${def.execMult || 2} ниже ${Math.round(def.exec * 100)}% HP`;
      }
      return `${text}.`;
    }
    case 'heal': {
      if (e.target === 'allMercs') return `Лечит всех наёмников на ${e.v} HP.`;
      if (e.target === 'front') return `Лечит переднего наёмника на ${e.v} HP.`;
      return `Лечит наёмника на ${e.v} HP.`;
    }
    case 'shield': {
      const who = e.target === 'allMercs' ? 'всем наёмникам' : e.target === 'front' ? 'переднему наёмнику' : 'наёмнику';
      let text = `${e.v} щита ${who}.`;
      if (e.woundedBonus) text += ` +${e.woundedBonus}, если он ниже 30% HP.`;
      return text;
    }
    case 'maxArmor':
      return `+${e.v} к макс. броне до конца боя${e.target === 'allMercs' ? ' всем наёмникам' : ''}.`;
    case 'status': {
      const turns = Math.max(1, Math.round(e.turns ?? 1));
      const v = Math.max(0, Math.round(e.v ?? turns));
      if (e.id === 'cleanse') {
        if (e.on === 'allMercs') return 'Снимает дебаффы со всех наёмников.';
        return 'Снимает дебаффы с наёмника.';
      }
      const body = statusNoun(e.id, v, turns);
      if (e.on === 'allEnemies') return `Все враги получают ${body}.`;
      if (e.on === 'randomEnemy') return `Случайный враг получает ${body}.`;
      if (e.on === 'allMercs') return `Все наёмники получают ${body}.`;
      if (e.on === 'merc') return `Наёмник получает ${body}.`;
      return `Цель получает ${body}.`;
    }
    case 'draw':
      return `Добирает ${e.v} ${plural(e.v, 'карту', 'карты', 'карт')}.`;
    case 'energy':
      return `+${e.v} ${plural(e.v, 'энергия', 'энергии', 'энергии')}.`;
    case 'discard':
      return `Сбрасывает ${e.v} ${plural(e.v, 'карту', 'карты', 'карт')}.`;
    case 'scry':
      return `Смотрит ${e.v} верхних карт колоды.`;
    case 'revive':
      return `Поднимает павшего наёмника с ${Math.round(e.v * 100)}% HP.`;
    case 'transform':
      return `Превращает ${e.v} ${plural(e.v, 'карту', 'карты', 'карт')} в руке в другие.`;
    default:
      return '';
  }
};

const KEYWORD_TEXT: Partial<Record<Keyword, string>> = {
  retain: 'Остаётся в руке.',
  ethereal: 'Сгорает, если не сыграна.',
  innate: 'Всегда в стартовой руке.',
  combo: 'Комбо: усиливается, если в этот ход уже играли карту.',
  xcost: 'Тратит всю энергию.',
  echo: 'Играется дважды.',
  revive: 'Поднимает павшего наёмника.',
  transform: 'Превращает карту в руке в другую.',
  overheat: 'Усиливается каждый раз при игре в этом бою.',
  once: 'Один раз за бой.',
};

/**
 * Текст карты.
 * `compact` — для тела карты: крит/ярость уже показаны бейджами,
 * поэтому в теле они не дублируются (полный текст остаётся в title).
 */
export const cardText = (def: CardDef, level: number, compact = false): string => {
  const c = effectiveCard(def, level);
  let text: string;

  if (def.text) {
    const map: Record<string, unknown> = {
      dmg: c.effects.find((e) => e.t === 'damage')?.v,
      hits: c.effects.find((e) => e.t === 'damage')?.hits,
    };
    text = def.text.replace(/\{(\w+)\}/g, (_, key: string) => String(map[key] ?? ''));
  } else {
    let seenDamage = false;
    const parts: string[] = [];
    for (const e of c.effects) {
      const isDamage = e.t === 'damage';
      const line = effectText(e, c, isDamage && !seenDamage);
      if (isDamage) seenDamage = true;
      if (line) parts.push(line);
    }
    text = parts.join(' ');
  }

  const extras: string[] = [];
  if (level >= 4 && def.add4) extras.push(def.add4);
  if (level >= 7 && def.add7) extras.push(def.add7);
  if (!compact && c.critChance) extras.push(`${c.critChance}% шанс крита ×${c.critMult || 2}.`);
  if (!compact && c.rageChance) extras.push(`${c.rageChance}% шанс ярости: +${Math.round((c.rageMult ?? 0.1) * 100)}% урона до конца боя.`);
  if (c.xcost) extras.push('Тратит всю энергию: сила эффекта × потраченная энергия.');
  if (c.overheat) extras.push(`+${c.overheat} урона за каждое применение в этом бою.`);
  if (c.combo) {
    const comboText = c.combo.map((e) => effectText(e, c, false)).join(' ');
    if (comboText) extras.push(`Комбо: ${comboText}`);
  }
  if (c.once) extras.push('Один раз за бой.');
  for (const k of c.keywords || []) {
    if ((k === 'combo' && c.combo) || (k === 'xcost' && c.xcost) || (k === 'overheat' && c.overheat) || (k === 'once' && c.once)) continue;
    const kw = KEYWORD_TEXT[k];
    if (kw) extras.push(kw);
  }
  if (c.exhaust) extras.push('Изгоняется до конца боя.');
  if (extras.length) text += ` ${extras.join(' ')}`;
  return text;
};
