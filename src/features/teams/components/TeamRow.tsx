import type { Team } from "@/types/team";
import { useBoardStore } from "@/store/boardStore";

interface TeamRowProps {
  team: Team;
  index: number;
  isActive: boolean;
  onSelect: (id: string) => void;
}

export function TeamRow({ team, index, isActive, onSelect }: TeamRowProps) {
  const updateScore  = useBoardStore((s) => s.updateScore);
  const setTeamName  = useBoardStore((s) => s.setTeamName);
  const setTeamColor = useBoardStore((s) => s.setTeamColor);
  const moveTeam     = useBoardStore((s) => s.moveTeam);
  const moveTeamTo   = useBoardStore((s) => s.moveTeamTo);
  const removeTeam   = useBoardStore((s) => s.removeTeam);
  const teamsCount   = useBoardStore((s) => s.teams.length);
  const teams = useBoardStore((s) => s.teams);

  const isFirst = index === 0;
  const isLast  = index === teamsCount - 1;
  const leader = teams.reduce((a, b) => b.score > a.score ? b : a, teams[0]);
  const isLeader = team.id === leader?.id && team.score > 0;

  const handleRemove = () => {
    if (teamsCount <= 1) { alert("At least one team is required."); return; }
    if (confirm(`Remove ${team.name}? Owned cells will be unclaimed.`)) removeTeam(team.id);
  };

  return (
    <div
      className={`glass-flat rounded-lg p-2 cursor-pointer transition-all ${
        isActive ? 'ring-1 ring-[--gold] border-[--gold]' : 'hover:border-[rgba(230,179,25,0.2)]'
      }`}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", team.id); e.dataTransfer.effectAllowed = "move"; }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (id) moveTeamTo(id, index); }}
      onClick={() => onSelect(team.id)}
    >
      <div className="flex items-center gap-1 mb-1 min-w-0">
        <span
          className="cursor-grab select-none text-[--text-muted] hover:text-[--text-secondary] transition-colors shrink-0"
          style={{ fontSize: "0.6rem" }} title="Drag to reorder"
          onClick={e => e.stopPropagation()}
        >
          ⠿
        </span>

        <input
          type="color"
          className="h-2.5 w-2.5 rounded-full cursor-pointer border-0 p-0 overflow-hidden shrink-0"
          style={{ background: team.color, boxShadow: `0 0 6px ${team.color}` }}
          value={team.color}
          onChange={(e) => { e.stopPropagation(); setTeamColor(team.id, e.target.value); }}
          title="Team color"
          onClick={(e) => e.stopPropagation()}
        />

        <input
          className="bg-transparent text-[10px] font-bold tracking-widest uppercase text-[--text-primary] truncate flex-1 min-w-0 focus:outline-none"
          value={team.name}
          onChange={(e) => { e.stopPropagation(); setTeamName(team.id, e.target.value); }}
          onClick={(e) => e.stopPropagation()}
          placeholder="Team name"
        />

        {isLeader &&
          <div className="leading-badge text-[7px] font-black tracking-widest uppercase text-[--gold] border border-[--border-strong] bg-[--gold-subtle] px-1 py-0.5 rounded ml-1 shrink-0">
            ★ LEAD
          </div>
        }
        
        <button
          className="text-[--danger] hover:text-[#fca5a5] ml-1 opacity-50 hover:opacity-100 shrink-0"
          title="Remove team"
          onClick={(e) => { e.stopPropagation(); handleRemove(); }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <div className="flex items-baseline gap-1.5 mb-1.5">
        <input
          type="number"
          className="bg-transparent font-serif tabular-nums text-[--text-primary] focus:outline-none"
          style={{ fontSize: 18, lineHeight: 1, width: "100%" }}
          value={team.score}
          onChange={(e) => {
            e.stopPropagation();
            const n = Number(e.target.value);
            if (!isNaN(n)) updateScore(team.id, n - team.score);
          }}
          onClick={(e) => e.stopPropagation()}
        />
        <div className="text-[8px] font-bold tracking-widest uppercase text-[--text-muted]">PTS</div>
      </div>

      <div className="flex items-center gap-0.5">
        {[100, 200, 500].map((v) => (
          <button
            key={`p${v}`}
            onClick={(e) => { e.stopPropagation(); updateScore(team.id, v); }}
            className="flex-1 text-[8px] font-bold tabular py-1 rounded bg-[rgba(52,211,153,0.06)] border border-[rgba(52,211,153,0.15)] text-[--success] hover:bg-[rgba(52,211,153,0.15)] transition-colors"
          >
            +{v}
          </button>
        ))}
        {[100, 200, 500].map((v) => (
          <button
            key={`m${v}`}
            onClick={(e) => { e.stopPropagation(); updateScore(team.id, -v); }}
            className="flex-1 text-[8px] font-bold tabular py-1 rounded bg-[rgba(248,113,113,0.06)] border border-[rgba(248,113,113,0.15)] text-[--danger] hover:bg-[rgba(248,113,113,0.15)] transition-colors"
          >
            -{v}
          </button>
        ))}
      </div>
    </div>
  );
}
