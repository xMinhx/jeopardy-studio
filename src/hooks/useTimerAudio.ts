import { useCallback, useEffect, useRef, useState } from 'react';

export function useTimerAudio(loopUrl = '/assets/15sectimertrack.mp3', endUrl = '/assets/Ending.mp3') {
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
  const loopOffsetRef = useRef(0); // seconds into loop buffer
  const volRef = useRef(0.7);
  const [ready, setReady] = useState(false);

  const ensureCtx = useCallback(async () => {
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctxRef.current.state === 'suspended') await ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const loadBuffers = useCallback(async () => {
    const ctx = await ensureCtx();
    if (!loopBufRef.current) {
      const r = await fetch(loopUrl);
      const a = await r.arrayBuffer();
      loopBufRef.current = await ctx.decodeAudioData(a);
    }
    if (!endBufRef.current) {
      const r = await fetch(endUrl);
      const a = await r.arrayBuffer();
      endBufRef.current = await ctx.decodeAudioData(a);
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

  const stopSources = () => {
    try { loopSrcRef.current?.stop(); } catch {}
    try { endSrcRef.current?.stop(); } catch {}
    loopSrcRef.current = null;
    endSrcRef.current = null;
  };

  const stopManualCue = useCallback(() => {
    try { manualEndSrcRef.current?.stop(); } catch {}
    manualEndSrcRef.current = null;
  }, []);

  const scheduleAutoEnding = useCallback((ctx: AudioContext, remainingMs: number, loopSrc: AudioBufferSourceNode) => {
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
    try { loopSrc.stop(fadeEnd + 0.05); } catch {}
    try { endSrc.stop(cueAt + endDur + 0.05); } catch {}
    endSrcRef.current = endSrc;
  }, []);

  const start = useCallback(async (durationMs: number) => {
    const ctx = await ensureCtx();
    await loadBuffers();
    stopSources();
    stopManualCue();
    startTimeRef.current = ctx.currentTime;
    // start loop at current offset (usually 0)
    const loopSrc = ctx.createBufferSource();
    loopSrc.buffer = loopBufRef.current!;
    loopSrc.loop = true;
    loopSrc.connect(loopGainRef.current!);
    loopGainRef.current!.gain.cancelScheduledValues(ctx.currentTime);
    loopGainRef.current!.gain.setValueAtTime(volRef.current, ctx.currentTime);
    loopSrc.start(ctx.currentTime, loopOffsetRef.current % loopSrc.buffer.duration);
    loopSrcRef.current = loopSrc;
    scheduleAutoEnding(ctx, durationMs, loopSrc);
  }, [ensureCtx, loadBuffers, stopManualCue, scheduleAutoEnding]);

  const pause = useCallback(async (withCue = false) => {
    const ctx = await ensureCtx();
    if (startTimeRef.current != null && loopSrcRef.current?.buffer) {
      const elapsed = ctx.currentTime - startTimeRef.current;
      loopOffsetRef.current = (loopOffsetRef.current + elapsed) % loopSrcRef.current.buffer.duration;
    }
    stopSources();
    // reset gains to steady state
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
  }, [ensureCtx, loadBuffers, stopManualCue]);

  const resume = useCallback(async (remainingMs: number) => {
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
  }, [ensureCtx, loadBuffers, stopManualCue, scheduleAutoEnding]);

  const reset = useCallback(async () => {
    const ctx = await ensureCtx();
    stopSources();
    stopManualCue();
    loopOffsetRef.current = 0;
    startTimeRef.current = null;
    loopGainRef.current?.gain.setValueAtTime(volRef.current, ctx.currentTime);
    endGainRef.current?.gain.setValueAtTime(0, ctx.currentTime);
  }, [ensureCtx, stopManualCue]);

  const setVolume = useCallback(async (v: number) => {
    const ctx = await ensureCtx();
    volRef.current = Math.max(0, Math.min(1, v));
    loopGainRef.current?.gain.setValueAtTime(volRef.current, ctx.currentTime);
    endGainRef.current?.gain.setValueAtTime(Math.min(endGainRef.current.gain.value, volRef.current), ctx.currentTime);
  }, [ensureCtx]);

  useEffect(() => { loadBuffers(); }, [loadBuffers]);
  useEffect(() => () => { stopSources(); }, []);

  return { ready, start, pause, resume, reset, setVolume };
}
