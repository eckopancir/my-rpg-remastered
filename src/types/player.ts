export interface PlayerStats {
  maxHp: number;
  currentHp: number;
  maxStamina: number;
  stamina: number;
  strength: number;
  agility: number;
  intellect: number;
  luck: number;
  dps: number;
  armor: number;
  regen: number;
  critChance: number;
  evasion: number;
}

export interface Equipment {
  weapon: string | null;
  offhand: string | null;
  helmet: string | null;
  chest: string | null;
  gloves: string | null;
  boots: string | null;
  ring1: string | null;
  ring2: string | null;
  amulet: string | null;
  backpack: string | null;
}

export interface ActiveEffect {
  id: string;
  name: string;
  duration: number;
  remaining: number;
  statBoosts: Partial<PlayerStats>;
  statBoostsMult?: Partial<Record<string, number>>;
}

export interface PlayerState {
  name: string;
  level: number;
  currentExp: number;
  expToNext: number;
  dataChips: number;
  baseHealth: number;
  stats: PlayerStats;
  equipment: Equipment;
  effects: ActiveEffect[];
}
