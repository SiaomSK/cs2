import React from 'react';
import type { HudSnapshot } from '../game/types';

interface GameOverModalProps {
  hud: HudSnapshot;
  onPlayAgain: () => void;
  onReturnTitle: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  hud,
  onPlayAgain,
  onReturnTitle,
}) => {
  const isDm = hud.gameMode === 'deathmatch';
  const isTie = hud.matchStats.winner === null;
  const playerWon = hud.matchStats.winner === hud.playerTeam;
  const hsRate =
    hud.matchStats.kills > 0
      ? Math.round((hud.matchStats.headshots / hud.matchStats.kills) * 100)
      : 0;
  const accuracy =
    hud.matchStats.shotsFired > 0
      ? Math.round((hud.matchStats.shotsHit / hud.matchStats.shotsFired) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-lg bg-[#0e121a] border border-slate-700 p-7 text-slate-100 shadow-2xl">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Match Complete · Dustline Arena{isDm ? ' · Deathmatch' : ''}
        </div>
        <h2
          className={`font-display text-5xl font-extrabold uppercase leading-none mt-1 ${
            isTie ? 'text-slate-200' : playerWon ? 'text-[#e2a84b]' : 'text-rose-400'
          }`}
        >
          {isTie ? 'Draw' : playerWon ? 'Victory' : 'Defeat'}
        </h2>
        <p className="text-sm text-slate-300 mt-1 mb-6">
          {isDm ? 'Final Kills' : 'Final Score'}: Counter-Terrorists {hud.ctScore} — {hud.tScore} Terrorists
        </p>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-[#151a24] border border-slate-800 p-3">
            <div className="text-[11px] text-slate-400">K / D</div>
            <div className="font-mono-num text-2xl font-bold text-white mt-0.5">
              {hud.matchStats.kills} / {hud.matchStats.deaths}
            </div>
          </div>
          <div className="bg-[#151a24] border border-slate-800 p-3">
            <div className="text-[11px] text-slate-400">Headshot %</div>
            <div className="font-mono-num text-2xl font-bold text-[#e2a84b] mt-0.5">
              {hsRate}%
            </div>
          </div>
          <div className="bg-[#151a24] border border-slate-800 p-3">
            <div className="text-[11px] text-slate-400">Accuracy</div>
            <div className="font-mono-num text-2xl font-bold text-[#7eb6ff] mt-0.5">
              {accuracy}%
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            data-start="true"
            onClick={onPlayAgain}
            className="flex-1 py-3 bg-[#e2a84b] hover:bg-[#eab864] text-slate-950 font-display text-2xl font-extrabold uppercase tracking-wide cursor-pointer"
          >
            Play Again
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="px-5 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-sm font-semibold text-slate-200 cursor-pointer"
          >
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
};
