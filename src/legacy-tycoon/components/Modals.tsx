/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Compass, Flame, Play, RefreshCw, Trophy, Skull, Radio, Anchor } from 'lucide-react';
import { EscapeState, GameTime } from '../game/types';

interface TitleModalProps {
  onStart: () => void;
}

export const TitleModal: React.FC<TitleModalProps> = ({ onStart }) => {
  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-between p-8 bg-[radial-gradient(ellipse_at_center,_rgba(16,42,66,0.92)_0%,_rgba(6,13,24,0.98)_100%)] select-none text-white overflow-y-auto">
      <div className="w-full max-w-2xl flex flex-col items-center text-center mt-auto pt-8">
        {/* Custom SVG Island Escape Emblem */}
        <div className="w-20 h-20 mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-2xl">
          <Compass className="w-11 h-11" />
        </div>

        <h1 className="text-4xl md:text-5xl font-black tracking-tight uppercase font-serif text-amber-300 drop-shadow-md">
          Desert Island Escape
        </h1>

        <p className="mt-3 text-sm md:text-base text-slate-300 font-sans leading-relaxed max-w-lg">
          Flight 815 went down in the remote South Pacific. You awaken on the wet sands of an
          uncharted volcanic atoll. Forage, craft tools, withstand wildlife and weather, and
          engineer your escape.
        </p>

        {/* 3 Escape Routes Preview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mt-6 text-left">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-amber-500/30">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase mb-1">
              <Anchor className="w-4 h-4" /> 1. Ocean Raft
            </div>
            <p className="text-[11px] text-slate-400">
              Chop palms for logs, twist vines for rope, weave a sail, and stockpile voyage rations.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-orange-500/30">
            <div className="flex items-center gap-2 text-orange-400 font-bold text-xs uppercase mb-1">
              <Flame className="w-4 h-4" /> 2. Signal Pyre
            </div>
            <p className="text-[11px] text-slate-400">
              Stack a giant bonfire atop the volcanic peak and ignite it when a passing vessel appears.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-cyan-500/30">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase mb-1">
              <Radio className="w-4 h-4" /> 3. Rescue Radio
            </div>
            <p className="text-[11px] text-slate-400">
              Scavenge the shipwreck for battery, wiring, and antenna to broadcast a mayday SOS.
            </p>
          </div>
        </div>

        {/* Start Primary Action */}
        <button
          data-start="true"
          onClick={onStart}
          className="mt-8 px-8 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-base shadow-[0_0_25px_rgba(245,158,11,0.5)] transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3 cursor-pointer"
        >
          <Play className="w-5 h-5 fill-slate-950" /> Survive & Escape
        </button>
      </div>

      {/* Control Hint Line */}
      <div className="mt-auto pt-6 text-xs text-slate-400 font-mono tracking-wider border-t border-slate-800/80 w-full text-center">
        WASD Move · Shift Sprint · E / Click Harvest/Attack · 1-5 Hotbar · Tab/I Craft · Esc Pause · Enter to Start
      </div>
    </div>
  );
};

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({ onResume, onRestart }) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/80 select-none text-white">
      <div className="w-full max-w-md bg-[rgba(15,23,42,0.95)] border border-slate-700 rounded-2xl shadow-2xl p-6 flex flex-col text-center">
        <h2 className="text-2xl font-bold tracking-tight text-amber-300">Game Paused</h2>
        <p className="text-xs text-slate-400 mt-1">Take a breath, survivor</p>

        <div className="my-5 p-4 rounded-xl bg-slate-900/70 border border-slate-800 text-left text-xs text-slate-300 space-y-2">
          <div className="font-semibold text-amber-400 uppercase tracking-wider text-[11px]">
            Survival Essentials
          </div>
          <div>• <strong className="text-white">Ocean Water:</strong> Do not drink saltwater! It severely dehydrates you. Drink fresh stream water or coconuts.</div>
          <div>• <strong className="text-white">Exposure:</strong> Severe cold storms cause hypothermia. Stand near a campfire or carry a lit torch.</div>
          <div>• <strong className="text-white">Hunting:</strong> Shore crabs scuttle away; jungle boars fight back when threatened!</div>
          <div>• <strong className="text-white">Crafting:</strong> Press [I] or [Tab] anytime to weave rope and craft a stone axe.</div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onResume}
            className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer"
          >
            Resume
          </button>
          <button
            onClick={onRestart}
            className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm border border-slate-700 transition-all cursor-pointer flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Restart
          </button>
        </div>
      </div>
    </div>
  );
};

interface VictoryModalProps {
  escapeMethod: 'raft' | 'signal_fire' | 'radio' | null;
  gameTime: GameTime;
  statsGathered: { resources: number; distance: number };
  onRestart: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  escapeMethod,
  gameTime,
  statsGathered,
  onRestart,
}) => {
  let title = 'You Escaped the Island!';
  let story = 'Against all odds, you conquered the elements and reached civilization!';
  let icon = <Trophy className="w-12 h-12 text-amber-400" />;

  if (escapeMethod === 'raft') {
    title = 'Seaborne Escape!';
    story =
      'You lashed together a seaworthy palm raft, stocked voyage rations, and navigated treacherous coastal reefs into shipping lanes. A commercial freighter pulled you aboard!';
    icon = <Anchor className="w-12 h-12 text-amber-400" />;
  } else if (escapeMethod === 'signal_fire') {
    title = 'Rescued by Signal Fire!';
    story =
      'The colossal column of black smoke from your volcanic peak pyre was spotted by the watch officer of a passing vessel! Dual foghorns blared as they dispatched a motor launch!';
    icon = <Flame className="w-12 h-12 text-orange-400" />;
  } else if (escapeMethod === 'radio') {
    title = 'Emergency Distress Call!';
    story =
      'You successfully repaired the shipwreck transceiver and broadcast an SOS on 121.5 MHz. A Coast Guard patrol helicopter arrived to airlift you home!';
    icon = <Radio className="w-12 h-12 text-cyan-400" />;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/85 select-none text-white">
      <div className="w-full max-w-lg bg-[rgba(15,23,42,0.96)] border border-amber-500/60 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.3)] p-8 flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4">
          {icon}
        </div>

        <h2 className="text-3xl font-black tracking-tight text-amber-300 font-serif">
          {title}
        </h2>
        <p className="mt-3 text-sm text-slate-300 leading-relaxed max-w-md">
          {story}
        </p>

        {/* Run Mastery Metrics */}
        <div className="grid grid-cols-3 gap-3 w-full my-6">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Days Survived
            </span>
            <div className="text-xl font-bold font-mono text-amber-300 mt-0.5">
              Day {gameTime.day}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Resources Collected
            </span>
            <div className="text-xl font-bold font-mono text-emerald-300 mt-0.5">
              {statsGathered.resources}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Escape Method
            </span>
            <div className="text-base font-bold text-cyan-300 mt-1 capitalize">
              {escapeMethod?.replace('_', ' ') || 'Escape'}
            </div>
          </div>
        </div>

        <button
          data-start="true"
          onClick={onRestart}
          className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-base shadow-xl transition-all active:scale-95 cursor-pointer"
        >
          Play Again
        </button>
      </div>
    </div>
  );
};

interface GameOverModalProps {
  reason: string;
  gameTime: GameTime;
  statsGathered: { resources: number };
  onRestart: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  reason,
  gameTime,
  statsGathered,
  onRestart,
}) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/90 select-none text-white">
      <div className="w-full max-w-md bg-[rgba(15,23,42,0.96)] border border-red-500/50 rounded-3xl shadow-[0_0_40px_rgba(239,68,68,0.3)] p-8 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4 text-red-500">
          <Skull className="w-9 h-9" />
        </div>

        <h2 className="text-3xl font-black tracking-tight text-red-400 font-serif">
          You Did Not Survive
        </h2>
        <p className="mt-3 text-sm text-slate-300 leading-relaxed">
          {reason}
        </p>

        <div className="grid grid-cols-2 gap-3 w-full my-6 text-center">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Time Endured
            </span>
            <div className="text-xl font-bold font-mono text-slate-200 mt-0.5">
              Day {gameTime.day}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Foraged Items
            </span>
            <div className="text-xl font-bold font-mono text-slate-200 mt-0.5">
              {statsGathered.resources}
            </div>
          </div>
        </div>

        <button
          data-start="true"
          onClick={onRestart}
          className="w-full py-3.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-base shadow-xl transition-all active:scale-95 cursor-pointer"
        >
          Try Again
        </button>
      </div>
    </div>
  );
};
