import type { AccessoryAbility } from '../types/abilities';
import { ammoTypeForWeapon, weaponRangeProfile } from './ammo';

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
  /** базовая способность класса: вкачивание бесплатно, без очков */
  freeTake?: boolean;
  /** иконка-эмодзи для ячеек без картинки */
  icon?: string;
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
    id: 'snp_a7_deadeye', column: 'attack', tier: 0, img: 'прицельный выстрел', name: 'Прицельный выстрел', kind: 'active',
    maxRanks: 1, gate: 0, exclusiveWith: ['snp_x_aim'], freeTake: true, apCost: 2, cooldown: 50,
    mechanic: '×3 урона, полностью мимо брони. КД 50. Только одна база: Аимшот / Прицельный.',
  },
  {
    id: 'snp_x_aim', column: 'attack', tier: 0, img: 'аимшот', name: 'Аимшот', kind: 'active',
    maxRanks: 1, gate: 0, exclusiveWith: ['snp_a7_deadeye'], freeTake: true, apCost: 2, cooldown: 50,
    mechanic: '×5 урона с 20 клеток. Броня работает. КД 50. Только одна база: Аимшот / Прицельный.',
  },
  {
    id: 'snp_x_stealth', column: 'attack', tier: 0, img: 'невидимость', name: 'Скрытность', kind: 'passive',
    maxRanks: 1, gate: 0, freeTake: true, apCost: 0, cooldown: 0,
    mechanic: 'Первый выстрел из скрытности: +100% крит. Выдаётся сразу при выборе снайпера.',
  },
  {
    id: 'snp_a7_crit', column: 'attack', tier: 7, img: '7.1', name: 'Ваншот', kind: 'ulta',
    maxRanks: 1, gate: 5, exclusiveWith: ['snp_a7_rapid', 'snp_a7_glass'], apCost: 2, cooldown: 50,
    mechanic: 'Крит ровно 500% на 1 ход (даже с 700% станет 500%). КД 50. Только одна ульта Т7.',
  },
  {
    id: 'snp_a7_rapid', column: 'attack', tier: 7, img: '7.2', name: 'Скорострел', kind: 'ulta',
    maxRanks: 1, gate: 5, exclusiveWith: ['snp_a7_glass', 'snp_a7_crit'], apCost: 2, cooldown: 50,
    mechanic: 'Перезарядка стоит 0 AP в течение 5 ходов. КД 50. Только одна ульта Т7.',
  },
  {
    id: 'snp_a7_glass', column: 'attack', tier: 7, img: '7.3', name: 'Стеклянная пушка', kind: 'ulta',
    maxRanks: 1, gate: 5, exclusiveWith: ['snp_a7_rapid', 'snp_a7_crit'], apCost: 0, cooldown: 0,
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
    mechanic: 'Нельзя двигаться 5 ходов, +2% шанса блока за ранг (5 ранг = 10% шанс). КД 50.',
  },
  {
    id: 'snp_d4_camo', column: 'defense', tier: 4, img: 'def 4.2', name: 'Маскировка', kind: 'active',
    maxRanks: 5, gate: 4, apCost: 2, cooldown: 50,
    mechanic: '+20% уклонения за ранг на 2 хода. КД 50.',
  },

  {
    id: 'snp_d5_blood', column: 'defense', tier: 5, img: 'def 5.1', name: 'Бладсикер', kind: 'ulta',
    maxRanks: 1, gate: 5, exclusiveWith: ['snp_d5_med'], apCost: 2, cooldown: 50,
    mechanic: '+100% вампиризм на 1 ход. КД 50. Только одна ульта Т5.',
  },
  {
    id: 'snp_d5_med', column: 'defense', tier: 5, img: 'def 5.2', name: 'Аптечка снайпера', kind: 'ulta',
    maxRanks: 1, gate: 5, exclusiveWith: ['snp_d5_blood'], apCost: 0, cooldown: 50,
    mechanic: '+40% HP мгновенно. КД 50. Только одна ульта Т5.',
  },
  {
    id: 'snp_d6_tele', column: 'defense', tier: 6, img: 'def 6.1', name: 'Телепорт', kind: 'active',
    maxRanks: 1, gate: 5, apCost: 2, cooldown: 50,
    mechanic: 'Телепорт на видимую клетку. После него можно скрыться (F) даже в бою. КД 50. Нужны очки в защите 1–5.',
  },
];

export const SNIPER_BY_ID: Record<string, SniperAbilityDef> = Object.fromEntries(
  SNIPER_ABILITIES.map((a) => [a.id, a]),
);

export const SNIPER_TIERS: Record<SniperColumn, number[]> = {
  attack: [1, 2, 3, 4, 5, 6, 7],
  defense: [1, 2, 3, 4, 5, 6],
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

/** очков в диапазоне тиров */
export const sniperSpentInTiers = (
  column: SniperColumn, fromTier: number, toTier: number,
  skills: SniperSkills, pending: SniperSkills,
): number => {
  let sum = 0;
  for (let t = fromTier; t <= toTier; t++) sum += sniperSpentInTier(column, t, skills, pending);
  return sum;
};

export interface SniperTierGate { fromTier: number; toTier: number; need: number; }

/** Суммарные гейты верхних тиров (вместо «очков в предыдущем тире»). */
export const SNIPER_TIER_GATES: Record<string, SniperTierGate> = {
  'attack:6': { fromTier: 1, toTier: 5, need: 25 },
  'attack:7': { fromTier: 1, toTier: 6, need: 25 },
  'defense:4': { fromTier: 1, toTier: 3, need: 15 },
  'defense:5': { fromTier: 1, toTier: 4, need: 20 },
  'defense:6': { fromTier: 1, toTier: 5, need: 25 },
};

/** проверка гейта тира: открыт ли тир */
export const sniperTierOpen = (
  column: SniperColumn, tier: number,
  skills: SniperSkills, pending: SniperSkills,
): { open: boolean; need: number; have: number; label: string } => {
  if (tier <= 1) return { open: true, need: 0, have: 0, label: '' };
  const cg = SNIPER_TIER_GATES[`${column}:${tier}`];
  if (cg) {
    const have = sniperSpentInTiers(column, cg.fromTier, cg.toTier, skills, pending);
    const label = cg.fromTier === cg.toTier ? `в тире ${cg.toTier}` : `за тиры ${cg.fromTier}-${cg.toTier}`;
    return { open: have >= cg.need, need: cg.need, have, label };
  }
  const def = SNIPER_ABILITIES.find((a) => a.column === column && a.tier === tier);
  const need = def ? def.gate : 0;
  const have = sniperSpentInTier(column, tier - 1, skills, pending);
  return { open: have >= need, need, have, label: `в тире ${tier - 1}` };
};

/** можно ли качать: гейт + эксклюзив + ветка */
export const sniperCanAllocate = (
  id: string, skills: SniperSkills, pending: SniperSkills, skillPoints: number,
): { ok: boolean; reason: string } => {
  const def = SNIPER_BY_ID[id];
  if (!def) return { ok: false, reason: 'Нет такой способности' };
  // Базовые способности бесплатны: очки не нужны, гейт всегда открыт (тир 0).
  if (!def.freeTake && skillPoints <= 0) return { ok: false, reason: 'Нет очков' };
  const cur = (skills[id] || 0) + (pending[id] || 0);
  if (cur >= def.maxRanks) return { ok: false, reason: 'Максимум' };
  const gate = sniperTierOpen(def.column, def.tier, skills, pending);
  if (!gate.open && cur === 0) return { ok: false, reason: `Нужно ${gate.need} ${gate.label}` };
  // Эксклюзив базовых не блокирует: взятие переключает (вторая активируется, первая гаснет).
  if (def.exclusiveWith && !def.freeTake) {
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
      // Блок — прямые проценты (без ×100).
      if (s.stat === 'block') {
        const label = s.text.replace(/^[+-][\d.]+%?\s*/, '');
        return `+${total}% ${label}`;
      }
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
  if (def.id === 'snp_a7_deadeye') return '×3 урона, полностью мимо брони';
  if (def.id === 'snp_a7_crit') return 'Крит ровно 500% на 1 ход';
  if (def.id === 'snp_x_aim') return '×5 урона с 20 клеток';
  if (def.id === 'snp_x_stealth') return '+100% крит первого выстрела из скрытности';
  if (def.id === 'snp_a7_rapid') return 'Перезарядка 0 AP в течение 5 ходов';
  if (def.id === 'snp_a7_glass') return 'Входящий урон +50%, ваш урон +25% (пассивка)';
  if (def.id === 'snp_d3_low') return `HP < 50%: +${rank * 10}% уклонения`;
  if (def.id === 'snp_d3_high') return `HP ≥ 90%: +${rank * 10}% крит, −${rank * 10}% уклонения`;
  if (def.id === 'snp_d4_nest') return `Стойка 5 ходов: без движения, +${rank * 2}% шанса блока`;
  if (def.id === 'snp_d4_camo') return `+${rank * 20}% уклонения на 2 хода`;
  if (def.id === 'snp_d5_blood') return '+100% вампиризм на 1 ход';
  if (def.id === 'snp_d5_med') return '+40% HP мгновенно';
  if (def.id === 'snp_d6_tele') return 'Телепорт на видимую клетку + скрытность (F) даже в бою';
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
      return { ...base, id: 'snpb_deadeye', apCost: ap(2), cooldown: 50, powerRating: 75, range: 14, requiresTarget: true, effects: [{ type: 'damage', multiplier: 3 }] };
    case 'snp_a7_crit':
      return { ...base, id: 'snpb_crit', apCost: ap(2), cooldown: 50, powerRating: 75, effects: [{ type: 'stat_set', stat: 'crit', value: 5.0, duration: 1 }] };
    case 'snp_x_aim':
      return { ...base, id: 'snpb_aimshot', apCost: ap(2), cooldown: 50, powerRating: 80, range: 20, requiresTarget: true, effects: [{ type: 'damage', multiplier: 5 }] };
    case 'snp_a7_rapid':
      return { ...base, id: 'snpb_rapid', apCost: ap(2), cooldown: 50, powerRating: 65, effects: [{ type: 'free_reload', duration: 5 } as any] };
    case 'snp_a7_glass':
      return { ...base, id: 'snpb_glass', apCost: 0, cooldown: 0, powerRating: 50, effects: [], displayOnly: true };
    case 'snp_d4_nest':
      return { ...base, id: 'snpb_nest', apCost: ap(2), cooldown: 50, powerRating: 60, effects: [{ type: 'status', id: 'rooted', duration: 5 } as any, { type: 'stat_boost', stat: 'block', value: 2.0 * rank, duration: 5 }] };
    case 'snp_d4_camo':
      return { ...base, id: 'snpb_camo', apCost: ap(2), cooldown: 50, powerRating: 60, effects: [{ type: 'stat_boost', stat: 'evasion', value: 0.20 * rank, duration: 2 }] };
    case 'snp_d5_blood':
      return { ...base, id: 'snpb_blood', apCost: ap(2), cooldown: 50, powerRating: 60, effects: [{ type: 'stat_boost', stat: 'vampir', value: 1.0, duration: 1 }] };
    case 'snp_d5_med':
      return { ...base, id: 'snpb_med', apCost: ap(0), cooldown: 50, powerRating: 55, effects: [{ type: 'heal_percent', value: 40 }] };
    case 'snp_d6_tele':
      return { ...base, id: 'snpb_teleport', apCost: ap(2), cooldown: 50, powerRating: 60, effects: [{ type: 'teleport', stealthReady: true }] };
    default:
      return { ...base, id: `snpb_${def.id}`, apCost: ap(def.apCost), cooldown: def.cooldown, powerRating: 50, effects: [] };
  }
}

/** Снайперское оружие: патроны «sniper» + ствол + дальность 12–14.
 * Дальность отсекает «Дробовик/Пулемёт-Снайпер» (у них 5/8) и шлемы/моды/патроны. */
export function isSniperWeapon(item: { name?: string; ammoGroup?: string; ammoType?: string; ammoCapacity?: number; type?: string; slot?: string }): boolean {
  if ((item as any).type === 'bullet') return false;
  if (ammoTypeForWeapon(item) !== 'sniper') return false;
  const isGun = (item as any).ammoCapacity != null
    || (item as any).type === 'weapon'
    || String((item as any).slot || '').startsWith('weapon');
  if (!isGun) return false;
  const range = weaponRangeProfile(item).range;
  return range >= 12 && range <= 14;
}

/** Ставка продажи снайперского оружия (Т6): 0.8 / 1.0 вместо 0.4. Иначе null. */
export function sniperSellRate(item: { name?: string; ammoGroup?: string; ammoType?: string; ammoCapacity?: number; type?: string; slot?: string }, tradeRank: number): number | null {
  if (tradeRank <= 0) return null;
  const group = item.ammoGroup || item.ammoType || null;
  if (group !== null && group !== undefined && group !== 'sniper') return null;
  if (!isSniperWeapon(item)) return null;
  return tradeRank >= 2 ? 1.0 : 0.8;
}

/**
 * Антиабуз: находит способности, которые стали недействительны
 * (сломан гейт тира или ветка требует снятую способность).
 * Возвращает id для каскадного снятия. Итеративно до fixpoint,
 * очки невалидных не учитываются в гейтах остальных.
 */
export function sniperFindInvalid(skills: SniperSkills, pending: SniperSkills): string[] {
  const sk: SniperSkills = { ...skills };
  const pe: SniperSkills = { ...pending };
  const invalid: string[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const def of SNIPER_ABILITIES) {
      if (invalid.includes(def.id)) continue;
      const tot = (sk[def.id] || 0) + (pe[def.id] || 0);
      if (tot <= 0) continue;
      const gate = sniperTierOpen(def.column, def.tier, sk, pe);
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

/** Активные боевые способности снайпера по текущим скиллам (для арены). */
export function sniperBattleAbilities(
  skills: SniperSkills, pending: SniperSkills,
): (AccessoryAbility & { image: string; displayOnly?: boolean })[] {
  const out: (AccessoryAbility & { image: string; displayOnly?: boolean })[] = [];
  const discount = Math.min(2, (skills['snp_a6_cheap'] || 0) + (pending['snp_a6_cheap'] || 0));
  const activeIds = [
    'snp_a4_eagle', 'snp_a4_ammo',
    'snp_a7_deadeye', 'snp_x_aim', 'snp_a7_rapid', 'snp_a7_crit', 'snp_a7_glass',
    'snp_d4_nest', 'snp_d4_camo',
    'snp_d5_blood', 'snp_d5_med', 'snp_d6_tele',
  ];
  for (const id of activeIds) {
    const rank = (skills[id] || 0) + (pending[id] || 0);
    if (rank <= 0) continue;
    const def = SNIPER_BY_ID[id];
    out.push(buildSniperBattleAbility(def, rank, discount));
  }
  return out;
}
