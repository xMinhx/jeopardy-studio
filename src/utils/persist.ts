import { PersistedStateSchema, type PersistedState } from '@/types/schema';

export function exportState(state: PersistedState): string {
  // Validate before export
  PersistedStateSchema.parse(state);
  return JSON.stringify(state, null, 2);
}

export function importState(json: string): PersistedState {
  const raw = JSON.parse(json);
  return PersistedStateSchema.parse(raw);
}

