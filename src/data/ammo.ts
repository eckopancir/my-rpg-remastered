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
  { key: 'rifle', name: 'Автоматные', icon: '🔶', packName: 'Пачка автоматных патронов', price: 3, desc: 'Штурмовые винтовки и ПП.' },
  { key: 'sniper', name: 'Снайперские', icon: '🎯', packName: 'Пачка снайперских патронов', price: 16, desc: 'Точные винтовки.' },
  { key: 'shell', name: 'Дробь', icon: '🟠', packName: 'Пачка дроби', price: 12, desc: 'Дробовики и обрезы.' },
  { key: 'mg', name: 'Пулемётные', icon: '⛓️', packName: 'Пулемётная лента', price: 3.5, desc: 'Пулемёты и миниганы.' },
  { key: 'energy', name: 'Энергоячейки', icon: '🔋', packName: 'Энергоячейки', price: 17, desc: 'ЭМИ, плазма, термика, гранатомёты.' },
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
  if (/пистолет|глок|beretta|usp|five-seven|стечкин|colt|наган|макаров/.test(n)) return 'pistol';
  if (/мосин|свд|l96|barrett|винторез|птрс|снайпер|предел|оракул/.test(n)) return 'sniper';
  if (/дробовик|обрез|осада|аннигилятор|remington|spas|aa-12|двустволка/.test(n)) return 'shell';
  if (/m134|m60|m249|pkm|миниган|пулем/.test(n)) return 'mg';
  if (/эми|термальн|терма|гравитац|разрядник|импульс|плазм|огнемет|огнемёт|квант|базука|рельсов|рпг|гп-25|гранатомёт|лазер|мультилазер|аннигилятор/.test(n)) return 'energy';
  return 'rifle';
};

export const ammoGroupName = (key: AmmoGroup): string => AMMO_GROUP_MAP[key]?.name ?? key;

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

/** Пачка патронов в инвентарь (агрегируется по имени в stackItems). */
export const makeBulletPack = (group: AmmoGroup, quantity: number): Item => {
  const def = AMMO_GROUP_MAP[group];
  return {
    id: `ammo_${Date.now()}_${bulletSeq++}_${Math.random().toString(36).slice(2, 6)}`,
    name: def.packName,
    displayName: `${def.packName} x${quantity}`,
    type: 'bullet',
    slot: 'bullet',
    rarity: 'normal',
    quality: 'Обычный',
    qualityColor: 'white',
    level: 1,
    stats: {},
    description: `${def.desc} Стак до ${maxStackFor(group)} шт.`,
    ammoGroup: group,
    price: bulletPackPrice(group, quantity),
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
 * Сначала досыпает в неполные стаки (слотов не требует), остаток —
 * новыми пачками в свободные слоты. Возвращает {items, leftover} —
 * leftover не влез (слоты кончились, caller кладёт в инвентарь).
 */
export const addAmmoToPack = (
  contents: Item[],
  group: AmmoGroup,
  n: number,
  maxSlots: number,
): { items: Item[]; leftover: number } => {
  if (n <= 0) return { items: contents, leftover: 0 };
  const packName = AMMO_GROUP_MAP[group].packName;
  const maxStack = maxStackFor(group);
  let rest = n;
  const next: Item[] = contents.map((it) => {
    if (rest > 0 && it.type === 'bullet' && it.name === packName) {
      const q = (it.quantity ?? 1) as number;
      const room = maxStack - q;
      if (room > 0) {
        const add = Math.min(room, rest);
        rest -= add;
        const nq = q + add;
        return { ...it, quantity: nq, displayName: `${packName} x${nq}` };
      }
    }
    return it;
  });
  const freeSlots = Math.max(0, maxSlots - next.length);
  let packs = 0;
  while (rest > 0 && packs < freeSlots) {
    const q = Math.min(rest, maxStack);
    next.push(makeBulletPack(group, q));
    rest -= q;
    packs++;
  }
  return { items: next, leftover: rest };
};
/**
 * Забрать N патронов группы из содержимого рюкзака.
 * Возвращает {items, taken}. Чистая функция — стор обновляет вызывающий.
 */
export const takeAmmoFrom = (contents: Item[], group: AmmoGroup, n: number): { items: Item[]; taken: number } => {
  if (n <= 0) return { items: contents, taken: 0 };
  const packName = AMMO_GROUP_MAP[group].packName;
  let need = n;
  let taken = 0;
  const next: Item[] = [];
  for (const it of contents) {
    if (need > 0 && it.type === 'bullet' && it.name === packName) {
      const q = (it.quantity ?? 1) as number;
      const use = Math.min(q, need);
      taken += use;
      need -= use;
      if (q > use) next.push({ ...it, quantity: q - use });
    } else {
      next.push(it);
    }
  }
  return { items: next, taken };
};
