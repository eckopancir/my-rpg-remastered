import type { AccessoryAbility } from '../types/abilities';

export type MeleeColumn = 'melee';
export type MeleeKind = 'stat' | 'active' | 'passive' | 'ulta';

export interface MeleeStatPerRank {
  stat: string;
  /** прибавка за 1 ранг (проценты в долях: 0.01 = 1%, урон плоский) */
  value: number;
  /** текст для тултипа за 1 ранг */
  text: string;
}

export interface MeleeAbilityDef {
  id: string;
  column: MeleeColumn;
  tier: number;
  name: string;
  kind: MeleeKind;
  maxRanks: number;
  /** очков в предыдущем тире для открытия (верхние тиры — суммарный гейт) */
  gate: number;
  /** взаимоисключающие id (только одна ветка) */
  exclusiveWith?: string[];
  /** базовый AP (активные); скидка Холодного расчёта применяется при сборке */
  apCost: number;
  cooldown: number;
  /** бесплатная способность класса: вкачивание без очков */
  freeTake?: boolean;
  /** иконка-эмодзи (артов пока нет) */
  icon: string;
  /** статовые пассивки: прибавка за ранг */
  statsPerRank?: MeleeStatPerRank[];
  /** короткое описание механики для тултипа */
  mechanic?: string;
}

const R = (stat: string, value: number, text: string): MeleeStatPerRank => ({ stat, value, text });

export const MELEE_META = {
  id: 'melee',
  name: 'Милишник',
  icon: '🛡️',
  color: '#ef4444',
};

export const MELEE_ABILITIES: MeleeAbilityDef[] = [
  // ---------- БАЗА (бесплатно) ----------
  {
    id: 'mln_shield_use', column: 'melee', tier: 0, name: 'Ношение щита', kind: 'passive',
    maxRanks: 1, gate: 0, freeTake: true, apCost: 0, cooldown: 0, icon: '🛡️',
    mechanic: 'Открывает слот щита под оружием ближнего боя. Щит даёт +25% шанс блока.',
  },
  {
    id: 'mln_shotgun_stun', column: 'melee', tier: 0, name: 'Дробящий выстрел', kind: 'passive',
    maxRanks: 1, gate: 0, freeTake: true, apCost: 0, cooldown: 0, icon: '💥',
    mechanic: '5% шанс, что выстрел из дробовика оглушит врага на 1 ход.',
  },

  // ---------- ТИР 1 ----------
  { id: 'mln_t1_melee', column: 'melee', tier: 1, name: '+2.5 урон', kind: 'stat', maxRanks: 10, gate: 0, apCost: 0, cooldown: 0, icon: '🗡️', statsPerRank: [R('damage', 2.5, '+2.5 урон')] },
  { id: 'mln_t1_shotgun', column: 'melee', tier: 1, name: '+2 броня', kind: 'stat', maxRanks: 10, gate: 0, apCost: 0, cooldown: 0, icon: '🔫', statsPerRank: [R('armor', 2, '+2 броня')] },

  // ---------- ТИР 2 (нужно 5 из Т1) ----------
  { id: 'mln_t2_vamp', column: 'melee', tier: 2, name: '+2% вампиризм', kind: 'stat', maxRanks: 5, gate: 5, apCost: 0, cooldown: 0, icon: '🩸', statsPerRank: [R('vampir', 0.02, '+2% вампиризм')] },
  { id: 'mln_t2_punch', column: 'melee', tier: 2, name: '+4% пробитие', kind: 'stat', maxRanks: 5, gate: 5, apCost: 0, cooldown: 0, icon: '🔩', statsPerRank: [R('punching', 0.04, '+4% пробитие')] },

  // ---------- ТИР 3 (нужно 10 из Т1–2) ----------
  { id: 'mln_t3_acc', column: 'melee', tier: 3, name: '+1% меткость', kind: 'stat', maxRanks: 10, gate: 0, apCost: 0, cooldown: 0, icon: '🎯', statsPerRank: [R('accuracy', 0.01, '+1% меткость')] },
  { id: 'mln_t3_mix', column: 'melee', tier: 3, name: 'Точность и натиск', kind: 'stat', maxRanks: 10, gate: 0, apCost: 0, cooldown: 0, icon: '🧭', statsPerRank: [R('accuracy', 0.005, '+0.5% меткость'), R('punching', 0.005, '+0.5% пробитие'), R('vampir', 0.005, '+0.5% вампиризм')] },

  // ---------- ТИР 4 (нужно 15 из Т1–3, только одна) ----------
  {
    id: 'mln_t4_shield', column: 'melee', tier: 4, name: 'Поднять щит', kind: 'active',
    maxRanks: 10, gate: 0, exclusiveWith: ['mln_t4_fortify'], apCost: 0, cooldown: 50, icon: '🛡️',
    mechanic: 'Поглощает по 1 атаке за каждый ранг. КД 50.',
  },
  {
    id: 'mln_t4_fortify', column: 'melee', tier: 4, name: 'Укрепление', kind: 'active',
    maxRanks: 10, gate: 0, exclusiveWith: ['mln_t4_shield'], apCost: 1, cooldown: 50, icon: '🧱',
    mechanic: '+10% брони на 3 хода за каждый ранг. КД 50.',
  },

  // ---------- ТИР 5 (нужно 25 из Т1–4, только одна) ----------
  { id: 'mln_t5_vamp', column: 'melee', tier: 5, name: 'МОЩНЫЙ вампиризм', kind: 'stat', maxRanks: 5, gate: 0, exclusiveWith: ['mln_t5_punch'], apCost: 0, cooldown: 0, icon: '🩸', statsPerRank: [R('vampir', 0.04, '+4% вампиризм'), R('crit', 0.02, '+2% крит')] },
  { id: 'mln_t5_punch', column: 'melee', tier: 5, name: 'МОЩНОЕ пробитие', kind: 'stat', maxRanks: 5, gate: 0, exclusiveWith: ['mln_t5_vamp'], apCost: 0, cooldown: 0, icon: '🔩', statsPerRank: [R('punching', 0.08, '+8% пробитие'), R('crit', 0.02, '+2% крит')] },

  // ---------- ТИР 6 (нужно 30 из Т1–5) ----------
  { id: 'mln_t6_block', column: 'melee', tier: 6, name: '+2.5% шанс блока', kind: 'stat', maxRanks: 2, gate: 0, apCost: 0, cooldown: 0, icon: '🛡️', statsPerRank: [R('block', 2.5, '+2.5% шанс блока')] },
  {
    id: 'mln_t6_cheap', column: 'melee', tier: 6, name: 'Холодный расчёт', kind: 'passive',
    maxRanks: 2, gate: 0, apCost: 0, cooldown: 0, icon: '❄️',
    mechanic: 'Способности милишника дешевле на 1AP за ранг (минимум 0AP).',
  },
  {
    id: 'mln_t6_adrenaline', column: 'melee', tier: 6, name: 'Укол адреналина', kind: 'active',
    maxRanks: 2, gate: 0, apCost: 1, cooldown: 50, icon: '💉',
    mechanic: '+10% урона и брони за ранг на 5 ходов. КД 50.',
  },
  {
    id: 'mln_t6_regen', column: 'melee', tier: 6, name: 'Второе дыхание', kind: 'passive',
    maxRanks: 2, gate: 0, apCost: 0, cooldown: 0, icon: '💚',
    mechanic: 'Пассивная регенерация 2.5% HP в ход за ранг.',
  },

  // ---------- ТИР 7 (нужно 32 из Т1–6, только одна) ----------
  {
    id: 'mln_t7_rage', column: 'melee', tier: 7, name: 'Ярость берсерка', kind: 'ulta',
    maxRanks: 1, gate: 0, exclusiveWith: ['mln_t7_ram', 'mln_t7_rush'], apCost: 1, cooldown: 50, icon: '🤬',
    mechanic: '+50% урона, +100% реген на 3 хода. КД 50. Только одна ульта Т7.',
  },
  {
    id: 'mln_t7_ram', column: 'melee', tier: 7, name: 'Таран', kind: 'ulta',
    maxRanks: 1, gate: 0, exclusiveWith: ['mln_t7_rage', 'mln_t7_rush'], apCost: 2, cooldown: 50, icon: '💥',
    mechanic: '2x урона + отброс + стан на 4 хода. КД 50. Только одна ульта Т7.',
  },
  {
    id: 'mln_t7_rush', column: 'melee', tier: 7, name: 'Рывок', kind: 'ulta',
    maxRanks: 1, gate: 0, exclusiveWith: ['mln_t7_rage', 'mln_t7_ram'], apCost: 0, cooldown: 50, icon: '🏃',
    mechanic: '+10 AP на 1 ход, но броня падает до 0. КД 50. Только одна ульта Т7.',
  },
];

export const MELEE_BY_ID: Record<string, MeleeAbilityDef> = Object.fromEntries(
  MELEE_ABILITIES.map((a) => [a.id, a]),
);

export const MELEE_TIERS: number[] = [1, 2, 3, 4, 5, 6, 7];

export const meleeOfTier = (tier: number): MeleeAbilityDef[] =>
  MELEE_ABILITIES.filter((a) => a.column === 'melee' && a.tier === tier);

export const meleeFreeDefs = (): MeleeAbilityDef[] =>
  MELEE_ABILITIES.filter((a) => a.freeTake);

export const meleeMaxRanks = (): number =>
  MELEE_ABILITIES.reduce((s, a) => s + a.maxRanks, 0);

export type MeleeSkills = Record<string, number>;

export const meleeRank = (s: MeleeSkills, id: string): number => s[id] || 0;

/** очков (skills+pending) в тире */
export const meleeSpentInTier = (
  tier: number, skills: MeleeSkills, pending: MeleeSkills,
): number =>
  meleeOfTier(tier).reduce(
    (sum, a) => sum + (skills[a.id] || 0) + (pending[a.id] || 0), 0,
  );

/** очков в диапазоне тиров */
export const meleeSpentInTiers = (
  fromTier: number, toTier: number,
  skills: MeleeSkills, pending: MeleeSkills,
): number => {
  let sum = 0;
  for (let t = fromTier; t <= toTier; t++) sum += meleeSpentInTier(t, skills, pending);
  return sum;
};

export interface MeleeTierGate { fromTier: number; toTier: number; need: number; }

/** Суммарные гейты верхних тиров. */
export const MELEE_TIER_GATES: Record<string, MeleeTierGate> = {
  'melee:3': { fromTier: 1, toTier: 2, need: 10 },
  'melee:4': { fromTier: 1, toTier: 3, need: 15 },
  'melee:5': { fromTier: 1, toTier: 4, need: 25 },
  'melee:6': { fromTier: 1, toTier: 5, need: 30 },
  'melee:7': { fromTier: 1, toTier: 6, need: 32 },
};

/** проверка гейта тира: открыт ли тир */
export const meleeTierOpen = (
  tier: number, skills: MeleeSkills, pending: MeleeSkills,
): { open: boolean; need: number; have: number; label: string } => {
  if (tier <= 1) return { open: true, need: 0, have: 0, label: '' };
  const cg = MELEE_TIER_GATES[`melee:${tier}`];
  if (cg) {
    const have = meleeSpentInTiers(cg.fromTier, cg.toTier, skills, pending);
    const label = cg.fromTier === cg.toTier ? `в тире ${cg.toTier}` : `за тиры ${cg.fromTier}-${cg.toTier}`;
    return { open: have >= cg.need, need: cg.need, have, label };
  }
  const def = MELEE_ABILITIES.find((a) => a.column === 'melee' && a.tier === tier);
  const need = def ? def.gate : 0;
  const have = meleeSpentInTier(tier - 1, skills, pending);
  return { open: have >= need, need, have, label: `в тире ${tier - 1}` };
};

/** можно ли качать: гейт + эксклюзив + ветка */
export const meleeCanAllocate = (
  id: string, skills: MeleeSkills, pending: MeleeSkills, skillPoints: number,
): { ok: boolean; reason: string } => {
  const def = MELEE_BY_ID[id];
  if (!def) return { ok: false, reason: 'Нет такой способности' };
  // Базовые способности бесплатны: очки не нужны, гейт всегда открыт (тир 0).
  if (!def.freeTake && skillPoints <= 0) return { ok: false, reason: 'Нет очков' };
  const cur = (skills[id] || 0) + (pending[id] || 0);
  if (cur >= def.maxRanks) return { ok: false, reason: 'Максимум' };
  const gate = meleeTierOpen(def.tier, skills, pending);
  if (!gate.open && cur === 0) return { ok: false, reason: `Нужно ${gate.need} ${gate.label}` };
  if (def.exclusiveWith && !def.freeTake) {
    for (const rival of def.exclusiveWith) {
      if ((skills[rival] || 0) + (pending[rival] || 0) > 0) {
        const rdef = MELEE_BY_ID[rival];
        return { ok: false, reason: `Конфликт: выбрано «${rdef ? rdef.name : rival}»` };
      }
    }
  }
  return { ok: true, reason: '' };
};

/** текст тултипа: суммарный эффект на текущем ранге */
export const meleeRankText = (def: MeleeAbilityDef, rank: number): string => {
  if (def.statsPerRank) {
    return def.statsPerRank.map((s) => {
      if (s.stat === 'meleeDamage' || s.stat === 'shotgunDamage' || s.stat === 'damage' || s.stat === 'armor' || s.stat === 'maxHp' || s.stat === 'maxStamina') {
        return `+${s.value * rank} ${s.text.replace(/^[+-][\d.]+%?\s*/, '')}`;
      }
      // Блок — прямые проценты (без ×100).
      if (s.stat === 'block') {
        const total = s.value * rank;
        const label = s.text.replace(/^[+-][\d.]+%?\s*/, '');
        return `+${total}% ${label}`;
      }
      const total = s.value * rank;
      const shown = `${(total * 100).toFixed(total * 100 >= 10 ? 0 : 1)}%`;
      const label = s.text.replace(/^[+-][\d.]+%?\s*/, '');
      return `+${shown} ${label}`;
    }).join(' · ');
  }
  if (def.id === 'mln_t4_shield') return `Поглощает ${rank} ${plural(rank, 'атаку', 'атаки', 'атак')}`;
  if (def.id === 'mln_t4_fortify') return `+${rank * 10}% брони на 3 хода`;
  if (def.id === 'mln_t6_cheap') return `Способности дешевле на ${rank}AP (мин. 0)`;
  if (def.id === 'mln_t6_regen') return `Реген ${rank * 2.5}% HP в ход`;
  if (def.id === 'mln_t6_adrenaline') return `+${rank * 10}% урона и брони на 5 ходов`;
  if (def.id === 'mln_t7_rage') return '+50% урона, +100% реген на 3 хода';
  if (def.id === 'mln_t7_ram') return '2x урона + отброс + стан на 4 хода';
  if (def.id === 'mln_t7_rush') return '+10 AP на 1 ход, броня в 0';
  return def.mechanic || '';
};

const plural = (n: number, one: string, few: string, many: string): string => {
  const m = n % 10, h = n % 100;
  if (m === 1 && h !== 11) return one;
  if (m >= 2 && m <= 4 && (h < 12 || h > 14)) return few;
  return many;
};

/** Сборка боевой способности из дефа и ранга. Все активки КД 50, бесплатные (без расходника). */
export function buildMeleeBattleAbility(
  def: MeleeAbilityDef, rank: number, apDiscount: number,
): AccessoryAbility & { image?: string; displayOnly?: boolean } {
  const base = {
    name: def.name,
    description: meleeRankText(def, Math.max(1, rank)),
    icon: def.icon,
    free: true,
    powerRating: 60,
  };
  const ap = (n: number) => Math.max(0, n - apDiscount);
  switch (def.id) {
    case 'mln_t4_shield':
      return { ...base, id: 'mlnb_shield', apCost: ap(0), cooldown: 50, powerRating: 65, effects: [{ type: 'status', id: 'shield', duration: rank }] };
    case 'mln_t4_fortify':
      return { ...base, id: 'mlnb_fortify', apCost: ap(1), cooldown: 50, powerRating: 60, effects: [{ type: 'stat_boost_mult', stat: 'armor', value: 0.1 * rank, duration: 3 }] };
    case 'mln_t6_adrenaline':
      return {
        ...base, id: 'mlnb_adrenaline', apCost: ap(1), cooldown: 50, powerRating: 60,
        effects: [
          { type: 'stat_boost_mult', stat: 'damage', value: 0.1 * rank, duration: 5 },
          { type: 'stat_boost_mult', stat: 'armor', value: 0.1 * rank, duration: 5 },
        ],
      };
    case 'mln_t7_rage':
      return {
        ...base, id: 'mlnb_rage', apCost: ap(1), cooldown: 50, powerRating: 65,
        effects: [
          { type: 'stat_boost_mult', stat: 'damage', value: 0.5, duration: 3 },
          { type: 'stat_boost_mult', stat: 'regen', value: 1, duration: 3 },
        ],
      };
    case 'mln_t7_ram':
      return {
        ...base, id: 'mlnb_ram', apCost: ap(2), cooldown: 50, powerRating: 65, requiresTarget: true, range: 10,
        effects: [
          { type: 'damage', multiplier: 2 },
          { type: 'status', id: 'stun', duration: 4 },
        ],
      };
    case 'mln_t7_rush':
      return {
        ...base, id: 'mlnb_rush', apCost: ap(0), cooldown: 50, powerRating: 60,
        effects: [
          { type: 'sprint_boost', duration: 1 },
          { type: 'stat_boost_mult', stat: 'armor', value: -1, duration: 1 },
        ],
      };
    default:
      return { ...base, id: `mlnb_${def.id}`, apCost: ap(def.apCost), cooldown: def.cooldown, powerRating: 50, effects: [] };
  }
}

/** Активные боевые способности милишника по текущим скиллам (для арены). */
export function meleeBattleAbilities(
  skills: MeleeSkills, pending: MeleeSkills,
): (AccessoryAbility & { image?: string; displayOnly?: boolean })[] {
  const out: (AccessoryAbility & { image?: string; displayOnly?: boolean })[] = [];
  const discount = Math.min(2, (skills['mln_t6_cheap'] || 0) + (pending['mln_t6_cheap'] || 0));
  const activeIds = [
    'mln_t4_shield', 'mln_t4_fortify',
    'mln_t6_adrenaline',
    'mln_t7_rage', 'mln_t7_ram', 'mln_t7_rush',
  ];
  for (const id of activeIds) {
    const rank = (skills[id] || 0) + (pending[id] || 0);
    if (rank <= 0) continue;
    const def = MELEE_BY_ID[id];
    out.push(buildMeleeBattleAbility(def, rank, discount));
  }
  return out;
}

/**
 * Антиабуз: находит способности, которые стали недействительны
 * (сломан гейт тира). Возвращает id для каскадного снятия. Итеративно до fixpoint,
 * очки невалидных не учитываются в гейтах остальных.
 */
export function meleeFindInvalid(skills: MeleeSkills, pending: MeleeSkills): string[] {
  const sk: MeleeSkills = { ...skills };
  const pe: MeleeSkills = { ...pending };
  const invalid: string[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const def of MELEE_ABILITIES) {
      if (invalid.includes(def.id)) continue;
      const tot = (sk[def.id] || 0) + (pe[def.id] || 0);
      if (tot <= 0) continue;
      const gate = meleeTierOpen(def.tier, sk, pe);
      const ok = gate.open;
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
