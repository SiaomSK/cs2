import React from 'react';
import { Pause, ShoppingCart, Volume2, VolumeX } from 'lucide-react';
import type { HudSnapshot, WeaponSlot } from '../game/types';
import { WEAPON_SPECS } from '../game/weapons';
import { RadarMinimap } from './RadarMinimap';

interface GameHUDProps {
  hud: HudSnapshot;
  muted: boolean;
  onToggleMute: () => void;
  onTogglePause: () => void;
  onOpenBuy: () => void;
  onSwitchSlot: (slot: WeaponSlot) => void;
}

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  hud,
  muted,
  onToggleMute,
  onTogglePause,
  onOpenBuy,
  onSwitchSlot,
}) => {
  const activeWid = hud.weapons[hud.activeSlot] || 'knife';
  const activeSpec = WEAPON_SPECS[activeWid];
  const activeAmmo = hud.ammo[hud.activeSlot];
  const isDm = hud.gameMode === 'deathmatch';

  // Dynamic crosshair gap in pixels based on spread
  const gapPx = Math.round(5 + hud.crosshairSpread * 360);
  const crossColor = hud.hitmarkerType === 'kill' ? '#ef4444' : '#4ade80';

  const slots: { slot: WeaponSlot; key: string }[] = [
    { slot: 'primary', key: '1' },
    { slot: 'secondary', key: '2' },
    { slot: 'knife', key: '3' },
    { slot: 'utility', key: '4' },
  ];

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none">
      {/* Damage peripheral vignette */}
      {hud.damageFlash > 0.02 && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            boxShadow: `inset 0 0 110px rgba(220, 38, 38, ${Math.min(0.85, hud.damageFlash)})`,
          }}
        />
      )}

      {/* Critical low HP subtle vignette */}
      {hud.hp > 0 && hud.hp <= 25 && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ boxShadow: 'inset 0 0 90px rgba(185, 28, 28, 0.45)' }}
        />
      )}

      {/* Flashbang blind overlay */}
      {hud.flashAlpha > 0.01 && (
        <div
          className="fixed inset-0 bg-white pointer-events-none"
          style={{ opacity: Math.min(0.96, hud.flashAlpha) }}
        />
      )}

      {/* AWP Sniper Scope Overlay */}
      {hud.isScoped && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center">
          <div
            className="w-full h-full relative"
            style={{
              background:
                'radial-gradient(circle at center, transparent 34%, rgba(5, 7, 10, 0.98) 35%)',
            }}
          >
            <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-black/80" />
            <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-black/80" />
          </div>
        </div>
      )}

      {/* Center Dynamic Crosshair & Hitmarker */}
      {hud.hp > 0 && !hud.isScoped && (
        <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="relative w-1 h-1">
            {/* Top */}
            <div
              className="absolute left-1/2 -translate-x-1/2 w-[2px] h-[8px]"
              style={{
                bottom: `${gapPx}px`,
                backgroundColor: crossColor,
                boxShadow: '0 0 2px rgba(0,0,0,0.9)',
              }}
            />
            {/* Bottom */}
            <div
              className="absolute left-1/2 -translate-x-1/2 w-[2px] h-[8px]"
              style={{
                top: `${gapPx}px`,
                backgroundColor: crossColor,
                boxShadow: '0 0 2px rgba(0,0,0,0.9)',
              }}
            />
            {/* Left */}
            <div
              className="absolute top-1/2 -translate-y-1/2 h-[2px] w-[8px]"
              style={{
                right: `${gapPx}px`,
                backgroundColor: crossColor,
                boxShadow: '0 0 2px rgba(0,0,0,0.9)',
              }}
            />
            {/* Right */}
            <div
              className="absolute top-1/2 -translate-y-1/2 h-[2px] w-[8px]"
              style={{
                left: `${gapPx}px`,
                backgroundColor: crossColor,
                boxShadow: '0 0 2px rgba(0,0,0,0.9)',
              }}
            />
          </div>
        </div>
      )}

      {/* Hitmarker X */}
      {hud.hitmarkerType !== 'none' && (
        <svg
          viewBox="0 0 32 32"
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 pointer-events-none"
        >
          <g
            stroke={
              hud.hitmarkerType === 'kill'
                ? '#ef4444'
                : hud.hitmarkerType === 'head'
                ? '#facc15'
                : '#ffffff'
            }
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <line x1="5" y1="5" x2="11" y2="11" />
            <line x1="27" y1="5" x2="21" y2="11" />
            <line x1="5" y1="27" x2="11" y2="21" />
            <line x1="27" y1="27" x2="21" y2="21" />
          </g>
        </svg>
      )}

      {/* Top-Left: Radar + Money + Buy Prompt */}
      <div className="fixed top-4 left-4 flex flex-col gap-2">
        <RadarMinimap
          blips={hud.radarBlips}
          playerPos={hud.playerPos}
          bomb={hud.bomb}
        />
        <div className="bg-[#0e121a]/85 border border-slate-700/70 px-3 py-1.5 w-[148px]">
          {isDm ? (
            <>
              <div className="font-display text-sm font-bold text-[#e2a84b] uppercase leading-tight">
                Deathmatch
              </div>
              <div className="text-[11px] font-semibold text-slate-300">
                Press [B] Free Loadout
              </div>
            </>
          ) : (
            <>
              <div className="font-mono-num text-lg font-bold text-emerald-400 leading-tight">
                ${hud.money.toLocaleString()}
              </div>
              {hud.inBuyZone && (
                <div className="text-[11px] font-semibold text-[#e2a84b]">
                  Press [B] to Buy ({hud.buyTimer}s)
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Top-Center: Round Scoreboard & Alive Pips */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
        {/* CT Alive Pips (Defusal only) */}
        {!isDm && (
          <div className="flex items-center gap-1 bg-[#0e121a]/85 border border-slate-700/70 px-2.5 py-2">
            {hud.ctAlivePips.map((alive, idx) => (
              <span
                key={idx}
                className={`w-2.5 h-5 border ${
                  alive
                    ? 'bg-[#5d9cec] border-[#93c5fd]'
                    : 'bg-slate-900 border-slate-700 opacity-45'
                }`}
              />
            ))}
          </div>
        )}

        {/* Scores + Timer */}
        <div className="flex items-center bg-[#0e121a]/90 border border-slate-700/80">
          <div className="px-3.5 py-1.5 text-center border-r border-slate-800">
            <div className="font-mono-num text-2xl font-extrabold text-[#6da9f5] leading-none">
              {hud.ctScore}
            </div>
          </div>

          <div className="px-4 py-1 text-center min-w-[84px]">
            {!isDm && hud.bomb.status === 'planted' ? (
              <div className="font-mono-num text-xl font-extrabold text-rose-400 leading-tight">
                {Math.max(0, hud.bomb.timer).toFixed(1)}s
              </div>
            ) : (
              <div className="font-mono-num text-xl font-extrabold text-white leading-tight">
                {formatClock(hud.roundTimer)}
              </div>
            )}
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              {isDm
                ? 'DM'
                : hud.bomb.status === 'planted'
                ? `C4 Site ${hud.bomb.site}`
                : `Rnd ${hud.roundNumber}`}
            </div>
          </div>

          <div className="px-3.5 py-1.5 text-center border-l border-slate-800">
            <div className="font-mono-num text-2xl font-extrabold text-[#e2a84b] leading-none">
              {hud.tScore}
            </div>
          </div>
        </div>

        {/* T Alive Pips (Defusal only) */}
        {!isDm && (
          <div className="flex items-center gap-1 bg-[#0e121a]/85 border border-slate-700/70 px-2.5 py-2">
            {hud.tAlivePips.map((alive, idx) => (
              <span
                key={idx}
                className={`w-2.5 h-5 border ${
                  alive
                    ? 'bg-[#e2a84b] border-[#fcd34d]'
                    : 'bg-slate-900 border-slate-700 opacity-45'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Top-Right: Utility Controls + Kill Feed */}
      <div className="fixed top-4 right-4 flex flex-col items-end gap-3">
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {hud.inBuyZone && (
            <button
              type="button"
              tabIndex={-1}
              aria-label="Open Buy Menu (B)"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenBuy();
              }}
              className="h-9 px-3 flex items-center gap-1.5 bg-[#0e121a]/85 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-[#e2a84b] cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Buy [B]</span>
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            aria-label={muted ? 'Unmute Audio (M)' : 'Mute Audio (M)'}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="w-9 h-9 flex items-center justify-center bg-[#0e121a]/85 hover:bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Pause Match (P)"
            onClick={(e) => {
              e.currentTarget.blur();
              onTogglePause();
            }}
            className="w-9 h-9 flex items-center justify-center bg-[#0e121a]/85 hover:bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>

        {/* Live Kill Feed */}
        <div className="flex flex-col items-end gap-1.5">
          {hud.killFeed.map((kf) => (
            <div
              key={kf.id}
              className="bg-[#0e121a]/82 border border-slate-700/70 px-3 py-1 text-xs flex items-center gap-2"
            >
              <span
                className={
                  kf.killerTeam === 'CT' ? 'text-[#7eb6ff] font-semibold' : 'text-[#f0b95e] font-semibold'
                }
              >
                {kf.killerName}
              </span>
              <span className="text-slate-400">
                [{WEAPON_SPECS[kf.weaponId].name}
                {kf.headshot ? ' · HS' : ''}]
              </span>
              <span
                className={
                  kf.victimTeam === 'CT' ? 'text-[#7eb6ff] font-semibold' : 'text-[#f0b95e] font-semibold'
                }
              >
                {kf.victimName}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Round Banner / Bomb Prompts */}
      {hud.roundBanner && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-[#0e121a]/90 border border-slate-700 px-6 py-2.5 text-center">
          <div
            className={`font-display text-2xl font-extrabold uppercase tracking-wide ${
              hud.roundBanner.team === 'CT'
                ? 'text-[#7eb6ff]'
                : hud.roundBanner.team === 'T'
                ? 'text-[#f0b95e]'
                : 'text-white'
            }`}
          >
            {hud.roundBanner.title}
          </div>
          <div className="text-xs text-slate-300">{hud.roundBanner.subtitle}</div>
        </div>
      )}

      {/* Action Prompts: Reload / Plant / Defuse / Aim hint */}
      <div className="fixed bottom-28 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        {hud.isReloading && (
          <div className="bg-[#0e121a]/90 border border-slate-700 px-4 py-1.5 w-48">
            <div className="text-[11px] font-semibold text-slate-200 mb-1 text-center">
              Reloading...
            </div>
            <div className="h-1.5 bg-slate-800 w-full">
              <div
                className="h-full bg-[#e2a84b]"
                style={{ width: `${Math.round(hud.reloadProgress * 100)}%` }}
              />
            </div>
          </div>
        )}

        {!isDm && hud.bomb.plantProgress > 0.02 && (
          <div className="bg-[#0e121a]/90 border border-[#e2a84b] px-4 py-1.5 w-52">
            <div className="text-[11px] font-semibold text-[#f0b95e] mb-1 text-center">
              Planting C4...
            </div>
            <div className="h-1.5 bg-slate-800 w-full">
              <div
                className="h-full bg-[#e2a84b]"
                style={{ width: `${Math.round(hud.bomb.plantProgress * 100)}%` }}
              />
            </div>
          </div>
        )}

        {!isDm && hud.bomb.defuseProgress > 0.02 && (
          <div className="bg-[#0e121a]/90 border border-[#5d9cec] px-4 py-1.5 w-52">
            <div className="text-[11px] font-semibold text-[#7eb6ff] mb-1 text-center">
              Defusing C4...
            </div>
            <div className="h-1.5 bg-slate-800 w-full">
              <div
                className="h-full bg-[#5d9cec]"
                style={{ width: `${Math.round(hud.bomb.defuseProgress * 100)}%` }}
              />
            </div>
          </div>
        )}

        {!isDm && hud.hp > 0 && hud.hasBomb && hud.inBombSite && hud.bomb.plantProgress <= 0.02 && (
          <div className="bg-[#0e121a]/88 border border-[#e2a84b]/80 px-4 py-1 text-xs font-semibold text-[#f0b95e]">
            Hold [E] to plant C4 at Site {hud.inBombSite}
          </div>
        )}

        {!isDm && hud.hp > 0 && hud.canDefuse && hud.bomb.defuseProgress <= 0.02 && (
          <div className="bg-[#0e121a]/88 border border-[#5d9cec]/80 px-4 py-1 text-xs font-semibold text-[#7eb6ff]">
            Hold [E] to defuse C4
          </div>
        )}

        {isDm && hud.hp > 0 && hud.spawnProtected && (
          <div className="bg-[#0e121a]/88 border border-emerald-400/70 px-4 py-1 text-xs font-semibold text-emerald-300">
            Spawn Protection Active
          </div>
        )}

        {hud.hp <= 0 && (
          <div className="bg-[#0e121a]/90 border border-rose-500/70 px-5 py-2 text-sm font-semibold text-rose-300">
            {isDm ? 'Eliminated · Respawning...' : 'Eliminated · Waiting for round end'}
          </div>
        )}
      </div>

      {/* Bottom-Left: CS2 Health & Kevlar Panel */}
      <div className="fixed bottom-4 left-4 bg-[#0e121a]/88 border border-slate-700/80 px-4 py-3 min-w-[235px]">
        <div className="flex items-end justify-between gap-6">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Health
            </div>
            <div
              className={`font-mono-num text-4xl font-extrabold leading-none ${
                hud.hp <= 25 ? 'text-rose-400' : 'text-white'
              }`}
            >
              {hud.hp}
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {hud.hasHelmet ? 'Kevlar + Helmet' : 'Kevlar'}
            </div>
            <div className="font-mono-num text-2xl font-bold text-[#7eb6ff] leading-none">
              {hud.armor}
            </div>
          </div>
        </div>
        <div className="mt-2.5 h-1.5 bg-slate-800 w-full overflow-hidden">
          <div
            className={`h-full ${hud.hp <= 25 ? 'bg-rose-500' : 'bg-emerald-400'}`}
            style={{ width: `${Math.max(0, Math.min(100, hud.hp))}%` }}
          />
        </div>
      </div>

      {/* Bottom-Right: Weapon, Ammo & Slot Switcher */}
      <div className="fixed bottom-4 right-4 flex flex-col items-end gap-2">
        {/* Slots 1-4 */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {slots.map(({ slot, key }) => {
            const wid = hud.weapons[slot];
            if (!wid) return null;
            if (slot === 'utility' && hud.ammo.utility.clip <= 0) return null;
            const active = hud.activeSlot === slot;
            return (
              <button
                key={slot}
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onSwitchSlot(slot);
                }}
                className={`px-2.5 py-1 text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#e2a84b] border-[#fcd34d] text-slate-950 font-bold'
                    : 'bg-[#0e121a]/85 border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                [{key}] {WEAPON_SPECS[wid].name}
              </button>
            );
          })}
        </div>

        {/* Active Weapon & Ammo Readout */}
        <div className="bg-[#0e121a]/88 border border-slate-700/80 px-4 py-3 min-w-[235px] flex items-end justify-between gap-5">
          <div>
            <div className="font-display text-xl font-bold text-white leading-none">
              {activeSpec.name}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {!isDm && hud.hasBomb && hud.playerTeam === 'T' ? 'Carrying C4' : activeSpec.slot.toUpperCase()}
            </div>
          </div>

          {activeSpec.magSize > 0 ? (
            <div className="text-right font-mono-num leading-none">
              <span className="text-4xl font-extrabold text-white">{activeAmmo.clip}</span>
              <span className="text-lg text-slate-400 ml-1.5">/ {activeAmmo.reserve}</span>
            </div>
          ) : (
            <div className="font-mono-num text-xl font-bold text-slate-300">—</div>
          )}
        </div>
      </div>
    </div>
  );
};
