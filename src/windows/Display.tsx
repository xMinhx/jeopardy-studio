import { useBoardStore, type BoardState } from "@/store/boardStore";
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
  const { teams, board, setAll, dailyDouble, finalJeopardy } = useBoardStore();

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
    <div className="flex flex-col h-screen overflow-hidden text-slate-100 bg-[#020617]">
      <div className="h-10 drag-region flex items-center px-8 shrink-0 bg-transparent">
        <span className="text-[10px] uppercase tracking-[0.6em] text-slate-600 font-bold">Jeopardy Display</span>
      </div>
      <div className="flex-1 overflow-hidden px-10 pb-10 pt-2 flex flex-col">
        {finalJeopardy.isActive ? (
          <FinalJeopardySplash teams={teams} finalJeopardy={finalJeopardy} />
        ) : dailyDouble.stage === "wager" ? (
          <DailyDoubleSplash teams={teams} dailyDouble={dailyDouble} />
        ) : mode === "timer" ? (
          <TimerView
            displayMs={displayMs}
            durationMs={durationMs}
            tickRunning={tickRunning}
            ended={ended}
            alertVersion={alertVersion}
            timerQuestion={timerQuestion}
          />
        ) : (
          <ScoreboardView
            teams={teams}
            board={board}
            dailyDouble={dailyDouble}
          />
        )}
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
    <div className="flex h-full flex-col items-center justify-center gap-12 p-6 text-white">
      {timerQuestion && (
        <div className="w-full max-w-5xl rounded-[40px] border border-white/10 bg-slate-900/90 px-12 py-10 text-center shadow-2xl backdrop-blur-xl">
          <div className="text-xs uppercase tracking-[0.5em] text-slate-400">
            {timerQuestion.category} • {timerQuestion.value} points
          </div>
          <div className="mt-6 text-[clamp(2.5rem,5vw,5rem)] font-black leading-tight text-white drop-shadow-sm">
            {timerQuestion.question || "No question set"}
          </div>
          <div className="mt-8 text-xl font-medium text-slate-400 italic">
            Waiting for answer...
          </div>
        </div>
      )}

      <div
        className={`relative ${glowClass} rounded-full bg-white/5 p-4`}
        style={{ width: "65vmin", height: "65vmin" }}
      >
        <div className="absolute inset-4 rounded-full" style={ringStyle} />
        <div className="absolute inset-[32px] flex items-center justify-center rounded-full bg-white shadow-inner">
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
  dailyDouble: BoardState["dailyDouble"];
}

function ScoreboardView({ teams, board, dailyDouble }: ScoreboardViewProps) {
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
            <h2 className="text-3xl font-bold text-slate-100">Live standings</h2>
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
      <section className="flex min-h-0 flex-1 flex-col rounded-[40px] border border-white/5 bg-slate-900/20 p-8 shadow-2xl">
        <div className="mb-6 text-center text-xs uppercase tracking-[0.6em] text-slate-500 font-bold">
          Board
        </div>

        <div className="relative flex min-h-0 flex-1">
          {/* Active question overlay */}
          {activeCell && activeQuestion && (
            <div className="pointer-events-none absolute inset-6 z-20 flex items-center justify-center">
              <div className="max-w-5xl rounded-[32px] border border-white/20 bg-slate-950/96 px-10 py-8 text-center text-white shadow-2xl backdrop-blur-md">
                <div className="flex items-center justify-center gap-4 text-xs uppercase tracking-[0.45em] font-bold">
                  <span className="text-slate-500">{activeQuestion.category}</span>
                  <span className="h-1 w-1 rounded-full bg-slate-700" />
                  {dailyDouble.stage === "question" ? (
                    <span className="text-amber-500">
                      DAILY DOUBLE: ${dailyDouble.wager.toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-slate-400">{activeQuestion.value} points</span>
                  )}
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
                  className="rounded-xl bg-slate-800/40 border border-white/5 px-3 py-2 text-center text-xs font-bold uppercase tracking-widest text-slate-400"
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

// ---------------------------------------------------------------------------
// Daily Double Splash
// ---------------------------------------------------------------------------

function DailyDoubleSplash({
  teams,
  dailyDouble,
}: {
  teams: Team[];
  dailyDouble: BoardState["dailyDouble"];
}) {
  const team = teams.find((t) => t.id === dailyDouble.teamId);

  return (
    <div className="flex h-full flex-col items-center justify-center p-6 text-white animate-in zoom-in duration-500">
      <div className="relative">
        {/* Decorative rays */}
        <div className="absolute inset-[-150px] animate-[spin_30s_linear_infinite] opacity-30 pointer-events-none">
          <div className="h-full w-full bg-[conic-gradient(from_0deg,transparent_0deg,rgba(245,158,11,0.2)_10deg,transparent_20deg,rgba(245,158,11,0.2)_30deg,transparent_40deg,rgba(245,158,11,0.2)_50deg,transparent_60deg,rgba(245,158,11,0.2)_70deg,transparent_80deg,rgba(245,158,11,0.2)_90deg,transparent_100deg,rgba(245,158,11,0.2)_110deg,transparent_120deg,rgba(245,158,11,0.2)_130deg,transparent_140deg,rgba(245,158,11,0.2)_150deg,transparent_160deg,rgba(245,158,11,0.2)_170deg,transparent_180deg,rgba(245,158,11,0.2)_190deg,transparent_200deg,rgba(245,158,11,0.2)_210deg,transparent_220deg,rgba(245,158,11,0.2)_230deg,transparent_240deg,rgba(245,158,11,0.2)_250deg,transparent_260deg,rgba(245,158,11,0.2)_270deg,transparent_280deg,rgba(245,158,11,0.2)_290deg,transparent_300deg,rgba(245,158,11,0.2)_310deg,transparent_320deg,rgba(245,158,11,0.2)_330deg,transparent_340deg,rgba(245,158,11,0.2)_350deg,transparent_360deg)]" />
        </div>

        <div className="relative flex flex-col items-center text-center">
          <div className="mb-2 text-4xl font-black uppercase tracking-[0.5em] text-amber-500 drop-shadow-[0_0_20px_rgba(245,158,11,0.8)]">
            Daily
          </div>
          <div className="text-[18vmin] font-black uppercase leading-[0.8] tracking-[0.1em] text-white drop-shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
            Double
          </div>
          <div className="mt-10 h-1.5 w-48 bg-gradient-to-r from-transparent via-amber-500 to-transparent shadow-[0_0_25px_rgba(245,158,11,1)]" />

          {team && (
            <div className="mt-16 flex flex-col items-center animate-in slide-in-from-bottom-10 duration-1000 delay-500">
              <div
                className="mb-6 flex h-24 w-24 items-center justify-center rounded-[32px] border-4 border-white/20 shadow-2xl rotate-3"
                style={{ background: team.color }}
              >
                <span className="text-5xl font-black text-white drop-shadow-md">
                  {team.name.charAt(0)}
                </span>
              </div>
              <div className="text-3xl font-black uppercase tracking-[0.3em] text-slate-300">
                {team.name}
              </div>
              <div className="mt-6 flex flex-col items-center gap-1">
                <span className="text-xs uppercase tracking-[0.4em] text-amber-500/80 font-bold">Current Wager</span>
                <div className="rounded-2xl bg-slate-900/80 border border-white/10 px-12 py-5 text-6xl font-black tabular-nums text-amber-400 shadow-2xl backdrop-blur-xl">
                  ${dailyDouble.wager.toLocaleString()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Final Jeopardy Splash
// ---------------------------------------------------------------------------

function FinalJeopardySplash({
  teams,
  finalJeopardy,
}: {
  teams: Team[];
  finalJeopardy: BoardState["finalJeopardy"];
}) {
  const stage = finalJeopardy.stage;

  return (
    <div className="flex h-full flex-col items-center justify-center p-6 text-white animate-in zoom-in duration-500">
      <div className="relative w-full max-w-6xl">
        {/* Stage: Category */}
        {stage === "category" && (
          <div className="flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-12 duration-1000">
            <div className="mb-4 text-3xl font-black uppercase tracking-[0.8em] text-indigo-400 opacity-60">
              Final Round
            </div>
            <div className="mb-12 text-[12vmin] font-black uppercase leading-none tracking-tighter text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
              Category
            </div>
            <div className="rounded-[40px] border-4 border-indigo-500/30 bg-indigo-950/40 px-20 py-16 shadow-2xl backdrop-blur-3xl">
              <div className="text-[10vmin] font-black uppercase tracking-widest text-white drop-shadow-[0_0_30px_rgba(99,102,241,0.6)]">
                {finalJeopardy.category || "Mystery Category"}
              </div>
            </div>
          </div>
        )}

        {/* Stage: Wager */}
        {stage === "wager" && (
          <div className="flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-700">
            <div className="mb-8 text-4xl font-black uppercase tracking-[0.5em] text-indigo-500">
              Wagers Locked
            </div>
            <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {teams.map((t) => (
                <div key={t.id} className="flex flex-col rounded-3xl border border-white/10 bg-slate-900/60 p-8 shadow-xl">
                  <div className="mb-4 flex items-center justify-center">
                    <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-3xl font-black" style={{ background: t.color }}>
                      {t.name.charAt(0)}
                    </div>
                  </div>
                  <div className="text-xl font-black uppercase tracking-widest text-slate-300">{t.name}</div>
                  <div className="mt-4 text-xs font-bold uppercase tracking-[0.3em] text-slate-500">Locked In</div>
                </div>
              ))}
            </div>
            <div className="mt-16 text-2xl font-medium text-slate-400 italic animate-pulse">
              Calculating risks...
            </div>
          </div>
        )}

        {/* Stage: Question */}
        {stage === "question" && (
          <div className="flex flex-col items-center text-center animate-in fade-in scale-in duration-1000">
            <div className="mb-6 text-2xl font-black uppercase tracking-[0.6em] text-indigo-500">
              Final Jeopardy
            </div>
            <div className="w-full rounded-[60px] border-8 border-white/5 bg-slate-950/80 px-16 py-20 shadow-[0_0_100px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
              <div className="text-[clamp(2rem,5vw,5rem)] font-black leading-tight text-white drop-shadow-lg">
                {finalJeopardy.question || "No question provided."}
              </div>
            </div>
            <div className="mt-12 flex items-center gap-4">
              <div className="h-1 w-24 rounded-full bg-gradient-to-r from-transparent to-indigo-500" />
              <div className="text-xl font-black uppercase tracking-[0.4em] text-indigo-500">Good Luck</div>
              <div className="h-1 w-24 rounded-full bg-gradient-to-l from-transparent to-indigo-500" />
            </div>
          </div>
        )}

        {/* Stage: Resolution */}
        {stage === "resolution" && (
          <div className="flex flex-col items-center text-center animate-in fade-in slide-in-from-top-12 duration-700">
            <div className="mb-12 text-5xl font-black uppercase tracking-[0.4em] text-emerald-500 drop-shadow-[0_0_20px_rgba(16,185,129,0.4)]">
              The Results
            </div>
            <div className="grid w-full grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[...teams].sort((a,b) => b.score - a.score).map((t, idx) => (
                <div key={t.id} className={`relative flex flex-col rounded-[40px] border p-8 shadow-2xl transition-all ${idx === 0 ? "border-amber-500/50 bg-amber-500/5 scale-110 z-10" : "border-white/10 bg-slate-900/40"}`}>
                  {idx === 0 && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-6 py-2 text-xs font-black uppercase tracking-widest text-slate-950 shadow-lg">
                      Champion
                    </div>
                  )}
                  <div className="mb-6 flex justify-center">
                    <div className="h-24 w-24 rounded-[32px] flex items-center justify-center text-5xl font-black shadow-2xl" style={{ background: t.color }}>
                      {t.name.charAt(0)}
                    </div>
                  </div>
                  <div className="text-2xl font-black uppercase tracking-widest text-white">{t.name}</div>
                  <div className="mt-4 text-5xl font-black tabular-nums text-slate-100">
                    {t.score.toLocaleString()}
                  </div>
                  <div className="mt-2 text-xs font-bold uppercase tracking-widest text-slate-500">Final Score</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
