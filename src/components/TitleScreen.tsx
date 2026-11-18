import React from 'react';
import type { Difficulty, GameMode, QualityPreset, Team } from '../game/types';

interface TitleScreenProps {
  gameMode: GameMode;
  onGameModeChange: (mode: GameMode) => void;
  team: Team;
  onTeamChange: (team: Team) => void;
  difficulty: Difficulty;
  onDifficultyChange: (d: Difficulty) => void;
  quality: QualityPreset;
  onQualityChange: (q: QualityPreset) => void;
  onStart: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  gameMode,
  onGameModeChange,
  team,
  onTeamChange,
  difficulty,
  onDifficultyChange,
  quality,
  onQualityChange,
  onStart,
}) => {
  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-8 md:p-12 pointer-events-none">
      {/* Subtle left-side scrim for crisp typography contrast over 3D arena flyover */}
      <div
        className="fixed inset-y-0 left-0 w-full md:w-[540px] pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, rgba(11,14,20,0.92) 0%, rgba(11,14,20,0.72) 65%, rgba(11,14,20,0) 100%)',
        }}
      />

      {/* Main Left-Third Lockup */}
      <div className="relative z-10 max-w-md my-auto pointer-events-auto">
        {/* Custom Inline SVG Emblem + Title Lockup */}
        <div className="flex items-center gap-4 mb-5">
          <svg
            viewBox="0 0 64 64"
            className="w-14 h-14 shrink-0"
            aria-hidden="true"
          >
            <polygon
              points="32,3 59,18 59,46 32,61 5,46 5,18"
              fill="#141923"
              stroke="#e2a84b"
              strokeWidth="2.5"
            />
            {/* Tactical crosshair + operator silhouette */}
            <circle cx="32" cy="32" r="14" fill="none" stroke="#5d9cec" strokeWidth="2" />
            <line x1="32" y1="11" x2="32" y2="21" stroke="#f8fafc" strokeWidth="2.5" />
            <line x1="32" y1="43" x2="32" y2="53" stroke="#f8fafc" strokeWidth="2.5" />
            <line x1="11" y1="32" x2="21" y2="32" stroke="#f8fafc" strokeWidth="2.5" />
            <line x1="43" y1="32" x2="53" y2="32" stroke="#f8fafc" strokeWidth="2.5" />
            <circle cx="32" cy="32" r="3" fill="#e2a84b" />
          </svg>
          <div>
            <h1 className="font-display text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-none">
              CS2 TACTICAL
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              Dustline Arena · {gameMode === 'deathmatch' ? 'Deathmatch · 3:00 Instant Respawn' : 'First to 5 Rounds · Low-Spec Engine'}
            </p>
          </div>
        </div>

        {/* Game Mode & Team Side Selection */}
        <div className="mt-6 space-y-4">
          <div>
            <div className="text-xs font-semibold text-slate-400 mb-2">
              Game Mode
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-mode="defusal"
                onClick={() => onGameModeChange('defusal')}
                className={`px-3.5 py-2.5 text-left border transition-colors cursor-pointer ${
                  gameMode === 'defusal'
                    ? 'bg-[#1c2330] border-[#e2a84b] text-white'
                    : 'bg-[#12161f]/90 border-slate-700/80 text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="font-display text-base font-bold leading-tight">
                  Bomb Defusal
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  5 Rounds · Plant / Defuse C4
                </div>
              </button>
              <button
                type="button"
                data-mode="deathmatch"
                onClick={() => onGameModeChange('deathmatch')}
                className={`px-3.5 py-2.5 text-left border transition-colors cursor-pointer ${
                  gameMode === 'deathmatch'
                    ? 'bg-[#1c2330] border-[#e2a84b] text-white'
                    : 'bg-[#12161f]/90 border-slate-700/80 text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="font-display text-base font-bold leading-tight">
                  Deathmatch
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  3:00 Timer · Instant Respawn
                </div>
              </button>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-400 mb-2">
              Select Side
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onTeamChange('CT')}
                className={`px-4 py-3 text-left border transition-colors cursor-pointer ${
                  team === 'CT'
                    ? 'bg-[#1a2c44] border-[#5d9cec] text-white'
                    : 'bg-[#12161f]/90 border-slate-700/80 text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="font-display text-lg font-bold leading-tight text-[#7eb6ff]">
                  Counter-Terrorists
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Defend Sites · USP-S &amp; M4A4
                </div>
              </button>
              <button
                type="button"
                onClick={() => onTeamChange('T')}
                className={`px-4 py-3 text-left border transition-colors cursor-pointer ${
                  team === 'T'
                    ? 'bg-[#362815] border-[#e2a84b] text-white'
                    : 'bg-[#12161f]/90 border-slate-700/80 text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="font-display text-lg font-bold leading-tight text-[#f0b95e]">
                  Terrorists
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Plant C4 · Glock-18 &amp; AK-47
                </div>
              </button>
            </div>
          </div>

          {/* Difficulty & Potato-PC Render Tier */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold text-slate-400 mb-2">
                Bot Skill
              </div>
              <div className="flex bg-[#12161f]/90 border border-slate-700/80 p-1">
                <button
                  type="button"
                  onClick={() => onDifficultyChange('casual')}
                  className={`flex-1 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    difficulty === 'casual'
                      ? 'bg-slate-200 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Casual
                </button>
                <button
                  type="button"
                  onClick={() => onDifficultyChange('competitive')}
                  className={`flex-1 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    difficulty === 'competitive'
                      ? 'bg-slate-200 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Competitive
                </button>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-400 mb-2">
                PC Performance Preset
              </div>
              <div className="flex bg-[#12161f]/90 border border-slate-700/80 p-1">
                {(['potato', 'standard', 'high'] as QualityPreset[]).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => onQualityChange(q)}
                    className={`flex-1 py-1.5 text-xs font-semibold capitalize transition-colors cursor-pointer whitespace-nowrap ${
                      quality === q
                        ? 'bg-[#e2a84b] text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {q === 'potato' ? 'Potato' : q === 'standard' ? 'Std' : 'High'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Primary Start CTA */}
          <div className="pt-2">
            <button
              type="button"
              data-start="true"
              onClick={onStart}
              className="w-full py-3.5 px-6 bg-[#e2a84b] hover:bg-[#eab864] text-slate-950 font-display text-2xl font-extrabold tracking-wide uppercase transition-colors cursor-pointer shadow-lg"
            >
              Deploy to Match
            </button>
          </div>
        </div>
      </div>

      {/* Flat borderless inline control hint with subtle bottom contrast scrim */}
      <div
        className="fixed inset-x-0 bottom-0 h-20 pointer-events-none"
        style={{
          background:
            'linear-gradient(0deg, rgba(11,14,20,0.88) 0%, rgba(11,14,20,0) 100%)',
        }}
      />
      <div className="relative z-10 text-xs text-slate-200 hud-text-shadow">
        WASD Move · Shift Walk · Ctrl Crouch · Space Jump · Mouse Aim · LMB Fire · RMB Scope · B Buy Menu · R Reload · E Plant/Defuse · Tab Scoreboard
      </div>
    </div>
  );
};
