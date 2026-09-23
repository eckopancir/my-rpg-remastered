export type AbilityEffect =
  | { type: 'heal_percent'; value: number }
  | { type: 'heal_flat'; value: number }
  | { type: 'damage'; multiplier: number; aoe?: number }
  | { type: 'stat_boost'; stat: string; value: number; duration: number }
  | { type: 'stat_set'; stat: string; value: number; duration: number }
  | { type: 'stat_boost_mult'; stat: string; value: number; duration: number }
  | { type: 'heal_over_time'; value: number; duration: number }
  | { type: 'status'; id: string; duration: number }
  | { type: 'summon' }
  | { type: 'teleport'; stealthReady?: boolean }
  | { type: 'free_reload'; duration: number }
  | { type: 'mark_zone'; duration: number; damageMultiplier: number }
  | { type: 'reveal_map'; duration: number }
  | { type: 'sprint_boost'; duration: number; value?: number };

export interface AccessoryAbility {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** картинка способности (иконка на арене вместо эмодзи) */
  image?: string;
  /** бесплатная (не требует расходника) */
  free?: boolean;
  /** только отображение (пассивка, нажать нельзя) */
  displayOnly?: boolean;
  apCost: number;
  cooldown: number;
  passive?: boolean;
  skipTurn?: boolean;
  effects: AbilityEffect[];
  powerRating: number;
  requiresTarget?: boolean;
  range?: number;
  /** мультитаргет: выбрать N целей по очереди (стрелок «Тройной выстрел») */
  multiTarget?: number;
  /** таргет по клетке: квадрат Чебышева radius, дальность range (стрелок «Залп из базуки») */
  cellAoE?: { radius: number; range: number };
}
