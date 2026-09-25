import type { AccessoryAbility } from '../types/abilities';

/** Ветки зверей: медведь (танк, HP+урон), волк (вамп+скорость, саппорт), кабан (реген+урон). */
export type PetBranch = 'bear' | 'wolf' | 'boar';
export type PetKind = PetBranch;
export type PetAbilityKind = 'stat' | 'active' | 'buff' | 'ulta' | 'passive';

/** Статы питомца (плоские, как у юнита арены). pctPlayerHp — особый: доля от maxHp игрока. */
export type PetStatKey =
  | 'maxHp' | 'damage' | 'armor' | 'evasion' | 'block'
  | 'crit' | 'accuracy' | 'speed' | 'vampir' | 'regen' | 'pctPlayerHp'
  | 'pctBaseHp' | 'pctDamage' | 'pctHostArmor' | 'pctPlayerDmg' | 'pctPlayerSpeed'
  | 'armorPerTurn' | 'critPerTurn' | 'punching';

export interface PetStatPerRank {
  stat: PetStatKey;
  /** прибавка за 1 ранг (доли: 0.01 = 1%, броня/урон/HP — плоские) */
  value: number;
  /** текст за 1 ранг */
  text: string;
}

export interface PetAbilityDef {
  id: string;
  branch: PetBranch;
  tier: number; // 0 = база вне тиров
  name: string;
  /** эмодзи-заглушка (если нет картинки) */
  icon: string;
  /** ключ картинки лесничего (getLesnikImage), напр. '1.1' */
  image?: string;
  kind: PetAbilityKind;
  maxRanks: number;
  /** очков в предыдущем тире ветки для открытия */
  gate: number;
  exclusiveWith?: string[];
  requiresAbility?: string;
  /** бесплатная базовая способность: без очков */
  freeTake?: boolean;
  /** цена в AP питомца (у него 2 AP) */
  petApCost: number;
  cooldown: number;
  statsPerRank?: PetStatPerRank[];
  /** аура-исключение: баффает союзников, пока зверь активен и не спит */
  aura?: { stat: 'armor' | 'vampir' | 'regen' | 'maxHp' | 'damage'; value: number };
  mechanic?: string;
}

const R = (stat: PetStatKey, value: number, text: string): PetStatPerRank => ({ stat, value, text });

export const PET_META = {
  bear: { id: 'bear', name: 'Медведь', icon: '🐻', color: '#a16207' },
  wolf: { id: 'wolf', name: 'Волк', icon: '🐺', color: '#60a5fa' },
  boar: { id: 'boar', name: 'Кабан', icon: '🐗', color: '#f97316' },
} as const;

/** Бесплатная база: регенерация + ИИ + команда (вне веток, ячейки во free-ряду). */
export const PET_FREE_DEFS: PetAbilityDef[] = [
  { id: 'pet_regen', branch: 'bear', tier: 0, name: 'Регенерация', icon: '💗', kind: 'passive', maxRanks: 1, gate: 0, freeTake: true, petApCost: 0, cooldown: 0, statsPerRank: [R('regen', 0.02, '+2% реген/ход')], mechanic: 'Питомец регенерирует 2% HP в ход. Бесплатно.' },
  { id: 'pet_ai', branch: 'bear', tier: 0, name: 'ИИ: автобой', icon: '🤖', image: 'ии автобой', kind: 'passive', maxRanks: 1, gate: 0, freeTake: true, petApCost: 0, cooldown: 0, mechanic: 'Питомец сам бежит и атакует ближайших видимых врагов. Без КД, 0 AP. Без неё — пассивный.' },
  { id: 'pet_command', branch: 'bear', tier: 0, name: 'Команда: атака', icon: '🎯', image: 'команда атака', kind: 'active', maxRanks: 1, gate: 0, freeTake: true, petApCost: 0, cooldown: 0, mechanic: 'Направляет питомца на врага. Кликни врага — побежит и атакует. Повторная команда — смена цели. Без КД, 0 AP.' },
];

export const PET_ABILITIES: PetAbilityDef[] = [
  // ---------- МЕДВЕДЬ (танк: HP + урон) ----------
  { id: 'pb_t1_hp', branch: 'bear', tier: 1, name: '+10% здоровья от хозяина', icon: '❤️', image: '1.1', kind: 'stat', maxRanks: 10, gate: 0, petApCost: 0, cooldown: 0, statsPerRank: [R('pctPlayerHp', 0.1, '+10% здоровья от хозяина')] },
  { id: 'pb_t1_arm', branch: 'bear', tier: 1, name: '+2.5 брони', icon: '🛡️', image: '1.2', kind: 'stat', maxRanks: 10, gate: 0, petApCost: 0, cooldown: 0, statsPerRank: [R('armor', 2.5, '+2.5 брони')] },
  { id: 'pb_t2_dmg', branch: 'bear', tier: 2, name: '+2 урона', icon: '⚔️', image: '2.1', kind: 'stat', maxRanks: 10, gate: 5, petApCost: 0, cooldown: 0, statsPerRank: [R('damage', 2, '+2 урона')] },
  { id: 'pb_t2_aura', branch: 'bear', tier: 2, name: 'Стена стаи', icon: '🏰', image: '2.2', kind: 'stat', maxRanks: 5, gate: 5, petApCost: 0, cooldown: 0, statsPerRank: [R('armor', 0.02, '+2% брони')], aura: { stat: 'armor', value: 0.02 } },
  { id: 'pb_t3_paw', branch: 'bear', tier: 3, name: 'Тяжёлая лапа', icon: '🐾', image: '3.1', kind: 'passive', maxRanks: 1, gate: 5, exclusiveWith: ['pb_t3_roar'], petApCost: 0, cooldown: 0, mechanic: 'Пассив: каждые 6 ходов ×2 + стан.' },
  { id: 'pb_t3_roar', branch: 'bear', tier: 3, name: 'Дикий рёв', icon: '📢', image: '3.2', kind: 'passive', maxRanks: 1, gate: 5, exclusiveWith: ['pb_t3_paw'], petApCost: 0, cooldown: 0, mechanic: 'Пассив: каждые 8 ходов −20% меткости врагам в 10 кл. на 1 ход.' },
  { id: 'pb_t4_def', branch: 'bear', tier: 4, name: 'Медвежья оборона', icon: '🛡️', image: '4.1', kind: 'stat', maxRanks: 5, gate: 5, petApCost: 0, cooldown: 0, statsPerRank: [R('pctHostArmor', 0.15, '+15% брони хозяина')], mechanic: 'Пассив: +15% брони хозяина за ранг.' },
  { id: 'pb_t5_thick', branch: 'bear', tier: 5, name: 'Толстая кожа', icon: '🦏', image: '5.1', kind: 'stat', maxRanks: 5, gate: 5, exclusiveWith: ['pb_t5_ursok'], petApCost: 0, cooldown: 0, statsPerRank: [R('block', 3.0, '+3% блока')], mechanic: 'Пассив: +3% блока за ранг (кап 50%).' },
  { id: 'pb_t5_ursok', branch: 'bear', tier: 5, name: 'Ярость Урсока', icon: '🐻', image: '5.2', kind: 'stat', maxRanks: 5, gate: 5, exclusiveWith: ['pb_t5_thick'], petApCost: 0, cooldown: 0, statsPerRank: [R('armorPerTurn', 0.2, '+0.2 брони/ход')], mechanic: 'Пассив: каждый ход +0.2 брони (стакается).' },
  { id: 'pb_t6_restore', branch: 'bear', tier: 6, name: 'Неистовое восстановление', icon: '💚', image: '6.1', kind: 'active', maxRanks: 1, gate: 4, exclusiveWith: ['pb_t6_regen'], petApCost: 0, cooldown: 50, mechanic: 'Лечит только медведя 25% HP каждый ход 3 хода. КД 50, 2 AP игрока.' },
  { id: 'pb_t6_regen', branch: 'bear', tier: 6, name: 'Медвежья регенерация', icon: '💗', image: '6.2', kind: 'passive', maxRanks: 1, gate: 4, exclusiveWith: ['pb_t6_restore'], petApCost: 0, cooldown: 0, statsPerRank: [R('regen', 0.03, '+3% реген')], mechanic: 'Пассив: реген 2%→5% (улучшает базу).' },
  { id: 'pb_t7_alpha', branch: 'bear', tier: 7, name: 'Улучшенная стена стаи', icon: '👑', image: '7.1', kind: 'ulta', maxRanks: 1, gate: 5, petApCost: 0, cooldown: 0, aura: { stat: 'maxHp', value: 0.3 }, mechanic: 'Улучшает «Стену стаи»: аура +30% здоровья союзникам в радиусе 30, пока зверь жив.' },

  // ---------- ВОЛК (урон + вамп + уклонение; HP и брони почти нет) ----------
  { id: 'pw_t1_own', branch: 'wolf', tier: 1, name: '+10% от урона ближнего оружия хозяина', icon: '🩸', image: '11', kind: 'stat', maxRanks: 10, gate: 0, petApCost: 0, cooldown: 0, statsPerRank: [R('pctPlayerDmg', 0.1, '+10% от ближнего оружия хозяина')], mechanic: 'Пассив: волк забирает 10% урона твоего оружия ближнего боя за ранг (100% на 10 рангах). Слот пуст — бонуса нет.' },
  { id: 'pw_t1_eva', branch: 'wolf', tier: 1, name: '+1% уклонения', icon: '💨', image: '12', kind: 'stat', maxRanks: 10, gate: 0, petApCost: 0, cooldown: 0, statsPerRank: [R('evasion', 0.01, '+1% уклонения')] },
  { id: 'pw_t2_dmg', branch: 'wolf', tier: 2, name: '+4 урона', icon: '⚔️', image: '21', kind: 'stat', maxRanks: 10, gate: 5, petApCost: 0, cooldown: 0, statsPerRank: [R('damage', 4, '+4 урона')] },
  { id: 'pw_t2_aura', branch: 'wolf', tier: 2, name: 'Кровь стаи', icon: '🌙', image: '22', kind: 'stat', maxRanks: 5, gate: 5, petApCost: 0, cooldown: 0, statsPerRank: [R('pctDamage', 0.02, '+2% урона')], aura: { stat: 'damage', value: 0.02 } },
  { id: 'pw_t3_rend', branch: 'wolf', tier: 3, name: 'Рваная рана', icon: '🦷', image: '31', kind: 'passive', maxRanks: 1, gate: 5, exclusiveWith: ['pw_t3_shade'], petApCost: 0, cooldown: 0, mechanic: 'Пассив: каждые 4 хода +100% вампиризма себе на 1 ход.' },
  { id: 'pw_t3_shade', branch: 'wolf', tier: 3, name: 'Полоснуть', icon: '🌑', image: '32', kind: 'passive', maxRanks: 1, gate: 5, exclusiveWith: ['pw_t3_rend'], petApCost: 0, cooldown: 0, mechanic: 'Пассив: каждые 4 хода +100% крита и +10% уклонения себе на 1 ход.' },
  { id: 'pw_t4_gon', branch: 'wolf', tier: 4, name: 'Верность хозяину', icon: '🏃', image: '41', kind: 'stat', maxRanks: 5, gate: 5, petApCost: 0, cooldown: 0, statsPerRank: [R('punching', 0.6, '+60% пробивания')], mechanic: 'Пассив: +60% пробивания за ранг (300% на 5 рангах).' },
  { id: 'pw_t5_howl', branch: 'wolf', tier: 5, name: 'Вой', icon: '🐺', image: '51', kind: 'stat', maxRanks: 5, gate: 5, petApCost: 0, cooldown: 0, statsPerRank: [R('critPerTurn', 0.002, '+0.2% крита/ход')], mechanic: 'Пассив: каждый ход вне скрытности +0.2% крита за ранг (стакается, без капа). В стелсе не растёт.' },
  { id: 'pw_t6_reap', branch: 'wolf', tier: 6, name: 'Инстинкты выживания', icon: '💥', image: '61', kind: 'active', maxRanks: 1, gate: 4, exclusiveWith: ['pw_t6_oath'], petApCost: 0, cooldown: 50, mechanic: '+100% уклонения волку на 2 хода. КД 50, 2 AP игрока.' },
  { id: 'pw_t6_oath', branch: 'wolf', tier: 6, name: 'Клятва стаи', icon: '🩸', image: '62', kind: 'active', maxRanks: 1, gate: 4, exclusiveWith: ['pw_t6_reap'], petApCost: 0, cooldown: 50, mechanic: 'Хозяин теряет 50% HP, волк лечит 80% HP. КД 50, 2 AP игрока.' },
  { id: 'pw_t7_leader', branch: 'wolf', tier: 7, name: 'Альфа стаи', icon: '⭐', image: '71', kind: 'ulta', maxRanks: 1, gate: 5, petApCost: 0, cooldown: 0, statsPerRank: [R('vampir', 0.3, '+30% вампиризма')], aura: { stat: 'vampir', value: 0.3 }, mechanic: 'Улучшает «Кровь стаи»: себе и союзникам +30% вампиризма (+10% урона от рангов Т2), пока зверь жив.' },

  // ---------- КАБАН (реген + урон) ----------
  { id: 'po_t1_reg', branch: 'boar', tier: 1, name: '+1% реген', icon: '🌿', kind: 'stat', maxRanks: 5, gate: 0, petApCost: 0, cooldown: 0, statsPerRank: [R('regen', 0.01, '+1% реген/ход')] },
  { id: 'po_t1_dmg', branch: 'boar', tier: 1, name: '+2 урона', icon: '⚔️', kind: 'stat', maxRanks: 10, gate: 0, petApCost: 0, cooldown: 0, statsPerRank: [R('damage', 2, '+2 урона')] },
  { id: 'po_t2_hp', branch: 'boar', tier: 2, name: '+150 здоровья', icon: '❤️', kind: 'stat', maxRanks: 5, gate: 5, petApCost: 0, cooldown: 0, statsPerRank: [R('maxHp', 150, '+150 здоровья')] },
  { id: 'po_t2_aura', branch: 'boar', tier: 2, name: 'Дух рощи', icon: '🍃', kind: 'stat', maxRanks: 3, gate: 5, petApCost: 0, cooldown: 0, statsPerRank: [R('regen', 1, '+1 реген')], aura: { stat: 'regen', value: 1 } },
  { id: 'po_t3_dash', branch: 'boar', tier: 3, name: 'Рывок', icon: '💥', kind: 'active', maxRanks: 1, gate: 5, petApCost: 1, cooldown: 6, mechanic: 'Рывок к цели + ×1.5 урона. КД 6.' },
  { id: 'po_t4_hide', branch: 'boar', tier: 4, name: 'Панцирь', icon: '🐢', kind: 'active', maxRanks: 1, gate: 5, petApCost: 1, cooldown: 8, mechanic: '+15 брони себе на 3 хода. КД 8.' },
  { id: 'po_t5_ram', branch: 'boar', tier: 5, name: 'Таран', icon: '🚧', kind: 'active', maxRanks: 1, gate: 5, petApCost: 1, cooldown: 8, mechanic: '×2 урона + отброс 2 клетки. КД 8.' },
  { id: 'po_t6_fury', branch: 'boar', tier: 6, name: 'Бешенство', icon: '🤬', kind: 'buff', maxRanks: 1, gate: 4, petApCost: 1, cooldown: 8, mechanic: '+50% урона себе на 3 хода. КД 8.' },
  { id: 'po_t7_sekach', branch: 'boar', tier: 7, name: 'Секач', icon: '🐗', kind: 'ulta', maxRanks: 1, gate: 5, petApCost: 0, cooldown: 0, statsPerRank: [R('pctDamage', 0.3, '+30% урона')], mechanic: '+30% урона. Ульта ветки.' },
];

export const PET_BY_ID: Record<string, PetAbilityDef> = Object.fromEntries(
  [...PET_ABILITIES, ...PET_FREE_DEFS].map((a) => [a.id, a]),
);

export const PET_BRANCHES: PetBranch[] = ['bear', 'wolf', 'boar'];

/** Скрытые ветки: видны как «🔒 СКОРО», качать и выбирать нельзя (выйдут в будущем обновлении). */
export const HIDDEN_PET_BRANCHES: PetBranch[] = ['boar'];
export const isPetBranchHidden = (branch: PetBranch): boolean =>
  HIDDEN_PET_BRANCHES.includes(branch);
export const PET_TIERS: number[] = [1, 2, 3, 4, 5, 6, 7];

export const petOfTier = (branch: PetBranch, tier: number): PetAbilityDef[] =>
  PET_ABILITIES.filter((a) => a.branch === branch && a.tier === tier);

export const petMaxRanks = (): number =>
  [...PET_ABILITIES, ...PET_FREE_DEFS]
    .filter((a) => !isPetBranchHidden(a.branch))
    .reduce((s, a) => s + a.maxRanks, 0);

export type PetSkills = Record<string, number>;
export const petRank = (s: PetSkills, id: string): number => s[id] || 0;

/** очков (skills+pending) в тире ветки */
export const petSpentInTier = (branch: PetBranch, tier: number, skills: PetSkills, pending: PetSkills): number =>
  petOfTier(branch, tier).reduce((sum, a) => sum + (skills[a.id] || 0) + (pending[a.id] || 0), 0);

/** очков в диапазоне тиров */
export const petSpentInTiers = (branch: PetBranch, fromTier: number, toTier: number, skills: PetSkills, pending: PetSkills): number => {
  let sum = 0;
  for (let t = fromTier; t <= toTier; t++) sum += petSpentInTier(branch, t, skills, pending);
  return sum;
};

export interface PetTierGate { fromTier: number; toTier: number; need: number; }

/** Суммарные гейты верхних тиров (как у снайпера). */
export const PET_TIER_GATES: Record<string, PetTierGate> = {
  'bear:4': { fromTier: 1, toTier: 3, need: 15 },
  'bear:5': { fromTier: 1, toTier: 4, need: 20 },
  'bear:6': { fromTier: 1, toTier: 5, need: 25 },
  'bear:7': { fromTier: 1, toTier: 6, need: 25 },
  'wolf:4': { fromTier: 1, toTier: 3, need: 15 },
  'wolf:5': { fromTier: 1, toTier: 4, need: 20 },
  'wolf:6': { fromTier: 1, toTier: 5, need: 25 },
  'wolf:7': { fromTier: 1, toTier: 6, need: 25 },
  'boar:6': { fromTier: 1, toTier: 5, need: 25 },
  'boar:7': { fromTier: 1, toTier: 6, need: 25 },
};

/** проверка гейта тира: открыт ли тир */
export const petTierOpen = (
  branch: PetBranch, tier: number, skills: PetSkills, pending: PetSkills,
): { open: boolean; need: number; have: number; label: string } => {
  if (tier <= 1) return { open: true, need: 0, have: 0, label: '' };
  const cg = PET_TIER_GATES[`${branch}:${tier}`];
  if (cg) {
    const have = petSpentInTiers(branch, cg.fromTier, cg.toTier, skills, pending);
    const label = cg.fromTier === cg.toTier ? `в тире ${cg.toTier}` : `за тиры ${cg.fromTier}-${cg.toTier}`;
    return { open: have >= cg.need, need: cg.need, have, label };
  }
  const def = PET_ABILITIES.find((a) => a.branch === branch && a.tier === tier);
  const need = def ? def.gate : 0;
  const have = petSpentInTier(branch, tier - 1, skills, pending);
  return { open: have >= need, need, have, label: `в тире ${tier - 1}` };
};

/** можно ли качать: гейт + эксклюзив + ветка */
export const petCanAllocate = (
  id: string, skills: PetSkills, pending: PetSkills, skillPoints: number,
): { ok: boolean; reason: string } => {
  const def = PET_BY_ID[id];
  if (!def) return { ok: false, reason: 'Нет такой способности' };
  if (isPetBranchHidden(def.branch)) return { ok: false, reason: `«${PET_META[def.branch].name}» выйдет в будущем обновлении` };
  if (!def.freeTake && skillPoints <= 0) return { ok: false, reason: 'Нет очков' };
  const cur = (skills[id] || 0) + (pending[id] || 0);
  if (cur >= def.maxRanks) return { ok: false, reason: 'Максимум' };
  const gate = petTierOpen(def.branch, def.tier, skills, pending);
  if (!gate.open && cur === 0) return { ok: false, reason: `Нужно ${gate.need} ${gate.label}` };
  if (def.exclusiveWith && !def.freeTake) {
    for (const rival of def.exclusiveWith) {
      if ((skills[rival] || 0) + (pending[rival] || 0) > 0) {
        const rdef = PET_BY_ID[rival];
        return { ok: false, reason: `Конфликт: выбрано «${rdef ? rdef.name : rival}»` };
      }
    }
  }
  if (def.requiresAbility) {
    const r = (skills[def.requiresAbility] || 0) + (pending[def.requiresAbility] || 0);
    if (r <= 0) {
      const rdef = PET_BY_ID[def.requiresAbility];
      return { ok: false, reason: `Нужна «${rdef ? rdef.name : def.requiresAbility}»` };
    }
  }
  return { ok: true, reason: '' };
};

/**
 * Антиабуз: находит способности, которые стали недействительны.
 * Итеративно до fixpoint, очки невалидных не учитываются в гейтах остальных.
 */
export function petFindInvalid(skills: PetSkills, pending: PetSkills): string[] {
  const sk: PetSkills = { ...skills };
  const pe: PetSkills = { ...pending };
  const invalid: string[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const def of PET_ABILITIES) {
      if (invalid.includes(def.id)) continue;
      const tot = (sk[def.id] || 0) + (pe[def.id] || 0);
      if (tot <= 0) continue;
      const gate = petTierOpen(def.branch, def.tier, sk, pe);
      let ok = gate.open;
      if (ok && def.requiresAbility) {
        const r = (sk[def.requiresAbility] || 0) + (pe[def.requiresAbility] || 0);
        ok = r > 0 && !invalid.includes(def.requiresAbility);
      }
      if (!ok) {
        invalid.push(def.id);
        delete sk[def.id];
        delete pe[def.id];
        changed = true;
      }
    }
  }
  return invalid;
}

/** текст эффекта за 1 ранг (ячейки) / суммарный (тултип) */
export const petRankText = (def: PetAbilityDef, rank: number): string => {
  if (def.statsPerRank) {
    return def.statsPerRank.map((s) => {
      if (s.stat === 'pctPlayerHp') return `+${Math.round(s.value * rank * 100)}% здоровья от хозяина`;
      if (s.stat === 'pctBaseHp') return `+${Math.round(s.value * rank * 100)}% здоровья`;
      if (s.stat === 'pctDamage') return `+${Math.round(s.value * rank * 100)}% урона`;
      if (s.stat === 'pctPlayerDmg') return `+${Math.round(s.value * rank * 100)}% от ближнего оружия хозяина`;
      if (s.stat === 'pctPlayerSpeed') return `+${Math.round(s.value * rank * 100)}% скорости от хозяина`;
      if (s.stat === 'pctHostArmor') return `+${Math.round(s.value * rank * 100)}% брони хозяина`;
      if (s.stat === 'critPerTurn') return `+${(s.value * rank * 100).toFixed(1).replace('.', ',')}% крита/ход`;
      if (s.stat === 'punching') return `+${Math.round(s.value * rank * 100)}% ${petStatLabel(s.stat)}`;
      // Блок — прямые проценты (без ×100).
      if (s.stat === 'block') return `+${s.value * rank}% ${petStatLabel(s.stat)}`;
      if (s.stat === 'maxHp' || s.stat === 'damage' || (s.stat === 'armor' && s.value >= 1) || s.stat === 'armorPerTurn') return `+${(s.value * rank).toString().replace('.', ',')} ${petStatLabel(s.stat)}`;
      if (s.stat === 'regen' && s.value >= 1) return `+${s.value * rank} ${petStatLabel(s.stat)}`;
      if (s.stat === 'armor' && s.value < 1) return `+${Math.round(s.value * rank * 100)}% ${petStatLabel(s.stat)}`;
      return `+${(s.value * rank * 100).toFixed((s.value * rank * 100) >= 10 ? 0 : 1).replace('.', ',')}% ${petStatLabel(s.stat)}`;
    }).join(' · ');
  }
  return def.mechanic || '';
};

const petStatLabel = (s: PetStatKey): string => {
  switch (s) {
    case 'maxHp': return 'здоровья';
    case 'damage': return 'урона';
    case 'armor': return 'брони';
    case 'evasion': return 'уклонения';
    case 'block': return 'блока';
    case 'crit': return 'крита';
    case 'accuracy': return 'меткости';
    case 'speed': return 'скорости';
    case 'vampir': return 'вампиризма';
    case 'regen': return 'регенерации';
    case 'pctPlayerHp': return 'здоровья от хозяина';
    case 'pctBaseHp': return 'здоровья';
    case 'pctDamage': return 'урона';
    case 'pctPlayerDmg': return 'от ближнего оружия хозяина';
    case 'pctPlayerSpeed': return 'скорости от хозяина';
    case 'pctHostArmor': return 'брони хозяина';
    case 'armorPerTurn': return 'брони/ход';
    case 'critPerTurn': return 'крита/ход';
    case 'punching': return 'пробивания';
    default: return s;
  }
};

/** Бонусные статы питомца из ветки (плоские суммы; pctPlayerHp резолвится при спавне). */
export interface PetStatBonus {
  maxHp: number; damage: number; armor: number; evasion: number; block: number;
  crit: number; accuracy: number; speed: number; vampir: number; regen: number;
  punching: number;
  pctPlayerHp: number; pctBaseHp: number; pctDamage: number; pctHostArmor: number;
  pctPlayerDmg: number; pctPlayerSpeed: number;
  armorPerTurn: number; critPerTurn: number;
}

export const EMPTY_PET_BONUS: PetStatBonus = {
  maxHp: 0, damage: 0, armor: 0, evasion: 0, block: 0,
  crit: 0, accuracy: 0, speed: 0, vampir: 0, regen: 0,
  punching: 0,
  pctPlayerHp: 0, pctBaseHp: 0, pctDamage: 0, pctHostArmor: 0,
  pctPlayerDmg: 0, pctPlayerSpeed: 0,
  armorPerTurn: 0, critPerTurn: 0,
};

export function petBranchBonuses(kind: PetKind, skills: PetSkills): PetStatBonus {
  const total: PetStatBonus = { ...EMPTY_PET_BONUS };
  for (const def of [...PET_ABILITIES, ...PET_FREE_DEFS]) {
    if (def.branch !== kind || !def.statsPerRank) continue;
    const r = skills[def.id] || 0;
    if (r <= 0) continue;
    for (const s of def.statsPerRank) {
      if (s.stat === 'pctPlayerHp' || s.stat === 'pctBaseHp' || s.stat === 'pctDamage' || s.stat === 'pctHostArmor' || s.stat === 'pctPlayerDmg' || s.stat === 'pctPlayerSpeed') {
        (total as any)[s.stat] += s.value * r;
      } else if (s.stat === 'armorPerTurn' || s.stat === 'critPerTurn') {
        (total as any)[s.stat] += s.value * r;
      } else if (s.stat === 'maxHp' || s.stat === 'damage' || s.stat === 'armor') (total as any)[s.stat] += s.value * r;
      else (total as any)[s.stat] = ((total as any)[s.stat] || 0) + s.value * r;
    }
  }
  return total;
}

/** Ауры активной ветки (применённые ранги): [{stat, value}] суммарно. */
export function petBranchAuras(kind: PetKind, skills: PetSkills): { stat: 'armor' | 'vampir' | 'regen' | 'maxHp' | 'damage'; value: number }[] {
  const out = new Map<string, number>();
  for (const def of PET_ABILITIES) {
    if (def.branch !== kind || !def.aura) continue;
    // Аура качается рангами базовой способности (statsPerRank нет — считаем очки id).
    const r = skills[def.id] || 0;
    if (r <= 0) continue;
    out.set(def.aura.stat, (out.get(def.aura.stat) || 0) + def.aura.value * r);
  }
  return [...out.entries()].map(([stat, value]) => ({ stat: stat as 'armor' | 'vampir' | 'regen' | 'maxHp' | 'damage', value }));
}

// ---------- Боевые способности питомца (панель 24) ----------

export type PetExecKind = 'strike' | 'buffself' | 'buffparty' | 'debuffAura' | 'hot' | 'sacrifice' | 'shade' | 'ai';

export interface PetBattleAbility {
  id: string;
  defId: string;
  name: string;
  icon: string;
  petApCost: number;
  cooldown: number;
  needsTarget: boolean;
  range: number;
  exec: PetExecKind;
  mult?: number;
  stun?: number;
  healPct?: number; // доля от нанесённого в хил себе (0.5 = 50%)
  vampBuff?: number; // бафф вампиризма себе на 1 ход после удара
  /** звук применения (Corruption/Maim/...) */
  sound?: string;
  knockback?: number;
  aoe?: number; // радиус для debuffAura
  stat?: string;
  value?: number;
  duration?: number;
  /** для buffparty: статы пати {crit, speed, ...} */
  partyStats?: Record<string, number>;
}

function petBase(def: PetAbilityDef): Omit<PetBattleAbility, 'exec'> {
  return {
    id: `petb_${def.id}`, defId: def.id, name: def.name, icon: def.icon,
    petApCost: def.petApCost, cooldown: def.cooldown,
    needsTarget: false, range: 2,
  };
}

/** Сборка боевой способности питомца (rank всегда 1: активки одноранговые). */
export function buildPetBattleAbility(def: PetAbilityDef): PetBattleAbility {
  const base = petBase(def);
  switch (def.id) {
    case 'pb_t6_restore':
      return { ...base, exec: 'hot', needsTarget: false, value: 0.25, duration: 3 };
    case 'pb_t3_paw':
      return { ...base, exec: 'strike', needsTarget: true, mult: 2, stun: 1 };
    case 'pb_t4_wall':
      return { ...base, exec: 'buffself', needsTarget: false, stat: 'armor', value: 15, duration: 3 };
    case 'pb_t5_roar':
      return { ...base, exec: 'debuffAura', aoe: 10, stat: 'accuracy', value: 0.5, duration: 3 };
    case 'pb_t6_rage':
      return { ...base, exec: 'buffself', needsTarget: false, stat: 'damageMult', value: 0.5, duration: 3 };
    case 'pw_t6_reap':
      return { ...base, exec: 'buffself', needsTarget: false, stat: 'evasion', value: 1.0, duration: 2, sound: 'Corruption' };
    case 'pw_t6_oath':
      return { ...base, exec: 'sacrifice', needsTarget: false, value: 0.8, duration: 0 };
    case 'po_t3_dash':
      return { ...base, exec: 'strike', needsTarget: true, mult: 1.5, range: 20 };
    case 'po_t4_hide':
      return { ...base, exec: 'buffself', needsTarget: false, stat: 'armor', value: 15, duration: 3 };
    case 'po_t5_ram':
      return { ...base, exec: 'strike', needsTarget: true, mult: 2, knockback: 2 };
    case 'po_t6_fury':
      return { ...base, exec: 'buffself', needsTarget: false, stat: 'damageMult', value: 0.5, duration: 3 };
    default:
      return { ...base, exec: 'strike', mult: 1 };
  }
}

/** Активные боевые способности питомца по применённым скиллам (+тумблер ИИ). */
export function petBattleAbilities(skills: PetSkills, branch?: PetBranch): PetBattleAbility[] {
  const out: PetBattleAbility[] = [];
  for (const def of PET_ABILITIES) {
    if (def.kind !== 'active' && def.kind !== 'buff') continue;
    if (branch && def.branch !== branch) continue;
    if ((skills[def.id] || 0) <= 0) continue;
    out.push(buildPetBattleAbility(def));
  }
  // ИИ автобоя: кнопка на панели (0 AP, без КД — тратит AP питомца по ходу дела).
  if ((skills['pet_ai'] || 0) > 0) {
    const def = PET_BY_ID['pet_ai'];
    out.push({ ...petBase(def), exec: 'ai', needsTarget: false, petApCost: 0, cooldown: 0 });
  }
  // Команда атаки: направляет питомца (0 AP, без КД).
  if ((skills['pet_command'] || 0) > 0) {
    const def = PET_BY_ID['pet_command'];
    out.push({ ...petBase(def), exec: 'command', needsTarget: false, petApCost: 0, cooldown: 0 });
  }
  return out;
}

/** Свободные id для тестов/валидации. */
export const PET_FREE_IDS = ['pet_regen', 'pet_ai', 'pet_command'];

/** Клеток за 1 AP питомца: волк (скорость ≥ 0.1) ходит по 2. */
export const petCellsPerAp = (speed: number): number => (speed >= 0.1 ? 2 : 1);

/** Настроение сытости: green ≥66, yellow ≥33, иначе red. */
export type PetMood = 'green' | 'yellow' | 'red';
export const petMood = (v: number): PetMood => (v >= 66 ? 'green' : v >= 33 ? 'yellow' : 'red');
/** Текущая сытость с распадом 100%→0% за 12 часов. */
export const petSatietyAt = (v: number, t: number, now = Date.now()): number => {
  const elapsedH = Math.max(0, (now - t) / 3600000);
  return Math.max(0, Math.min(100, v) - (elapsedH / 12) * 100);
};
/** Множитель HP в бою: сытый 1.0, проголодался 0.7, голодный 0.1. */
export const petHpMult = (v: number): number => {
  const m = petMood(v);
  return m === 'green' ? 1.0 : m === 'yellow' ? 0.7 : 0.1;
};

export interface PetBaseNumbers {
  maxHp: number; damage: number; armor: number; evasion: number; block: number;
  crit: number; accuracy: number; speed: number; vampir: number; regen: number;
  punching: number;
}

/**
 * Базовые статы зверя: скейл от уровня + доля урона/HP игрока + бонусы ветки.
 * Доли (вамп/скорость/реген) не мультиплицируются.
 */
export function petBaseStats(
  kind: PetKind, levelMult: number, playerDamage: number, playerMaxHp: number, bonus: PetStatBonus, playerArmor: number = 0, playerSpeed: number = 0, playerMeleeDamage: number = 0,
): PetBaseNumbers {
  const base = kind === 'bear'
    ? { hp: 600, dmgFrac: 0.25, armor: 4, eva: 0.05, block: 1.0, crit: 0.05, acc: 0.9, spd: 0, vamp: 0, reg: 0 }
    : kind === 'wolf'
      ? { hp: 350, dmgFrac: 0.2, armor: 1, eva: 0.15, block: 0.2, crit: 0.05, acc: 0.95, spd: 0.1, vamp: 0.05, reg: 0 }
      : { hp: 450, dmgFrac: 0.25, armor: 2, eva: 0.08, block: 0.5, crit: 0.05, acc: 0.9, spd: 0, vamp: 0, reg: 0.01 };
  const hostArmorBonus = (bonus.pctHostArmor || 0) * playerArmor;
  const maxHp = Math.round(
    (base.hp * levelMult + bonus.maxHp + playerMaxHp * bonus.pctPlayerHp) * (1 + bonus.pctBaseHp),
  );
  const damage = Math.max(1, Math.round((playerDamage * base.dmgFrac + bonus.damage + playerMeleeDamage * (bonus.pctPlayerDmg || 0)) * (1 + bonus.pctDamage)));
  return {
    maxHp,
    damage,
    armor: Math.max(0, base.armor + bonus.armor + hostArmorBonus),
    evasion: Math.min(0.9, Math.max(0, base.eva + bonus.evasion)),
    block: Math.max(0, base.block + bonus.block),
    crit: Math.max(0, base.crit + bonus.crit),
    accuracy: Math.min(2, base.acc + bonus.accuracy),
    speed: Math.max(0, base.spd + bonus.speed + playerSpeed * (bonus.pctPlayerSpeed || 0)),
    vampir: Math.max(0, base.vamp + bonus.vampir),
    regen: Math.max(0, base.reg + bonus.regen),
    punching: Math.max(0, bonus.punching || 0),
  };
}
