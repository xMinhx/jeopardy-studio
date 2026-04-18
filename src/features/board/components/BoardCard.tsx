import type { Cell } from "@/types/cell";
import type { Team } from "@/types/team";

interface BoardCardProps {
  cell: Cell;
  owner?: Team;
  isActive: boolean;
}

/**
 * A single cell on the Audience Display board.
 * Renders value, state label, ownership badge and premium visual styling.
 */
export function BoardCard({ cell, owner, isActive }: BoardCardProps) {
  const isClaimed = !!owner;
  const isOpen    = cell.state === "open";
  const isDisabled = cell.state === "disabled";

  let modifierClass = "";
  if (isClaimed)       modifierClass = "board-cell--claimed";
  else if (isDisabled) modifierClass = "board-cell--disabled";
  else if (isActive)   modifierClass = "board-cell--active";

  return (
    <div
      className={`board-cell w-full h-full group ${modifierClass}`}
      aria-label={`${cell.value} points — ${
        isClaimed ? `claimed by ${owner?.name}` : isOpen ? "open" : isDisabled ? "disabled" : "available"
      }`}
    >
      {/* Daily Double star badge */}
      {cell.isDailyDouble && !isClaimed && !isDisabled && (
        <span
          className="absolute left-2 top-2 z-20 flex items-center gap-1 rounded-full px-2 py-0.5"
          style={{
            background: "rgba(230, 179, 25, 0.15)",
            border: "1px solid rgba(230, 179, 25, 0.45)",
          }}
          title="Daily Double"
        >
          <span style={{ color: "var(--gold)", fontSize: "0.6rem", fontWeight: 900 }}>★</span>
          <span
            style={{
              color: "var(--gold)",
              fontSize: "0.5rem",
              fontWeight: 800,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            DD
          </span>
        </span>
      )}

      {/* Ownership badge */}
      {owner && (
        <span
          className="absolute right-2 top-2 z-20 flex items-center gap-1.5 rounded-full backdrop-blur-sm px-2 py-1"
          style={{
            background: "rgba(0,0,0,0.65)",
            fontSize: "0.6rem",
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#fff",
          }}
          title={owner.name}
        >
          <span
            className="inline-block h-2 w-2 rounded-full shrink-0"
            style={{ background: owner.color }}
          />
          <span className="max-w-[72px] truncate">{owner.name}</span>
        </span>
      )}

      {/* Point value */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-1.5 select-none">
        <span
          className={`font-serif font-bold drop-shadow-lg transition-all duration-300 ${
            isClaimed ? "opacity-40" : ""
          }`}
          style={{
            color: isClaimed ? "var(--success)" : "var(--gold)",
            fontSize: "clamp(1.25rem, 3.5vmin, 2.75rem)",
            lineHeight: 1,
            textShadow: isClaimed
              ? "none"
              : "0 0 30px rgba(230,179,25,0.35), 0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          {cell.value}
        </span>

        {isOpen && (
          <span
            style={{
              fontSize: "0.5rem",
              fontWeight: 700,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: "var(--gold)",
              opacity: 0.75,
            }}
          >
            Open
          </span>
        )}
      </div>

      {/* Bottom shimmer on hover */}
      {!isClaimed && !isDisabled && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: "linear-gradient(90deg, transparent, var(--gold), transparent)",
          }}
        />
      )}
    </div>
  );
}
