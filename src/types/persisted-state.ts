import type { Board } from './board';
import type { Team } from './team';

export interface PersistedState {
  teams: Team[];
  board: Board;
}

