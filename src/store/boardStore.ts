import { create } from "zustand";
import type { Board } from "@/types/board";
import type { Cell } from "@/types/cell";
import type { Team } from "@/types/team";

function createDefaultGrid(rows: number, cols: number, base = 100): Cell[][] {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      id: `${r + 1}${String.fromCharCode(65 + c)}`,
      value: (r + 1) * base,
      question: "",
      state: "hidden",
    })),
  );
}

const defaultCategories = ["Sci", "Geo", "Hist", "Film", "Misc"];

const defaultBoard: Board = {
  rows: 5,
  cols: 5,
  categories: defaultCategories,
  grid: createDefaultGrid(5, 5, 100),
};

function clearTeamFromCell(cell: Cell, teamId: string): Cell {
  if (cell.ownerTeamId === teamId) {
    return {
      ...cell,
      ownerTeamId: undefined,
      lockedTeamId: undefined,
      state: "hidden",
    };
  }

  if (cell.lockedTeamId === teamId) {
    return {
      ...cell,
      lockedTeamId: undefined,
      state: "open",
    };
  }

  return cell;
}

export const defaultTeams: Team[] = [
  { id: "A", name: "Team A", color: "#ef4444", score: 0, abbr: "A" },
  { id: "B", name: "Team B", color: "#3b82f6", score: 0, abbr: "B" },
];

export interface BoardState {
  teams: Team[];
  board: Board;
  // actions
  setAll(next: { teams: Team[]; board: Board }): void;
  addTeam(team: Team): void;
  removeTeam(teamId: string): void;
  setTeamName(teamId: string, name: string): void;
  setTeamColor(teamId: string, color: string): void;
  moveTeam(teamId: string, delta: -1 | 1): void;
  moveTeamTo(teamId: string, index: number): void;
  updateScore(teamId: string, delta: number): void;
  setCategories(categories: string[]): void;
  setCategoryTitle(index: number, title: string): void;
  setCellValue(row: number, col: number, value: number): void;
  setCellQuestion(row: number, col: number, question: string): void;
  rebuildBoard(rows: number, cols: number, base: number): void;
  claimCell(row: number, col: number, teamId: string): void;
  revealAndLockCell(row: number, col: number, teamId: string): void;
  markCellIncorrect(row: number, col: number): void;
  claimCellCorrect(row: number, col: number): void;
  unclaimCell(row: number, col: number): void;
  setCellDisabled(row: number, col: number, disabled: boolean): void;
}

export const useBoardStore = create<BoardState>((set) => ({
  teams: defaultTeams,
  board: defaultBoard,
  setAll: (next) => set(() => ({ teams: next.teams, board: next.board })),
  addTeam: (team) => set((s) => ({ teams: [...s.teams, team] })),
  removeTeam: (teamId) =>
    set((s) => {
      const grid = s.board.grid.map((row) =>
        row.map((cell) => clearTeamFromCell(cell, teamId)),
      );
      const teams = s.teams.filter((t) => t.id !== teamId);
      return { board: { ...s.board, grid }, teams };
    }),
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
      if (idx === -1) return {} as any;
      const target = idx + delta;
      if (target < 0 || target >= s.teams.length) return {} as any;
      const teams = s.teams.slice();
      const [m] = teams.splice(idx, 1);
      teams.splice(target, 0, m);
      return { teams };
    }),
  moveTeamTo: (teamId, index) =>
    set((s) => {
      const from = s.teams.findIndex((t) => t.id === teamId);
      if (from === -1) return {} as any;
      const to = Math.max(0, Math.min(index, s.teams.length - 1));
      if (from === to) return {} as any;
      const teams = s.teams.slice();
      const [m] = teams.splice(from, 1);
      teams.splice(to, 0, m);
      return { teams };
    }),
  updateScore: (teamId, delta) =>
    set((s) => ({
      teams: s.teams.map((t) =>
        t.id === teamId ? { ...t, score: t.score + delta } : t,
      ),
    })),
  setCategories: (categories) =>
    set((s) => ({ board: { ...s.board, categories } })),
  setCategoryTitle: (index, title) =>
    set((s) => {
      const categories = s.board.categories.slice();
      if (index >= 0 && index < categories.length) categories[index] = title;
      return { board: { ...s.board, categories } };
    }),
  setCellValue: (row, col, value) =>
    set((s) => {
      const grid = s.board.grid.map((r) => r.slice());
      grid[row][col] = { ...grid[row][col], value };
      return { board: { ...s.board, grid } };
    }),
  setCellQuestion: (row, col, question) =>
    set((s) => {
      const grid = s.board.grid.map((r) => r.slice());
      grid[row][col] = { ...grid[row][col], question };
      return { board: { ...s.board, grid } };
    }),
  rebuildBoard: (rows, cols, base) =>
    set((s) => {
      const categories = Array.from(
        { length: cols },
        (_, i) => s.board.categories[i] ?? `Cat ${i + 1}`,
      );
      const grid = createDefaultGrid(rows, cols, base);
      return { board: { rows, cols, categories, grid } };
    }),
  claimCell: (row, col, teamId) =>
    set((s) => {
      const grid = s.board.grid.map((r) => r.slice());
      const cell = grid[row][col];
      if (cell.state === "disabled") return {} as any;
      const prevOwner = cell.ownerTeamId;
      if (prevOwner === teamId) return {} as any; // no-op
      grid[row][col] = {
        ...cell,
        ownerTeamId: teamId,
        lockedTeamId: undefined,
        state: "claimed",
      };
      const teams = s.teams.map((t) => {
        if (t.id === teamId) return { ...t, score: t.score + cell.value };
        if (prevOwner && t.id === prevOwner)
          return { ...t, score: t.score - cell.value };
        return t;
      });
      return { board: { ...s.board, grid }, teams };
    }),
  revealAndLockCell: (row, col, teamId) =>
    set((s) => {
      const grid = s.board.grid.map((r) => r.slice());
      const cell = grid[row][col];
      if (cell.state === "disabled" || cell.state === "claimed")
        return {} as any;
      grid[row][col] = { ...cell, state: "locked", lockedTeamId: teamId };
      return { board: { ...s.board, grid } };
    }),
  markCellIncorrect: (row, col) =>
    set((s) => {
      const grid = s.board.grid.map((r) => r.slice());
      const cell = grid[row][col];
      if (cell.state !== "locked") return {} as any;
      grid[row][col] = { ...cell, state: "open", lockedTeamId: undefined };
      return { board: { ...s.board, grid } };
    }),
  claimCellCorrect: (row, col) =>
    set((s) => {
      const grid = s.board.grid.map((r) => r.slice());
      const cell = grid[row][col];
      const teamId = cell.lockedTeamId;
      if (cell.state !== "locked" || !teamId) return {} as any;
      grid[row][col] = {
        ...cell,
        ownerTeamId: teamId,
        lockedTeamId: undefined,
        state: "claimed",
      };
      const teams = s.teams.map((t) => {
        if (t.id === teamId) return { ...t, score: t.score + cell.value };
        return t;
      });
      return { board: { ...s.board, grid }, teams };
    }),
  unclaimCell: (row, col) =>
    set((s) => {
      const grid = s.board.grid.map((r) => r.slice());
      const cell = grid[row][col];
      const prevOwner = cell.ownerTeamId;
      grid[row][col] = {
        ...cell,
        ownerTeamId: undefined,
        lockedTeamId: undefined,
        state: "hidden",
      };
      const teams = s.teams.map((t) =>
        prevOwner && t.id === prevOwner
          ? { ...t, score: t.score - cell.value }
          : t,
      );
      return { board: { ...s.board, grid }, teams };
    }),
  setCellDisabled: (row, col, disabled) =>
    set((s) => {
      const grid = s.board.grid.map((r) => r.slice());
      const cell = grid[row][col];
      const prevOwner = cell.ownerTeamId;
      grid[row][col] = {
        ...cell,
        ownerTeamId: undefined,
        lockedTeamId: undefined,
        state: disabled ? "disabled" : "hidden",
      };
      const teams = s.teams.map((t) =>
        prevOwner && t.id === prevOwner
          ? { ...t, score: t.score - cell.value }
          : t,
      );
      return { board: { ...s.board, grid }, teams };
    }),
}));
