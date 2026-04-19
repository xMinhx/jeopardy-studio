/**
 * boardUtils.test.ts
 *
 * Tests for getActiveQuestions, getActiveQuestionIds, and resolveTimerQuestion.
 */
import { describe, expect, it } from "vitest";
import {
  getActiveQuestions,
  getActiveQuestionIds,
  resolveTimerQuestion,
} from "../src/features/board/boardUtils";
import type { Board } from "../src/types/board";
import type { Cell } from "../src/types/cell";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCell(
  id: string,
  value: number,
  question: string,
  state: Cell["state"],
  ownerTeamId?: string,
): Cell {
  return { id, value, question, state, ownerTeamId };
}

function makeBoard(cells: Cell[][], categories: string[] = []): Board {
  return {
    rows: cells.length,
    cols: cells[0]?.length ?? 0,
    categories:
      categories.length > 0
        ? categories
        : Array.from({ length: cells[0]?.length ?? 0 }, (_, i) => `Cat${i + 1}`),
    grid: cells,
  };
}

// ---------------------------------------------------------------------------
// getActiveQuestions
// ---------------------------------------------------------------------------

describe("getActiveQuestions", () => {
  it("returns empty array when no cells are open", () => {
    const board = makeBoard([
      [makeCell("1A", 100, "Q1", "hidden"), makeCell("1B", 200, "Q2", "claimed")],
    ]);
    expect(getActiveQuestions(board)).toHaveLength(0);
  });

  it("returns snapshot for a single open cell", () => {
    const board = makeBoard(
      [[makeCell("1A", 100, "What is H2O?", "open")]],
      ["Chemistry"],
    );
    const result = getActiveQuestions(board);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      cellId: "1A",
      category: "Chemistry",
      value: 100,
      question: "What is H2O?",
    });
  });

  it("returns snapshots for multiple open cells", () => {
    const board = makeBoard([
      [makeCell("1A", 100, "Q1", "open"), makeCell("1B", 200, "Q2", "hidden")],
      [makeCell("2A", 200, "Q3", "open"), makeCell("2B", 400, "Q4", "claimed")],
    ]);
    const result = getActiveQuestions(board);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.cellId)).toEqual(["1A", "2A"]);
  });

  it("uses category fallback when categories array is shorter than cols", () => {
    const board: Board = {
      rows: 1,
      cols: 2,
      categories: ["Only One"],
      grid: [[makeCell("1A", 100, "Q", "open"), makeCell("1B", 200, "Q2", "open")]],
    };
    const result = getActiveQuestions(board);
    expect(result[0].category).toBe("Only One");
    expect(result[1].category).toBe("Cat 2"); // fallback
  });

  it("ignores disabled cells", () => {
    const board = makeBoard([[makeCell("1A", 100, "Q", "disabled")]]);
    expect(getActiveQuestions(board)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getActiveQuestionIds
// ---------------------------------------------------------------------------

describe("getActiveQuestionIds", () => {
  it("returns IDs of all open cells", () => {
    const board = makeBoard([
      [makeCell("1A", 100, "", "open"), makeCell("1B", 200, "", "hidden")],
      [makeCell("2A", 300, "", "open"), makeCell("2B", 400, "", "claimed")],
    ]);
    expect(getActiveQuestionIds(board)).toEqual(["1A", "2A"]);
  });

  it("returns empty array when no cells are open", () => {
    const board = makeBoard([[makeCell("1A", 100, "", "hidden")]]);
    expect(getActiveQuestionIds(board)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// resolveTimerQuestion
// ---------------------------------------------------------------------------

describe("resolveTimerQuestion", () => {
  it("returns null when no cells are open and current is null", () => {
    const board = makeBoard([[makeCell("1A", 100, "Q", "hidden")]]);
    expect(resolveTimerQuestion(null, board)).toBeNull();
  });

  it("keeps current snapshot when no cells are open (no flicker)", () => {
    const current = { cellId: "1A", category: "Sci", value: 100, question: "Q" };
    const board = makeBoard([[makeCell("1A", 100, "Q", "claimed")]]);
    expect(resolveTimerQuestion(current, board)).toEqual(current);
  });

  it("captures a newly active (first-seen) open question", () => {
    const board = makeBoard(
      [[makeCell("1A", 100, "What is gravity?", "open")]],
      ["Physics"],
    );
    const result = resolveTimerQuestion(null, board);
    expect(result).toEqual({
      cellId: "1A",
      category: "Physics",
      value: 100,
      question: "What is gravity?",
    });
  });

  it("holds the current snapshot when it is still in the active list", () => {
    const current = { cellId: "1A", category: "Physics", value: 100, question: "Old Q" };
    const board = makeBoard(
      [[makeCell("1A", 100, "Old Q", "open")]],
      ["Physics"],
    );
    const result = resolveTimerQuestion(current, board, ["1A"]);
    expect(result?.cellId).toBe("1A");
  });

  it("switches to a newly appeared question, ignoring the previous one", () => {
    const current = { cellId: "1A", category: "History", value: 100, question: "Q1" };
    const board = makeBoard(
      [
        [
          makeCell("1A", 100, "Q1", "open"),
          makeCell("1B", 200, "Q2 -- new!", "open"),
        ],
      ],
      ["History", "Science"],
    );
    // 1A was already seen, 1B is new
    const result = resolveTimerQuestion(current, board, ["1A"]);
    expect(result?.cellId).toBe("1B");
    expect(result?.question).toBe("Q2 -- new!");
  });

  it("falls back to first active question when current is null and no previousIds", () => {
    const board = makeBoard(
      [
        [
          makeCell("1A", 100, "First", "open"),
          makeCell("1B", 200, "Second", "open"),
        ],
      ],
      ["A", "B"],
    );
    const result = resolveTimerQuestion(null, board);
    expect(result?.cellId).toBe("1A");
  });

  it("falls back to first active question when current cell is no longer in active list", () => {
    const current = { cellId: "GONE", category: "X", value: 999, question: "?" };
    const board = makeBoard(
      [[makeCell("1A", 100, "Fallback Q", "open")]],
      ["Fallback"],
    );
    // "GONE" is not open, 1A is
    const result = resolveTimerQuestion(current, board, ["GONE"]);
    // "1A" is newly active (not in previous), so it wins
    expect(result?.cellId).toBe("1A");
  });
});
