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

  const teamColor = owner?.color ?? "#6366f1";

  const bgAvailable = "linear-gradient(145deg, #6d86ff 0%, #8b5cf6 85%)";
  const bgDisabled = "linear-gradient(155deg,#475569,#1f2937)";
  const bgOpen = "linear-gradient(150deg,#0f172a,#1d4ed8)";
  const bgClaimed = `linear-gradient(150deg, ${teamColor}22 0%, transparent 60%), linear-gradient(155deg,#0b1220,#121a2b)`;

  const bg = isClaimed
    ? bgClaimed
    : isDisabled
      ? bgDisabled
      : isOpen
        ? bgOpen
        : bgAvailable;

  const boxShadow = isClaimed
    ? `0 12px 28px ${teamColor}33`
    : isActive
      ? "0 0 0 3px rgba(255,255,255,0.35), 0 12px 28px rgba(0,0,0,0.35)"
      : "0 12px 28px rgba(0,0,0,0.25)";

  return (
    <div
      className="relative h-full overflow-hidden rounded-[26px] text-center text-white"
      style={{ background: bg, boxShadow }}
    >
      {/* Subtle flare for available cells */}
      {!isDisabled && !isOpen && (
        <div
          className="absolute inset-0 z-0 opacity-10"
          style={{
            background:
              "radial-gradient(60% 60% at 30% 20%, rgba(255,255,255,0.9), transparent 60%)",
          }}
        />
      )}

      {/* Safe-area frame */}
      <div className="absolute inset-[14px] rounded-[20px]">
        {/* Ownership badge */}
        {owner && (
          <span
            className="absolute right-1.5 top-1.5 z-20 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-[6px] text-[11px] font-medium text-white ring-1 ring-white/15 backdrop-blur-sm"
            title={owner.name}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: teamColor }}
            />
            <span className="max-w-[120px] truncate">{owner.name}</span>
          </span>
        )}

        {/* Value + state label */}
        <div className="relative z-10 flex h-full flex-col items-center justify-center gap-1">
          <span className="text-5xl font-extrabold leading-[0.95] text-white/95 drop-shadow-[0_8px_18px_rgba(15,23,42,0.55)]">
            {cell.value}
          </span>

          {isOpen && (
            <span className="mt-0.5 text-[10px] uppercase tracking-wide text-white/70">
              Open
            </span>
          )}
          {isDisabled && (
            <span className="mt-0.5 text-[10px] uppercase tracking-wide text-white/60">
              Disabled
            </span>
          )}
        </div>
      </div>

      {/* Border ring */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[26px]"
        style={{
          boxShadow: isClaimed
            ? `inset 0 0 0 2px ${teamColor}, 0 4px 12px ${teamColor}33`
            : "inset 0 0 0 1px rgba(255,255,255,0.10)",
        }}
      />

      {/* Dim overlay for disabled */}
      {isDisabled && (
        <div className="pointer-events-none absolute inset-0 z-10 rounded-[26px] bg-slate-950/40" />
      )}
    </div>
  );
}
