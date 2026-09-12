import type { Item } from '../types/items';

/** Вставленная схема: какой стат и на сколько % усиливает именно этот предмет. */
export interface AppliedScheme {
  stat: string;
  pct: number;
}

/** Статы, доступные схемам. */
export const SCHEME_STATS = [
  'damage', 'armor', 'crit', 'speed', 'accuracy',
  'evasion', 'block', 'vampir', 'punching', 'regen', 'maxHp',
];

export const SCHEME_STAT_LABELS: Record<string, string> = {
  damage: 'Урон', armor: 'Броня', crit: 'Крит. шанс', speed: 'Скорость',
  accuracy: 'Точность', evasion: 'Уклонение', block: 'Блок',
  vampir: 'Вампиризм', punching: 'Пробитие', regen: 'Регенерация', maxHp: 'Макс. HP',
};

/** Урон/броня — +10% база, остальные — +20%; за ранг выше обычного +2.5% / +5%. */
const SCHEME_BASE_PCT: Record<string, number> = { damage: 10, armor: 10 };
const SCHEME_STEP_PCT: Record<string, number> = { damage: 2.5, armor: 2.5 };

const QUALITY_INDEX: Record<string, number> = {
  'Обычный': 0, 'Редкий': 1, 'Раритетный': 2, 'Эпический': 3,
  'Смертоносный': 4, 'Легендарный': 5, 'Божественный': 6,
};

/** % бонуса схемы по стату и редкости схемы. */
export const schemePctFor = (stat: string, rarity?: string): number => {
  const idx = QUALITY_INDEX[rarity || 'Обычный'] ?? 0;
  const base = SCHEME_BASE_PCT[stat] ?? 20;
  const step = SCHEME_STEP_PCT[stat] ?? 5;
  return base + step * idx;
};

const WEAPON_SLOTS = ['weapon1', 'weapon2', 'gun_pistol', 'gun_shotgun', 'gun_sniper', 'gun_heavy'];
const ARMOR_SLOTS = ['head', 'armor', 'pants', 'gloves', 'boots'];

/** Оружие/броня ли предмет (под сокеты и перековку). */
export const isSocketable = (item: { slot?: string | null; type?: string }): boolean => {
  const slot = (item as any).slot || '';
  return WEAPON_SLOTS.includes(slot) || ARMOR_SLOTS.includes(slot);
};

const isWeaponSlot = (slot: string): boolean => WEAPON_SLOTS.includes(slot);

/** Ролл числа гнёзд при генерации: оружие 1–5, броня 1–3 (уникам — 0). */
export const rollSocketSlots = (slot: string, unique?: boolean): number => {
  if (unique) return 0;
  if (isWeaponSlot(slot)) return 1 + Math.floor(Math.random() * 5);
  if (ARMOR_SLOTS.includes(slot)) return 1 + Math.floor(Math.random() * 3);
  return 0;
};

/** Стабильный фолбэк гнёзд для старых предметов (без socketSlots): хэш id. */
const hashId = (id?: string): number => {
  const s = id || '';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

export const socketSlotsOf = (item: { id?: string; slot?: string | null; socketSlots?: number; unique?: boolean }): number => {
  if (typeof (item as any).socketSlots === 'number') return (item as any).socketSlots;
  if ((item as any).unique) return 0;
  const slot = (item as any).slot || '';
  if (isWeaponSlot(slot)) return 1 + (hashId(item.id) % 5);
  if (ARMOR_SLOTS.includes(slot)) return 1 + (hashId(item.id) % 3);
  return 0;
};

/** Суммарный % схем по каждому стату (складываются). */
export const schematicBonusOf = (item: Pick<Item, 'sockets'>): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const s of ((item as any).sockets || []) as AppliedScheme[]) {
    if (!s || !s.stat) continue;
    out[s.stat] = (out[s.stat] || 0) + (s.pct || 0);
  }
  return out;
};

/** Скейл статов от уровня (как при генерации): ×(1 + (lvl-1)*0.1). */
export const levelStatMult = (level: number): number => 1 + (Math.max(1, level) - 1) * 0.1;

/** Пересчёт статов предмета на новый уровень из базы 1 ур. Штрафы плоские. */
export const statsForLevel = (base1: Record<string, number>, newLevel: number): Record<string, number> => {
  const mult = levelStatMult(newLevel);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(base1)) {
    if (typeof v !== 'number') continue;
    if (v < 0) { out[k] = v; continue; }
    const scaled = v * mult;
    out[k] = Math.abs(v) < 1 ? Math.round(scaled * 10000) / 10000 : Math.round(scaled);
  }
  return out;
};
