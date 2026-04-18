import type { Team } from "@/types/team";
import { useBoardStore } from "@/store/boardStore";

interface TeamRowProps {
  team: Team;
  index: number;
  isActive: boolean;
  onSelect: (id: string) => void;
}

/**
 * A single row in the Control window's team list.
 * Shows color picker, editable name, score adjustment and move/remove actions.
 * Supports drag-and-drop reordering.
 */
export function TeamRow({ team, index, isActive, onSelect }: TeamRowProps) {
  const updateScore = useBoardStore((s) => s.updateScore);
  const setTeamName = useBoardStore((s) => s.setTeamName);
  const setTeamColor = useBoardStore((s) => s.setTeamColor);
  const moveTeam = useBoardStore((s) => s.moveTeam);
  const moveTeamTo = useBoardStore((s) => s.moveTeamTo);
  const removeTeam = useBoardStore((s) => s.removeTeam);
  const teamsCount = useBoardStore((s) => s.teams.length);

  const isFirst = index === 0;
  const isLast = index === teamsCount - 1;

  const handleRemove = () => {
    if (teamsCount <= 1) {
      alert("At least one team is required.");
      return;
    }
    if (confirm(`Remove ${team.name}? Owned cells will be unclaimed.`)) {
      removeTeam(team.id);
    }
  };

  return (
    <div
      className={`flex items-center justify-between rounded border p-2 transition-colors hover:bg-[--surface-overlay] ${
        isActive ? "border-[--gold] bg-[--gold] bg-opacity-10 ring-1 ring-[--gold]" : "border-[--border-subtle] bg-[--surface-base]"
      }`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", team.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData("text/plain");
        if (draggedId) moveTeamTo(draggedId, index);
      }}
      onClick={() => onSelect(team.id)}
    >
      <div className="flex items-center gap-3">
        <span className="cursor-grab select-none px-1 text-[--text-muted]">::</span>

        <input
          type="color"
          className="h-6 w-8 cursor-pointer rounded border border-[--border-strong] bg-transparent p-0 overflow-hidden"
          value={team.color}
          onChange={(e) => { e.stopPropagation(); setTeamColor(team.id, e.target.value); }}
          title="Team color"
          onClick={(e) => e.stopPropagation()}
        />

        <input
          className="w-44 rounded border border-[--border-strong] bg-[--surface-input] px-3 py-1.5 text-sm text-[--text-primary] focus:border-[--gold] focus:outline-none"
          value={team.name}
          onChange={(e) => { e.stopPropagation(); setTeamName(team.id, e.target.value); }}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          className="h-8 w-8 rounded bg-[--surface-input] font-bold text-[--text-primary] hover:bg-[--surface-highlight]"
          onClick={(e) => { e.stopPropagation(); updateScore(team.id, -100); }}
          title="Subtract 100"
        >
          -
        </button>
        <input
          type="number"
          className="w-20 rounded border border-[--border-strong] bg-[--surface-input] px-2 py-1.5 text-right text-sm font-medium tabular-nums text-[--gold] focus:border-[--gold] focus:outline-none"
          value={team.score}
          onChange={(e) => {
            e.stopPropagation();
            const next = Number(e.target.value);
            if (!isNaN(next)) updateScore(team.id, next - team.score);
          }}
          onClick={(e) => e.stopPropagation()}
        />
        <button
          className="h-8 w-8 rounded bg-[--surface-input] font-bold text-[--text-primary] hover:bg-[--surface-highlight]"
          onClick={(e) => { e.stopPropagation(); updateScore(team.id, 100); }}
          title="Add 100"
        >
          +
        </button>

        <div className="ml-1 flex items-center gap-1">
          <button
            className="rounded bg-[--surface-input] px-2 py-1 text-sm text-[--text-primary] disabled:opacity-30 hover:bg-[--surface-highlight]"
            title="Move up"
            disabled={isFirst}
            onClick={(e) => { e.stopPropagation(); moveTeam(team.id, -1); }}
          >
            ^
          </button>
          <button
            className="rounded bg-[--surface-input] px-2 py-1 text-sm text-[--text-primary] disabled:opacity-30 hover:bg-[--surface-highlight]"
            title="Move down"
            disabled={isLast}
            onClick={(e) => { e.stopPropagation(); moveTeam(team.id, 1); }}
          >
            v
          </button>
        </div>

        <button
          className="ml-2 rounded border border-red-500/30 bg-transparent px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-red-400 hover:bg-red-500/10"
          title="Remove team"
          onClick={(e) => { e.stopPropagation(); handleRemove(); }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}
