import type { Cell } from "@/types/cell";
import type { Team } from "@/types/team";

interface BoardCardProps {
  cell: Cell;
  owner?: Team;
  isActive: boolean;
}

/**
 * A single cell on the Display window's board.
 * Renders value, state label, ownership badge and visual styling.
 */
export function BoardCard({ cell, owner, isActive }: BoardCardProps) {
  const isClaimed = !!owner;
  const isOpen = cell.state === "open";
  const isDisabled = cell.state === "disabled";

  let modifierClass = "";
  if (isClaimed) modifierClass = "board-cell--claimed";
  else if (isDisabled) modifierClass = "board-cell--disabled";

  return (
    <div className={`board-cell w-full h-full ${modifierClass} ${isActive ? 'ring-2 ring-[--gold] shadow-[0_0_20px_var(--gold-glow)]' : ''}`}>
      {/* Ownership badge */}
      {owner && (
        <span
          className="absolute right-2 top-2 z-20 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur-sm"
          title={owner.name}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: owner.color }} />
          <span className="max-w-[80px] truncate">{owner.name}</span>
        </span>
      )}

      {/* Value + state label */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-1">
        <span className="text-[--gold] font-serif text-4xl font-bold drop-shadow-md">
          {cell.value}
        </span>
        
        {isOpen && (
          <span className="text-[9px] uppercase tracking-[0.2em] text-[--gold] opacity-80">
            Open
          </span>
        )}
      </div>
    </div>
  );
}
