import { create } from "zustand";
import { persist } from "zustand/middleware";
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
    return { ...cell, ownerTeamId: undefined, state: "hidden" };
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
  setAll(next: {
    teams: Team[];
    board: Board;
    dailyDouble?: BoardState['dailyDouble'];
    finalJeopardy?: BoardState['finalJeopardy'];
    settings?: BoardState['settings'];
  }): void;

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

  // ── Cell workflow: hidden → open → claimed | disabled ──────────
  openCell(row: number, col: number): void;
  awardCell(row: number, col: number, teamId: string): void;
  penalizeTeam(row: number, col: number, teamId: string, amount?: number): void;
  unclaimCell(row: number, col: number): void;
  setCellDisabled(row: number, col: number, disabled: boolean): void;
  setCellDailyDouble(row: number, col: number, isDailyDouble: boolean): void;
  resetRound: () => void;
  resetAll: () => void;

  // ── Settings ────────────────────────────────────────────────────────────
  settings: {
    volume: number;
  };
  setVolume(volume: number): void;

  // ── Daily Double State ──────────────────────────────────────────────────
  dailyDouble: {
    stage: "none" | "wager" | "question";
    teamId: string | null;
    wager: number;
    cellPosition: { row: number; col: number } | null;
  };
  setDailyDoubleWager(wager: number): void;
  setDailyDoubleTeam(teamId: string | null): void;
  confirmWager(): void;
  cancelDailyDouble(): void;

  // ── Final Jeopardy State ────────────────────────────────────────────────
  finalJeopardy: {
    isActive: boolean;
    stage: "none" | "category" | "wager" | "question" | "resolution";
    category: string;
    question: string;
    wagers: Record<string, number>;
    resolvedTeams: string[];
  };
  startFinalJeopardy(): void;
  setFinalJeopardyCategory(category: string): void;
  setFinalJeopardyQuestion(question: string): void;
  setFinalJeopardyWager(teamId: string, amount: number): void;
  advanceFinalJeopardy(): void;
  resolveFinalJeopardyTeam(teamId: string, isCorrect: boolean): void;
  cancelFinalJeopardy(): void;
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useBoardStore = create<BoardState>()(
  persist(
    (set) => ({
      teams: defaultTeams,
      board: DEFAULT_BOARD,
      dailyDouble: {
        stage: "none",
        teamId: null,
        wager: 0,
        cellPosition: null,
      },
      finalJeopardy: {
        isActive: false,
        stage: "none",
        category: "",
        question: "",
        wagers: {},
        resolvedTeams: [],
      },
      settings: {
        volume: 0.7,
      },

      setAll: (next) =>
        set((s) => ({
          teams: next.teams,
          board: next.board,
          dailyDouble: next.dailyDouble ?? s.dailyDouble,
          finalJeopardy: next.finalJeopardy ?? s.finalJeopardy,
          settings: next.settings ?? s.settings,
        })),

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

      setCellDailyDouble: (row, col, isDailyDouble) =>
        set((s) => ({
          board: {
            ...s.board,
            grid: updateCell(s.board.grid, row, col, { isDailyDouble }),
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

      openCell: (row, col) =>
        set((s) => {
          const cell = s.board.grid[row][col];
          if (cell.state !== "hidden") return {};

          if (cell.isDailyDouble) {
            // Hide any other open cells
            const cleanGrid = s.board.grid.map((r) =>
              r.map((c): Cell => (c.state === "open" ? { ...c, state: "hidden" } : c)),
            );
            return {
              board: { ...s.board, grid: cleanGrid },
              dailyDouble: {
                stage: "wager",
                teamId: null,
                wager: cell.value, // Default wager to card value
                cellPosition: { row, col },
              },
            };
          }

          // Revert any currently "open" cells back to "hidden"
          const newGrid = s.board.grid.map((r, ri) =>
            r.map((c, ci): Cell => {
              if (ri === row && ci === col) return { ...c, state: "open" };
              if (c.state === "open") return { ...c, state: "hidden" };
              return c;
            }),
          );

          return {
            board: {
              ...s.board,
              grid: newGrid,
            },
            dailyDouble: { stage: "none", teamId: null, wager: 0, cellPosition: null },
          };
        }),

      setDailyDoubleWager: (wager) =>
        set((s) => ({ dailyDouble: { ...s.dailyDouble, wager } })),

      setDailyDoubleTeam: (teamId) =>
        set((s) => ({ dailyDouble: { ...s.dailyDouble, teamId } })),

      confirmWager: () =>
        set((s) => {
          if (!s.dailyDouble.cellPosition) return {};
          const { row, col } = s.dailyDouble.cellPosition;

          const newGrid = s.board.grid.map((r, ri) =>
            r.map((c, ci): Cell => {
              if (ri === row && ci === col) return { ...c, state: "open" };
              if (c.state === "open") return { ...c, state: "hidden" };
              return c;
            }),
          );

          return {
            board: { ...s.board, grid: newGrid },
            dailyDouble: { ...s.dailyDouble, stage: "question" },
          };
        }),

      cancelDailyDouble: () =>
        set({
          dailyDouble: { stage: "none", teamId: null, wager: 0, cellPosition: null },
        }),

      // ── Settings ────────────────────────────────────────────────────────────
      setVolume: (volume) =>
        set((s) => ({ settings: { ...s.settings, volume } })),

      // ── Final Jeopardy ─────────────────────────────────────────────────────
      startFinalJeopardy: () =>
        set((s) => ({
          finalJeopardy: { ...s.finalJeopardy, isActive: true, stage: "category" },
          board: {
            ...s.board,
            grid: s.board.grid.map((row) =>
              row.map((cell): Cell => (cell.state === "open" ? { ...cell, state: "hidden" } : cell)),
            ),
          },
          dailyDouble: { stage: "none", teamId: null, wager: 0, cellPosition: null },
        })),

      setFinalJeopardyCategory: (category) =>
        set((s) => ({ finalJeopardy: { ...s.finalJeopardy, category } })),

      setFinalJeopardyQuestion: (question) =>
        set((s) => ({ finalJeopardy: { ...s.finalJeopardy, question } })),

      setFinalJeopardyWager: (teamId, amount) =>
        set((s) => ({
          finalJeopardy: {
            ...s.finalJeopardy,
            wagers: { ...s.finalJeopardy.wagers, [teamId]: amount },
          },
        })),

      advanceFinalJeopardy: () =>
        set((s) => {
          const stages: BoardState["finalJeopardy"]["stage"][] = [
            "none",
            "category",
            "wager",
            "question",
            "resolution",
          ];
          const currentIdx = stages.indexOf(s.finalJeopardy.stage);
          const nextIdx = (currentIdx + 1) % stages.length;
          return {
            finalJeopardy: { ...s.finalJeopardy, stage: stages[nextIdx] },
          };
        }),

      resolveFinalJeopardyTeam: (teamId, isCorrect) =>
        set((s) => {
          if (s.finalJeopardy.resolvedTeams.includes(teamId)) return {};
          const wager = s.finalJeopardy.wagers[teamId] ?? 0;
          return {
            teams: s.teams.map((t) =>
              t.id === teamId ? { ...t, score: t.score + (isCorrect ? wager : -wager) } : t
            ),
            finalJeopardy: {
              ...s.finalJeopardy,
              resolvedTeams: [...s.finalJeopardy.resolvedTeams, teamId],
            },
          };
        }),

      cancelFinalJeopardy: () =>
        set({
          finalJeopardy: {
            isActive: false,
            stage: "none",
            category: "",
            question: "",
            wagers: {},
            resolvedTeams: [],
          },
        }),

      awardCell: (row, col, teamId) =>
        set((s) => {
          const cell = s.board.grid[row][col];
          if (cell.state === "claimed" || cell.state === "disabled") return {};

          const isDD = s.dailyDouble.stage === "question";
          const points = isDD ? s.dailyDouble.wager : cell.value;

          return {
            board: {
              ...s.board,
              grid: updateCell(s.board.grid, row, col, {
                state: "claimed",
                ownerTeamId: teamId,
              }),
            },
            teams: s.teams.map((t) =>
              t.id === teamId ? { ...t, score: t.score + points } : t,
            ),
            dailyDouble: { stage: "none", teamId: null, wager: 0, cellPosition: null },
          };
        }),

      penalizeTeam: (row, col, teamId, amount) =>
        set((s) => {
          const cell = s.board.grid[row][col];
          const isDD = s.dailyDouble.stage === "question";
          const points = amount !== undefined ? amount : (isDD ? s.dailyDouble.wager : cell.value);

          return {
            teams: s.teams.map((t) =>
              t.id === teamId ? { ...t, score: t.score - points } : t,
            ),
          };
        }),

      unclaimCell: (row, col) =>
        set((s) => {
          const cell = s.board.grid[row][col];
          const prevOwner = cell.ownerTeamId;
          const isDDCell = s.dailyDouble.cellPosition?.row === row && s.dailyDouble.cellPosition?.col === col;

          return {
            board: {
              ...s.board,
              grid: updateCell(s.board.grid, row, col, {
                state: "hidden",
                ownerTeamId: undefined,
              }),
            },
            teams: s.teams.map((t) =>
              prevOwner && t.id === prevOwner
                ? { ...t, score: t.score - cell.value }
                : t,
            ),
            dailyDouble: isDDCell
              ? { stage: "none", teamId: null, wager: 0, cellPosition: null }
              : s.dailyDouble,
          };
        }),

      setCellDisabled: (row, col, disabled) =>
        set((s) => {
          const cell = s.board.grid[row][col];
          const prevOwner = cell.ownerTeamId;
          const isDDCell = s.dailyDouble.cellPosition?.row === row && s.dailyDouble.cellPosition?.col === col;

          return {
            board: {
              ...s.board,
              grid: updateCell(s.board.grid, row, col, {
                state: disabled ? "disabled" : "hidden",
                ownerTeamId: undefined,
              }),
            },
            teams: s.teams.map((t) =>
              prevOwner && t.id === prevOwner
                ? { ...t, score: t.score - cell.value }
                : t,
            ),
            dailyDouble: isDDCell
              ? { stage: "none", teamId: null, wager: 0, cellPosition: null }
              : s.dailyDouble,
          };
        }),
      resetRound: () =>
        set((s) => ({
          teams: s.teams.map((t) => ({ ...t, score: 0 })),
          board: {
            ...s.board,
            grid: s.board.grid.map((row) =>
              row.map((cell): Cell => ({
                ...cell,
                state: "hidden",
                ownerTeamId: undefined,
              })),
            ),
          },
          dailyDouble: {
            stage: "none",
            teamId: null,
            wager: 0,
            cellPosition: null,
          },
        })),

      resetAll: () =>
        set((s) => ({
          teams: defaultTeams,
          board: {
            ...s.board,
            grid: s.board.grid.map((row) =>
              row.map((cell): Cell => ({
                ...cell,
                state: "hidden",
                ownerTeamId: undefined,
              })),
            ),
          },
          dailyDouble: {
            stage: "none",
            teamId: null,
            wager: 0,
            cellPosition: null,
          },
          finalJeopardy: {
            isActive: false,
            stage: "none",
            category: "",
            question: "",
            wagers: {},
            resolvedTeams: [],
          },
        })),
    }),
    {
      name: "jeopardy-scoreboard-storage",
      merge: (persisted: unknown, current) => {
        const p = persisted as Partial<typeof current>;
        return {
          ...current,
          ...p,
          finalJeopardy: {
            ...current.finalJeopardy,
            ...(p.finalJeopardy ?? {}),
            resolvedTeams: p.finalJeopardy?.resolvedTeams ?? [],
          },
        };
      },
    },
  ),
);
