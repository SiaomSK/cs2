import React from 'react';
import { X } from 'lucide-react';
import type { HudSnapshot, WeaponId } from '../game/types';
import { BUY_CATALOG, KEVLAR_HELMET_PRICE, KEVLAR_PRICE, WEAPON_SPECS } from '../game/weapons';

interface BuyMenuProps {
  hud: HudSnapshot;
  onBuyWeapon: (id: WeaponId) => void;
  onBuyArmor: (withHelmet: boolean) => void;
  onClose: () => void;
}

export const BuyMenu: React.FC<BuyMenuProps> = ({
  hud,
  onBuyWeapon,
  onBuyArmor,
  onClose,
}) => {
  const pistols = BUY_CATALOG.filter((id) => WEAPON_SPECS[id].slot === 'secondary');
  const primaries = BUY_CATALOG.filter((id) => WEAPON_SPECS[id].slot === 'primary');
  const utilities = BUY_CATALOG.filter((id) => WEAPON_SPECS[id].slot === 'utility');

  const isDm = hud.gameMode === 'deathmatch';
  const canBuyAny = isDm || (hud.inBuyZone && hud.roundPhase === 'buy');

  const renderWeaponCard = (id: WeaponId) => {
    const spec = WEAPON_SPECS[id];
    const teamBlocked = !isDm && Boolean(spec.teamLock && spec.teamLock !== hud.playerTeam);
    const owned = hud.weapons[spec.slot] === id;
    const affordable = isDm || hud.money >= spec.price;
    const disabled = !canBuyAny || teamBlocked || !affordable || owned;

    return (
      <button
        key={id}
        type="button"
        disabled={disabled}
        onClick={() => onBuyWeapon(id)}
        className={`w-full text-left p-3 border transition-colors ${
          owned
            ? 'bg-[#1c2836] border-[#5d9cec] text-white'
            : disabled
            ? 'bg-[#12161f]/75 border-slate-800 text-slate-500 cursor-not-allowed'
            : 'bg-[#151a24] border-slate-700 hover:border-[#e2a84b] hover:bg-[#1c2230] text-slate-100 cursor-pointer'
        }`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-lg font-bold leading-none">{spec.name}</span>
          <span className="font-mono-num text-sm font-bold text-[#e2a84b]">
            {isDm ? 'FREE' : `$${spec.price}`}
          </span>
        </div>
        <div className="text-xs text-slate-400 mt-1">{spec.description}</div>
        <div className="flex items-center gap-3 mt-2 text-[11px] font-mono-num text-slate-300">
          {spec.damage > 0 && <span>DMG {spec.damage}</span>}
          {spec.magSize > 0 && <span>MAG {spec.magSize}/{spec.reserveMax}</span>}
          {owned && <span className="text-[#7eb6ff] font-sans font-semibold">Equipped</span>}
          {teamBlocked && <span className="text-rose-400 font-sans">{spec.teamLock} Only</span>}
        </div>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/65 p-4">
      <div className="w-full max-w-4xl bg-[#0e121a] border border-slate-700 p-6 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
          <div>
            <h2 className="font-display text-3xl font-extrabold tracking-wide uppercase leading-none">
              Tactical Armory
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {isDm
                ? 'Deathmatch · Free loadout anytime (both teams unlocked)'
                : canBuyAny
                ? `Buy phase active · ${hud.buyTimer}s remaining`
                : 'Must be in spawn buy zone during buy phase'}
            </p>
          </div>
          <div className="flex items-center gap-5">
            <div className="text-right">
              <div className="text-[11px] text-slate-400">
                {isDm ? 'Loadout Mode' : 'Available Funds'}
              </div>
              <div className="font-mono-num text-2xl font-bold text-emerald-400">
                {isDm ? 'FREE' : `$${hud.money.toLocaleString()}`}
              </div>
            </div>
            <button
              type="button"
              aria-label="Close Buy Menu"
              onClick={onClose}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Column 1: Pistols */}
          <div className="space-y-2.5">
            <h3 className="font-display text-sm font-bold tracking-wider uppercase text-slate-400">
              Sidearms
            </h3>
            {pistols.map(renderWeaponCard)}
          </div>

          {/* Column 2: SMGs & Rifles */}
          <div className="space-y-2.5">
            <h3 className="font-display text-sm font-bold tracking-wider uppercase text-slate-400">
              SMGs &amp; Rifles
            </h3>
            {primaries.map(renderWeaponCard)}
          </div>

          {/* Column 3: Armor & Utility */}
          <div className="space-y-2.5">
            <h3 className="font-display text-sm font-bold tracking-wider uppercase text-slate-400">
              Gear &amp; Utility
            </h3>
            <button
              type="button"
              disabled={!canBuyAny || hud.armor >= 100 || (!isDm && hud.money < KEVLAR_PRICE)}
              onClick={() => onBuyArmor(false)}
              className={`w-full text-left p-3 border transition-colors ${
                hud.armor >= 100
                  ? 'bg-[#1c2836] border-[#5d9cec] text-white'
                  : !canBuyAny || (!isDm && hud.money < KEVLAR_PRICE)
                  ? 'bg-[#12161f]/75 border-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-[#151a24] border-slate-700 hover:border-[#e2a84b] text-slate-100 cursor-pointer'
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span className="font-display text-lg font-bold">Kevlar Vest</span>
                <span className="font-mono-num text-sm font-bold text-[#e2a84b]">
                  {isDm ? 'FREE' : `$${KEVLAR_PRICE}`}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-1">Body armor reduction</div>
            </button>

            <button
              type="button"
              disabled={
                !canBuyAny ||
                (hud.armor >= 100 && hud.hasHelmet) ||
                (!isDm && hud.money < (hud.armor > 0 ? 350 : KEVLAR_HELMET_PRICE))
              }
              onClick={() => onBuyArmor(true)}
              className={`w-full text-left p-3 border transition-colors ${
                hud.armor >= 100 && hud.hasHelmet
                  ? 'bg-[#1c2836] border-[#5d9cec] text-white'
                  : !canBuyAny || (!isDm && hud.money < (hud.armor > 0 ? 350 : KEVLAR_HELMET_PRICE))
                  ? 'bg-[#12161f]/75 border-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-[#151a24] border-slate-700 hover:border-[#e2a84b] text-slate-100 cursor-pointer'
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span className="font-display text-lg font-bold">Kevlar + Helmet</span>
                <span className="font-mono-num text-sm font-bold text-[#e2a84b]">
                  {isDm ? 'FREE' : `$${hud.armor > 0 ? 350 : KEVLAR_HELMET_PRICE}`}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-1">Protects against pistol headshots</div>
            </button>

            {utilities.map(renderWeaponCard)}
          </div>
        </div>
      </div>
    </div>
  );
};
