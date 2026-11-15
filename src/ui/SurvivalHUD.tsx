import React, { useEffect, useRef, useState } from 'react';
import {
  Flame,
  Heart,
  Droplets,
  Utensils,
  Zap,
  Thermometer,
  Home,
  Hammer,
  Save,
  AlertTriangle,
  Camera,
  Wind,
  Shield,
  Swords,
  Waves,
} from 'lucide-react';
import {
  CombatHudStatus,
  HoveredTargetInfo,
  ScenePerformanceMetrics,
} from '../scene/SurvivalScene3D.ts';
import {
  BOSS_TUNING,
  GRAPHICS_TUNING,
  HUD_TUNING,
  INVENTORY,
  PART5_IMMERSION_TUNING,
  TEMPERATURE,
  WORLD,
} from '../survival/config.ts';
import { getEquipped, getInitialDurability, ITEM_DEFS } from '../survival/items.ts';
import { FloatingItemTooltip, HoverTooltipData } from './ItemTooltip.tsx';
import { getBodyTempStage } from '../survival/needs.ts';
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

export interface PickupToastItem {
  id: string;
  text: string;
  icon?: string;
}

interface SurvivalHUDProps {
  state: SurvivalState;
  playerContext: PlayerContext;
  hoveredTarget: HoveredTargetInfo | null;
  statusMessage: string | null;
  pickupToasts?: PickupToastItem[];
  saveBadgeText?: string | null;
  activeBuildType?: StructureType | null;
  nearbyStations?: ReadonlySet<CraftStation>;
  fps?: number;
  perfMetrics?: ScenePerformanceMetrics | null;
  showPerfOverlay?: boolean;
  showDebug?: boolean;
  damageFlash: boolean;
  sleepFadeAlpha?: number;
  playerYaw?: number;
  oxygen?: number;
  holdInteractProgress?: number;
  captions?: Array<{ id: string; text: string }>;
  tutorialHint?: { id: string; text: string } | null;
  onDismissTutorialHint?: () => void;
  photoMode?: boolean;
  photoFilter?: number;
  onTogglePhotoMode?: () => void;
  onChangePhotoFilter?: (idx: number) => void;
  onCapturePhoto?: () => void;
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
  onDebugStartBossFight?: () => void;
  combatHud?: CombatHudStatus;
}

export const SurvivalHUD: React.FC<SurvivalHUDProps> = ({
  state,
  playerContext,
  hoveredTarget,
  statusMessage,
  pickupToasts = [],
  saveBadgeText,
  activeBuildType,
  nearbyStations,
  fps,
  perfMetrics,
  showPerfOverlay = false,
  showDebug,
  damageFlash,
  sleepFadeAlpha = 0,
  playerYaw = 0,
  oxygen = 100,
  holdInteractProgress = 0,
  captions = [],
  tutorialHint = null,
  onDismissTutorialHint,
  photoMode = false,
  photoFilter = 0,
  onTogglePhotoMode,
  onChangePhotoFilter,
  onCapturePhoto,
  onSelectSlot,
  onUseSelected,
  onCancelBuild,
  onDebugTeleport,
  onDebugGrantSupplies,
  onDebugStage6Setup,
  onDebugAdvanceTime,
  onDebugCycleWeather,
  onDebugFastSail,
  onDebugStartBossFight,
  combatHud,
}) => {
  const [hotbarHover, setHotbarHover] = useState<HoverTooltipData | null>(null);
  const [vitalsActive, setVitalsActive] = useState<boolean>(true);
  const [compassActive, setCompassActive] = useState<boolean>(true);
  const [areaBanner, setAreaBanner] = useState<{ name: string; id: string } | null>(null);

  const prevVitalsRef = useRef({
    health: state.needs.health,
    hunger: state.needs.hunger,
    thirst: state.needs.thirst,
    stamina: state.needs.stamina,
    temperature: state.needs.temperature,
  });
  const vitalsTimerRef = useRef<number | null>(null);
  const prevYawRef = useRef<number>(playerYaw);
  const compassTimerRef = useRef<number | null>(null);
  const prevZoneIdRef = useRef<string | null>(null);
  const areaTimerRef = useRef<number | null>(null);

  const { needs, weather, inventory, selectedSlot, boss } = state;
  const bossActive = boss.combatPhase !== 'inactive' && boss.combatPhase !== 'ended';
  const crystalsLeft = boss.crystalsAlive.filter(Boolean).length;
  const activeSubtitle = combatHud?.bossSubtitle ?? boss.subtitleText;
  const equipped = getEquipped(inventory, selectedSlot);
  const currentZone = ISLAND_ZONES[getZoneAt(state.player.x, state.player.z)];

  const tempStage = getBodyTempStage(needs.temperature);
  const isLowHealth = needs.health < GRAPHICS_TUNING.LOW_HEALTH_VIGNETTE_THRESHOLD;
  const isCold = needs.temperature < TEMPERATURE.COLD_FEEDBACK_C;
  const isHypothermic = needs.temperature < TEMPERATURE.HYPOTHERMIA_C;
  const tempTrendArrow =
    needs.tempTrend === 'warming' ? '↑' : needs.tempTrend === 'cooling' ? '↓' : '';

  const actSteps = evaluateObjectivesForAct(state);
  const actLabel = getActLabel(state.act);
  const completedSteps = actSteps.filter((s) => s.completed).length;
  const activeStep = getCurrentObjective(actSteps);
  const currentObjective = activeStep
    ? {
        title: activeStep.title,
        progress: activeStep.progressText,
      }
    : {
        title: state.act >= 4 ? 'Prepare Escape Boat' : 'Explore the Island',
        progress: `${completedSteps}/${actSteps.length}`,
      };

  const hasUrgentVitals =
    needs.health < HUD_TUNING.VITALS_HEALTH_SHOW_THRESHOLD ||
    needs.hunger < HUD_TUNING.VITALS_NEEDS_SHOW_THRESHOLD ||
    needs.thirst < HUD_TUNING.VITALS_NEEDS_SHOW_THRESHOLD ||
    needs.stamina < HUD_TUNING.VITALS_STAMINA_SHOW_THRESHOLD ||
    needs.sickness > 0 ||
    tempStage.stage !== 'Normal' ||
    oxygen < 99.5 ||
    damageFlash;

  // Brighten vitals whenever health/needs/temp change or dip below threshold, then fade gently after idle delay
  useEffect(() => {
    const prev = prevVitalsRef.current;
    const changed =
      Math.abs(needs.health - prev.health) >= 0.4 ||
      Math.abs(needs.hunger - prev.hunger) >= 0.4 ||
      Math.abs(needs.thirst - prev.thirst) >= 0.4 ||
      Math.abs(needs.stamina - prev.stamina) >= 0.8 ||
      Math.abs(needs.temperature - prev.temperature) >= 0.25;

    prevVitalsRef.current = {
      health: needs.health,
      hunger: needs.hunger,
      thirst: needs.thirst,
      stamina: needs.stamina,
      temperature: needs.temperature,
    };

    if (hasUrgentVitals || changed) {
      setVitalsActive(true);
      if (vitalsTimerRef.current) window.clearTimeout(vitalsTimerRef.current);
      if (!hasUrgentVitals) {
        vitalsTimerRef.current = window.setTimeout(() => {
          setVitalsActive(false);
        }, HUD_TUNING.VITALS_FADE_DELAY_SEC * 1000);
      }
    }
  }, [
    needs.health,
    needs.hunger,
    needs.thirst,
    needs.stamina,
    needs.temperature,
    hasUrgentVitals,
  ]);

  useEffect(() => {
    return () => {
      if (vitalsTimerRef.current) window.clearTimeout(vitalsTimerRef.current);
      if (compassTimerRef.current) window.clearTimeout(compassTimerRef.current);
      if (areaTimerRef.current) window.clearTimeout(areaTimerRef.current);
    };
  }, []);

  // Brighten compass while rotating or moving; fade smoothly after heading settles
  useEffect(() => {
    const yawDelta = Math.abs(playerYaw - prevYawRef.current);
    prevYawRef.current = playerYaw;
    if (yawDelta > 0.015 || playerContext.isMoving || bossActive) {
      setCompassActive(true);
      if (compassTimerRef.current) window.clearTimeout(compassTimerRef.current);
      if (!bossActive) {
        compassTimerRef.current = window.setTimeout(() => {
          setCompassActive(false);
        }, HUD_TUNING.COMPASS_FADE_DELAY_SEC * 1000);
      }
    }
  }, [playerYaw, playerContext.isMoving, bossActive]);

  // Transient fading banner when entering a new island region
  useEffect(() => {
    if (prevZoneIdRef.current !== currentZone.id) {
      prevZoneIdRef.current = currentZone.id;
      setAreaBanner({ name: currentZone.name, id: currentZone.id });
      if (areaTimerRef.current) window.clearTimeout(areaTimerRef.current);
      areaTimerRef.current = window.setTimeout(() => {
        setAreaBanner(null);
      }, HUD_TUNING.AREA_BANNER_DURATION_SEC * 1000);
    }
  }, [currentZone.id, currentZone.name]);

  // Auto-dismiss tip pill cleanly after TIP_AUTO_HIDE_SEC
  useEffect(() => {
    if (!tutorialHint || !onDismissTutorialHint) return;
    const tid = window.setTimeout(() => {
      onDismissTutorialHint();
    }, HUD_TUNING.TIP_AUTO_HIDE_SEC * 1000);
    return () => window.clearTimeout(tid);
  }, [tutorialHint, onDismissTutorialHint]);

  const activeStance = playerContext.isSwimming
    ? 'swim'
    : playerContext.stance && playerContext.stance !== 'stand'
      ? playerContext.stance
      : null;

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

      {/* Cinematic Sleep blackout fade */}
      {sleepFadeAlpha > 0.01 && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black transition-opacity duration-150"
          style={{ opacity: Math.min(1, sleepFadeAlpha) }}
        >
          {sleepFadeAlpha > 0.65 && (
            <div className="text-center tracking-widest text-amber-200/85">
              <div className="text-xs uppercase opacity-75">Shelter Rest</div>
              <div className="mt-1 text-sm font-medium">Sleeping until dawn...</div>
            </div>
          )}
        </div>
      )}

      {/* Top Bar: Discreet F3 Perf Only (Left) + Auto-Fading Compass & Area Banner (Center) + 1-Line Objective (Right) */}
      {!photoMode && (
      <div className="flex items-start justify-between gap-2.5 p-2.5 sm:p-3">
        {/* Top-Left: Only shown when [F3] Performance Monitor is explicitly toggled */}
        <div className="min-w-[140px]">
          {showPerfOverlay && perfMetrics && (
            <div className="pointer-events-auto rounded-md border border-cyan-500/40 bg-stone-950/85 px-2.5 py-1.5 font-mono text-[10px] leading-relaxed text-cyan-200 shadow-lg">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-0.5 font-semibold text-cyan-300">
                <span>PERF [F3]</span>
                <span>{perfMetrics.fps} FPS ({perfMetrics.frameTimeMs.toFixed(1)}ms)</span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9.5px] text-stone-300">
                <span>Calls: <b className="text-stone-100">{perfMetrics.drawCalls}</b></span>
                <span>Tris: <b className="text-stone-100">{perfMetrics.triangles.toLocaleString()}</b></span>
                <span>Scale: <b className="text-stone-100">{perfMetrics.renderScale}%</b></span>
                <span>Cap: <b className="text-stone-100">{perfMetrics.fpsLimit === 0 ? 'Max' : perfMetrics.fpsLimit}</b></span>
              </div>
            </div>
          )}
        </div>

        {/* Top-Center: Auto-Fading Sleek Landmark Compass + Transient Area Banner */}
        <div className="pointer-events-none flex flex-col items-center">
          <div
            className={`hidden flex-col items-center transition-opacity duration-700 sm:flex ${
              compassActive ? 'opacity-90' : 'opacity-15'
            }`}
          >
            <div className="relative h-7 w-72 sm:w-80 overflow-hidden rounded-full border border-white/15 bg-stone-950/55 shadow-sm backdrop-blur-xs">
              <div className="absolute left-1/2 top-0 h-1.5 w-0.5 -translate-x-1/2 bg-amber-400" />
              {(
                [
                  { label: 'N', ang: 0, color: 'text-amber-300 font-bold' },
                  { label: 'NE', ang: Math.PI * 0.25, color: 'text-stone-400' },
                  { label: 'E', ang: Math.PI * 0.5, color: 'text-stone-200 font-semibold' },
                  { label: 'SE', ang: Math.PI * 0.75, color: 'text-stone-400' },
                  { label: 'S', ang: Math.PI, color: 'text-stone-200 font-semibold' },
                  { label: 'SW', ang: -Math.PI * 0.75, color: 'text-stone-400' },
                  { label: 'W', ang: -Math.PI * 0.5, color: 'text-stone-200 font-semibold' },
                  { label: 'NW', ang: -Math.PI * 0.25, color: 'text-stone-400' },
                ] as const
              ).map((card) => {
                let rel = card.ang + playerYaw;
                while (rel > Math.PI) rel -= Math.PI * 2;
                while (rel < -Math.PI) rel += Math.PI * 2;
                if (Math.abs(rel) > 1.25) return null;
                const leftPct = 50 + (rel / 1.2) * 50;
                return (
                  <span
                    key={card.label}
                    className={`absolute top-1 -translate-x-1/2 font-mono text-[9.5px] ${card.color}`}
                    style={{ left: `${leftPct}%` }}
                  >
                    {card.label}
                  </span>
                );
              })}
              {(() => {
                const items = [
                  { label: 'Wreck', x: WORLD.WRECK_POS.x, z: WORLD.WRECK_POS.z, cls: 'bg-sky-300 text-sky-200' },
                  { label: 'Spring', x: WORLD.SPRING_POS.x, z: WORLD.SPRING_POS.z, cls: 'bg-cyan-400 text-cyan-200' },
                  { label: 'Camp', x: WORLD.ABANDONED_CAMP_POS.x, z: WORLD.ABANDONED_CAMP_POS.z, cls: 'bg-amber-400 text-amber-200' },
                  { label: 'Cave', x: WORLD.CAVE_GROTTO_POS.x, z: WORLD.CAVE_GROTTO_POS.z, cls: 'bg-purple-400 text-purple-200' },
                  { label: 'Ruins', x: WORLD.ANCIENT_RUINS_POS.x, z: WORLD.ANCIENT_RUINS_POS.z, cls: 'bg-emerald-400 text-emerald-200' },
                  { label: 'Station', x: WORLD.RESEARCH_STATION_POS.x, z: WORLD.RESEARCH_STATION_POS.z, cls: 'bg-rose-400 text-rose-200' },
                  { label: 'Dock', x: WORLD.BOAT_DOCK_POS.x, z: WORLD.BOAT_DOCK_POS.z, cls: 'bg-teal-400 text-teal-200' },
                ]
                  .map((lm) => {
                    const dx = lm.x - state.player.x;
                    const dz = lm.z - state.player.z;
                    const distSq = dx * dx + dz * dz;
                    let rel = Math.atan2(dx, -dz) + playerYaw;
                    while (rel > Math.PI) rel -= Math.PI * 2;
                    while (rel < -Math.PI) rel += Math.PI * 2;
                    return { ...lm, distSq, rel, leftPct: 50 + (rel / 1.2) * 50 };
                  })
                  .filter((lm) => lm.distSq >= 16 && Math.abs(lm.rel) <= 1.12)
                  .sort((a, b) => a.distSq - b.distSq);
                const occupiedPcts: number[] = [];
                return items.map((lm) => {
                  const showText = occupiedPcts.every((p) => Math.abs(p - lm.leftPct) >= 16);
                  if (showText) occupiedPcts.push(lm.leftPct);
                  return (
                    <span
                      key={lm.label}
                      className="absolute bottom-0.5 flex -translate-x-1/2 items-center gap-0.5 text-[8px] font-medium"
                      style={{ left: `${lm.leftPct}%` }}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${lm.cls.split(' ')[0]}`} />
                      {showText && <span className={lm.cls.split(' ')[1]}>{lm.label}</span>}
                    </span>
                  );
                });
              })()}
            </div>
          </div>

          {areaBanner && (
            <div
              key={areaBanner.id}
              data-testid="area-entry-banner"
              className="mt-2.5 flex flex-col items-center text-center drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]"
            >
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.28em] text-amber-300/85">
                {actLabel}
              </span>
              <span className="mt-0.5 text-sm font-semibold uppercase tracking-[0.2em] text-stone-100">
                {areaBanner.name}
              </span>
              <span className="mt-1 h-px w-20 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
            </div>
          )}
        </div>

        {/* Top-Right: Single-Line Concise Objective & Active Build/Save Pill */}
        <div className="flex flex-col items-end gap-1.5">
          {!bossActive && (
            <div
              data-testid="hud-objective"
              className="flex max-w-xs items-center gap-2 rounded-lg border border-white/10 bg-stone-950/45 px-2.5 py-1.5 text-right shadow-sm backdrop-blur-xs"
            >
              <span className="truncate text-xs font-medium text-stone-100">
                {currentObjective.title}
              </span>
              {currentObjective.progress && (
                <span className="shrink-0 rounded border border-amber-400/30 bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-200">
                  {currentObjective.progress}
                </span>
              )}
            </div>
          )}

          {activeBuildType && (
            <div className="pointer-events-auto flex items-center gap-2 rounded-md border border-emerald-600/80 bg-stone-950/90 px-3 py-1.5 text-xs font-medium text-emerald-300 shadow">
              <Hammer className="h-3.5 w-3.5" />
              <span>
                Placing {STRUCTURE_CATALOG[activeBuildType].name} · Rotate
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
      )}

      {/* Final Boss Health Bar ("LAVANS BALI — THE AURA KING") */}
      {!photoMode && bossActive && (
        <div
          data-testid="boss-health-bar"
          className="pointer-events-none fixed inset-x-0 top-14 z-20 flex flex-col items-center px-3"
        >
          <div className="w-[min(430px,45vw)] rounded-xl border border-purple-500/70 bg-stone-950/88 px-3.5 py-2 shadow-2xl backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
              <div className="flex items-center gap-1.5 font-extrabold tracking-wider text-amber-200">
                <Swords className="h-3.5 w-3.5 text-purple-400" />
                <span>{BOSS_TUNING.DISPLAY_NAME}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider">
                <span className="rounded border border-purple-500/40 bg-purple-950/70 px-1.5 py-0.5 text-purple-200">
                  {boss.phase === 1
                    ? 'Phase I · Shore Sanctum'
                    : boss.phase === 2
                      ? 'Phase II · Crystal Ward'
                      : 'Phase III · Eye of the Storm'}
                </span>
                <span className="font-mono text-stone-300">
                  {Math.max(0, Math.round(boss.hp))} / {boss.maxHp}
                </span>
              </div>
            </div>
            <div className="relative mt-1.5 h-3 w-full overflow-hidden rounded-full border border-purple-900/70 bg-stone-900">
              <div
                className={`h-full transition-all duration-150 ${
                  boss.shielded
                    ? 'bg-gradient-to-r from-indigo-500 via-purple-400 to-cyan-300'
                    : combatHud?.bossStaggered || boss.staggeredSec > 0
                      ? 'bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-400'
                      : 'bg-gradient-to-r from-rose-700 via-purple-500 to-amber-400'
                }`}
                style={{ width: `${Math.max(0, Math.min(100, (boss.hp / Math.max(1, boss.maxHp)) * 100))}%` }}
              />
            </div>
            {(boss.shielded || combatHud?.bossStaggered || boss.staggeredSec > 0) && (
              <div className="mt-1 flex items-center justify-center gap-2 text-[11px] font-bold tracking-wider">
                {boss.shielded && (
                  <span className="inline-flex items-center gap-1 text-cyan-300">
                    <Shield className="h-3 w-3" /> AURA SHIELD ACTIVE ({crystalsLeft} Crystal{crystalsLeft === 1 ? '' : 's'} Left — Shatter Crystals!)
                  </span>
                )}
                {(combatHud?.bossStaggered || boss.staggeredSec > 0) && (
                  <span className="animate-pulse text-amber-300">
                    ⚡ AURA DIMMED — STRIKE NOW! (Weakpoint Exposed)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Center Reticle & Contextual Interaction Prompt (hidden while steering boat offshore or in Photo Mode) */}
      {!photoMode && (
      <div className="fixed inset-0 flex flex-col items-center justify-center pointer-events-none">
        {(state.voyage.phase === 'docked' || boss.combatPhase === 'phase3_boat') && (
          <>
            <div className="relative flex items-center justify-center">
              {holdInteractProgress > 0.02 && (
                <svg className="absolute h-7 w-7 -rotate-90" viewBox="0 0 28 28">
                  <circle
                    cx="14"
                    cy="14"
                    r="11"
                    fill="none"
                    stroke="rgba(255,255,255,0.22)"
                    strokeWidth="2.5"
                  />
                  <circle
                    cx="14"
                    cy="14"
                    r="11"
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth="2.5"
                    strokeDasharray={2 * Math.PI * 11}
                    strokeDashoffset={2 * Math.PI * 11 * (1 - Math.min(1, holdInteractProgress))}
                    strokeLinecap="round"
                  />
                </svg>
              )}
              <div
                className={`h-2 w-2 rounded-full border transition-transform duration-150 ${
                  hoveredTarget
                    ? hoveredTarget.canInteract
                      ? 'scale-125 border-amber-300 bg-amber-400/80'
                      : 'scale-110 border-red-400 bg-red-500/60'
                    : 'border-white/70 bg-white/30'
                }`}
              />
            </div>

            {/* Combat Charge / Bow Draw / Block HUD indicator */}
            {combatHud && (combatHud.heavyChargePct > 0.05 || combatHud.bowDrawPct > 0.05 || combatHud.isBlocking) && (
              <div className="mt-2.5 flex flex-col items-center gap-1">
                {combatHud.isBlocking && (
                  <div className="inline-flex items-center gap-1 rounded border border-cyan-400/70 bg-cyan-950/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-200">
                    <Shield className="h-3 w-3" /> Blocking (-70% Dmg)
                  </div>
                )}
                {(combatHud.heavyChargePct > 0.05 || combatHud.bowDrawPct > 0.05) && (
                  <div className="h-1.5 w-24 overflow-hidden rounded-full border border-white/25 bg-stone-950/85">
                    <div
                      className={`h-full ${
                        combatHud.bowDrawPct > 0 ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}
                      style={{
                        width: `${Math.round(Math.max(combatHud.heavyChargePct, combatHud.bowDrawPct) * 100)}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            )}

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
      )}

      {/* Photo Mode Minimalist Studio Overlay */}
      {photoMode && (
        <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl border border-white/20 bg-stone-950/85 px-4 py-2.5 shadow-2xl backdrop-blur-md">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
              <Camera className="h-3.5 w-3.5" /> Photo Mode
            </span>
            <span className="text-[11px] text-stone-400">WASD + Space/Q Free-Fly · Drag Look</span>
            <div className="flex items-center gap-1 border-l border-white/15 pl-2">
              {PART5_IMMERSION_TUNING.PHOTO_FILTER_NAMES.map((name, idx) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => onChangePhotoFilter?.(idx)}
                  className={`rounded-md px-2 py-1 text-[10.5px] font-semibold transition ${
                    photoFilter === idx
                      ? 'bg-amber-500 text-stone-950'
                      : 'bg-stone-800/90 text-stone-300 hover:bg-stone-700'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
            {onCapturePhoto && (
              <button
                type="button"
                onClick={onCapturePhoto}
                className="rounded-lg bg-emerald-500 px-3 py-1 text-xs font-bold text-stone-950 hover:bg-emerald-400"
              >
                Capture PNG
              </button>
            )}
            {onTogglePhotoMode && (
              <button
                type="button"
                onClick={onTogglePhotoMode}
                className="rounded-lg border border-white/15 bg-stone-800 px-2.5 py-1 text-xs font-semibold text-stone-200 hover:bg-stone-700"
              >
                Exit [P]
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bottom Area: Vitals + Hotbar + Safely Framed Controls Hint */}
      {!photoMode && (
      <div className="fixed inset-x-0 bottom-0 flex flex-col gap-1.5 px-3 pb-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          {/* Bottom-Left Auto-Fading Needs Vitals & Contextual Stance Icon */}
          <div className="flex flex-col items-start gap-1.5">
            {activeStance && (
              <div
                data-testid="stance-indicator"
                className={`pointer-events-none inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest shadow ${
                  activeStance === 'swim'
                    ? 'border-cyan-400/50 bg-cyan-950/75 text-cyan-200'
                    : activeStance === 'prone'
                      ? 'border-emerald-500/45 bg-emerald-950/75 text-emerald-200'
                      : activeStance === 'sit'
                        ? 'border-amber-500/45 bg-amber-950/75 text-amber-200'
                        : activeStance === 'crouch'
                          ? 'border-sky-500/45 bg-sky-950/75 text-sky-200'
                          : 'border-indigo-500/45 bg-indigo-950/75 text-indigo-200'
                }`}
              >
                {activeStance === 'swim' && <Waves className="h-3 w-3" />}
                <span>
                  {activeStance === 'swim'
                    ? 'Swimming'
                    : activeStance === 'crouch'
                      ? 'Crouched'
                      : activeStance === 'prone'
                        ? 'Prone'
                        : activeStance === 'sit'
                          ? 'Sitting · Rest+'
                          : 'Sleeping'}
                </span>
              </div>
            )}

            <div
              data-testid="vitals-panel"
              className={`pointer-events-auto flex w-48 flex-col gap-1 rounded-lg border border-white/10 bg-stone-950/50 p-2 shadow-sm transition-opacity duration-500 hover:opacity-100 ${
                vitalsActive ? 'opacity-95' : 'opacity-20'
              }`}
            >
              {/* Health */}
              <div className="flex items-center gap-1.5">
                <Heart className="h-3 w-3 shrink-0 text-rose-400" />
                <div className="flex-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-rose-500 transition-all duration-200"
                      style={{ width: `${Math.max(0, Math.min(100, needs.health))}%` }}
                    />
                  </div>
                </div>
                <span className="w-7 text-right font-mono text-[9.5px] text-stone-300">
                  {Math.round(needs.health)}
                </span>
              </div>

              {/* Hunger */}
              <div className="flex items-center gap-1.5">
                <Utensils className="h-3 w-3 shrink-0 text-amber-400" />
                <div className="flex-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-amber-400 transition-all duration-200"
                      style={{ width: `${Math.max(0, Math.min(100, needs.hunger))}%` }}
                    />
                  </div>
                </div>
                <span className="w-7 text-right font-mono text-[9.5px] text-stone-300">
                  {Math.round(needs.hunger)}
                </span>
              </div>

              {/* Thirst */}
              <div className="flex items-center gap-1.5">
                <Droplets className="h-3 w-3 shrink-0 text-sky-400" />
                <div className="flex-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-sky-400 transition-all duration-200"
                      style={{ width: `${Math.max(0, Math.min(100, needs.thirst))}%` }}
                    />
                  </div>
                </div>
                <span className="w-7 text-right font-mono text-[9.5px] text-stone-300">
                  {Math.round(needs.thirst)}
                </span>
              </div>

              {/* Stamina */}
              <div className="flex items-center gap-1.5">
                <Zap className="h-3 w-3 shrink-0 text-emerald-400" />
                <div className="flex-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-200"
                      style={{ width: `${Math.max(0, Math.min(100, needs.stamina))}%` }}
                    />
                  </div>
                </div>
                <span className="w-7 text-right font-mono text-[9.5px] text-stone-300">
                  {Math.round(needs.stamina)}
                </span>
              </div>

              {/* Body Temperature */}
              <div className="flex items-center justify-between border-t border-white/10 pt-1 text-[10px] font-light tracking-wide text-stone-300">
                <span className="flex items-center gap-1">
                  <Thermometer className="h-3 w-3 text-amber-300" />
                  <span className={isHypothermic ? 'font-medium text-sky-300' : isCold ? 'text-sky-200' : 'text-stone-200'}>
                    {needs.temperature.toFixed(1)}°C {tempTrendArrow && <span className="text-amber-300">{tempTrendArrow}</span>}
                  </span>
                </span>
                {tempStage.stage !== 'Normal' && (
                  <span className="text-[9.5px] text-sky-200">{tempStage.stage}</span>
                )}
              </div>

              {/* Transient status pills only when active */}
              {(playerContext.sheltered ||
                playerContext.nearFire ||
                nearbyStations?.has('workbench') ||
                nearbyStations?.has('forge') ||
                needs.sickness > 0) && (
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  {playerContext.sheltered && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-emerald-950/70 px-1.5 py-0.5 text-[9px] text-emerald-300">
                      <Home className="h-2.5 w-2.5" /> Shelter
                    </span>
                  )}
                  {playerContext.nearFire && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-amber-950/70 px-1.5 py-0.5 text-[9px] text-amber-300">
                      <Flame className="h-2.5 w-2.5" /> Warm
                    </span>
                  )}
                  {nearbyStations?.has('workbench') && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-stone-900/80 px-1.5 py-0.5 text-[9px] text-emerald-300">
                      <Hammer className="h-2.5 w-2.5" /> Bench
                    </span>
                  )}
                  {nearbyStations?.has('forge') && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-orange-950/70 px-1.5 py-0.5 text-[9px] text-orange-300">
                      Forge
                    </span>
                  )}
                  {needs.sickness > 0 && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-lime-950/70 px-1.5 py-0.5 text-[9px] text-lime-300">
                      <AlertTriangle className="h-2.5 w-2.5" /> Sick ({Math.ceil(needs.sickness)}s)
                    </span>
                  )}
                </div>
              )}

              {/* Underwater O2 Breath Meter */}
              {oxygen < 99.5 && (
                <div className="flex items-center gap-1.5 border-t border-white/10 pt-1">
                  <Wind className="h-3 w-3 shrink-0 text-cyan-300" />
                  <div className="flex-1">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full transition-all duration-150 ${
                          oxygen < 25 ? 'animate-pulse bg-rose-400' : 'bg-cyan-400'
                        }`}
                        style={{ width: `${Math.max(0, Math.min(100, oxygen))}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-7 text-right font-mono text-[9.5px] text-cyan-200">
                    {Math.round(oxygen)}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom-Center 6-Slot Quick Hotbar + Item Pickup Pop-ups */}
          <div className="pointer-events-auto flex flex-col items-center gap-1">
            {pickupToasts.length > 0 && (
              <div className="pointer-events-none mb-0.5 flex flex-col items-center gap-1">
                {pickupToasts.map((toast) => (
                  <div
                    key={toast.id}
                    className="flex animate-bounce items-center gap-1.5 rounded-md border border-emerald-400/50 bg-stone-950/85 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-emerald-300 shadow-lg transition-all duration-300"
                  >
                    {toast.icon && <span>{toast.icon}</span>}
                    <span>{toast.text}</span>
                  </div>
                ))}
              </div>
            )}

            {equipped.def && (
              <div className="flex items-center gap-2 rounded-md border border-white/10 bg-stone-950/50 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-stone-200">
                <span>{equipped.def.name}</span>
                {equipped.def.food && (
                  <button
                    type="button"
                    onClick={onUseSelected}
                    className="rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-stone-950 hover:bg-amber-400"
                  >
                    Consume [G]
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
              {onDebugStartBossFight && (
                <button
                  type="button"
                  data-testid="debug-boss-btn"
                  onClick={onDebugStartBossFight}
                  className="w-full rounded bg-gradient-to-r from-purple-700 to-amber-600 px-1.5 py-1 text-[10.5px] font-bold text-white hover:from-purple-600 hover:to-amber-500"
                >
                  ⚔️ Boss Fight [F8]
                </button>
              )}
            </div>
          )}
        </div>
        </div>

        {/* Dramatic Boss Subtitles */}
        {bossActive && activeSubtitle && (
          <div className="flex justify-center">
            <div className="rounded-lg border border-purple-500/50 bg-stone-950/90 px-4 py-1.5 text-center text-xs font-semibold tracking-wide text-amber-100 shadow-xl">
              {activeSubtitle}
            </div>
          </div>
        )}

        {/* Concise 1-line fading tip & closed captions */}
        {tutorialHint && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => onDismissTutorialHint?.()}
              className="pointer-events-auto max-w-md truncate rounded-full border border-amber-500/35 bg-stone-950/75 px-3.5 py-1 text-[11px] text-amber-100/95 shadow transition hover:border-amber-400/60"
            >
              {tutorialHint.text}
            </button>
          </div>
        )}

        {captions.length > 0 && (
          <div className="flex flex-col items-center gap-1">
            {captions.map((cap) => (
              <div
                key={cap.id}
                className="rounded-full border border-white/15 bg-stone-950/80 px-3 py-0.5 text-[10.5px] font-medium tracking-wide text-stone-200 shadow"
              >
                {cap.text}
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
};
