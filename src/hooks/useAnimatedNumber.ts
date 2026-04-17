import { useEffect, useRef, useState } from 'react';

export function useAnimatedNumber(value: number, duration = 600) {
  const [animated, setAnimated] = useState(value);
  const currentRef = useRef(value);
  const rafRef = useRef<number>();
  const startRef = useRef<number>();


  useEffect(() => {
    if (value === currentRef.current) return;
    const startValue = currentRef.current;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    startRef.current = undefined;

    const tick = (timestamp: number) => {
      if (startRef.current === undefined) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = duration <= 0 ? 1 : Math.min(1, elapsed / duration);
      const next = startValue + (value - startValue) * progress;
      currentRef.current = next;
      setAnimated(progress === 1 ? value : next);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = undefined;
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  return animated;
}
