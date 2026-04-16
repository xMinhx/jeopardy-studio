import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type SoundKey = 'ding' | 'bell' | 'beep';

export interface TimerState {
  durationMs: number;
  remainingMs: number;
  running: boolean;
  sound: SoundKey;
  volume: number; // 0..1
  muted: boolean;
}

export interface TimerApi {
  start: (ms?: number) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  setDuration: (ms: number) => void;
  setVolume: (v: number) => void;
  setSound: (s: SoundKey) => void;
  toggleMute: () => void;
  preview: () => void;
}

function playChime(ctx: AudioContext, volume = 0.6, kind: SoundKey = 'ding', at?: number) {
  const g = ctx.createGain();
  g.gain.value = volume;
  g.connect(ctx.destination);

  const startAt = at ?? ctx.currentTime;
  const mkOsc = (f: number, t: number, offset = 0) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    o.connect(g);
    o.start(startAt + offset);
    o.stop(startAt + offset + t);
    return o;
  };

  if (kind === 'beep') {
    mkOsc(880, 0.12);
  } else if (kind === 'bell') {
    mkOsc(880, 0.15);
    mkOsc(660, 0.18);
  } else {
    // ding (default): quick up then down
    mkOsc(1046.5, 0.08);
    mkOsc(783.99, 0.12);
  }
  // fade out
  g.gain.setTargetAtTime(0, startAt + 0.1, 0.15);
}

function playTripleDing(ctx: AudioContext, volume = 0.6) {
  const now = ctx.currentTime;
  playChime(ctx, volume, 'ding', now);
  playChime(ctx, volume, 'ding', now + 0.3);
  playChime(ctx, volume, 'ding', now + 0.6);
}

export function useTimer(initialMs = 30000): [TimerState, TimerApi] {
  const [state, setState] = useState<TimerState>({
    durationMs: initialMs,
    remainingMs: initialMs,
    running: false,
    sound: 'ding',
    volume: 0.7,
    muted: false,
  });

  const rafRef = useRef<number | null>(null);
  const endAtRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  const ensureCtx = useCallback(() => {
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctxRef.current?.state === 'suspended') ctxRef.current.resume();
    return ctxRef.current!;
  }, []);

  const tick = useCallback(() => {
    rafRef.current = requestAnimationFrame(tick);
    setState((prev) => {
      if (!prev.running || endAtRef.current == null) return prev;
      const now = performance.now();
      const rem = Math.max(0, Math.ceil(endAtRef.current - now));
      if (rem === 0) {
        // stop
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        endAtRef.current = null;
        return { ...prev, remainingMs: 0, running: false };
      }
      if (rem === prev.remainingMs) return prev;
      return { ...prev, remainingMs: rem };
    });
  }, [ensureCtx]);

  const start = useCallback((ms?: number) => {
    setState((prev) => {
      const duration = ms ?? prev.durationMs;
      const now = performance.now();
      endAtRef.current = now + duration;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tick);
      return { ...prev, durationMs: duration, remainingMs: duration, running: true };
    });
  }, [tick]);

  const pause = useCallback(() => {
    setState((prev) => {
      if (!prev.running) return prev;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      const now = performance.now();
      const target = endAtRef.current ?? now + prev.remainingMs;
      const rem = Math.max(0, Math.ceil(target - now));
      endAtRef.current = null;
      return { ...prev, running: false, remainingMs: rem };
    });
  }, []);

  const resume = useCallback(() => {
    setState((prev) => {
      if (prev.running || prev.remainingMs <= 0) return prev;
      const now = performance.now();
      endAtRef.current = now + prev.remainingMs;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tick);
      return { ...prev, running: true };
    });
  }, [tick]);

  const reset = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    endAtRef.current = null;
    setState((prev) => ({ ...prev, remainingMs: prev.durationMs, running: false }));
  }, []);

  const setDuration = useCallback((ms: number) => {
    setState((prev) => {
      const next = { ...prev, durationMs: ms };
      if (!prev.running) next.remainingMs = ms;
      return next;
    });
  }, []);

  const setVolume = useCallback((v: number) => setState((s) => ({ ...s, volume: Math.min(1, Math.max(0, v)) })), []);
  const setSound = useCallback((snd: SoundKey) => setState((s) => ({ ...s, sound: snd })), []);
  const toggleMute = useCallback(() => setState((s) => ({ ...s, muted: !s.muted })), []);

  const preview = useCallback(() => {
    // no-op: dedicated audio handled by useTimerAudio
  }, []);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  return [state, { start, pause, resume, reset, setDuration, setVolume, setSound, toggleMute, preview }];
}
