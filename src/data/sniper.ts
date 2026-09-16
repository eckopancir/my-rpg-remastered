import type { AccessoryAbility } from '../types/abilities';
import { ammoTypeForWeapon } from './ammo';

export type SniperColumn = 'attack' | 'defense';
export type SniperKind = 'stat' | 'active' | 'conditional' | 'passive' | 'ulta';

export interface SniperStatPerRank {
  stat: string;
  /** прибавка за 1 ранг (крит/уклон в долях: 0.01 = 1%) */
  value: number;
  /** текст для тултипа за 1 ранг */
  text: string;
}

export interface SniperAbilityDef {
  id: string;
  column: SniperColumn;
  tier: number;
  /** ключ картинки: '1.1' | 'def 5.1' */
  img: string;
  name: string;
  kind: SniperKind;
  maxRanks: number;
  /** очков в предыдущем тире колонки для открытия */
  gate: number;
  /** взаимоисключающие id (только одна ветка) */
  exclusiveWith?: string[];
  /** ветка-гейт: id способности, которая должна быть вкачана (Т5) */
  requiresAbility?: string;
  /** базовый AP (активные); для def T4 считается динамически через apCostFor */
  apCost: number;
  cooldown: number;
  /** статовые пассивки: прибавка за ранг */
  statsPerRank?: SniperStatPerRank[];
  /** короткое описание механики для тултипа */
  mechanic?: string;
}

const R = (stat: string, value: number, text: string): SniperStatPerRank => ({ stat, value, text });

export const SNIPER_META = {
  id: 'sniper',
  name: 'Снайпер',
  icon: '🎯',
  color: '#22c55e',
};

export const SNIPER_ABILITIES: SniperAbilityDef[] = [
  // ---------- АТАКА ----------
  { id: 'snp_a1_crit', column: 'attack', tier: 1, img: '1.1', name: '+1% крит', kind: 'stat', maxRanks: 10, gate: 0, apCost: 0, cooldown: 0, statsPerRank: [R('crit', 0.01, '+1% крит')] },
  { id: 'snp_a1_mix', column: 'attack', tier: 1, img: '1.2', name: 'Крит + урон', kind: 'stat', maxRanks: 5, gate: 0, apCost: 0, cooldown: 0, statsPerRank: [R('crit', 0.005, '+0.5% крит'), R('damage', 1, '+1 урон')] },
  { id: 'snp_a2_acc', column: 'attack', tier: 2, img: '2.1', name: '+1% меткость', kind: 'stat', maxRanks: 10, gate: 5, apCost: 0, cooldown: 0, statsPerRank: [R('accuracy', 0.01, '+1% меткость')] },
  { id: 'snp_a2_mix', column: 'attack', tier: 2, img: '2.2', name: 'Меткость + урон', kind: 'stat', maxRanks: 5, gate: 5, apCost: 0, cooldown: 0, statsPerRank: [R('accuracy', 0.005, '+0.5% меткость'), R('damage', 2, '+2 урона')] },
  { id: 'snp_a3_punch', column: 'attack', tier: 3, img: '3.1', name: '+2% пробитие', kind: 'stat', maxRanks: 10, gate: 5, apCost: 0, cooldown: 0, statsPerRank: [R('punching', 0.02, '+2% пробитие')] },
  { id: 'snp_a3_mix', column: 'attack', tier: 3, img: '3.2', name: 'Пробитие + урон', kind: 'stat', maxRanks: 5, gate: 5, apCost: 0, cooldown: 0, statsPerRank: [R('punching', 0.01, '+1% пробитие'), R('damage', 2, '+2 урона')] },

  {
    id: 'snp_a4_eagle', column: 'attack', tier: 4, img: '4.1', name: 'Орлиный взгляд', kind: 'active',
    maxRanks: 5, gate: 5, exclusiveWith: ['snp_a4_ammo'], apCost: 2, cooldown: 50,
    mechanic: 'Меткость +100% на N ходов (N = 1 + ранг). КД 50.',
  },
  {
    id: 'snp_a4_ammo', column: 'attack', tier: 4, img: '4.2', name: 'Бронебойные патроны', kind: 'active',
    maxRanks: 5, gate: 5, exclusiveWith: ['snp_a4_eagle'], apCost: 2, cooldown: 50,
    mechanic: 'Пробитие +100% на N ходов (N = 1 + ранг). КД 50.',
  },

  { id: 'snp_a5_eagle', column: 'attack', tier: 5, img: '5.1', name: 'Глаз хищника', kind: 'stat', maxRanks: 2, gate: 5, requiresAbility: 'snp_a4_eagle', apCost: 0, cooldown: 0, statsPerRank: [R('crit', 0.10, '+10% крит'), R('accuracy', 0.05, '+5% меткости')] },
  { id: 'snp_a5_ammo', column: 'attack', tier: 5, img: '5.2', name: 'Вольфрамовый сердечник', kind: 'stat', maxRanks: 2, gate: 5, requiresAbility: 'snp_a4_ammo', apCost: 0, cooldown: 0, statsPerRank: [R('punching', 0.15, '+15% пробитие')] },

  { id: 'snp_a6_range', column: 'attack', tier: 6, img: '6.1', name: 'Длинная рука', kind: 'passive', maxRanks: 2, gate: 4, apCost: 0, cooldown: 0, mechanic: 'Дальность выстрела +1 за ранг (всегда).' },
  { id: 'snp_a6_cheap', column: 'attack', tier: 6, img: '6.2', name: 'Холодный расчёт', kind: 'passive', maxRanks: 2, gate: 4, apCost: 0, cooldown: 0, mechanic: 'Способности снайпера дешевле на 1AP за ранг (минимум 0AP).' },
  { id: 'snp_a6_trade', column: 'attack', tier: 6, img: '6.3', name: 'Оружейный барон', kind: 'passive', maxRanks: 2, gate: 4, apCost: 0, cooldown: 0, mechanic: 'Продажа снайперского оружия: 80% цены (1 ранг), 100% (2 ранг) вместо 40%.' },

  {
    id: 'snp_a7_deadeye', column: 'attack', tier: 7, img: '7.1', name: 'Прицельный выстрел', kind: 'ulta',
    maxRanks: 1, gate: 5, exclusiveWith: ['snp_a7_rapid', 'snp_a7_glass'], apCost: 2, cooldown: 50,
    mechanic: '500% крит на 2 хода. КД 50.',
  },
  {
    id: 'snp_a7_rapid', column: 'attack', tier: 7, img: '7.2', name: 'Скорострел', kind: 'ulta',
    maxRanks: 1, gate: 5, exclusiveWith: ['snp_a7_deadeye', 'snp_a7_glass'], apCost: 2, cooldown: 50,
    mechanic: 'Перезарядка стоит 0 AP в течение 5 ходов. КД 50.',
  },
  {
    id: 'snp_a7_glass', column: 'attack', tier: 7, img: '7.3', name: 'Стеклянная пушка', kind: 'ulta',
    maxRanks: 1, gate: 5, exclusiveWith: ['snp_a7_deadeye', 'snp_a7_rapid'], apCost: 0, cooldown: 0,
    mechanic: 'Пассивка: входящий урон +50%, ваш урон +25%. Нажать нельзя.',
  },

  // ---------- ЗАЩИТА ----------
  { id: 'snp_d1_eva', column: 'defense', tier: 1, img: 'def 1.1', name: '+1% уклонение', kind: 'stat', maxRanks: 10, gate: 0, apCost: 0, cooldown: 0, statsPerRank: [R('evasion', 0.01, '+1% уклонение')] },
  { id: 'snp_d1_arm', column: 'defense', tier: 1, img: 'def 1.2', name: '+1 броня', kind: 'stat', maxRanks: 5, gate: 0, apCost: 0, cooldown: 0, statsPerRank: [R('armor', 1, '+1 броня')] },
  { id: 'snp_d2_hp', column: 'defense', tier: 2, img: 'def 2.1', name: '+200 HP', kind: 'stat', maxRanks: 5, gate: 5, apCost: 0, cooldown: 0, statsPerRank: [R('maxHp', 200, '+200 HP')] },
  { id: 'snp_d2_arm', column: 'defense', tier: 2, img: 'def 2.2', name: '+2 броня', kind: 'stat', maxRanks: 5, gate: 5, apCost: 0, cooldown: 0, statsPerRank: [R('armor', 2, '+2 броня')] },

  {
    id: 'snp_d3_low', column: 'defense', tier: 3, img: 'def 3.1', name: 'Чутьё раненого', kind: 'conditional',
    maxRanks: 2, gate: 5, exclusiveWith: ['snp_d3_high'], apCost: 0, cooldown: 0,
    mechanic: 'Пока HP < 50%: +10% уклонения за ранг (макс +20%).',
  },
  {
    id: 'snp_d3_high', column: 'defense', tier: 3, img: 'def 3.2', name: 'Кураж', kind: 'conditional',
    maxRanks: 2, gate: 5, exclusiveWith: ['snp_d3_low'], apCost: 0, cooldown: 0,
    mechanic: 'Пока HP ≥ 90%: +10% крит и −10% уклонения за ранг (макс +20% / −20%).',
  },

  {
    id: 'snp_d4_nest', column: 'defense', tier: 4, img: 'def 4.1', name: 'Снайперская позиция', kind: 'active',
    maxRanks: 5, gate: 4, apCost: 2, cooldown: 50,
    mechanic: 'Нельзя двигаться 5 ходов, +10% блока. КД 50.',
  },
  {
    id: 'snp_d4_camo', column: 'defense', tier: 4, img: 'def 4.2', name: 'Маскировка', kind: 'active',
    maxRanks: 5, gate: 4, apCost: 2, cooldown: 50,
    mechanic: '100% уклонения на 3 хода. КД 50.',
  },

  {
    id: 'snp_d5_blood', column: 'defense', tier: 5, img: 'def 5.1', name: 'Блудскикер', kind: 'ulta',
    maxRanks: 1, gate: 5, apCost: 2, cooldown: 50,
    mechanic: '+100% вампиризм на 1 ход. КД 50.',
  },
  {
    id: 'snp_d5_med', column: 'defense', tier: 5, img: 'def 5.2', name: 'Аптечка снайпера', kind: 'ulta',
    maxRanks: 1, gate: 5, apCost: 0, cooldown: 50,
    mechanic: '+40% HP мгновенно. КД 50.',
  },
];

export const SNIPER_BY_ID: Record<string, SniperAbilityDef> = Object.fromEntries(
  SNIPER_ABILITIES.map((a) => [a.id, a]),
);

export const SNIPER_TIERS: Record<SniperColumn, number[]> = {
  attack: [1, 2, 3, 4, 5, 6, 7],
  defense: [1, 2, 3, 4, 5],
};

export const sniperOfTier = (column: SniperColumn, tier: number): SniperAbilityDef[] =>
  SNIPER_ABILITIES.filter((a) => a.column === column && a.tier === tier);

export const sniperMaxRanks = (): number =>
  SNIPER_ABILITIES.reduce((s, a) => s + a.maxRanks, 0);

export type SniperSkills = Record<string, number>;

export const sniperRank = (s: SniperSkills, id: string): number => s[id] || 0;

/** очков (skills+pending) в тире колонки */
export const sniperSpentInTier = (
  column: SniperColumn, tier: number,
  skills: SniperSkills, pending: SniperSkills,
): number =>
  sniperOfTier(column, tier).reduce(
    (sum, a) => sum + (skills[a.id] || 0) + (pending[a.id] || 0), 0,
  );

/** проверка гейта тира: открыт ли тир */
export const sniperTierOpen = (
  column: SniperColumn, tier: number,
  skills: SniperSkills, pending: SniperSkills,
): { open: boolean; need: number; have: number } => {
  if (tier <= 1) return { open: true, need: 0, have: 0 };
  const def = SNIPER_ABILITIES.find((a) => a.column === column && a.tier === tier);
  const need = def ? def.gate : 0;
  const have = sniperSpentInTier(column, tier - 1, skills, pending);
  return { open: have >= need, need, have };
};

/** можно ли качать: гейт + эксклюзив + ветка */
export const sniperCanAllocate = (
  id: string, skills: SniperSkills, pending: SniperSkills, skillPoints: number,
): { ok: boolean; reason: string } => {
  const def = SNIPER_BY_ID[id];
  if (!def) return { ok: false, reason: 'Нет такой способности' };
  if (skillPoints <= 0) return { ok: false, reason: 'Нет очков' };
  const cur = (skills[id] || 0) + (pending[id] || 0);
  if (cur >= def.maxRanks) return { ok: false, reason: 'Максимум' };
  const gate = sniperTierOpen(def.column, def.tier, skills, pending);
  if (!gate.open && cur === 0) return { ok: false, reason: `Нужно ${gate.need} очков в тире ${def.tier - 1}` };
  if (def.exclusiveWith) {
    for (const rival of def.exclusiveWith) {
      if ((skills[rival] || 0) + (pending[rival] || 0) > 0) {
        const rdef = SNIPER_BY_ID[rival];
        return { ok: false, reason: `Конфликт: выбрано «${rdef ? rdef.name : rival}»` };
      }
    }
  }
  if (def.requiresAbility) {
    const r = (skills[def.requiresAbility] || 0) + (pending[def.requiresAbility] || 0);
    if (r <= 0) {
      const rdef = SNIPER_BY_ID[def.requiresAbility];
      return { ok: false, reason: `Нужна «${rdef ? rdef.name : def.requiresAbility}»` };
    }
  }
  return { ok: true, reason: '' };
};

/** текст тултипа: суммарный эффект на текущем ранге */
export const sniperRankText = (def: SniperAbilityDef, rank: number): string => {
  if (def.statsPerRank) {
    return def.statsPerRank.map((s) => {
      const total = s.value * rank;
      const isPct = ['crit', 'evasion', 'block', 'punching', 'accuracy', 'vampir', 'speed'].includes(s.stat);
      const shown = isPct ? `${(total * 100).toFixed(total * 100 >= 10 ? 0 : 1)}%` : `${total}`;
      const label = s.text.replace(/^[+-][\d.]+%?\s*/, '');
      return `+${shown} ${label}`;
    }).join(' · ');
  }
  if (def.id === 'snp_a4_eagle') return `Меткость +100% на ${rank + 1} ${plural(rank + 1, 'ход', 'хода', 'ходов')}`;
  if (def.id === 'snp_a4_ammo') return `Пробитие +100% на ${rank + 1} ${plural(rank + 1, 'ход', 'хода', 'ходов')}`;
  if (def.id === 'snp_a6_range') return `Дальность +${rank} (всегда)`;
  if (def.id === 'snp_a6_cheap') return `Способности дешевле на ${rank}AP (мин. 0)`;
  if (def.id === 'snp_a6_trade') return rank >= 2 ? 'Продажа снайперского оружия за 100% цены' : 'Продажа снайперского оружия за 80% цены';
  if (def.id === 'snp_a7_deadeye') return '500% крит на 2 хода';
  if (def.id === 'snp_a7_rapid') return 'Перезарядка 0 AP в течение 5 ходов';
  if (def.id === 'snp_a7_glass') return 'Входящий урон +50%, ваш урон +25% (пассивка)';
  if (def.id === 'snp_d3_low') return `HP < 50%: +${rank * 10}% уклонения`;
  if (def.id === 'snp_d3_high') return `HP ≥ 90%: +${rank * 10}% крит, −${rank * 10}% уклонения`;
  if (def.id === 'snp_d4_nest') return 'Стойка 5 ходов: без движения, +10% блока';
  if (def.id === 'snp_d4_camo') return '100% уклонения на 3 хода';
  if (def.id === 'snp_d5_blood') return '+100% вампиризм на 1 ход';
  if (def.id === 'snp_d5_med') return '+40% HP мгновенно';
  return def.mechanic || '';
};

const plural = (n: number, one: string, few: string, many: string): string => {
  const m = n % 10, h = n % 100;
  if (m === 1 && h !== 11) return one;
  if (m >= 2 && m <= 4 && (h < 12 || h > 14)) return few;
  return many;
};

/** следующий ранг: текст прироста */
export const sniperNextText = (def: SniperAbilityDef, rank: number): string =>
  sniperRankText(def, rank + 1);

/** Сборка боевой способности из дефа и ранга (картинка тира — иконка на арене). */
export function buildSniperBattleAbility(
  def: SniperAbilityDef, rank: number, apDiscount: number,
): AccessoryAbility & { image: string; displayOnly?: boolean } {
  const img = def.img;
  const base = {
    name: def.name,
    description: sniperRankText(def, Math.max(1, rank)),
    icon: '🎯',
    image: img,
    free: true,
    powerRating: 60,
  };
  const ap = (n: number) => Math.max(0, n - apDiscount);
  switch (def.id) {
    case 'snp_a4_eagle':
      return { ...base, id: 'snpb_eagle', apCost: ap(2), cooldown: 50, powerRating: 65, effects: [{ type: 'stat_boost', stat: 'accuracy', value: 1.0, duration: rank + 1 }] };
    case 'snp_a4_ammo':
      return { ...base, id: 'snpb_ammo', apCost: ap(2), cooldown: 50, powerRating: 65, effects: [{ type: 'stat_boost', stat: 'punching', value: 1.0, duration: rank + 1 }] };
    case 'snp_a7_deadeye':
      return { ...base, id: 'snpb_deadeye', apCost: ap(2), cooldown: 50, powerRating: 75, effects: [{ type: 'stat_boost', stat: 'crit', value: 5.0, duration: 2 }] };
    case 'snp_a7_rapid':
      return { ...base, id: 'snpb_rapid', apCost: ap(2), cooldown: 50, powerRating: 65, effects: [{ type: 'free_reload', duration: 5 } as any] };
    case 'snp_a7_glass':
      return { ...base, id: 'snpb_glass', apCost: 0, cooldown: 0, powerRating: 50, effects: [], displayOnly: true };
    case 'snp_d4_nest':
      return { ...base, id: 'snpb_nest', apCost: ap(2), cooldown: 50, powerRating: 60, effects: [{ type: 'status', id: 'rooted', duration: 5 } as any, { type: 'stat_boost', stat: 'block', value: 0.10, duration: 5 }] };
    case 'snp_d4_camo':
      return { ...base, id: 'snpb_camo', apCost: ap(2), cooldown: 50, powerRating: 60, effects: [{ type: 'stat_boost', stat: 'evasion', value: 1.0, duration: 3 }] };
    case 'snp_d5_blood':
      return { ...base, id: 'snpb_blood', apCost: ap(2), cooldown: 50, powerRating: 60, effects: [{ type: 'stat_boost', stat: 'vampir', value: 1.0, duration: 1 }] };
    case 'snp_d5_med':
      return { ...base, id: 'snpb_med', apCost: ap(0), cooldown: 50, powerRating: 55, effects: [{ type: 'heal_percent', value: 40 }] };
    default:
      return { ...base, id: `snpb_${def.id}`, apCost: ap(def.apCost), cooldown: def.cooldown, powerRating: 50, effects: [] };
  }
}

/** Ставка продажи снайперского оружия (Т6): 0.8 / 1.0 вместо 0.4. Иначе null. */
export function sniperSellRate(item: { name?: string }, tradeRank: number): number | null {
  if (tradeRank <= 0) return null;
  if (ammoTypeForWeapon(item) !== 'sniper') return null;
  return tradeRank >= 2 ? 1.0 : 0.8;
}

/** Активные боевые способности снайпера по текущим скиллам (для арены). */
export function sniperBattleAbilities(
  skills: SniperSkills, pending: SniperSkills,
): (AccessoryAbility & { image: string; displayOnly?: boolean })[] {
  const out: (AccessoryAbility & { image: string; displayOnly?: boolean })[] = [];
  const discount = Math.min(2, (skills['snp_a6_cheap'] || 0) + (pending['snp_a6_cheap'] || 0));
  const activeIds = [
    'snp_a4_eagle', 'snp_a4_ammo',
    'snp_a7_deadeye', 'snp_a7_rapid', 'snp_a7_glass',
    'snp_d4_nest', 'snp_d4_camo',
    'snp_d5_blood', 'snp_d5_med',
  ];
  for (const id of activeIds) {
    const rank = (skills[id] || 0) + (pending[id] || 0);
    if (rank <= 0) continue;
    const def = SNIPER_BY_ID[id];
    out.push(buildSniperBattleAbility(def, rank, discount));
  }
  return out;
}
