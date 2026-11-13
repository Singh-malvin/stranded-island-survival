import React, { useState } from 'react';
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
import { getEquipped, getInitialDurability, ITEM_DEFS } from '../survival/items.ts';
import { FloatingItemTooltip, HoverTooltipData } from './ItemTooltip.tsx';
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
  showControlsHint?: boolean;
  onToggleControlsHint?: () => void;
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
  showControlsHint = true,
  onToggleControlsHint,
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
  const [hotbarHover, setHotbarHover] = useState<HoverTooltipData | null>(null);
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
      <div className="flex items-start justify-between gap-2.5 p-2.5 sm:p-3">
        {/* Top-Left Wilderness Watch & Thermometer */}
        <div className="pointer-events-auto flex flex-col gap-1 rounded-lg border border-white/15 bg-stone-950/60 px-2.5 py-1.5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium tracking-wider text-stone-100">
            <span className="flex items-center gap-1 whitespace-nowrap text-amber-300">
              {clockInfo.isNight ? <Moon className="h-3.5 w-3.5 text-sky-300" /> : <Sun className="h-3.5 w-3.5" />}
              DAY {clock.day}
            </span>
            <span className="text-stone-500">/</span>
            <span className="font-mono text-[11px] text-stone-100">{clockInfo.timeText}</span>
            <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-normal tracking-wide text-stone-300">
              {clockInfo.phaseLabel}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-light tracking-wide text-stone-300">
            <span className="flex items-center gap-1">
              {weather.kind === 'storm' ? (
                <CloudLightning className="h-3 w-3 text-amber-300" />
              ) : weather.kind === 'rain' ? (
                <CloudRain className="h-3 w-3 text-sky-300" />
              ) : (
                <Compass className="h-3 w-3 text-emerald-400" />
              )}
              <span className="capitalize">{weather.kind}</span>
            </span>
            <span className="text-stone-600">|</span>
            <span>{ambientC.toFixed(0)}°C</span>
            <span className="text-stone-600">|</span>
            <span
              className={
                isHypothermic
                  ? 'font-medium text-sky-300'
                  : isCold
                    ? 'text-sky-200'
                    : 'text-stone-300'
              }
            >
              Core {needs.temperature.toFixed(1)}°C
            </span>
          </div>

          {/* Active location & status pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] tracking-wide text-stone-400">
            <span className="font-medium text-emerald-300/90">{currentZone.name}</span>
            {showDebug && typeof fps === 'number' && (
              <span className="rounded border border-white/10 bg-stone-900/70 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
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
            <div className="flex flex-wrap items-center gap-1 pt-0.5">
              {playerContext.sheltered && (
                <span className="inline-flex items-center gap-1 rounded border border-emerald-500/35 bg-emerald-950/60 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                  <Home className="h-2.5 w-2.5 text-emerald-400" /> Sheltered
                </span>
              )}
              {nearbyStations?.has('workbench') && (
                <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-stone-950/70 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                  <Hammer className="h-2.5 w-2.5 text-emerald-400" /> Bench
                </span>
              )}
              {nearbyStations?.has('forge') && (
                <span className="inline-flex items-center gap-1 rounded border border-orange-500/35 bg-orange-950/60 px-1.5 py-0.5 text-[10px] font-medium text-orange-300">
                  ⚒️ Forge
                </span>
              )}
              {playerContext.nearFire && (
                <span className="inline-flex items-center gap-1 rounded border border-amber-500/35 bg-amber-950/60 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                  <Flame className="h-2.5 w-2.5 text-amber-400" /> Warm
                </span>
              )}
              {needs.wetness > 15 && (
                <span className="inline-flex items-center gap-1 rounded border border-sky-500/35 bg-sky-950/60 px-1.5 py-0.5 text-[10px] font-medium text-sky-300">
                  <Droplets className="h-2.5 w-2.5" /> {Math.round(needs.wetness)}%
                </span>
              )}
              {needs.sickness > 0 && (
                <span className="inline-flex items-center gap-1 rounded border border-lime-500/35 bg-lime-950/60 px-1.5 py-0.5 text-[10px] font-medium text-lime-300">
                  <AlertTriangle className="h-2.5 w-2.5" /> Sick ({Math.ceil(needs.sickness)}s)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Top-Right Objective Tracker & Quick Buttons */}
        <div className="flex flex-col items-end gap-1.5">
          <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1">
            <button
              type="button"
              onClick={onOpenJournal}
              aria-label="Open Journal and Objectives"
              className="flex items-center gap-1 rounded-md border border-white/10 bg-stone-950/45 px-2 py-1 text-[11px] font-medium tracking-wide text-stone-200 transition hover:border-amber-400/50 hover:text-amber-200"
            >
              <BookOpen className="h-3.5 w-3.5 text-amber-400" />
              <span>Journal [J]</span>
            </button>
            <button
              type="button"
              onClick={onOpenMap}
              aria-label="Open Island Map"
              className="flex items-center gap-1 rounded-md border border-white/10 bg-stone-950/45 px-2 py-1 text-[11px] font-medium tracking-wide text-stone-200 transition hover:border-amber-400/50 hover:text-amber-200"
            >
              <MapIcon className="h-3.5 w-3.5 text-emerald-400" />
              <span>Map [M]</span>
            </button>
            <button
              type="button"
              onClick={onOpenBuild}
              aria-label="Open Base Building Menu"
              className="flex items-center gap-1 rounded-md border border-white/10 bg-stone-950/45 px-2 py-1 text-[11px] font-medium tracking-wide text-stone-200 transition hover:border-emerald-400/50 hover:text-emerald-200"
            >
              <Hammer className="h-3.5 w-3.5 text-emerald-400" />
              <span>Build [B]</span>
            </button>
            <button
              type="button"
              onClick={onOpenInventory}
              aria-label="Open Inventory and Crafting"
              className="flex items-center gap-1 rounded-md border border-white/10 bg-stone-950/45 px-2 py-1 text-[11px] font-medium tracking-wide text-stone-200 transition hover:border-amber-400/50 hover:text-amber-200"
            >
              <Backpack className="h-3.5 w-3.5 text-amber-400" />
              <span>Craft [Tab]</span>
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              className="rounded-md border border-white/10 bg-stone-950/45 p-1.5 text-stone-300 transition hover:border-white/25"
            >
              {isMuted ? <VolumeX className="h-3.5 w-3.5 text-red-400" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={onTogglePause}
              aria-label="Pause Game"
              className="rounded-md border border-white/10 bg-stone-950/45 p-1.5 text-stone-300 transition hover:border-white/25"
            >
              <Pause className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="max-w-[260px] rounded-lg border border-white/15 bg-stone-950/60 px-2.5 py-2 text-right shadow-sm">
            <div className="flex items-center justify-end gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-amber-300/95">
              <span>
                {actLabel} ({completedSteps}/{actSteps.length})
              </span>
              {currentObjective.progress && (
                <span className="rounded border border-white/15 bg-white/10 px-1 py-0.5 font-mono text-[9.5px] text-stone-200">
                  {currentObjective.progress}
                </span>
              )}
            </div>
            <div className="mt-0.5 text-xs font-medium text-stone-100">
              {currentObjective.title}
            </div>
            <div className="mt-0.5 text-[10.5px] font-normal leading-snug text-stone-200/90">
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

      {/* Bottom Area: Vitals + Hotbar + Safely Framed Controls Hint */}
      <div className="fixed inset-x-0 bottom-0 flex flex-col gap-1.5 px-3 pb-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          {/* Bottom-Left Needs Vitals (compact sleek bars) */}
          <div className="pointer-events-auto flex w-52 flex-col gap-1 rounded-lg border border-white/15 bg-stone-950/60 p-2 shadow-sm">
            {/* Health */}
            <div className={`flex items-center gap-1.5 transition-opacity ${needOpacity(needs.health)}`}>
              <Heart className="h-3 w-3 shrink-0 text-rose-400" />
              <div className="flex-1">
                <div className="flex justify-between text-[10px] font-light tracking-wider text-stone-300">
                  <span>HEALTH</span>
                  <span className="font-mono">{Math.round(needs.health)}%</span>
                </div>
                <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-rose-500 transition-all duration-200"
                    style={{ width: `${Math.max(0, Math.min(100, needs.health))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Hunger */}
            <div className={`flex items-center gap-1.5 transition-opacity ${needOpacity(needs.hunger)}`}>
              <Utensils className="h-3 w-3 shrink-0 text-amber-400" />
              <div className="flex-1">
                <div className="flex justify-between text-[10px] font-light tracking-wider text-stone-300">
                  <span>FOOD</span>
                  <span className="font-mono">{Math.round(needs.hunger)}%</span>
                </div>
                <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-amber-400 transition-all duration-200"
                    style={{ width: `${Math.max(0, Math.min(100, needs.hunger))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Thirst */}
            <div className={`flex items-center gap-1.5 transition-opacity ${needOpacity(needs.thirst)}`}>
              <Droplets className="h-3 w-3 shrink-0 text-sky-400" />
              <div className="flex-1">
                <div className="flex justify-between text-[10px] font-light tracking-wider text-stone-300">
                  <span>WATER</span>
                  <span className="font-mono">{Math.round(needs.thirst)}%</span>
                </div>
                <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-sky-400 transition-all duration-200"
                    style={{ width: `${Math.max(0, Math.min(100, needs.thirst))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Stamina */}
            <div className={`flex items-center gap-1.5 transition-opacity ${needOpacity(needs.stamina)}`}>
              <Zap className="h-3 w-3 shrink-0 text-emerald-400" />
              <div className="flex-1">
                <div className="flex justify-between text-[10px] font-light tracking-wider text-stone-300">
                  <span>STAMINA</span>
                  <span className="font-mono">{Math.round(needs.stamina)}%</span>
                </div>
                <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-200"
                    style={{ width: `${Math.max(0, Math.min(100, needs.stamina))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Temperature */}
            <div className="flex items-center justify-between border-t border-white/10 pt-1 text-[10px] font-light tracking-wide text-stone-400">
              <span className="flex items-center gap-1">
                <Thermometer className="h-3 w-3 text-amber-300" /> TEMP
              </span>
              <span
                className={
                  isHypothermic
                    ? 'font-medium text-sky-300'
                    : isCold
                      ? 'text-sky-200'
                      : 'text-stone-200'
                }
              >
                {needs.temperature.toFixed(1)}°C{' '}
                {isHypothermic ? '· Freezing' : isCold ? '· Cold' : '· Stable'}
              </span>
            </div>
          </div>

          {/* Bottom-Center 6-Slot Quick Hotbar */}
          <div className="pointer-events-auto flex flex-col items-center gap-1">
            {equipped.def && (
              <div className="flex items-center gap-2 rounded-md border border-white/10 bg-stone-950/50 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-stone-200">
                <span>{equipped.def.name}</span>
                {equipped.def.food && (
                  <button
                    type="button"
                    onClick={onUseSelected}
                    className="rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-stone-950 hover:bg-amber-400"
                  >
                    Consume [F]
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center gap-1 rounded-xl border border-white/15 bg-stone-950/60 p-1 shadow-sm">
              {Array.from({ length: INVENTORY.HOTBAR_SIZE }).map((_, idx) => {
                const slot = inventory[idx];
                const def = slot ? ITEM_DEFS[slot.itemId] : null;
                const isSelected = selectedSlot === idx;
                const maxDur = slot ? getInitialDurability(slot.itemId) : undefined;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSelectSlot(idx)}
                    onMouseEnter={(e) =>
                      slot && setHotbarHover({ slot, x: e.clientX, y: e.clientY, preferAbove: true })
                    }
                    onMouseMove={(e) =>
                      slot && setHotbarHover({ slot, x: e.clientX, y: e.clientY, preferAbove: true })
                    }
                    onMouseLeave={() => setHotbarHover(null)}
                    aria-label={def ? `Hotbar slot ${idx + 1}: ${def.name}` : `Hotbar slot ${idx + 1}: empty`}
                    className={`relative flex h-[54px] w-[58px] flex-col items-center justify-between rounded-lg border px-1 py-1 transition-all ${
                      isSelected
                        ? 'border-amber-400/90 bg-stone-800/75 shadow-inner'
                        : 'border-white/10 bg-stone-900/45 hover:border-white/25'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between px-0.5 text-[9px] leading-none">
                      <span className="font-mono text-stone-400">{idx + 1}</span>
                      {slot && slot.count > 1 ? (
                        <span className="font-semibold text-stone-200">{slot.count}</span>
                      ) : (
                        <span />
                      )}
                    </div>
                    {def ? (
                      <>
                        <span className="text-base leading-none">{def.icon}</span>
                        <span className="w-full truncate text-center text-[8.5px] font-medium leading-tight text-stone-300">
                          {def.name}
                        </span>
                        {slot?.durability !== undefined && maxDur && def.id !== 'torch' && def.id !== 'lantern' && (
                          <div className="absolute bottom-0.5 left-1.5 right-1.5 h-0.5 overflow-hidden rounded-full bg-white/15">
                            <div
                              className="h-full bg-amber-400"
                              style={{
                                width: `${Math.min(100, Math.round((slot.durability / maxDur) * 100))}%`,
                              }}
                            />
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="my-auto text-[9px] text-stone-600">—</span>
                    )}
                  </button>
                );
              })}
            </div>
            <FloatingItemTooltip hover={hotbarHover} />
          </div>

          <div className="flex w-52 flex-col items-end justify-end gap-1.5">
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

        {/* Controls Hint Bar (always fits completely on screen, toggles with [H], auto-hides cleanly) */}
        <div className="flex justify-center">
          {showControlsHint ? (
            <button
              type="button"
              onClick={onToggleControlsHint}
              title="Click or press [H] to hide controls hints"
              className="pointer-events-auto max-w-[95vw] rounded-md border border-white/10 bg-stone-950/45 px-2.5 py-1 text-center text-[10.5px] font-light tracking-wide text-stone-300 transition hover:border-white/25 hover:text-stone-100"
            >
              [WASD] Move · [Space] Jump · [Shift] Sprint · [E/Click] Interact · [B] Build · [Tab/I] Craft · [J] Journal · [M] Map · [H] Hide Hints
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleControlsHint}
              title="Press [H] to show controls"
              className="pointer-events-auto rounded-md border border-white/10 bg-stone-950/35 px-2 py-0.5 text-[10px] font-light tracking-wider text-stone-400 transition hover:border-white/25 hover:text-stone-200"
            >
              [H] Controls
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
