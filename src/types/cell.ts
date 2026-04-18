export type CellState =
  | "hidden"
  | "open"
  | "claimed"
  | "disabled";

export interface Cell {
  id: string;
  value: number;
  question: string;
  state: CellState;
  ownerTeamId?: string;
}
