import React from 'react';
import {
  CloudRain,
  CloudLightning,
  Flame,
  Heart,
  Droplets,
  Utensils,
  Zap,
  Thermometer,
  Backpack,
  BookOpen,
  Map as MapIcon,
  Home,
  Hammer,
  Save,
  Volume2,
  VolumeX,
  Pause,
  Sun,
  Moon,
  Compass,
  AlertTriangle,
} from 'lucide-react';
import { HoveredTargetInfo } from '../scene/SurvivalScene3D.ts';
import { INVENTORY, TEMPERATURE } from '../survival/config.ts';
import { getEquipped, ITEM_DEFS } from '../survival/items.ts';
import { computeAmbientTempC, formatClock } from '../survival/needs.ts';
import {
  evaluateObjectivesForAct,
  getActLabel,
  getCurrentObjective,
} from '../survival/quests.ts';
import { STRUCTURE_CATALOG } from '../survival/structures.ts';
import {
  CraftStation,
  PlayerContext,
  StructureType,
  SurvivalState,
} from '../survival/types.ts';
import { getZoneAt, ISLAND_ZONES } from '../survival/world.ts';

interface SurvivalHUDProps {
  state: SurvivalState;
  playerContext: PlayerContext;
  hoveredTarget: HoveredTargetInfo | null;
  statusMessage: string | null;
  saveBadgeText?: string | null;
  activeBuildType?: StructureType | null;
  nearbyStations?: ReadonlySet<CraftStation>;
  fps?: number;
  showDebug?: boolean;
  damageFlash: boolean;
  isMuted: boolean;
  onSelectSlot: (slotIndex: number) => void;
  onUseSelected: () => void;
  onOpenInventory: () => void;
  onOpenBuild: () => void;
  onCancelBuild: () => void;
  onOpenJournal: () => void;
  onOpenMap: () => void;
  onTogglePause: () => void;
  onToggleMute: () => void;
  onDebugTeleport?: (dest: 'beach' | 'camp' | 'caves' | 'ruins' | 'station' | 'dock') => void;
  onDebugGrantSupplies?: () => void;
  onDebugStage6Setup?: () => void;
  onDebugAdvanceTime?: () => void;
  onDebugCycleWeather?: () => void;
  onDebugFastSail?: () => void;
}

export const SurvivalHUD: React.FC<SurvivalHUDProps> = ({
  state,
  playerContext,
  hoveredTarget,
  statusMessage,
  saveBadgeText,
  activeBuildType,
  nearbyStations,
  fps,
  showDebug,
  damageFlash,
  isMuted,
  onSelectSlot,
  onUseSelected,
  onOpenInventory,
  onOpenBuild,
  onCancelBuild,
  onOpenJournal,
  onOpenMap,
  onTogglePause,
  onToggleMute,
  onDebugTeleport,
  onDebugGrantSupplies,
  onDebugStage6Setup,
  onDebugAdvanceTime,
  onDebugCycleWeather,
  onDebugFastSail,
}) => {
  const { needs, clock, weather, inventory, selectedSlot } = state;
  const clockInfo = formatClock(clock);
  const ambientC = computeAmbientTempC(clock, weather);
  const equipped = getEquipped(inventory, selectedSlot);
  const currentZone = ISLAND_ZONES[getZoneAt(state.player.x, state.player.z)];

  const isLowHealth = needs.health < 35;
  const isCold = needs.temperature < TEMPERATURE.COLD_FEEDBACK_C;
  const isHypothermic = needs.temperature < TEMPERATURE.HYPOTHERMIA_C;

  const actSteps = evaluateObjectivesForAct(state);
  const actLabel = getActLabel(state.act);
  const completedSteps = actSteps.filter((s) => s.completed).length;
  const activeStep = getCurrentObjective(actSteps);
  const currentObjective = activeStep
    ? {
        title: activeStep.title,
        detail: activeStep.detail,
        progress: activeStep.progressText,
      }
    : {
        title: state.act >= 4 ? 'Prepare the Escape Boat (Act 4)' : 'Advance to Next Island Act',
        detail:
          state.act >= 4
            ? 'All island secrets & station repairs complete — build your escape vessel next.'
            : 'Complete the active milestone or push further inland.',
        progress: `${completedSteps}/${actSteps.length}`,
      };

  // Needs bars fade subtly when full (>82%) and become prominent when low
  const needOpacity = (val: number) => (val > 82 ? 'opacity-55 hover:opacity-100' : 'opacity-100');

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none overflow-hidden font-sans text-stone-100">
      {/* Low-health pulsing blood vignette */}
      {isLowHealth && (
        <div
          className="fixed inset-0 transition-opacity duration-500"
          style={{
            boxShadow: 'inset 0 0 130px 45px rgba(185, 28, 28, 0.58)',
          }}
        />
      )}

      {/* Cold / hypothermia frost vignette */}
      {isCold && (
        <div
          className="fixed inset-0 transition-opacity duration-700"
          style={{
            boxShadow: isHypothermic
              ? 'inset 0 0 140px 48px rgba(56, 189, 248, 0.52)'
              : 'inset 0 0 95px 28px rgba(125, 211, 252, 0.28)',
          }}
        />
      )}

      {/* Instant damage flash */}
      {damageFlash && (
        <div className="fixed inset-0 bg-red-700/35 transition-opacity duration-150" />
      )}

      {/* Top Bar: Environment & Clock (Left) + Current Objective & Utility Buttons (Right) */}
      <div className="flex items-start justify-between gap-3 p-4">
        {/* Top-Left Wilderness Watch & Thermometer */}
        <div className="pointer-events-auto flex flex-col gap-2 rounded-lg border border-stone-700/80 bg-stone-950/80 px-3.5 py-2.5 shadow-lg">
          <div className="flex items-center gap-3 text-sm font-semibold tracking-wide text-stone-200">
            <span className="flex items-center gap-1.5 text-amber-400">
              {clockInfo.isNight ? <Moon className="h-4 w-4 text-sky-300" /> : <Sun className="h-4 w-4" />}
              DAY {clock.day}
            </span>
            <span className="text-stone-500">•</span>
            <span className="font-mono text-stone-100">{clockInfo.timeText}</span>
            <span className="rounded bg-stone-800 px-2 py-0.5 text-xs text-stone-300">
              {clockInfo.phaseLabel}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-stone-300">
            <span className="flex items-center gap-1">
              {weather.kind === 'storm' ? (
                <CloudLightning className="h-3.5 w-3.5 text-amber-300" />
              ) : weather.kind === 'rain' ? (
                <CloudRain className="h-3.5 w-3.5 text-sky-300" />
              ) : (
                <Compass className="h-3.5 w-3.5 text-emerald-400" />
              )}
              <span className="capitalize">{weather.kind}</span>
            </span>
            <span className="text-stone-600">|</span>
            <span>Air {ambientC.toFixed(1)}°C</span>
            <span className="text-stone-600">|</span>
            <span
              className={
                isHypothermic
                  ? 'font-semibold text-sky-300'
                  : isCold
                    ? 'text-sky-200'
                    : 'text-stone-300'
              }
            >
              Body {needs.temperature.toFixed(1)}°C
            </span>
          </div>

          {/* Active location & status pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-stone-400">
            <span className="font-medium text-emerald-300/90">{currentZone.name}</span>
            {showDebug && typeof fps === 'number' && (
              <span className="rounded bg-stone-900 px-1.5 py-0.5 font-mono text-[10px] text-amber-300 border border-stone-700">
                {fps} FPS
              </span>
            )}
          </div>

          {(playerContext.nearFire ||
            playerContext.sheltered ||
            nearbyStations?.has('workbench') ||
            nearbyStations?.has('forge') ||
            needs.wetness > 15 ||
            needs.sickness > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {playerContext.sheltered && (
                <span className="inline-flex items-center gap-1 rounded bg-emerald-950/90 px-2 py-0.5 text-[11px] font-medium text-emerald-300 border border-emerald-700/60">
                  <Home className="h-3 w-3 text-emerald-400" /> Sheltered
                </span>
              )}
              {nearbyStations?.has('workbench') && (
                <span className="inline-flex items-center gap-1 rounded bg-stone-900/95 px-2 py-0.5 text-[11px] font-medium text-emerald-300 border border-emerald-700/50">
                  <Hammer className="h-3 w-3 text-emerald-400" /> Workbench
                </span>
              )}
              {nearbyStations?.has('forge') && (
                <span className="inline-flex items-center gap-1 rounded bg-orange-950/90 px-2 py-0.5 text-[11px] font-medium text-orange-300 border border-orange-700/60">
                  ⚒️ Forge
                </span>
              )}
              {playerContext.nearFire && (
                <span className="inline-flex items-center gap-1 rounded bg-amber-950/90 px-2 py-0.5 text-[11px] font-medium text-amber-300 border border-amber-700/60">
                  <Flame className="h-3 w-3 text-amber-400" /> Warm by Fire
                </span>
              )}
              {needs.wetness > 15 && (
                <span className="inline-flex items-center gap-1 rounded bg-sky-950/90 px-2 py-0.5 text-[11px] font-medium text-sky-300 border border-sky-700/60">
                  <Droplets className="h-3 w-3" /> Wet ({Math.round(needs.wetness)}%)
                </span>
              )}
              {needs.sickness > 0 && (
                <span className="inline-flex items-center gap-1 rounded bg-lime-950/90 px-2 py-0.5 text-[11px] font-medium text-lime-300 border border-lime-700/60">
                  <AlertTriangle className="h-3 w-3" /> Food Poisoning ({Math.ceil(needs.sickness)}s)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Top-Right Objective Tracker & Quick Buttons */}
        <div className="flex flex-col items-end gap-2">
          <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={onOpenJournal}
              aria-label="Open Journal and Objectives"
              className="flex items-center gap-1.5 rounded-lg border border-stone-700/80 bg-stone-950/85 px-2.5 py-2 text-xs font-semibold text-stone-200 hover:border-amber-500/70 hover:text-amber-300"
            >
              <BookOpen className="h-4 w-4 text-amber-400" />
              <span>Journal [J]</span>
            </button>
            <button
              type="button"
              onClick={onOpenMap}
              aria-label="Open Island Map"
              className="flex items-center gap-1.5 rounded-lg border border-stone-700/80 bg-stone-950/85 px-2.5 py-2 text-xs font-semibold text-stone-200 hover:border-amber-500/70 hover:text-amber-300"
            >
              <MapIcon className="h-4 w-4 text-emerald-400" />
              <span>Map [M]</span>
            </button>
            <button
              type="button"
              onClick={onOpenBuild}
              aria-label="Open Base Building Menu"
              className="flex items-center gap-1.5 rounded-lg border border-stone-700/80 bg-stone-950/85 px-2.5 py-2 text-xs font-semibold text-stone-200 hover:border-emerald-500/70 hover:text-emerald-300"
            >
              <Hammer className="h-4 w-4 text-emerald-400" />
              <span>Build [B]</span>
            </button>
            <button
              type="button"
              onClick={onOpenInventory}
              aria-label="Open Inventory and Crafting"
              className="flex items-center gap-1.5 rounded-lg border border-stone-700/80 bg-stone-950/85 px-3 py-2 text-xs font-semibold text-stone-200 hover:border-amber-500/70 hover:text-amber-300"
            >
              <Backpack className="h-4 w-4 text-amber-400" />
              <span>Craft [Tab]</span>
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              className="rounded-lg border border-stone-700/80 bg-stone-950/85 p-2 text-stone-300 hover:border-stone-500"
            >
              {isMuted ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onTogglePause}
              aria-label="Pause Game"
              className="rounded-lg border border-stone-700/80 bg-stone-950/85 p-2 text-stone-300 hover:border-stone-500"
            >
              <Pause className="h-4 w-4" />
            </button>
          </div>

          <div className="max-w-xs rounded-lg border border-stone-700/75 bg-stone-950/80 px-3.5 py-2.5 text-right shadow-lg">
            <div className="flex items-center justify-end gap-2 text-[10px] font-bold uppercase tracking-widest text-amber-400/90">
              <span>
                {actLabel} ({completedSteps}/{actSteps.length})
              </span>
              {currentObjective.progress && (
                <span className="rounded bg-stone-800 px-1.5 py-0.5 text-[10px] font-mono text-stone-300">
                  {currentObjective.progress}
                </span>
              )}
            </div>
            <div className="mt-0.5 text-xs font-semibold text-stone-100">
              {currentObjective.title}
            </div>
            <div className="mt-1 text-[11px] leading-snug text-stone-400">
              {currentObjective.detail}
            </div>
          </div>

          {activeBuildType && (
            <div className="pointer-events-auto flex items-center gap-2 rounded-md border border-emerald-600/80 bg-stone-950/90 px-3 py-1.5 text-xs font-medium text-emerald-300 shadow">
              <Hammer className="h-3.5 w-3.5" />
              <span>
                Placing {STRUCTURE_CATALOG[activeBuildType].name} • [R] Rotate
              </span>
              <button
                type="button"
                onClick={onCancelBuild}
                className="ml-1 rounded bg-stone-800 px-1.5 py-0.5 text-[10px] text-stone-300 hover:bg-stone-700"
              >
                Cancel [Esc]
              </button>
            </div>
          )}

          {saveBadgeText && (
            <div className="inline-flex items-center gap-1.5 rounded-md border border-emerald-700/60 bg-stone-950/90 px-2.5 py-1 text-[11px] font-medium text-emerald-300 shadow">
              <Save className="h-3 w-3 text-emerald-400" />
              <span>{saveBadgeText}</span>
            </div>
          )}
        </div>
      </div>

      {/* Center Reticle & Contextual Interaction Prompt (hidden while steering boat offshore) */}
      <div className="fixed inset-0 flex flex-col items-center justify-center pointer-events-none">
        {state.voyage.phase === 'docked' && (
          <>
            <div
              className={`h-2 w-2 rounded-full border transition-transform duration-150 ${
                hoveredTarget
                  ? hoveredTarget.canInteract
                    ? 'scale-125 border-amber-300 bg-amber-400/80'
                    : 'scale-110 border-red-400 bg-red-500/60'
                  : 'border-white/70 bg-white/30'
              }`}
            />

            {hoveredTarget && (
              <div className="mt-5 rounded-lg border border-stone-700/85 bg-stone-950/85 px-3.5 py-2 text-center shadow-xl">
                <div className="text-xs font-bold text-stone-100">{hoveredTarget.label}</div>
                <div
                  className={`mt-0.5 text-xs font-medium ${
                    hoveredTarget.canInteract ? 'text-amber-300' : 'text-red-300'
                  }`}
                >
                  {hoveredTarget.prompt}
                </div>
                {hoveredTarget.subtext && (
                  <div className="mt-0.5 text-[11px] text-stone-400">{hoveredTarget.subtext}</div>
                )}
              </div>
            )}
          </>
        )}

        {statusMessage && (
          <div className="mt-3 rounded-md border border-amber-700/60 bg-stone-950/90 px-3 py-1.5 text-xs font-medium text-amber-200 shadow-lg">
            {statusMessage}
          </div>
        )}
      </div>

      {/* Bottom Area: Needs Bars (Bottom-Left) + Hotbar (Bottom-Center) */}
      <div className="fixed inset-x-0 bottom-0 flex flex-col gap-3 p-4 md:flex-row md:items-end md:justify-between">
        {/* Bottom-Left Needs Vitals (auto-fade when healthy/full) */}
        <div className="pointer-events-auto flex w-64 flex-col gap-1.5 rounded-lg border border-stone-800/80 bg-stone-950/75 p-3 shadow-lg">
          {/* Health */}
          <div className={`flex items-center gap-2 transition-opacity ${needOpacity(needs.health)}`}>
            <Heart className="h-3.5 w-3.5 shrink-0 text-rose-400" />
            <div className="flex-1">
              <div className="flex justify-between text-[11px] text-stone-300">
                <span>Health</span>
                <span>{Math.round(needs.health)}%</span>
              </div>
              <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-stone-800">
                <div
                  className="h-full bg-rose-500 transition-all duration-200"
                  style={{ width: `${Math.max(0, Math.min(100, needs.health))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Hunger */}
          <div className={`flex items-center gap-2 transition-opacity ${needOpacity(needs.hunger)}`}>
            <Utensils className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            <div className="flex-1">
              <div className="flex justify-between text-[11px] text-stone-300">
                <span>Nourishment</span>
                <span>{Math.round(needs.hunger)}%</span>
              </div>
              <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-stone-800">
                <div
                  className="h-full bg-amber-500 transition-all duration-200"
                  style={{ width: `${Math.max(0, Math.min(100, needs.hunger))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Thirst */}
          <div className={`flex items-center gap-2 transition-opacity ${needOpacity(needs.thirst)}`}>
            <Droplets className="h-3.5 w-3.5 shrink-0 text-sky-400" />
            <div className="flex-1">
              <div className="flex justify-between text-[11px] text-stone-300">
                <span>Hydration</span>
                <span>{Math.round(needs.thirst)}%</span>
              </div>
              <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-stone-800">
                <div
                  className="h-full bg-sky-400 transition-all duration-200"
                  style={{ width: `${Math.max(0, Math.min(100, needs.thirst))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Stamina */}
          <div className={`flex items-center gap-2 transition-opacity ${needOpacity(needs.stamina)}`}>
            <Zap className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <div className="flex-1">
              <div className="flex justify-between text-[11px] text-stone-300">
                <span>Stamina</span>
                <span>{Math.round(needs.stamina)}%</span>
              </div>
              <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-stone-800">
                <div
                  className="h-full bg-emerald-400 transition-all duration-200"
                  style={{ width: `${Math.max(0, Math.min(100, needs.stamina))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Temperature */}
          <div className="flex items-center justify-between pt-1 text-[11px] text-stone-400 border-t border-stone-800/80">
            <span className="flex items-center gap-1">
              <Thermometer className="h-3.5 w-3.5 text-amber-300" /> Core Temp
            </span>
            <span
              className={
                isHypothermic
                  ? 'font-bold text-sky-300'
                  : isCold
                    ? 'text-sky-200'
                    : 'text-stone-200'
              }
            >
              {needs.temperature.toFixed(1)}°C{' '}
              {isHypothermic ? '(Freezing!)' : isCold ? '(Chilled)' : '(Stable)'}
            </span>
          </div>
        </div>

        {/* Bottom-Center 6-Slot Quick Hotbar */}
        <div className="pointer-events-auto flex flex-col items-center gap-1.5">
          {equipped.def && (
            <div className="flex items-center gap-2 rounded border border-stone-700/80 bg-stone-950/85 px-2.5 py-1 text-xs text-stone-200">
              <span>{equipped.def.name}</span>
              {equipped.def.food && (
                <button
                  type="button"
                  onClick={onUseSelected}
                  className="rounded bg-amber-600/90 px-2 py-0.5 text-[11px] font-semibold text-stone-950 hover:bg-amber-500"
                >
                  Consume [F]
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 rounded-xl border border-stone-700/85 bg-stone-950/85 p-1.5 shadow-xl">
            {Array.from({ length: INVENTORY.HOTBAR_SIZE }).map((_, idx) => {
              const slot = inventory[idx];
              const def = slot ? ITEM_DEFS[slot.itemId] : null;
              const isSelected = selectedSlot === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectSlot(idx)}
                  aria-label={def ? `Hotbar slot ${idx + 1}: ${def.name}` : `Hotbar slot ${idx + 1}: empty`}
                  className={`relative flex h-13 w-13 flex-col items-center justify-center rounded-lg border transition-all ${
                    isSelected
                      ? 'border-amber-400 bg-stone-800/95 shadow-inner'
                      : 'border-stone-800 bg-stone-900/80 hover:border-stone-600'
                  }`}
                >
                  <span className="absolute left-1.5 top-1 text-[10px] font-mono text-stone-400">
                    {idx + 1}
                  </span>
                  {def ? (
                    <>
                      <span className="text-xl leading-none">{def.icon}</span>
                      {slot && slot.count > 1 && (
                        <span className="absolute bottom-1 right-1.5 text-[11px] font-bold text-stone-200">
                          {slot.count}
                        </span>
                      )}
                      {slot?.durability !== undefined && def.id !== 'torch' && def.id !== 'lantern' && (
                        <div className="absolute bottom-1 left-1.5 right-1.5 h-1 overflow-hidden rounded-full bg-stone-700">
                          <div
                            className="h-full bg-amber-400"
                            style={{
                              width: `${Math.min(100, Math.round((slot.durability / 60) * 100))}%`,
                            }}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-[10px] text-stone-600">Empty</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="rounded-md border border-stone-800/75 bg-stone-950/75 px-3 py-1 text-[11px] text-stone-300 shadow">
            [WASD] Move • [Space] Jump • [Shift] Sprint • [E/Click] Interact • [B] Build • [Tab] Craft • [J] Journal • [M] Map
          </div>
        </div>

        <div className="hidden w-64 md:flex md:flex-col md:items-end md:justify-end gap-1.5">
          {showDebug && onDebugTeleport && (
            <div className="pointer-events-auto flex flex-wrap justify-end gap-1 rounded-lg border border-amber-800/70 bg-stone-950/90 p-1.5 text-[10px]">
              <span className="w-full text-right font-bold uppercase tracking-wider text-amber-400">
                Debug Tools
              </span>
              {(['beach', 'camp', 'caves', 'ruins', 'station', 'dock'] as const).map((dest) => (
                <button
                  key={dest}
                  type="button"
                  onClick={() => onDebugTeleport(dest)}
                  className="rounded bg-stone-800 px-1.5 py-0.5 text-stone-200 hover:bg-amber-600 hover:text-stone-950"
                >
                  TP:{dest}
                </button>
              ))}
              {onDebugGrantSupplies && (
                <button
                  type="button"
                  onClick={onDebugGrantSupplies}
                  className="rounded bg-emerald-900/80 px-1.5 py-0.5 text-emerald-200 hover:bg-emerald-700"
                >
                  +Supplies
                </button>
              )}
              {onDebugStage6Setup && (
                <button
                  type="button"
                  onClick={onDebugStage6Setup}
                  className="rounded bg-cyan-900/80 px-1.5 py-0.5 text-cyan-200 hover:bg-cyan-700"
                >
                  +Stage6
                </button>
              )}
              {onDebugAdvanceTime && (
                <button
                  type="button"
                  onClick={onDebugAdvanceTime}
                  className="rounded bg-indigo-900/80 px-1.5 py-0.5 text-indigo-200 hover:bg-indigo-700"
                >
                  +4h Time
                </button>
              )}
              {onDebugCycleWeather && (
                <button
                  type="button"
                  onClick={onDebugCycleWeather}
                  className="rounded bg-sky-900/80 px-1.5 py-0.5 text-sky-200 hover:bg-sky-700"
                >
                  Weather:{weather.override ? weather.override : 'auto'}
                </button>
              )}
              {state.voyage.phase === 'sailing' && onDebugFastSail && (
                <button
                  type="button"
                  onClick={onDebugFastSail}
                  className="rounded bg-teal-900/80 px-1.5 py-0.5 text-teal-200 hover:bg-teal-700"
                >
                  Sail+
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
