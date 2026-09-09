import type { Item } from '../types/items';

// Боевые расходники 1:1 к активным способностям (пассивки ammo_* исключены).
// Поле abilityId связывает штуку со способностью; AP/КД/урон берутся из способности.
// Картинок пока нет — в инвентаре рисуется icon-эмодзи (см. getConsumableIcon).
export interface ConsumableDef {
  name: string;
  abilityId: string;
  icon: string;
  price: number;
  desc: string;
}

const C = (name: string, abilityId: string, icon: string, price: number, desc: string): ConsumableDef => ({
  name, abilityId, icon, price, desc,
});

export const CONSUMABLE_DEFS: ConsumableDef[] = [
  C('Аптечка', 'medkit', '🩹', 20, 'Восстанавливает 25% HP.'),
  C('Регенерирующий бинт', 'regen', '🩼', 13, 'Регенерация HP на 3 хода.'),
  C('Стимулятор', 'stimulant', '💉', 17, '+1 AP на 5 ходов.'),
  C('Укол адреналина', 'adrenaline', '💉', 23, '+20% урона и брони на 5 ходов.'),
  C('Энергетик «Рывок»', 'rush', '🥫', 18, '+10 AP на 1 ход, броня в 0.'),
  C('Одноразовый купол', 'barrier', '🔵', 22, '-50% входящего урона на 3 хода.'),
  C('Дымовая шашка', 'evasion', '💨', 15, '100% уклонение на 1 ход.'),
  C('Жидкая броня', 'shield', '🧴', 25, 'Поглощает 3 атаки полностью.'),
  C('Укрепитель', 'fortify', '🧱', 20, '+100% брони на 3 хода.'),
  C('Метка снайпера', 'snipe', '📍', 33, 'Выстрел 15x с дистанции.'),
  C('Флакон кислоты', 'acid', '🧪', 22, '-50% брони цели + стан.'),
  C('Реактивная граната', 'shock', '🚀', 30, '5x урона цели + стан.'),
  C('Лазерный целеуказатель', 'aimshot', '🔦', 32, '10x урона, мимо брони.'),
  C('Банка энергетика', 'barrage', '🥫', 37, 'Шквал: 20 выстрелов по случайным целям.'),
  C('Осколочная граната', 'grenade', '💣', 27, '5x урона по площади 2x2.'),
  C('Таранный заряд', 'ram', '💥', 20, '2x урона + отброс + стан.'),
  C('Бутылка самогона', 'rage', '🍾', 18, '+50% урона, +100% реген на 3 хода.'),
  C('Артефакт «Прыгун»', 'teleport', '🌀', 42, 'Телепорт на видимую клетку.'),
  C('Хамелеон-спрей', 'invisibility', '🦎', 38, 'Невидимость на 3 хода.'),
  C('Светошумовая граната', 'stun', '💡', 23, 'Стан цели на 3 хода.'),
  C('Кровяной экстракт', 'vampiric', '🩸', 28, '+300% вампиризма.'),
  C('Осадный щит', 'block_stance', '🛡️', 25, '+35% блока на 10 ходов.'),
  C('Подкалиберный комплект', 'armor_shred', '🔩', 22, '+100% пробития на 2 хода.'),
  C('Ветрогон', 'wind_speed', '🌪️', 27, '+400% скорости на 1 ход.'),
  C('Дефибриллятор', 'second_wind', '⚡', 50, 'Бессмертие на 3 хода ценой 90% HP.'),
  C('Наркотики', 'berserk_sacrifice', '💊', 43, 'Сжечь 30% HP, ударить на 50% HP врага.'),
  C('Молот', 'hammer_strike', '🔨', 30, 'x4 урона + стан на 2 хода.'),
  C('Противопехотная мина', 'mine', '⚙️', 28, 'Мина: x10 урона по области.'),
];

export const CONSUMABLE_MAP: Record<string, ConsumableDef> = Object.fromEntries(
  CONSUMABLE_DEFS.map((d) => [d.abilityId, d]),
);

export const getConsumableIcon = (item: Pick<Item, 'abilityId' | 'type'>): string | null => {
  if (item.type !== 'consumable' || !item.abilityId) return null;
  return CONSUMABLE_MAP[item.abilityId]?.icon ?? '📦';
};

let consumableSeq = 0;

/** Штука расходника в инвентарь (стакается по имени — см. stackItems). */
export const makeConsumable = (abilityId: string, quantity = 1): Item => {
  const def = CONSUMABLE_MAP[abilityId];
  if (!def) throw new Error(`unknown consumable ability: ${abilityId}`);
  return {
    id: `cons_${Date.now()}_${consumableSeq++}_${Math.random().toString(36).slice(2, 6)}`,
    name: def.name,
    displayName: def.name,
    type: 'consumable',
    slot: 'consumable',
    rarity: 'normal',
    quality: 'Обычный',
    qualityColor: 'white',
    level: 1,
    stats: {},
    description: `${def.desc} Расходует: 1 шт.`,
    abilityId: def.abilityId,
    price: def.price,
    quantity,
  } as Item;
};
