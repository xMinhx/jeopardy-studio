import { useCallback, useEffect, useRef, useState } from "react";

export type SoundKey = "ding" | "bell" | "beep";

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
}

export function useTimer(initialMs = 30000): [TimerState, TimerApi] {
  const [state, setState] = useState<TimerState>({
    durationMs: initialMs,
    remainingMs: initialMs,
    running: false,
    sound: "ding",
    volume: 0.7,
    muted: false,
  });

  const rafRef = useRef<number | null>(null);
  const endAtRef = useRef<number | null>(null);
  const tickRef = useRef<() => void>();

  const tick = useCallback(() => {
    rafRef.current = requestAnimationFrame(() => tickRef.current?.());
    setState((prev) => {
      if (!prev.running || endAtRef.current == null) return prev;
      const rem = Math.max(0, Math.ceil(endAtRef.current - performance.now()));
      if (rem === 0) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        endAtRef.current = null;
        return { ...prev, remainingMs: 0, running: false };
      }
      if (rem === prev.remainingMs) return prev;
      return { ...prev, remainingMs: rem };
    });
  }, []);

  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  const start = useCallback(
    (ms?: number) => {
      setState((prev) => {
        const duration = ms ?? prev.durationMs;
        endAtRef.current = performance.now() + duration;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(tick);
        return { ...prev, durationMs: duration, remainingMs: duration, running: true };
      });
    },
    [tick],
  );

  const pause = useCallback(() => {
    setState((prev) => {
      if (!prev.running) return prev;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      const rem = Math.max(
        0,
        Math.ceil((endAtRef.current ?? performance.now() + prev.remainingMs) - performance.now()),
      );
      endAtRef.current = null;
      return { ...prev, running: false, remainingMs: rem };
    });
  }, []);

  const resume = useCallback(() => {
    setState((prev) => {
      if (prev.running || prev.remainingMs <= 0) return prev;
      endAtRef.current = performance.now() + prev.remainingMs;
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

  const setVolume = useCallback(
    (v: number) =>
      setState((s) => ({ ...s, volume: Math.min(1, Math.max(0, v)) })),
    [],
  );

  const setSound = useCallback(
    (snd: SoundKey) => setState((s) => ({ ...s, sound: snd })),
    [],
  );

  const toggleMute = useCallback(
    () => setState((s) => ({ ...s, muted: !s.muted })),
    [],
  );

  // Cleanup RAF on unmount
  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  return [state, { start, pause, resume, reset, setDuration, setVolume, setSound, toggleMute }];
}
