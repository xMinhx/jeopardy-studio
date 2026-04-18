import { useBoardStore } from "@/store/boardStore";
import { useEffect, useRef, useState } from "react";
import { loadBoardPreset } from "@/services/defaultPreset";
import { TeamCard } from "@/features/teams/components/TeamCard";
import { BoardCard } from "@/features/board/components/BoardCard";
import {
  getActiveQuestions,
  getActiveQuestionIds,
  resolveTimerQuestion,
  type ActiveQuestionSnapshot,
} from "@/features/board/boardUtils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Treat any remaining time at or below this as "visually zero". */
const ALERT_EPS_MS = 300;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Display() {
  const { teams, board, setAll } = useBoardStore();

  const [mode, setMode] = useState<"scoreboard" | "timer">("scoreboard");
  const [displayMs, setDisplayMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [tickRunning, setTickRunning] = useState(false);
  const [ended, setEnded] = useState(false);
  const [alertVersion, setAlertVersion] = useState(0);
  const [timerQuestion, setTimerQuestion] = useState<ActiveQuestionSnapshot | null>(null);

  const lastActiveMsRef = useRef(0);
  const prevAlertRef = useRef(false);
  const previousActiveQuestionIdsRef = useRef<string[]>([]);

  // ── Subscribe to board state from Control ──────────────────────────────────
  useEffect(() => {
    const api = window.api;

    void (async () => {
      if (api?.getState) {
        const s = await api.getState();
        if (s) {
          previousActiveQuestionIdsRef.current = getActiveQuestionIds(s.board);
          setAll(s);
          setTimerQuestion((cur) =>
            resolveTimerQuestion(cur, s.board, s.teams, previousActiveQuestionIdsRef.current),
          );
        } else {
          const preset = await loadBoardPreset();
          if (preset) {
            setAll({ teams: useBoardStore.getState().teams, board: preset });
          }
        }
      }
      if (api?.getDisplayMode) {
        const m = await api.getDisplayMode();
        if (m) setMode(m);
      }
    })();

    if (api?.onStateChanged) {
      const off = api.onStateChanged((s) => {
        const newIds = getActiveQuestionIds(s.board);
        setAll(s);
        setTimerQuestion((cur) =>
          resolveTimerQuestion(cur, s.board, s.teams, previousActiveQuestionIdsRef.current),
        );
        previousActiveQuestionIdsRef.current = newIds;
      });
      return () => off?.();
    }
  }, [setAll]);

  // ── Subscribe to display mode and timer ticks ──────────────────────────────
  useEffect(() => {
    const api = window.api;
    const offMode = api?.onDisplayMode?.((m) => setMode(m));
    const offTick = api?.onTimerTick?.((payload) => {
      setDurationMs(payload.durationMs);
      setTickRunning(!!payload.running);

      if (payload.remainingMs > 0) lastActiveMsRef.current = payload.remainingMs;

      const isEnded =
        (payload.ended ?? false) || (!payload.running && payload.remainingMs <= 0);
      if (isEnded) lastActiveMsRef.current = 0;

      const fallback = isEnded
        ? 0
        : payload.running
          ? payload.remainingMs
          : payload.remainingMs > 0
            ? payload.remainingMs
            : lastActiveMsRef.current;

      const preferred =
        typeof payload.displayMs === "number" ? payload.displayMs : fallback;

      setDisplayMs(isEnded ? 0 : Math.max(0, preferred));
      setEnded(isEnded);
    });

    return () => {
      offMode?.();
      offTick?.();
    };
  }, []);

  // ── Alert version bump (triggers blink animation, once per transition) ─────
  useEffect(() => {
    const isAlert = ended || displayMs <= ALERT_EPS_MS;
    if (isAlert && !prevAlertRef.current) {
      setAlertVersion((v) => v + 1);
      prevAlertRef.current = true;
    } else if (!isAlert) {
      prevAlertRef.current = false;
    }
  }, [ended, displayMs]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden text-slate-900 bg-slate-950">
      <div className="h-8 drag-region flex items-center px-4 shrink-0 bg-white/5 border-b border-white/5">
        <span className="text-[10px] uppercase tracking-widest text-slate-500 font-medium">Jeopardy Display</span>
      </div>
      <div className="flex-1 overflow-hidden p-6 pt-2 flex flex-col">
        <header className="mb-6 flex items-center justify-center gap-8">{/* reserved */}</header>
      <div className="flex h-[calc(100%-3.5rem)] flex-col">
        {mode === "timer" ? (
          <TimerView
            displayMs={displayMs}
            durationMs={durationMs}
            tickRunning={tickRunning}
            ended={ended}
            alertVersion={alertVersion}
            timerQuestion={timerQuestion}
          />
        ) : (
          <ScoreboardView teams={teams} board={board} />
        )}
      </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timer view
// ---------------------------------------------------------------------------

interface TimerViewProps {
  displayMs: number;
  durationMs: number;
  tickRunning: boolean;
  ended: boolean;
  alertVersion: number;
  timerQuestion: ActiveQuestionSnapshot | null;
}

function TimerView({
  displayMs,
  durationMs,
  tickRunning,
  ended,
  alertVersion,
  timerQuestion,
}: TimerViewProps) {
  const safeMs = Math.max(0, displayMs);
  const secs = Math.floor(safeMs / 1000);
  const minutes = Math.floor(secs / 60);
  const secondsOnly = secs % 60;

  const isAlert = ended || safeMs <= ALERT_EPS_MS;

  const show = isAlert
    ? "0"
    : minutes >= 1
      ? `${String(minutes).padStart(2, "0")}:${String(secondsOnly).padStart(2, "0")}`
      : String(secondsOnly);

  const pct = durationMs > 0 ? Math.max(0, Math.min(1, safeMs / durationMs)) : 0;
  const deg = Math.round(pct * 360);

  const glowClass = isAlert ? "ring-glow--alert" : "ring-glow";
  const ringStyle = isAlert
    ? { background: "#ef4444" }
    : { backgroundImage: `conic-gradient(#10b981 ${deg}deg, #e5e7eb 0deg)` };

  const digitKey = `${isAlert ? "alert" : "run"}-${alertVersion}`;
  const digitClass = [
    "digital text-[18vmin] font-extrabold leading-none",
    isAlert ? "blink-hard-3" : "",
    !isAlert && tickRunning ? "tick-bounce" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const digitStyle = isAlert ? { color: "#b91c1c" } : { color: "#0f172a" };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 p-6 text-slate-900">
      {timerQuestion && (
        <div className="w-full max-w-5xl rounded-[32px] border border-slate-200 bg-white/95 px-10 py-8 text-center shadow-2xl backdrop-blur-md">
          <div className="text-xs uppercase tracking-[0.45em] text-slate-400">
            {timerQuestion.category} • {timerQuestion.value} points
          </div>
          <div className="mt-4 text-[clamp(2rem,4vw,4rem)] font-black leading-tight text-slate-900">
            {timerQuestion.question || "No question set"}
          </div>
          <div className="mt-5 text-lg font-medium text-slate-500">
            Open for answer
          </div>
        </div>
      )}

      <div
        className={`relative ${glowClass} rounded-full`}
        style={{ width: "60vmin", height: "60vmin" }}
      >
        <div className="absolute inset-0 rounded-full" style={ringStyle} />
        <div className="absolute inset-[18px] flex items-center justify-center rounded-full bg-white">
          <div key={digitKey} className={digitClass} style={digitStyle}>
            {show}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scoreboard view
// ---------------------------------------------------------------------------

import type { Board } from "@/types/board";
import type { Team } from "@/types/team";

interface ScoreboardViewProps {
  teams: Team[];
  board: Board;
}

function ScoreboardView({ teams, board }: ScoreboardViewProps) {
  const leaderScore = teams.reduce((max, t) => Math.max(max, t.score), Number.NEGATIVE_INFINITY);
  const leaderCount = teams.filter((t) => t.score === leaderScore).length;

  const visibleCategories = board.categories.slice(0, board.cols);
  const visibleRows = board.grid
    .slice(0, board.rows)
    .map((row) => row.slice(0, board.cols));

  const activeQuestions = getActiveQuestions(board, teams);
  const activeQuestion = activeQuestions[0] ?? null;
  // Find the cell object for the active question (needed for BoardCard)
  const activeCell = activeQuestion
    ? visibleRows.flat().find((c) => c.id === activeQuestion.cellId)
    : null;

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      {/* Teams */}
      <section className="shrink-0 space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Scoreboard</p>
            <h2 className="text-3xl font-bold text-slate-900">Live standings</h2>
          </div>
          <span className="text-xs uppercase tracking-[0.4em] text-slate-300">Display</span>
        </div>

        <div className="grid items-stretch gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {[...teams].sort((a, b) => b.score - a.score).map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              isLeader={leaderScore > 0 && team.score === leaderScore && leaderCount === 1}
              isCoLeader={leaderScore > 0 && team.score === leaderScore && leaderCount > 1}
            />
          ))}
        </div>
      </section>

      {/* Board */}
      <section className="flex min-h-0 flex-1 flex-col rounded-[28px] border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5">
        <div className="mb-4 text-center text-xs uppercase tracking-[0.4em] text-slate-400">
          Board
        </div>

        <div className="relative flex min-h-0 flex-1 rounded-[24px] bg-slate-950/50 p-4">
          {/* Active question overlay */}
          {activeCell && activeQuestion && (
            <div className="pointer-events-none absolute inset-6 z-20 flex items-center justify-center">
              <div className="max-w-5xl rounded-[32px] border border-white/20 bg-slate-950/96 px-10 py-8 text-center text-white shadow-2xl backdrop-blur-md">
                <div className="text-xs uppercase tracking-[0.45em] text-slate-400">
                  {activeQuestion.category} • {activeQuestion.value} points
                </div>
                <div className="mt-4 text-[clamp(2rem,4vw,4rem)] font-black leading-tight text-white">
                  {activeCell.question || "No question set"}
                </div>
                <div className="mt-5 text-lg font-medium text-slate-300">
                  Open for answer
                </div>
              </div>
            </div>
          )}

          <div
            className={`flex min-h-0 flex-1 flex-col gap-3 transition-opacity ${activeCell ? "opacity-20" : "opacity-100"}`}
          >
            {/* Column headers */}
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))` }}
            >
              {visibleCategories.map((cat, i) => (
                <div
                  key={`${i}-${cat}`}
                  className="rounded-lg bg-slate-800/80 ring-1 ring-white/10 px-3 py-1.5 text-center text-base font-semibold uppercase tracking-wide text-slate-100"
                >
                  {cat}
                </div>
              ))}
            </div>

            {/* Cells */}
            <div
              className="grid h-full gap-3"
              style={{
                gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${board.rows}, minmax(0, 1fr))`,
              }}
            >
              {visibleRows.flat().map((cell) => (
                <BoardCard
                  key={cell.id}
                  cell={cell}
                  owner={teams.find((t) => t.id === cell.ownerTeamId)}
                  isActive={activeCell?.id === cell.id}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
