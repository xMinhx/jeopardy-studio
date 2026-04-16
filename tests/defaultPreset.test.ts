import { describe, expect, it } from "vitest";
import { boardFromPreset } from "@/services/defaultPreset";

describe("default board preset", () => {
  it("builds a board with questions from preset data", () => {
    const board = boardFromPreset({
      rows: 2,
      cols: 2,
      categories: ["A", "B"],
      grid: [
        [
          { value: 100, question: "Q1" },
          { value: 100, question: "Q2" },
        ],
        [
          { value: 200, question: "Q3" },
          { value: 200, question: "Q4" },
        ],
      ],
    });

    expect(board).not.toBeNull();
    expect(board?.rows).toBe(2);
    expect(board?.cols).toBe(2);
    expect(board?.categories).toEqual(["A", "B"]);
    expect(board?.grid[0][0].value).toBe(100);
    expect(board?.grid[0][0].question).toBe("Q1");
  });

  it("returns null for malformed preset", () => {
    expect(boardFromPreset({ rows: 5, cols: 5 })).toBeNull();
  });
});
