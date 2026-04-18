import { beforeEach, describe, expect, it } from "vitest";
import { defaultTeams, useBoardStore } from "../src/store/boardStore";
import type { Team } from "../src/types/team";
import type { Cell } from "../src/types/cell";

function resetStore() {
  useBoardStore.setState({
    teams: defaultTeams.map((team: Team) => ({ ...team })),
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
  });
}

describe("boardStore", () => {
  beforeEach(() => {
    resetStore();
  });

  it("initializes with default teams and 5x5 grid", () => {
    const { teams, board } = useBoardStore.getState();
    expect(teams.length).toBeGreaterThanOrEqual(2);
    expect(board.rows).toBe(5);
    expect(board.cols).toBe(5);
    expect(board.grid.length).toBe(5);
    expect(board.grid[0].length).toBe(5);
  });

  it("updates score correctly", () => {
    const api = useBoardStore.getState();
    const id = api.teams[0].id;
    useBoardStore.getState().updateScore(id, 200);
    const updated = useBoardStore.getState().teams.find((t: Team) => t.id === id)!;
    expect(updated.score).toBe(200);
  });

  it("claims, unclaims and disables cells via the proper workflow", () => {
    const id = useBoardStore.getState().teams[0].id;
    const value = useBoardStore.getState().board.grid[0][0].value;
    const base = useBoardStore.getState().teams.find((t: Team) => t.id === id)!.score;

    // hidden → open → awarded
    useBoardStore.getState().openCell(0, 0);
    expect(useBoardStore.getState().board.grid[0][0].state).toBe("open");

    useBoardStore.getState().awardCell(0, 0, id);
    expect(useBoardStore.getState().board.grid[0][0].ownerTeamId).toBe(id);
    expect(useBoardStore.getState().board.grid[0][0].state).toBe("claimed");
    expect(useBoardStore.getState().teams.find((t: Team) => t.id === id)!.score).toBe(
      base + value,
    );

    useBoardStore.getState().unclaimCell(0, 0);
    expect(
      useBoardStore.getState().board.grid[0][0].ownerTeamId,
    ).toBeUndefined();
    expect(useBoardStore.getState().board.grid[0][0].state).toBe("hidden");
    expect(useBoardStore.getState().teams.find((t: Team) => t.id === id)!.score).toBe(
      base,
    );

    useBoardStore.getState().setCellDisabled(0, 0, true);
    expect(useBoardStore.getState().board.grid[0][0].state).toBe("disabled");
  });

  it("removes a team and unclaims its cells", () => {
    const store = useBoardStore.getState();
    const teamId = store.teams[0].id;

    // Use the proper workflow to claim a cell
    useBoardStore.getState().openCell(0, 1);
    useBoardStore.getState().awardCell(0, 1, teamId);
    expect(useBoardStore.getState().board.grid[0][1].ownerTeamId).toBe(teamId);

    // Remove the team
    useBoardStore.getState().removeTeam(teamId);
    // Team is gone
    expect(
      useBoardStore.getState().teams.find((t: Team) => t.id === teamId),
    ).toBeUndefined();
    // Cell is unclaimed and enabled
    expect(
      useBoardStore.getState().board.grid[0][1].ownerTeamId,
    ).toBeUndefined();
    expect(useBoardStore.getState().board.grid[0][1].state).toBe("hidden");
  });

  it("updates team color and reorders teams", () => {
    // Ensure at least two teams
    if (useBoardStore.getState().teams.length < 2) {
      useBoardStore
        .getState()
        .addTeam({ id: "Z", name: "Team Z", color: "#999999", score: 0 });
    }
    const store = useBoardStore.getState();
    const firstId = store.teams[0].id;
    useBoardStore.getState().setTeamColor(firstId, "#123456");
    expect(useBoardStore.getState().teams[0].color).toBe("#123456");
    // move first down
    useBoardStore.getState().moveTeam(firstId, 1);
    expect(useBoardStore.getState().teams[1].id).toBe(firstId);
  });

  it("rebuilds board with requested row and column counts", () => {
    useBoardStore.getState().rebuildBoard(3, 7, 200);
    const { board } = useBoardStore.getState();

    expect(board.rows).toBe(3);
    expect(board.cols).toBe(7);
    expect(board.categories).toHaveLength(7);
    expect(board.grid).toHaveLength(3);
    expect(board.grid.every((row: Cell[]) => row.length === 7)).toBe(true);
    expect(board.grid[0][0].value).toBe(200);
    expect(board.grid[2][0].value).toBe(600);
  });

  it("trims board data when reducing column count", () => {
    const store = useBoardStore.getState();
    store.rebuildBoard(5, 7, 100);
    store.setCategoryTitle(6, "Final Col");

    useBoardStore.getState().rebuildBoard(5, 6, 100);
    const { board } = useBoardStore.getState();

    expect(board.cols).toBe(6);
    expect(board.categories).toHaveLength(6);
    expect(board.categories.includes("Final Col")).toBe(false);
    expect(board.grid.every((row: Cell[]) => row.length === 6)).toBe(true);
  });

  it("reveals, penalizes, and awards teams flexibly", () => {
    const store = useBoardStore.getState();
    store.rebuildBoard(2, 2, 100);

    const teamA = useBoardStore.getState().teams[0].id;
    const teamB = useBoardStore.getState().teams[1].id;
    const scoreA = useBoardStore
      .getState()
      .teams.find((t: Team) => t.id === teamA)!.score;
    const scoreB = useBoardStore
      .getState()
      .teams.find((t: Team) => t.id === teamB)!.score;

    store.setCellQuestion(0, 0, "Sample question");
    store.openCell(0, 0);

    let cell = useBoardStore.getState().board.grid[0][0];
    expect(cell.state).toBe("open");
    expect(cell.question).toBe("Sample question");
    expect(cell.ownerTeamId).toBeUndefined();

    // Penalize team A
    store.penalizeTeam(0, 0, teamA);
    expect(
      useBoardStore.getState().teams.find((t: Team) => t.id === teamA)!.score,
    ).toBe(scoreA - cell.value);
    // Cell should still be open
    expect(useBoardStore.getState().board.grid[0][0].state).toBe("open");

    // Award team B
    store.awardCell(0, 0, teamB);
    cell = useBoardStore.getState().board.grid[0][0];
    expect(cell.ownerTeamId).toBe(teamB);
    expect(cell.state).toBe("claimed");
    expect(
      useBoardStore.getState().teams.find((t: Team) => t.id === teamB)!.score,
    ).toBe(scoreB + cell.value);
  });

  it("resets round correctly (scores to 0 and board hidden)", () => {
    const store = useBoardStore.getState();
    const teamId = store.teams[0].id;
    store.updateScore(teamId, 500);
    store.openCell(0, 0);
    expect(useBoardStore.getState().teams[0].score).toBe(500);
    expect(useBoardStore.getState().board.grid[0][0].state).toBe("open");

    store.resetRound();
    expect(useBoardStore.getState().teams[0].score).toBe(0);
    expect(useBoardStore.getState().board.grid[0][0].state).toBe("hidden");
  });

  it("resets all correctly (teams to default, scores 0, board hidden)", () => {
    const store = useBoardStore.getState();
    store.setCellQuestion(0, 0, "Persistent Question");
    store.openCell(0, 0);
    store.awardCell(0, 0, store.teams[0].id);

    // change team name
    store.setTeamName(store.teams[0].id, "Modified Team");

    expect(useBoardStore.getState().board.grid[0][0].state).toBe("claimed");
    expect(useBoardStore.getState().board.grid[0][0].question).toBe("Persistent Question");

    store.resetAll();
    const cell = useBoardStore.getState().board.grid[0][0];
    expect(cell.state).toBe("hidden");
    expect(cell.ownerTeamId).toBeUndefined();
    expect(cell.question).toBe("Persistent Question");
    
    // teams are reset
    expect(useBoardStore.getState().teams[0].name).toBe("Team A");
    expect(useBoardStore.getState().teams[0].score).toBe(0);
  });
});
