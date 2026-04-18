import { useCallback, useRef } from "react";
import { useBoardStore } from "@/store/boardStore";

export function useGameAudio() {
  const volume = useBoardStore((s) => s.settings.volume);
  const audioContextRef = useRef<AudioContext | null>(null);
  const bufferCacheRef = useRef<Record<string, AudioBuffer>>({});

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const playSound = useCallback(async (url: string) => {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") await ctx.resume();

    let buffer = bufferCacheRef.current[url];
    if (!buffer) {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      buffer = await ctx.decodeAudioData(arrayBuffer);
      bufferCacheRef.current[url] = buffer;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gainNode = ctx.createGain();
    gainNode.gain.value = volume;

    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start(0);
  }, [getAudioContext, volume]);

  const playScoreUp = useCallback(() => playSound("/assets/score_up_sfx.mp3"), [playSound]);
  const playScoreDown = useCallback(() => playSound("/assets/score_down_sfx.mp3"), [playSound]);
  const playDailyDouble = useCallback(() => playSound("/assets/daily_double_sfx.mp3"), [playSound]);
  const playQuestionReveal = useCallback(() => playSound("/assets/question_reveal_sfx.mp3"), [playSound]);
  const playFinalJeopardy = useCallback(() => playSound("/assets/final_jeopardy_sfx.mp3"), [playSound]);
  const playWinnerReveal = useCallback(() => playSound("/assets/winner_reveal_sfx.mp3"), [playSound]);

  return {
    playScoreUp,
    playScoreDown,
    playDailyDouble,
    playQuestionReveal,
    playFinalJeopardy,
    playWinnerReveal,
  };
}
