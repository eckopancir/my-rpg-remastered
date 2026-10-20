/**
 * Типы интерфейса путешествия (TRAVEL).
 *
 * Сервер отдаёт сырые строки событий (ServerEventRow), а UI работает с
 * нормализованным TravelEvent — так экран не зависит от формата сервера
 * и может быть переписан независимо от движка.
 */

export type TravelEventKind =
  | 'story'
  | 'combat'
  | 'trade'
  | 'loot'
  | 'danger'
  | 'discovery'
  | 'anomaly'
  | 'neutral'
  | 'heal'
  | 'legendary'
  | 'system'
  | 'micro';

export interface TravelRewardItem {
  id: string;
  name: string;
  displayName?: string;
  rarity?: string;
  quality?: string;
  qualityColor?: string;
  type?: string;
  slot?: string;
  quantity?: number;
  image?: string;
  icon?: string;
  stats?: Record<string, number>;
}

export interface TravelRewards {
  chips: number;
  exp: number;
  healPercent: number;
  damagePercent: number;
  flatHeal: number;
  /** Числовой хил (в HP) — новые рейды. */
  heal: number;
  /** Числовой урон (в HP) — новые рейды. */
  damage: number;
  /** Сколько предметов выпало (сервер посчитал). */
  itemCount: number;
  /** Конкретные предметы (клиент уже сгенерировал их). */
  items: TravelRewardItem[];
}

export interface TravelLegendary {
  key: string;
  /** Русское название цепочки (например «Бункер Заря»). */
  title: string;
  stage: number | null;
  result: 'stage' | 'complete' | 'fail' | null;
}

export interface TravelEvent {
  id: string;
  kind: TravelEventKind;
  /** Заголовок карточки: «Стычка», «Находка», «Легенда»… */
  title: string;
  text: string;
  /** Относительное время «+02:14» от начала рейда. */
  time: string;
  micro: boolean;
  rewards: TravelRewards;
  legendary?: TravelLegendary | null;
  /** Потраченный ресурс (до переделки — траты остаются в событиях). */
  spent?: { name: string; had: boolean } | null;
  decision?: string | null;
  /** Сырая строка сервера — для отладки и расширения. */
  raw?: any;
}

export interface TravelPhaseInfo {
  key: 'travel_out' | 'exploring' | 'travel_back' | 'complete';
  label: string;
  icon: string;
  /** Сколько секунд длится фаза. */
  total: number;
  /** Сколько секунд осталось (0 — фаза не идёт). */
  left: number;
}
