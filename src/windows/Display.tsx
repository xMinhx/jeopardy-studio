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
import type { Board } from "@/types/board";
import type { Team } from "@/types/team";

const ALERT_EPS_MS = 300;

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

  useEffect(() => {
    const api = window.api;
    void (async () => {
      if (api?.getState) {
        const s = await api.getState();
        if (s) {
          previousActiveQuestionIdsRef.current = getActiveQuestionIds(s.board);
          setAll(s);
          setTimerQuestion((cur) => resolveTimerQuestion(cur, s.board, s.teams, previousActiveQuestionIdsRef.current));
        } else {
          const preset = await loadBoardPreset();
          if (preset) setAll({ teams: useBoardStore.getState().teams, board: preset });
        }
      }
      if (api?.getDisplayMode) { const m = await api.getDisplayMode(); if (m) setMode(m); }
    })();
    if (api?.onStateChanged) {
      const off = api.onStateChanged((s) => {
        const newIds = getActiveQuestionIds(s.board);
        setAll(s);
        setTimerQuestion((cur) => resolveTimerQuestion(cur, s.board, s.teams, previousActiveQuestionIdsRef.current));
        previousActiveQuestionIdsRef.current = newIds;
      });
      return () => off?.();
    }
  }, [setAll]);

  useEffect(() => {
    const api = window.api;
    const offMode = api?.onDisplayMode?.((m) => setMode(m));
    const offTick = api?.onTimerTick?.((payload) => {
      setDurationMs(payload.durationMs);
      setTickRunning(!!payload.running);
      if (payload.remainingMs > 0) lastActiveMsRef.current = payload.remainingMs;
      const isEnded = (payload.ended ?? false) || (!payload.running && payload.remainingMs <= 0);
      if (isEnded) lastActiveMsRef.current = 0;
      const fallback = isEnded ? 0 : payload.running ? payload.remainingMs : payload.remainingMs > 0 ? payload.remainingMs : lastActiveMsRef.current;
      const preferred = typeof payload.displayMs === "number" ? payload.displayMs : fallback;
      setDisplayMs(isEnded ? 0 : Math.max(0, preferred));
      setEnded(isEnded);
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F11") { e.preventDefault(); window.api?.toggleFullscreen?.("display"); }
    };
    window.addEventListener("keydown", onKey);
    return () => { offMode?.(); offTick?.(); window.removeEventListener("keydown", onKey); };
  }, []);

  useEffect(() => {
    const isAlert = ended || displayMs <= ALERT_EPS_MS;
    if (isAlert && !prevAlertRef.current) { setAlertVersion((v) => v + 1); prevAlertRef.current = true; }
    else if (!isAlert) prevAlertRef.current = false;
  }, [ended, displayMs]);

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "var(--surface-base)", color: "var(--text-primary)" }}>
      {/* Titlebar */}
      <div className="h-9 drag-region shrink-0 flex items-center justify-between px-6" style={{ background: "var(--surface-panel)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-2">
          <span style={{ color: "var(--gold)", fontSize: "0.55rem", fontWeight: 900, letterSpacing: "0.25em", textTransform: "uppercase" }}>◈</span>
          <span className="studio-label" style={{ color: "var(--text-muted)" }}>Jeopardy Studio</span>
          <span className="studio-label" style={{ color: "var(--border-strong)" }}>—</span>
          <span className="studio-label" style={{ color: "var(--text-muted)" }}>Audience Display</span>
        </div>
        <button
          className="no-drag studio-label hover:text-[--text-secondary] transition-colors"
          onClick={() => window.api?.toggleFullscreen?.("display")}
          title="Toggle fullscreen (F11)"
        >
          F11 Fullscreen
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden px-8 pb-8 pt-4 flex flex-col">
        {finalJeopardy.isActive ? (
          <FinalJeopardySplash teams={teams} finalJeopardy={finalJeopardy} />
        ) : dailyDouble.stage === "wager" ? (
          <DailyDoubleSplash teams={teams} dailyDouble={dailyDouble} />
        ) : mode === "timer" ? (
          <TimerView displayMs={displayMs} durationMs={durationMs} tickRunning={tickRunning} ended={ended} alertVersion={alertVersion} timerQuestion={timerQuestion} />
        ) : (
          <ScoreboardView 
            teams={teams} 
            board={board} 
            dailyDouble={dailyDouble} 
            timerState={{ displayMs, durationMs, tickRunning, ended, alertVersion }} 
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timer View
// ---------------------------------------------------------------------------
interface TimerViewProps {
  displayMs: number; durationMs: number; tickRunning: boolean;
  ended: boolean; alertVersion: number; timerQuestion: ActiveQuestionSnapshot | null;
}

function TimerView({ displayMs, durationMs, tickRunning, ended, alertVersion, timerQuestion }: TimerViewProps) {
  const safeMs      = Math.max(0, displayMs);
  const secs        = Math.floor(safeMs / 1000);
  const minutes     = Math.floor(secs / 60);
  const secondsOnly = secs % 60;
  const isAlert     = ended || safeMs <= ALERT_EPS_MS;
  const show        = isAlert ? "0" : minutes >= 1 ? `${String(minutes).padStart(2, "0")}:${String(secondsOnly).padStart(2, "0")}` : String(secondsOnly);
  const pct         = durationMs > 0 ? Math.max(0, Math.min(1, safeMs / durationMs)) : 0;
  const deg         = Math.round(pct * 360);
  const glowClass   = isAlert ? "ring-glow--alert" : "ring-glow";
  const ringStyle   = isAlert ? { background: "#ef4444" } : { backgroundImage: `conic-gradient(#10b981 ${deg}deg, rgba(240,234,214,0.08) 0deg)` };
  const digitKey    = `${isAlert ? "alert" : "run"}-${alertVersion}`;
  const digitClass  = ["digital text-[18vmin] font-extrabold leading-none", isAlert ? "blink-hard-3" : "", !isAlert && tickRunning ? "tick-bounce" : ""].filter(Boolean).join(" ");
  const digitStyle  = isAlert ? { color: "#b91c1c" } : { color: "var(--surface-base)" };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-10 p-6">
      {timerQuestion && (
        <div className="w-full max-w-5xl text-center animate-in fade-in slide-in-from-bottom-6 duration-700"
          style={{ background: "var(--surface-overlay)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-2xl)", padding: "2.5rem 3rem", boxShadow: "var(--shadow-deep)" }}>
          <div className="studio-label mb-4" style={{ letterSpacing: "0.3em" }}>
            {timerQuestion.category}
            <span style={{ color: "var(--gold)", margin: "0 0.75rem" }}>•</span>
            {timerQuestion.value} pts
          </div>
          <div className="font-serif leading-tight" style={{ fontSize: "clamp(2rem,4.5vw,4.5rem)", color: "var(--text-primary)" }}>
            {timerQuestion.question || "No question set"}
          </div>
          <div className="mt-6 font-serif italic" style={{ color: "var(--text-secondary)", fontSize: "1.1rem" }}>
            Waiting for answer…
          </div>
        </div>
      )}

      <div className={`relative ${glowClass} rounded-full p-4`} style={{ width: "60vmin", height: "60vmin", background: "rgba(240,234,214,0.03)" }}>
        <div className="absolute inset-4 rounded-full" style={ringStyle} />
        <div className="absolute inset-8 flex items-center justify-center rounded-full bg-white shadow-inner">
          <div key={digitKey} className={digitClass} style={digitStyle}>{show}</div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scoreboard View
// ---------------------------------------------------------------------------
interface ScoreboardViewProps { 
  teams: Team[]; 
  board: Board; 
  dailyDouble: BoardState["dailyDouble"]; 
  timerState: { displayMs: number; durationMs: number; tickRunning: boolean; ended: boolean; alertVersion: number; };
}

function ScoreboardView({ teams, board, dailyDouble, timerState }: ScoreboardViewProps) {
  const leaderScore  = teams.reduce((max, t) => Math.max(max, t.score), Number.NEGATIVE_INFINITY);
  const leaderCount  = teams.filter((t) => t.score === leaderScore).length;
  const visibleCats  = board.categories.slice(0, board.cols);
  const visibleRows  = board.grid.slice(0, board.rows).map((row) => row.slice(0, board.cols));
  const activeQ      = getActiveQuestions(board, teams)[0] ?? null;
  const activeCell   = activeQ ? visibleRows.flat().find((c) => c.id === activeQ.cellId) : null;

  const isAlert = timerState.ended || timerState.displayMs <= 5000;
  const pct = timerState.durationMs > 0 ? Math.max(0, Math.min(1, timerState.displayMs / timerState.durationMs)) : 0;
  const deg = Math.round(pct * 360);
  const ringStyle = isAlert ? { background: "#ef4444" } : { backgroundImage: `conic-gradient(var(--gold) ${deg}deg, rgba(240,234,214,0.08) 0deg)` };

  return (
    <div className="flex h-full flex-col gap-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-center gap-4 shrink-0">
        <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, var(--border-strong))" }} />
        <h1 className="font-serif text-4xl font-bold tracking-wide" style={{ color: "var(--gold)", textShadow: "0 0 40px var(--gold-glow)" }}>
          Jeopardy Studio
        </h1>
        <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, var(--border-strong), transparent)" }} />
      </div>

      {/* Board */}
      <section className="relative flex min-h-0 flex-1 flex-col">
        {/* Active question overlay — cinematic reveal style */}
        {activeCell && activeQ && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center anim-scale-in" style={{background:'rgba(8,10,18,0.92)', backdropFilter:'blur(14px)'}}>
            <div className="flex items-center gap-3 mb-6">
              <div className="text-[11px] font-bold tracking-widest-2 uppercase text-[--gold]">{activeQ.category}</div>
              <div className="h-1.5 w-1.5 rounded-full bg-[--gold]"></div>
              {dailyDouble.stage === "question" ? (
                <div className="font-serif italic text-[--gold]" style={{fontSize: '24px'}}>DAILY DOUBLE · ${dailyDouble.wager.toLocaleString()}</div>
              ) : (
                <div className="font-serif italic text-[--gold]" style={{fontSize: '24px'}}>{activeCell.value} points</div>
              )}
            </div>
            
            <div className="relative">
              <div className="ornate-frame rounded-sm px-14 py-12 max-w-[1000px] mx-auto text-center" style={{background:'linear-gradient(180deg, rgba(26,33,56,0.95), rgba(12,15,26,0.98))'}}>
                <div className="ornate-corner tl"></div>
                <div className="ornate-corner tr"></div>
                <div className="ornate-corner bl"></div>
                <div className="ornate-corner br"></div>
                <div className="font-serif text-[--text-primary] leading-tight" style={{fontSize: 'clamp(2rem, 4vw, 4.5rem)', fontWeight: 500}}>
                  {activeCell.question || "No question set"}
                </div>
              </div>

              {/* Floating Timer Badge */}
              <div className="absolute -top-10 -right-10 flex flex-col items-center gap-2">
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-[--surface-base] shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-[--border-strong]" style={isAlert ? { boxShadow: "0 0 40px rgba(239, 68, 68, 0.4)", borderColor: "#ef4444" } : {}}>
                  <div className="absolute inset-1 rounded-full" style={ringStyle}></div>
                  <div className="absolute inset-[3px] rounded-full bg-[--surface-base] flex items-center justify-center">
                    <span className={`digital text-2xl font-bold ${isAlert ? "text-red-500 blink-hard-3" : "text-[--gold]"}`}>
                      {Math.ceil(timerState.displayMs / 1000)}
                    </span>
                  </div>
                </div>
                <div className="text-[8px] font-bold tracking-widest uppercase text-[--text-muted] bg-[--surface-base] px-2 py-0.5 rounded-full border border-[--border-subtle]">
                  <span className={timerState.tickRunning ? "text-green-400" : ""}>●</span> {timerState.tickRunning ? "TIMING" : "STANDBY"}
                </div>
              </div>
            </div>

            <div className="mt-10 flex items-center gap-4">
              <div className="h-px w-20 bg-gradient-to-r from-transparent to-[--gold] opacity-50"/>
              <div className="text-[10px] font-bold tracking-widest-2 uppercase text-[--text-muted]">Waiting for answer...</div>
              <div className="h-px w-20 bg-gradient-to-l from-transparent to-[--gold] opacity-50"/>
            </div>
          </div>
        )}

        <div className={`flex min-h-0 flex-1 flex-col gap-2.5 transition-opacity duration-500 ${activeCell ? "opacity-20" : "opacity-100"}`}>
          {/* Category headers */}
          <div className="grid gap-2.5 mb-1" style={{ gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))` }}>
            {visibleCats.map((cat, i) => (
              <div key={`${i}-${cat}`} className="px-2 py-2 text-center"
                style={{ fontFamily: "var(--font-sans)", fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--text-secondary)", borderBottom: "1px solid var(--border-strong)" }}>
                {cat}
              </div>
            ))}
          </div>

          {/* Cells grid */}
          <div className="grid h-full gap-2.5"
            style={{ gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${board.rows}, minmax(0, 1fr))` }}>
            {visibleRows.flat().map((cell) => (
              <BoardCard key={cell.id} cell={cell} owner={teams.find((t) => t.id === cell.ownerTeamId)} isActive={activeCell?.id === cell.id} />
            ))}
          </div>
        </div>
      </section>

      {/* Teams lower-third */}
      <section className="shrink-0 pt-4 px-8 pb-8" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="flex flex-wrap items-stretch justify-center gap-4">
          {[...teams].sort((a, b) => b.score - a.score).map((team) => (
            <TeamCard key={team.id} team={team}
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
function DailyDoubleSplash({ teams, dailyDouble }: { teams: Team[]; dailyDouble: BoardState["dailyDouble"] }) {
  const team = teams.find((t) => t.id === dailyDouble.teamId);
  return (
    <div className="relative flex h-full flex-col items-center justify-center p-6 animate-in zoom-in duration-700 overflow-hidden" style={{ background: "var(--surface-base)" }}>
      {/* Spinning rays */}
      <div className="anim-spin-slow pointer-events-none absolute" style={{ inset: "-150vh", background: "conic-gradient(from 0deg, transparent 0deg, rgba(230,179,25,0.06) 10deg, transparent 20deg, rgba(230,179,25,0.06) 30deg, transparent 40deg, rgba(230,179,25,0.06) 50deg, transparent 60deg, rgba(230,179,25,0.06) 70deg, transparent 80deg, rgba(230,179,25,0.06) 90deg, transparent 100deg, rgba(230,179,25,0.06) 110deg, transparent 120deg, rgba(230,179,25,0.06) 130deg, transparent 140deg, rgba(230,179,25,0.06) 150deg, transparent 160deg, rgba(230,179,25,0.06) 170deg, transparent 180deg)" }} />

      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="relative">
          <div className="font-sans font-black uppercase tracking-[0.65em] mb-2" style={{ fontSize: "1.8rem", color: "var(--gold)", textShadow: "0 0 20px var(--gold-glow)" }}>
            Daily
          </div>
          <div className="font-serif font-bold uppercase leading-none tracking-wide" style={{ fontSize: "14vmin", color: "var(--text-primary)", textShadow: "0 10px 40px rgba(0,0,0,0.8), 0 0 60px var(--gold-glow)" }}>
            Double
          </div>
          <div className="mx-auto mt-6 h-0.5 w-64" style={{ background: "linear-gradient(90deg, transparent, var(--gold), transparent)", boxShadow: "0 0 16px var(--gold-glow)" }} />

          {team && (
            <div className="mt-10 flex flex-col items-center animate-in slide-in-from-bottom-10 duration-1000 delay-300">
              <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full border-2 shadow-2xl"
                style={{ background: team.color, borderColor: "var(--border-strong)", boxShadow: "0 0 0 4px rgba(230,179,25,0.2)" }}>
                <span className="text-4xl font-black" style={{ color: "#0c0f1a" }}>{team.name.charAt(0)}</span>
              </div>
              <div className="font-sans font-black uppercase tracking-widest text-2xl" style={{ color: "var(--text-primary)" }}>{team.name}</div>
              <div className="mt-5 flex flex-col items-center gap-1">
                <span className="studio-label" style={{ letterSpacing: "0.3em" }}>Current Wager</span>
                <div className="studio-card studio-card--gold mt-2 px-10 py-4 text-5xl font-mono font-bold backdrop-blur-md" style={{ color: "var(--gold)", boxShadow: "var(--shadow-gold-strong)" }}>
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
function FinalJeopardySplash({ teams, finalJeopardy }: { teams: Team[]; finalJeopardy: BoardState["finalJeopardy"] }) {
  const stage = finalJeopardy.stage;
  return (
    <div className="flex h-full flex-col items-center justify-center p-6 animate-in zoom-in duration-500">
      <div className="relative w-full max-w-6xl">

        {stage === "category" && (
          <div className="flex flex-col items-center text-center category-reveal">
            <div className="mb-3 font-sans font-black uppercase tracking-[0.8em]" style={{ fontSize: "1.1rem", color: "var(--text-muted)" }}>Final Round</div>
            <div className="mb-8 font-serif font-bold uppercase leading-none tracking-wide" style={{ fontSize: "10vmin", color: "var(--gold)", textShadow: "0 0 30px var(--gold-glow)" }}>
              Category
            </div>
            <div className="studio-card studio-card--gold px-16 py-12 text-center" style={{ boxShadow: "0 0 60px var(--gold-glow)" }}>
              <div className="font-black uppercase tracking-widest" style={{ fontSize: "8vmin", color: "var(--text-primary)" }}>
                {finalJeopardy.category || "Mystery Category"}
              </div>
            </div>
          </div>
        )}

        {stage === "wager" && (
          <div className="flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-700 w-full">
            <div className="mb-6 font-sans font-black uppercase tracking-[0.5em] text-2xl" style={{ color: "var(--gold)" }}>Wagers Locked</div>
            <div className="flex flex-wrap justify-center gap-4 w-full">
              {teams.map((t) => (
                <div key={t.id} className="studio-card flex flex-col items-center w-40 p-4" style={{ background: "var(--surface-overlay)" }}>
                  <div className="mb-3 h-12 w-12 rounded-full flex items-center justify-center text-xl font-bold border" style={{ background: t.color, borderColor: "var(--border-strong)" }}>
                    <span style={{ color: "#0c0f1a" }}>{t.name.charAt(0)}</span>
                  </div>
                  <div className="text-sm font-bold uppercase tracking-widest truncate w-full text-center" style={{ color: "var(--text-primary)" }}>{t.name}</div>
                  <div className="mt-2 studio-label">Locked In</div>
                </div>
              ))}
            </div>
            <div className="mt-8 font-serif italic animate-pulse" style={{ color: "var(--text-secondary)", fontSize: "1.1rem" }}>Calculating risks…</div>
          </div>
        )}

        {stage === "question" && (
          <div className="flex flex-col items-center text-center animate-in fade-in scale-in duration-1000">
            <div className="mb-6 font-sans font-black uppercase tracking-[0.6em] text-2xl" style={{ color: "var(--gold)" }}>Final Jeopardy</div>
            <div className="w-full max-w-5xl rounded-[40px] border px-12 py-16 text-center" style={{ borderColor: "var(--border-subtle)", background: "var(--surface-overlay)", boxShadow: "var(--shadow-deep)" }}>
              <div className="font-serif leading-tight" style={{ fontSize: "clamp(1.5rem,4vw,4rem)", color: "var(--text-primary)" }}>
                {finalJeopardy.question || "No question provided."}
              </div>
            </div>
            <div className="mt-8 flex items-center gap-4">
              <div className="h-px w-24" style={{ background: "linear-gradient(90deg, transparent, var(--gold))" }} />
              <span className="font-bold uppercase tracking-[0.4em] text-sm" style={{ color: "var(--gold)" }}>Good Luck</span>
              <div className="h-px w-24" style={{ background: "linear-gradient(90deg, var(--gold), transparent)" }} />
            </div>
          </div>
        )}

        {stage === "resolution" && (
          <>
            <div className="pointer-events-none absolute inset-[-100vh] z-0 animate-in fade-in duration-1000" style={{ background: "radial-gradient(circle at 50% 50%, var(--gold-subtle), transparent 60%)" }} />
            <div className="relative z-10 flex flex-col items-center text-center animate-in fade-in slide-in-from-top-12 duration-700 w-full">
              <div className="mb-10 font-black uppercase tracking-[0.4em] text-4xl" style={{ color: "var(--gold)", textShadow: "0 0 24px var(--gold-glow)" }}>The Champion</div>
              <div className="flex flex-wrap justify-center items-end gap-6 w-full max-w-[90vw]">
                {[...teams].sort((a, b) => b.score - a.score).slice(0, 5).map((t, idx) => (
                  <div key={t.id} className={`relative flex flex-col items-center p-6 transition-all ${idx === 0 ? "studio-card studio-card--gold scale-125 z-20 mx-4 mb-8" : "studio-card scale-90 opacity-90 z-10"}`}
                    style={idx === 0 ? { boxShadow: "0 0 80px var(--gold-glow)" } : {}}>
                    {idx === 0 && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full px-6 py-1 whitespace-nowrap"
                        style={{ background: "var(--gold)", color: "#0c0f1a", fontSize: "0.6rem", fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", boxShadow: "0 0 16px var(--gold-glow)" }}>
                        1st Place
                      </div>
                    )}
                    <div className="mb-4 h-20 w-20 rounded-full flex items-center justify-center text-4xl font-bold border-2" style={{ background: t.color, borderColor: "var(--border-strong)" }}>
                      <span style={{ color: "#0c0f1a" }}>{t.name.charAt(0)}</span>
                    </div>
                    <div className="font-serif font-bold truncate max-w-[150px]" style={{ color: "var(--text-primary)", fontSize: "1.1rem" }}>{t.name}</div>
                    {(finalJeopardy.wagers[t.id] ?? 0) > 0 && (
                      <div className="mt-2 studio-label">Wager: <span style={{ color: "var(--gold)" }}><AnimatedNumber value={finalJeopardy.wagers[t.id] ?? 0} prefix="$" /></span></div>
                    )}
                    <div className={`mt-3 text-data font-black ${idx === 0 ? "text-6xl" : "text-4xl"}`} style={{ color: idx === 0 ? "var(--gold)" : "var(--text-primary)" }}>
                      <AnimatedNumber value={t.score} />
                    </div>
                    <div className="mt-1 studio-label">Final Score</div>
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
