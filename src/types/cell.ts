export type CellState =
  | "hidden"
  | "locked"
  | "open"
  | "claimed"
  | "disabled";

export interface Cell {
  id: string;
  value: number;
  question: string;
  state: CellState;
  lockedTeamId?: string;
  ownerTeamId?: string;
}
