import type { Board } from "@/types/board";
import type { Team } from "@/types/team";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActiveQuestionSnapshot {
  cellId: string;
  category: string;
  value: number;
  question: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return all cells in a board that are currently in an interactive state
 * ("open"), with enriched display data.
 */
export function getActiveQuestions(
  board: Board,
): ActiveQuestionSnapshot[] {
  const result: ActiveQuestionSnapshot[] = [];
  const visibleCats = board.categories.slice(0, board.cols);

  for (let row = 0; row < board.rows; row++) {
    const gridRow = board.grid[row];
    if (!gridRow) continue;
    for (let col = 0; col < board.cols; col++) {
      const cell = gridRow[col];
      if (!cell) continue;
      if (cell.state === "open") {
        result.push({
          cellId: cell.id,
          category: visibleCats[col] ?? `Cat ${col + 1}`,
          value: cell.value,
          question: cell.question,
        });
      }
    }
  }

  return result;
}

/**
 * Return the IDs of all currently active (open) cells.
 * Useful for tracking which questions are new since the last render.
 */
export function getActiveQuestionIds(board: Board): string[] {
  return board.grid
    .slice(0, board.rows)
    .flatMap((row) => row.slice(0, board.cols))
    .filter((cell) => cell.state === "open")
    .map((cell) => cell.id);
}

/**
 * Resolve which question snapshot the Display timer should show.
 *
 * Priority:
 * 1. A newly-appeared question (not in `previousActiveCellIds`) → show it.
 * 2. The previously-shown question, if still active → keep it.
 * 3. The first active question → fall back.
 * 4. No active questions → keep the current snapshot (never flicker to null).
 */
export function resolveTimerQuestion(
  current: ActiveQuestionSnapshot | null,
  board: Board,
  previousActiveCellIds: Iterable<string> = [],
): ActiveQuestionSnapshot | null {
  const active = getActiveQuestions(board);
  if (active.length === 0) return current;

  const prevIds = new Set(previousActiveCellIds);
  const newlyActive = active.find((q) => !prevIds.has(q.cellId));
  if (newlyActive) return newlyActive;

  if (current) {
    return active.find((q) => q.cellId === current.cellId) ?? current;
  }

  return active[0] ?? null;
}
