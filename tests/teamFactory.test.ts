/**
 * teamFactory.test.ts
 *
 * Tests for nextTeamId and buildTeam utilities.
 */
import { describe, expect, it } from "vitest";
import {
  buildTeam,
  nextTeamId,
  TEAM_COLOR_PALETTE,
} from "../src/features/teams/teamFactory";
import type { Team } from "../src/types/team";

function makeTeams(ids: string[]): Team[] {
  return ids.map(id => ({ id, name: `Team ${id}`, color: "#000", score: 0 }));
}

describe("nextTeamId", () => {
  it("returns A when no teams exist", () => {
    expect(nextTeamId([])).toBe("A");
  });

  it("returns B when A already exists", () => {
    expect(nextTeamId(makeTeams(["A"]))).toBe("B");
  });

  it("skips used letters and picks the next available", () => {
    expect(nextTeamId(makeTeams(["A", "B", "C"]))).toBe("D");
  });

  it("fills gaps -- returns C if A, B, D exist", () => {
    expect(nextTeamId(makeTeams(["A", "B", "D"]))).toBe("C");
  });

  it("falls back to a numeric suffix when all 26 letters are taken", () => {
    const allLetters = Array.from({ length: 26 }, (_, i) =>
      String.fromCharCode(65 + i),
    );
    const id = nextTeamId(makeTeams(allLetters));
    expect(id).toBe("T27"); // 26 teams + 1
  });
});

describe("buildTeam", () => {
  it("creates a team with the correct sequential ID", () => {
    const team = buildTeam(makeTeams(["A", "B"]));
    expect(team.id).toBe("C");
    expect(team.name).toBe("Team C");
    expect(team.score).toBe(0);
  });

  it("cycles through the color palette", () => {
    // First 6 teams should pick palette colors in order
    let teams: Team[] = [];
    for (let i = 0; i < 6; i++) {
      const t = buildTeam(teams);
      expect(t.color).toBe(TEAM_COLOR_PALETTE[i]);
      teams = [...teams, t];
    }
  });

  it("wraps the color palette after 6 teams", () => {
    // Team 7 should get the same color as Team 1
    let teams: Team[] = [];
    for (let i = 0; i < 6; i++) {
      teams = [...teams, buildTeam(teams)];
    }
    const seventh = buildTeam(teams);
    expect(seventh.color).toBe(TEAM_COLOR_PALETTE[0]);
  });

  it("sets score to 0", () => {
    const team = buildTeam([]);
    expect(team.score).toBe(0);
  });
});
