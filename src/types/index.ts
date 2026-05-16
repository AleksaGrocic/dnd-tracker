export interface Condition {
  name: string;
  count: number;
}

export interface Character {
  id: string;
  player_id: string;
  name: string;
  hp_current: number;
  hp_max: number;
  temp_hp: number;
  stress: number;
  conditions: Condition[];
  position: number;
  trait: string | null;
  created_at?: string;
}

export interface Player {
  id: string;
  name: string;
  active_character_id: string | null;
  created_at?: string;
}
