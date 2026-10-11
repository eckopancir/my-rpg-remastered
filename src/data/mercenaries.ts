/** Наёмники для стычек: роли, билды, способности, звёзды, цены. */

export type MercRole = 'tank' | 'medic' | 'mechanic';
export type MercBuild = 'juggernaut' | 'fortress' | 'elena' | 'boris' | 'mechanic';

export interface MercAbilityDef {
  /** Звезда, открывающая способность (1..5). */
  star: number;
  id: string;
  name: string;
  desc: string;
  kind: 'passive' | 'active';
  /** КД в ходах (для активных). */
  cd?: number;
  sound: string;
}

export interface MercBuildDef {
  role: MercRole;
  build: MercBuild;
  name: string;
  title: string;
  /** Слот оружия: у танка пистолет+щит, у хила пистолет, у механика автомат. */
  weapon: { slot: 'weapon1' | 'weapon2'; group: string; shield: boolean };
  model: string;
  abilities: MercAbilityDef[];
}

export const MERC_BUILDS: Record<MercBuild, MercBuildDef> = {
  juggernaut: {
    role: 'tank', build: 'juggernaut', name: 'Джаггернаут', title: 'Танк А',
    weapon: { slot: 'weapon2', group: 'pistol', shield: true }, model: 'tank',
    abilities: [
      { star: 1, id: 'jug_redirect', name: 'Живой щит', desc: 'Пассивно: пока жив, 30% урона по команде перенаправляется ему', kind: 'passive', sound: 'block' },
      { star: 2, id: 'jug_wall', name: 'Стена', desc: '−50% входящего урона себе, 2 хода (КД 8)', kind: 'active', cd: 8, sound: 'invis' },
      { star: 3, id: 'jug_hp', name: 'Туша', desc: 'Пассивно: +25% к max HP', kind: 'passive', sound: 'Aeon_Disk' },
      { star: 4, id: 'jug_regen', name: 'Второе дыхание', desc: 'Пассивно: +5% HP каждый ход', kind: 'passive', sound: 'healer' },
      { star: 5, id: 'jug_last', name: 'Последний рубеж', desc: 'HP <30%: −80% входящего на 1 ход (КД 10)', kind: 'active', cd: 10, sound: 'block' },
    ],
  },
  fortress: {
    role: 'tank', build: 'fortress', name: 'Крепость', title: 'Танк Б',
    weapon: { slot: 'weapon2', group: 'pistol', shield: true }, model: 'tank',
    abilities: [
      { star: 1, id: 'frt_redirect', name: 'Живой щит', desc: 'Пассивно: пока жив, 30% урона по команде перенаправляется ему', kind: 'passive', sound: 'block' },
      { star: 2, id: 'frt_dodge', name: 'Дым', desc: '+30% уклонения себе, 3 хода (КД 8)', kind: 'active', cd: 8, sound: 'evasion' },
      { star: 3, id: 'frt_block', name: 'Плита', desc: 'Пассивно: +5% блока', kind: 'passive', sound: 'block' },
      { star: 4, id: 'frt_armor', name: 'Наварка', desc: 'Пассивно: +2.5% брони каждый ход', kind: 'passive', sound: 'reload' },
      { star: 5, id: 'frt_ghost', name: 'Призрак', desc: 'HP <30%: уклонение 100% на 1 ход (КД 10)', kind: 'active', cd: 10, sound: 'invis' },
    ],
  },
  elena: {
    role: 'medic', build: 'elena', name: 'Елена', title: 'Медик А',
    weapon: { slot: 'weapon2', group: 'pistol', shield: false }, model: 'medic',
    abilities: [
      { star: 1, id: 'eln_power', name: 'Сильные руки', desc: 'Пассивно: лечение от выстрелов ×2', kind: 'passive', sound: 'healer' },
      { star: 2, id: 'eln_zone', name: 'Поле жизни 5×5', desc: 'Зона хила 10%/ход, 3 хода, цель — союзник <80% (КД 10)', kind: 'active', cd: 10, sound: 'grenadegun' },
      { star: 3, id: 'eln_grenade', name: 'Лечебная граната', desc: '+25% HP союзнику <80%, радиус 14 (КД 10)', kind: 'active', cd: 10, sound: 'grenadeBoom' },
      { star: 4, id: 'eln_stim', name: 'Стимулятор крови', desc: '+100% вампиризма на 1 ход, цель <90%, радиус 14 (КД 10)', kind: 'active', cd: 10, sound: '1bbfc9b5f4347f2' },
      { star: 5, id: 'eln_rez', name: 'Дефибрилляция', desc: 'Воскресить союзника с 25% HP, радиус 14 (КД 999)', kind: 'active', cd: 999, sound: 'Aeon_Disk' },
    ],
  },
  boris: {
    role: 'medic', build: 'boris', name: 'Борис', title: 'Медик Б',
    weapon: { slot: 'weapon2', group: 'pistol', shield: false }, model: 'medic',
    abilities: [
      { star: 1, id: 'brs_power', name: 'Сильные руки', desc: 'Пассивно: лечение от выстрелов ×2', kind: 'passive', sound: 'healer' },
      { star: 2, id: 'brs_wave', name: 'Волна жизни', desc: 'Круг R5 вокруг раненого <80%: 10%/ход, 3 хода (КД 10)', kind: 'active', cd: 10, sound: 'healer' },
      { star: 3, id: 'brs_bandage', name: 'Бинт', desc: '+5% HP/ход 10 ходов, цель <80%, радиус 14 (КД 10)', kind: 'active', cd: 10, sound: 'healer' },
      { star: 4, id: 'brs_stim', name: 'Стимулятор регенерации', desc: '+200% регенерации на 1 ход, цель <90%, радиус 14 (КД 10)', kind: 'active', cd: 10, sound: '1bbfc9b5f4347f2' },
      { star: 5, id: 'brs_rez', name: 'Дефибрилляция', desc: 'Воскресить союзника с 25% HP, радиус 14 (КД 999)', kind: 'active', cd: 999, sound: 'Aeon_Disk' },
    ],
  },
  mechanic: {
    role: 'mechanic', build: 'mechanic', name: 'Техник', title: 'Саппорт',
    weapon: { slot: 'weapon2', group: 'rifle', shield: false }, model: 'military2',
    abilities: [
      { star: 1, id: 'mch_stun', name: 'ЭМИ-разряд', desc: 'Стан врагу на 1 ход, радиус 10 (КД 8)', kind: 'active', cd: 8, sound: 'melee' },
      { star: 2, id: 'mch_dmg', name: 'Аура урона', desc: '+20% урона команде в 10 кл, 2 хода (КД 8)', kind: 'active', cd: 8, sound: 'Aeon_Disk' },
      { star: 3, id: 'mch_blind', name: 'Ослепление', desc: '−30% меткости врагу (не танк/медик), 1 ход, радиус 14 (КД 8)', kind: 'active', cd: 8, sound: 'shotenemy' },
      { star: 4, id: 'mch_acc', name: 'Аура наведения', desc: '+20% меткости команде в 10 кл, 2 хода (КД 8)', kind: 'active', cd: 8, sound: 'reload' },
      { star: 5, id: 'mch_last', name: 'Последний подарок', desc: 'Пассивно: смерть лечит команду на 25% HP', kind: 'passive', sound: 'wilhelm_scream' },
    ],
  },
};

export const MERC_ROLE_LABEL: Record<MercRole, string> = {
  tank: '🛡️ Танк',
  medic: '💉 Медик',
  mechanic: '🔧 Техник',
};

/** Слоты в экипировке жёстко по ролям: 1 — танк, 2 — медик, 4 — механик. */
export const MERC_SLOTS = ['merc1', 'merc2', 'merc3'] as const;
export type MercSlot = typeof MERC_SLOTS[number];
export const MERC_SLOT_ROLE: Record<MercSlot, MercRole> = {
  merc1: 'tank',
  merc2: 'medic',
  merc3: 'mechanic',
};
export const MERC_SLOT_LABEL: Record<MercSlot, string> = {
  merc1: '1 позиция · танк',
  merc2: '2 позиция · медик',
  merc3: '4 позиция · техник',
};

export interface OwnedMerc {
  id: string;
  role: MercRole;
  build: MercBuild;
  stars: number;
  name: string;
  /** Экипировка: оружие + одежда (как у игрока, урезанный набор слотов). */
  equipment: Record<string, any | null>;
}

export const MERC_GEAR_SLOTS: Record<MercRole, string[]> = {
  tank: ['weapon2', 'shield', 'head', 'armor', 'pants', 'gloves', 'boots'],
  medic: ['weapon2', 'head', 'armor', 'pants', 'gloves', 'boots'],
  mechanic: ['weapon2', 'head', 'armor', 'pants', 'gloves', 'boots'],
};

export const emptyMercEquipment = (): Record<string, any | null> => ({
  weapon2: null, shield: null, head: null, armor: null,
  pants: null, gloves: null, boots: null,
});

/** Цена звезды: 5★ — самый дорогой товар игры. */
export const MERC_STAR_PRICE = (level: number, stars: number): number => {
  const base = Math.max(1, level) * 200 + 500;
  return Math.round(base * [1, 1, 4, 12, 40, 150][Math.max(1, Math.min(5, stars))]);
};

const TANK_NAMES = ['Гром', 'Бастион', 'Утёс', 'Кабан', 'Щит'];
const MEDIC_NAMES = ['Елена', 'Борис', 'Пульс', 'Шов', 'Айболит'];
const MECH_NAMES = ['Гаечка', 'Вольт', 'Кулибин', 'Паяльник', 'Шестерня'];

const pickName = (role: MercRole, build: MercBuild): string => {
  if (build === 'elena') return 'Елена';
  if (build === 'boris') return 'Борис';
  const pool = role === 'tank' ? TANK_NAMES : role === 'medic' ? MEDIC_NAMES : MECH_NAMES;
  return pool[Math.floor(Math.random() * pool.length)];
};

const rollStars = (): number => {
  const r = Math.random() * 100;
  if (r < 40) return 1;
  if (r < 68) return 2;
  if (r < 86) return 3;
  if (r < 97) return 4;
  return 5;
};

const rollBuild = (role: MercRole): MercBuild => {
  if (role === 'tank') return Math.random() < 0.5 ? 'juggernaut' : 'fortress';
  if (role === 'medic') return Math.random() < 0.5 ? 'elena' : 'boris';
  return 'mechanic';
};

export interface MercOffer {
  id: string;
  role: MercRole;
  build: MercBuild;
  stars: number;
  name: string;
  price: number;
}

/** 3 оффера: танк + медик + механик. */
export function generateMercOffers(level: number): MercOffer[] {
  const roles: MercRole[] = ['tank', 'medic', 'mechanic'];
  return roles.map((role, i) => {
    const build = rollBuild(role);
    const stars = rollStars();
    return {
      id: `merc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${i}`,
      role, build, stars,
      name: pickName(role, build),
      price: MERC_STAR_PRICE(level, stars),
    };
  });
}

export const STAR_COLORS = ['#9ca3af', '#9ca3af', '#4ade80', '#38bdf8', '#c084fc', '#fbbf24'];
export const starsLabel = (n: number): string => '★'.repeat(n) + '☆'.repeat(5 - n);
