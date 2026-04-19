/**
 * Tests for resolveTimerQuestion (previously tested via Display.tsx internal export).
 * Now tests the extracted utility in boardUtils.ts directly.
 */
import { describe, expect, it } from "vitest";
import { resolveTimerQuestion } from "@/features/board/boardUtils";

describe("resolveTimerQuestion", () => {
  const teams = [
    { id: "A", name: "Team A", color: "#f00", score: 0 },
    { id: "B", name: "Team B", color: "#00f", score: 0 },
  ];

  it("captures the currently active open question", () => {
    const next = resolveTimerQuestion(
      null,
      {
        rows: 1,
        cols: 1,
        categories: ["Science"],
        grid: [
          [
            {
              id: "1A",
              value: 100,
              question: "What is gravity?",
              state: "open",
            },
          ],
        ],
      }
    );

    expect(next).toEqual({
      cellId: "1A",
      category: "Science",
      value: 100,
      question: "What is gravity?",
    });
  });

  it("keeps showing the last selected question after the cell is claimed", () => {
    const current = {
      cellId: "1A",
      category: "Science",
      value: 100,
      question: "What is gravity?",
    };

    const next = resolveTimerQuestion(
      current,
      {
        rows: 1,
        cols: 1,
        categories: ["Science"],
        grid: [
          [
            {
              id: "1A",
              value: 100,
              question: "What is gravity?",
              state: "claimed",
              ownerTeamId: "A",
            },
          ],
        ],
      }
    );

    expect(next).toEqual(current);
  });

  it("switches to a newly active question even when an older one is still open", () => {
    const current = {
      cellId: "1A",
      category: "Science",
      value: 100,
      question: "What is gravity?",
    };

    const next = resolveTimerQuestion(
      current,
      {
        rows: 1,
        cols: 2,
        categories: ["Science", "History"],
        grid: [
          [
            {
              id: "1A",
              value: 100,
              question: "What is gravity?",
              state: "open",
            },
            {
              id: "1B",
              value: 200,
              question: "Who built the pyramids?",
              state: "open",
            },
          ],
        ],
      },
      ["1A"],
    );

    expect(next).toEqual({
      cellId: "1B",
      category: "History",
      value: 200,
      question: "Who built the pyramids?",
    });
  });
});
