/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Compass,
  Droplets,
  Flame,
  Heart,
  Volume2,
  VolumeX,
  Zap,
  Utensils,
  Hammer,
  HelpCircle,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { canCraftRecipe, CRAFTING_RECIPES } from '../game/rules';
import { EscapeState, GameTime, InventorySlot, PlayerEquipment, PlayerStats, ToolType } from '../game/types';
import { WORLD_CENTER, WORLD_SIZE } from '../game/worldGen';

interface GameHUDProps {
  stats: PlayerStats;
  gameTime: GameTime;
  equipment: PlayerEquipment;
  escape: EscapeState;
  inventory: InventorySlot[];
  playerPos: { x: number; y: number };
  interactionHint: string | null;
  isMuted: boolean;
  onToggleMute: () => void;
  onToggleCrafting: () => void;
  onOpenGuide: () => void;
  onTogglePause: () => void;
  onSelectSlot: (slot: number) => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  stats,
  gameTime,
  equipment,
  escape,
  inventory,
  playerPos,
  interactionHint,
  isMuted,
  onToggleMute,
  onToggleCrafting,
  onOpenGuide,
  onTogglePause,
  onSelectSlot,
}) => {
  // Format digital clock
  const timeFormatted = `${String(gameTime.hour).padStart(2, '0')}:${String(gameTime.minute).padStart(2, '0')}`;

  // Body Temperature color
  let tempColor = 'text-emerald-400';
  let tempLabel = 'Normal';
  if (stats.temperature < 35.0) {
    tempColor = 'text-cyan-400 font-bold animate-pulse';
    tempLabel = 'Hypothermia';
  } else if (stats.temperature < 36.2) {
    tempColor = 'text-sky-300';
    tempLabel = 'Chilly';
  } else if (stats.temperature > 39.0) {
    tempColor = 'text-red-500 font-bold animate-pulse';
    tempLabel = 'Heatstroke';
  } else if (stats.temperature > 37.8) {
    tempColor = 'text-amber-400';
    tempLabel = 'Overheated';
  }

  // Weather badge label
  let weatherLabel = 'Clear Sun';
  let weatherColor = 'bg-amber-900/60 text-amber-200 border-amber-600/40';
  if (gameTime.weather === 'sweltering') {
    weatherLabel = 'Sweltering Noon';
    weatherColor = 'bg-orange-950/70 text-orange-200 border-orange-500/50';
  } else if (gameTime.weather === 'rain') {
    weatherLabel = 'Tropical Rain';
    weatherColor = 'bg-sky-950/70 text-sky-200 border-sky-500/50';
  } else if (gameTime.weather === 'storm') {
    weatherLabel = 'Severe Storm';
    weatherColor = 'bg-indigo-950/80 text-indigo-200 border-indigo-500/60 animate-pulse';
  } else if (gameTime.timeOfDay === 'night') {
    weatherLabel = 'Starlit Night';
    weatherColor = 'bg-slate-900/80 text-slate-300 border-slate-700/60';
  }

  // Hotbar tools definitions
  const hotbar = [
    { slot: 1, name: 'Hands', tool: 'hands' as ToolType, key: '1' },
    { slot: 2, name: 'Stone Axe', tool: equipment.slot2, key: '2' },
    { slot: 3, name: 'Spear', tool: equipment.slot3, key: '3' },
    { slot: 4, name: 'Torch', tool: equipment.slot4, key: '4' },
    { slot: 5, name: 'Canteen', tool: equipment.slot5, key: '5' },
  ];

  // Minimap player coords normalized (0 to 1)
  const mapNormX = playerPos.x / WORLD_SIZE;
  const mapNormY = playerPos.y / WORLD_SIZE;

  return (
    <div className="fixed inset-0 pointer-events-none select-none z-10 font-sans text-white">
      {/* Top Bar: Time, Day, Weather & Action Utilities */}
      <div className="absolute top-4 left-4 right-4 flex items-start justify-between">
        {/* Day & Environmental Status */}
        <div className="flex items-center gap-3 bg-[rgba(15,23,42,0.85)] border border-slate-700/60 rounded-xl px-4 py-2.5 shadow-xl pointer-events-auto">
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Day {gameTime.day}
            </span>
            <span className="text-xl font-bold font-mono tracking-tight tabular-nums text-slate-100">
              {timeFormatted}
            </span>
          </div>

          <div className="h-8 w-[1px] bg-slate-700/80 mx-1" />

          {/* Weather Pill */}
          <div
            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 shadow-sm ${weatherColor}`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{weatherLabel}</span>
          </div>
        </div>

        {/* Top Right: Minimap and Utility Control Buttons */}
        <div className="flex items-start gap-3 pointer-events-auto">
          {/* Circular Minimap */}
          <div className="relative w-28 h-28 rounded-full bg-[rgba(15,23,42,0.9)] border-2 border-slate-600/70 shadow-2xl overflow-hidden flex items-center justify-center">
            {/* Island Land Mass circle */}
            <div className="w-20 h-20 rounded-full bg-[#3d7a2f] border border-[#d8b979]" />

            {/* Landmarks */}
            {/* Raft (SE) */}
            <div
              className="absolute w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]"
              style={{ left: '72%', top: '74%' }}
              title="Raft Construction Dock"
            />
            {/* Signal Peak (NW) */}
            <div
              className="absolute w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_6px_#f97316]"
              style={{ left: '32%', top: '30%' }}
              title="Volcanic Peak Bonfire"
            />
            {/* Shipwreck (NE) */}
            <div
              className="absolute w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#38bdf8]"
              style={{ left: '76%', top: '28%' }}
              title="Shipwreck Shallows"
            />

            {/* Player Blip */}
            <div
              className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 border-2 border-white shadow-[0_0_8px_#ef4444]"
              style={{ left: `${mapNormX * 100}%`, top: `${mapNormY * 100}%` }}
            />
            <div className="absolute bottom-1 text-[9px] font-bold tracking-widest text-slate-400 uppercase">
              ISLAND
            </div>
          </div>

          {/* Utilities: Crafting, Resource Locations, Mute, Pause */}
          <div className="flex flex-col gap-2">
            <button
              onClick={onToggleCrafting}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-[rgba(15,23,42,0.85)] border border-amber-500/50 hover:bg-amber-500/20 text-amber-300 shadow-lg transition-all active:scale-95 cursor-pointer"
              title="Crafting & Inventory (I / Tab)"
            >
              <Hammer className="w-5 h-5" />
            </button>

            <button
              onClick={onOpenGuide}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-[rgba(15,23,42,0.85)] border border-cyan-500/50 hover:bg-cyan-500/20 text-cyan-300 shadow-lg transition-all active:scale-95 cursor-pointer"
              title="Where to Find Resources & Map Guide"
            >
              <BookOpen className="w-5 h-5" />
            </button>

            <button
              onClick={onToggleMute}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-[rgba(15,23,42,0.85)] border border-slate-700/80 hover:bg-slate-700/50 text-slate-300 shadow-lg transition-all active:scale-95 cursor-pointer"
              title="Toggle Audio Mute (M)"
            >
              {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5" />}
            </button>

            <button
              onClick={onTogglePause}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-[rgba(15,23,42,0.85)] border border-slate-700/80 hover:bg-slate-700/50 text-slate-300 shadow-lg transition-all active:scale-95 cursor-pointer"
              title="Pause & Survival Guide (Esc)"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Ready To Craft Prompt Banner */}
      {!equipment.slot2 && canCraftRecipe(inventory, CRAFTING_RECIPES.find((r) => r.id === 'stone_axe')!) && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-[rgba(15,23,42,0.95)] border-2 border-amber-400/90 rounded-2xl px-5 py-2.5 shadow-[0_0_20px_rgba(245,158,11,0.4)] flex items-center gap-3 pointer-events-auto cursor-pointer animate-bounce" onClick={onToggleCrafting}>
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold text-amber-200">
            ⭐ Stone Hatchet Ready! Press <span className="underline font-mono text-white">[Tab / I]</span> to craft & fell palm trees!
          </span>
        </div>
      )}

      {/* Center Screen: Interactive Context Prompt / Target Hint */}
      {interactionHint && (
        <div className="absolute top-[68%] left-1/2 -translate-x-1/2 bg-[rgba(15,23,42,0.9)] border border-amber-400/60 rounded-full px-5 py-2 shadow-2xl flex items-center gap-2 pointer-events-none">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
          <span className="text-sm font-semibold tracking-wide text-amber-100">
            {interactionHint}
          </span>
        </div>
      )}

      {/* Bottom HUD: Vitality Bars (Left) & Hotbar Tools (Center) */}
      <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
        {/* Vitality Metrics */}
        <div className="flex flex-col gap-2 p-3 bg-[rgba(15,23,42,0.85)] border border-slate-700/60 rounded-2xl shadow-2xl w-64 pointer-events-auto">
          {/* Health */}
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-red-400">
              <Heart className="w-3.5 h-3.5 fill-red-500/30" /> HP
            </span>
            <span className="font-mono tabular-nums text-red-200">
              {Math.round(stats.health)}/100
            </span>
          </div>
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-red-600 to-rose-400 transition-all duration-200"
              style={{ width: `${Math.max(0, Math.min(100, stats.health))}%` }}
            />
          </div>

          {/* Hunger */}
          <div className="flex items-center justify-between text-xs font-semibold mt-0.5">
            <span className="flex items-center gap-1.5 text-amber-400">
              <Utensils className="w-3.5 h-3.5" /> Hunger
            </span>
            <span className="font-mono tabular-nums text-amber-200">
              {Math.round(stats.hunger)}%
            </span>
          </div>
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-amber-600 to-yellow-400 transition-all duration-200"
              style={{ width: `${Math.max(0, Math.min(100, stats.hunger))}%` }}
            />
          </div>

          {/* Hydration */}
          <div className="flex items-center justify-between text-xs font-semibold mt-0.5">
            <span className="flex items-center gap-1.5 text-cyan-400">
              <Droplets className="w-3.5 h-3.5 fill-cyan-400/20" /> Hydration
            </span>
            <span className="font-mono tabular-nums text-cyan-200">
              {Math.round(stats.thirst)}%
            </span>
          </div>
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-cyan-600 to-sky-400 transition-all duration-200"
              style={{ width: `${Math.max(0, Math.min(100, stats.thirst))}%` }}
            />
          </div>

          {/* Stamina */}
          <div className="flex items-center justify-between text-xs font-semibold mt-0.5">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <Zap className="w-3.5 h-3.5" /> Stamina
            </span>
            <span className="font-mono tabular-nums text-emerald-200">
              {Math.round(stats.stamina)}%
            </span>
          </div>
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-emerald-600 to-green-400 transition-all duration-100"
              style={{ width: `${Math.max(0, Math.min(100, stats.stamina))}%` }}
            />
          </div>

          {/* Body Temperature */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-700/60 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Flame className="w-3.5 h-3.5 text-amber-500" /> Body Temp
            </span>
            <span className={`font-mono tabular-nums ${tempColor}`}>
              {stats.temperature.toFixed(1)}°C · {tempLabel}
            </span>
          </div>
        </div>

        {/* 5-Slot Hotbar in Center */}
        <div className="flex items-center gap-2 bg-[rgba(15,23,42,0.85)] border border-slate-700/70 rounded-2xl p-2 shadow-2xl pointer-events-auto">
          {hotbar.map((slot) => {
            const isActive = stats.activeHotbarSlot === slot.slot;
            const hasItem = slot.slot === 1 || slot.tool !== null;

            return (
              <button
                key={slot.slot}
                onClick={() => onSelectSlot(slot.slot)}
                className={`relative flex flex-col items-center justify-center w-14 h-14 rounded-xl border transition-all ${
                  isActive
                    ? 'bg-amber-500/20 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.35)] scale-105'
                    : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-700/50'
                }`}
              >
                {/* Hotbar Slot Number */}
                <span className="absolute top-1 left-1.5 text-[10px] font-mono font-bold text-slate-400">
                  {slot.key}
                </span>

                {/* Tool Icon / Representation */}
                <div className="mt-1 flex items-center justify-center">
                  {slot.slot === 1 && (
                    <span className="text-xs font-bold text-slate-300">Hands</span>
                  )}
                  {slot.slot === 2 && (
                    <span
                      className={`text-xs font-semibold ${hasItem ? 'text-amber-200' : 'text-slate-500'}`}
                    >
                      {hasItem ? 'Stone Axe' : 'Empty'}
                    </span>
                  )}
                  {slot.slot === 3 && (
                    <span
                      className={`text-xs font-semibold ${hasItem ? 'text-amber-200' : 'text-slate-500'}`}
                    >
                      {hasItem ? 'Spear' : 'Empty'}
                    </span>
                  )}
                  {slot.slot === 4 && (
                    <span
                      className={`text-xs font-semibold ${hasItem ? 'text-orange-300' : 'text-slate-500'}`}
                    >
                      {hasItem ? 'Torch' : 'Empty'}
                    </span>
                  )}
                  {slot.slot === 5 && (
                    <span
                      className={`text-xs font-semibold ${hasItem ? 'text-sky-300' : 'text-slate-500'}`}
                    >
                      {hasItem ? 'Canteen' : 'Empty'}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Escape Objective Tracker Pill (Right Bottom) */}
        <div className="flex flex-col gap-1 p-3 bg-[rgba(15,23,42,0.85)] border border-slate-700/60 rounded-2xl shadow-2xl w-64 pointer-events-auto text-xs">
          <span className="font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5" /> Escape Quests
          </span>
          <div className="flex flex-col gap-1 mt-1 text-[11px] text-slate-300">
            <div className="flex justify-between">
              <span>1. Sea Raft</span>
              <span className="font-mono text-amber-300 font-semibold">
                Phase {escape.raftProgress.phase}/4
              </span>
            </div>
            <div className="flex justify-between">
              <span>2. Peak Signal Fire</span>
              <span className="font-mono text-orange-300 font-semibold">
                {escape.bonfireProgress.isLit
                  ? 'Lit!'
                  : escape.bonfireProgress.built
                    ? 'Built'
                    : 'Unbuilt'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>3. Radio Transceiver</span>
              <span className="font-mono text-cyan-300 font-semibold">
                {escape.radioProgress.built ? 'Operational' : 'Salvage Parts'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
