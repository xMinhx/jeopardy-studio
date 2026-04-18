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

  return (
    <div
      className={`audience-tile w-full h-full group transition-all duration-300 ${
        isClaimed ? "audience-tile--claimed" : ""
      } ${isDisabled ? "opacity-[0.05] grayscale" : ""} ${isActive ? "ring-2 ring-[--gold] scale-[1.02] z-10" : ""}`}
    >
      {/* Daily Double star badge */}
      {cell.isDailyDouble && !isClaimed && !isDisabled && !isOpen && (
        <span
          className="absolute right-3 top-2.5 z-20"
          title="Daily Double"
        >
          <span className="text-[--gold-bright] text-[10px] animate-pulse">★</span>
        </span>
      )}

      {/* Ownership badge */}
      {owner && (
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 opacity-90 z-10 transition-all duration-300"
          style={{ 
            background: `linear-gradient(to top, rgba(8,10,18,0.8), transparent 80%), radial-gradient(circle at center, ${owner.color}25, transparent)`
          }}
        >
          <div className="h-3 w-3 rounded-full border border-[--surface-base]" style={{ background: owner.color, boxShadow: `0 0 12px ${owner.color}` }} />
          <div className="text-[10px] font-bold tracking-widest uppercase truncate max-w-[90%] px-2" style={{ color: owner.color, textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
            {owner.name}
          </div>
        </div>
      )}

      {/* Point value */}
      {!isClaimed && !isDisabled && (
        <div className="relative z-10 flex h-full flex-col items-center justify-center select-none">
          <span
            className="font-serif font-bold text-[--gold] transition-all duration-500"
            style={{
              fontSize: "clamp(1.5rem, 3.5vw, 2.8rem)",
              textShadow: "0 2px 10px rgba(0,0,0,0.6), 0 0 20px rgba(230,179,25,0.2)",
              transform: isOpen ? "scale(1.1)" : "scale(1)"
            }}
          >
            ${cell.value}
          </span>
          {isOpen && (
            <div className="mt-1 flex items-center gap-2">
              <div className="h-0.5 w-1.5 rounded-full bg-[--gold] animate-pulse" />
              <div className="text-[8px] font-bold tracking-widest-2 uppercase text-[--gold] opacity-80">OPEN</div>
              <div className="h-0.5 w-1.5 rounded-full bg-[--gold] animate-pulse" />
            </div>
          )}
        </div>
      )}

      {/* Disabled state */}
      {isDisabled && (
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <div className="h-1 w-8 rounded-full bg-[--text-muted]" />
        </div>
      )}
    </div>
  );
}
