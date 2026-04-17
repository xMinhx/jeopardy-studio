import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Manages Web Audio API playback for the countdown timer.
 *
 * - Loads `loopUrl` as a looping background track.
 * - Schedules `endUrl` to fire ~2 s before the timer expires (auto-cue).
 * - Supports manual pause (with optional end cue) and resume from loop offset.
 */
export function useTimerAudio(
  loopUrl = "/assets/15sectimertrack.mp3",
  endUrl = "/assets/Ending.mp3",
) {
  const ctxRef = useRef<AudioContext | null>(null);
  const loopBufRef = useRef<AudioBuffer | null>(null);
  const endBufRef = useRef<AudioBuffer | null>(null);
  const loopSrcRef = useRef<AudioBufferSourceNode | null>(null);
  const endSrcRef = useRef<AudioBufferSourceNode | null>(null);
  const manualEndSrcRef = useRef<AudioBufferSourceNode | null>(null);
  const loopGainRef = useRef<GainNode | null>(null);
  const endGainRef = useRef<GainNode | null>(null);
  const manualEndGainRef = useRef<GainNode | null>(null);
  const startTimeRef = useRef<number | null>(null);
  /** Seconds into the loop buffer at which playback last stopped. */
  const loopOffsetRef = useRef(0);
  const volRef = useRef(0.7);
  const [ready, setReady] = useState(false);

  const ensureCtx = useCallback(async () => {
    if (!ctxRef.current) {
      ctxRef.current = new (
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )();
    }
    if (ctxRef.current.state === "suspended") await ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const loadBuffers = useCallback(async () => {
    const ctx = await ensureCtx();
    if (!loopBufRef.current) {
      const res = await fetch(loopUrl);
      loopBufRef.current = await ctx.decodeAudioData(await res.arrayBuffer());
    }
    if (!endBufRef.current) {
      const res = await fetch(endUrl);
      endBufRef.current = await ctx.decodeAudioData(await res.arrayBuffer());
    }
    if (!loopGainRef.current) {
      loopGainRef.current = ctx.createGain();
      loopGainRef.current.gain.value = volRef.current;
      loopGainRef.current.connect(ctx.destination);
    }
    if (!endGainRef.current) {
      endGainRef.current = ctx.createGain();
      endGainRef.current.gain.value = 0;
      endGainRef.current.connect(ctx.destination);
    }
    setReady(true);
  }, [ensureCtx, loopUrl, endUrl]);

  /** Stop loop and auto-end sources, ignoring errors from already-stopped nodes. */
  const stopSources = useCallback(() => {
    try {
      loopSrcRef.current?.stop();
    } catch {
      /* already stopped */
    }
    try {
      endSrcRef.current?.stop();
    } catch {
      /* already stopped */
    }
    loopSrcRef.current = null;
    endSrcRef.current = null;
  }, []);

  const stopManualCue = useCallback(() => {
    try {
      manualEndSrcRef.current?.stop();
    } catch {
      /* already stopped */
    }
    manualEndSrcRef.current = null;
  }, []);

  /**
   * Schedule the ending clip to play automatically `remainingMs` from now,
   * cross-fading out the loop ~2 s before that point.
   */
  const scheduleAutoEnding = useCallback(
    (ctx: AudioContext, remainingMs: number, loopSrc: AudioBufferSourceNode) => {
      if (!loopGainRef.current || !endGainRef.current || !endBufRef.current) return;

      const remainingSec = Math.max(0, remainingMs / 1000);
      const cueDelay = Math.max(0, remainingSec - 2);
      const cueAt = ctx.currentTime + cueDelay;
      const fadeEnd = cueAt + 0.05;

      loopGainRef.current.gain.cancelScheduledValues(ctx.currentTime);
      loopGainRef.current.gain.setValueAtTime(volRef.current, ctx.currentTime);
      loopGainRef.current.gain.setValueAtTime(volRef.current, cueAt);
      loopGainRef.current.gain.linearRampToValueAtTime(0, fadeEnd);

      const endSrc = ctx.createBufferSource();
      endSrc.buffer = endBufRef.current;
      endSrc.connect(endGainRef.current);
      endGainRef.current.gain.cancelScheduledValues(ctx.currentTime);
      endGainRef.current.gain.setValueAtTime(volRef.current, cueAt);
      endSrc.start(cueAt);

      const endDur = endBufRef.current.duration;
      try { loopSrc.stop(fadeEnd + 0.05); } catch { /* ignore */ }
      try { endSrc.stop(cueAt + endDur + 0.05); } catch { /* ignore */ }
      endSrcRef.current = endSrc;
    },
    [],
  );

  const start = useCallback(
    async (durationMs: number) => {
      const ctx = await ensureCtx();
      await loadBuffers();
      stopSources();
      stopManualCue();

      startTimeRef.current = ctx.currentTime;
      const loopSrc = ctx.createBufferSource();
      loopSrc.buffer = loopBufRef.current!;
      loopSrc.loop = true;
      loopSrc.connect(loopGainRef.current!);
      loopGainRef.current!.gain.cancelScheduledValues(ctx.currentTime);
      loopGainRef.current!.gain.setValueAtTime(volRef.current, ctx.currentTime);
      loopSrc.start(ctx.currentTime, loopOffsetRef.current % loopSrc.buffer.duration);
      loopSrcRef.current = loopSrc;
      scheduleAutoEnding(ctx, durationMs, loopSrc);
    },
    [ensureCtx, loadBuffers, stopSources, stopManualCue, scheduleAutoEnding],
  );

  /**
   * @param withCue - When true, plays the ending cue immediately (e.g. host manually pauses).
   */
  const pause = useCallback(
    async (withCue = false) => {
      const ctx = await ensureCtx();
      if (startTimeRef.current != null && loopSrcRef.current?.buffer) {
        const elapsed = ctx.currentTime - startTimeRef.current;
        loopOffsetRef.current =
          (loopOffsetRef.current + elapsed) % loopSrcRef.current.buffer.duration;
      }
      stopSources();
      loopGainRef.current?.gain.cancelScheduledValues(ctx.currentTime);
      endGainRef.current?.gain.cancelScheduledValues(ctx.currentTime);

      if (withCue) {
        await loadBuffers();
        if (!manualEndGainRef.current) {
          manualEndGainRef.current = ctx.createGain();
          manualEndGainRef.current.connect(ctx.destination);
        }
        stopManualCue();
        const src = ctx.createBufferSource();
        src.buffer = endBufRef.current!;
        manualEndGainRef.current.gain.setValueAtTime(volRef.current, ctx.currentTime);
        src.connect(manualEndGainRef.current);
        src.start();
        manualEndSrcRef.current = src;
      }
    },
    [ensureCtx, loadBuffers, stopSources, stopManualCue],
  );

  const resume = useCallback(
    async (remainingMs: number) => {
      const ctx = await ensureCtx();
      await loadBuffers();
      stopSources();
      stopManualCue();

      startTimeRef.current = ctx.currentTime;
      const loopSrc = ctx.createBufferSource();
      loopSrc.buffer = loopBufRef.current!;
      loopSrc.loop = true;
      loopSrc.connect(loopGainRef.current!);
      loopGainRef.current!.gain.setValueAtTime(volRef.current, ctx.currentTime);
      loopSrc.start(ctx.currentTime, loopOffsetRef.current % loopSrc.buffer.duration);
      loopSrcRef.current = loopSrc;
      scheduleAutoEnding(ctx, remainingMs, loopSrc);
    },
    [ensureCtx, loadBuffers, stopSources, stopManualCue, scheduleAutoEnding],
  );

  const reset = useCallback(async () => {
    const ctx = await ensureCtx();
    stopSources();
    stopManualCue();
    loopOffsetRef.current = 0;
    startTimeRef.current = null;
    loopGainRef.current?.gain.setValueAtTime(volRef.current, ctx.currentTime);
    endGainRef.current?.gain.setValueAtTime(0, ctx.currentTime);
  }, [ensureCtx, stopSources, stopManualCue]);

  const setVolume = useCallback(
    async (v: number) => {
      const ctx = await ensureCtx();
      volRef.current = Math.max(0, Math.min(1, v));
      loopGainRef.current?.gain.setValueAtTime(volRef.current, ctx.currentTime);
      // Only clamp end gain down, never up, so a scheduled ramp isn't disturbed
      const endGainNow = endGainRef.current?.gain.value ?? 0;
      endGainRef.current?.gain.setValueAtTime(
        Math.min(endGainNow, volRef.current),
        ctx.currentTime,
      );
    },
    [ensureCtx],
  );

  // Pre-load buffers on mount
  useEffect(() => {
    if (!ready) {
      void loadBuffers();
    }
  }, [loadBuffers, ready]);

  // Stop all sources on unmount
  useEffect(() => () => stopSources(), [stopSources]);

  return { ready, start, pause, resume, reset, setVolume };
}
