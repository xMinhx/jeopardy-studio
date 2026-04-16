import { useBoardStore } from "@/store/boardStore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTimer } from "@/hooks/useTimer";
import { useTimerAudio } from "@/hooks/useTimerAudio";
import { loadBoardPreset } from "@/services/defaultPreset";

const FINAL_LOCK_MS = 2500;

export default function Control() {
  const {
    teams,
    board,
    setAll,
    updateScore,
    claimCellCorrect,
    revealAndLockCell,
    markCellIncorrect,
    unclaimCell,
    setCellDisabled,
    setTeamName,
    addTeam,
    removeTeam,
    setTeamColor,
    moveTeam,
    moveTeamTo,
    setCellValue,
    setCellQuestion,
    rebuildBoard,
  } = useBoardStore();
  const [activeTeamId, setActiveTeamId] = useState<string | undefined>(
    () => teams[0]?.id,
  );
  const [timer, t] = useTimer(30000);
  // Use your provided assets (ensure they are under public/assets for dev)
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
  const boardRef = useRef<HTMLDivElement | null>(null);
  const pausedDisplayMsRef = useRef(timer.durationMs);

  useEffect(() => {
    setRows(board.rows);
    setCols(board.cols);
  }, [board.rows, board.cols]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const preset = await loadBoardPreset();
      if (!preset || cancelled) return;
      const currentTeams = useBoardStore.getState().teams;
      setAll({ teams: currentTeams, board: preset });
    })();
    return () => {
      cancelled = true;
    };
  }, [setAll]);

  // Mirror timer ticks to Display (and keep last meaningful display value for paused state)
  useEffect(() => {
    if (!window.api?.sendTimerTick) return;
    if (timer.remainingMs > 0) pausedDisplayMsRef.current = timer.remainingMs;
    const ended = !timer.running && timer.remainingMs <= 0;
    if (ended) pausedDisplayMsRef.current = 0;
    const displayMs =
      timer.running || timer.remainingMs > 0
        ? timer.remainingMs
        : (pausedDisplayMsRef.current ?? 0);
    window.api.sendTimerTick(
      timer.remainingMs,
      timer.durationMs,
      timer.running,
      ended,
      displayMs,
    );
  }, [timer.remainingMs, timer.durationMs, timer.running]);
  // Wire audio to timer controls and volume
  useEffect(() => {
    setAudioVolume(timer.muted ? 0 : timer.volume);
  }, [setAudioVolume, timer.volume, timer.muted]);

  // Broadcast state changes to main for Display window
  const snapshot = useMemo(() => ({ teams, board }), [teams, board]);
  useEffect(() => {
    if (window.api?.updateState) window.api.updateState(snapshot);
  }, [snapshot]);

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

  // Keyboard shortcuts for timer and quick presets
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || (e as any).isComposing)
        return;
      if (e.code === "Space") {
        e.preventDefault();
        if (timer.running) {
          if (timer.remainingMs > FINAL_LOCK_MS) handlePause();
        } else {
          timer.remainingMs === 0
            ? handleStart(timer.durationMs)
            : handleResume();
        }
      }
      if (e.key.toLowerCase() === "r") handleReset();
      const presets: Record<string, number> = {
        "1": 10000,
        "2": 15000,
        "3": 20000,
        "4": 30000,
        "5": 45000,
        "6": 60000,
      };
      if (e.key in presets) {
        handleStart(presets[e.key]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    timer.running,
    timer.remainingMs,
    timer.durationMs,
    handlePause,
    handleResume,
    handleStart,
    handleReset,
  ]);

  const pauseLocked =
    timer.running &&
    timer.remainingMs > 0 &&
    timer.remainingMs <= FINAL_LOCK_MS;
  const visibleCategories = board.categories.slice(0, board.cols);
  const visibleRows = board.grid
    .slice(0, board.rows)
    .map((row) => row.slice(0, board.cols));
  const activePrompt = useMemo(() => {
    for (let row = 0; row < visibleRows.length; row += 1) {
      for (let col = 0; col < visibleRows[row].length; col += 1) {
        const cell = visibleRows[row][col];
        if (cell.state === "locked" || cell.state === "open") {
          return {
            row,
            col,
            cell,
            category: visibleCategories[col] ?? `Cat ${col + 1}`,
            lockedTeam: teams.find((team) => team.id === cell.lockedTeamId),
          };
        }
      }
    }
    return null;
  }, [teams, visibleCategories, visibleRows]);
  const pauseButtonDisabled = timer.running
    ? pauseLocked
    : timer.remainingMs <= 0;
  const pauseTooltip = timer.running
    ? pauseLocked
      ? "Pause disabled in final 2.5s to protect ending audio"
      : "Pause + play ending cue"
    : timer.remainingMs <= 0
      ? "Timer finished"
      : "Resume timer";
  return (
    <div className="p-6 grid gap-4 text-slate-900">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Control Window</h1>
        <div className="text-sm text-slate-500">view=control</div>
      </header>
      <section className="rounded border p-4">
        <h2 className="font-medium mb-3">Timer</h2>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Duration</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="w-24 rounded border px-2 py-1 text-sm"
              value={durationInput}
              onChange={(e) =>
                setDurationInput(e.target.value.replace(/[^0-9]/g, ""))
              }
              onBlur={() => {
                const v = Math.max(1, Number(durationInput || "0"));
                const rounded = Math.max(15, Math.round(v / 15) * 15);
                t.setDuration(rounded * 1000);
                setDurationInput(String(rounded));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
            <span className="text-sm text-slate-600">sec</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded bg-slate-100 px-3 py-1"
              onClick={() => {
                const rounded = Math.max(
                  15000,
                  Math.round(timer.durationMs / 15000) * 15000,
                );
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
                if (pauseButtonDisabled) return;
                timer.running ? handlePause() : handleResume();
              }}
            >
              {timer.running ? "Pause" : "Resume"}
            </button>
            <button
              className="rounded bg-slate-100 px-3 py-1"
              onClick={handleReset}
            >
              Reset
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Presets:</span>
            {[15, 30, 45, 60, 75, 90].map((s) => (
              <button
                key={s}
                className="rounded bg-slate-100 px-2 py-1 text-sm"
                onClick={() => {
                  t.setDuration(s * 1000);
                  setDurationInput(String(s));
                }}
              >
                {s}s
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-4">
          <div className="min-w-[110px] text-2xl font-semibold tabular-nums">
            {Math.floor(timer.remainingMs / 1000)}s
          </div>
          <div className="h-2 flex-1 overflow-hidden rounded bg-slate-200">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{
                width: `${Math.max(0, (1 - (timer.durationMs - timer.remainingMs) / timer.durationMs) * 100)}%`,
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
            <button
              className="rounded bg-slate-100 px-2 py-1 text-sm"
              onClick={t.toggleMute}
            >
              {timer.muted ? "Unmute" : "Mute"}
            </button>
            <button
              className="rounded bg-slate-100 px-2 py-1 text-sm"
              onClick={() => {
                void resetAudio().then(() => startAudio(2000));
              }}
            >
              Preview
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            className="rounded bg-slate-100 px-3 py-1"
            onClick={() => {
              window.api?.showTimer?.();
            }}
          >
            Show Timer
          </button>
          <button
            className="rounded bg-slate-100 px-3 py-1"
            onClick={() => {
              window.api?.showScoreboard?.();
            }}
          >
            Show Scoreboard
          </button>
        </div>
      </section>
      <section className="rounded border p-4">
        <h2 className="font-medium mb-3">Teams</h2>
        <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
          <div className="text-slate-600">Click a team to select</div>
          <button
            className="rounded bg-slate-100 px-3 py-1"
            onClick={() => {
              const used = new Set(teams.map((t) => t.id));
              const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
              const id =
                letters.find((ch) => !used.has(ch)) || `T${teams.length + 1}`;
              const palette = [
                "#ef4444",
                "#3b82f6",
                "#10b981",
                "#f59e0b",
                "#8b5cf6",
                "#ec4899",
              ];
              const color = palette[teams.length % palette.length];
              addTeam({
                id,
                name: `Team ${id}`,
                color,
                score: 0,
                abbr: id.substring(0, 2),
              });
              setActiveTeamId(id);
            }}
          >
            + Add Team
          </button>
        </div>
        <div className="grid gap-2">
          {teams.map((t, idx) => (
            <div
              key={t.id}
              className={`flex items-center justify-between rounded border p-2 ${activeTeamId === t.id ? "ring-2 ring-emerald-500" : ""} hover:bg-slate-50`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", t.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const draggedId = e.dataTransfer.getData("text/plain");
                if (draggedId)
                  useBoardStore.getState().moveTeamTo(draggedId, idx);
              }}
              onClick={() => setActiveTeamId(t.id)}
            >
              <div className="flex items-center gap-3">
                <span className="cursor-grab select-none px-1 text-slate-400">
                  ::
                </span>
                <input
                  type="color"
                  className="h-6 w-8 cursor-pointer rounded border p-0"
                  value={t.color}
                  onChange={(e) => setTeamColor(t.id, e.target.value)}
                  title="Team color"
                />
                <input
                  className="w-44 rounded border px-2 py-1 text-sm"
                  value={t.name}
                  onChange={(e) => setTeamName(t.id, e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded bg-slate-100 px-3 py-1.5"
                  onClick={() => updateScore(t.id, -100)}
                >
                  -100
                </button>
                <div className="tabular-nums w-20 text-right text-base">
                  {t.score}
                </div>
                <button
                  className="rounded bg-slate-100 px-3 py-1.5"
                  onClick={() => updateScore(t.id, 100)}
                >
                  +100
                </button>
                <div className="ml-1 flex items-center gap-1">
                  <button
                    className="rounded bg-slate-100 px-2 py-1 text-sm"
                    title="Move up"
                    disabled={teams[0]?.id === t.id}
                    onClick={() => moveTeam(t.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    className="rounded bg-slate-100 px-2 py-1 text-sm"
                    title="Move down"
                    disabled={teams[teams.length - 1]?.id === t.id}
                    onClick={() => moveTeam(t.id, 1)}
                  >
                    ↓
                  </button>
                </div>
                <button
                  className="ml-2 rounded bg-red-50 px-2 py-1 text-sm text-red-600 hover:bg-red-100"
                  title="Remove team"
                  onClick={() => {
                    if (teams.length <= 1) {
                      alert("At least one team is required.");
                      return;
                    }
                    if (
                      confirm(
                        `Remove ${t.name}? Owned cells will be unclaimed.`,
                      )
                    ) {
                      removeTeam(t.id);
                      // set next active team if needed
                      const next = useBoardStore.getState().teams[0]?.id;
                      if (activeTeamId === t.id) setActiveTeamId(next);
                    }
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded border p-4">
        <h2 className="font-medium mb-3">Board</h2>
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
              value={String(base)}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, "");
                setBase(v === "" ? (NaN as any) : Number(v));
              }}
              onBlur={(e) => {
                if (isNaN(base as any)) setBase(100);
              }}
            />
          </label>
          <button
            className="rounded bg-slate-100 px-3 py-1"
            onClick={() => {
              const nextRows = Math.max(
                1,
                Math.min(10, Math.floor(Number(rows) || 0)),
              );
              const nextCols = Math.max(
                1,
                Math.min(10, Math.floor(Number(cols) || 0)),
              );
              const nextBase = isNaN(base as any) ? 100 : base;
              setRows(nextRows);
              setCols(nextCols);
              rebuildBoard(nextRows, nextCols, nextBase);
            }}
          >
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
        {activePrompt && !editMode && (
          <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-500">
                  {activePrompt.cell.state === "locked"
                    ? "Active Question"
                    : "Open Question"}
                </div>
                <div className="text-sm text-slate-600">
                  {activePrompt.category} • {activePrompt.cell.value} points
                </div>
                <div className="max-w-3xl text-lg font-semibold leading-relaxed text-slate-900">
                  {activePrompt.cell.question || "No question set"}
                </div>
                <div className="text-sm text-slate-600">
                  {activePrompt.lockedTeam
                    ? `Locked to ${activePrompt.lockedTeam.name}`
                    : "Open for another team to answer"}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() =>
                    claimCellCorrect(activePrompt.row, activePrompt.col)
                  }
                  disabled={activePrompt.cell.state !== "locked"}
                >
                  Mark Correct
                </button>
                <button
                  className="rounded bg-amber-500 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() =>
                    markCellIncorrect(activePrompt.row, activePrompt.col)
                  }
                  disabled={activePrompt.cell.state !== "locked"}
                >
                  Mark Incorrect
                </button>
                <button
                  className="rounded bg-slate-200 px-3 py-2 text-sm font-medium text-slate-800"
                  onClick={() =>
                    unclaimCell(activePrompt.row, activePrompt.col)
                  }
                >
                  Reset Cell
                </button>
              </div>
            </div>
          </div>
        )}
        <div
          ref={boardRef}
          className={`relative grid gap-1`}
          style={{
            gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))`,
          }}
          onClick={() => setCtxMenu(null)}
        >
          {visibleCategories.map((c, i) => (
            <input
              key={i}
              className="p-2 text-center text-sm font-medium text-slate-700 rounded border"
              value={c}
              onChange={(e) =>
                useBoardStore.getState().setCategoryTitle(i, e.target.value)
              }
              aria-label={`Category ${i + 1}`}
            />
          ))}
          {visibleRows.map((row, r) =>
            row.map((cell, c) => {
              const owner = teams.find((t) => t.id === cell.ownerTeamId);
              const lockedTeam = teams.find((t) => t.id === cell.lockedTeamId);
              const isLocked = cell.state === "locked";
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
                        : isLocked
                          ? "bg-amber-50 ring-2 ring-amber-300"
                          : isOpen
                            ? "bg-blue-50 ring-2 ring-blue-200"
                            : "hover:bg-slate-50"
                  }`}
                  onClick={() => {
                    if (editMode) return;
                    if (!activeTeamId) return;
                    if (cell.state === "claimed" || cell.state === "disabled")
                      return;
                    revealAndLockCell(r, c, activeTeamId);
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
                        onChange={(e) =>
                          setCellValue(r, c, Number(e.target.value))
                        }
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
                      {(isLocked || isOpen || isClaimed || isDisabled) && (
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          {isLocked
                            ? `Locked: ${lockedTeam?.name ?? "Team"}`
                            : isOpen
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
                  {/* inline actions removed; use context menu */}
                </div>
              );
            }),
          )}
          {ctxMenu && (
            <div
              className="fixed z-50 min-w-[140px] rounded border bg-white shadow"
              style={{ left: ctxMenu.x, top: ctxMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="block w-full px-3 py-2 text-left hover:bg-slate-100"
                onClick={() => {
                  if (activeTeamId) {
                    revealAndLockCell(ctxMenu.row, ctxMenu.col, activeTeamId);
                  }
                  setCtxMenu(null);
                }}
                disabled={
                  !activeTeamId ||
                  ["claimed", "disabled"].includes(
                    board.grid[ctxMenu.row][ctxMenu.col].state,
                  )
                }
              >
                Reveal + Lock
              </button>
              <button
                className="block w-full px-3 py-2 text-left hover:bg-slate-100"
                onClick={() => {
                  claimCellCorrect(ctxMenu.row, ctxMenu.col);
                  setCtxMenu(null);
                }}
                disabled={
                  board.grid[ctxMenu.row][ctxMenu.col].state !== "locked"
                }
              >
                Mark Correct
              </button>
              <button
                className="block w-full px-3 py-2 text-left hover:bg-slate-100"
                onClick={() => {
                  markCellIncorrect(ctxMenu.row, ctxMenu.col);
                  setCtxMenu(null);
                }}
                disabled={
                  board.grid[ctxMenu.row][ctxMenu.col].state !== "locked"
                }
              >
                Mark Incorrect
              </button>
              <button
                className="block w-full px-3 py-2 text-left hover:bg-slate-100"
                onClick={() => {
                  unclaimCell(ctxMenu.row, ctxMenu.col);
                  setCtxMenu(null);
                }}
              >
                Unclaim
              </button>
              <button
                className="block w-full px-3 py-2 text-left hover:bg-slate-100"
                onClick={() => {
                  setCellDisabled(
                    ctxMenu.row,
                    ctxMenu.col,
                    board.grid[ctxMenu.row][ctxMenu.col].state !== "disabled",
                  );
                  setCtxMenu(null);
                }}
              >
                {board.grid[ctxMenu.row][ctxMenu.col].state === "disabled"
                  ? "Enable"
                  : "Disable"}
              </button>
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
