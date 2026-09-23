import type { AccessoryAbility } from '../types/abilities';

export type ShooterColumn = 'shooter';
export type ShooterKind = 'stat' | 'active' | 'passive' | 'ulta';

export interface ShooterStatPerRank {
  stat: string;
  /** прибавка за 1 ранг (проценты в долях: 0.01 = 1%, урон плоский) */
  value: number;
  /** текст для тултипа за 1 ранг */
  text: string;
}

export interface ShooterAbilityDef {
  id: string;
  column: ShooterColumn;
  tier: number;
  name: string;
  kind: ShooterKind;
  maxRanks: number;
  /** очков в предыдущем тире для открытия (верхние тиры — суммарный гейт) */
  gate: number;
  /** взаимоисключающие id (только одна ветка) */
  exclusiveWith?: string[];
  /** базовый AP (проф. рефлексы обнуляют все способности класса) */
  apCost: number;
  cooldown: number;
  /** бесплатная способность класса: вкачивание без очков */
  freeTake?: boolean;
  /** иконка-эмодзи (артов пока нет) */
  icon: string;
  /** статовые пассивки: прибавка за ранг */
  statsPerRank?: ShooterStatPerRank[];
  /** короткое описание механики для тултипа */
  mechanic?: string;
  /** мультитаргет: выбрать N целей по очереди */
  multiTarget?: number;
  /** таргет по клетке: квадрат Чебышева radius, дальность range */
  cellAoE?: { radius: number; range: number };
}

const R = (stat: string, value: number, text: string): ShooterStatPerRank => ({ stat, value, text });

export const SHOOTER_META = {
  id: 'shooter',
  name: 'Стрелок',
  icon: '🔫',
  color: '#3b82f6',
};

export const SHOOTER_ABILITIES: ShooterAbilityDef[] = [
  // ---------- БАЗА (бесплатно) ----------
  {
    id: 'sht_medkit', column: 'shooter', tier: 0, name: 'Аптечка', kind: 'active',
    maxRanks: 1, gate: 0, freeTake: true, apCost: 5, cooldown: 50, icon: '🩹',
    mechanic: 'Восстанавливает 25% HP. КД 50.',
  },
  {
    id: 'sht_grenade', column: 'shooter', tier: 0, name: 'Осколочная граната', kind: 'active',
    maxRanks: 1, gate: 0, freeTake: true, apCost: 2, cooldown: 5, icon: '💣',
    mechanic: '5x урона по площади. КД 5.',
  },
  {
    id: 'sht_reflexes', column: 'shooter', tier: 0, name: 'Профессиональные рефлексы', kind: 'passive',
    maxRanks: 1, gate: 0, freeTake: true, apCost: 0, cooldown: 0, icon: '⚡',
    mechanic: 'Все способности класса Стрелок стоят 0 AP.',
  },

  // ---------- ТИР 1 ----------
  { id: 'sht_t1_damage', column: 'shooter', tier: 1, name: '+2 урон', kind: 'stat', maxRanks: 10, gate: 0, apCost: 0, cooldown: 0, icon: '🔫', statsPerRank: [R('damage', 2, '+2 урон')] },
  { id: 'sht_t1_armor', column: 'shooter', tier: 1, name: '+2 броня', kind: 'stat', maxRanks: 10, gate: 0, apCost: 0, cooldown: 0, icon: '🛡️', statsPerRank: [R('armor', 2, '+2 броня')] },
  { id: 'sht_t1_acc', column: 'shooter', tier: 1, name: '+1% меткость', kind: 'stat', maxRanks: 10, gate: 0, apCost: 0, cooldown: 0, icon: '🎯', statsPerRank: [R('accuracy', 0.01, '+1% меткость')] },

  // ---------- ТИР 2 (нужно 5 из Т1) ----------
  { id: 'sht_t2_speed', column: 'shooter', tier: 2, name: '+2% скорость атаки', kind: 'stat', maxRanks: 10, gate: 5, apCost: 0, cooldown: 0, icon: '🏃', statsPerRank: [R('speed', 0.02, '+2% скорость атаки')] },
  { id: 'sht_t2_punch', column: 'shooter', tier: 2, name: '+2% пробитие', kind: 'stat', maxRanks: 10, gate: 5, apCost: 0, cooldown: 0, icon: '🔩', statsPerRank: [R('punching', 0.02, '+2% пробитие')] },
  { id: 'sht_t2_critdmg', column: 'shooter', tier: 2, name: '+2% крит. урон', kind: 'stat', maxRanks: 10, gate: 5, apCost: 0, cooldown: 0, icon: '💥', statsPerRank: [R('critDamage', 0.02, '+2% крит. урон')] },

  // ---------- ТИР 3 (нужно 10 из Т1–2) ----------
  { id: 'sht_t3_eva', column: 'shooter', tier: 3, name: '+1% уклонение', kind: 'stat', maxRanks: 10, gate: 0, apCost: 0, cooldown: 0, icon: '💨', statsPerRank: [R('evasion', 0.01, '+1% уклонение')] },
  { id: 'sht_t3_hp', column: 'shooter', tier: 3, name: '+250 здоровья', kind: 'stat', maxRanks: 10, gate: 0, apCost: 0, cooldown: 0, icon: '❤️', statsPerRank: [R('maxHp', 250, '+250 здоровья')] },
  { id: 'sht_t3_stam', column: 'shooter', tier: 3, name: '+5 выносливости', kind: 'stat', maxRanks: 10, gate: 0, apCost: 0, cooldown: 0, icon: '⚡', statsPerRank: [R('maxStamina', 5, '+5 выносливости')] },

  // ---------- ТИР 4 (нужно 15 из Т1–3, только одна) ----------
  {
    id: 'sht_t4_head', column: 'shooter', tier: 4, name: 'Тройной выстрел', kind: 'active',
    maxRanks: 10, gate: 0, exclusiveWith: ['sht_t4_react', 'sht_t4_bazooka'], apCost: 2, cooldown: 10, icon: '🎯',
    multiTarget: 3,
    mechanic: 'Выбери 3 цели по очереди: всем ×3 урона (+0.1× за ранг). КД 10.',
  },
  {
    id: 'sht_t4_react', column: 'shooter', tier: 4, name: 'Адская реакция', kind: 'active',
    maxRanks: 10, gate: 0, exclusiveWith: ['sht_t4_head', 'sht_t4_bazooka'], apCost: 1, cooldown: 10, icon: '😈',
    mechanic: '+100% скорости (+10% за ранг) на 1 ход. КД 10.',
  },
  {
    id: 'sht_t4_bazooka', column: 'shooter', tier: 4, name: 'Залп из базуки', kind: 'active',
    maxRanks: 10, gate: 0, exclusiveWith: ['sht_t4_head', 'sht_t4_react'], apCost: 2, cooldown: 10, icon: '🚀',
    cellAoE: { radius: 1, range: 10 },
    mechanic: 'Удар по клетке 3×3: 5x урона (+0.2x за ранг) всем врагам. КД 10.',
  },

  // ---------- ТИР 5 (нужно 25 из Т1–4) ----------
  { id: 'sht_t5_speed', column: 'shooter', tier: 5, name: 'Шквал огня', kind: 'stat', maxRanks: 5, gate: 0, apCost: 0, cooldown: 0, icon: '🌊', statsPerRank: [R('speed', 0.05, '+5% скорость атаки'), R('crit', 0.02, '+2% крит')] },
  { id: 'sht_t5_crit', column: 'shooter', tier: 5, name: 'Смертельный калибр', kind: 'stat', maxRanks: 5, gate: 0, apCost: 0, cooldown: 0, icon: '☠️', statsPerRank: [R('critDamage', 0.04, '+4% крит. урон'), R('speed', 0.03, '+3% скорость атаки')] },
  { id: 'sht_t5_punch', column: 'shooter', tier: 5, name: 'Бронебойный калибр', kind: 'stat', maxRanks: 5, gate: 0, apCost: 0, cooldown: 0, icon: '🔩', statsPerRank: [R('punching', 0.05, '+5% пробитие'), R('crit', 0.02, '+2% крит')] },

  // ---------- ТИР 6 (нужно 30 из Т1–5, любые две ветки) ----------
  {
    id: 'sht_t6_stim', column: 'shooter', tier: 6, name: 'Допинг', kind: 'active',
    maxRanks: 5, gate: 0, apCost: 1, cooldown: 50, icon: '💉',
    mechanic: '+1 AP. Длительность = 5 + ранг ходов. КД 50.',
  },
  {
    id: 'sht_t6_bandage', column: 'shooter', tier: 6, name: 'Полевой бинт', kind: 'active',
    maxRanks: 5, gate: 0, apCost: 1, cooldown: 50, icon: '🩼',
    mechanic: '+5% HP/ход (+1% за ранг) и ×3 регена. Длительность = 3 + ранг ходов. КД 50.',
  },
  {
    id: 'sht_t6_acid', column: 'shooter', tier: 6, name: 'Кислотные патроны', kind: 'active',
    maxRanks: 5, gate: 0, apCost: 2, cooldown: 50, icon: '🧪',
    mechanic: '-50% брони цели (−5 п.п. за ранг) + стан. Длительность = 5 + ранг ходов. КД 50.',
  },
  {
    id: 'sht_t6_shred', column: 'shooter', tier: 6, name: 'Подкалиберные', kind: 'active',
    maxRanks: 5, gate: 0, apCost: 1, cooldown: 50, icon: '🔩',
    mechanic: '+100% пробития (+20% за ранг). Длительность = 2 + ранг ходов. КД 50.',
  },

  // ---------- ТИР 7 (нужно 32 из Т1–6, любые две) ----------
  { id: 'sht_t7_rgauto', column: 'shooter', tier: 7, name: 'Длинный ствол: автомат', kind: 'passive', maxRanks: 1, gate: 0, apCost: 0, cooldown: 0, icon: '📏', mechanic: 'Дальность автомата +1 (всегда).' },
  { id: 'sht_t7_rgpist', column: 'shooter', tier: 7, name: 'Длинный ствол: пистолет', kind: 'passive', maxRanks: 1, gate: 0, apCost: 0, cooldown: 0, icon: '📏', mechanic: 'Дальность пистолета +1 (всегда).' },
  { id: 'sht_t7_rgheavy', column: 'shooter', tier: 7, name: 'Длинный ствол: тяжёлое', kind: 'passive', maxRanks: 1, gate: 0, apCost: 0, cooldown: 0, icon: '📏', mechanic: 'Дальность тяжёлого +1 (всегда).' },
  { id: 'sht_t7_magpist', column: 'shooter', tier: 7, name: 'Магазин: пистолет', kind: 'passive', maxRanks: 1, gate: 0, apCost: 0, cooldown: 0, icon: '🔋', mechanic: 'Все магазины пистолета +25% патронов.' },
  { id: 'sht_t7_magauto', column: 'shooter', tier: 7, name: 'Магазин: автомат', kind: 'passive', maxRanks: 1, gate: 0, apCost: 0, cooldown: 0, icon: '🔋', mechanic: 'Все магазины автомата +25% патронов.' },
  { id: 'sht_t7_magheavy', column: 'shooter', tier: 7, name: 'Магазин: тяжёлое', kind: 'passive', maxRanks: 1, gate: 0, apCost: 0, cooldown: 0, icon: '🔋', mechanic: 'Все магазины тяжёлого +50% патронов.' },
  { id: 'sht_t7_magmg', column: 'shooter', tier: 7, name: 'Магазин: пулемёт', kind: 'passive', maxRanks: 1, gate: 0, apCost: 0, cooldown: 0, icon: '🔋', mechanic: 'Все магазины пулемёта +20% патронов.' },

  // ---------- ТИР 8 (нужно 35 из Т1–6, только одна) ----------
  {
    id: 'sht_t8_rage', column: 'shooter', tier: 8, name: 'Боевой раж', kind: 'passive',
    maxRanks: 1, gate: 0, exclusiveWith: ['sht_t8_elem', 'sht_t8_exo', 'sht_t8_wind', 'sht_t8_barrage'], apCost: 0, cooldown: 0, icon: '🤬',
    mechanic: 'Каждый выстрел +1% скорости до конца боя (кап +400%). Только одна ульта Т8.',
  },
  {
    id: 'sht_t8_elem', column: 'shooter', tier: 8, name: 'Стихийный прицел', kind: 'active',
    maxRanks: 1, gate: 0, exclusiveWith: ['sht_t8_rage', 'sht_t8_exo', 'sht_t8_wind', 'sht_t8_barrage'], apCost: 1, cooldown: 50, icon: '🌈',
    mechanic: 'Пистолет: +50% всего стихийного урона на 10 ходов. КД 50. Только одна ульта Т8.',
  },
  {
    id: 'sht_t8_exo', column: 'shooter', tier: 8, name: 'Экзоскелет', kind: 'active',
    maxRanks: 1, gate: 0, exclusiveWith: ['sht_t8_rage', 'sht_t8_elem', 'sht_t8_wind', 'sht_t8_barrage'], apCost: 1, cooldown: 50, icon: '🦾',
    mechanic: '-50% входящего урона на 5 ходов. КД 50. Только одна ульта Т8.',
  },
  {
    id: 'sht_t8_wind', column: 'shooter', tier: 8, name: 'Форсаж', kind: 'active',
    maxRanks: 1, gate: 0, exclusiveWith: ['sht_t8_rage', 'sht_t8_elem', 'sht_t8_exo', 'sht_t8_barrage'], apCost: 1, cooldown: 50, icon: '🌪️',
    mechanic: '+400% скорости на 1 ход. КД 50. Только одна ульта Т8.',
  },
  {
    id: 'sht_t8_barrage', column: 'shooter', tier: 8, name: 'Шквальный огонь', kind: 'active',
    maxRanks: 1, gate: 0, exclusiveWith: ['sht_t8_rage', 'sht_t8_elem', 'sht_t8_exo', 'sht_t8_wind'], apCost: 5, cooldown: 50, icon: '🌊',
    mechanic: 'Выстрелов = патронов в магазине, патроны не тратятся. КД 50. Только одна ульта Т8.',
  },
];

export const SHOOTER_BY_ID: Record<string, ShooterAbilityDef> = Object.fromEntries(
  SHOOTER_ABILITIES.map((a) => [a.id, a]),
);

export const SHOOTER_TIERS: number[] = [1, 2, 3, 4, 5, 6, 7, 8];

export const shooterOfTier = (tier: number): ShooterAbilityDef[] =>
  SHOOTER_ABILITIES.filter((a) => a.column === 'shooter' && a.tier === tier);

export const shooterFreeDefs = (): ShooterAbilityDef[] =>
  SHOOTER_ABILITIES.filter((a) => a.freeTake);

export const shooterMaxRanks = (): number =>
  SHOOTER_ABILITIES.reduce((s, a) => s + a.maxRanks, 0);

export type ShooterSkills = Record<string, number>;

/** очков (skills+pending) в тире */
export const shooterSpentInTier = (
  tier: number, skills: ShooterSkills, pending: ShooterSkills,
): number =>
  shooterOfTier(tier).reduce(
    (sum, a) => sum + (skills[a.id] || 0) + (pending[a.id] || 0), 0,
  );

/** очков в диапазоне тиров */
export const shooterSpentInTiers = (
  fromTier: number, toTier: number,
  skills: ShooterSkills, pending: ShooterSkills,
): number => {
  let sum = 0;
  for (let t = fromTier; t <= toTier; t++) sum += shooterSpentInTier(t, skills, pending);
  return sum;
};

export interface ShooterTierGate { fromTier: number; toTier: number; need: number; }

/** Суммарные гейты верхних тиров. */
export const SHOOTER_TIER_GATES: Record<string, ShooterTierGate> = {
  'shooter:3': { fromTier: 1, toTier: 2, need: 10 },
  'shooter:4': { fromTier: 1, toTier: 3, need: 15 },
  'shooter:5': { fromTier: 1, toTier: 4, need: 25 },
  'shooter:6': { fromTier: 1, toTier: 5, need: 30 },
  'shooter:7': { fromTier: 1, toTier: 6, need: 32 },
  'shooter:8': { fromTier: 1, toTier: 6, need: 35 },
};

/** Группы «выбери N»: тир -> [id...], максимум веток с рангами. */
export const SHOOTER_PICK_GROUPS: Record<number, { ids: string[]; max: number }> = {
  6: { ids: ['sht_t6_stim', 'sht_t6_bandage', 'sht_t6_acid', 'sht_t6_shred'], max: 2 },
  7: { ids: ['sht_t7_rgauto', 'sht_t7_rgpist', 'sht_t7_rgheavy', 'sht_t7_magpist', 'sht_t7_magauto', 'sht_t7_magheavy', 'sht_t7_magmg'], max: 2 },
};

/** проверка гейта тира: открыт ли тир */
export const shooterTierOpen = (
  tier: number, skills: ShooterSkills, pending: ShooterSkills,
): { open: boolean; need: number; have: number; label: string } => {
  if (tier <= 1) return { open: true, need: 0, have: 0, label: '' };
  const cg = SHOOTER_TIER_GATES[`shooter:${tier}`];
  if (cg) {
    const have = shooterSpentInTiers(cg.fromTier, cg.toTier, skills, pending);
    const label = cg.fromTier === cg.toTier ? `в тире ${cg.toTier}` : `за тиры ${cg.fromTier}-${cg.toTier}`;
    return { open: have >= cg.need, need: cg.need, have, label };
  }
  const def = SHOOTER_ABILITIES.find((a) => a.column === 'shooter' && a.tier === tier);
  const need = def ? def.gate : 0;
  const have = shooterSpentInTier(tier - 1, skills, pending);
  return { open: have >= need, need, have, label: `в тире ${tier - 1}` };
};

const groupTakenCount = (tier: number, skills: ShooterSkills, pending: ShooterSkills): number => {
  const g = SHOOTER_PICK_GROUPS[tier];
  if (!g) return 0;
  return g.ids.filter((id) => (skills[id] || 0) + (pending[id] || 0) > 0).length;
};

/** можно ли качать: гейт + эксклюзив + лимит группы + ветка */
export const shooterCanAllocate = (
  id: string, skills: ShooterSkills, pending: ShooterSkills, skillPoints: number,
): { ok: boolean; reason: string } => {
  const def = SHOOTER_BY_ID[id];
  if (!def) return { ok: false, reason: 'Нет такой способности' };
  // Базовые способности бесплатны: очки не нужны, гейт всегда открыт (тир 0).
  if (!def.freeTake && skillPoints <= 0) return { ok: false, reason: 'Нет очков' };
  const cur = (skills[id] || 0) + (pending[id] || 0);
  if (cur >= def.maxRanks) return { ok: false, reason: 'Максимум' };
  const gate = shooterTierOpen(def.tier, skills, pending);
  if (!gate.open && cur === 0) return { ok: false, reason: `Нужно ${gate.need} ${gate.label}` };
  if (def.exclusiveWith && !def.freeTake) {
    for (const rival of def.exclusiveWith) {
      if ((skills[rival] || 0) + (pending[rival] || 0) > 0) {
        const rdef = SHOOTER_BY_ID[rival];
        return { ok: false, reason: `Конфликт: выбрано «${rdef ? rdef.name : rival}»` };
      }
    }
  }
  // Группы «выбери N»: третью ветку открыть нельзя.
  const grp = SHOOTER_PICK_GROUPS[def.tier];
  if (grp && grp.ids.includes(id) && cur === 0 && groupTakenCount(def.tier, skills, pending) >= grp.max) {
    return { ok: false, reason: `Можно выбрать ${grp.max} (уже взяты)` };
  }
  return { ok: true, reason: '' };
};

/** текст тултипа: суммарный эффект на текущем ранге */
export const shooterRankText = (def: ShooterAbilityDef, rank: number): string => {
  if (def.statsPerRank) {
    return def.statsPerRank.map((s) => {
      if (['autoDamage', 'pistolDamage', 'heavyDamage', 'damage', 'armor', 'maxHp', 'maxStamina'].includes(s.stat)) {
        return `+${s.value * rank} ${s.text.replace(/^[+-][\d.]+%?\s*/, '')}`;
      }
      const total = s.value * rank;
      const shown = `${(total * 100).toFixed(total * 100 >= 10 ? 0 : 1)}%`;
      const label = s.text.replace(/^[+-][\d.]+%?\s*/, '');
      return `+${shown} ${label}`;
    }).join(' · ');
  }
  if (def.id === 'sht_t4_react') return `+${Math.round((1.0 + 0.1 * (rank - 1)) * 100)}% скорости на 1 ход`;
  if (def.id === 'sht_t4_head') return `3 цели по ×${Number((3 + 0.1 * (rank - 1)).toFixed(1))} урона`;
  if (def.id === 'sht_t4_bazooka') return `${Number((5 + 0.2 * (rank - 1)).toFixed(1))}x урона по клетке 3×3`;
  if (def.id === 'sht_t6_stim') return `+1 AP на ${5 + rank} ходов`;
  if (def.id === 'sht_t6_bandage') return `+${5 + (rank - 1)}% HP/ход, ×3 регена на ${3 + rank} ходов`;
  if (def.id === 'sht_t6_acid') return `-${50 + 5 * (rank - 1)}% брони + стан на ${5 + rank} ходов`;
  if (def.id === 'sht_t6_shred') return `+${100 + 20 * (rank - 1)}% пробития на ${2 + rank} ходов`;
  if (def.id === 'sht_t8_elem') return '+50% стихийного урона пистолета на 10 ходов';
  if (def.id === 'sht_t8_exo') return '-50% входящего урона на 5 ходов';
  if (def.id === 'sht_t8_wind') return '+400% скорости на 1 ход';
  if (def.id === 'sht_t8_barrage') return 'Выстрелов = патронам в магазине';
  if (def.tier === 7 && def.name.startsWith('Длинный ствол')) return 'Дальность +1 (всегда)';
  if (def.tier === 7 && def.name.startsWith('Магазин')) return def.mechanic || '';
  return def.mechanic || '';
};

/** Сборка боевой способности из дефа и ранга. Бесплатные (без расходника). */
export function buildShooterBattleAbility(
  def: ShooterAbilityDef, rank: number, zeroAp: boolean,
): AccessoryAbility & { image?: string; displayOnly?: boolean } {
  const base = {
    name: def.name,
    description: shooterRankText(def, Math.max(1, rank)),
    icon: def.icon,
    free: true,
    powerRating: 60,
  };
  const ap = (n: number) => (zeroAp ? 0 : n);
  switch (def.id) {
    case 'sht_medkit':
      return { ...base, id: 'shtb_medkit', apCost: ap(5), cooldown: 50, powerRating: 55, effects: [{ type: 'heal_percent', value: 25 }] };
    case 'sht_grenade':
      return { ...base, id: 'shtb_grenade', apCost: ap(2), cooldown: 5, powerRating: 60, requiresTarget: true, range: 8, effects: [{ type: 'damage', multiplier: 5, aoe: 2 }] };
    case 'sht_t4_head':
      return { ...base, id: 'shtb_head', apCost: ap(2), cooldown: 10, powerRating: 75, requiresTarget: true, multiTarget: 3, effects: [{ type: 'damage', multiplier: 3 + 0.1 * (rank - 1) }] };
    case 'sht_t4_react':
      return { ...base, id: 'shtb_react', apCost: ap(1), cooldown: 10, powerRating: 60, effects: [{ type: 'stat_boost', stat: 'speed', value: 1.0 + 0.1 * (rank - 1), duration: 1 }] };
    case 'sht_t4_bazooka':
      return { ...base, id: 'shtb_bazooka', apCost: ap(2), cooldown: 10, powerRating: 65, cellAoE: { radius: 1, range: 10 }, effects: [{ type: 'damage', multiplier: 5 + 0.2 * (rank - 1) }] };
    case 'sht_t6_stim':
      return { ...base, id: 'shtb_stim', apCost: ap(1), cooldown: 50, powerRating: 60, effects: [{ type: 'sprint_boost', duration: 5 + rank, value: 1 }] };
    case 'sht_t6_bandage':
      return {
        ...base, id: 'shtb_bandage', apCost: ap(1), cooldown: 50, powerRating: 60,
        effects: [
          { type: 'heal_over_time', value: 0.05 + 0.01 * (rank - 1), duration: 3 + rank },
          { type: 'stat_boost_mult', stat: 'regen', value: 2, duration: 3 + rank },
        ],
      };
    case 'sht_t6_acid':
      return {
        ...base, id: 'shtb_acid', apCost: ap(2), cooldown: 50, powerRating: 60, requiresTarget: true, range: 7,
        effects: [
          { type: 'stat_boost', stat: 'enemyArmorReduction', value: 0.5 + 0.05 * (rank - 1), duration: 5 + rank },
          { type: 'status', id: 'stun', duration: 1 },
        ],
      };
    case 'sht_t6_shred':
      return { ...base, id: 'shtb_shred', apCost: ap(1), cooldown: 50, powerRating: 60, range: 10, effects: [{ type: 'stat_boost', stat: 'punching', value: 1.0 + 0.2 * (rank - 1), duration: 2 + rank }] };
    case 'sht_t8_elem':
      return { ...base, id: 'shtb_elem', apCost: ap(1), cooldown: 50, powerRating: 65, effects: [] };
    case 'sht_t8_exo':
      return { ...base, id: 'shtb_exo', apCost: ap(1), cooldown: 50, powerRating: 65, effects: [{ type: 'stat_boost_mult', stat: 'incomingDamageMult', value: 0.5, duration: 5 }] };
    case 'sht_t8_wind':
      return { ...base, id: 'shtb_wind', apCost: ap(1), cooldown: 50, powerRating: 65, effects: [{ type: 'stat_boost', stat: 'speed', value: 4, duration: 1 }] };
    case 'sht_t8_barrage':
      return { ...base, id: 'shtb_barrage', apCost: ap(5), cooldown: 50, powerRating: 70, effects: [] };
    default:
      return { ...base, id: `shtb_${def.id}`, apCost: ap(def.apCost), cooldown: def.cooldown, powerRating: 50, effects: [] };
  }
}

/** Активные боевые способности стрелка по текущим скиллам (для арены). */
export function shooterBattleAbilities(
  skills: ShooterSkills, pending: ShooterSkills,
): (AccessoryAbility & { image?: string; displayOnly?: boolean })[] {
  const out: (AccessoryAbility & { image?: string; displayOnly?: boolean })[] = [];
  const zeroAp = ((skills['sht_reflexes'] || 0) + (pending['sht_reflexes'] || 0)) > 0;
  const activeIds = [
    'sht_medkit', 'sht_grenade',
    'sht_t4_head', 'sht_t4_react', 'sht_t4_bazooka',
    'sht_t6_stim', 'sht_t6_bandage', 'sht_t6_acid', 'sht_t6_shred',
    'sht_t8_elem', 'sht_t8_exo', 'sht_t8_wind', 'sht_t8_barrage',
  ];
  for (const id of activeIds) {
    const rank = (skills[id] || 0) + (pending[id] || 0);
    if (rank <= 0) continue;
    const def = SHOOTER_BY_ID[id];
    out.push(buildShooterBattleAbility(def, rank, zeroAp));
  }
  return out;
}

/**
 * Антиабуз: находит способности, которые стали недействительны
 * (сломан гейт тира или превышен лимит группы). Итеративно до fixpoint.
 */
export function shooterFindInvalid(skills: ShooterSkills, pending: ShooterSkills): string[] {
  const sk: ShooterSkills = { ...skills };
  const pe: ShooterSkills = { ...pending };
  const invalid: string[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const def of SHOOTER_ABILITIES) {
      if (invalid.includes(def.id)) continue;
      const tot = (sk[def.id] || 0) + (pe[def.id] || 0);
      if (tot <= 0) continue;
      const gate = shooterTierOpen(def.tier, sk, pe);
      let ok = gate.open;
      // Лимит группы «выбери N»: позже взятые ветки слетают первыми.
      if (ok) {
        const grp = SHOOTER_PICK_GROUPS[def.tier];
        if (grp && grp.ids.includes(def.id)) {
          const myIdx = grp.ids.indexOf(def.id);
          const earlierTaken = grp.ids.slice(0, myIdx).filter((gid) => !invalid.includes(gid) && ((sk[gid] || 0) + (pe[gid] || 0)) > 0).length;
          if (earlierTaken >= grp.max) ok = false;
        }
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
