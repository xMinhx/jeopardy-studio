/**
 * boardStore.test.ts
 *
 * Full coverage of the Zustand board store: team management, cell workflow,
 * Daily Double, Final Jeopardy, score edge cases, and state resets.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { defaultTeams, useBoardStore } from "../src/store/boardStore";
import type { Team } from "../src/types/team";
import type { Cell } from "../src/types/cell";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStore() {
  useBoardStore.setState({
    teams: defaultTeams.map((t: Team) => ({ ...t })),
    board: {
      rows: 5,
      cols: 5,
      categories: ["Sci", "Geo", "Hist", "Film", "Misc"],
      grid: Array.from({ length: 5 }, (_, row) =>
        Array.from({ length: 5 }, (_, col) => ({
          id: `${row + 1}${String.fromCharCode(65 + col)}`,
          value: (row + 1) * 100,
          question: "",
          state: "hidden" as const,
        })),
      ),
    },
    dailyDouble: { stage: "none", teamId: null, wager: 0, cellPosition: null },
    finalJeopardy: {
      isActive: false,
      stage: "none",
      category: "",
      question: "",
      wagers: {},
      resolvedTeams: [],
    },
  });
}

const get = () => useBoardStore.getState();
const teamId = (index = 0) => get().teams[index].id;
const teamScore = (id: string) => get().teams.find((t: Team) => t.id === id)!.score;

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

describe("boardStore -- initialization", () => {
  beforeEach(resetStore);

  it("starts with the two default teams", () => {
    expect(get().teams).toHaveLength(2);
    expect(get().teams[0].id).toBe("A");
    expect(get().teams[1].id).toBe("B");
  });

  it("starts with a 5x5 board of hidden cells", () => {
    const { board } = get();
    expect(board.rows).toBe(5);
    expect(board.cols).toBe(5);
    expect(board.grid.every((row: Cell[]) => row.every(c => c.state === "hidden"))).toBe(true);
  });

  it("cell values follow (row+1) * 100 pattern", () => {
    const { board } = get();
    expect(board.grid[0][0].value).toBe(100);
    expect(board.grid[2][0].value).toBe(300);
    expect(board.grid[4][0].value).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Team management
// ---------------------------------------------------------------------------

describe("boardStore -- team management", () => {
  beforeEach(resetStore);

  it("adds a new team", () => {
    const newTeam: Team = { id: "C", name: "Team C", color: "#00ff00", score: 0 };
    get().addTeam(newTeam);
    expect(get().teams).toHaveLength(3);
    expect(get().teams.find(t => t.id === "C")).toBeDefined();
  });

  it("removes a team and resets its claimed cells to hidden", () => {
    const id = teamId(0);
    get().openCell(0, 0);
    get().awardCell(0, 0, id);
    expect(get().board.grid[0][0].ownerTeamId).toBe(id);

    get().removeTeam(id);
    expect(get().teams.find(t => t.id === id)).toBeUndefined();
    expect(get().board.grid[0][0].ownerTeamId).toBeUndefined();
    expect(get().board.grid[0][0].state).toBe("hidden");
  });

  it("renames a team without affecting score or other teams", () => {
    const id = teamId(0);
    const otherId = teamId(1);
    get().updateScore(id, 300);
    get().setTeamName(id, "The Champions");

    expect(get().teams.find(t => t.id === id)!.name).toBe("The Champions");
    expect(teamScore(id)).toBe(300);
    expect(get().teams.find(t => t.id === otherId)!.name).toBe("Team B");
  });

  it("sets team color", () => {
    const id = teamId(0);
    get().setTeamColor(id, "#abcdef");
    expect(get().teams.find(t => t.id === id)!.color).toBe("#abcdef");
  });

  it("moves a team down by 1", () => {
    const id = teamId(0);
    get().moveTeam(id, 1);
    expect(get().teams[1].id).toBe(id);
  });

  it("moves a team up by 1", () => {
    const id = teamId(1);
    get().moveTeam(id, -1);
    expect(get().teams[0].id).toBe(id);
  });

  it("ignores invalid moveTeam (out of bounds)", () => {
    const firstId = teamId(0);
    get().moveTeam(firstId, -1); // already at index 0
    expect(get().teams[0].id).toBe(firstId);
  });

  it("moveTeamTo places team at correct absolute position", () => {
    const id = teamId(0);
    get().addTeam({ id: "C", name: "C", color: "#ccc", score: 0 });
    get().addTeam({ id: "D", name: "D", color: "#ddd", score: 0 });
    get().moveTeamTo(id, 2);
    expect(get().teams[2].id).toBe(id);
  });

  it("updateScore adds a positive delta", () => {
    const id = teamId(0);
    get().updateScore(id, 500);
    expect(teamScore(id)).toBe(500);
  });

  it("updateScore subtracts a negative delta", () => {
    const id = teamId(0);
    get().updateScore(id, 200);
    get().updateScore(id, -100);
    expect(teamScore(id)).toBe(100);
  });

  it("updateScore can push scores negative (no floor)", () => {
    const id = teamId(0);
    get().updateScore(id, -1000);
    expect(teamScore(id)).toBe(-1000);
  });
});

// ---------------------------------------------------------------------------
// Board editing
// ---------------------------------------------------------------------------

describe("boardStore -- board editing", () => {
  beforeEach(resetStore);

  it("rebuilds board with new dimensions, preserving existing category names", () => {
    // Default categories: ["Sci", "Geo", "Hist", "Film", "Misc"]
    get().setCategoryTitle(0, "Science");
    // Rebuild from 5 cols to 4 cols -- keeps existing names that fit, drops the 5th
    get().rebuildBoard(3, 4, 200);
    const { board } = get();
    expect(board.rows).toBe(3);
    expect(board.cols).toBe(4);
    // First 4 categories are preserved (truncated from original 5)
    expect(board.categories[0]).toBe("Science"); // renamed
    expect(board.categories[1]).toBe("Geo");
    expect(board.categories[2]).toBe("Hist");
    expect(board.categories[3]).toBe("Film");
    expect(board.categories).toHaveLength(4);
    expect(board.grid).toHaveLength(3);
    expect(board.grid[0]).toHaveLength(4);
    expect(board.grid[2][0].value).toBe(600);
  });

  it("fills new category slots with placeholder names when expanding columns", () => {
    // Default has 5 cols, expand to 7
    get().rebuildBoard(3, 7, 100);
    const { board } = get();
    // Original 5 are kept
    expect(board.categories[0]).toBe("Sci");
    expect(board.categories[4]).toBe("Misc");
    // New slots get placeholders
    expect(board.categories[5]).toBe("Cat 6");
    expect(board.categories[6]).toBe("Cat 7");
  });

  it("setCategoryTitle updates the correct column", () => {
    get().setCategoryTitle(2, "Geography");
    expect(get().board.categories[2]).toBe("Geography");
    expect(get().board.categories[0]).toBe("Sci"); // unchanged
  });

  it("setCategoryTitle ignores out-of-bounds index", () => {
    const before = [...get().board.categories];
    get().setCategoryTitle(99, "Invalid");
    expect(get().board.categories).toEqual(before);
  });

  it("setCellValue updates a specific cell value", () => {
    get().setCellValue(1, 2, 9999);
    expect(get().board.grid[1][2].value).toBe(9999);
    expect(get().board.grid[0][0].value).toBe(100); // others unchanged
  });

  it("setCellQuestion updates the question text", () => {
    get().setCellQuestion(0, 0, "What is 2+2?");
    expect(get().board.grid[0][0].question).toBe("What is 2+2?");
  });

  it("setCellDailyDouble marks and unmarks a cell", () => {
    get().setCellDailyDouble(2, 2, true);
    expect(get().board.grid[2][2].isDailyDouble).toBe(true);
    get().setCellDailyDouble(2, 2, false);
    expect(get().board.grid[2][2].isDailyDouble).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Cell workflow: hidden -> open -> claimed/disabled
// ---------------------------------------------------------------------------

describe("boardStore -- cell workflow", () => {
  beforeEach(resetStore);

  it("openCell transitions a hidden cell to open", () => {
    get().openCell(0, 0);
    expect(get().board.grid[0][0].state).toBe("open");
  });

  it("openCell closes any previously open cell before opening the new one", () => {
    get().openCell(0, 0);
    get().openCell(1, 1);
    expect(get().board.grid[0][0].state).toBe("hidden");
    expect(get().board.grid[1][1].state).toBe("open");
  });

  it("openCell has no effect on a non-hidden cell", () => {
    get().openCell(0, 0);
    get().awardCell(0, 0, teamId(0));
    get().openCell(0, 0); // already claimed
    expect(get().board.grid[0][0].state).toBe("claimed");
  });

  it("awardCell marks cell claimed, sets owner, adds score", () => {
    const id = teamId(0);
    const value = get().board.grid[0][0].value;
    get().openCell(0, 0);
    get().awardCell(0, 0, id);
    expect(get().board.grid[0][0].state).toBe("claimed");
    expect(get().board.grid[0][0].ownerTeamId).toBe(id);
    expect(teamScore(id)).toBe(value);
  });

  it("awardCell has no effect on a claimed cell", () => {
    const id = teamId(0);
    get().openCell(0, 0);
    get().awardCell(0, 0, id);
    const scoreBefore = teamScore(id);
    get().awardCell(0, 0, teamId(1)); // attempt to re-award
    expect(teamScore(id)).toBe(scoreBefore); // no change
  });

  it("unclaimCell reverts cell to hidden and deducts score", () => {
    const id = teamId(0);
    const value = get().board.grid[0][0].value;
    get().openCell(0, 0);
    get().awardCell(0, 0, id);
    get().unclaimCell(0, 0);
    expect(get().board.grid[0][0].state).toBe("hidden");
    expect(get().board.grid[0][0].ownerTeamId).toBeUndefined();
    expect(teamScore(id)).toBe(0);
  });

  it("penalizeTeam subtracts cell value from score, leaving cell open", () => {
    const id = teamId(0);
    const value = get().board.grid[0][0].value;
    get().openCell(0, 0);
    get().penalizeTeam(0, 0, id);
    expect(teamScore(id)).toBe(-value);
    expect(get().board.grid[0][0].state).toBe("open");
  });

  it("penalizeTeam uses custom amount when provided", () => {
    const id = teamId(0);
    get().openCell(0, 0);
    get().penalizeTeam(0, 0, id, 50);
    expect(teamScore(id)).toBe(-50);
  });

  it("setCellDisabled hides cell and reverts claimed score", () => {
    const id = teamId(0);
    const value = get().board.grid[0][0].value;
    get().openCell(0, 0);
    get().awardCell(0, 0, id);
    get().setCellDisabled(0, 0, true);
    expect(get().board.grid[0][0].state).toBe("disabled");
    expect(teamScore(id)).toBe(0);
  });

  it("setCellDisabled(false) restores cell to hidden", () => {
    get().setCellDisabled(0, 0, true);
    get().setCellDisabled(0, 0, false);
    expect(get().board.grid[0][0].state).toBe("hidden");
  });
});

// ---------------------------------------------------------------------------
// Daily Double
// ---------------------------------------------------------------------------

describe("boardStore -- Daily Double", () => {
  beforeEach(() => {
    resetStore();
    get().setCellDailyDouble(3, 3, true);
  });

  it("openCell on a Daily Double cell starts the wager stage", () => {
    get().openCell(3, 3);
    const dd = get().dailyDouble;
    expect(dd.stage).toBe("wager");
    expect(dd.cellPosition).toEqual({ row: 3, col: 3 });
    expect(dd.wager).toBe(get().board.grid[3][3].value); // defaults to face value
  });

  it("setDailyDoubleTeam assigns a team to the wager", () => {
    const id = teamId(0);
    get().openCell(3, 3);
    get().setDailyDoubleTeam(id);
    expect(get().dailyDouble.teamId).toBe(id);
  });

  it("setDailyDoubleWager updates the wager amount", () => {
    get().openCell(3, 3);
    get().setDailyDoubleWager(750);
    expect(get().dailyDouble.wager).toBe(750);
  });

  it("confirmWager advances stage to question and opens the cell", () => {
    get().openCell(3, 3);
    get().setDailyDoubleTeam(teamId(0));
    get().setDailyDoubleWager(500);
    get().confirmWager();
    expect(get().dailyDouble.stage).toBe("question");
    expect(get().board.grid[3][3].state).toBe("open");
  });

  it("awardCell in DD question stage uses wager as points", () => {
    const id = teamId(0);
    get().openCell(3, 3);
    get().setDailyDoubleTeam(id);
    get().setDailyDoubleWager(600);
    get().confirmWager();
    get().awardCell(3, 3, id);
    expect(teamScore(id)).toBe(600);
    expect(get().board.grid[3][3].state).toBe("claimed");
    expect(get().dailyDouble.stage).toBe("none"); // reset after award
  });

  it("penalizeTeam in DD question stage uses wager amount", () => {
    const id = teamId(0);
    get().openCell(3, 3);
    get().setDailyDoubleTeam(id);
    get().setDailyDoubleWager(400);
    get().confirmWager();
    get().penalizeTeam(3, 3, id);
    expect(teamScore(id)).toBe(-400);
  });

  it("cancelDailyDouble fully resets DD state", () => {
    get().openCell(3, 3);
    get().cancelDailyDouble();
    const dd = get().dailyDouble;
    expect(dd.stage).toBe("none");
    expect(dd.teamId).toBeNull();
    expect(dd.wager).toBe(0);
    expect(dd.cellPosition).toBeNull();
  });

  it("opening a DD cell hides any other open cell first", () => {
    get().openCell(0, 0); // regular open cell
    get().openCell(3, 3); // daily double
    expect(get().board.grid[0][0].state).toBe("hidden");
    expect(get().dailyDouble.stage).toBe("wager");
  });
});

// ---------------------------------------------------------------------------
// Final Jeopardy
// ---------------------------------------------------------------------------

describe("boardStore -- Final Jeopardy", () => {
  beforeEach(resetStore);

  it("startFinalJeopardy activates FJ and closes any open cells", () => {
    get().openCell(0, 0);
    get().startFinalJeopardy();
    expect(get().finalJeopardy.isActive).toBe(true);
    expect(get().finalJeopardy.stage).toBe("category");
    expect(get().board.grid[0][0].state).toBe("hidden");
    expect(get().dailyDouble.stage).toBe("none");
  });

  it("setFinalJeopardyCategory stores the category", () => {
    get().startFinalJeopardy();
    get().setFinalJeopardyCategory("Ancient Civilizations");
    expect(get().finalJeopardy.category).toBe("Ancient Civilizations");
  });

  it("setFinalJeopardyQuestion stores the question text", () => {
    get().startFinalJeopardy();
    get().setFinalJeopardyQuestion("Which empire built the Colosseum?");
    expect(get().finalJeopardy.question).toBe("Which empire built the Colosseum?");
  });

  it("setFinalJeopardyWager records per-team wagers", () => {
    get().startFinalJeopardy();
    get().setFinalJeopardyWager("A", 800);
    get().setFinalJeopardyWager("B", 200);
    expect(get().finalJeopardy.wagers["A"]).toBe(800);
    expect(get().finalJeopardy.wagers["B"]).toBe(200);
  });

  it("advanceFinalJeopardy cycles through stages in order", () => {
    get().startFinalJeopardy(); // starts at "category"
    get().advanceFinalJeopardy(); // -> wager
    expect(get().finalJeopardy.stage).toBe("wager");
    get().advanceFinalJeopardy(); // -> question
    expect(get().finalJeopardy.stage).toBe("question");
    get().advanceFinalJeopardy(); // -> resolution
    expect(get().finalJeopardy.stage).toBe("resolution");
  });

  it("resolveFinalJeopardyTeam adds wager on correct answer", () => {
    get().startFinalJeopardy();
    get().updateScore("A", 1000);
    get().setFinalJeopardyWager("A", 500);
    get().resolveFinalJeopardyTeam("A", true);
    expect(teamScore("A")).toBe(1500);
    expect(get().finalJeopardy.resolvedTeams).toContain("A");
  });

  it("resolveFinalJeopardyTeam subtracts wager on wrong answer", () => {
    get().startFinalJeopardy();
    get().updateScore("A", 1000);
    get().setFinalJeopardyWager("A", 500);
    get().resolveFinalJeopardyTeam("A", false);
    expect(teamScore("A")).toBe(500);
  });

  it("resolveFinalJeopardyTeam ignores duplicate calls for the same team", () => {
    get().startFinalJeopardy();
    get().updateScore("A", 1000);
    get().setFinalJeopardyWager("A", 200);
    get().resolveFinalJeopardyTeam("A", true);
    const scoreAfterFirst = teamScore("A");
    get().resolveFinalJeopardyTeam("A", true); // duplicate
    expect(teamScore("A")).toBe(scoreAfterFirst); // no double-add
  });

  it("cancelFinalJeopardy fully resets FJ state", () => {
    get().startFinalJeopardy();
    get().setFinalJeopardyCategory("Test");
    get().setFinalJeopardyWager("A", 999);
    get().cancelFinalJeopardy();
    const fj = get().finalJeopardy;
    expect(fj.isActive).toBe(false);
    expect(fj.stage).toBe("none");
    expect(fj.category).toBe("");
    expect(fj.wagers).toEqual({});
    expect(fj.resolvedTeams).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Volume / settings
// ---------------------------------------------------------------------------

describe("boardStore -- settings", () => {
  beforeEach(resetStore);

  it("setVolume updates the volume setting", () => {
    get().setVolume(0.5);
    expect(get().settings.volume).toBe(0.5);
  });

  it("setVolume to 0 mutes correctly", () => {
    get().setVolume(0);
    expect(get().settings.volume).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Reset actions
// ---------------------------------------------------------------------------

describe("boardStore -- resets", () => {
  beforeEach(resetStore);

  it("resetRound sets all team scores to 0 and hides all cells", () => {
    get().updateScore("A", 500);
    get().openCell(0, 0);
    get().awardCell(0, 0, "A");
    get().resetRound();
    expect(teamScore("A")).toBe(0);
    expect(get().board.grid[0][0].state).toBe("hidden");
    expect(get().dailyDouble.stage).toBe("none");
  });

  it("resetRound preserves teams and board structure", () => {
    get().setCategoryTitle(0, "Custom Category");
    get().setCellQuestion(0, 0, "My question");
    get().resetRound();
    expect(get().board.categories[0]).toBe("Custom Category");
    expect(get().board.grid[0][0].question).toBe("My question");
  });

  it("resetAll returns teams to defaults and clears all game state", () => {
    get().setTeamName("A", "Custom Name");
    get().updateScore("A", 9000);
    get().startFinalJeopardy();
    get().resetAll();
    expect(get().teams[0].name).toBe("Team A");
    expect(teamScore("A")).toBe(0);
    expect(get().finalJeopardy.isActive).toBe(false);
    expect(get().board.grid[0][0].state).toBe("hidden");
  });
});

// ---------------------------------------------------------------------------
// setAll (IPC state sync)
// ---------------------------------------------------------------------------

describe("boardStore -- setAll", () => {
  beforeEach(resetStore);

  it("replaces teams and board in one call", () => {
    const newTeams: Team[] = [{ id: "X", name: "Team X", color: "#fff", score: 999 }];
    const newBoard = {
      rows: 1,
      cols: 1,
      categories: ["Only"],
      grid: [[{ id: "1A", value: 50, question: "", state: "hidden" as const }]],
    };
    get().setAll({ teams: newTeams, board: newBoard });
    expect(get().teams[0].name).toBe("Team X");
    expect(get().board.rows).toBe(1);
  });
});
