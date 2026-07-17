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
};

const MOD_IMAGE_MAP: Record<string, string> = {
  'улучшенный ствол': '14',
  'голографический прицел': '10',
  'ускоренный магазин': '9',
  'пламегаситель': '11',
  'улучшенный ресивер': '12',
  'легкий скелетный приклад': '13',
};

export const getItemImage = (name?: string, displayName?: string): string | undefined => {
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

export const getEnemyImage = (faction: string, enemyName: string): string | undefined => {
  const name = enemyName.toLowerCase();
  if (name.includes('танк') || name.includes('tank')) return characterImageMap.get('tank');
  if (name.includes('снайпер') || name.includes('sniper')) return characterImageMap.get('sniperimg');
  if (name.includes('медик') || name.includes('medic')) return characterImageMap.get('medic');
  if (name.includes('дроб') || name.includes('drob')) return battleImageMap.get('basemilitary') || characterImageMap.get('military1');
  if (name.includes('melle') || name.includes('melee')) return characterImageMap.get('melee');
  if (name.includes('original')) return battleImageMap.get('basemilitary') || characterImageMap.get('military2');
  if (name.includes('boss')) return battleImageMap.get('basemilitary') || characterImageMap.get('military3');
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
};
