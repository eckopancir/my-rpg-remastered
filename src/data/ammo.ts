import type { Item } from '../types/items';

// 6 групп боеприпасов. Стак — 30 шт (по-тарковски).
export type AmmoGroup = 'pistol' | 'rifle' | 'sniper' | 'shell' | 'mg' | 'energy';

export interface AmmoGroupDef {
  key: AmmoGroup;
  name: string;
  icon: string;
  packName: string;
  price: number;
  desc: string;
}

export const AMMO_GROUPS: AmmoGroupDef[] = [
  { key: 'pistol', name: 'Пистолетные', icon: '🔸', packName: 'Пачка пистолетных патронов', price: 1, desc: 'Пистолеты и револьверы.' },
  { key: 'rifle', name: 'Автоматные', icon: '🔶', packName: 'Пачка автоматных патронов', price: 2, desc: 'Штурмовые винтовки и ПП.' },
  { key: 'sniper', name: 'Снайперские', icon: '🎯', packName: 'Пачка снайперских патронов', price: 5, desc: 'Точные винтовки.' },
  { key: 'shell', name: 'Дробь', icon: '🟠', packName: 'Пачка дроби', price: 4, desc: 'Дробовики и обрезы.' },
  { key: 'mg', name: 'Пулемётные', icon: '⛓️', packName: 'Пулемётная лента', price: 1.5, desc: 'Пулемёты и миниганы.' },
  { key: 'energy', name: 'Энергоячейки', icon: '🔋', packName: 'Энергоячейки', price: 6, desc: 'ЭМИ, плазма, термика, гранатомёты.' },
];

export const AMMO_GROUP_MAP: Record<AmmoGroup, AmmoGroupDef> = Object.fromEntries(
  AMMO_GROUPS.map((g) => [g.key, g]),
) as Record<AmmoGroup, AmmoGroupDef>;

export const BULLET_STACK = 30;

/** Размер стака по группе: энергоячейки 15, снайперские 10, лента 100, дробь 10, пистолетные 20. */
export const BULLET_STACKS: Record<AmmoGroup, number> = {
  pistol: 20,
  rifle: 30,
  sniper: 10,
  shell: 10,
  mg: 100,
  energy: 15,
};

export const maxStackFor = (group: AmmoGroup): number => BULLET_STACKS[group] ?? BULLET_STACK;

/**
 * Группа патронов по имени оружия. Явное поле ammoType на предмете
 * имеет приоритет (для будущих исключений), иначе — по ключевым словам.
 */
export const ammoTypeForWeapon = (weapon: { name?: string; ammoType?: string }): AmmoGroup => {
  const explicit = (weapon.ammoType || '') as AmmoGroup;
  if (explicit && AMMO_GROUP_MAP[explicit]) return explicit;
  const n = (weapon.name || '').toLowerCase();
  if (/пистолет|глок|beretta|usp|five-seven|стечкин|stechkin|colt|наган|макаров/.test(n)) return 'pistol';
  if (/мосин|свд|l96|barrett|винторез|птрс|снайпер|предел|оракул/.test(n)) return 'sniper';
  if (/дробовик|обрез|осада|аннигилятор|remington|spas|aa-12|двустволка/.test(n)) return 'shell';
  if (/m134|m60|m249|pkm|миниган|пулем/.test(n)) return 'mg';
  if (/эми|термальн|терма|гравитац|разрядник|импульс|плазм|огнемет|огнемёт|квант|базука|рельсов|рпг|гп-25|гранатомёт|лазер|мультилазер|аннигилятор/.test(n)) return 'energy';
  return 'rifle';
};

export const ammoGroupName = (key: AmmoGroup): string => AMMO_GROUP_MAP[key]?.name ?? key;

/** Порядок качеств для таблиц (индекс 0-6). */
const QUALITY_ORDER = ['Обычный', 'Редкий', 'Раритетный', 'Эпический', 'Смертоносный', 'Легендарный', 'Божественный'];

/** Индекс качества (0-6) по имени; неизвестное — 0. */
export const bulletQualityIndex = (quality?: string): number =>
  Math.max(0, QUALITY_ORDER.indexOf(quality || 'Обычный'));

/** Бонус к урону от качества патронов: +0% и далее +5% за ранг (до +30%). */
export const BULLET_DMG_PCT = [0, 5, 10, 15, 20, 25, 30];

/** Множитель урона выстрела от качества патрона в магазине. */
export const bulletDamageMult = (quality?: string): number =>
  1 + (BULLET_DMG_PCT[Math.min(bulletQualityIndex(quality), BULLET_DMG_PCT.length - 1)] || 0) / 100;

/** Цена пачки по качеству: пологая шкала — патроны расходник, а не реликвия. */
export const BULLET_QUALITY_PRICE: Record<string, number> = {
  'Обычный': 1, 'Редкий': 1.5, 'Раритетный': 2, 'Эпический': 2.5,
  'Смертоносный': 3, 'Легендарный': 4, 'Божественный': 5,
};

export const BULLET_QUALITY_COLORS: Record<string, string> = {
  'Обычный': 'white', 'Редкий': 'lime', 'Раритетный': 'deepskyblue',
  'Эпический': 'mediumpurple', 'Смертоносный': 'red',
  'Легендарный': 'gold', 'Божественный': 'cyan',
};

/** Худшее из двух качеств (смешанный магазин бьёт по худшему). */
export const worseQuality = (a?: string, b?: string): string =>
  bulletQualityIndex(a) <= bulletQualityIndex(b) ? (a || 'Обычный') : (b || 'Обычный');

/**
 * Бонус +патронов от магазина-мода: класс оружия × качество мода.
 * Снайпер 1→6, автомат 5→30, пистолет 2→12, дробь 1→6, пулемёт 10→60, тяжёлое 1→5.
 */
export const MAGAZINE_BONUS: Record<string, number[]> = {
  sniper: [1, 2, 3, 4, 4, 5, 6],
  rifle: [5, 8, 12, 16, 20, 25, 30],
  pistol: [2, 3, 4, 6, 8, 10, 12],
  shotgun: [1, 2, 2, 3, 4, 5, 6],
  mg: [10, 15, 20, 30, 40, 50, 60],
  heavy: [1, 1, 2, 2, 3, 4, 5],
  default: [2, 3, 4, 5, 6, 8, 10],
};

const magazineWeaponClass = (weapon: { name?: string; ammoType?: string }): string => {
  const n = (weapon.name || '').toLowerCase();
  if (/мосин|свд|l96|barrett|винторез|птрс|снайпер|предел|оракул/.test(n)) return 'sniper';
  if (/базук|рпг|гп-25|гранатом|milkor|m79|огнемет|огнемёт|flame/.test(n)) return 'heavy';
  if (/дробовик|обрез|spas|aa-12|remington|двустволка|осада/.test(n)) return 'shotgun';
  const g = ammoTypeForWeapon(weapon);
  if (g === 'pistol') return 'pistol';
  if (g === 'sniper') return 'sniper';
  if (g === 'shell') return 'shotgun';
  if (g === 'mg') return 'mg';
  if (g === 'energy') return 'heavy';
  return 'rifle';
};

/** Итоговая вместимость: база + бонус магазина-мода (по его качеству). */
export const effectiveAmmoCapacity = (item: {
  ammoCapacity?: number; name?: string; ammoType?: string;
  mods?: Record<string, { quality?: string } | any>;
}): number => {
  const base = item.ammoCapacity || 0;
  const mag = item.mods?.['mod_magazine'] as { quality?: string } | undefined;
  if (!mag) return base;
  const qidx = Math.max(0, QUALITY_ORDER.indexOf(mag.quality || 'Обычный'));
  const table = MAGAZINE_BONUS[magazineWeaponClass(item)] || MAGAZINE_BONUS.default;
  return base + (table[Math.min(qidx, table.length - 1)] || 0);
};

/** Цена пачки = цена штуки × количество (без скейла от уровня). */
export const bulletPackPrice = (group: AmmoGroup, quantity: number): number =>
  Math.round((AMMO_GROUP_MAP[group]?.price ?? 0) * quantity);

/**
 * Дальность и поведение выстрела по оружию:
 * огнемёты/дробовики — 5, конус; снайперы — 12; пистолеты — 8;
 * базуки/рпг/гранатомёты — 10 + урон по площади 1; пулемёты — 8, быстрый темп;
 * автоматы — 10; остальное — 10.
 */
export interface WeaponRangeProfile {
  range: number;
  cone?: boolean;
  aoe?: number;
  fast?: boolean;
}

export const weaponRangeProfile = (weapon: { name?: string; ammoType?: string }): WeaponRangeProfile => {
  // Ближний бой (и кулаки): радиус клетка вокруг, бьёт 3 клетки спереди.
  if ((weapon as any).slot === 'weapon1' || (weapon as any).isFists) return { range: 1.5 };
  const n = (weapon.name || '').toLowerCase();
  if (/базук|рпг|гп-25|гранатом|milkor|m79/.test(n)) return { range: 10, aoe: 1 };
  if (/огнемет|огнемёт|flame|дробовик|обрез|spas|aa-12|remington|двустволка|осада/.test(n)) return { range: 5, cone: true };
  const g = ammoTypeForWeapon(weapon);
  if (g === 'sniper') return { range: 12 };
  if (g === 'pistol') return { range: 8 };
  if (g === 'mg') return { range: 8, fast: true };
  if (g === 'shell') return { range: 5, cone: true };
  return { range: 10 };
};

let bulletSeq = 0;

/** Пачка патронов в инвентарь (агрегируется по имени+качеству в stackItems). */
export const makeBulletPack = (group: AmmoGroup, quantity: number, quality = 'Обычный', qualityColor?: string): Item => {
  const def = AMMO_GROUP_MAP[group];
  const qidx = bulletQualityIndex(quality);
  const pct = BULLET_DMG_PCT[Math.min(qidx, BULLET_DMG_PCT.length - 1)] || 0;
  const color = qualityColor || BULLET_QUALITY_COLORS[quality] || 'white';
  return {
    id: `ammo_${Date.now()}_${bulletSeq++}_${Math.random().toString(36).slice(2, 6)}`,
    name: def.packName,
    displayName: quality === 'Обычный' ? `${def.packName} x${quantity}` : `${def.packName} x${quantity} · ${quality}`,
    type: 'bullet',
    slot: 'bullet',
    rarity: 'normal',
    quality,
    qualityColor: color,
    level: 1,
    stats: {},
    description: `${def.desc} Стак до ${maxStackFor(group)} шт.${pct > 0 ? ` +${pct}% к урону выстрела.` : ''}`,
    ammoGroup: group,
    price: bulletPackPrice(group, quantity) * (BULLET_QUALITY_PRICE[quality] ?? 1),
    quantity,
  } as Item;
};

/** Сколько патронов группы в списке предметов (инвентарь). */
export const countAmmo = (items: Pick<Item, 'type' | 'name' | 'quantity'>[], group: AmmoGroup): number => {
  const packName = AMMO_GROUP_MAP[group].packName;
  let total = 0;
  for (const i of items) {
    if (i.type === 'bullet' && i.name === packName) total += i.quantity ?? 1;
  }
  return total;
};

/** Запас группы в содержимом рюкзака (единственный источник для боя). */
export const ammoReserveIn = (contents: Pick<Item, 'type' | 'name' | 'quantity'>[], group: AmmoGroup): number =>
  countAmmo(contents, group);

/**
 * Вернуть N патронов группы в содержимое рюкзака.
 * Сначала досыпает в неполные стаки ТОГО ЖЕ КАЧЕСТВА (слотов не требует), остаток —
 * новыми пачками в свободные слоты. Возвращает {items, leftover} —
 * leftover не влез (слоты кончились, caller кладёт в инвентарь).
 */
export const addAmmoToPack = (
  contents: Item[],
  group: AmmoGroup,
  n: number,
  maxSlots: number,
  quality = 'Обычный',
): { items: Item[]; leftover: number } => {
  if (n <= 0) return { items: contents, leftover: 0 };
  const packName = AMMO_GROUP_MAP[group].packName;
  const maxStack = maxStackFor(group);
  let rest = n;
  const next: Item[] = contents.map((it) => {
    if (rest > 0 && it.type === 'bullet' && it.name === packName && (it.quality || 'Обычный') === quality) {
      const q = (it.quantity ?? 1) as number;
      const room = maxStack - q;
      if (room > 0) {
        const add = Math.min(room, rest);
        rest -= add;
        const nq = q + add;
        return { ...it, quantity: nq, displayName: quality === 'Обычный' ? `${packName} x${nq}` : `${packName} x${nq} · ${quality}` };
      }
    }
    return it;
  });
  const freeSlots = Math.max(0, maxSlots - next.length);
  let packs = 0;
  while (rest > 0 && packs < freeSlots) {
    const q = Math.min(rest, maxStack);
    next.push(makeBulletPack(group, q, quality));
    rest -= q;
    packs++;
  }
  return { items: next, leftover: rest };
};
/**
 * Забрать N патронов группы из содержимого рюкзака.
 * Берёт худшие первыми (хорошие бережём), смешанный забор бьёт по худшему.
 * Возвращает {items, taken, quality}. Чистая функция — стор обновляет вызывающий.
 */
export const takeAmmoFrom = (contents: Item[], group: AmmoGroup, n: number): { items: Item[]; taken: number; quality: string } => {
  if (n <= 0) return { items: contents, taken: 0, quality: 'Обычный' };
  const packName = AMMO_GROUP_MAP[group].packName;
  // Худшие первыми: сначала считаем, сколько есть каждого качества.
  const order = [...contents]
    .map((it, idx) => ({ it, idx }))
    .filter(({ it }) => it.type === 'bullet' && it.name === packName)
    .sort((a, b) => bulletQualityIndex((a.it as any).quality) - bulletQualityIndex((b.it as any).quality));
  let need = n;
  let taken = 0;
  let worstIdx = 6;
  const consumed = new Map<number, number>(); // idx -> сколько забрать
  for (const { it, idx } of order) {
    if (need <= 0) break;
    const q = (it.quantity ?? 1) as number;
    const use = Math.min(q, need);
    consumed.set(idx, use);
    taken += use;
    need -= use;
    worstIdx = Math.min(worstIdx, bulletQualityIndex((it as any).quality));
  }
  if (taken === 0) return { items: contents, taken: 0, quality: 'Обычный' };
  const next: Item[] = [];
  contents.forEach((it, idx) => {
    const use = consumed.get(idx) || 0;
    if (use <= 0) { next.push(it); return; }
    const q = ((it.quantity ?? 1) as number) - use;
    if (q > 0) {
      const qual = (it as any).quality || 'Обычный';
      next.push({ ...it, quantity: q, displayName: qual === 'Обычный' ? `${packName} x${q}` : `${packName} x${q} · ${qual}` });
    }
  });
  return { items: next, taken, quality: QUALITY_ORDER[worstIdx] || 'Обычный' };
};
