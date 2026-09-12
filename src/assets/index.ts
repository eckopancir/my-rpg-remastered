const itemImageModules = import.meta.glob<{ default: string }>('./Images/items/*.png', { eager: true });
const characterImageModules = import.meta.glob<{ default: string }>('./Images/characters/*.png', { eager: true });
const battleImageModules = import.meta.glob<{ default: string }>('./Images/battle/*.png', { eager: true });
const backgroundImageModules = import.meta.glob<{ default: string }>('./Images/backgrounds/*.{jpg,png}', { eager: true });
const mapImageModules = import.meta.glob<{ default: string }>('./Images/map/*.png', { eager: true });
const uiImageModules = import.meta.glob<{ default: string }>('./Images/ui/*.{png,jpg}', { eager: true });

const extractKey = (path: string): string => path.split('/').pop()?.replace(/\.(png|jpg)$/, '').toLowerCase() || '';

const toMap = (mods: Record<string, { default: string }>): Map<string, string> => {
  const map = new Map<string, string>();
  for (const [path, mod] of Object.entries(mods)) {
    map.set(extractKey(path), mod.default);
  }
  return map;
};

const itemImageMap = toMap(itemImageModules);
const characterImageMap = toMap(characterImageModules);
const battleImageMap = toMap(battleImageModules);
const backgroundImageMap = toMap(backgroundImageModules);
const mapImageMap = toMap(mapImageModules);
const uiImageMap = toMap(uiImageModules);

const RESOURCE_IMAGE_MAP: Record<string, string> = {
  'вода': 'r1', 'изолента': 'r2', 'железо': 'r3', 'дерево': 'r4',
  'инструменты': 'r5', 'гвозди': 'r6', 'пластмасса': 'r7',
  'батарейки': 'res-batteries', 'консервы': 'res-canned', 'лекарства': 'res-meds',
  'провода': 'res-wires', 'редкийсплав': 'res-alloy', 'топливо': 'res-fuel', 'порох': 'res-gunpowder',
  'химреагент': 'res-reagent', 'металлолом': 'res-scrap', 'микросхема': 'res-chip',
};

const MOD_IMAGE_MAP: Record<string, string> = {
  'улучшенный ствол': '14',
  'голографический прицел': '10',
  'ускоренный магазин': '9',
  'пламегаситель': '11',
  'улучшенный ресивер': '12',
  'легкий скелетный приклад': '13',
  'глушительшепот': '11',
  'глушительвампир': '11',
  'глушительспринтер': '11',
  'кровавыйресивер': '12',
  'нарезнойстволпалач': '14',
  'прицелзоркий': '10',
  'тактическийприклад': '13',
  'удлиненныймагазин': '9',
  'барабанныймагазин': '9',
};

/** Картинка мода по его слоту (новые спрайты из items/). */
const MOD_SLOT_IMAGE_MAP: Record<string, string> = {
  mod_muzzle: 'дуло',
  mod_harness: 'крепление',
  mod_blade: 'лезвие',
  mod_magazine: 'магазин',
  mod_pommel: 'обух',
  mod_stock: 'приклад',
  mod_scope: 'прицел',
  mod_receiver: 'ресивер',
  mod_handle: 'рукоять',
  mod_barrel: 'ствол',
  mod_lining: 'арамидный внутренний слой',
  mod_hardshell: 'композитный внешний слой',
  mod_utility: 'система',
  mod_patch: 'бронепластина',
};

/** Картинка сферы по стату: 4 орба + стихия на существующих. */
const SCHEME_IMAGE_MAP: Record<string, string> = {
  crit: 'scheme_crit', speed: 'scheme_crit', accuracy: 'scheme_crit',
  armor: 'scheme_armor', evasion: 'scheme_armor',
  damage: 'scheme_damage', vampir: 'scheme_damage', block: 'scheme_damage',
  regen: 'scheme_regen', punching: 'scheme_regen', maxHp: 'scheme_regen',
  dpsfire: 'scheme_damage', dpsemi: 'scheme_armor', dpstoxis: 'scheme_regen', dpsextro: 'scheme_crit',
};

/** Картинка сферы по стату бонуса; фолбэк — крит-орб. */
export const getSchemeImage = (stat?: string): string | undefined => {
  const key = SCHEME_IMAGE_MAP[(stat || '').toLowerCase()] || 'scheme_crit';
  return itemImageMap.get(key);
};

/** Кристаллы гнёзд сфер (пустой/заполненный). */
export const crystalImages = {
  empty: itemImageMap.get('crystal_empty'),
  filled: itemImageMap.get('crystal_filled'),
};
/** Картинка рюкзака по семейству (11 спрайтов pack_*.png). */
const BACKPACK_IMAGE_MAP: Record<string, string> = {
  'поход': 'pack_pohod',
  'полев': 'pack_assault',
  'медицин': 'pack_field', // алиас старых сейвов (был «Медицинский»)
  'рейдов': 'pack_raid',
  'сталкер': 'pack_stalker',
  'штурм': 'pack_field',
  'десант': 'pack_desant',
  'тактич': 'pack_tactical',
  'армей': 'pack_army',
  'экспедиц': 'pack_expedition',
  'ветеран': 'pack_veteran',
  'экзо': 'pack_exo',
};

/** Картинка рюкзака по семейству или полному имени; фолбэк — рейдовый. */
export const getBackpackImage = (familyOrName?: string): string | undefined => {
  const s = (familyOrName || '').toLowerCase();
  for (const [frag, key] of Object.entries(BACKPACK_IMAGE_MAP)) {
    if (s.includes(frag)) return itemImageMap.get(key);
  }
  return itemImageMap.get('pack_raid');
};

/** Картинка пачки патронов по имени (6 спрайтов ammo_*.png). */
const BULLET_IMAGE_MAP: Record<string, string> = {
  'пистолет': 'ammo_pistol',
  'автомат': 'ammo_rifle',
  'снайпер': 'ammo_sniper',
  'дробь': 'ammo_shell',
  'лента': 'ammo_mg',
  'энергоячейки': 'ammo_energy',
};

/** Картинка пачки патронов по имени пачки; фолбэк — автоматные. */
export const getBulletImage = (packName?: string): string | undefined => {
  const s = (packName || '').toLowerCase();
  for (const [frag, key] of Object.entries(BULLET_IMAGE_MAP)) {
    if (s.includes(frag)) return itemImageMap.get(key);
  }
  return itemImageMap.get('ammo_rifle');
};

export const getItemImage = (name?: string, displayName?: string, slot?: string, type?: string): string | undefined => {
  // Рюкзаки — картинка по семейству (11 спрайтов pack_*.png).
  if (type === 'backpack') return getBackpackImage(name || displayName);
  // Патроны — картинка по группе (6 спрайтов ammo_*.png).
  if (type === 'bullet') return getBulletImage(name || displayName);
  // Моды оружия — спрайт по слоту мода.
  if (type === 'mod' && slot && MOD_SLOT_IMAGE_MAP[slot]) {
    const bySlot = itemImageMap.get(MOD_SLOT_IMAGE_MAP[slot]);
    if (bySlot) return bySlot;
  }
  const lookup = (name || displayName || '').toLowerCase().replace(/[^a-zа-яё0-9]/g, '');
  const resKey = RESOURCE_IMAGE_MAP[lookup];
  if (resKey) return itemImageMap.get(resKey);
  const modKey = MOD_IMAGE_MAP[lookup];
  if (modKey) return itemImageMap.get(modKey);
  for (const [key, url] of itemImageMap) {
    if (lookup.includes(key) || key.includes(lookup)) return url;
  }
  return itemImageMap.get('mp5');
};

export const getCharacterImage = (key: string): string | undefined => {
  return characterImageMap.get(key.toLowerCase());
};

export const getBattleImage = (key: string): string | undefined => {
  return battleImageMap.get(key.toLowerCase());
};

export const getEnemyImage = (faction: string, enemyName: string, modelKey?: string): string | undefined => {
  if (modelKey) {
    const direct = characterImageMap.get(modelKey.toLowerCase());
    if (direct) return direct;
  }
  // Мусорщики-союзники: моделька задана при спавне (nowModel), фолбэк — первая.
  if ((faction || '').toLowerCase().includes('союзник')) {
    return characterImageMap.get('stalker1') || characterImageMap.get('military1');
  }
  const name = enemyName.toLowerCase();
  if (name.includes('танк') || name.includes('tank')) return characterImageMap.get('tank');
  if (name.includes('снайпер') || name.includes('sniper')) return characterImageMap.get('sniperimg');
  if (name.includes('медик') || name.includes('medic')) return characterImageMap.get('medic');
  if (name.includes('дроб') || name.includes('drob')) return battleImageMap.get('basemilitary') || characterImageMap.get('military1');
  if (name.includes('melle') || name.includes('melee')) return characterImageMap.get('melee');
  if (name.includes('original')) return battleImageMap.get('basemilitary') || characterImageMap.get('military2');
  if (name.includes('boss')) return characterImageMap.get('boss') || battleImageMap.get('basemilitary') || characterImageMap.get('military3');
  if (name.includes('мутант') || name.includes('mutant')) return characterImageMap.get('bandit1');
  if (name.includes('робот') || name.includes('robot')) return characterImageMap.get('bandit1');
  if (name.includes('бандит') || name.includes('bandit')) return characterImageMap.get('bandit1');
  const factionLower = faction.toLowerCase();
  if (factionLower.includes('воен') || factionLower.includes('military')) return characterImageMap.get('military1');
  return characterImageMap.get('enemy');
};

export const images = {
  battleArena: battleImageMap.get('arena'),
  mapMain: mapImageMap.get('map'),
  mapBattle: mapImageMap.get('mapbattle'),
  bazaar: mapImageMap.get('bazar'),
  base: mapImageMap.get('baza'),
  hero: characterImageMap.get('hero'),
  pers: characterImageMap.get('pers'),
  dead: characterImageMap.get('dead'),
  tooltip: uiImageMap.get('tooltip'),
  modal: uiImageMap.get('modal'),
  main: uiImageMap.get('main'),
  background: backgroundImageMap.get('road'),
  workshop: backgroundImageMap.get('unnamed'),
  campfire1: battleImageMap.get('fire1'),
  campfire2: battleImageMap.get('fire2'),
  muzzle: battleImageMap.get('muzzle'),
  bullet: battleImageMap.get('bullet'),
  unloadMag: uiImageMap.get('screenshot_70-photoroom'),
  backpackLock: uiImageMap.get('screenshot_71-photoroom'),
};
