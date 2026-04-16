// Display.tsx
import { useBoardStore } from "@/store/boardStore";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";
import type { Board } from "@/types/board";
import type { Cell } from "@/types/cell";
import type { Team } from "@/types/team";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadBoardPreset } from "@/services/defaultPreset";

const ALERT_EPS_MS = 300; // treat anything <= this as "time's up"

export interface DisplayQuestionSnapshot {
  cellId: string;
  category: string;
  value: number;
  question: string;
  lockedTeamName?: string;
}

function getActiveQuestionSnapshots(
  board: Board,
  teams: Team[],
): DisplayQuestionSnapshot[] {
  const visibleCategories = board.categories.slice(0, board.cols);
  const visibleRows = board.grid
    .slice(0, board.rows)
    .map((row) => row.slice(0, board.cols));
  const activeQuestions: DisplayQuestionSnapshot[] = [];

  for (let row = 0; row < visibleRows.length; row += 1) {
    for (let col = 0; col < visibleRows[row].length; col += 1) {
      const cell = visibleRows[row][col];
      if (cell.state === "locked" || cell.state === "open") {
        activeQuestions.push({
          cellId: cell.id,
          category: visibleCategories[col] ?? `Cat ${col + 1}`,
          value: cell.value,
          question: cell.question,
          lockedTeamName: teams.find((team) => team.id === cell.lockedTeamId)
            ?.name,
        });
      }
    }
  }

  return activeQuestions;
}

function getActiveQuestionCellIds(board: Board): string[] {
  return board.grid
    .slice(0, board.rows)
    .flatMap((row) => row.slice(0, board.cols))
    .filter((cell) => cell.state === "locked" || cell.state === "open")
    .map((cell) => cell.id);
}

export function resolveTimerQuestionSnapshot(
  current: DisplayQuestionSnapshot | null,
  board: Board,
  teams: Team[],
  previousActiveCellIds: Iterable<string> = [],
): DisplayQuestionSnapshot | null {
  const activeQuestions = getActiveQuestionSnapshots(board, teams);

  if (activeQuestions.length === 0) {
    return current;
  }

  const previousActiveIds = new Set(previousActiveCellIds);
  const newlyActiveQuestion = activeQuestions.find(
    (question) => !previousActiveIds.has(question.cellId),
  );

  if (newlyActiveQuestion) {
    return newlyActiveQuestion;
  }

  if (current) {
    return (
      activeQuestions.find((question) => question.cellId === current.cellId) ??
      current
    );
  }

  return activeQuestions[0] ?? null;
}

export default function Display() {
  const { teams, board, setAll } = useBoardStore();
  const [mode, setMode] = useState<"scoreboard" | "timer">("scoreboard");
  const [displayMs, setDisplayMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [tickRunning, setTickRunning] = useState(false);
  const [ended, setEnded] = useState(false);
  const [alertVersion, setAlertVersion] = useState(0);
  const [timerQuestion, setTimerQuestion] =
    useState<DisplayQuestionSnapshot | null>(null);

  const lastActiveMsRef = useRef(0);
  const prevAlertRef = useRef(false);
  const previousActiveQuestionIdsRef = useRef<string[]>([]);

  // On mount, ask for snapshot and subscribe to changes (from Control)
  useEffect(() => {
    const api = window.api;
    (async () => {
      if (api?.getState) {
        const s = await api.getState();
        if (s) {
          const activeCellIds = getActiveQuestionCellIds(s.board);
          setAll(s);
          setTimerQuestion((current) =>
            resolveTimerQuestionSnapshot(
              current,
              s.board,
              s.teams,
              previousActiveQuestionIdsRef.current,
            ),
          );
          previousActiveQuestionIdsRef.current = activeCellIds;
        } else {
          const presetBoard = await loadBoardPreset();
          if (presetBoard) {
            const teams = useBoardStore.getState().teams;
            setAll({ teams, board: presetBoard });
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
        const activeCellIds = getActiveQuestionCellIds(s.board);
        setAll(s);
        setTimerQuestion((current) =>
          resolveTimerQuestionSnapshot(
            current,
            s.board,
            s.teams,
            previousActiveQuestionIdsRef.current,
          ),
        );
        previousActiveQuestionIdsRef.current = activeCellIds;
      });
      return () => off?.();
    }
  }, [setAll]);

  // Subscribe to display mode and timer ticks
  useEffect(() => {
    const api = window.api;
    const offMode = api?.onDisplayMode?.((m: "scoreboard" | "timer") =>
      setMode(m),
    );
    const offTick = api?.onTimerTick?.(
      (payload: {
        remainingMs: number;
        durationMs: number;
        running: boolean;
        ended?: boolean;
        displayMs?: number;
      }) => {
        setDurationMs(payload.durationMs);
        setTickRunning(!!payload.running);

        if (payload.remainingMs > 0) {
          lastActiveMsRef.current = payload.remainingMs;
        }

        const explicitEnded = payload.ended ?? false;

        const inferredEnded = !payload.running && payload.remainingMs <= 0;
        const isEnded = explicitEnded || inferredEnded;

        if (isEnded) lastActiveMsRef.current = 0;

        const fallbackDisplay = isEnded
          ? 0
          : payload.running
            ? payload.remainingMs
            : payload.remainingMs > 0
              ? payload.remainingMs
              : lastActiveMsRef.current;

        const preferred =
          typeof payload.displayMs === "number"
            ? payload.displayMs
            : fallbackDisplay;

        setDisplayMs(isEnded ? 0 : Math.max(0, preferred));
        setEnded(isEnded);
      },
    );

    return () => {
      offMode?.();
      offTick?.();
    };
  }, []);

  // When we newly enter the alert state, bump a version to retrigger blink (once)
  useEffect(() => {
    const safeMs = Math.max(0, displayMs);
    const isVisuallyZero = safeMs <= ALERT_EPS_MS;
    const isAlertNow = ended || isVisuallyZero;

    if (isAlertNow && !prevAlertRef.current) {
      setAlertVersion((v) => v + 1);
      prevAlertRef.current = true;
    }

    if (!isAlertNow && prevAlertRef.current) {
      prevAlertRef.current = false;
    }
  }, [ended, displayMs]);

  const content = useMemo(() => {
    if (mode === "timer") {
      const safeMs = Math.max(0, displayMs);
      const secs = Math.floor(safeMs / 1000);
      const minutes = Math.floor(secs / 60);
      const secondsOnly = secs % 60;

      const show =
        safeMs <= ALERT_EPS_MS
          ? "0"
          : minutes >= 1
            ? `${String(minutes).padStart(2, "0")}:${String(secondsOnly).padStart(2, "0")}`
            : String(secondsOnly);

      const pct =
        durationMs > 0 ? Math.max(0, Math.min(1, safeMs / durationMs)) : 0;
      const deg = Math.round(pct * 360);
      const isAlert = ended || safeMs <= ALERT_EPS_MS;

      const glowClass = isAlert ? "ring-glow--alert" : "ring-glow";
      const ringStyle = isAlert
        ? { background: "#ef4444" }
        : {
            backgroundImage: `conic-gradient(#10b981 ${deg}deg, #e5e7eb 0deg)`,
          };

      const digitKey = `${isAlert ? "alert" : "run"}-${alertVersion}`;
      const digitClass =
        `digital text-[18vmin] font-extrabold leading-none ` +
        `${isAlert ? "blink-hard-3" : ""} ` +
        `${!isAlert && tickRunning ? "tick-bounce" : ""}`;
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
                {timerQuestion.lockedTeamName
                  ? `Locked in: ${timerQuestion.lockedTeamName}`
                  : "Open for another team to answer"}
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

    // scoreboard mode
    const leaderScore = teams.reduce(
      (max, t) => Math.max(max, t.score),
      Number.NEGATIVE_INFINITY,
    );
    const leaderCount = teams.filter((t) => t.score === leaderScore).length;

    const visibleCategories = board.categories.slice(0, board.cols);
    const visibleRows = board.grid
      .slice(0, board.rows)
      .map((row) => row.slice(0, board.cols));
    const activeQuestion = (() => {
      for (let row = 0; row < visibleRows.length; row += 1) {
        for (let col = 0; col < visibleRows[row].length; col += 1) {
          const cell = visibleRows[row][col];
          if (cell.state === "locked" || cell.state === "open") {
            return {
              cell,
              category: visibleCategories[col] ?? `Cat ${col + 1}`,
              lockedTeam: teams.find((team) => team.id === cell.lockedTeamId),
            };
          }
        }
      }
      return null;
    })();

    return (
      // Full-height column; no scroll in fullscreen
      <div className="flex h-full flex-col gap-4 overflow-hidden">
        {/* --- Teams --- */}
        <section className="shrink-0 space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
                Scoreboard
              </p>
              <h2 className="text-3xl font-bold text-slate-900">
                Live standings
              </h2>
            </div>
            <span className="text-xs uppercase tracking-[0.4em] text-slate-300">
              Display
            </span>
          </div>

          {/* 5-up on wide screens, responsive down */}
          <div className="grid items-stretch gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {teams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                isLeader={
                  leaderScore > 0 &&
                  team.score === leaderScore &&
                  leaderCount === 1
                }
                isCoLeader={
                  leaderScore > 0 &&
                  team.score === leaderScore &&
                  leaderCount > 1
                }
              />
            ))}
          </div>
        </section>

        {/* --- Board --- */}
        <section className="flex min-h-0 flex-1 flex-col rounded-[28px] border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5">
          <div className="mb-4 text-center text-xs uppercase tracking-[0.4em] text-slate-400">
            Board
          </div>

          {/* Fill leftover height; no scroll in fullscreen */}
          <div className="relative flex min-h-0 flex-1 rounded-[24px] bg-slate-950/50 p-4">
            {activeQuestion && (
              <div className="pointer-events-none absolute inset-6 z-20 flex items-center justify-center">
                <div className="max-w-5xl rounded-[32px] border border-white/20 bg-slate-950/96 px-10 py-8 text-center text-white shadow-2xl backdrop-blur-md">
                  <div className="text-xs uppercase tracking-[0.45em] text-slate-400">
                    {activeQuestion.category} • {activeQuestion.cell.value}{" "}
                    points
                  </div>
                  <div className="mt-4 text-[clamp(2rem,4vw,4rem)] font-black leading-tight text-white">
                    {activeQuestion.cell.question || "No question set"}
                  </div>
                  <div className="mt-5 text-lg font-medium text-slate-300">
                    {activeQuestion.lockedTeam
                      ? `Locked in: ${activeQuestion.lockedTeam.name}`
                      : "Open for another team to answer"}
                  </div>
                </div>
              </div>
            )}
            <div
              className={`flex min-h-0 flex-1 flex-col gap-3 transition-opacity ${activeQuestion ? "opacity-20" : "opacity-100"}`}
            >
              {/* Column headers */}
              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))`,
                }}
              >
                {visibleCategories.map((c, i) => (
                  <div
                    key={`${i}-${c}`}
                    className="rounded-lg bg-slate-800/80 ring-1 ring-white/10 px-3 py-1.5 text-center text-base font-semibold uppercase tracking-wide text-slate-100"
                  >
                    {c}
                  </div>
                ))}
              </div>

              {/* Stretch rows to fill available panel height */}
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
                    lockedTeam={teams.find((t) => t.id === cell.lockedTeamId)}
                    isActive={activeQuestion?.cell.id === cell.id}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }, [
    mode,
    displayMs,
    durationMs,
    teams,
    board,
    tickRunning,
    ended,
    alertVersion,
    timerQuestion,
  ]);

  // Exactly viewport height; no scrollbars in fullscreen
  return (
    <div className="h-screen overflow-hidden p-6 text-slate-900">
      <header className="mb-6 flex items-center justify-center gap-8">
        {/* reserved */}
      </header>
      <div className="flex h-[calc(100%-3.5rem)] flex-col">{content}</div>
    </div>
  );
}

// ---------------- TEAM CARD -----------------
function TeamCard({
  team,
  isLeader,
  isCoLeader,
}: {
  team: Team;
  isLeader: boolean;
  isCoLeader: boolean;
}) {
  const animatedScore = useAnimatedNumber(team.score, 650);
  const displayScore = Math.round(animatedScore).toLocaleString();
  const accent = team.color || "#0ea5e9";
  const metaColor = isLeader ? "text-white/70" : "text-slate-500";
  const labelColor = isLeader ? "text-white/60" : "text-slate-400";
  const iconBorder =
    isLeader || isCoLeader ? "border-white/40" : "border-white/70";

  return (
    <div
      className={`relative flex h-full flex-col justify-between overflow-hidden rounded-3xl p-6 shadow-xl transition-transform duration-300 hover:-translate-y-1 ${
        isLeader
          ? "bg-slate-900 text-white ring-2 ring-emerald-400/70"
          : "bg-white text-slate-900 ring-1 ring-slate-200"
      }`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-15"
        style={{
          background: `radial-gradient(circle at 15% 20%, ${accent}55, transparent 60%)`,
        }}
        aria-hidden
      />
      <div className="relative flex items-center gap-4">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-2xl border-2 ${iconBorder} shadow-inner`}
          style={{ background: accent }}
        >
          <span className="text-xl font-bold text-white">
            {team.name
              .split(" ")
              .map((word) => word[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className={`text-xs uppercase tracking-[0.3em] ${metaColor}`}>
              Team
            </p>
            {(isLeader || isCoLeader) && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wide ${
                  isLeader
                    ? "bg-emerald-500/20 text-emerald-200"
                    : "bg-amber-400/20 text-amber-500"
                }`}
              >
                {isLeader ? "Leading" : "Co-leading"}
              </span>
            )}
          </div>
          <p className="text-2xl font-semibold">{team.name}</p>
        </div>
        <div className="text-right">
          <p className={`text-xs uppercase tracking-[0.3em] ${labelColor}`}>
            Points
          </p>
          <p className="text-4xl font-black tabular-nums">{displayScore}</p>
        </div>
      </div>
    </div>
  );
}

// ---------------- BOARD CARD -----------------
function BoardCard({
  cell,
  owner,
  lockedTeam,
  isActive,
}: {
  cell: Cell;
  owner?: Team;
  lockedTeam?: Team;
  isActive: boolean;
}) {
  const isClaimed = !!owner;
  const isLocked = cell.state === "locked";
  const isOpen = cell.state === "open";
  const isDisabled = cell.state === "disabled";

  const teamColor = owner?.color ?? "#6366f1";

  const bgAvailable = "linear-gradient(145deg, #6d86ff 0%, #8b5cf6 85%)";
  const bgLocked = "linear-gradient(155deg,#475569,#1f2937)";
  const bgOpen = "linear-gradient(150deg,#0f172a,#1d4ed8)";
  const bgClaimed = `linear-gradient(150deg, ${teamColor}22 0%, transparent 60%), linear-gradient(155deg,#0b1220,#121a2b)`;

  return (
    <div
      className={`
        relative h-full overflow-hidden rounded-[26px] text-center text-white
        ${isLocked ? "opacity-80" : ""}
      `}
      style={{
        background: isClaimed
          ? bgClaimed
          : isLocked
            ? bgLocked
            : isOpen
              ? bgOpen
              : isDisabled
                ? bgLocked
                : bgAvailable,
        boxShadow: isClaimed
          ? `0 12px 28px ${teamColor}33`
          : isActive
            ? "0 0 0 3px rgba(255,255,255,0.35), 0 12px 28px rgba(0,0,0,0.35)"
            : "0 12px 28px rgba(0,0,0,0.25)",
      }}
    >
      {/* subtle flare for available cells */}
      {!isDisabled && !isLocked && !isOpen && (
        <div
          className="absolute inset-0 z-0 opacity-10"
          style={{
            background:
              "radial-gradient(60% 60% at 30% 20%, rgba(255,255,255,0.9), transparent 60%)",
          }}
        />
      )}

      {/* safe-area frame to prevent number overlap */}
      <div className="absolute inset-[14px] rounded-[20px]">
        {/* ownership badge */}
        {owner && (
          <span
            className="absolute top-1.5 right-1.5 z-20 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-[6px] text-[11px] font-medium text-white ring-1 ring-white/15 backdrop-blur-sm"
            title={owner.name}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: teamColor }}
            />
            <span className="truncate max-w-[120px]">{owner.name}</span>
          </span>
        )}

        {/* number + live state label */}
        <div className="relative z-10 flex h-full flex-col items-center justify-center gap-1">
          <span className="text-5xl font-extrabold leading-[0.95] text-white/95 drop-shadow-[0_8px_18px_rgba(15,23,42,0.55)]">
            {cell.value}
          </span>

          {isLocked && (
            <span className="mt-0.5 text-[10px] uppercase tracking-wide text-white/60">
              Locked: {lockedTeam?.name ?? "Team"}
            </span>
          )}

          {isOpen && (
            <span className="mt-0.5 text-[10px] uppercase tracking-wide text-white/70">
              Open for steal
            </span>
          )}

          {isDisabled && (
            <span className="mt-0.5 text-[10px] uppercase tracking-wide text-white/60">
              Disabled
            </span>
          )}
        </div>
      </div>

      {/* border ring */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[26px]"
        style={{
          boxShadow: isClaimed
            ? `inset 0 0 0 2px ${teamColor}, 0 4px 12px ${teamColor}33`
            : "inset 0 0 0 1px rgba(255,255,255,0.10)",
        }}
      />

      {/* dim overlay for disabled/locked */}
      {isDisabled && (
        <div className="pointer-events-none absolute inset-0 z-10 rounded-[26px] bg-slate-950/40" />
      )}
    </div>
  );
}
