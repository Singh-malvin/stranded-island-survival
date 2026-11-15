import React from 'react';
import { getDanielSharedLore, getDanielTrustLabel, type DanielTreatAction } from '../survival/companion.ts';
import type {
  DanielCommand,
  DanielState,
  PlayerStance,
  PrisonEscapePath,
  PrisonState,
} from '../survival/types.ts';

interface WheelOption {
  cmd: DanielCommand;
  keyNum: number;
  icon: string;
  label: string;
  hint: string;
  angleDeg: number;
}

const WHEEL_OPTIONS: WheelOption[] = [
  { cmd: 'follow', keyNum: 1, icon: '🧭', label: 'Follow Me', hint: 'Walk behind & sprint with you', angleDeg: -90 },
  { cmd: 'wait', keyNum: 2, icon: '✋', label: 'Wait Here', hint: 'Hold position & catch breath', angleDeg: -38 },
  { cmd: 'gather', keyNum: 3, icon: '🪵', label: 'Gather', hint: 'Forage wood, flint & berries', angleDeg: 14 },
  { cmd: 'guard', keyNum: 4, icon: '🛡️', label: 'Guard Area', hint: 'Patrol & watch for ambushes', angleDeg: 66 },
  { cmd: 'build', keyNum: 5, icon: '🔨', label: 'Help Build', hint: 'Speeds Boat & saves parts', angleDeg: 118 },
  { cmd: 'attack', keyNum: 6, icon: '⚔️', label: 'Attack', hint: 'Engage Sentinels & beasts', angleDeg: 170 },
  { cmd: 'goto', keyNum: 7, icon: '📍', label: 'Go to Ping', hint: 'Move to Map [J] ping target', angleDeg: -142 },
];

export const DanielCommandWheelOverlay: React.FC<{
  open: boolean;
  daniel: DanielState;
  onIssueCommand: (cmd: DanielCommand) => void;
  onClose: () => void;
}> = ({ open, daniel, onIssueCommand, onClose }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 backdrop-blur-[2px]"
      onMouseUp={onClose}
    >
      <div
        className="relative flex h-[430px] w-[430px] items-center justify-center rounded-full border border-amber-300/35 bg-slate-900/75 shadow-[0_0_80px_rgba(15,23,42,0.85)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Center Daniel Status Hub */}
        <div className="z-10 flex h-36 w-36 flex-col items-center justify-center rounded-full border border-amber-400/50 bg-slate-950/95 px-3 text-center shadow-lg">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-amber-300">
            Daniel Orders
          </div>
          <div className="mt-1 text-xs font-bold text-slate-100">
            {getDanielTrustLabel(daniel.trust)}
          </div>
          <div className="text-[11px] text-emerald-300">
            Trust {Math.round(daniel.trust)}/100
          </div>
          <div className="mt-1 text-[10px] text-slate-400">
            Current: <span className="font-semibold text-amber-200">{daniel.command}</span>
          </div>
          <div className="mt-1 text-[9px] text-slate-500">Click wedge or release [G]</div>
        </div>

        {/* Radial 7 Command Wedges */}
        {WHEEL_OPTIONS.map((opt) => {
          const rad = (opt.angleDeg * Math.PI) / 180;
          const r = 148;
          const cx = Math.cos(rad) * r;
          const cy = Math.sin(rad) * r;
          const active = daniel.command === opt.cmd;
          return (
            <button
              key={opt.cmd}
              type="button"
              onMouseUp={(e) => {
                e.stopPropagation();
                onIssueCommand(opt.cmd);
              }}
              onClick={(e) => {
                e.stopPropagation();
                onIssueCommand(opt.cmd);
              }}
              style={{
                transform: `translate(${cx}px, ${cy}px)`,
              }}
              className={`absolute flex w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-xl border px-2 py-2 text-center transition ${
                active
                  ? 'border-amber-300 bg-amber-500/30 text-white shadow-[0_0_20px_rgba(245,158,11,0.45)]'
                  : 'border-slate-600/70 bg-slate-900/90 text-slate-200 hover:border-amber-300 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-1 text-sm">
                <span>{opt.icon}</span>
                <span className="font-semibold text-xs">{opt.label}</span>
              </div>
              <div className="mt-0.5 text-[10px] leading-tight text-slate-300">{opt.hint}</div>
              <span className="mt-0.5 rounded bg-slate-950/70 px-1.5 text-[9px] text-amber-300">
                [{opt.keyNum}]
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const DanielDialogModal: React.FC<{
  daniel: DanielState;
  hasFood: boolean;
  hasWater: boolean;
  hasHeal: boolean;
  onTreat: (action: DanielTreatAction) => void;
  onOpenCommandWheel: () => void;
  onClose: () => void;
}> = ({ daniel, hasFood, hasWater, hasHeal, onTreat, onOpenCommandWheel, onClose }) => {
  const loreLines = getDanielSharedLore(daniel.loreUnlockedTier);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-amber-400/35 bg-slate-900/95 p-6 text-slate-100 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-amber-300">
              Fellow Survivor — {getDanielTrustLabel(daniel.trust)}
            </div>
            <h2 className="mt-1 text-2xl font-bold text-white">Daniel Vasquez</h2>
            <p className="mt-1 text-sm italic text-slate-300">
              “{daniel.moodText ?? 'Stay sharp out here. He watches from the high ridge.'}”
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
          >
            Close [Esc]
          </button>
        </div>

        {/* Status Bars */}
        <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
          <div className="rounded-lg bg-slate-950/75 p-2.5">
            <div className="text-slate-400">Trust</div>
            <div className="mt-0.5 text-base font-bold text-amber-300">{Math.round(daniel.trust)}/100</div>
          </div>
          <div className="rounded-lg bg-slate-950/75 p-2.5">
            <div className="text-slate-400">Health</div>
            <div className="mt-0.5 text-base font-bold text-emerald-300">
              {Math.round(daniel.health)}/{daniel.maxHealth}
            </div>
          </div>
          <div className="rounded-lg bg-slate-950/75 p-2.5">
            <div className="text-slate-400">Hunger</div>
            <div className="mt-0.5 text-base font-bold text-orange-300">{Math.round(daniel.hunger)}%</div>
          </div>
          <div className="rounded-lg bg-slate-950/75 p-2.5">
            <div className="text-slate-400">Thirst</div>
            <div className="mt-0.5 text-base font-bold text-sky-300">{Math.round(daniel.thirst)}%</div>
          </div>
        </div>

        {/* Interactive Decisions */}
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            How do you respond? (Shapes Trust & Escape Help)
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={!hasFood}
              onClick={() => onTreat('feed')}
              className="flex items-center justify-between rounded-xl border border-emerald-500/35 bg-emerald-950/35 px-3.5 py-2.5 text-left text-xs transition hover:bg-emerald-900/45 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span>🍖 Share Food / Rations</span>
              <span className="font-semibold text-emerald-300">+16 Trust</span>
            </button>
            <button
              type="button"
              disabled={!hasWater}
              onClick={() => onTreat('water')}
              className="flex items-center justify-between rounded-xl border border-sky-500/35 bg-sky-950/35 px-3.5 py-2.5 text-left text-xs transition hover:bg-sky-900/45 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span>💧 Share Clean Water</span>
              <span className="font-semibold text-sky-300">+14 Trust</span>
            </button>
            <button
              type="button"
              disabled={!hasHeal}
              onClick={() => onTreat('heal')}
              className="flex items-center justify-between rounded-xl border border-rose-500/35 bg-rose-950/35 px-3.5 py-2.5 text-left text-xs transition hover:bg-rose-900/45 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span>🩹 Treat Rib Injury (Poultice/Herb)</span>
              <span className="font-semibold text-rose-300">+22 Trust</span>
            </button>
            <button
              type="button"
              onClick={() => onTreat('talk')}
              className="flex items-center justify-between rounded-xl border border-amber-500/35 bg-amber-950/35 px-3.5 py-2.5 text-left text-xs transition hover:bg-amber-900/45"
            >
              <span>💬 Talk / Ask What He Knows</span>
              <span className="font-semibold text-amber-300">+6 Trust</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCommandWheel();
              }}
              className="flex items-center justify-between rounded-xl border border-indigo-400/40 bg-indigo-950/40 px-3.5 py-2.5 text-left text-xs hover:bg-indigo-900/50"
            >
              <span>🧭 Give Command Order</span>
              <span className="font-semibold text-indigo-300">Hold [G]</span>
            </button>
            <button
              type="button"
              onClick={() => onTreat('neglect')}
              className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/70 px-3.5 py-2.5 text-left text-xs text-slate-300 hover:border-red-500/50 hover:text-red-300"
            >
              <span>🚶 Turn Away / Keep Supplies</span>
              <span className="font-semibold text-red-400">-10 Trust</span>
            </button>
          </div>
        </div>

        {/* Unlocked Lore */}
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
            Daniel’s Intel (Tier {daniel.loreUnlockedTier}/4)
          </div>
          {loreLines.length === 0 ? (
            <p className="mt-1 text-xs text-slate-400">
              Help treat Daniel or earn Trust &ge; 25 to unlock his survival intel on the Stronghold & Aura King.
            </p>
          ) : (
            <ul className="mt-1.5 space-y-1.5 text-xs text-slate-200">
              {loreLines.map((line, i) => (
                <li key={i} className="leading-relaxed">
                  {line}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export const PrisonBreakModal: React.FC<{
  prison: PrisonState;
  daniel: DanielState;
  hasLockpick: boolean;
  stance: PlayerStance;
  onAttemptEscape: (path: PrisonEscapePath) => void;
  onClose: () => void;
}> = ({ prison, daniel, hasLockpick, stance, onAttemptEscape, onClose }) => {
  const ventReady = stance === 'crouch' || stance === 'prone';
  const danielReady = daniel.found && daniel.trust >= 50;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-purple-400/40 bg-slate-900/95 p-6 text-slate-100 shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-purple-300">
              Stronghold Dungeon — Captured #{prison.capturedCount}
            </div>
            <h2 className="mt-1 text-xl font-bold text-white">Choose Your Escape Route</h2>
            <p className="mt-1 text-xs text-slate-300">
              Your confiscated gear sits in the Evidence Locker just outside the cell bars.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-800"
          >
            Back
          </button>
        </div>

        <div className="mt-4 space-y-2.5 text-xs">
          <button
            type="button"
            onClick={() => onAttemptEscape('lockpick')}
            className="flex w-full items-center justify-between rounded-xl border border-sky-400/40 bg-sky-950/35 px-4 py-3 text-left hover:bg-sky-900/45"
          >
            <div>
              <div className="font-semibold text-sky-200">🔓 Pick Cell Padlock (Silent)</div>
              <div className="text-slate-300">
                {hasLockpick
                  ? 'Uses 1x Spring-Steel Lockpick — unlocks door silently next to Evidence Locker.'
                  : prison.escapeHoursElapsed >= 0.35
                    ? 'Found scrap wire on cell floor — pick lock silently now!'
                    : 'Needs Lockpick item (or wait slightly inside cell to improvise scrap wire).'}
              </div>
            </div>
            <span className="ml-3 rounded bg-sky-900/80 px-2 py-1 font-semibold text-sky-200">
              {hasLockpick || prison.escapeHoursElapsed >= 0.35 ? 'Ready' : 'Search'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onAttemptEscape('vent_sneak')}
            className="flex w-full items-center justify-between rounded-xl border border-emerald-400/40 bg-emerald-950/35 px-4 py-3 text-left hover:bg-emerald-900/45"
          >
            <div>
              <div className="font-semibold text-emerald-200">🕳️ Crawl Cracked Basalt Vent (Stealth)</div>
              <div className="text-slate-300">
                {ventReady
                  ? `Stance is ${stance} — slip right out the western wall undetected!`
                  : 'Close Menu -> Crouch [C] or Prone [Z] first, then squeeze through the west vent.'}
              </div>
            </div>
            <span
              className={`ml-3 rounded px-2 py-1 font-semibold ${
                ventReady ? 'bg-emerald-900/80 text-emerald-200' : 'bg-slate-800 text-amber-300'
              }`}
            >
              {ventReady ? 'Ready' : 'Crouch'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onAttemptEscape('daniel_rescue')}
            className="flex w-full items-center justify-between rounded-xl border border-amber-400/40 bg-amber-950/35 px-4 py-3 text-left hover:bg-amber-900/45"
          >
            <div>
              <div className="font-semibold text-amber-200">🤝 Signal Daniel for Prison Break</div>
              <div className="text-slate-300">
                {!daniel.found
                  ? 'Requires finding Daniel in Western Basalt Caves first.'
                  : !danielReady
                    ? `Requires Daniel Trust >= 50 (Currently ${Math.round(daniel.trust)}).`
                    : daniel.trust >= 65
                      ? 'Daniel’s high trust triggers an immediate stealth breakout right outside your bars!'
                      : 'Daniel sneaks the perimeter to pry open the gate hinge.'}
              </div>
            </div>
            <span className="ml-3 rounded bg-amber-900/80 px-2 py-1 font-semibold text-amber-200">
              {danielReady ? 'Available' : 'Locked'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onAttemptEscape('fight_out')}
            className="flex w-full items-center justify-between rounded-xl border border-rose-500/45 bg-rose-950/40 px-4 py-3 text-left hover:bg-rose-900/50"
          >
            <div>
              <div className="font-semibold text-rose-200">💥 Smash Bars & Fight Out (Loud)</div>
              <div className="text-slate-300">
                Immediate escape anytime, but costs ~18 HP & triggers Citadel High Alert for 8h!
              </div>
            </div>
            <span className="ml-3 rounded bg-rose-900/80 px-2 py-1 font-semibold text-rose-200">
              Force
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
