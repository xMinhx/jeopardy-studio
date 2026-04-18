import type { Team } from "@/types/team";
import { useBoardStore } from "@/store/boardStore";
import { useState, useEffect } from "react";

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
  const moveTeamTo   = useBoardStore((s) => s.moveTeamTo);
  const removeTeam   = useBoardStore((s) => s.removeTeam);
  const teamsCount   = useBoardStore((s) => s.teams.length);
  const teams = useBoardStore((s) => s.teams);

  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (confirmRemove) {
      const t = setTimeout(() => setConfirmRemove(false), 3000);
      return () => clearTimeout(t);
    }
  }, [confirmRemove]);

  const leader = teams.reduce((a, b) => b.score > a.score ? b : a, teams[0]);
  const isLeader = team.id === leader?.id && team.score > 0;

  const handleRemove = () => {
    if (teamsCount <= 1) return;
    if (!confirmRemove) {
      setConfirmRemove(true);
    } else {
      removeTeam(team.id);
    }
  };

  return (
    <div
      className={`relative flex flex-col gap-3 p-3.5 rounded-xl border transition-all duration-200 group ${
        isActive 
          ? 'border-[--gold] bg-[--surface-overlay] shadow-[0_0_20px_rgba(230,179,25,0.08)] ring-1 ring-[--gold]/30' 
          : 'border-[--border-strong] bg-[--surface-base] hover:border-[--border-subtle]'
      }`}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", team.id); e.dataTransfer.effectAllowed = "move"; }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (id) moveTeamTo(id, index); }}
      onClick={() => onSelect(team.id)}
    >
      {/* Leader Ribbon */}
      {isLeader && (
        <div className="absolute -right-1.5 -top-1.5 z-20 flex items-center gap-1 rounded-bl-lg rounded-tr-xl bg-gradient-to-br from-[--gold-bright] to-[--gold] px-2 py-1 text-[8px] font-black text-black shadow-lg">
          ★ LEADING
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2">
        <div 
          className="cursor-grab p-1 text-[--text-muted] hover:text-[--text-primary] transition-colors"
          title="Drag to reorder"
          onClick={e => e.stopPropagation()}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
            <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
          </svg>
        </div>

        <div className="relative h-4 w-4 shrink-0 rounded-full border border-[--border-strong] shadow-sm overflow-hidden" style={{ background: team.color }}>
          <input
            type="color"
            className="absolute inset-[-100%] cursor-pointer opacity-0"
            value={team.color}
            onChange={(e) => { e.stopPropagation(); setTeamColor(team.id, e.target.value); }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        <input
          className="min-w-0 flex-1 bg-transparent text-xs font-black tracking-widest uppercase text-[--text-primary] focus:outline-none"
          value={team.name}
          onChange={(e) => { e.stopPropagation(); setTeamName(team.id, e.target.value); }}
          onClick={(e) => e.stopPropagation()}
          placeholder="TEAM NAME"
        />

        <button
          className={`flex h-6 w-6 items-center justify-center rounded-lg transition-all ${
            confirmRemove ? 'bg-red-500 text-white' : 'text-[--text-muted] hover:bg-red-500/10 hover:text-red-400'
          }`}
          onClick={(e) => { e.stopPropagation(); handleRemove(); }}
        >
          {confirmRemove ? <span className="text-[7px] font-black">SURE?</span> : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          )}
        </button>
      </div>

      {/* Score Display */}
      <div className="flex items-center justify-between rounded-lg bg-[rgba(0,0,0,0.2)] px-3 py-2 border border-[--border-strong]/50">
        <div className="flex flex-col">
          <span className="text-[8px] font-black tracking-widest text-[--text-muted] uppercase">Current Score</span>
          <div className="flex items-baseline gap-1">
            <input
              type="number"
              className="w-24 bg-transparent font-serif text-2xl font-bold tabular-nums text-[--text-primary] focus:outline-none"
              value={team.score}
              onChange={(e) => {
                e.stopPropagation();
                const n = Number(e.target.value);
                if (!isNaN(n)) updateScore(team.id, n - team.score);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs font-black italic text-[--gold] opacity-80">PTX</span>
        </div>
      </div>

      {/* Quick Adjustments */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex gap-1">
            {[100, 200, 500].map((v) => (
              <button
                key={`p${v}`}
                onClick={(e) => { e.stopPropagation(); updateScore(team.id, v); }}
                className="flex-1 py-1.5 rounded-lg bg-[--success-subtle] border border-[--success]/20 text-[--success] text-[9px] font-black hover:bg-[--success]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                +{v}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {[100, 200, 500].map((v) => (
              <button
                key={`m${v}`}
                onClick={(e) => { e.stopPropagation(); updateScore(team.id, -v); }}
                className="flex-1 py-1.5 rounded-lg bg-[--danger-subtle] border border-[--danger]/20 text-[--danger] text-[9px] font-black hover:bg-[--danger]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                -{v}
              </button>
            ))}
          </div>
        </div>
        
        {/* Custom Quick Actions (Optional placeholder for more UX magic) */}
        <div className="flex flex-col justify-between">
           <button 
             className="flex-1 rounded-lg border border-[--border-strong] bg-[--surface-base] text-[8px] font-black text-[--text-secondary] hover:bg-[--surface-overlay] hover:text-[--text-primary] transition-all"
             onClick={(e) => { e.stopPropagation(); updateScore(team.id, -team.score); }}
           >
             RESET SCORE
           </button>
        </div>
      </div>
    </div>
  );
}
  );
}
