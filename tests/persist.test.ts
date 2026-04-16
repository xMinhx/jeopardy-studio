import { describe, it, expect } from "vitest";
import { exportState, importState } from "@/utils/persist";

describe("persist", () => {
  const sample = {
    teams: [
      { id: "A", name: "Team A", color: "#f00", score: 100 },
      { id: "B", name: "Team B", color: "#00f", score: 200 },
    ],
    board: {
      rows: 2,
      cols: 2,
      categories: ["X", "Y"],
      grid: [
        [
          { id: "1A", value: 100 },
          { id: "1B", value: 100, ownerTeamId: "A" },
        ],
        [
          { id: "2A", value: 200, disabled: true },
          { id: "2B", value: 200 },
        ],
      ],
    },
  } as const;

  it("exports and imports valid state", () => {
    const json = exportState(sample as any);
    const parsed = importState(json);
    expect(parsed.teams[0].name).toBe("Team A");
    expect(parsed.board.grid[1][0].state).toBe("disabled");
  });

  it("rejects invalid state", () => {
    const broken = { ...sample, teams: [{ id: "x" }] } as any;
    expect(() => exportState(broken)).toThrow();
  });
});
