import type { Team } from "@/types/team";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";

interface TeamCardProps {
  team: Team;
  isLeader: boolean;
  isCoLeader: boolean;
}

/**
 * Audience Display lower-third team score card.
 * Shows team avatar, name, leadership badge, and animated score.
 */
export function TeamCard({ team, isLeader, isCoLeader }: TeamCardProps) {
  const animatedScore  = useAnimatedNumber(team.score, 650);
  const displayScore   = Math.round(animatedScore).toLocaleString();
  const accent         = team.color || "#0ea5e9";
  const isLeading      = isLeader || isCoLeader;

  const initials = team.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`score-badge flex flex-col gap-3 transition-all duration-300 ${
        isLeading
          ? "border-[--gold] shadow-[0_0_0_2px_var(--gold),0_0_28px_var(--gold-glow)]"
          : ""
      }`}
      style={{ border: isLeading ? undefined : "1px solid var(--border-subtle)" }}
    >
      {/* Top row: avatar + name */}
      <div className="flex items-center gap-3">
        {/* Avatar circle */}
        <div
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-inner"
          style={{ background: accent }}
        >
          <span
            className="font-bold"
            style={{ color: "#0c0f1a", fontSize: "0.9rem" }}
          >
            {initials}
          </span>
          {/* Leader crown ring */}
          {isLeading && (
            <span
              className="absolute inset-0 rounded-full"
              style={{
                boxShadow: "0 0 0 2px var(--gold), 0 0 12px var(--gold-glow)",
              }}
            />
          )}
        </div>

        {/* Name + badge */}
        <div className="flex min-w-0 flex-col">
          {isLeading && (
            <span
              className="mb-0.5 inline-block w-fit rounded px-1.5 py-0.5"
              style={{
                background: "var(--gold-subtle)",
                border: "1px solid var(--border-strong)",
                color: "var(--text-gold)",
                fontSize: "0.5rem",
                fontWeight: 700,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
              }}
            >
              {isLeader ? "Leading" : "Co-lead"}
            </span>
          )}
          <p
            className="truncate font-bold text-[--text-primary]"
            style={{ fontSize: "clamp(0.8rem, 1.5vw, 1rem)" }}
          >
            {team.name}
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="gold-divider" />

      {/* Score */}
      <div className="flex flex-col items-center">
        <p
          className="studio-label mb-1"
          style={{ letterSpacing: "0.22em" }}
        >
          Score
        </p>
        <p
          className="text-data font-black"
          style={{
            color: isLeading ? "var(--gold)" : "var(--text-primary)",
            fontSize: "clamp(1.4rem, 2.5vw, 2rem)",
            textShadow: isLeading ? "0 0 20px var(--gold-glow)" : "none",
          }}
        >
          {displayScore}
        </p>
      </div>
    </div>
  );
}
