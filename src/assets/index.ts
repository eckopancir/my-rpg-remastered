const itemImageModules = import.meta.glob<{ default: string }>('./Images/items/*.png', { eager: true });
const characterImageModules = import.meta.glob<{ default: string }>('./Images/characters/*.png', { eager: true });
const battleImageModules = import.meta.glob<{ default: string }>('./Images/battle/*.png', { eager: true });
const backgroundImageModules = import.meta.glob<{ default: string }>('./Images/backgrounds/*.{jpg,png}', { eager: true });
const mapImageModules = import.meta.glob<{ default: string }>('./Images/map/*.png', { eager: true });
const uiImageModules = import.meta.glob<{ default: string }>('./Images/ui/*.{png,jpg,jfif}', { eager: true });
const sniperImageModules = import.meta.glob<{ default: string }>('./Images/class/sniper/*.png', { eager: true });
const lesnikImageModules = import.meta.glob<{ default: string }>('./Images/class/lesnik/*.png', { eager: true });
const petsImageModules = import.meta.glob<{ default: string }>('./Images/pets/*.png', { eager: true });

const extractKey = (path: string): string => path.split('/').pop()?.replace(/\.(png|jpg|jfif)$/, '').toLowerCase() || '';

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
const sniperImageMap = toMap(sniperImageModules);
const lesnikImageMap = toMap(lesnikImageModules);
const petsImageMap = toMap(petsImageModules);

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
  regen: 'scheme_regen', punching: 'scheme_regen', maxHp: 'scheme_regen', stamina: 'scheme_regen',
  dpsfire: 'scheme_damage', dpsemi: 'scheme_armor', dpstoxis: 'scheme_regen', dpsextro: 'scheme_crit',
};

/** Картинка сферы по стату бонуса; фолбэк — крит-орб. */
export const getSchemeImage = (stat?: string): string | undefined => {
  const key = SCHEME_IMAGE_MAP[(stat || '').toLowerCase()] || 'scheme_crit';
  return itemImageMap.get(key);
};

/** Картинка способности снайпера по ключу тира: '1.1' | 'def 5.1'. */
export const getSniperImage = (key: string): string | undefined =>
  sniperImageMap.get(key.toLowerCase());

/** Картинка способности лесничего по ключу: '1.1'..'7.1' | 'ии автобой' | 'команда атака'. */
export const getLesnikImage = (key: string): string | undefined =>
  lesnikImageMap.get(key.toLowerCase());

/** Фон шапки класса снайпера. */
export const sniperClassBg = (): string | undefined =>
  uiImageMap.get('gemini_generated_image_xsa51nxsa51nxsa5');

/** Общий фон окон атакующих/защитных способностей. */
export const sniperSkillsBg = (): string | undefined =>
  uiImageMap.get('gemini_generated_image_3jzga3jzga3jzga3');

/** Фон шапки класса лесничего. */
export const beastClassBg = (): string | undefined =>
  uiImageMap.get('gemini_generated_image_zigqvdzigqvdzigq');

/** Искра удара питомца на цели. */
export const petStrikeImage = (): string | undefined =>
  uiImageMap.get('gemini_generated_image_hr70wnhr70wnhr70-photoroom');

/** Искра ближнего боя: удары холодным оружием и милики. */
export const meleeStrikeImage = (): string | undefined =>
  uiImageMap.get('gemini_generated_image_iricbliricbliric-photoroom');

/** Модель зверя для BATTLE арены (отдельная папка — без коллизий с аватарами). */
export const petModelImage = (kind: string): string | undefined => {
  const key = kind === 'bear' ? 'медведь' : kind === 'wolf' ? 'волк' : kind === 'boar' ? 'кабан' : '';
  return key ? petsImageMap.get(key) : undefined;
};

/** Труп нейтрального кабана (отдельный арт). */
export const petCorpseImage = (): string | undefined =>
  petsImageMap.get('dead кабан');

/** Аватар зверя для модалки Экипировки (jfif). */
export const petAvatarImage = (kind: string): string | undefined => {
  const key = kind === 'bear' ? 'медведь' : kind === 'wolf' ? 'волк' : kind === 'boar' ? 'кабан' : '';
  return key ? uiImageMap.get(key) : undefined;
};

/** Общий фон окна способностей лесничего (тиры перков). */
export const beastSkillsBg = (): string | undefined =>
  uiImageMap.get('gemini_generated_image_6q9ft56q9ft56q9f');

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

/** Арты комплектов брони по нормализованному имени (как lookup в getItemImage). */
const SET_ARMOR_IMAGE_MAP: Record<string, string> = {
  'капюшонпризрака': 'призрак шлем',
  'плащпризрака': 'призрак броня',
  'штаныпризрака': 'призрак штаны',
  'наручипризрака': 'призрак перчатки',
  'башмакипризрака': 'призрак ботинки',
  'шлемразведчика': 'разведчик шлем',
  'курткаразведчика': 'разведчик броня',
  'штаныразведчика': 'разведчик штаны',
  'перчаткиразведчика': 'разведчик перчатки',
  'ботинкиразведчика': 'разведчик ботинки',
};
/** Новые автоматы (20 шт.): их арты показываем крупнее —
 *  в тултипе +33% (180→240), в инвентаре +20% (44→53). */
const LARGE_ART_WEAPONS = new Set([
  'uzi', 'thompson', 'ak-47', 'm16a4', 'famas', 'aug', 'scar-l', 'fn p90',
  'm5', 'vector', 'скс', 'winchester 1894', 'сайга-мк', 'cz 805 bren',
  'fn f2000', 'galil ace', 'arx-160', 'rec7', 'scar-h', 'аш-12',
]);

export const isLargeArtWeapon = (name?: string): boolean =>
  LARGE_ART_WEAPONS.has((name || '').toLowerCase());

export const getItemImage = (name?: string, displayName?: string, slot?: string, type?: string): string | undefined => {
  // Щиты пока без арта — рисуются эмодзи (item.icon).
  if (slot === 'shield') return undefined;
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
  // Арты комплектов брони — по точному имени вещи.
  const setKey = SET_ARMOR_IMAGE_MAP[lookup];
  if (setKey) return itemImageMap.get(setKey);
  // Точное совпадение имени файла — приоритет (арты стволов и именные спрайты).
  // Иначе lookup с цифрами уезжает на numbered-файлы ('ak47' -> '4.png').
  const exact = itemImageMap.get(lookup);
  if (exact) return exact;
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
