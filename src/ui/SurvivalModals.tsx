import React, { useEffect, useState } from 'react';
import {
  Flame,
  Compass,
  Skull,
  RotateCcw,
  Play,
  ShieldAlert,
  Sparkles,
  Trophy,
  SlidersHorizontal,
  Keyboard,
  Save,
  LogOut,
  ArrowLeft,
  Sun,
  Moon,
  CloudRain,
  CloudLightning,
} from 'lucide-react';
import {
  ControlKeybinds,
  DEFAULT_KEYBINDS,
  ExtendedGraphicsSettings,
  FpsLimitOption,
  GRAPHICS_PRESETS,
  GraphicsQuality,
  ViewDistancePreset,
} from '../scene/GraphicsConfig.ts';
import { BOSS_TUNING } from '../survival/config.ts';
import { computeAmbientTempC, formatClock } from '../survival/needs.ts';
import { computeMilestones } from '../survival/quests.ts';
import { BossDifficulty, SurvivalState } from '../survival/types.ts';
import { getZoneAt, ISLAND_ZONES } from '../survival/world.ts';

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
            <span>• [Shift] Sprint • [C] Crouch</span>
            <span>• [E / Left Click] Gather / Drink</span>
            <span>• [Tab] Craft • [I] Inventory</span>
            <span>• [1–6] Hotbar • [F] Inspect</span>
            <span>• [G] Consume • [H] Hide Hints</span>
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
  onChangeBossDifficulty?: (diff: BossDifficulty) => void;
  onResume: () => void;
  onSaveGame?: () => void;
  onQuitToTitle?: () => void;
  onRestart: () => void;
}

function formatKeyCodeLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
  if (code === 'ControlLeft' || code === 'ControlRight') return 'Ctrl';
  if (code === 'AltLeft' || code === 'AltRight') return 'Alt';
  return code;
}

const KEYBIND_GROUPS: Array<{
  title: string;
  rows: Array<{ action: keyof ControlKeybinds; label: string }>;
}> = [
  {
    title: 'Movement',
    rows: [
      { action: 'forward', label: 'Move Forward' },
      { action: 'back', label: 'Move Back' },
      { action: 'left', label: 'Strafe Left' },
      { action: 'right', label: 'Strafe Right' },
      { action: 'jump', label: 'Jump' },
      { action: 'sprint', label: 'Sprint' },
      { action: 'crouch', label: 'Crouch' },
      { action: 'prone', label: 'Prone' },
      { action: 'sit', label: 'Sit / Rest+' },
    ],
  },
  {
    title: 'Actions',
    rows: [
      { action: 'interact', label: 'Interact / Gather' },
      { action: 'consume', label: 'Consume Item' },
      { action: 'inspect', label: 'Inspect Item' },
      { action: 'build', label: 'Build Menu' },
    ],
  },
  {
    title: 'Combat',
    rows: [
      { action: 'block', label: 'Block / Parry (or RMB)' },
      { action: 'dodge', label: 'Dodge Roll' },
      { action: 'throwBomb', label: 'Throw Fire Bomb' },
    ],
  },
  {
    title: 'Menus',
    rows: [
      { action: 'inventory', label: 'Inventory' },
      { action: 'craft', label: 'Crafting' },
      { action: 'journal', label: 'Journal' },
      { action: 'map', label: 'Island Map' },
      { action: 'photoMode', label: 'Photo Mode' },
    ],
  },
];

export const SurvivalPauseModal: React.FC<PauseModalProps> = ({
  isOpen,
  state,
  graphicsQuality,
  extSettings,
  onChangeGraphicsQuality,
  onChangeExtendedSettings,
  onChangeBossDifficulty,
  onResume,
  onSaveGame,
  onQuitToTitle,
  onRestart,
}) => {
  const [pauseView, setPauseView] = useState<'main' | 'controls' | 'settings'>('main');
  const [savedNotice, setSavedNotice] = useState<boolean>(false);
  const [confirmQuit, setConfirmQuit] = useState<boolean>(false);
  const [rebindingAction, setRebindingAction] = useState<keyof ControlKeybinds | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setPauseView('main');
      setSavedNotice(false);
      setConfirmQuit(false);
      setRebindingAction(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!rebindingAction || !extSettings || !onChangeExtendedSettings) return;
    const onCapture = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code !== 'Escape') {
        const cur = { ...(extSettings.keybinds ?? DEFAULT_KEYBINDS) };
        const prevKey = cur[rebindingAction];
        for (const k of Object.keys(cur) as Array<keyof ControlKeybinds>) {
          if (k !== rebindingAction && cur[k] === e.code) {
            cur[k] = prevKey;
          }
        }
        cur[rebindingAction] = e.code;
        onChangeExtendedSettings({ keybinds: cur });
      }
      setRebindingAction(null);
    };
    window.addEventListener('keydown', onCapture, true);
    return () => window.removeEventListener('keydown', onCapture, true);
  }, [rebindingAction, extSettings, onChangeExtendedSettings]);

  if (!isOpen) return null;

  const clockInfo = formatClock(state.clock);
  const ambientC = computeAmbientTempC(state.clock, state.weather);
  const currentZone = ISLAND_ZONES[getZoneAt(state.player.x, state.player.z)];

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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4 font-sans text-stone-100 backdrop-blur-xs">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-stone-700/80 bg-stone-950/95 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-stone-100">
              {pauseView === 'main'
                ? 'Game Paused'
                : pauseView === 'controls'
                  ? 'Controls & Keybinds'
                  : 'Settings'}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-stone-300">
              <span className="inline-flex items-center gap-1 font-medium text-amber-300">
                {clockInfo.isNight ? <Moon className="h-3.5 w-3.5 text-sky-300" /> : <Sun className="h-3.5 w-3.5" />}
                Day {state.clock.day} · {clockInfo.timeText}
              </span>
              <span className="text-stone-600">•</span>
              <span className="inline-flex items-center gap-1 capitalize">
                {state.weather.kind === 'storm' ? (
                  <CloudLightning className="h-3 w-3 text-amber-300" />
                ) : state.weather.kind === 'rain' ? (
                  <CloudRain className="h-3 w-3 text-sky-300" />
                ) : (
                  <Compass className="h-3 w-3 text-emerald-400" />
                )}
                {state.weather.kind} ({ambientC.toFixed(0)}°C)
              </span>
              <span className="text-stone-600">•</span>
              <span className="text-emerald-300/90">{currentZone.name}</span>
            </div>
          </div>

          {pauseView !== 'main' && (
            <button
              type="button"
              onClick={() => {
                setRebindingAction(null);
                setPauseView('main');
              }}
              className="inline-flex items-center gap-1 rounded-md border border-stone-700 bg-stone-900 px-2.5 py-1 text-xs font-medium text-stone-200 hover:border-stone-500"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
          )}
        </div>

        {pauseView === 'main' && (
          <div className="mt-5 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onResume}
              className="flex items-center justify-center gap-2 rounded-lg bg-amber-500 py-2.5 text-sm font-bold text-stone-950 transition hover:bg-amber-400"
            >
              <Play className="h-4 w-4 fill-current" /> Resume
            </button>

            <button
              type="button"
              onClick={() => setPauseView('controls')}
              className="flex items-center justify-center gap-2 rounded-lg border border-stone-700 bg-stone-900 py-2.5 text-sm font-semibold text-stone-200 transition hover:border-amber-500/60 hover:text-amber-200"
            >
              <Keyboard className="h-4 w-4 text-amber-400" /> Controls
            </button>

            <button
              type="button"
              onClick={() => setPauseView('settings')}
              className="flex items-center justify-center gap-2 rounded-lg border border-stone-700 bg-stone-900 py-2.5 text-sm font-semibold text-stone-200 transition hover:border-amber-500/60 hover:text-amber-200"
            >
              <SlidersHorizontal className="h-4 w-4 text-sky-400" /> Settings
            </button>

            <button
              type="button"
              onClick={() => {
                onSaveGame?.();
                setSavedNotice(true);
                window.setTimeout(() => setSavedNotice(false), 2200);
              }}
              className="flex items-center justify-center gap-2 rounded-lg border border-stone-700 bg-stone-900 py-2.5 text-sm font-semibold text-stone-200 transition hover:border-emerald-500/60 hover:text-emerald-300"
            >
              <Save className="h-4 w-4 text-emerald-400" /> {savedNotice ? 'Saved ✓' : 'Save'}
            </button>

            {!confirmQuit ? (
              <button
                type="button"
                onClick={() => setConfirmQuit(true)}
                className="flex items-center justify-center gap-2 rounded-lg border border-stone-800 bg-stone-900/70 py-2.5 text-sm font-semibold text-stone-300 transition hover:border-red-500/60 hover:text-red-300"
              >
                <LogOut className="h-4 w-4" /> Quit
              </button>
            ) : (
              <div className="mt-1 flex flex-col gap-2 rounded-lg border border-red-900/60 bg-red-950/25 p-3">
                <span className="text-center text-xs text-stone-300">Save progress before leaving?</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onSaveGame?.();
                      if (onQuitToTitle) {
                        onQuitToTitle();
                      } else {
                        onRestart();
                      }
                    }}
                    className="rounded-md bg-stone-800 py-2 text-xs font-semibold text-stone-100 hover:bg-stone-700"
                  >
                    Save &amp; Quit to Title
                  </button>
                  <button
                    type="button"
                    onClick={onRestart}
                    className="flex items-center justify-center gap-1 rounded-md border border-red-700/70 bg-red-950/70 py-2 text-xs font-semibold text-red-200 hover:bg-red-900"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Restart Day 1
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {pauseView === 'controls' && extSettings && onChangeExtendedSettings && (
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs text-stone-400">
              <span>Click any action to rebind. Mouse LMB = Attack/Draw, RMB = Block.</span>
              <button
                type="button"
                onClick={() => onChangeExtendedSettings({ keybinds: { ...DEFAULT_KEYBINDS } })}
                className="shrink-0 rounded bg-stone-800 px-2 py-1 text-[10.5px] font-medium text-stone-200 hover:bg-stone-700"
              >
                Reset Defaults
              </button>
            </div>

            {KEYBIND_GROUPS.map((group) => (
              <div
                key={group.title}
                className="rounded-lg border border-stone-800 bg-stone-900/75 p-2.5"
              >
                <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-amber-300/90">
                  {group.title}
                </div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {group.rows.map((row) => {
                    const code =
                      (extSettings.keybinds ?? DEFAULT_KEYBINDS)[row.action] ??
                      DEFAULT_KEYBINDS[row.action];
                    const isListening = rebindingAction === row.action;
                    return (
                      <button
                        key={row.action}
                        type="button"
                        onClick={() => setRebindingAction(isListening ? null : row.action)}
                        className={`flex items-center justify-between rounded border px-2 py-1 text-[11px] transition ${
                          isListening
                            ? 'border-amber-400 bg-amber-950/50 text-amber-200'
                            : 'border-stone-800 bg-stone-950/70 text-stone-300 hover:border-stone-600'
                        }`}
                      >
                        <span className="truncate pr-2">{row.label}</span>
                        <span className="shrink-0 font-mono font-bold text-amber-300">
                          {isListening ? 'Press Key...' : formatKeyCodeLabel(code)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {pauseView === 'settings' && (
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
                  <span className="font-medium text-stone-300">Showdown Difficulty</span>
                  <div className="flex gap-1">
                    {(['easy', 'normal', 'hard'] as const).map((diff) => {
                      const active = (state.bossDifficulty ?? 'normal') === diff;
                      const label = BOSS_TUNING.DIFFICULTIES[diff].label.split(' / ')[1] ?? diff;
                      return (
                        <button
                          key={diff}
                          type="button"
                          onClick={() => onChangeBossDifficulty?.(diff)}
                          className={`rounded px-2 py-0.5 text-[10.5px] font-semibold ${
                            active
                              ? 'bg-purple-600 text-white'
                              : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
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

                <div className="flex items-center justify-between border-t border-stone-800 pt-2">
                  <span className="font-medium text-stone-300">
                    Camera FOV ({extSettings.fovDeg ?? 75}°)
                  </span>
                  <input
                    type="range"
                    min={60}
                    max={100}
                    step={2}
                    value={extSettings.fovDeg ?? 75}
                    onChange={(e) =>
                      onChangeExtendedSettings({ fovDeg: Number(e.target.value) })
                    }
                    className="w-28 accent-amber-400"
                  />
                </div>

                <div className="flex items-center justify-between border-t border-stone-800 pt-2">
                  <span className="font-medium text-stone-300">
                    Mouse Sensitivity ({(extSettings.mouseSensitivity ?? 1).toFixed(1)}x)
                  </span>
                  <input
                    type="range"
                    min={0.4}
                    max={2.2}
                    step={0.1}
                    value={extSettings.mouseSensitivity ?? 1}
                    onChange={(e) =>
                      onChangeExtendedSettings({ mouseSensitivity: Number(e.target.value) })
                    }
                    className="w-28 accent-amber-400"
                  />
                </div>

                <div className="grid grid-cols-3 gap-1.5 border-t border-stone-800 pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      onChangeExtendedSettings({ motionBlur: !(extSettings.motionBlur ?? true) })
                    }
                    className={`rounded px-2 py-1 text-[10px] font-semibold ${
                      extSettings.motionBlur ?? true
                        ? 'bg-emerald-600/80 text-white'
                        : 'bg-stone-800 text-stone-400'
                    }`}
                  >
                    Blur: {extSettings.motionBlur ?? true ? 'ON' : 'OFF'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeExtendedSettings({ headBob: !(extSettings.headBob ?? true) })
                    }
                    className={`rounded px-2 py-1 text-[10px] font-semibold ${
                      extSettings.headBob ?? true
                        ? 'bg-emerald-600/80 text-white'
                        : 'bg-stone-800 text-stone-400'
                    }`}
                  >
                    Head-Bob: {extSettings.headBob ?? true ? 'ON' : 'OFF'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeExtendedSettings({
                        closedCaptions: !(extSettings.closedCaptions ?? true),
                      })
                    }
                    className={`rounded px-2 py-1 text-[10px] font-semibold ${
                      extSettings.closedCaptions ?? true
                        ? 'bg-amber-500 text-stone-950'
                        : 'bg-stone-800 text-stone-400'
                    }`}
                  >
                    Captions: {extSettings.closedCaptions ?? true ? 'ON' : 'OFF'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface DeathModalProps {
  isOpen: boolean;
  causeOfDeath: string;
  state: SurvivalState;
  onRespawn: () => void;
  onRetryBossCheckpoint?: (fromPhaseOne: boolean) => void;
  onRestart: () => void;
}

export const SurvivalDeathModal: React.FC<DeathModalProps> = ({
  isOpen,
  causeOfDeath,
  state,
  onRespawn,
  onRetryBossCheckpoint,
  onRestart,
}) => {
  if (!isOpen) return null;
  const unlocked = computeMilestones(state).filter((m) => m.unlocked);
  const inBossEncounter =
    state.boss.combatPhase !== 'inactive' && state.boss.combatPhase !== 'ended';

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

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-stone-800 bg-stone-900/75 p-3 text-left text-xs">
          <div>
            <span className="text-[10px] uppercase text-stone-400">Days Survived</span>
            <div className="font-mono text-sm font-bold text-amber-300">{state.clock.day}</div>
          </div>
          <div>
            <span className="text-[10px] uppercase text-stone-400">Distance Walked</span>
            <div className="font-mono text-sm font-bold text-stone-100">
              {Math.round(state.stats.distanceTravelled)} m
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase text-stone-400">Items Gathered</span>
            <div className="font-mono text-sm font-bold text-emerald-300">
              {state.stats.itemsGathered}
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase text-stone-400">Items Crafted</span>
            <div className="font-mono text-sm font-bold text-sky-300">
              {state.stats.itemsCrafted}
            </div>
          </div>
        </div>

        {unlocked.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-900/50 bg-stone-900/50 p-2.5 text-left">
            <div className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">
              <Trophy className="h-3 w-3" /> Milestones Unlocked ({unlocked.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {unlocked.slice(0, 6).map((m) => (
                <span
                  key={m.id}
                  className="rounded border border-amber-600/30 bg-amber-950/40 px-1.5 py-0.5 text-[10px] font-medium text-amber-200"
                >
                  {m.title}
                </span>
              ))}
            </div>
          </div>
        )}

        <p className="mt-3 text-xs text-stone-400">
          Respawning at your last camp keeps all crafted tools, campfires, and progress (only 25% of loose raw materials are lost).
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          {inBossEncounter && onRetryBossCheckpoint && (
            <>
              <button
                type="button"
                onClick={() => onRetryBossCheckpoint(false)}
                className="rounded-lg bg-gradient-to-r from-purple-600 to-amber-500 py-2.5 text-sm font-bold text-white shadow-lg hover:from-purple-500 hover:to-amber-400"
              >
                Retry Phase {state.boss.checkpointPhase} Checkpoint (Full Needs)
              </button>
              {state.boss.checkpointPhase > 1 && (
                <button
                  type="button"
                  onClick={() => onRetryBossCheckpoint(true)}
                  className="rounded-lg border border-purple-700/70 bg-purple-950/60 py-2 text-xs font-semibold text-purple-200 hover:bg-purple-900/70"
                >
                  Restart Showdown From Phase 1
                </button>
              )}
            </>
          )}
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
