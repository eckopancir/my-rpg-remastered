export interface EnemyStats {
  maxHp: number;
  currentHp: number;
  dps: number;
  armor: number;
  regen: number;
  critChance: number;
  evasion: number;
  stamina: number;
  name: string;
  faction: string;
  image: string;
  difficulty: number;
}

export interface BattleLog {
  timestamp: number;
  message: string;
  type: 'damage' | 'heal' | 'info' | 'warning' | 'loot';
}

export type BattleStatus = 'idle' | 'traveling' | 'fighting' | 'victory' | 'defeat';

export interface Tile {
  x: number;
  y: number;
  type: 'empty' | 'wall' | 'cover' | 'obstacle';
  occupiedBy: 'player' | 'enemy' | null;
}
