import React from 'react';
import type { HudSnapshot, Team } from '../game/types';

interface ScoreboardProps {
  hud: HudSnapshot;
}

export const Scoreboard: React.FC<ScoreboardProps> = ({ hud }) => {
  const renderTeamTable = (team: Team, title: string, accent: string) => {
    const rows = hud.scoreboard
      .filter((r) => r.team === team)
      .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);

    return (
      <div>
        <div className={`font-display text-lg font-bold uppercase mb-2 ${accent}`}>
          {title} · {team === 'CT' ? hud.ctScore : hud.tScore}
        </div>
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
              <th className="py-1.5">Operator</th>
              <th className="py-1.5 text-right font-mono-num">K</th>
              <th className="py-1.5 text-right font-mono-num">D</th>
              <th className="py-1.5 text-right font-mono-num">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className={`border-b border-slate-800/60 ${
                  r.isPlayer ? 'bg-white/5 font-semibold text-white' : 'text-slate-300'
                }`}
              >
                <td className="py-2">{r.name}</td>
                <td className="py-2 text-right font-mono-num">{r.kills}</td>
                <td className="py-2 text-right font-mono-num">{r.deaths}</td>
                <td className="py-2 text-right text-xs">
                  {r.alive ? (
                    <span className="text-emerald-400">Alive</span>
                  ) : (
                    <span className="text-slate-500">Eliminated</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/55 p-4 pointer-events-none">
      <div className="w-full max-w-3xl bg-[#0e121a] border border-slate-700 p-6 shadow-2xl">
        <div className="flex items-baseline justify-between border-b border-slate-800 pb-3 mb-5">
          <h2 className="font-display text-2xl font-extrabold uppercase text-white">
            Match Scoreboard · Dustline
          </h2>
          <span className="text-xs font-mono-num text-slate-400">
            {hud.gameMode === 'deathmatch'
              ? 'Deathmatch · 3:00'
              : `Round ${hud.roundNumber} · First to 5`}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {renderTeamTable('CT', 'Counter-Terrorists', 'text-[#7eb6ff]')}
          {renderTeamTable('T', 'Terrorists', 'text-[#f0b95e]')}
        </div>
      </div>
    </div>
  );
};
