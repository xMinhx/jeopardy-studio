import { z } from "zod";

export const TeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  score: z.number().int(),
  abbr: z.string().optional(),
});

export const CellSchema = z
  .object({
    id: z.string(),
    value: z.number().int().positive(),
    question: z.string().default(""),
    state: z.enum(["hidden", "open", "claimed", "disabled"]).optional(),
    ownerTeamId: z.string().optional(),
    // Legacy fields: kept for backwards-compatible JSON imports.
    disabled: z.boolean().optional(),
    lockedTeamId: z.string().optional(),
  })
  .transform(({ disabled, state, ownerTeamId, lockedTeamId, ...cell }) => {
    let finalState = state;
    if (!finalState) {
      if (disabled) finalState = "disabled";
      else if (ownerTeamId) finalState = "claimed";
      else if (lockedTeamId) finalState = "open";
      else finalState = "hidden";
    }
    return {
      ...cell,
      ownerTeamId,
      state: finalState as "hidden" | "open" | "claimed" | "disabled",
    };
  });

export const BoardSchema = z.object({
  rows: z.number().int().positive(),
  cols: z.number().int().positive(),
  categories: z.array(z.string()),
  grid: z.array(z.array(CellSchema)),
});

/**
 * The shape of state that may be saved/restored or sent between windows.
 * Derived from the Zod schemas to avoid duplication with `persisted-state.ts`.
 */
export const PersistedStateSchema = z.object({
  teams: z.array(TeamSchema),
  board: BoardSchema,
});

export type PersistedState = z.infer<typeof PersistedStateSchema>;
