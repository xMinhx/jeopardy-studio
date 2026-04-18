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
import { AnimatedNumber } from "@/features/common/components/AnimatedNumber";

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
    resolveFinalJeopardyTeam,
    cancelFinalJeopardy,
  } = useBoardStore();

  const { playScoreUp, playScoreDown, playDailyDouble, playQuestionReveal, playFinalJeopardy, playWinnerReveal } = useGameAudio();

  useEffect(() => {
    if (finalJeopardy.stage === "resolution" && finalJeopardy.resolvedTeams.length === teams.length && teams.length > 0) {
      const t = setTimeout(() => playWinnerReveal(), 1000);
      return () => clearTimeout(t);
    }
  }, [finalJeopardy.stage, finalJeopardy.resolvedTeams.length, teams.length, playWinnerReveal]);

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
      if (e.key === "F11") {
        e.preventDefault();
        window.api?.toggleFullscreen?.('control');
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
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "var(--surface-base)", color: "var(--text-primary)" }}>
      {/* Titlebar */}
      <div className="h-9 drag-region shrink-0 flex items-center justify-between px-6" style={{ background: "var(--surface-panel)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-2">
          <span style={{ color: "var(--gold)", fontSize: "0.55rem", fontWeight: 900, letterSpacing: "0.25em" }}>◈</span>
          <span className="studio-label">Jeopardy Studio</span>
          <span className="studio-label" style={{ color: "var(--border-strong)" }}>—</span>
          <span className="studio-label">Host Control</span>
        </div>
        <button
          className="no-drag studio-label hover:text-[--text-secondary] transition-colors"
          onClick={() => window.api?.toggleFullscreen?.('control')}
          title="Toggle fullscreen (F11)"
        >
          F11
        </button>
      </div>
      <div className="px-6 py-5 grid gap-5 overflow-y-auto flex-1 custom-scrollbar">
        <header className="flex items-center justify-between">
          <h1 className="font-serif text-3xl" style={{ color: "var(--gold)", textShadow: "0 0 30px var(--gold-glow)" }}>Host Control</h1>
          <div className="flex items-center gap-3">
            <button className="btn-neutral text-xs py-1.5 px-3" onClick={() => window.api?.toggleFullscreen?.('display')}>Fullscreen Display</button>
            <span className="studio-label">view=control</span>
          </div>
        </header>

      {/* ── Timer section ── */}
      <section className="studio-card p-5">
        <h2 className="section-title mb-4">Timer</h2>
        <div className="mb-4 flex flex-wrap items-center gap-4">
          {/* Duration input */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-sans text-[--text-secondary]">Duration</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="studio-input w-24"
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
            <span className="text-sm text-[--text-secondary]">sec</span>
          </div>

          {/* Play/Pause/Reset */}
          <div className="flex items-center gap-2">
            <button
              className="btn-gold"
              onClick={() => {
                const rounded = Math.max(15000, Math.round(timer.durationMs / 15000) * 15000);
                handleStart(rounded);
                window.api?.showTimer?.();
              }}
              disabled={timer.running && timer.remainingMs > 0}
            >
              ▶ Start
            </button>
            <button
              className="btn-neutral"
              disabled={pauseButtonDisabled}
              title={pauseTooltip}
              onClick={() => {
                if (!pauseButtonDisabled) {
                  if (timer.running) handlePause(); else handleResume();
                }
              }}
            >
              {timer.running ? "⏸ Pause" : "▶ Resume"}
            </button>
            <button className="btn-neutral" onClick={handleReset}>↺ Reset</button>
          </div>

          {/* Presets */}
          <div className="flex items-center gap-1.5">
            <span className="studio-label mr-1">Presets</span>
            {TIMER_PRESETS_SEC.map((s) => (
              <button
                key={s}
                className="btn-icon"
                style={{ width: "auto", padding: "0.25rem 0.6rem", fontSize: "0.7rem", height: "1.75rem" }}
                onClick={() => { t.setDuration(s * 1000); setDurationInput(String(s)); }}
              >
                {s}s
              </button>
            ))}
          </div>
        </div>

        {/* Progress bar + volume */}
        <div className="mt-6 flex items-center gap-4">
          <div className="min-w-[110px] text-3xl font-serif text-[--gold] text-data tabular-nums">
            {Math.floor(timer.remainingMs / 1000)}s
          </div>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-[--surface-overlay] border border-[--border-subtle]">
            <div
              className="h-full bg-[--gold] transition-all"
              style={{
                width: `${Math.max(0, (timer.remainingMs / timer.durationMs) * 100)}%`,
              }}
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-[--text-secondary]">Vol</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              className="accent-[--gold]"
              value={settings.volume}
              onChange={(e) => setGlobalVolume(Number(e.target.value))}
            />
            <button className="px-3 py-1 rounded text-xs font-bold bg-[--surface-overlay] border border-[--border-subtle] text-[--text-secondary]" onClick={t.toggleMute}>
              {timer.muted ? "Unmute" : "Mute"}
            </button>
            <button
              className="px-3 py-1 rounded text-xs font-bold bg-[--surface-overlay] border border-[--border-subtle] text-[--text-secondary]"
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
        <div className="mt-5 flex items-center gap-2">
          <button className="btn-neutral text-xs" onClick={() => window.api?.showTimer?.()}>Show Timer</button>
          <button className="btn-neutral text-xs" onClick={() => window.api?.showScoreboard?.()}>Show Scoreboard</button>
          <button className="btn-ghost text-xs" onClick={() => window.api?.toggleFullscreen?.('display')}>⛶ Fullscreen Display</button>
        </div>
      </section>

      {/* ── Teams section ── */}
      <section className="studio-card p-5">
        <h2 className="section-title mb-4">Teams</h2>
        <div className="mb-4 flex items-center justify-between text-sm text-[--text-secondary]">
          <div>Click a team to select it as the active team</div>
          <button className="btn-gold" onClick={handleAddTeam}>
            + Add Team
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
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
      <section className="studio-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="section-title">Board</h2>
          <div className="flex gap-2">
            <button className="btn-neutral text-xs py-1.5"
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
            >↑ Import</button>
            <button className="btn-neutral text-xs py-1.5" onClick={() => void window.api?.exportBoard?.({ teams, board })}>↓ Export</button>
            <div className="h-6 w-px mx-1" style={{ background: "var(--border-strong)" }} />
            <button className="btn-danger text-xs py-1.5"
              onClick={() => { if (window.confirm("Reset the current round? Scores cleared, questions hidden.")) resetRound(); }}
            >Reset Round</button>
            <button className="btn-danger text-xs py-1.5"
              onClick={() => { if (window.confirm("Full Game Reset? All scores and states cleared.")) resetAll(); }}
            >Full Reset</button>
          </div>
        </div>
        
        {/* Final Jeopardy Control Section */}
        <section className="mb-6 rounded-xl border p-5" style={{ borderColor: "var(--border-gold)", background: "var(--surface-overlay)", boxShadow: "0 0 24px var(--gold-subtle)" }}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <span style={{ color: "var(--gold)", fontSize: "0.7rem" }}>★</span>
              <h3 className="font-serif text-lg" style={{ color: "var(--gold)" }}>Final Jeopardy</h3>
            </div>
            <div className="flex gap-3">
              {!finalJeopardy.isActive ? (
                <button
                  className="btn-gold"
                  onClick={() => {
                    playQuestionReveal();
                    startFinalJeopardy();
                  }}
                >
                  Initiate Final Round
                </button>
              ) : (
                <>
                  <button
                    className="px-4 py-2 rounded font-bold text-sm bg-[--surface-base] border border-[--gold] text-[--gold] hover:bg-[--surface-overlay]"
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
                    className="px-4 py-2 rounded font-bold text-sm border border-red-500/30 text-red-400 hover:bg-red-500/10"
                    onClick={() => { if(confirm("Cancel Final Jeopardy?")) cancelFinalJeopardy(); }}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="studio-label text-[--text-secondary]">FJ Category</label>
              <input
                className="studio-input w-full text-base py-2"
                value={finalJeopardy.category}
                onChange={(e) => setFinalJeopardyCategory(e.target.value)}
                placeholder="Enter category..."
              />
            </div>
            <div className="space-y-2">
              <label className="studio-label text-[--text-secondary]">FJ Question</label>
              <textarea
                className="studio-input w-full text-base py-2"
                value={finalJeopardy.question}
                onChange={(e) => setFinalJeopardyQuestion(e.target.value)}
                placeholder="Enter question..."
                rows={1}
              />
            </div>
          </div>

          {finalJeopardy.stage === "wager" && (
            <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="studio-label text-[--text-secondary]">Team Wagers</label>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {teams.map((t) => (
                  <div key={t.id} className="flex flex-col rounded-lg border border-[--border-strong] bg-[--surface-base] p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: t.color }} />
                      <span className="font-bold text-[--text-primary]">{t.name}</span>
                      <span className="ml-auto text-xs font-mono text-[--text-secondary]"><AnimatedNumber value={t.score} /> pts</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[--text-secondary] pointer-events-none select-none z-10">$</span>
                      <input
                        type="number"
                        className="studio-input w-full"
                        style={{ paddingLeft: '1.75rem' }}
                        value={(finalJeopardy.wagers[t.id] ?? 0) === 0 ? "" : finalJeopardy.wagers[t.id]}
                        max={Math.max(0, t.score)}
                        min={0}
                        onChange={(e) => {
                          const val = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                          setFinalJeopardyWager(t.id, isNaN(val) ? 0 : val);
                        }}
                      />
                      {finalJeopardy.wagers[t.id] > Math.max(0, t.score) && (
                        <div className="absolute -bottom-5 left-0 text-[10px] font-bold text-red-400 uppercase">Over Limit</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {finalJeopardy.stage === "resolution" && (
            <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="studio-label text-[--text-secondary]">Final Resolution</label>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {teams.map((t) => (
                  <div key={t.id} className="flex flex-col overflow-hidden rounded-lg border border-[--border-strong] bg-[--surface-base]">
                    <div className="flex items-center gap-3 border-b border-[--border-subtle] px-4 py-3 bg-[--surface-overlay]">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: t.color }} />
                      <span className="font-bold text-[--text-primary]">{t.name}</span>
                      <span className="ml-auto text-xs font-mono font-bold text-[--gold]">
                        Wager: ${finalJeopardy.wagers[t.id] ?? 0}
                      </span>
                    </div>
                    <div className="flex divide-x divide-[--border-subtle]">
                      <button
                        className="flex-1 py-4 text-xs font-black tracking-widest text-[#10b981] hover:bg-[#10b981]/10 active:bg-[#10b981]/20 transition-all disabled:opacity-30 disabled:grayscale"
                        disabled={finalJeopardy.resolvedTeams.includes(t.id)}
                        onClick={() => {
                          resolveFinalJeopardyTeam(t.id, true);
                          playScoreUp();
                        }}
                      >
                        CORRECT
                      </button>
                      <button
                        className="flex-1 py-4 text-xs font-black tracking-widest text-red-400 hover:bg-red-500/10 active:bg-red-500/20 transition-all disabled:opacity-30 disabled:grayscale"
                        disabled={finalJeopardy.resolvedTeams.includes(t.id)}
                        onClick={() => {
                          resolveFinalJeopardyTeam(t.id, false);
                          playScoreDown();
                        }}
                      >
                        INCORRECT
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-4 text-center">
                <button
                  className="text-sm font-bold text-[--text-muted] hover:text-[--text-primary] transition-colors"
                  onClick={cancelFinalJeopardy}
                >
                  End Final Jeopardy Round
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Board config controls */}
        <div className="mb-6 flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2 text-[--text-secondary]">
            Rows
            <input
              className="studio-input w-16"
              type="number"
              min={1}
              max={10}
              value={rows}
              onChange={(e) => setRows(Number(e.target.value))}
            />
          </label>
          <label className="flex items-center gap-2 text-[--text-secondary]">
            Cols
            <input
              className="studio-input w-16"
              type="number"
              min={1}
              max={10}
              value={cols}
              onChange={(e) => setCols(Number(e.target.value))}
            />
          </label>
          <label className="flex items-center gap-2 text-[--text-secondary]">
            Base
            <input
              className="studio-input w-24"
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
          <button className="px-4 py-2 rounded font-bold text-sm bg-[--surface-overlay] border border-[--border-strong] text-[--text-primary]" onClick={handleApplyBoardDimensions}>
            Apply
          </button>
          <label className="ml-auto flex items-center gap-2 text-[--text-secondary]">
            Edit Mode
            <input
              type="checkbox"
              className="accent-[--gold] w-4 h-4"
              checked={editMode}
              onChange={(e) => setEditMode(e.target.checked)}
            />
          </label>
        </div>

        {/* Daily Double Wager Panel */}
        {dailyDouble.stage === "wager" && (
          <div className="mb-6 rounded-xl border border-[--gold] bg-[--surface-overlay] p-6 shadow-md animate-in fade-in zoom-in duration-300">
            <div className="flex flex-col gap-8">
              <div className="text-center">
                <h3 className="text-2xl font-serif text-[--gold] uppercase tracking-widest">
                  Daily Double!
                </h3>
                <p className="mt-2 text-sm text-[--text-secondary]">
                  Select the team and their wager before revealing the question.
                </p>
              </div>

              <div className="grid gap-8 sm:grid-cols-2">
                <div className="space-y-4">
                  <label className="studio-label text-[--text-secondary]">
                    Which team is playing?
                  </label>
                  <div className="grid gap-3">
                    {teams.map((t) => (
                      <button
                        key={t.id}
                        className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-all ${
                          dailyDouble.teamId === t.id
                            ? "border-[--gold] bg-[--gold] bg-opacity-10 ring-1 ring-[--gold]"
                            : "border-[--border-strong] bg-[--surface-base] hover:bg-[--surface-overlay]"
                        }`}
                        onClick={() => setDailyDoubleTeam(t.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: t.color }}
                          />
                          <span className="font-bold text-[--text-primary]">{t.name}</span>
                        </div>
                        <span className="text-sm font-mono text-[--text-secondary]"><AnimatedNumber value={t.score} /> pts</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="studio-label text-[--text-secondary]">
                    What is the wager?
                  </label>
                  <div className="flex flex-col gap-4">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base font-bold text-[--gold] pointer-events-none select-none z-10">
                        $
                      </span>
                      <input
                        type="number"
                        className="studio-input w-full text-lg font-serif text-[--gold]"
                        style={{ paddingLeft: '1.75rem' }}
                        value={dailyDouble.wager === 0 ? "" : dailyDouble.wager}
                        max={Math.max(teams.find(team => team.id === dailyDouble.teamId)?.score || 0, 1000)}
                        min={0}
                        onChange={(e) => {
                          const val = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                          setDailyDoubleWager(isNaN(val) ? 0 : val);
                        }}
                      />
                      {dailyDouble.wager > Math.max(teams.find(t => t.id === dailyDouble.teamId)?.score || 0, 1000) && (
                        <div className="absolute -bottom-5 left-0 text-[10px] font-bold text-red-400 uppercase tracking-tighter">
                          Wager exceeds maximum allowed
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        className="px-4 py-2 rounded font-bold text-xs bg-[--surface-base] border border-[--border-strong] text-[--text-primary] hover:bg-[--surface-overlay]"
                        onClick={() => {
                          const team = teams.find((t) => t.id === dailyDouble.teamId);
                          const max = Math.max(1000, team?.score || 0);
                          setDailyDoubleWager(max);
                        }}
                      >
                        All In / Max
                      </button>
                      <button
                        className="px-4 py-2 rounded font-bold text-xs bg-[--surface-base] border border-[--border-strong] text-[--text-primary] hover:bg-[--surface-overlay]"
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

              <div className="flex items-center gap-3 pt-4 border-t border-[--border-subtle]">
                <button
                  className="flex-1 btn-gold py-4 text-sm font-bold shadow-lg shadow-[#e6b319]/20 disabled:opacity-50 disabled:pointer-events-none"
                  disabled={
                    !dailyDouble.teamId || 
                    dailyDouble.wager < 5 || 
                    dailyDouble.wager > Math.max(teams.find(t => t.id === dailyDouble.teamId)?.score || 0, 1000)
                  }
                  onClick={() => {
                    playQuestionReveal();
                    confirmWager();
                  }}
                >
                  Reveal Question
                </button>
                <button
                  className="px-6 py-4 rounded font-bold text-sm bg-[--surface-base] border border-red-500/30 text-red-400 hover:bg-red-500/10"
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
          <div className="mb-6 rounded-xl border border-[--border-strong] bg-[--surface-overlay] p-6 shadow-sm">
            <div className="flex flex-col gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="studio-label text-[--gold]">
                    Active Question
                  </div>
                  <div className="h-px flex-1 bg-[--border-subtle]" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-[--text-secondary]">
                    {activePrompt.category} • {activePrompt.cell.value} points
                  </div>
                  <button
                    className="text-xs font-medium text-[--text-muted] hover:text-[--text-primary]"
                    onClick={() => unclaimCell(activePrompt.row, activePrompt.col)}
                  >
                    Reset Cell
                  </button>
                </div>
                <div className="max-w-4xl text-2xl font-serif text-[--text-primary]">
                  {activePrompt.cell.question || "No question set"}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {teams.map((team) => {
                  const isPlayingDD = dailyDouble.stage === "question" && dailyDouble.teamId === team.id;
                  const otherTeamPlayingDD = dailyDouble.stage === "question" && dailyDouble.teamId !== team.id;
                  
                  return (
                    <div
                      key={team.id}
                      className={`flex flex-col overflow-hidden rounded-lg border transition-all ${
                        isPlayingDD ? "border-[--gold] ring-1 ring-[--gold]" : "border-[--border-strong]"
                      } ${otherTeamPlayingDD ? "opacity-30 grayscale" : "bg-[--surface-base]"}`}
                    >
                      <div className={`flex items-center justify-between gap-2 border-b border-[--border-subtle] px-3 py-2 ${isPlayingDD ? "bg-[--gold] bg-opacity-10" : "bg-[--surface-overlay]"}`}>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: team.color }}
                          />
                          <span className="text-sm font-bold truncate text-[--text-primary]">
                            {team.name}
                          </span>
                        </div>
                        {isPlayingDD && (
                          <span className="text-[10px] font-bold uppercase text-[--gold] tracking-widest">Daily Double</span>
                        )}
                      </div>
                      <div className="flex divide-x divide-[--border-subtle] border-t-0">
                        <button
                          className="flex-1 py-3 text-xs font-bold text-[#10b981] hover:bg-[#10b981]/10 transition-colors disabled:pointer-events-none"
                          disabled={otherTeamPlayingDD}
                          onClick={() => handleAward(activePrompt.row, activePrompt.col, team.id)}
                        >
                          AWARD {isPlayingDD && `+${dailyDouble.wager}`}
                        </button>
                        <button
                          className="flex-1 py-3 text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors disabled:pointer-events-none"
                          disabled={otherTeamPlayingDD}
                          onClick={() => handlePenalize(activePrompt.row, activePrompt.col, team.id)}
                        >
                          {isPlayingDD ? `-${dailyDouble.wager}` : "WRONG"}
                        </button>
                        <button
                          className="flex-1 py-3 text-[10px] font-bold text-[--text-muted] hover:text-[--text-primary] hover:bg-[--border-subtle] transition-colors disabled:pointer-events-none"
                          disabled={otherTeamPlayingDD}
                          onClick={() => penalizeTeam(activePrompt.row, activePrompt.col, team.id, 0)}
                        >
                          0 PTS
                        </button>
                      </div>
                    </div>
                  );
                })}
                <button
                  className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[--border-strong] py-3 text-xs font-bold text-[--text-muted] hover:border-[--text-secondary] hover:bg-[--surface-overlay] hover:text-[--text-primary] transition-all disabled:opacity-30"
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
          className="relative grid gap-2 mt-4"
          style={{ gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))` }}
        >
          {/* Category headers */}
          {visibleCategories.map((cat, i) => (
            <input
              key={i}
              className="w-full studio-input text-center text-[10px] sm:text-xs font-bold uppercase tracking-widest px-1 py-2"
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
                  className={`relative overflow-hidden flex flex-col rounded border border-[--border-subtle] ${editMode ? 'p-3' : 'p-4'} text-center transition ${
                    isDisabled
                      ? "bg-[--surface-base] opacity-40 border-dashed"
                      : isClaimed
                        ? "bg-[#10b981]/10 border-[#10b981]/30"
                        : isOpen
                          ? "bg-[--surface-overlay] ring-1 ring-[--gold] border-[--gold]"
                          : "bg-[--surface-base] hover:bg-[--surface-overlay] cursor-pointer"
                  }`}
                  style={{ minHeight: editMode ? '160px' : 'auto' }}
                  onClick={() => {
                    if (editMode) return;
                    if (cell.state === "claimed" || cell.state === "disabled") return;
                    handleOpenCell(r, c);
                  }}
                >
                  {editMode ? (
                    <div className="flex flex-col h-full gap-2 flex-1">
                      <input
                        className="w-full bg-transparent border-b border-[--border-strong] pb-1 text-center text-xl font-serif text-[--gold] focus:outline-none focus:border-[--gold] transition-colors"
                        type="number"
                        value={cell.value}
                        onChange={(e) => setCellValue(r, c, Number(e.target.value))}
                      />
                      <textarea
                        className="w-full flex-1 bg-transparent text-center text-xs text-[--text-primary] focus:outline-none resize-none leading-snug placeholder-[--text-muted]"
                        value={cell.question ?? ""}
                        placeholder="Question..."
                        onChange={(e) => setCellQuestion(r, c, e.target.value)}
                      />
                      <label className="flex items-center justify-center gap-1 text-[9px] font-bold text-[--gold] uppercase tracking-widest mt-auto cursor-pointer opacity-70 hover:opacity-100 transition-opacity">
                        <input
                          type="checkbox"
                          className="accent-[--gold] w-3 h-3"
                          checked={!!cell.isDailyDouble}
                          onChange={(e) => setCellDailyDouble(r, c, e.target.checked)}
                        />
                        Daily Double
                      </label>
                    </div>
                  ) : (
                    <div className="grid gap-1">
                      <div className="relative inline-block mx-auto">
                        <div className="text-2xl font-serif text-[--gold]">{cell.value}</div>
                        {cell.isDailyDouble && (
                          <div className="absolute -top-1 -right-4 text-[10px] text-[--gold] font-black">★</div>
                        )}
                      </div>
                      {(isOpen || isClaimed || isDisabled) && (
                        <div className="text-[10px] font-bold uppercase tracking-widest text-[--text-muted] mt-1">
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
                      className="pointer-events-none absolute right-[-28px] top-2 rotate-45 px-8 py-0.5 text-xs shadow-md"
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
