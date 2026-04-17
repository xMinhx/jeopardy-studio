import { create } from "zustand";
import type { Board } from "@/types/board";
import type { Cell, CellState } from "@/types/cell";
import type { Team } from "@/types/team";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createDefaultGrid(rows: number, cols: number, base = 100): Cell[][] {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      id: `${r + 1}${String.fromCharCode(65 + c)}`,
      value: (r + 1) * base,
      question: "",
      state: "hidden" as CellState,
    })),
  );
}

const DEFAULT_CATEGORIES = ["Sci", "Geo", "Hist", "Film", "Misc"];

const DEFAULT_BOARD: Board = {
  rows: 5,
  cols: 5,
  categories: DEFAULT_CATEGORIES,
  grid: createDefaultGrid(5, 5, 100),
};

/** Remove all references to `teamId` from a single cell, returning the updated cell. */
function clearTeamFromCell(cell: Cell, teamId: string): Cell {
  if (cell.ownerTeamId === teamId) {
    return { ...cell, ownerTeamId: undefined, lockedTeamId: undefined, state: "hidden" };
  }
  if (cell.lockedTeamId === teamId) {
    return { ...cell, lockedTeamId: undefined, state: "open" };
  }
  return cell;
}

/** Immutably update a single cell at [row][col] within the grid. */
function updateCell(
  grid: Cell[][],
  row: number,
  col: number,
  patch: Partial<Cell>,
): Cell[][] {
  return grid.map((r, ri) =>
    ri !== row ? r : r.map((c, ci) => (ci !== col ? c : { ...c, ...patch })),
  );
}

// ---------------------------------------------------------------------------
// Public defaults
// ---------------------------------------------------------------------------

export const defaultTeams: Team[] = [
  { id: "A", name: "Team A", color: "#ef4444", score: 0, abbr: "A" },
  { id: "B", name: "Team B", color: "#3b82f6", score: 0, abbr: "B" },
];

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface BoardState {
  teams: Team[];
  board: Board;

  // ── State sync ──────────────────────────────────────────────────────────
  setAll(next: { teams: Team[]; board: Board }): void;

  // ── Team management ─────────────────────────────────────────────────────
  addTeam(team: Team): void;
  removeTeam(teamId: string): void;
  setTeamName(teamId: string, name: string): void;
  setTeamColor(teamId: string, color: string): void;
  moveTeam(teamId: string, delta: -1 | 1): void;
  moveTeamTo(teamId: string, index: number): void;
  updateScore(teamId: string, delta: number): void;

  // ── Board editing ────────────────────────────────────────────────────────
  setCategories(categories: string[]): void;
  setCategoryTitle(index: number, title: string): void;
  setCellValue(row: number, col: number, value: number): void;
  setCellQuestion(row: number, col: number, question: string): void;
  rebuildBoard(rows: number, cols: number, base: number): void;

  // ── Cell workflow: hidden → locked → claimed | open → claimed ────────────
  revealAndLockCell(row: number, col: number, teamId: string): void;
  markCellIncorrect(row: number, col: number): void;
  claimCellCorrect(row: number, col: number): void;
  unclaimCell(row: number, col: number): void;
  setCellDisabled(row: number, col: number, disabled: boolean): void;
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useBoardStore = create<BoardState>((set) => ({
  teams: defaultTeams,
  board: DEFAULT_BOARD,

  setAll: (next) => set({ teams: next.teams, board: next.board }),

  // ── Teams ────────────────────────────────────────────────────────────────

  addTeam: (team) => set((s) => ({ teams: [...s.teams, team] })),

  removeTeam: (teamId) =>
    set((s) => ({
      teams: s.teams.filter((t) => t.id !== teamId),
      board: {
        ...s.board,
        grid: s.board.grid.map((row) =>
          row.map((cell) => clearTeamFromCell(cell, teamId)),
        ),
      },
    })),

  setTeamName: (teamId, name) =>
    set((s) => ({
      teams: s.teams.map((t) => (t.id === teamId ? { ...t, name } : t)),
    })),

  setTeamColor: (teamId, color) =>
    set((s) => ({
      teams: s.teams.map((t) => (t.id === teamId ? { ...t, color } : t)),
    })),

  moveTeam: (teamId, delta) =>
    set((s) => {
      const idx = s.teams.findIndex((t) => t.id === teamId);
      const target = idx + delta;
      if (idx === -1 || target < 0 || target >= s.teams.length) return {};
      const teams = s.teams.slice();
      const [moved] = teams.splice(idx, 1);
      teams.splice(target, 0, moved);
      return { teams };
    }),

  moveTeamTo: (teamId, index) =>
    set((s) => {
      const from = s.teams.findIndex((t) => t.id === teamId);
      if (from === -1) return {};
      const to = Math.max(0, Math.min(index, s.teams.length - 1));
      if (from === to) return {};
      const teams = s.teams.slice();
      const [moved] = teams.splice(from, 1);
      teams.splice(to, 0, moved);
      return { teams };
    }),

  updateScore: (teamId, delta) =>
    set((s) => ({
      teams: s.teams.map((t) =>
        t.id === teamId ? { ...t, score: t.score + delta } : t,
      ),
    })),

  // ── Board editing ────────────────────────────────────────────────────────

  setCategories: (categories) =>
    set((s) => ({ board: { ...s.board, categories } })),

  setCategoryTitle: (index, title) =>
    set((s) => {
      const categories = s.board.categories.slice();
      if (index >= 0 && index < categories.length) categories[index] = title;
      return { board: { ...s.board, categories } };
    }),

  setCellValue: (row, col, value) =>
    set((s) => ({
      board: { ...s.board, grid: updateCell(s.board.grid, row, col, { value }) },
    })),

  setCellQuestion: (row, col, question) =>
    set((s) => ({
      board: {
        ...s.board,
        grid: updateCell(s.board.grid, row, col, { question }),
      },
    })),

  rebuildBoard: (rows, cols, base) =>
    set((s) => ({
      board: {
        rows,
        cols,
        categories: Array.from(
          { length: cols },
          (_, i) => s.board.categories[i] ?? `Cat ${i + 1}`,
        ),
        grid: createDefaultGrid(rows, cols, base),
      },
    })),

  // ── Cell workflow ────────────────────────────────────────────────────────

  revealAndLockCell: (row, col, teamId) =>
    set((s) => {
      const cell = s.board.grid[row][col];
      if (cell.state === "disabled" || cell.state === "claimed") return {};
      return {
        board: {
          ...s.board,
          grid: updateCell(s.board.grid, row, col, {
            state: "locked",
            lockedTeamId: teamId,
          }),
        },
      };
    }),

  markCellIncorrect: (row, col) =>
    set((s) => {
      const cell = s.board.grid[row][col];
      if (cell.state !== "locked") return {};
      return {
        board: {
          ...s.board,
          grid: updateCell(s.board.grid, row, col, {
            state: "open",
            lockedTeamId: undefined,
          }),
        },
      };
    }),

  claimCellCorrect: (row, col) =>
    set((s) => {
      const cell = s.board.grid[row][col];
      const teamId = cell.lockedTeamId;
      if (cell.state !== "locked" || !teamId) return {};
      return {
        board: {
          ...s.board,
          grid: updateCell(s.board.grid, row, col, {
            state: "claimed",
            ownerTeamId: teamId,
            lockedTeamId: undefined,
          }),
        },
        teams: s.teams.map((t) =>
          t.id === teamId ? { ...t, score: t.score + cell.value } : t,
        ),
      };
    }),

  unclaimCell: (row, col) =>
    set((s) => {
      const cell = s.board.grid[row][col];
      const prevOwner = cell.ownerTeamId;
      return {
        board: {
          ...s.board,
          grid: updateCell(s.board.grid, row, col, {
            state: "hidden",
            ownerTeamId: undefined,
            lockedTeamId: undefined,
          }),
        },
        teams: s.teams.map((t) =>
          prevOwner && t.id === prevOwner
            ? { ...t, score: t.score - cell.value }
            : t,
        ),
      };
    }),

  setCellDisabled: (row, col, disabled) =>
    set((s) => {
      const cell = s.board.grid[row][col];
      const prevOwner = cell.ownerTeamId;
      return {
        board: {
          ...s.board,
          grid: updateCell(s.board.grid, row, col, {
            state: disabled ? "disabled" : "hidden",
            ownerTeamId: undefined,
            lockedTeamId: undefined,
          }),
        },
        teams: s.teams.map((t) =>
          prevOwner && t.id === prevOwner
            ? { ...t, score: t.score - cell.value }
            : t,
        ),
      };
    }),
}));
