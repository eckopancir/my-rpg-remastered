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
  | 'echo' | 'revive' | 'transform' | 'overheat';

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
  | { t: 'scry'; v: number };

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
  for (const k of c.keywords || []) {
    const kw = KEYWORD_TEXT[k];
    if (kw) extras.push(kw);
  }
  if (c.exhaust) extras.push('Изгоняется до конца боя.');
  if (extras.length) text += ` ${extras.join(' ')}`;
  return text;
};
