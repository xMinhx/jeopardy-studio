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
    state: z
      .enum(["hidden", "locked", "open", "claimed", "disabled"])
      .optional(),
    lockedTeamId: z.string().optional(),
    ownerTeamId: z.string().optional(),
    // Legacy field: kept for backwards-compatible JSON imports.
    disabled: z.boolean().optional(),
  })
  .transform(({ disabled, state, ownerTeamId, ...cell }) => ({
    ...cell,
    ownerTeamId,
    state:
      state ?? (disabled ? "disabled" : ownerTeamId ? "claimed" : "hidden"),
  }));

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
