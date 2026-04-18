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
  const { updateScore, setTeamName, setTeamColor, moveTeam, moveTeamTo, removeTeam } =
    useBoardStore();

  const teams = useBoardStore((s) => s.teams);
  const isFirst = index === 0;
  const isLast = index === teams.length - 1;

  const handleRemove = () => {
    if (teams.length <= 1) {
      alert("At least one team is required.");
      return;
    }
    if (confirm(`Remove ${team.name}? Owned cells will be unclaimed.`)) {
      removeTeam(team.id);
    }
  };

  return (
    <div
      className={`flex items-center justify-between rounded border p-2 hover:bg-slate-50 ${
        isActive ? "ring-2 ring-emerald-500" : ""
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
        <span className="cursor-grab select-none px-1 text-slate-400">::</span>

        <input
          type="color"
          className="h-6 w-8 cursor-pointer rounded border p-0"
          value={team.color}
          onChange={(e) => setTeamColor(team.id, e.target.value)}
          title="Team color"
          onClick={(e) => e.stopPropagation()}
        />

        <input
          className="w-44 rounded border px-2 py-1 text-sm"
          value={team.name}
          onChange={(e) => setTeamName(team.id, e.target.value)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          className="h-8 w-8 rounded bg-slate-100 font-bold hover:bg-slate-200"
          onClick={(e) => { e.stopPropagation(); updateScore(team.id, -100); }}
          title="Subtract 100"
        >
          -
        </button>
        <input
          type="number"
          className="w-20 rounded border px-2 py-1 text-right text-sm font-medium tabular-nums focus:ring-1 focus:ring-emerald-500"
          value={team.score}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (!isNaN(next)) updateScore(team.id, next - team.score);
          }}
          onClick={(e) => e.stopPropagation()}
        />
        <button
          className="h-8 w-8 rounded bg-slate-100 font-bold hover:bg-slate-200"
          onClick={(e) => { e.stopPropagation(); updateScore(team.id, 100); }}
          title="Add 100"
        >
          +
        </button>

        <div className="ml-1 flex items-center gap-1">
          <button
            className="rounded bg-slate-100 px-2 py-1 text-sm"
            title="Move up"
            disabled={isFirst}
            onClick={(e) => { e.stopPropagation(); moveTeam(team.id, -1); }}
          >
            ↑
          </button>
          <button
            className="rounded bg-slate-100 px-2 py-1 text-sm"
            title="Move down"
            disabled={isLast}
            onClick={(e) => { e.stopPropagation(); moveTeam(team.id, 1); }}
          >
            ↓
          </button>
        </div>

        <button
          className="ml-2 rounded bg-red-50 px-2 py-1 text-sm text-red-600 hover:bg-red-100"
          title="Remove team"
          onClick={(e) => { e.stopPropagation(); handleRemove(); }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}
