import type { Board } from "@/types/board";
import type { Cell } from "@/types/cell";

const MIN_DIM = 1;
const MAX_DIM = 10;

type PresetCell = {
  value: number;
  question: string;
};

type PresetBoard = {
  rows: number;
  cols: number;
  categories: string[];
  grid: PresetCell[][];
};

function clampDimension(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(MIN_DIM, Math.min(MAX_DIM, Math.floor(n)));
}

function normalizeCell(row: number, col: number, input: unknown): Cell {
  const cell = (input ?? {}) as Partial<PresetCell>;
  const value = Number(cell.value);
  return {
    id: `${row + 1}${String.fromCharCode(65 + col)}`,
    value: Number.isFinite(value) ? value : (row + 1) * 100,
    question: typeof cell.question === "string" ? cell.question : "",
    state: "hidden",
  };
}

export function boardFromPreset(input: unknown): Board | null {
  const preset = (input ?? {}) as Partial<PresetBoard>;
  const rows = clampDimension(preset.rows, 5);
  const cols = clampDimension(preset.cols, 5);

  if (!Array.isArray(preset.categories) || !Array.isArray(preset.grid)) {
    return null;
  }

  const categories = Array.from({ length: cols }, (_, i) => {
    const raw = preset.categories?.[i];
    if (typeof raw === "string" && raw.trim().length > 0) return raw;
    return `Cat ${i + 1}`;
  });

  const grid = Array.from({ length: rows }, (_, r) => {
    const sourceRow = Array.isArray(preset.grid?.[r]) ? preset.grid[r] : [];
    return Array.from({ length: cols }, (_, c) =>
      normalizeCell(r, c, sourceRow[c]),
    );
  });

  return { rows, cols, categories, grid };
}

export async function loadBoardPreset(): Promise<Board | null> {
  try {
    const response = await fetch("/board-default.json", { cache: "no-store" });
    if (!response.ok) return null;
    const json = await response.json();
    return boardFromPreset(json);
  } catch {
    return null;
  }
}
