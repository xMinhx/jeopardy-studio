import { useBoardStore } from "@/store/boardStore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTimer } from "@/hooks/useTimer";
import { useTimerAudio } from "@/hooks/useTimerAudio";
import { loadBoardPreset } from "@/services/defaultPreset";
import { buildTeam } from "@/features/teams/teamFactory";
import { TeamRow } from "@/features/teams/components/TeamRow";
import { getActiveQuestions } from "@/features/board/boardUtils";
import { useGameAudio } from "@/hooks/useGameAudio";
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
    setCellDailyDouble,
    resetRound,
    resetAll,
    dailyDouble,
    setDailyDoubleWager,
    setDailyDoubleTeam,
    confirmWager,
    cancelDailyDouble,
    settings,
    setVolume: setGlobalVolume,
    finalJeopardy,
    startFinalJeopardy,
    setFinalJeopardyCategory,
    setFinalJeopardyQuestion,
    setFinalJeopardyWager,
    advanceFinalJeopardy,
    cancelFinalJeopardy,
  } = useBoardStore();

  const { playScoreUp, playScoreDown, playDailyDouble, playQuestionReveal, playFinalJeopardy } = useGameAudio();

  // Timer state
  const [timer, t] = useTimer(30000);
  const {
    start: startAudio,
    pause: pauseAudio,
    resume: resumeAudio,
    reset: resetAudio,
    setVolume: setAudioVolume,
  } = useTimerAudio("/assets/timer_15s_sfx.mp3", "/assets/timer_ending_sfx.mp3");

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

  const pausedDisplayMsRef = useRef(timer.durationMs);

  // ── Sync board dimensions when rebuilt ────────────────────────────────────
  useEffect(() => {
    setRows((current) => (current !== board.rows ? board.rows : current));
    setCols((current) => (current !== board.cols ? board.cols : current));
  }, [board.rows, board.cols]);



  // ── Load preset on mount if board is empty ────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const isBoardEmpty = board.grid.every((row) =>
      row.every((cell) => !cell.question)
    );

    if (isBoardEmpty) {
      void (async () => {
        const preset = await loadBoardPreset();
        if (preset && !cancelled) {
          setAll({ teams: useBoardStore.getState().teams, board: preset });
        }
      })();
    }
    return () => {
      cancelled = true;
    };
  }, []); // Only check on mount

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
    void setAudioVolume(timer.muted ? 0 : settings.volume);
    t.setVolume(settings.volume);
  }, [setAudioVolume, settings.volume, timer.muted]);

  // ── Broadcast board + team state to Display window ────────────────────────
  const snapshot = useMemo(() => ({ teams, board, dailyDouble, finalJeopardy, settings }), [teams, board, dailyDouble, finalJeopardy, settings]);
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

  const handleOpenCell = (r: number, c: number) => {
    const cell = board.grid[r][c];
    if (cell.isDailyDouble) {
      playDailyDouble();
    } else {
      playQuestionReveal();
    }
    openCell(r, c);
  };

  const handleAward = (r: number, col: number, teamId: string) => {
    playScoreUp();
    awardCell(r, col, teamId);
  };

  const handlePenalize = (r: number, col: number, teamId: string) => {
    playScoreDown();
    penalizeTeam(r, col, teamId);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden text-slate-900">
      <div className="h-8 drag-region flex items-center px-4 shrink-0 bg-white/50 border-b border-slate-100/50">
        <span className="text-[10px] uppercase tracking-widest text-slate-400 font-medium">Jeopardy Control</span>
      </div>
      <div className="p-6 pt-2 grid gap-4 overflow-y-auto flex-1">
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
              value={settings.volume}
              onChange={(e) => setGlobalVolume(Number(e.target.value))}
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
            <div className="h-4 w-[1px] bg-slate-200 mx-1" />
            <button
              className="rounded bg-red-50 px-3 py-1 text-sm text-red-600 hover:bg-red-100"
              onClick={() => {
                if (window.confirm("Reset the current round? This will clear all scores and hide all questions. Questions and categories will be kept.")) {
                  resetRound();
                }
              }}
            >
              Reset Round
            </button>
            <button
              className="rounded bg-red-50 px-3 py-1 text-sm text-red-600 hover:bg-red-100"
              onClick={() => {
                if (window.confirm("Full Game Reset? This will reset all teams to defaults, set scores to 0, and hide all questions. Questions and categories will be kept.")) {
                  resetAll();
                }
              }}
            >
              Full Reset
            </button>
          </div>
        </div>
        
        {/* Final Jeopardy Control Section */}
        <section className="mb-6 rounded-xl border-2 border-indigo-200 bg-indigo-50/50 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-black uppercase tracking-widest text-indigo-900">Final Jeopardy</h3>
            <div className="flex gap-2">
              {!finalJeopardy.isActive ? (
                <button
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 shadow-md transition-all"
                  onClick={startFinalJeopardy}
                >
                  Initiate Final Round
                </button>
              ) : (
                <>
                  <button
                    className="rounded-lg bg-indigo-100 px-4 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-200"
                    onClick={() => {
                      if (finalJeopardy.stage === "wager") {
                        playFinalJeopardy();
                      }
                      advanceFinalJeopardy();
                    }}
                  >
                    {finalJeopardy.stage === "category" ? "Next: Wagers" :
                     finalJeopardy.stage === "wager" ? "Next: Reveal Question" :
                     finalJeopardy.stage === "question" ? "Next: Resolution" : "Reset Stage"}
                  </button>
                  <button
                    className="rounded-lg bg-red-100 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-200"
                    onClick={() => { if(confirm("Cancel Final Jeopardy?")) cancelFinalJeopardy(); }}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-indigo-400">FJ Category</label>
              <input
                className="w-full rounded-lg border border-indigo-200 px-3 py-2 text-sm"
                value={finalJeopardy.category}
                onChange={(e) => setFinalJeopardyCategory(e.target.value)}
                placeholder="Enter category..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-indigo-400">FJ Question</label>
              <textarea
                className="w-full rounded-lg border border-indigo-200 px-3 py-2 text-sm"
                value={finalJeopardy.question}
                onChange={(e) => setFinalJeopardyQuestion(e.target.value)}
                placeholder="Enter question..."
                rows={1}
              />
            </div>
          </div>

          {finalJeopardy.stage === "wager" && (
            <div className="mt-6 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="text-xs font-bold uppercase tracking-widest text-indigo-800">Team Wagers</label>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {teams.map((t) => (
                  <div key={t.id} className="flex flex-col rounded-lg border border-indigo-200 bg-white p-3 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                      <span className="text-xs font-bold text-slate-700">{t.name}</span>
                      <span className="ml-auto text-[10px] font-mono text-slate-400">{t.score} pts</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
                      <input
                        type="number"
                        className="w-full rounded border border-slate-200 py-1.5 pl-5 pr-2 text-sm font-bold"
                        value={finalJeopardy.wagers[t.id] ?? 0}
                        onChange={(e) => setFinalJeopardyWager(t.id, Number(e.target.value))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {finalJeopardy.stage === "resolution" && (
            <div className="mt-6 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="text-xs font-bold uppercase tracking-widest text-emerald-800">Final Resolution</label>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {teams.map((t) => (
                  <div key={t.id} className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center gap-2 border-b px-3 py-2 bg-slate-50">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                      <span className="text-xs font-bold text-slate-700">{t.name}</span>
                      <span className="ml-auto text-[10px] font-mono font-bold text-indigo-600">
                        Wager: ${finalJeopardy.wagers[t.id] ?? 0}
                      </span>
                    </div>
                    <div className="flex divide-x">
                      <button
                        className="flex-1 py-3 text-xs font-black text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 transition-all"
                        onClick={() => {
                          const wager = finalJeopardy.wagers[t.id] ?? 0;
                          useBoardStore.getState().updateScore(t.id, wager);
                          playScoreUp();
                        }}
                      >
                        CORRECT
                      </button>
                      <button
                        className="flex-1 py-3 text-xs font-black text-rose-500 hover:bg-rose-50 active:bg-rose-100 transition-all"
                        onClick={() => {
                          const wager = finalJeopardy.wagers[t.id] ?? 0;
                          useBoardStore.getState().updateScore(t.id, -wager);
                          playScoreDown();
                        }}
                      >
                        INCORRECT
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-2 text-center">
                <button
                  className="text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors"
                  onClick={cancelFinalJeopardy}
                >
                  End Final Jeopardy Round
                </button>
              </div>
            </div>
          )}
        </section>

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

        {/* Daily Double Wager Panel */}
        {dailyDouble.stage === "wager" && (
          <div className="mb-4 rounded-xl border-2 border-amber-400 bg-amber-50 p-6 shadow-md animate-in fade-in zoom-in duration-300">
            <div className="flex flex-col gap-6">
              <div className="text-center">
                <h3 className="text-lg font-black uppercase tracking-[0.4em] text-amber-600">
                  Daily Double!
                </h3>
                <p className="mt-1 text-sm text-amber-700">
                  Select the team and their wager before revealing the question.
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-widest text-amber-800">
                    Which team is playing?
                  </label>
                  <div className="grid gap-2">
                    {teams.map((t) => (
                      <button
                        key={t.id}
                        className={`flex items-center justify-between rounded-lg border px-4 py-2 transition-all ${
                          dailyDouble.teamId === t.id
                            ? "border-amber-500 bg-amber-200 ring-2 ring-amber-400"
                            : "border-amber-200 bg-white hover:bg-amber-100"
                        }`}
                        onClick={() => setDailyDoubleTeam(t.id)}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: t.color }}
                          />
                          <span className="font-bold">{t.name}</span>
                        </div>
                        <span className="text-sm font-mono">{t.score} pts</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-widest text-amber-800">
                    What is the wager?
                  </label>
                  <div className="flex flex-col gap-4">
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-amber-600">
                        $
                      </span>
                      <input
                        type="number"
                        className="w-full rounded-xl border-2 border-amber-200 bg-white py-4 pl-10 pr-4 text-3xl font-black text-amber-900 focus:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-500/20"
                        value={dailyDouble.wager}
                        onChange={(e) => setDailyDoubleWager(Number(e.target.value))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        className="rounded-lg bg-amber-200 py-2 text-xs font-bold uppercase hover:bg-amber-300"
                        onClick={() => {
                          const team = teams.find((t) => t.id === dailyDouble.teamId);
                          const max = Math.max(1000, team?.score || 0);
                          setDailyDoubleWager(max);
                        }}
                      >
                        All In / Max
                      </button>
                      <button
                        className="rounded-lg bg-amber-200 py-2 text-xs font-bold uppercase hover:bg-amber-300"
                        onClick={() => {
                          const { row, col } = dailyDouble.cellPosition!;
                          setDailyDoubleWager(board.grid[row][col].value);
                        }}
                      >
                        Face Value
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  className="flex-1 rounded-xl bg-amber-500 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-amber-500/30 hover:bg-amber-600 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
                  disabled={!dailyDouble.teamId || dailyDouble.wager < 5}
                  onClick={confirmWager}
                >
                  Reveal Question
                </button>
                <button
                  className="rounded-xl border-2 border-amber-300 bg-transparent px-6 py-4 text-sm font-bold uppercase tracking-widest text-amber-700 hover:bg-amber-100"
                  onClick={cancelDailyDouble}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

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
                {teams.map((team) => {
                  const isPlayingDD = dailyDouble.stage === "question" && dailyDouble.teamId === team.id;
                  const otherTeamPlayingDD = dailyDouble.stage === "question" && dailyDouble.teamId !== team.id;
                  
                  return (
                    <div
                      key={team.id}
                      className={`flex flex-col overflow-hidden rounded-lg border transition-all ${
                        isPlayingDD ? "border-amber-400 ring-2 ring-amber-400 shadow-md" : "border-slate-200"
                      } ${otherTeamPlayingDD ? "opacity-40 grayscale" : "bg-white"}`}
                    >
                      <div className={`flex items-center justify-between gap-2 border-b px-3 py-1.5 ${isPlayingDD ? "bg-amber-50" : "bg-slate-50"}`}>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: team.color }}
                          />
                          <span className="text-xs font-bold truncate text-slate-700">
                            {team.name}
                          </span>
                        </div>
                        {isPlayingDD && (
                          <span className="text-[9px] font-black uppercase text-amber-600 tracking-tighter">Daily Double</span>
                        )}
                      </div>
                      <div className="flex divide-x border-t-0">
                        <button
                          className="flex-1 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 transition-colors disabled:pointer-events-none"
                          disabled={otherTeamPlayingDD}
                          onClick={() => handleAward(activePrompt.row, activePrompt.col, team.id)}
                        >
                          AWARD {isPlayingDD && `+${dailyDouble.wager}`}
                        </button>
                        <button
                          className="flex-1 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 transition-colors disabled:pointer-events-none"
                          disabled={otherTeamPlayingDD}
                          onClick={() => handlePenalize(activePrompt.row, activePrompt.col, team.id)}
                        >
                          PENALIZE {isPlayingDD && `-${dailyDouble.wager}`}
                        </button>
                      </div>
                    </div>
                  );
                })}
                <button
                  className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 py-3 text-xs font-bold text-slate-400 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-500 transition-all disabled:opacity-30"
                  disabled={dailyDouble.stage === "question"}
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
                    handleOpenCell(r, c);
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
                      <label className="flex items-center justify-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-tighter bg-amber-50 rounded py-1 border border-amber-200 cursor-pointer hover:bg-amber-100">
                        <input
                          type="checkbox"
                          className="w-3 h-3 accent-amber-500"
                          checked={!!cell.isDailyDouble}
                          onChange={(e) => setCellDailyDouble(r, c, e.target.checked)}
                        />
                        Daily Double
                      </label>
                    </div>
                  ) : (
                    <div className="grid gap-1">
                      <div className="relative inline-block mx-auto">
                        <div className="text-xl font-semibold">{cell.value}</div>
                        {cell.isDailyDouble && (
                          <div className="absolute -top-1 -right-4 text-[10px] text-amber-500 font-black">★</div>
                        )}
                      </div>
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

        </div>
      </section>
      </div>
    </div>
  );
}
