import { describe, expect, it } from "vitest";
import { resolveTimerQuestionSnapshot } from "@/windows/Display";

describe("resolveTimerQuestionSnapshot", () => {
  const teams = [
    { id: "A", name: "Team A", color: "#f00", score: 0 },
    { id: "B", name: "Team B", color: "#00f", score: 0 },
  ];

  it("captures the currently active locked question", () => {
    const next = resolveTimerQuestionSnapshot(
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
              state: "locked",
              lockedTeamId: "A",
            },
          ],
        ],
      },
      teams,
    );

    expect(next).toEqual({
      cellId: "1A",
      category: "Science",
      value: 100,
      question: "What is gravity?",
      lockedTeamName: "Team A",
    });
  });

  it("keeps showing the last selected question after the cell is claimed", () => {
    const current = {
      cellId: "1A",
      category: "Science",
      value: 100,
      question: "What is gravity?",
      lockedTeamName: "Team A",
    };

    const next = resolveTimerQuestionSnapshot(
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
      },
      teams,
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

    const next = resolveTimerQuestionSnapshot(
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
              state: "locked",
              lockedTeamId: "B",
            },
          ],
        ],
      },
      teams,
      ["1A"],
    );

    expect(next).toEqual({
      cellId: "1B",
      category: "History",
      value: 200,
      question: "Who built the pyramids?",
      lockedTeamName: "Team B",
    });
  });
});
