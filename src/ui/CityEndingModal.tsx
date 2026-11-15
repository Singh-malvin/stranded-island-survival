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
  Shield,
  Ship,
  Sun,
  Swords,
  Trophy,
} from 'lucide-react';
import { getBossDifficultyConfig } from '../survival/boss.ts';
import { BOSS_TUNING, VOYAGE } from '../survival/config.ts';
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
  const dethronedUnlocked = (state.achievements ?? []).includes(BOSS_TUNING.ACHIEVEMENT_NAME);
  const bossDiffLabel = getBossDifficultyConfig(state.bossDifficulty).label;

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
            Port Solis Reached — Dawn After the Storm
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-stone-300">
            With The Aura King shattered in the eye of the storm and the island&apos;s dark aura
            broken forever, sunlight pours across a calm horizon. Guided by the Lighthouse Shoal
            and Port Solis Coastguard cutters,{' '}
            {state.companion.found
              ? 'you and Daniel Vasquez sail home together as Flight 404’s two survivors at sunrise.'
              : 'you sail home across calm waters into Port Solis Harbor at sunrise.'}
          </p>
          {dethronedUnlocked && (
            <div className="mx-auto mt-3 inline-flex items-center gap-2 rounded-lg border border-purple-400/60 bg-gradient-to-r from-purple-950/85 via-amber-950/65 to-purple-950/85 px-3.5 py-1.5 text-xs font-bold text-amber-200 shadow-lg">
              <Trophy className="h-4 w-4 text-amber-400" />
              Achievement Unlocked: &ldquo;{BOSS_TUNING.ACHIEVEMENT_NAME}&rdquo;
            </div>
          )}
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
                Voyage &amp; Respawns
              </div>
              <div className="mt-1 text-xl font-bold text-stone-100">
                {state.voyage.visitedStops.length} / 4 Stops
              </div>
              <div className="text-[10px] text-stone-500">Deaths: {state.stats.deaths}</div>
            </div>

            <div className="rounded-xl border border-purple-800/60 bg-purple-950/35 p-3 sm:col-span-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-200">
                  <Swords className="h-4 w-4 text-amber-400" />
                  Final Showdown — The Aura King
                </div>
                <span className="inline-flex items-center gap-1 rounded bg-purple-900/60 px-2 py-0.5 text-[10px] font-semibold text-purple-200">
                  <Shield className="h-3 w-3 text-amber-300" /> {bossDiffLabel}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-300">
                <span>
                  Boss Fight Time:{' '}
                  <strong className="text-amber-300">
                    {formatDuration(state.stats.bossFightTimeSec ?? state.boss.fightElapsedSec ?? 0)}
                  </strong>
                </span>
                <span>
                  Outcome:{' '}
                  <strong className="text-emerald-300">
                    {state.boss.defeated ? 'Aura Crown Shattered' : 'Bypassed'}
                  </strong>
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-purple-200/90">
                <span>
                  Companion:{' '}
                  <strong>
                    {state.companion.found
                      ? `Daniel Rescued (Trust ${Math.round(state.companion.trust)})`
                      : 'Solo Survivor Run'}
                  </strong>
                </span>
                <span>• Shrines Awakened: {state.powers.unlocked.length}/4</span>
                <span>• Prison Escapes: {state.prison.escapedPathsUsed.length}</span>
              </div>
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
              Atmospheric 3D Survival Engine · Three.js PBR + Blender Worlds + Adaptive WebAudio + Aura King Finale
            </p>
            <p className="mt-1 text-[11px] text-stone-500">
              Flight 404 Castaway Saga: Beach survival, basalt caves &amp; ancient shrine lore, research station repairs,
              dockyard shipbuilding, and defeating The Aura King in the eye of the storm.
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
