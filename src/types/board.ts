import type { Cell } from "./cell";

export interface Board {
  rows: number;
  cols: number;
  categories: string[];
  grid: Cell[][]; // [row][col]
}

export function isValidBoard(b: Board): boolean {
  return (
    b.categories.length === b.cols &&
    b.grid.length === b.rows &&
    b.grid.every((row) => row.length === b.cols)
  );
}
