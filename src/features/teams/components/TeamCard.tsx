import type { Team } from "@/types/team";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";

interface TeamCardProps {
  team: Team;
  isLeader: boolean;
  isCoLeader: boolean;
}

/**
 * Display-window card showing a team's name, score, and leadership badge.
 * The score animates smoothly when it changes.
 */
export function TeamCard({ team, isLeader, isCoLeader }: TeamCardProps) {
  const animatedScore = useAnimatedNumber(team.score, 650);
  const displayScore = Math.round(animatedScore).toLocaleString();
  const accent = team.color || "#0ea5e9";

  /** Derive initials from team name: first letter of each word, up to 2 chars. */
  const initials = team.name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const isLeading = isLeader || isCoLeader;

  return (
    <div
      className={`score-badge flex items-center justify-between gap-4 transition-transform duration-300 hover:-translate-y-1 ${
        isLeading ? 'ring-2 ring-[--gold] shadow-[0_0_20px_var(--gold-glow)]' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Team avatar (circle) */}
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-inner"
          style={{ background: accent }}
        >
          <span className="text-lg font-bold text-[#0c0f1a] drop-shadow-sm">{initials}</span>
        </div>

        {/* Name & badge */}
        <div className="flex flex-col items-start text-left">
          <div className="flex items-center gap-2">
            {isLeading && (
              <span className="rounded bg-[--gold-subtle] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-[--text-gold]">
                {isLeader ? "Leading" : "Co-leading"}
              </span>
            )}
          </div>
          <p className="font-sans font-bold text-lg text-[--text-primary] truncate max-w-[120px]">
            {team.name}
          </p>
        </div>
      </div>

      {/* Score */}
      <div className="flex flex-col items-end text-right">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">Score</p>
        <p className="text-data text-2xl text-[--gold] font-black">{displayScore}</p>
      </div>
    </div>
  );
}
