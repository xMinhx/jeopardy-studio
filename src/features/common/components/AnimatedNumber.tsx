import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";

interface Props {
  value: number;
  className?: string;
  prefix?: string;
  duration?: number;
}

export function AnimatedNumber({ value, className, prefix = "", duration = 600 }: Props) {
  const animatedValue = useAnimatedNumber(value, duration);
  
  return (
    <span className={className}>
      {prefix}{Math.floor(animatedValue).toLocaleString()}
    </span>
  );
}
