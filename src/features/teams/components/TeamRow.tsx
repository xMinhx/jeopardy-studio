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
  const updateScore  = useBoardStore((s) => s.updateScore);
  const setTeamName  = useBoardStore((s) => s.setTeamName);
  const setTeamColor = useBoardStore((s) => s.setTeamColor);
  const moveTeam     = useBoardStore((s) => s.moveTeam);
  const moveTeamTo   = useBoardStore((s) => s.moveTeamTo);
  const removeTeam   = useBoardStore((s) => s.removeTeam);
  const teamsCount   = useBoardStore((s) => s.teams.length);

  const isFirst = index === 0;
  const isLast  = index === teamsCount - 1;

  const handleRemove = () => {
    if (teamsCount <= 1) { alert("At least one team is required."); return; }
    if (confirm(`Remove ${team.name}? Owned cells will be unclaimed.`)) removeTeam(team.id);
  };

  return (
    <div
      className={`
        group flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5
        transition-all duration-150 cursor-pointer
        ${isActive
          ? "border-[--gold] bg-[--gold-subtle] ring-1 ring-[--gold] shadow-[0_0_16px_var(--gold-glow)]"
          : "border-[--border-subtle] bg-[--surface-raised] hover:bg-[--surface-overlay] hover:border-[--border-medium]"
        }
      `}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", team.id); e.dataTransfer.effectAllowed = "move"; }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (id) moveTeamTo(id, index); }}
      onClick={() => onSelect(team.id)}
    >
      {/* Left: drag handle + color + name */}
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Drag handle */}
        <span
          className="cursor-grab select-none text-[--text-muted] group-hover:text-[--text-secondary] transition-colors shrink-0"
          style={{ fontSize: "0.7rem", letterSpacing: "0.1em" }}
          title="Drag to reorder"
        >
          ⠿
        </span>

        {/* Color swatch */}
        <input
          type="color"
          className="h-6 w-7 cursor-pointer rounded border-0 p-0 overflow-hidden shrink-0"
          style={{ background: "transparent" }}
          value={team.color}
          onChange={(e) => { e.stopPropagation(); setTeamColor(team.id, e.target.value); }}
          title="Team color"
          onClick={(e) => e.stopPropagation()}
        />

        {/* Name input */}
        <input
          className="studio-input min-w-0 text-sm py-1.5"
          style={{ maxWidth: "10rem" }}
          value={team.name}
          onChange={(e) => { e.stopPropagation(); setTeamName(team.id, e.target.value); }}
          onClick={(e) => e.stopPropagation()}
          placeholder="Team name"
        />
      </div>

      {/* Right: score controls + reorder + remove */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Score − value + */}
        <button
          className="btn-icon"
          onClick={(e) => { e.stopPropagation(); updateScore(team.id, -100); }}
          title="−100"
        >
          −
        </button>
        <input
          type="number"
          className="studio-input text-right text-sm font-bold py-1.5"
          style={{
            width: "5.5rem",
            color: "var(--gold)",
            fontFamily: "var(--font-mono)",
          }}
          value={team.score}
          onChange={(e) => {
            e.stopPropagation();
            const n = Number(e.target.value);
            if (!isNaN(n)) updateScore(team.id, n - team.score);
          }}
          onClick={(e) => e.stopPropagation()}
        />
        <button
          className="btn-icon"
          onClick={(e) => { e.stopPropagation(); updateScore(team.id, 100); }}
          title="+100"
        >
          +
        </button>

        {/* Reorder arrows */}
        <div className="flex items-center gap-1 ml-1">
          <button
            className="btn-icon"
            title="Move up"
            disabled={isFirst}
            onClick={(e) => { e.stopPropagation(); moveTeam(team.id, -1); }}
            style={{ fontSize: "0.65rem" }}
          >
            ▲
          </button>
          <button
            className="btn-icon"
            title="Move down"
            disabled={isLast}
            onClick={(e) => { e.stopPropagation(); moveTeam(team.id, 1); }}
            style={{ fontSize: "0.65rem" }}
          >
            ▼
          </button>
        </div>

        {/* Remove */}
        <button
          className="btn-danger ml-1 py-1 px-2.5 text-[0.65rem]"
          title="Remove team"
          onClick={(e) => { e.stopPropagation(); handleRemove(); }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
