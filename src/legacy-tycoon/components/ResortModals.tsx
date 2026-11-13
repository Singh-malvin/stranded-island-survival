import React, { useState } from 'react';
import {
  Play,
  RotateCcw,
  HelpCircle,
  X,
  Compass,
  Star,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Shield,
} from 'lucide-react';
import { DifficultyMode } from '../game/tycoonTypes.ts';

interface TitleScreenProps {
  onStartGame: (difficulty?: DifficultyMode) => void;
  onOpenHelp: () => void;
  hasSavedGame: boolean;
  onOpenResetConfirm: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStartGame,
  onOpenHelp,
  hasSavedGame,
  onOpenResetConfirm,
}) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyMode>('standard');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gradient-to-b from-sky-950 via-slate-900 to-slate-950 text-white font-sans">
      <div className="w-full max-w-xl p-8 rounded-3xl bg-slate-900/95 border border-slate-700/80 shadow-2xl text-center flex flex-col items-center">
        {/* Luxury Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold uppercase tracking-widest mb-4">
          <Star className="w-3.5 h-3.5 fill-amber-400" />
          5-Star Island Hotel Simulator
        </div>

        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-2">
          ISLE OF PALMS
        </h1>
        <h2 className="text-lg font-medium text-amber-400 mb-5">
          Luxury Villa & Grand Hotel Tycoon
        </h2>

        <p className="text-sm text-slate-300 max-w-md leading-relaxed mb-6">
          Walk your island in first-person 3D, construct furnished bedrooms, chef kitchens with live cooking stoves, connected pathways, and a 5-story walkable sky penthouse — while balancing staff wages, upkeep, and cleanliness.
        </p>

        {/* Challenge Selector when starting fresh */}
        {!hasSavedGame && (
          <div className="w-full max-w-sm grid grid-cols-2 gap-2.5 mb-6 text-left">
            <button
              onClick={() => setSelectedDifficulty('standard')}
              className={`p-3 rounded-2xl border transition cursor-pointer ${
                selectedDifficulty === 'standard'
                  ? 'border-amber-500 bg-amber-950/30 text-white'
                  : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs text-amber-400 mb-1">
                <Shield className="w-3.5 h-3.5" />
                Resort Tycoon
              </div>
              <div className="text-[11px] leading-snug text-slate-300">
                $0 cash, starter island materials to craft your Pier & Cabana, balanced upkeep.
              </div>
            </button>

            <button
              onClick={() => setSelectedDifficulty('hardcore')}
              className={`p-3 rounded-2xl border transition cursor-pointer ${
                selectedDifficulty === 'hardcore'
                  ? 'border-rose-500 bg-rose-950/30 text-white'
                  : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs text-rose-400 mb-1">
                <Flame className="w-3.5 h-3.5" />
                Executive Hardcore
              </div>
              <div className="text-[11px] leading-snug text-slate-300">
                $0 cash, scarce wood/stone, -20% client spend, +25% upkeep & faster dirt decay.
              </div>
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="w-full space-y-3 max-w-xs">
          <button
            onClick={() => onStartGame(hasSavedGame ? undefined : selectedDifficulty)}
            className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl hover:scale-102 transition cursor-pointer"
          >
            <Play className="w-5 h-5 fill-slate-950" />
            {hasSavedGame ? 'Resume Resort' : 'Found New Resort'}
          </button>

          <button
            onClick={onOpenHelp}
            className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-slate-700 transition cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-sky-400" />
            Controls & Guide
          </button>

          {hasSavedGame && (
            <button
              onClick={onOpenResetConfirm}
              className="w-full py-2 text-xs text-slate-400 hover:text-red-400 transition cursor-pointer flex items-center justify-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Island to Day 1
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface ResetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmReset: (difficulty: DifficultyMode) => void;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirmReset,
}) => {
  const [difficulty, setDifficulty] = useState<DifficultyMode>('standard');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
      <div className="w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-red-500/50 shadow-2xl text-slate-100 flex flex-col items-center text-center">
        <div className="p-3 rounded-2xl bg-red-950/60 border border-red-500/60 text-red-400 mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <h3 className="text-xl font-black text-white mb-2">Reset Island Resort?</h3>
        <p className="text-xs text-slate-300 leading-relaxed mb-4">
          This dismantles all placed buildings, resets island territory back to the natural coral atoll, and starts fresh on Day 1.
        </p>

        <div className="w-full grid grid-cols-2 gap-2 mb-5 text-left">
          <button
            onClick={() => setDifficulty('standard')}
            className={`p-2.5 rounded-xl border text-xs cursor-pointer ${
              difficulty === 'standard' ? 'border-amber-500 bg-amber-950/30 text-white' : 'border-slate-800 bg-slate-950 text-slate-400'
            }`}
          >
            <div className="font-bold text-amber-400">Resort Tycoon</div>
            <div className="text-[11px]">$0 start • Balanced growth</div>
          </button>
          <button
            onClick={() => setDifficulty('hardcore')}
            className={`p-2.5 rounded-xl border text-xs cursor-pointer ${
              difficulty === 'hardcore' ? 'border-rose-500 bg-rose-950/30 text-white' : 'border-slate-800 bg-slate-950 text-slate-400'
            }`}
          >
            <div className="font-bold text-rose-400">Executive Hardcore</div>
            <div className="text-[11px]">$0 start • -20% rev • +25% upkeep</div>
          </button>
        </div>

        <div className="flex items-center gap-3 w-full">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirmReset(difficulty);
              onClose();
            }}
            className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-lg"
          >
            Yes, Reset Island
          </button>
        </div>
      </div>
    </div>
  );
};

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-white">How to Play: Island Tycoon Guide</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Help Modal"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          <div>
            <h3 className="font-bold text-sm text-amber-400 mb-2">First-Person 3D Controls</h3>
            <div className="grid grid-cols-2 gap-2 text-slate-300">
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <strong className="text-white">W, A, S, D:</strong> Walk inside villas, kitchens & up Penthouse stairs
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <strong className="text-white">Shift:</strong> Sprint Speed
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <strong className="text-white">Mouse / Click:</strong> Look Around (Cursor pops up automatically in menus & build mode!)
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <strong className="text-white">E or Left Click:</strong> Mine Rocks, Chop Palms & Open Cargo
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <strong className="text-white">B Key / P Key:</strong> Build [B] or Click Start → End Auto-Paths [P]
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <strong className="text-white">R Key:</strong> Rotate Structure 45° or Reset Path Start
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <strong className="text-white">M Key:</strong> Staff, Cargo Freight & Expand Island
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <strong className="text-white">Day/Night + N Key:</strong> Natural Morning → Sunset → Night cycle, or press [N] for Next Day
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-sm text-amber-400 mb-2">Harder Tycoon Economy & Interiors</h3>
            <ul className="space-y-2 text-slate-300">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Furnished Bedrooms & Stoves:</strong> Walk right into your Cabanas, Bungalows, Hotel Lobby, and Sunset Restaurant to see beds, lamps, and Chefs actively cooking on commercial stoves!</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Walkable 5-Story Sky Penthouse:</strong> Climb the switchback stairs inside the Presidential Penthouse Tower all the way to the 14m Rooftop Infinity Pool!</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Watch Your Upkeep & Cleanliness:</strong> Every structure costs daily upkeep. Keep Housekeepers hired to hold Cleanliness above 75%, and staff Kitchens/Bars so they earn full profits.</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/70 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase cursor-pointer"
          >
            Got it, Let's Build!
          </button>
        </div>
      </div>
    </div>
  );
};
