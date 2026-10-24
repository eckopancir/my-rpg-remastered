import type { ServerEventRow } from '../../stores/explorationStore';
import type {
  TravelEvent,
  TravelEventKind,
  TravelRewardItem,
  TravelRewards,
} from '../../types/travel';

/** Тип серверного события → наш вид. */
const KIND_BY_TYPE: Record<string, TravelEventKind> = {
  combat: 'combat',
  trade: 'trade',
  story: 'story',
  discovery: 'discovery',
  danger: 'danger',
  anomaly: 'anomaly',
  neutral: 'neutral',
  heal: 'heal',
  loot: 'loot',
  legendary: 'legendary',
  system: 'system',
};

export interface KindMeta {
  label: string;
  icon: string;
  color: string;
}

/** Метаданные вида события: заголовок, иконка, цвет акцента. */
export const KIND_META: Record<TravelEventKind, KindMeta> = {
  story: { label: 'История', icon: '📖', color: '#60a5fa' },
  combat: { label: 'Стычка', icon: '⚔', color: '#f87171' },
  trade: { label: 'Сделка', icon: '🤝', color: '#34d399' },
  loot: { label: 'Находка', icon: '🎁', color: '#fb923c' },
  danger: { label: 'Опасность', icon: '⚠', color: '#f97316' },
  discovery: { label: 'Открытие', icon: '🔍', color: '#a78bfa' },
  anomaly: { label: 'Аномалия', icon: '🌀', color: '#a855f7' },
  neutral: { label: 'Встреча', icon: '🧑', color: '#94a3b8' },
  heal: { label: 'Отдых', icon: '🩹', color: '#4ade80' },
  legendary: { label: 'Легенда', icon: '⚜', color: '#fbbf24' },
  system: { label: 'Система', icon: '•', color: '#94a3b8' },
  micro: { label: 'Мелочь', icon: '·', color: '#64748b' },
};

/** Разобрать JSON эффектов события (сервер шлёт строку). */
export const parseEffects = (effects: string | null | undefined): Record<string, any> => {
  if (!effects) return {};
  try {
    const parsed = JSON.parse(effects);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
};

/** Форматирование «+12:34» от начала рейда. */
export const formatOffset = (ms: number): string => {
  if (!Number.isFinite(ms) || ms < 0) return '+0:00';
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `+${m}:${s.toString().padStart(2, '0')}`;
};

/** Разобрать дату сервера ('2026-10-20 12:33:01.123'). */
export const parseServerTs = (ts: string): number => {
  if (!ts) return Date.now();
  const t = new Date(ts.replace(' ', 'T')).getTime();
  return Number.isFinite(t) ? t : Date.now();
};

const EMPTY_REWARDS: TravelRewards = {
  chips: 0,
  exp: 0,
  healPercent: 0,
  damagePercent: 0,
  flatHeal: 0,
  heal: 0,
  damage: 0,
  itemCount: 0,
  items: [],
};

/**
 * Сырая строка сервера → нормализованное событие для UI.
 * Вся работа с форматом сервера живёт здесь — компоненты читают
 * только типизированный TravelEvent.
 */
export const adaptEvent = (
  row: ServerEventRow,
  opts: { startTs?: number; rewardItems?: TravelRewardItem[] } = {},
): TravelEvent => {
  const eff = parseEffects(row.effects);
  const isMicro = row.is_micro === 1;
  const isLegendary = !!row.legendary_event_id;

  let kind: TravelEventKind = isLegendary
    ? 'legendary'
    : KIND_BY_TYPE[row.type] ?? (isMicro ? 'micro' : 'neutral');
  if (isMicro && kind === 'system') kind = 'micro';

  const items = opts.rewardItems ?? [];
  const rewards: TravelRewards = {
    chips: typeof eff.chips === 'number' ? eff.chips : 0,
    exp: typeof eff.exp === 'number' ? eff.exp : 0,
    healPercent: typeof eff.healPercent === 'number' ? eff.healPercent : 0,
    damagePercent: typeof eff.damagePercent === 'number' ? eff.damagePercent : 0,
    flatHeal: typeof eff.flatHeal === 'number' ? eff.flatHeal : 0,
    heal: typeof eff.heal === 'number' ? eff.heal : 0,
    damage: typeof eff.damage === 'number' ? eff.damage : 0,
    itemCount: typeof eff.itemCount === 'number' ? eff.itemCount : items.length,
    items,
  };

  const meta = KIND_META[kind];
  const offset = opts.startTs ? parseServerTs(row.created_at) - opts.startTs : 0;

  return {
    id: String(row.id),
    kind,
    title: isMicro ? 'Мелочь' : meta.label,
    text: row.text || '',
    time: formatOffset(offset),
    micro: isMicro,
    art: typeof row.art === 'number' && row.art > 0 ? row.art : null,
    rewards,
    legendary: isLegendary
      ? {
          key: row.legendary_event_id as string,
          title: row.legendary_title || row.legendary_event_id || '',
          stage: row.legendary_stage ?? null,
          result: (row.legendary_result as any) ?? null,
        }
      : null,
    spent: row.resource_cost
      ? { name: row.resource_cost, had: row.resource_had > 0 }
      : null,
    decision: row.decision || null,
    raw: row,
  };
};

/** Есть ли в событии что показать в бейджах наград. */
export const hasRewards = (r: TravelRewards): boolean =>
  r.chips !== 0 ||
  r.exp !== 0 ||
  r.healPercent > 0 ||
  r.damagePercent > 0 ||
  r.flatHeal > 0 ||
  r.itemCount > 0 ||
  r.items.length > 0;

export { EMPTY_REWARDS };
