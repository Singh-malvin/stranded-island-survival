import React from 'react';
import {
  Anchor,
  CheckCircle2,
  Compass,
  Droplets,
  Flame,
  Fuel,
  Hammer,
  Navigation,
  PackageOpen,
  Shield,
  Ship,
  Utensils,
  Waves,
  Wind,
  Wrench,
  X,
} from 'lucide-react';
import { BOAT, BOSS_TUNING, VOYAGE } from '../survival/config.ts';
import { countItem, ITEM_DEFS } from '../survival/items.ts';
import {
  BoatStageId,
  BossDifficulty,
  InventorySlot,
  SurvivalState,
  VoyageThrottle,
} from '../survival/types.ts';
import {
  BOAT_STAGE_DEFS,
  BOAT_STAGE_ORDER,
  canBuildBoatStage,
  computeSeaWeatherForLeg,
  countBoatStagesComplete,
  countSeaRations,
  isBoatReadyToLaunch,
  VOYAGE_STOPS,
} from '../survival/voyage.ts';

interface BoatVoyageModalProps {
  state: SurvivalState;
  isDockOpen: boolean;
  onCloseDock: () => void;
  onBuildStage: (stageId: BoatStageId) => void;
  onLaunchVoyage: () => void;
  onSetThrottle: (throttle: VoyageThrottle) => void;
  onRepairHull: () => void;
  onRefuel: () => void;
  onScavengeStop: () => void;
  onAnchorRest: () => void;
  onResumeLeg: () => void;
  onReturnToDock: () => void;
  onConsumeItemSlot: (slotIndex: number) => void;
  onChangeBossDifficulty?: (diff: BossDifficulty) => void;
}

function findConsumableSlots(inventory: (InventorySlot | null)[]) {
  let foodIdx = -1;
  let foodName = '';
  let waterIdx = -1;
  let waterName = '';
  for (let i = 0; i < inventory.length; i++) {
    const s = inventory[i];
    if (!s) continue;
    const def = ITEM_DEFS[s.itemId];
    if (
      foodIdx === -1 &&
      def?.food?.hunger &&
      !def.food.sickChance
    ) {
      foodIdx = i;
      foodName = def.name;
    }
    if (
      waterIdx === -1 &&
      def?.food?.thirst &&
      !def.food.sickChance
    ) {
      waterIdx = i;
      waterName = def.name;
    }
  }
  return { foodIdx, foodName, waterIdx, waterName };
}

export const BoatVoyageModal: React.FC<BoatVoyageModalProps> = ({
  state,
  isDockOpen,
  onCloseDock,
  onBuildStage,
  onLaunchVoyage,
  onSetThrottle,
  onRepairHull,
  onRefuel,
  onScavengeStop,
  onAnchorRest,
  onResumeLeg,
  onReturnToDock,
  onConsumeItemSlot,
  onChangeBossDifficulty,
}) => {
  const v = state.voyage;

  // ---------------------------------------------------------------------------
  // MODE B: ACTIVE OPEN-OCEAN VOYAGE OR STOPOVER OVERLAY (HUD leaves center 3D view clear)
  // ---------------------------------------------------------------------------
  if (v.phase === 'sailing' || v.phase === 'stopover') {
    const seaWeather =
      v.phase === 'sailing'
        ? computeSeaWeatherForLeg(v.legIndex, v.distanceNm)
        : state.weather;
    const isStorm = seaWeather.kind === 'storm';
    const progressPct = Math.min(100, Math.round((v.distanceNm / VOYAGE.TOTAL_DISTANCE_NM) * 100));
    const hasHullPatch =
      countItem(state.inventory, 'plank') >= 2 || countItem(state.inventory, 'resin') >= 1;
    const hasFuelCan = countItem(state.inventory, 'fuel_can') >= 1;
    const consumables = findConsumableSlots(state.inventory);
    const stopDef = v.currentStopId ? VOYAGE_STOPS[v.currentStopId] : null;
    const alreadyScavenged = v.currentStopId ? v.scavengedStops.includes(v.currentStopId) : false;

    return (
      <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between p-4">
        {/* Top Sea Chart & Telemetry Bar */}
        <div className="mx-auto mt-10 w-full max-w-2xl rounded-xl border border-stone-700/90 bg-stone-950/90 p-3.5 text-stone-100 shadow-2xl pointer-events-auto">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Navigation className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-bold tracking-wide">
                {v.phase === 'stopover' && stopDef
                  ? `Anchored at ${stopDef.name}`
                  : `Passage to Port Solis — Leg ${v.legIndex}/4`}
              </span>
              {isStorm && (
                <span className="rounded bg-rose-950 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-300 border border-rose-700">
                  Storm Squall
                </span>
              )}
            </div>
            <div className="text-xs font-mono text-cyan-300">
              {v.distanceNm.toFixed(1)} / {VOYAGE.TOTAL_DISTANCE_NM.toFixed(1)} nm ({progressPct}%)
            </div>
          </div>

          {/* 12 nm Route Bar with Waypoints */}
          <div className="relative mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-stone-800">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-200"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-stone-400">
            <span>Island Dock (0.0)</span>
            <span>Shoal Cay (3.2)</span>
            <span>Atoll (6.5)</span>
            <span>Beacon (9.6)</span>
            <span className="text-amber-300 font-semibold">Port Solis (12.0 nm)</span>
          </div>

          {/* Hull Integrity & Fuel Telemetry */}
          <div className="mt-2.5 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-stone-800 bg-stone-900/80 px-2.5 py-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="flex items-center gap-1 text-stone-300">
                  <Shield className="h-3.5 w-3.5 text-emerald-400" />
                  Hull Integrity
                </span>
                <span
                  className={`font-bold ${
                    v.hullIntegrity < 35 ? 'text-rose-400' : 'text-emerald-300'
                  }`}
                >
                  {Math.round(v.hullIntegrity)}%
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-stone-800">
                <div
                  className={`h-full transition-all ${
                    v.hullIntegrity < 35 ? 'bg-rose-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, v.hullIntegrity))}%` }}
                />
              </div>
            </div>

            <div className="rounded-lg border border-stone-800 bg-stone-900/80 px-2.5 py-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="flex items-center gap-1 text-stone-300">
                  <Fuel className="h-3.5 w-3.5 text-amber-400" />
                  Outboard Diesel
                </span>
                <span className="font-bold text-amber-300">{Math.round(v.fuelPct)}%</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-stone-800">
                <div
                  className="h-full bg-amber-400 transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, v.fuelPct))}%` }}
                />
              </div>
            </div>
          </div>

          {v.seaEventText && (
            <div
              className={`mt-2 rounded px-2.5 py-1 text-xs font-medium ${
                isStorm
                  ? 'border border-rose-800/70 bg-rose-950/50 text-rose-200'
                  : 'border border-stone-800 bg-stone-900/70 text-cyan-200'
              }`}
            >
              {v.seaEventText}
            </div>
          )}
        </div>

        {/* Center-Bottom Islet Stopover Card (only during stopover) OR Helm Control Dock */}
        <div className="mx-auto mb-24 w-full max-w-2xl pointer-events-auto">
          {v.phase === 'stopover' && stopDef ? (
            <div className="rounded-xl border border-cyan-700/80 bg-stone-950/95 p-4 text-stone-100 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-cyan-400">
                    Stopover {stopDef.legNumber}/3
                  </div>
                  <h3 className="text-lg font-bold text-stone-100">{stopDef.name}</h3>
                  <p className="text-xs text-stone-400">{stopDef.subtitle}</p>
                </div>
                <Anchor className="h-6 w-6 shrink-0 text-cyan-400" />
              </div>

              <p className="mt-2 text-xs leading-relaxed text-stone-300">{stopDef.description}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={alreadyScavenged}
                  onClick={onScavengeStop}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${
                    alreadyScavenged
                      ? 'bg-stone-800 text-stone-500 cursor-not-allowed'
                      : 'bg-amber-600 text-stone-950 hover:bg-amber-500'
                  }`}
                >
                  <PackageOpen className="h-3.5 w-3.5" />
                  {alreadyScavenged ? 'Islet Scavenged' : 'Scavenge Islet Cache'}
                </button>

                <button
                  type="button"
                  onClick={onAnchorRest}
                  className="flex items-center gap-1.5 rounded-lg border border-stone-700 bg-stone-800 px-3 py-2 text-xs font-semibold text-stone-200 hover:bg-stone-700"
                >
                  <Flame className="h-3.5 w-3.5 text-orange-400" />
                  Rest &amp; Dry Off (+Stamina)
                </button>

                <button
                  type="button"
                  disabled={!hasHullPatch || v.hullIntegrity >= 100}
                  onClick={onRepairHull}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${
                    hasHullPatch && v.hullIntegrity < 100
                      ? 'bg-emerald-700 text-stone-50 hover:bg-emerald-600'
                      : 'bg-stone-800 text-stone-500 cursor-not-allowed'
                  }`}
                >
                  <Wrench className="h-3.5 w-3.5" />
                  Patch Hull (+{BOAT.HULL_PATCH_AMOUNT}%)
                </button>

                <button
                  type="button"
                  disabled={!hasFuelCan || v.fuelPct >= 99}
                  onClick={onRefuel}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${
                    hasFuelCan && v.fuelPct < 99
                      ? 'bg-amber-800 text-amber-100 hover:bg-amber-700'
                      : 'bg-stone-800 text-stone-500 cursor-not-allowed'
                  }`}
                >
                  <Fuel className="h-3.5 w-3.5" />
                  Refuel Outboard
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stone-800 pt-3">
                <div className="flex gap-2">
                  {consumables.foodIdx >= 0 && (
                    <button
                      type="button"
                      onClick={() => onConsumeItemSlot(consumables.foodIdx)}
                      className="flex items-center gap-1 rounded border border-stone-700 bg-stone-900 px-2.5 py-1 text-[11px] text-amber-300 hover:bg-stone-800"
                    >
                      <Utensils className="h-3 w-3" /> Eat {consumables.foodName}
                    </button>
                  )}
                  {consumables.waterIdx >= 0 && (
                    <button
                      type="button"
                      onClick={() => onConsumeItemSlot(consumables.waterIdx)}
                      className="flex items-center gap-1 rounded border border-stone-700 bg-stone-900 px-2.5 py-1 text-[11px] text-sky-300 hover:bg-stone-800"
                    >
                      <Droplets className="h-3 w-3" /> Drink {consumables.waterName}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onReturnToDock}
                    className="rounded-lg border border-stone-700 px-3 py-1.5 text-xs text-stone-300 hover:bg-stone-800"
                  >
                    Return to Island Dock
                  </button>
                  <button
                    type="button"
                    onClick={onResumeLeg}
                    className="flex items-center gap-1.5 rounded-lg bg-cyan-500 px-4 py-1.5 text-xs font-bold text-stone-950 hover:bg-cyan-400"
                  >
                    <Ship className="h-4 w-4" />
                    Weigh Anchor (Leg {Math.min(4, v.legIndex + 1)}/4)
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-stone-700/90 bg-stone-950/90 p-3 text-stone-100 shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Throttle Selector */}
                <div className="flex items-center gap-1.5">
                  {(
                    [
                      { id: 'sail', label: 'Canvas Sail', icon: Wind },
                      { id: 'motor', label: `Motor (${v.fuelPct > 0 ? '1.75x' : 'Empty'})`, icon: Fuel },
                      { id: 'brace', label: 'Brace Hull (-72% Dmg)', icon: Shield },
                    ] as const
                  ).map((opt) => {
                    const Icon = opt.icon;
                    const active = v.throttle === opt.id;
                    const disabled = opt.id === 'motor' && v.fuelPct <= 0;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => onSetThrottle(opt.id)}
                        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                          active
                            ? opt.id === 'brace'
                              ? 'bg-emerald-600 text-stone-950'
                              : opt.id === 'motor'
                                ? 'bg-amber-500 text-stone-950'
                                : 'bg-cyan-500 text-stone-950'
                            : disabled
                              ? 'bg-stone-900 text-stone-600 cursor-not-allowed'
                              : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                {/* Deck Maintenance & Provisions */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={!hasHullPatch || v.hullIntegrity >= 100}
                    onClick={onRepairHull}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                      hasHullPatch && v.hullIntegrity < 100
                        ? 'bg-emerald-700 text-stone-50 hover:bg-emerald-600'
                        : 'bg-stone-800 text-stone-500 cursor-not-allowed'
                    }`}
                  >
                    <Wrench className="h-3.5 w-3.5" />
                    Patch Hull
                  </button>
                  <button
                    type="button"
                    disabled={!hasFuelCan || v.fuelPct >= 99}
                    onClick={onRefuel}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                      hasFuelCan && v.fuelPct < 99
                        ? 'bg-amber-800 text-amber-100 hover:bg-amber-700'
                        : 'bg-stone-800 text-stone-500 cursor-not-allowed'
                    }`}
                  >
                    <Fuel className="h-3.5 w-3.5" />
                    Refuel
                  </button>
                  {consumables.foodIdx >= 0 && (
                    <button
                      type="button"
                      onClick={() => onConsumeItemSlot(consumables.foodIdx)}
                      className="rounded-lg border border-stone-700 bg-stone-900 px-2 py-1.5 text-xs text-amber-300 hover:bg-stone-800"
                    >
                      Eat
                    </button>
                  )}
                  {consumables.waterIdx >= 0 && (
                    <button
                      type="button"
                      onClick={() => onConsumeItemSlot(consumables.waterIdx)}
                      className="rounded-lg border border-stone-700 bg-stone-900 px-2 py-1.5 text-xs text-sky-300 hover:bg-stone-800"
                    >
                      Drink
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onReturnToDock}
                    className="rounded-lg border border-stone-700 bg-stone-900 px-2.5 py-1.5 text-xs text-stone-400 hover:text-stone-100"
                  >
                    Turn Back
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // MODE A: ISLAND SLIPWAY DOCKYARD MODAL (Act 4 Progressive Boat Building)
  // ---------------------------------------------------------------------------
  if (!isDockOpen) return null;

  const stagesDone = countBoatStagesComplete(state.boat);
  const readyToSail = state.act >= 4 && isBoatReadyToLaunch(state.boat);
  const rationsAvailable = countSeaRations(state.inventory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-stone-700 bg-stone-950 text-stone-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 bg-stone-900/90 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Ship className="h-5 w-5 text-cyan-400" />
            <div>
              <h2 className="text-lg font-bold tracking-wide">
                Southern Boat Slipway &amp; Escape Craft ({stagesDone}/4 Stages)
              </h2>
              <p className="text-xs text-stone-400">
                Construct the escape vessel step by step before tackling the 12 nm crossing to Port Solis
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseDock}
            aria-label="Close Boat Dockyard"
            className="rounded-lg border border-stone-700 p-1.5 text-stone-400 hover:text-stone-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {state.act < 4 && (
            <div className="rounded-lg border border-amber-800/80 bg-amber-950/35 px-4 py-3 text-xs text-amber-200">
              <strong className="text-amber-300">Chart Calibration Required (Act 3):</strong> Repair the
              Radio, Diesel Generator, and Sea Chart at the northern Research Station before drafting and
              launching the escape craft.
            </div>
          )}

          {BOAT_STAGE_ORDER.map((stageId) => {
            const def = BOAT_STAGE_DEFS[stageId];
            const completed = Boolean(state.boat[stageId]);
            const check = canBuildBoatStage(state, stageId);

            return (
              <div
                key={stageId}
                className={`rounded-xl border p-4 ${
                  completed
                    ? 'border-emerald-800/80 bg-emerald-950/25'
                    : check.ok
                      ? 'border-cyan-700/80 bg-stone-900/90'
                      : 'border-stone-800 bg-stone-900/50'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {completed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Hammer className="h-4 w-4 text-cyan-400" />
                      )}
                      <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                        Stage {def.stageNumber}/4
                      </span>
                      <span className="text-sm font-bold text-stone-100">{def.name}</span>
                    </div>
                    <p className="mt-1 text-xs text-stone-400">{def.description}</p>

                    {/* Materials & Rations */}
                    <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px]">
                      {def.ingredients.map((ing) => {
                        const have = countItem(state.inventory, ing.itemId);
                        const ok = completed || have >= ing.count;
                        return (
                          <span
                            key={ing.itemId}
                            className={`rounded border px-2 py-0.5 ${
                              ok
                                ? 'border-emerald-800/70 bg-emerald-950/50 text-emerald-300'
                                : 'border-stone-700 bg-stone-950 text-rose-300'
                            }`}
                          >
                            {ITEM_DEFS[ing.itemId].name}: {completed ? ing.count : have}/{ing.count}
                          </span>
                        );
                      })}
                      {def.seaRationsRequired && (
                        <span
                          className={`rounded border px-2 py-0.5 ${
                            completed || rationsAvailable >= def.seaRationsRequired
                              ? 'border-emerald-800/70 bg-emerald-950/50 text-emerald-300'
                              : 'border-stone-700 bg-stone-950 text-rose-300'
                          }`}
                        >
                          Cooked/Dried Sea Rations: {completed ? def.seaRationsRequired : rationsAvailable}/
                          {def.seaRationsRequired}
                        </span>
                      )}
                    </div>
                  </div>

                  {!completed && (
                    <button
                      type="button"
                      disabled={!check.ok}
                      onClick={() => onBuildStage(stageId)}
                      className={`shrink-0 rounded-lg px-3.5 py-2 text-xs font-bold ${
                        check.ok
                          ? 'bg-cyan-500 text-stone-950 hover:bg-cyan-400'
                          : 'bg-stone-800 text-stone-500 cursor-not-allowed'
                      }`}
                    >
                      Construct Stage {def.stageNumber}
                    </button>
                  )}
                </div>

                {!completed && !check.ok && check.reason && (
                  <div className="mt-2 text-[11px] text-amber-300/90">{check.reason}</div>
                )}
              </div>
            );
          })}

          <div className="mb-2 rounded-lg border border-stone-800 bg-stone-900/60 p-3 text-xs text-stone-400">
            <div className="flex items-center gap-2 font-semibold text-stone-200">
              <Compass className="h-4 w-4 text-cyan-400" />
              Captain&apos;s Crossing Advice
            </div>
            <p className="mt-1">
              Pack extra <strong>Planks / Pine Resin</strong> (hull repairs in storms), <strong>Diesel
              Jerrycans</strong>, and crafted weapons (<strong>Bow, Arrows, Fire Bombs, Flare Gun</strong>)
              before casting off. {!state.boss.defeated && 'The island’s ruler, The Aura King, guards the reef exit.'}
            </p>
            {!state.boss.defeated && onChangeBossDifficulty && (
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-stone-800 pt-2">
                <span className="text-[11px] font-semibold text-purple-300">
                  Showdown Difficulty:
                </span>
                <div className="flex gap-1.5">
                  {(['easy', 'normal', 'hard'] as const).map((diff) => {
                    const active = (state.bossDifficulty ?? 'normal') === diff;
                    const cfg = BOSS_TUNING.DIFFICULTIES[diff];
                    return (
                      <button
                        key={diff}
                        type="button"
                        onClick={() => onChangeBossDifficulty(diff)}
                        className={`rounded px-2.5 py-1 text-[10.5px] font-bold transition ${
                          active
                            ? 'bg-purple-600 text-white shadow'
                            : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                        }`}
                        title={cfg.description}
                      >
                        {cfg.label.split(' / ')[1] ?? diff}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-stone-800 bg-stone-900/90 px-5 py-3">
          <div className="flex items-center gap-2 text-xs text-stone-400">
            <Waves className="h-4 w-4 text-cyan-400" />
            <span>Each build stage advances {BOAT.STAGE_BUILD_HOURS}h daylight</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCloseDock}
              className="rounded-lg border border-stone-700 px-3.5 py-2 text-xs font-semibold text-stone-300 hover:bg-stone-800"
            >
              Close Dockyard
            </button>
            <button
              type="button"
              disabled={!readyToSail}
              onClick={onLaunchVoyage}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold ${
                readyToSail
                  ? state.boss.defeated
                    ? 'bg-emerald-500 text-stone-950 hover:bg-emerald-400'
                    : 'bg-gradient-to-r from-purple-500 to-amber-500 text-stone-950 hover:from-purple-400 hover:to-amber-400'
                  : 'bg-stone-800 text-stone-500 cursor-not-allowed'
              }`}
            >
              <Ship className="h-4 w-4" />
              {state.boss.defeated
                ? 'Cast Off for Port Solis (12 nm)'
                : 'Cast Off & Confront The Aura King'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
