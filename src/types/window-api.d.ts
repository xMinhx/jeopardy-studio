import type { Board } from "@/types/board";
import type { Team } from "@/types/team";

type AppSnapshot = {
  teams: Team[];
  board: Board;
};

type DisplayMode = "scoreboard" | "timer";

type TimerTickPayload = {
  remainingMs: number;
  durationMs: number;
  running: boolean;
  ended?: boolean;
  displayMs?: number;
};

interface WindowApi {
  getState?: () => Promise<AppSnapshot | null>;
  updateState?: (state: AppSnapshot) => void;
  onStateChanged?: (cb: (state: AppSnapshot) => void) => (() => void) | void;
  showTimer?: () => void;
  showScoreboard?: () => void;
  getDisplayMode?: () => Promise<DisplayMode | null>;
  onDisplayMode?: (cb: (mode: DisplayMode) => void) => (() => void) | void;
  onTimerTick?: (
    cb: (payload: TimerTickPayload) => void,
  ) => (() => void) | void;
  sendTimerTick?: (
    remainingMs: number,
    durationMs: number,
    running: boolean,
    ended?: boolean,
    displayMs?: number,
  ) => void;
  importBoard?: () => Promise<AppSnapshot | null>;
  exportBoard?: (data: AppSnapshot) => Promise<boolean>;
}

declare global {
  interface Window {
    api?: WindowApi;
  }
}

export {};
