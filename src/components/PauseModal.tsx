import React from 'react';
import type { QualityPreset } from '../game/types';

interface PauseModalProps {
  quality: QualityPreset;
  sensitivity: number;
  onQualityChange: (q: QualityPreset) => void;
  onSensitivityChange: (val: number) => void;
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  quality,
  sensitivity,
  onQualityChange,
  onSensitivityChange,
  onResume,
  onRestart,
  onReturnTitle,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md bg-[#0e121a] border border-slate-700 p-6 text-slate-100 shadow-2xl">
        <h2 className="font-display text-3xl font-extrabold uppercase tracking-wide text-white">
          Match Paused
        </h2>
        <p className="text-xs text-slate-400 mt-1 mb-5">
          Adjust PC performance or mouse sensitivity without leaving the match.
        </p>

        <div className="space-y-4 mb-6">
          <div>
            <div className="text-xs font-semibold text-slate-300 mb-1.5">
              Graphics Quality
            </div>
            <div className="flex bg-[#151a24] border border-slate-700 p-1">
              {(['potato', 'standard', 'high'] as QualityPreset[]).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onQualityChange(q)}
                  className={`flex-1 py-1.5 text-xs font-semibold cursor-pointer ${
                    quality === q ? 'bg-[#e2a84b] text-slate-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {q === 'potato' ? 'Potato (0.65x)' : q === 'standard' ? 'Standard' : 'High'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1.5">
              <label htmlFor="sens-slider">Mouse Sensitivity</label>
              <span className="font-mono-num">{(sensitivity * 1000).toFixed(1)}</span>
            </div>
            <input
              id="sens-slider"
              type="range"
              min="0.0008"
              max="0.005"
              step="0.0002"
              value={sensitivity}
              onChange={(e) => onSensitivityChange(parseFloat(e.target.value))}
              className="w-full accent-[#e2a84b] cursor-pointer"
            />
          </div>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-3 bg-[#e2a84b] hover:bg-[#eab864] text-slate-950 font-display text-xl font-extrabold uppercase tracking-wide cursor-pointer"
          >
            Resume Match
          </button>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onRestart}
              className="py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-sm font-semibold text-slate-100 cursor-pointer"
            >
              Restart Match
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className="py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sm font-semibold text-slate-300 cursor-pointer"
            >
              Main Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
