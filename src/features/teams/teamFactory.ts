import type { Team } from "@/types/team";

/** Palette used when auto-assigning colors to new teams. */
export const TEAM_COLOR_PALETTE = [
  "#ef4444",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
] as const;

/**
 * Generate a new unique team ID from the set of letters A–Z, falling back to
 * a numeric suffix if all letters are taken.
 */
export function nextTeamId(existingTeams: Team[]): string {
  const used = new Set(existingTeams.map((t) => t.id));
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i);
    if (!used.has(letter)) return letter;
  }
  return `T${existingTeams.length + 1}`;
}

/** Create a fully-initialised Team object ready to add to the store. */
export function buildTeam(existingTeams: Team[]): Team {
  const id = nextTeamId(existingTeams);
  const color = TEAM_COLOR_PALETTE[existingTeams.length % TEAM_COLOR_PALETTE.length];
  return {
    id,
    name: `Team ${id}`,
    color,
    score: 0,
    abbr: id.substring(0, 2),
  };
}
