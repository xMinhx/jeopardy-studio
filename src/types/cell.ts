export type CellWorkflowState =
  | "hidden"
  | "locked"
  | "open"
  | "claimed"
  | "disabled";

export interface Cell {
  id: string;
  value: number;
  question: string;
  state: CellWorkflowState;
  lockedTeamId?: string;
  ownerTeamId?: string;
}

export type CellDisplayState = CellWorkflowState;

export const cellState = (c: Cell): CellDisplayState => c.state;
