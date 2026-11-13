import React from 'react';
import {
  Anchor,
  Award,
  BookOpen,
  Compass,
  Footprints,
  Hammer,
  Package,
  RotateCcw,
  Ship,
  Sun,
} from 'lucide-react';
import { VOYAGE } from '../survival/config.ts';
import { STORY_CLUES } from '../survival/quests.ts';
import { SurvivalState } from '../survival/types.ts';

interface CityEndingModalProps {
  state: SurvivalState;
  onReturnToIslandDock: () => void;
  onStartNewExpedition: () => void;
}

function formatDuration(totalSec: number): string {
  const mins = Math.floor(totalSec / 60);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs > 0) {
    return `${hrs}h ${remMins}m`;
  }
  return `${mins}m ${Math.floor(totalSec % 60)}s`;
}

export const CityEndingModal: React.FC<CityEndingModalProps> = ({
  state,
  onReturnToIslandDock,
  onStartNewExpedition,
}) => {
  if (state.voyage.phase !== 'arrived') return null;

  const daysSurvived = state.escapedAtDay ?? state.clock.day;
  const totalDistMeters = Math.round(state.stats.distanceTravelled);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-amber-500/70 bg-stone-950 text-stone-100 shadow-2xl">
        {/* Banner Header */}
        <div className="border-b border-stone-800 bg-gradient-to-r from-amber-950/70 via-stone-900 to-sky-950/70 px-6 py-5 text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-amber-500/60 bg-amber-950/60 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-amber-300">
            <Award className="h-3.5 w-3.5" />
            Act 5 Complete — Escape Ending
          </div>
          <h1 className="mt-3 text-2xl font-extrabold tracking-wide text-stone-50">
            Port Solis Reached — You Made It Home
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-stone-300">
            Guided by the Lighthouse Shoal beacon and the Research Station&apos;s calibrated sea chart,
            your handmade vessel clears the breakwater at dawn. Coastguard cutters escort Flight
            404&apos;s lone survivor into the bustling harbor lights of Port Solis.
          </p>
        </div>

        {/* Expedition Summary Stats */}
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-stone-800 bg-stone-900/80 p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-amber-400">
                <Sun className="h-3.5 w-3.5" />
                Days Survived
              </div>
              <div className="mt-1 text-xl font-bold text-stone-100">Day {daysSurvived}</div>
              <div className="text-[10px] text-stone-500">{formatDuration(state.stats.playTimeSec)} elapsed</div>
            </div>

            <div className="rounded-xl border border-stone-800 bg-stone-900/80 p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-cyan-400">
                <Footprints className="h-3.5 w-3.5" />
                Distance Travelled
              </div>
              <div className="mt-1 text-xl font-bold text-stone-100">{totalDistMeters}m</div>
              <div className="text-[10px] text-stone-500">
                +{VOYAGE.TOTAL_DISTANCE_NM.toFixed(1)} nm sea crossing
              </div>
            </div>

            <div className="rounded-xl border border-stone-800 bg-stone-900/80 p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                <Hammer className="h-3.5 w-3.5" />
                Items Crafted
              </div>
              <div className="mt-1 text-xl font-bold text-stone-100">{state.stats.itemsCrafted}</div>
              <div className="text-[10px] text-stone-500">{state.structures.length} base structures</div>
            </div>

            <div className="rounded-xl border border-stone-800 bg-stone-900/80 p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-orange-400">
                <Package className="h-3.5 w-3.5" />
                Items Gathered
              </div>
              <div className="mt-1 text-xl font-bold text-stone-100">{state.stats.itemsGathered}</div>
              <div className="text-[10px] text-stone-500">{state.unlockedGates.length} island gates opened</div>
            </div>

            <div className="rounded-xl border border-stone-800 bg-stone-900/80 p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-sky-400">
                <BookOpen className="h-3.5 w-3.5" />
                Flight 404 Clues
              </div>
              <div className="mt-1 text-xl font-bold text-stone-100">
                {state.cluesFound.length} / {STORY_CLUES.length}
              </div>
              <div className="text-[10px] text-stone-500">Research log archive</div>
            </div>

            <div className="rounded-xl border border-stone-800 bg-stone-900/80 p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-rose-400">
                <Ship className="h-3.5 w-3.5" />
                Voyage Landfalls
              </div>
              <div className="mt-1 text-xl font-bold text-stone-100">
                {state.voyage.visitedStops.length} / 4 Stops
              </div>
              <div className="text-[10px] text-stone-500">Respawns: {state.stats.deaths}</div>
            </div>
          </div>

          {/* Credits Box */}
          <div className="rounded-xl border border-stone-800 bg-stone-900/50 p-4 text-center text-xs text-stone-400">
            <div className="mb-1.5 flex items-center justify-center gap-1.5 font-bold uppercase tracking-widest text-amber-300">
              <Compass className="h-3.5 w-3.5" />
              Expedition Credits
            </div>
            <p className="text-stone-300 font-semibold">Stranded — Island Survival</p>
            <p className="mt-1">
              Atmospheric 3D Survival Engine (Three.js + WebAudio Procedural Foley + 5-Act Progression)
            </p>
            <p className="mt-1 text-[11px] text-stone-500">
              Converted from the Resort 3D sandbox into a full 5-act castaway survival expedition:
              beach survival, interior exploration, station repairs, dockyard shipbuilding, and sea rescue.
            </p>
          </div>
        </div>

        {/* Ending Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-800 bg-stone-900/90 px-6 py-4">
          <button
            type="button"
            onClick={onReturnToIslandDock}
            className="flex items-center gap-1.5 rounded-lg border border-stone-700 bg-stone-900 px-4 py-2 text-xs font-semibold text-stone-200 hover:bg-stone-800"
          >
            <Anchor className="h-3.5 w-3.5 text-cyan-400" />
            Return to Island Dock (Free Roam)
          </button>
          <button
            type="button"
            onClick={onStartNewExpedition}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-stone-950 hover:bg-amber-400"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Start New Expedition
          </button>
        </div>
      </div>
    </div>
  );
};
