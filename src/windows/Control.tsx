import { useBoardStore } from "@/store/boardStore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTimer } from "@/hooks/useTimer";
import { useTimerAudio } from "@/hooks/useTimerAudio";
import { loadBoardPreset } from "@/services/defaultPreset";
import { buildTeam } from "@/features/teams/teamFactory";
import { TeamRow } from "@/features/teams/components/TeamRow";
import { getActiveQuestions } from "@/features/board/boardUtils";
import { PersistedStateSchema } from "@/types/schema";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Pause button is disabled this many ms before the timer ends to protect the audio cue. */
const FINAL_LOCK_MS = 2500;

const TIMER_PRESETS_SEC = [15, 30, 45, 60, 75, 90] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Control() {
  const {
    teams,
    board,
    setAll,
    addTeam,
    setCategoryTitle,
    setCellValue,
    setCellQuestion,
    rebuildBoard,
    openCell,
    awardCell,
    penalizeTeam,
    unclaimCell,
    setCellDisabled,
  } = useBoardStore();

  // Timer state
  const [timer, t] = useTimer(30000);
  const {
    start: startAudio,
    pause: pauseAudio,
    resume: resumeAudio,
    reset: resetAudio,
    setVolume: setAudioVolume,
  } = useTimerAudio("/assets/15sectimertrack.mp3", "/assets/Ending.mp3");

  const [durationInput, setDurationInput] = useState(
    String(Math.round(timer.durationMs / 1000)),
  );

  // Board UI state
  const [activeTeamId, setActiveTeamId] = useState<string | undefined>(
    () => teams[0]?.id,
  );
  const [editMode, setEditMode] = useState(false);
  const [rows, setRows] = useState(board.rows);
  const [cols, setCols] = useState(board.cols);
  const [base, setBase] = useState(100);
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    row: number;
    col: number;
  } | null>(null);

  const pausedDisplayMsRef = useRef(timer.durationMs);

  // ── Sync board dimensions when rebuilt ────────────────────────────────────
  useEffect(() => {
    setRows((current) => (current !== board.rows ? board.rows : current));
    setCols((current) => (current !== board.cols ? board.cols : current));
  }, [board.rows, board.cols]);

  // ── Load preset on mount ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const preset = await loadBoardPreset();
      if (preset && !cancelled) {
        setAll({ teams: useBoardStore.getState().teams, board: preset });
      }
    })();
    return () => { cancelled = true; };
  }, [setAll]);

  // ── Broadcast timer ticks to Display via IPC ───────────────────────────────
  useEffect(() => {
    if (!window.api?.sendTimerTick) return;
    if (timer.remainingMs > 0) pausedDisplayMsRef.current = timer.remainingMs;
    const ended = !timer.running && timer.remainingMs <= 0;
    if (ended) pausedDisplayMsRef.current = 0;
    const displayMs =
      timer.running || timer.remainingMs > 0
        ? timer.remainingMs
        : (pausedDisplayMsRef.current ?? 0);
    window.api.sendTimerTick(timer.remainingMs, timer.durationMs, timer.running, ended, displayMs);
  }, [timer.remainingMs, timer.durationMs, timer.running]);

  // ── Sync audio volume ──────────────────────────────────────────────────────
  useEffect(() => {
    void setAudioVolume(timer.muted ? 0 : timer.volume);
  }, [setAudioVolume, timer.volume, timer.muted]);

  // ── Broadcast board + team state to Display window ────────────────────────
  const snapshot = useMemo(() => ({ teams, board }), [teams, board]);
  useEffect(() => {
    window.api?.updateState?.(snapshot);
  }, [snapshot]);

  // ── Timer control callbacks ────────────────────────────────────────────────
  const handleStart = useCallback(
    (ms: number) => {
      t.start(ms);
      void startAudio(ms);
    },
    [t, startAudio],
  );

  const handleResume = useCallback(() => {
    if (timer.remainingMs <= 0) {
      handleStart(timer.durationMs);
      return;
    }
    t.resume();
    void resumeAudio(timer.remainingMs);
  }, [t, resumeAudio, timer.remainingMs, timer.durationMs, handleStart]);

  const handlePause = useCallback(() => {
    t.pause();
    void pauseAudio(true);
  }, [t, pauseAudio]);

  const handleReset = useCallback(() => {
    t.reset();
    void resetAudio();
  }, [t, resetAudio]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || (e as KeyboardEvent & { isComposing?: boolean }).isComposing) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (timer.running) {
          if (timer.remainingMs > FINAL_LOCK_MS) {
            handlePause();
          }
        } else {
          if (timer.remainingMs === 0) {
            handleStart(timer.durationMs);
          } else {
            handleResume();
          }
        }
      }
      if (e.key.toLowerCase() === "r") {
        handleReset();
      }

      const presets: Record<string, number> = {
        "1": 10000, "2": 15000, "3": 20000, "4": 30000, "5": 45000, "6": 60000,
      };
      if (e.key in presets) {
        handleStart(presets[e.key]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [timer.running, timer.remainingMs, timer.durationMs, handlePause, handleResume, handleStart, handleReset]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const pauseLocked = timer.running && timer.remainingMs > 0 && timer.remainingMs <= FINAL_LOCK_MS;
  const pauseButtonDisabled = timer.running ? pauseLocked : timer.remainingMs <= 0;
  const pauseTooltip = timer.running
    ? pauseLocked
      ? "Pause disabled in final 2.5s to protect ending audio"
      : "Pause + play ending cue"
    : timer.remainingMs <= 0
      ? "Timer finished"
      : "Resume timer";

  const visibleCategories = board.categories.slice(0, board.cols);
  const visibleRows = board.grid.slice(0, board.rows).map((row) => row.slice(0, board.cols));

  const activePrompt = useMemo(() => {
    const active = getActiveQuestions(board, teams);
    if (active.length === 0) return null;
    const q = active[0];
    // Find grid coordinates for the cell
    for (let r = 0; r < visibleRows.length; r++) {
      for (let c = 0; c < visibleRows[r].length; c++) {
        if (visibleRows[r][c].id === q.cellId) {
          return { row: r, col: c, cell: visibleRows[r][c], ...q };
        }
      }
    }
    return null;
  }, [board, teams, visibleRows]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleApplyBoardDimensions = () => {
    const nextRows = Math.max(1, Math.min(10, Math.floor(Number(rows) || 0)));
    const nextCols = Math.max(1, Math.min(10, Math.floor(Number(cols) || 0)));
    const nextBase = isNaN(base) ? 100 : base;
    setRows(nextRows);
    setCols(nextCols);
    rebuildBoard(nextRows, nextCols, nextBase);
  };

  const handleAddTeam = () => {
    const team = buildTeam(teams);
    addTeam(team);
    setActiveTeamId(team.id);
  };

  const handleTeamSelected = (id: string) => setActiveTeamId(id);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 grid gap-4 text-slate-900" onClick={() => setCtxMenu(null)}>
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Control Window</h1>
        <div className="text-sm text-slate-500">view=control</div>
      </header>

      {/* ── Timer section ── */}
      <section className="rounded border p-4">
        <h2 className="font-medium mb-3">Timer</h2>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          {/* Duration input */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Duration</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="w-24 rounded border px-2 py-1 text-sm"
              value={durationInput}
              onChange={(e) => setDurationInput(e.target.value.replace(/[^0-9]/g, ""))}
              onBlur={() => {
                const v = Math.max(1, Number(durationInput || "0"));
                const rounded = Math.max(15, Math.round(v / 15) * 15);
                t.setDuration(rounded * 1000);
                setDurationInput(String(rounded));
              }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            />
            <span className="text-sm text-slate-600">sec</span>
          </div>

          {/* Play/Pause/Reset */}
          <div className="flex items-center gap-2">
            <button
              className="rounded bg-slate-100 px-3 py-1"
              onClick={() => {
                const rounded = Math.max(15000, Math.round(timer.durationMs / 15000) * 15000);
                handleStart(rounded);
                window.api?.showTimer?.();
              }}
              disabled={timer.running && timer.remainingMs > 0}
            >
              Start
            </button>
            <button
              className="rounded bg-slate-100 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={pauseButtonDisabled}
              title={pauseTooltip}
              onClick={() => {
                if (!pauseButtonDisabled) {
                  if (timer.running) {
                    handlePause();
                  } else {
                    handleResume();
                  }
                }
              }}
            >
              {timer.running ? "Pause" : "Resume"}
            </button>
            <button className="rounded bg-slate-100 px-3 py-1" onClick={handleReset}>
              Reset
            </button>
          </div>

          {/* Presets */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Presets:</span>
            {TIMER_PRESETS_SEC.map((s) => (
              <button
                key={s}
                className="rounded bg-slate-100 px-2 py-1 text-sm"
                onClick={() => { t.setDuration(s * 1000); setDurationInput(String(s)); }}
              >
                {s}s
              </button>
            ))}
          </div>
        </div>

        {/* Progress bar + volume */}
        <div className="mt-3 flex items-center gap-4">
          <div className="min-w-[110px] text-2xl font-semibold tabular-nums">
            {Math.floor(timer.remainingMs / 1000)}s
          </div>
          <div className="h-2 flex-1 overflow-hidden rounded bg-slate-200">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{
                width: `${Math.max(0, (timer.remainingMs / timer.durationMs) * 100)}%`,
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Vol</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={timer.volume}
              onChange={(e) => t.setVolume(Number(e.target.value))}
            />
            <button className="rounded bg-slate-100 px-2 py-1 text-sm" onClick={t.toggleMute}>
              {timer.muted ? "Unmute" : "Mute"}
            </button>
            <button
              className="rounded bg-slate-100 px-2 py-1 text-sm"
              onClick={() => {
                void resetAudio().then(() => {
                  void startAudio(2000);
                });
              }}
            >
              Preview
            </button>
          </div>
        </div>

        {/* Display mode toggles */}
        <div className="mt-3 flex items-center gap-2">
          <button
            className="rounded bg-slate-100 px-3 py-1"
            onClick={() => window.api?.showTimer?.()}
          >
            Show Timer
          </button>
          <button
            className="rounded bg-slate-100 px-3 py-1"
            onClick={() => window.api?.showScoreboard?.()}
          >
            Show Scoreboard
          </button>
        </div>
      </section>

      {/* ── Teams section ── */}
      <section className="rounded border p-4">
        <h2 className="font-medium mb-3">Teams</h2>
        <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
          <div>Click a team to select it as the active team</div>
          <button className="rounded bg-slate-100 px-3 py-1" onClick={handleAddTeam}>
            + Add Team
          </button>
        </div>
        <div className="grid gap-2">
          {teams.map((team, idx) => (
            <TeamRow
              key={team.id}
              team={team}
              index={idx}
              isActive={activeTeamId === team.id}
              onSelect={handleTeamSelected}
            />
          ))}
        </div>
      </section>

      {/* ── Board section ── */}
      <section className="rounded border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Board</h2>
          <div className="flex gap-2">
            <button
              className="rounded bg-slate-100 px-3 py-1 text-sm"
              onClick={async () => {
                try {
                  const raw = await window.api?.importBoard?.();
                  if (!raw) return;
                  const parsed = PersistedStateSchema.parse(raw);
                  setAll(parsed);
                } catch (err) {
                  alert(`Invalid board file: ${err instanceof Error ? err.message : String(err)}`);
                }
              }}
            >
              Import JSON
            </button>
            <button
              className="rounded bg-slate-100 px-3 py-1 text-sm"
              onClick={() => {
                void window.api?.exportBoard?.({ teams, board });
              }}
            >
              Export JSON
            </button>
          </div>
        </div>

        {/* Board config controls */}
        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            Rows
            <input
              className="w-16 rounded border px-2 py-1"
              type="number"
              min={1}
              max={10}
              value={rows}
              onChange={(e) => setRows(Number(e.target.value))}
            />
          </label>
          <label className="flex items-center gap-2">
            Cols
            <input
              className="w-16 rounded border px-2 py-1"
              type="number"
              min={1}
              max={10}
              value={cols}
              onChange={(e) => setCols(Number(e.target.value))}
            />
          </label>
          <label className="flex items-center gap-2">
            Base
            <input
              className="w-20 rounded border px-2 py-1"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={isNaN(base) ? "" : String(base)}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, "");
                setBase(v === "" ? NaN : Number(v));
              }}
              onBlur={() => { if (isNaN(base)) setBase(100); }}
            />
          </label>
          <button className="rounded bg-slate-100 px-3 py-1" onClick={handleApplyBoardDimensions}>
            Apply
          </button>
          <label className="ml-auto flex items-center gap-2">
            Edit Mode
            <input
              type="checkbox"
              checked={editMode}
              onChange={(e) => setEditMode(e.target.checked)}
            />
          </label>
        </div>

        {/* Active prompt panel */}
        {activePrompt && !editMode && (
          <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm">
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-500">
                    Active Question
                  </div>
                  <div className="h-px flex-1 bg-indigo-100" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-slate-500">
                    {activePrompt.category} • {activePrompt.cell.value} points
                  </div>
                  <button
                    className="text-xs font-medium text-slate-400 hover:text-slate-600"
                    onClick={() => unclaimCell(activePrompt.row, activePrompt.col)}
                  >
                    Reset Cell
                  </button>
                </div>
                <div className="max-w-4xl text-xl font-semibold leading-snug text-slate-900">
                  {activePrompt.cell.question || "No question set"}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {teams.map((team) => (
                  <div
                    key={team.id}
                    className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white"
                  >
                    <div className="flex items-center gap-2 border-b px-3 py-1.5 bg-slate-50">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: team.color }}
                      />
                      <span className="text-xs font-bold truncate text-slate-700">
                        {team.name}
                      </span>
                    </div>
                    <div className="flex divide-x border-t-0">
                      <button
                        className="flex-1 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 transition-colors"
                        onClick={() => awardCell(activePrompt.row, activePrompt.col, team.id)}
                      >
                        AWARD
                      </button>
                      <button
                        className="flex-1 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 transition-colors"
                        onClick={() => penalizeTeam(activePrompt.row, activePrompt.col, team.id)}
                      >
                        PENALIZE
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 py-3 text-xs font-bold text-slate-400 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-500 transition-all"
                  onClick={() => setCellDisabled(activePrompt.row, activePrompt.col, true)}
                >
                  NOBODY GOT IT
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Board grid */}
        <div
          className="relative grid gap-1"
          style={{ gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))` }}
        >
          {/* Category headers */}
          {visibleCategories.map((cat, i) => (
            <input
              key={i}
              className="rounded border p-2 text-center text-sm font-medium text-slate-700"
              value={cat}
              onChange={(e) => setCategoryTitle(i, e.target.value)}
              aria-label={`Category ${i + 1}`}
            />
          ))}

          {/* Cells */}
          {visibleRows.map((row, r) =>
            row.map((cell, c) => {
              const owner = teams.find((t) => t.id === cell.ownerTeamId);
              const isOpen = cell.state === "open";
              const isClaimed = cell.state === "claimed";
              const isDisabled = cell.state === "disabled";

              return (
                <div
                  key={cell.id}
                  className={`relative overflow-hidden rounded border p-5 text-center transition ${
                    isDisabled
                      ? "bg-slate-100 opacity-60"
                      : isClaimed
                        ? "bg-emerald-50"
                        : isOpen
                          ? "bg-blue-50 ring-2 ring-blue-200"
                          : "hover:bg-slate-50"
                  }`}
                  onClick={() => {
                    if (editMode) return;
                    if (cell.state === "claimed" || cell.state === "disabled") return;
                    openCell(r, c);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setCtxMenu({ x: e.clientX, y: e.clientY, row: r, col: c });
                  }}
                >
                  {editMode ? (
                    <div className="grid gap-2">
                      <input
                        className="w-full rounded border px-2 py-2 text-center text-lg font-semibold"
                        type="number"
                        value={cell.value}
                        onChange={(e) => setCellValue(r, c, Number(e.target.value))}
                      />
                      <input
                        className="w-full rounded border px-2 py-1 text-sm"
                        type="text"
                        value={cell.question ?? ""}
                        placeholder="Question"
                        onChange={(e) => setCellQuestion(r, c, e.target.value)}
                      />
                    </div>
                  ) : (
                    <div className="grid gap-1">
                      <div className="text-xl font-semibold">{cell.value}</div>
                      {(isOpen || isClaimed || isDisabled) && (
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          {isOpen
                            ? "Open"
                            : isClaimed
                              ? (owner?.name ?? "Claimed")
                              : "Disabled"}
                        </div>
                      )}
                    </div>
                  )}
                  {owner && (
                    <span
                      className="pointer-events-none absolute right-[-28px] top-2 rotate-45 px-8 py-0.5 text-xs shadow"
                      style={{ background: owner.color }}
                      aria-hidden
                    />
                  )}
                </div>
              );
            }),
          )}

          {/* Context menu */}
          {ctxMenu && (
            <div
              className="fixed z-50 min-w-[140px] rounded border bg-white shadow"
              style={{ left: ctxMenu.x, top: ctxMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              {[
                {
                  label: "Open Cell",
                  disabled: ["claimed", "disabled"].includes(
                    board.grid[ctxMenu.row][ctxMenu.col].state,
                  ),
                  action: () => openCell(ctxMenu.row, ctxMenu.col),
                },
                {
                  label: "Award Team",
                  disabled:
                    !activeTeamId ||
                    ["claimed", "disabled"].includes(board.grid[ctxMenu.row][ctxMenu.col].state),
                  action: () => awardCell(ctxMenu.row, ctxMenu.col, activeTeamId),
                },
                {
                  label: "Unclaim",
                  disabled: false,
                  action: () => unclaimCell(ctxMenu.row, ctxMenu.col),
                },
                {
                  label:
                    board.grid[ctxMenu.row][ctxMenu.col].state === "disabled"
                      ? "Enable"
                      : "Disable",
                  disabled: false,
                  action: () =>
                    setCellDisabled(
                      ctxMenu.row,
                      ctxMenu.col,
                      board.grid[ctxMenu.row][ctxMenu.col].state !== "disabled",
                    ),
                },
              ].map(({ label, disabled, action }) => (
                <button
                  key={label}
                  className="block w-full px-3 py-2 text-left hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={disabled}
                  onClick={() => { action(); setCtxMenu(null); }}
                >
                  {label}
                </button>
              ))}
              <button
                className="block w-full px-3 py-2 text-left text-slate-500 hover:bg-slate-100"
                onClick={() => setCtxMenu(null)}
              >
                Close
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
