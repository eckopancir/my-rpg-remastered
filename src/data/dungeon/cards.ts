/**
 * Тестовый пул карт карточного данжа (20 штук).
 *
 * Числа — заглушки для баланса: арт и финальные цифры будут позже.
 * Цена мощности (power) — бюджет сборки колоды, в бою не используется.
 * Цена энергии (cost) — трата 5 энергии за ход.
 * Апгрейд 1–7: числовые эффекты ×(1 + 0.1×(уровень−1)), цена мощности не меняется.
 */

export type CardKind = 'attack' | 'aoe' | 'heal' | 'shield' | 'debuff' | 'utility';
export type CardTarget = 'enemy' | 'merc' | 'allEnemies' | 'allMercs' | 'none';

export interface CardDef {
  id: string;
  name: string;
  kind: CardKind;
  /** Цена сборки колоды (50..200). */
  power: number;
  /** Цена в бою (0..3). */
  cost: number;
  target: CardTarget;
  icon: string;
  dmg?: number;
  hits?: number;
  heal?: number;
  shield?: number;
  draw?: number;
  energy?: number;
  vuln?: number;
  weak?: number;
  stun?: number;
  /** Порог казни (доля HP цели). */
  exec?: number;
  execMult?: number;
  /** Бонус, если у цели меньше 50% HP. */
  bonusLow?: number;
  /** Бонус по элите/боссу. */
  bonusBoss?: number;
  /** Бонус щита, если наёмник ранен (<30% HP). */
  woundedBonus?: number;
  /** Прибавка к макс. броне до конца боя. */
  maxArmor?: number;
  exhaust?: boolean;
  text: string;
  add4?: string;
  add7?: string;
  l4?: Partial<CardDef>;
  l7?: Partial<CardDef>;
}

const CARD_LIST: CardDef[] = [
  {
    id: 'shot', name: 'Короткая очередь', kind: 'attack', power: 50, cost: 1, target: 'enemy',
    icon: '🔫', dmg: 10,
    text: '{dmg} урона.',
    l4: { vuln: 1 }, add4: 'Накладывает 1 уязвимость.',
    l7: { vuln: 2 }, add7: 'Уязвимость до 2 ходов.',
  },
  {
    id: 'snipe', name: 'Прицельный выстрел', kind: 'attack', power: 75, cost: 1, target: 'enemy',
    icon: '🎯', dmg: 14, bonusLow: 6,
    text: '{dmg} урона. +{bonusLow}, если у цели меньше 50% HP.',
    l7: { vuln: 1 }, add7: 'Накладывает 1 уязвимость.',
  },
  {
    id: 'shotgun', name: 'Дробовик в упор', kind: 'attack', power: 125, cost: 2, target: 'enemy',
    icon: '💥', dmg: 26,
    text: '{dmg} урона.',
  },
  {
    id: 'heavy', name: 'Крупный калибр', kind: 'attack', power: 125, cost: 2, target: 'enemy',
    icon: '🪓', dmg: 20, bonusBoss: 8,
    text: '{dmg} урона. +{bonusBoss} по элите и боссу.',
    l7: { weak: 1 }, add7: 'Накладывает 1 слабость.',
  },
  {
    id: 'grenade', name: 'Граната', kind: 'aoe', power: 150, cost: 2, target: 'allEnemies',
    icon: '🧨', dmg: 14,
    text: '{dmg} урона всем врагам.',
    l7: { vuln: 1 }, add7: 'Уязвимость всем на 1 ход.',
  },
  {
    id: 'burst', name: 'Шквал', kind: 'attack', power: 200, cost: 3, target: 'enemy',
    icon: '🌀', dmg: 42,
    text: '{dmg} урона.',
    l7: { draw: 1 }, add7: 'Добирает 1 карту.',
  },
  {
    id: 'execute', name: 'Казнь', kind: 'attack', power: 200, cost: 3, target: 'enemy',
    icon: '☠️', dmg: 30, exec: 0.3, execMult: 2,
    text: '{dmg} урона. Удваивается, если у цели меньше 30% HP.',
    l4: { exec: 0.35 }, add4: 'Порог казни — 35%.',
    l7: { exec: 0.4 }, add7: 'Порог казни — 40%.',
  },
  {
    id: 'tracers', name: 'Трассеры', kind: 'attack', power: 100, cost: 2, target: 'enemy',
    icon: '✳️', dmg: 8, hits: 3,
    text: '{hits}×{dmg} урона одной цели.',
    l7: { hits: 4 }, add7: '4 удара вместо 3.',
  },
  {
    id: 'overload', name: 'Перегрузка', kind: 'aoe', power: 200, cost: 3, target: 'allEnemies',
    icon: '⚡', dmg: 20, exhaust: true,
    text: '{dmg} урона всем. Изгоняется до конца боя.',
  },
  {
    id: 'dash', name: 'Рывок', kind: 'attack', power: 100, cost: 1, target: 'enemy',
    icon: '🏃', dmg: 12, shield: 10,
    text: '{dmg} урона. Переднему наёмнику — {shield} щита.',
  },
  {
    id: 'mark', name: 'Метка снайпера', kind: 'debuff', power: 50, cost: 0, target: 'enemy',
    icon: '🔻', vuln: 2,
    text: 'Цель получает +50% урона {vuln} хода.',
    l4: { vuln: 3 }, add4: 'Длительность — 3 хода.',
    l7: { draw: 1 }, add7: 'Добирает 1 карту.',
  },
  {
    id: 'smoke', name: 'Дымовая завеса', kind: 'debuff', power: 100, cost: 1, target: 'allEnemies',
    icon: '🌫️', weak: 2,
    text: 'Все враги получают слабость на {weak} хода.',
    l7: { dmg: 6 }, add7: 'Наносит 6 урона всем.',
  },
  {
    id: 'cover', name: 'Прикрытие', kind: 'shield', power: 75, cost: 1, target: 'merc',
    icon: '🛡️', shield: 25,
    text: 'Наёмнику — {shield} щита на следующий ход.',
    l7: { maxArmor: 5 }, add7: '+5 к макс. броне до конца боя.',
  },
  {
    id: 'repair', name: 'Ремонт брони', kind: 'heal', power: 100, cost: 1, target: 'merc',
    icon: '🔧', heal: 28,
    text: 'Лечит наёмника на {heal} HP.',
    l7: { draw: 1 }, add7: 'Добирает 1 карту.',
  },
  {
    id: 'stim', name: 'Стимулятор', kind: 'heal', power: 125, cost: 1, target: 'merc',
    icon: '💉', heal: 18, draw: 1,
    text: 'Лечит на {heal} HP. Добирает {draw} карту.',
    l7: { draw: 2 }, add7: 'Добирает 2 карты.',
  },
  {
    id: 'medkit', name: 'Медпакет', kind: 'heal', power: 150, cost: 2, target: 'allMercs',
    icon: '🧰', heal: 16,
    text: 'Лечит всех наёмников на {heal} HP.',
    l7: { draw: 1 }, add7: 'Добирает 1 карту.',
  },
  {
    id: 'order', name: 'Тактический приказ', kind: 'utility', power: 100, cost: 0, target: 'none',
    icon: '📢', energy: 1, draw: 1,
    text: '+{energy} энергия. Добирает {draw} карту.',
    l4: { draw: 2 }, add4: 'Добирает 2 карты.',
    l7: { energy: 2 }, add7: '+2 энергии.',
  },
  {
    id: 'scout', name: 'Разведка', kind: 'utility', power: 75, cost: 1, target: 'none',
    icon: '🔭', draw: 2,
    text: 'Добирает {draw} карты.',
    l4: { draw: 3 }, add4: 'Добирает 3 карты.',
    l7: { energy: 1 }, add7: '+1 энергия.',
  },
  {
    id: 'flashbang', name: 'Оглушающая граната', kind: 'aoe', power: 150, cost: 2, target: 'allEnemies',
    icon: '💫', dmg: 8, stun: 1,
    text: '{dmg} урона всем. Оглушает одного врага на {stun} ход.',
    l7: { stun: 2 }, add7: 'Оглушение на 2 хода.',
  },
  {
    id: 'lastStand', name: 'Последний рубеж', kind: 'shield', power: 150, cost: 2, target: 'merc',
    icon: '🪨', shield: 50, woundedBonus: 25,
    text: '{shield} щита наёмнику. +{woundedBonus}, если у него меньше 30% HP.',
    l7: { maxArmor: 5 }, add7: '+5 к макс. броне до конца боя.',
  },
];

export const CARDS: CardDef[] = CARD_LIST;
export const CARD_MAP: Record<string, CardDef> = Object.fromEntries(CARD_LIST.map((c) => [c.id, c]));

export const MAX_CARD_LEVEL = 7;

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

const SCALE_KEYS = ['dmg', 'heal', 'shield', 'bonusLow', 'bonusBoss', 'woundedBonus'] as const;

/** Карта на конкретном уровне: мерж l4/l7 + линейный скейл чисел. */
export const effectiveCard = (def: CardDef, level: number): CardDef => {
  const lvl = Math.max(1, Math.min(MAX_CARD_LEVEL, Math.round(level || 1)));
  const merged: CardDef = {
    ...def,
    ...(lvl >= 4 ? def.l4 : null),
    ...(lvl >= 7 ? def.l7 : null),
  };
  const mult = cardLevelMult(lvl);
  for (const key of SCALE_KEYS) {
    const value = merged[key];
    if (typeof value === 'number') {
      (merged as unknown as Record<string, number>)[key] = Math.round(value * mult);
    }
  }
  return merged;
};

export const cardText = (def: CardDef, level: number): string => {
  const c = effectiveCard(def, level);
  const map: Record<string, unknown> = {
    dmg: c.dmg, heal: c.heal, shield: c.shield, draw: c.draw, energy: c.energy,
    vuln: c.vuln, weak: c.weak, stun: c.stun, hits: c.hits,
    bonusLow: c.bonusLow, bonusBoss: c.bonusBoss, woundedBonus: c.woundedBonus,
    maxArmor: c.maxArmor,
  };
  let text = def.text.replace(/\{(\w+)\}/g, (_, key: string) => String(map[key] ?? ''));
  const extras: string[] = [];
  if (level >= 4 && def.add4) extras.push(def.add4);
  if (level >= 7 && def.add7) extras.push(def.add7);
  if (extras.length) text += ` ${extras.join(' ')}`;
  return text;
};
