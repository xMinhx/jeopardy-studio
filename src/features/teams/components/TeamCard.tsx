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

  const metaColor = isLeader ? "text-white/70" : "text-slate-500";
  const labelColor = isLeader ? "text-white/60" : "text-slate-400";
  const iconBorder = isLeader || isCoLeader ? "border-white/40" : "border-white/70";

  /** Derive initials from team name: first letter of each word, up to 2 chars. */
  const initials = team.name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`relative flex h-full flex-col justify-between overflow-hidden rounded-3xl p-6 shadow-xl transition-transform duration-300 hover:-translate-y-1 ${
        isLeader
          ? "bg-slate-900 text-white ring-2 ring-emerald-400/70"
          : "bg-white text-slate-900 ring-1 ring-slate-200"
      }`}
    >
      {/* Color accent */}
      <div
        className="pointer-events-none absolute inset-0 opacity-15"
        style={{
          background: `radial-gradient(circle at 15% 20%, ${accent}55, transparent 60%)`,
        }}
        aria-hidden
      />

      <div className="relative flex items-center gap-4">
        {/* Team avatar */}
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-2xl border-2 ${iconBorder} shadow-inner`}
          style={{ background: accent }}
        >
          <span className="text-xl font-bold text-white">{initials}</span>
        </div>

        {/* Name & badge */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className={`text-xs uppercase tracking-[0.3em] ${metaColor}`}>Team</p>
            {(isLeader || isCoLeader) && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wide ${
                  isLeader
                    ? "bg-emerald-500/20 text-emerald-200"
                    : "bg-amber-400/20 text-amber-500"
                }`}
              >
                {isLeader ? "Leading" : "Co-leading"}
              </span>
            )}
          </div>
          <p className="text-2xl font-semibold">{team.name}</p>
        </div>

        {/* Score */}
        <div className="text-right">
          <p className={`text-xs uppercase tracking-[0.3em] ${labelColor}`}>Points</p>
          <p className="text-4xl font-black tabular-nums">{displayScore}</p>
        </div>
      </div>
    </div>
  );
}
