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
import { AnimatedNumber } from "@/features/common/components/AnimatedNumber";

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

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F11") {
        e.preventDefault();
        window.api?.toggleFullscreen?.('display');
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      offMode?.();
      offTick?.();
      window.removeEventListener("keydown", onKey);
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
    <div className="flex flex-col h-screen overflow-hidden text-slate-100" style={{ background: "var(--surface-base)" }}>
      <div className="h-10 drag-region flex items-center justify-between px-8 shrink-0 bg-transparent">
        <span className="studio-label">Jeopardy Studio</span>
        <button
          className="text-[9px] font-bold uppercase tracking-widest text-[--text-muted]/40 hover:text-[--text-muted] transition-colors"
          onClick={() => window.api?.toggleFullscreen?.('display')}
          title="Toggle fullscreen (F11)"
        >
          F11 Fullscreen
        </button>
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
    <div className="flex h-full flex-col gap-8 overflow-x-hidden pb-2 pt-4">
      {/* Board */}
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="mb-8 flex justify-center">
          <h1 className="text-display text-4xl text-[--text-primary] border-b-2 border-[--gold] pb-2">
            QUIZSHOW
          </h1>
        </div>

        <div className="relative flex min-h-0 flex-1">
          {/* Active question overlay */}
          {activeCell && activeQuestion && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[--surface-overlay] bg-opacity-95 backdrop-blur-md rounded-2xl">
              <div className="max-w-5xl px-10 py-8 text-center">
                <div className="flex items-center justify-center gap-4 studio-label mb-4">
                  <span>{activeQuestion.category}</span>
                  <span className="h-1 w-1 rounded-full bg-[--gold]" />
                  {dailyDouble.stage === "question" ? (
                    <span className="text-[--gold]">
                      DAILY DOUBLE: ${dailyDouble.wager.toLocaleString()}
                    </span>
                  ) : (
                    <span className="font-serif italic text-[--gold] text-4xl capitalize">{activeQuestion.value} points</span>
                  )}
                </div>
                <div className="mt-8 font-serif text-5xl font-normal text-[--text-primary] leading-tight">
                  {activeCell.question || "No question set"}
                </div>
              </div>
            </div>
          )}

          <div
            className={`flex min-h-0 flex-1 flex-col gap-3 transition-opacity ${activeCell ? "opacity-20" : "opacity-100"}`}
          >
            {/* Column headers */}
            <div
              className="grid gap-3 mb-2"
              style={{ gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))` }}
            >
              {visibleCategories.map((cat, i) => (
                <div
                  key={`${i}-${cat}`}
                  className="px-3 py-2 text-center text-sm font-sans font-bold uppercase tracking-widest text-[--text-secondary] border-b"
                  style={{ borderColor: 'var(--border-strong)' }}
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

      {/* Teams (Bottom Bar) */}
      <section className="shrink-0 pt-4 border-t border-[--border-subtle] overflow-visible">
        <div className="grid items-stretch gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 overflow-visible">
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
    <div className="flex h-full flex-col items-center justify-center p-6 text-[--text-primary] animate-in zoom-in duration-700 bg-[--surface-base]">
      <div className="relative">
        {/* Decorative rays */}
        <div className="absolute inset-[-150vh] animate-[spin_40s_linear_infinite] opacity-30 pointer-events-none mix-blend-screen"
             style={{ background: 'conic-gradient(from 0deg, transparent 0deg, var(--gold-subtle) 10deg, transparent 20deg, var(--gold-subtle) 30deg, transparent 40deg, var(--gold-subtle) 50deg, transparent 60deg, var(--gold-subtle) 70deg, transparent 80deg, var(--gold-subtle) 90deg, transparent 100deg, var(--gold-subtle) 110deg, transparent 120deg, var(--gold-subtle) 130deg, transparent 140deg, var(--gold-subtle) 150deg, transparent 160deg, var(--gold-subtle) 170deg, transparent 180deg, var(--gold-subtle) 190deg, transparent 200deg, var(--gold-subtle) 210deg, transparent 220deg, var(--gold-subtle) 230deg, transparent 240deg, var(--gold-subtle) 250deg, transparent 260deg, var(--gold-subtle) 270deg, transparent 280deg, var(--gold-subtle) 290deg, transparent 300deg, var(--gold-subtle) 310deg, transparent 320deg, var(--gold-subtle) 330deg, transparent 340deg, var(--gold-subtle) 350deg, transparent 360deg)' }} />

        <div className="relative flex flex-col items-center text-center">
          <div className="mb-2 text-3xl font-bold uppercase tracking-[0.6em] text-[--gold] drop-shadow-[0_0_15px_var(--gold-glow)]">
            Daily
          </div>
          <div className="text-[15vmin] font-serif uppercase leading-[0.9] tracking-wider text-[--text-primary]" style={{ textShadow: '0 10px 30px rgba(0,0,0,0.8), 0 0 40px var(--gold-glow), 0 0 80px var(--gold-subtle)' }}>
            Double
          </div>
          <div className="mt-8 h-1 w-64 bg-gradient-to-r from-transparent via-[--gold] to-transparent shadow-[0_0_20px_var(--gold-glow)]" />

          {team && (
            <div className="mt-12 flex flex-col items-center animate-in slide-in-from-bottom-10 duration-1000 delay-300">
              <div
                className="mb-4 flex h-24 w-24 items-center justify-center rounded-full border-2 border-[--border-strong] shadow-xl"
                style={{ background: team.color }}
              >
                <span className="text-4xl font-bold text-[#0c0f1a]">
                  {team.name.charAt(0)}
                </span>
              </div>
              <div className="text-2xl font-bold uppercase tracking-widest text-[--text-primary]">
                {team.name}
              </div>
              <div className="mt-4 flex flex-col items-center gap-1">
                <span className="text-xs uppercase tracking-[0.3em] text-[--text-muted] font-bold">Current Wager</span>
                <div className="studio-card border-[--border-strong] px-10 py-4 text-5xl font-mono font-bold text-[--gold] shadow-2xl backdrop-blur-md">
                  <AnimatedNumber value={dailyDouble.wager} prefix="$" />
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
            <div className="mb-4 text-2xl font-bold uppercase tracking-[0.8em] text-[--text-muted]">
              Final Round
            </div>
            <div className="mb-10 text-[10vmin] font-serif uppercase leading-none tracking-wide text-[--gold] drop-shadow-[0_0_20px_var(--gold-glow)]">
              Category
            </div>
            <div className="studio-card border-[--gold] px-16 py-12 shadow-[0_0_50px_var(--gold-glow)] backdrop-blur-3xl">
              <div className="text-[8vmin] font-black uppercase tracking-widest text-[--text-primary]">
                {finalJeopardy.category || "Mystery Category"}
              </div>
            </div>
          </div>
        )}

        {/* Stage: Wager */}
        {stage === "wager" && (
          <div className="flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-700 w-full">
            <div className="mb-6 text-2xl font-bold uppercase tracking-[0.5em] text-[--gold]">
              Wagers Locked
            </div>
            <div className="flex flex-wrap justify-center gap-4 w-full max-w-[90vw] max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {teams.map((t) => (
                <div key={t.id} className="studio-card flex flex-col items-center w-40 p-4 bg-[--surface-overlay]">
                  <div className="mb-3 flex items-center justify-center">
                    <div className="h-12 w-12 rounded-full flex items-center justify-center text-xl font-bold shadow-inner border border-[--border-strong]" style={{ background: t.color }}>
                      <span className="text-[#0c0f1a]">{t.name.charAt(0)}</span>
                    </div>
                  </div>
                  <div className="text-sm font-bold uppercase tracking-widest text-[--text-primary] truncate w-full">{t.name}</div>
                  <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">Locked In</div>
                </div>
              ))}
            </div>
            <div className="mt-8 text-xl font-serif text-[--text-secondary] italic animate-pulse">
              Calculating risks...
            </div>
          </div>
        )}

        {/* Stage: Question */}
        {stage === "question" && (
          <div className="flex flex-col items-center text-center animate-in fade-in scale-in duration-1000">
            <div className="mb-6 text-2xl font-bold uppercase tracking-[0.6em] text-[--gold]">
              Final Jeopardy
            </div>
            <div className="w-full max-w-5xl rounded-[40px] border border-[--border-strong] bg-[--surface-overlay] px-12 py-16 shadow-[0_0_80px_var(--shadow-deep)] backdrop-blur-2xl">
              <div className="text-[clamp(1.5rem,4vw,4rem)] font-serif leading-tight text-[--text-primary] drop-shadow-md">
                {finalJeopardy.question || "No question provided."}
              </div>
            </div>
            <div className="mt-10 flex items-center gap-4">
              <div className="h-px w-24 bg-gradient-to-r from-transparent to-[--gold]" />
              <div className="text-sm font-bold uppercase tracking-[0.4em] text-[--gold]">Good Luck</div>
              <div className="h-px w-24 bg-gradient-to-l from-transparent to-[--gold]" />
            </div>
          </div>
        )}

        {/* Stage: Resolution */}
        {stage === "resolution" && (
          <>
            <div className="pointer-events-none absolute inset-[-100vh] z-0 bg-[radial-gradient(circle_at_50%_50%,var(--gold-subtle),transparent_60%)] animate-in fade-in duration-1000" />
            <div className="pointer-events-none absolute inset-[-100vh] z-0 animate-[spin_60s_linear_infinite] mix-blend-screen opacity-50"
                 style={{ background: 'conic-gradient(from 0deg, transparent 0deg, var(--gold-glow) 10deg, transparent 20deg, var(--gold-glow) 30deg, transparent 40deg, var(--gold-glow) 50deg, transparent 60deg, var(--gold-glow) 70deg, transparent 80deg, var(--gold-glow) 90deg, transparent 100deg, var(--gold-glow) 110deg, transparent 120deg, var(--gold-glow) 130deg, transparent 140deg, var(--gold-glow) 150deg, transparent 160deg, var(--gold-glow) 170deg, transparent 180deg, var(--gold-glow) 190deg, transparent 200deg, var(--gold-glow) 210deg, transparent 220deg, var(--gold-glow) 230deg, transparent 240deg, var(--gold-glow) 250deg, transparent 260deg, var(--gold-glow) 270deg, transparent 280deg, var(--gold-glow) 290deg, transparent 300deg, var(--gold-glow) 310deg, transparent 320deg, var(--gold-glow) 330deg, transparent 340deg, var(--gold-glow) 350deg, transparent 360deg)' }} />
            
            <div className="relative z-10 flex flex-col items-center text-center animate-in fade-in slide-in-from-top-12 duration-700 w-full">
              <div className="mb-10 text-4xl font-bold uppercase tracking-[0.4em] text-[--gold] drop-shadow-[0_0_20px_var(--gold-glow)]">
                The Champion
              </div>
              <div className="flex flex-wrap justify-center items-end gap-6 w-full max-w-[90vw]">
                {[...teams].sort((a,b) => b.score - a.score).slice(0, 5).map((t, idx) => (
                  <div key={t.id} className={`relative flex flex-col items-center p-6 transition-all ${idx === 0 ? "studio-card--gold scale-125 z-20 bg-[--surface-overlay] shadow-[0_0_80px_var(--gold-glow)] mx-4 mb-8" : "studio-card scale-90 opacity-90 z-10"}`}>
                    {idx === 0 && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-[--gold] px-6 py-1 text-[10px] font-bold uppercase tracking-widest text-[#0c0f1a] shadow-[0_0_15px_var(--gold-glow)] whitespace-nowrap">
                        1st Place
                      </div>
                    )}
                    <div className="mb-4 flex justify-center">
                      <div className="h-20 w-20 rounded-full flex items-center justify-center text-4xl font-bold shadow-inner border-2 border-[--border-strong]" style={{ background: t.color }}>
                        <span className="text-[#0c0f1a] drop-shadow-sm">{t.name.charAt(0)}</span>
                      </div>
                    </div>
                    <div className="text-xl font-serif font-bold text-[--text-primary] truncate w-full max-w-[150px]">{t.name}</div>
                    {(finalJeopardy.wagers[t.id] ?? 0) > 0 && (
                      <div className="mt-3 text-[10px] font-bold uppercase tracking-widest text-[--text-muted]">
                        Wager: <span className="text-[--gold] text-data"><AnimatedNumber value={finalJeopardy.wagers[t.id] ?? 0} prefix="$" /></span>
                      </div>
                    )}
                    <div className={`mt-3 text-data font-black ${idx === 0 ? 'text-6xl text-[--gold]' : 'text-4xl text-[--text-primary]'}`}>
                      <AnimatedNumber value={t.score} />
                    </div>
                    <div className="mt-1 text-[9px] font-bold uppercase tracking-widest text-[--text-muted]">Final Score</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
