export type AbilityEffect =
  | { type: 'heal_percent'; value: number }
  | { type: 'heal_flat'; value: number }
  | { type: 'damage'; multiplier: number; aoe?: number }
  | { type: 'stat_boost'; stat: string; value: number; duration: number }
  | { type: 'stat_boost_mult'; stat: string; value: number; duration: number }
  | { type: 'heal_over_time'; value: number; duration: number }
  | { type: 'status'; id: string; duration: number }
  | { type: 'summon' }
  | { type: 'teleport' }
  | { type: 'create_decoy' }
  | { type: 'mark_zone'; duration: number; damageMultiplier: number }
  | { type: 'reveal_map'; duration: number }
  | { type: 'sprint_boost'; duration: number };

export interface AccessoryAbility {
  id: string;
  name: string;
  description: string;
  icon: string;
  apCost: number;
  cooldown: number;
  skipTurn?: boolean;
  effects: AbilityEffect[];
  powerRating: number;
}
