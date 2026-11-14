import React from 'react';
import { Flame, Compass, Skull, RotateCcw, Play, ShieldAlert, Sparkles } from 'lucide-react';
import {
  ExtendedGraphicsSettings,
  FpsLimitOption,
  GRAPHICS_PRESETS,
  GraphicsQuality,
  ViewDistancePreset,
} from '../scene/GraphicsConfig.ts';
import { SurvivalState } from '../survival/types.ts';

interface TitleScreenProps {
  hasSavedGame: boolean;
  savedDay: number;
  graphicsQuality: GraphicsQuality;
  extSettings?: ExtendedGraphicsSettings;
  onChangeGraphicsQuality: (q: GraphicsQuality) => void;
  onChangeExtendedSettings?: (partial: Partial<ExtendedGraphicsSettings>) => void;
  onContinue: () => void;
  onStartNew: (difficulty: 'survivor' | 'hardcore') => void;
}

const QUALITY_ORDER: GraphicsQuality[] = ['low', 'medium', 'high', 'ultra'];

export const SurvivalTitleScreen: React.FC<TitleScreenProps> = ({
  hasSavedGame,
  savedDay,
  graphicsQuality,
  extSettings,
  onChangeGraphicsQuality,
  onChangeExtendedSettings,
  onContinue,
  onStartNew,
}) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 p-6 font-sans text-stone-100">
      <div className="w-full max-w-xl rounded-2xl border border-stone-700/80 bg-stone-950/90 p-8 shadow-2xl">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400">
          <Compass className="h-4 w-4" /> Flight 404 — South Pacific Wreckage
        </div>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-stone-100">
          STRANDED
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-300">
          You woke on the tide line beside the smoking wing of Flight 404. No rescue ship is coming.
          Forage, knap stone tools, keep a fire burning against the night chill, uncover what
          happened on the island, and build a way back to civilization.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          {hasSavedGame && (
            <button
              type="button"
              onClick={onContinue}
              className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3.5 text-sm font-bold text-stone-950 transition hover:bg-amber-400"
            >
              <Play className="h-4 w-4 fill-current" />
              Continue Survival (Day {savedDay})
            </button>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onStartNew('survivor')}
              className="flex flex-col items-start rounded-xl border border-stone-700 bg-stone-900 p-4 text-left transition hover:border-amber-400"
            >
              <span className="flex items-center gap-1.5 text-sm font-bold text-stone-100">
                <Flame className="h-4 w-4 text-amber-400" />
                New Game — Survivor
              </span>
              <span className="mt-1 text-xs text-stone-400">
                Balanced hunger, thirst, and temperature drain. Ideal for a full atmospheric playthrough.
              </span>
            </button>

            <button
              type="button"
              onClick={() => onStartNew('hardcore')}
              className="flex flex-col items-start rounded-xl border border-stone-700 bg-stone-900 p-4 text-left transition hover:border-red-400"
            >
              <span className="flex items-center gap-1.5 text-sm font-bold text-red-300">
                <ShieldAlert className="h-4 w-4 text-red-400" />
                New Game — Hardcore
              </span>
              <span className="mt-1 text-xs text-stone-400">
                Harsher storms, faster calorie & hydration burn, and deadlier night hypothermia.
              </span>
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-stone-800 bg-stone-900/70 p-3.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-semibold text-stone-200">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              Graphics Quality
            </span>
            <div className="flex flex-wrap gap-1">
              {onChangeExtendedSettings && (
                <button
                  type="button"
                  onClick={() => onChangeExtendedSettings({ autoQuality: true })}
                  className={`rounded px-2 py-1 text-[11px] font-bold uppercase ${
                    extSettings?.autoQuality
                      ? 'bg-emerald-500 text-stone-950'
                      : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                  }`}
                >
                  Auto
                </button>
              )}
              {QUALITY_ORDER.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    onChangeExtendedSettings?.({ autoQuality: false });
                    onChangeGraphicsQuality(q);
                  }}
                  className={`rounded px-2.5 py-1 text-[11px] font-bold uppercase ${
                    !extSettings?.autoQuality && graphicsQuality === q
                      ? 'bg-amber-500 text-stone-950'
                      : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-stone-400">
            {GRAPHICS_PRESETS[graphicsQuality].description}
          </p>
        </div>

        <div className="mt-4 rounded-lg border border-stone-800 bg-stone-900/60 p-3.5 text-xs text-stone-400">
          <div className="font-semibold text-stone-200">Survival Controls</div>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            <span>• [WASD] Move / Swim</span>
            <span>• [Shift] Sprint • [Ctrl/C] Crouch</span>
            <span>• [E / Left Click] Gather / Drink</span>
            <span>• [Tab / I] Pack & Crafting</span>
            <span>• [1–6] Select Hotbar Slot</span>
            <span>• [F] Eat / Drink • [F3] Perf Overlay</span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface PauseModalProps {
  isOpen: boolean;
  state: SurvivalState;
  graphicsQuality: GraphicsQuality;
  extSettings?: ExtendedGraphicsSettings;
  onChangeGraphicsQuality: (q: GraphicsQuality) => void;
  onChangeExtendedSettings?: (partial: Partial<ExtendedGraphicsSettings>) => void;
  onResume: () => void;
  onRestart: () => void;
}

export const SurvivalPauseModal: React.FC<PauseModalProps> = ({
  isOpen,
  state,
  graphicsQuality,
  extSettings,
  onChangeGraphicsQuality,
  onChangeExtendedSettings,
  onResume,
  onRestart,
}) => {
  if (!isOpen) return null;

  const fpsOptions: Array<{ label: string; value: FpsLimitOption }> = [
    { label: '30 FPS', value: 30 },
    { label: '60 FPS', value: 60 },
    { label: 'Uncapped', value: 0 },
  ];

  const viewDistOptions: Array<{ label: string; value: ViewDistancePreset }> = [
    { label: 'Near', value: 'near' },
    { label: 'Medium', value: 'medium' },
    { label: 'Far', value: 'far' },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4 font-sans text-stone-100">
      <div className="w-full max-w-md rounded-xl border border-stone-700 bg-stone-950 p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-stone-100">Expedition Paused</h2>
        <p className="mt-1 text-xs text-stone-400">
          Day {state.clock.day} • Items Gathered: {state.stats.itemsGathered} • Items Crafted:{' '}
          {state.stats.itemsCrafted}
        </p>

        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-stone-800 bg-stone-900/80 p-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-semibold text-stone-200">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              Graphics Preset
            </span>
            <div className="flex flex-wrap gap-1">
              {onChangeExtendedSettings && (
                <button
                  type="button"
                  onClick={() => onChangeExtendedSettings({ autoQuality: true })}
                  className={`rounded px-2 py-1 text-[11px] font-bold uppercase ${
                    extSettings?.autoQuality
                      ? 'bg-emerald-500 text-stone-950'
                      : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                  }`}
                >
                  Auto
                </button>
              )}
              {QUALITY_ORDER.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    onChangeExtendedSettings?.({ autoQuality: false });
                    onChangeGraphicsQuality(q);
                  }}
                  className={`rounded px-2.5 py-1 text-[11px] font-bold uppercase ${
                    !extSettings?.autoQuality && graphicsQuality === q
                      ? 'bg-amber-500 text-stone-950'
                      : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[11px] leading-snug text-stone-400">
            {GRAPHICS_PRESETS[graphicsQuality].description}
          </p>

          {extSettings && onChangeExtendedSettings && (
            <>
              <div className="flex items-center justify-between border-t border-stone-800 pt-2">
                <span className="font-medium text-stone-300">Frame Rate Limit</span>
                <div className="flex gap-1">
                  {fpsOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onChangeExtendedSettings({ fpsLimit: opt.value })}
                      className={`rounded px-2 py-0.5 text-[10.5px] font-semibold ${
                        extSettings.fpsLimit === opt.value
                          ? 'bg-cyan-500 text-stone-950'
                          : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-stone-800 pt-2">
                <span className="font-medium text-stone-300">Battery Saver (30 FPS + Low Power)</span>
                <button
                  type="button"
                  onClick={() =>
                    onChangeExtendedSettings({ batterySaver: !extSettings.batterySaver })
                  }
                  className={`rounded px-2.5 py-0.5 text-[10.5px] font-bold uppercase ${
                    extSettings.batterySaver
                      ? 'bg-emerald-500 text-stone-950'
                      : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                  }`}
                >
                  {extSettings.batterySaver ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="flex items-center justify-between border-t border-stone-800 pt-2">
                <span className="font-medium text-stone-300">
                  Render Scale ({Math.round(extSettings.renderScale * 100)}%)
                </span>
                <input
                  type="range"
                  min={0.5}
                  max={1.0}
                  step={0.05}
                  value={extSettings.renderScale}
                  onChange={(e) =>
                    onChangeExtendedSettings({ renderScale: Number(e.target.value) })
                  }
                  className="w-28 accent-amber-400"
                />
              </div>

              <div className="flex items-center justify-between border-t border-stone-800 pt-2">
                <span className="font-medium text-stone-300">View Distance</span>
                <div className="flex gap-1">
                  {viewDistOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onChangeExtendedSettings({ viewDistance: opt.value })}
                      className={`rounded px-2 py-0.5 text-[10.5px] font-semibold ${
                        extSettings.viewDistance === opt.value
                          ? 'bg-amber-500 text-stone-950'
                          : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="rounded-lg bg-amber-500 py-2.5 text-sm font-bold text-stone-950 hover:bg-amber-400"
          >
            Resume Survival
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-stone-700 bg-stone-900 py-2.5 text-sm font-semibold text-stone-300 hover:border-red-500/60 hover:text-red-300"
          >
            <RotateCcw className="h-4 w-4" /> Start Fresh on Day 1
          </button>
        </div>
      </div>
    </div>
  );
};

interface DeathModalProps {
  isOpen: boolean;
  causeOfDeath: string;
  state: SurvivalState;
  onRespawn: () => void;
  onRestart: () => void;
}

export const SurvivalDeathModal: React.FC<DeathModalProps> = ({
  isOpen,
  causeOfDeath,
  state,
  onRespawn,
  onRestart,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-950/80 p-4 font-sans text-stone-100">
      <div className="w-full max-w-md rounded-xl border border-red-800/80 bg-stone-950 p-6 text-center shadow-2xl">
        <Skull className="mx-auto h-10 w-10 text-red-400" />
        <h2 className="mt-3 text-2xl font-extrabold tracking-wide text-stone-100">
          YOU DID NOT SURVIVE
        </h2>
        <p className="mt-2 text-sm text-red-200">
          Succumbed to <span className="font-semibold">{causeOfDeath}</span> on Day {state.clock.day}.
        </p>
        <p className="mt-2 text-xs text-stone-400">
          Respawning at your last camp keeps all crafted tools, campfires, and progress (only 25% of loose raw materials are lost).
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onRespawn}
            className="rounded-lg bg-amber-500 py-2.5 text-sm font-bold text-stone-950 hover:bg-amber-400"
          >
            Wake at Last Camp (Keep Progress)
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="rounded-lg border border-stone-800 bg-stone-900 py-2 text-xs font-semibold text-stone-400 hover:text-stone-200"
          >
            New Survival From Scratch
          </button>
        </div>
      </div>
    </div>
  );
};
