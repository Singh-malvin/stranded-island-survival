import React, { useEffect, useMemo, useRef } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Compass,
  FileText,
  Lock,
  Map as MapIcon,
  Save,
  X,
} from 'lucide-react';
import { SAVE, WORLD } from '../survival/config.ts';
import {
  evaluateObjectivesForAct,
  getActLabel,
  STATION_REPAIR_DEFS,
  STORY_CLUES,
} from '../survival/quests.ts';
import type { StationRepairId, SurvivalState } from '../survival/types.ts';
import {
  cellKeyForPos,
  ESTIMATED_ISLAND_MAP_CELLS,
  getZoneAt,
  ISLAND_GATES,
  ISLAND_ZONES,
  sampleIslandHeight,
} from '../survival/world.ts';

export type JournalTab = 'objectives' | 'clues' | 'map';

interface JournalMapModalProps {
  isOpen: boolean;
  initialTab: JournalTab;
  state: SurvivalState;
  onChangeTab: (tab: JournalTab) => void;
  onClose: () => void;
}

export const JournalMapModal: React.FC<JournalMapModalProps> = ({
  isOpen,
  initialTab,
  state,
  onChangeTab,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const objectives = useMemo(() => evaluateObjectivesForAct(state), [state]);
  const actLabel = useMemo(() => getActLabel(state.act), [state.act]);
  const completedCount = objectives.filter((o) => o.completed).length;
  const currentZone = ISLAND_ZONES[getZoneAt(state.player.x, state.player.z)];

  // Calculate approximate land cell count across the expanded 260m island
  const discoveredSet = useMemo(() => new Set(state.discoveredCells), [state.discoveredCells]);
  const exploredPct = Math.min(
    100,
    Math.round((discoveredSet.size / ESTIMATED_ISLAND_MAP_CELLS) * 100)
  );

  useEffect(() => {
    if (!isOpen || initialTab !== 'map') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width; // 320
    const worldSpan = WORLD.ISLAND_RADIUS * 1.48; // ~385m span across spread-out island
    const worldHalf = worldSpan / 2;
    const centerZ = 10;
    const toPx = (wx: number, wz: number) => ({
      px: ((wx + worldHalf) / worldSpan) * size,
      pz: ((wz - centerZ + worldHalf) / worldSpan) * size,
    });

    ctx.fillStyle = '#0c1f2b';
    ctx.fillRect(0, 0, size, size);

    // Draw parchment terrain pixels per 2x2 block
    const step = 2;
    for (let py = 0; py < size; py += step) {
      for (let px = 0; px < size; px += step) {
        const wx = (px / size) * worldSpan - worldHalf;
        const wz = (py / size) * worldSpan - worldHalf + centerZ;
        const cellKey = cellKeyForPos(wx, wz, SAVE.MAP_CELL_SIZE);
        const h = sampleIslandHeight(wx, wz);

        if (!discoveredSet.has(cellKey)) {
          // Fog of war cloud/slate pattern
          ctx.fillStyle =
            ((Math.floor(wx / 15) + Math.floor(wz / 15)) & 1) === 0 ? '#111827' : '#0f172a';
          ctx.fillRect(px, py, step, step);
          continue;
        }

        const zone = getZoneAt(wx, wz);
        let color = ISLAND_ZONES[zone].mapColor;
        if (zone === 'ocean' && h > -0.6) {
          color = '#25708a'; // shallow reef highlight
        }
        ctx.fillStyle = color;
        ctx.fillRect(px, py, step, step);
      }
    }

    // Draw subtle grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    const stepPx = (SAVE.MAP_CELL_SIZE * 2 / worldSpan) * size;
    for (let g = stepPx; g < size; g += stepPx) {
      ctx.beginPath();
      ctx.moveTo(g, 0);
      ctx.lineTo(g, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, g);
      ctx.lineTo(size, g);
      ctx.stroke();
    }

    // Draw Locked Gates if discovered
    for (const gate of ISLAND_GATES) {
      const cellKey = cellKeyForPos(gate.x, gate.z, SAVE.MAP_CELL_SIZE);
      if (!discoveredSet.has(cellKey)) continue;
      const p = toPx(gate.x, gate.z);
      const locked = !state.unlockedGates.includes(gate.id);
      ctx.strokeStyle = locked ? '#ef4444' : '#22c55e';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(p.px - 7, p.pz);
      ctx.lineTo(p.px + 7, p.pz);
      ctx.stroke();
    }

    // Crash site icon
    if (discoveredSet.has(cellKeyForPos(WORLD.WRECK_POS.x, WORLD.WRECK_POS.z, SAVE.MAP_CELL_SIZE))) {
      const p = toPx(WORLD.WRECK_POS.x, WORLD.WRECK_POS.z);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(p.px - 4, p.pz - 4, 8, 8);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(p.px - 2, p.pz - 2, 4, 4);
    }

    // Freshwater Spring icon
    if (discoveredSet.has(cellKeyForPos(WORLD.SPRING_POS.x, WORLD.SPRING_POS.z, SAVE.MAP_CELL_SIZE))) {
      const p = toPx(WORLD.SPRING_POS.x, WORLD.SPRING_POS.z);
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(p.px, p.pz, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#083344';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Interior Landmarks (Camp, Caves, Ruins, Research Station, Boat Slipway Dock)
    const interiorPins: Array<{ x: number; z: number; color: string }> = [
      { x: WORLD.ABANDONED_CAMP_POS.x, z: WORLD.ABANDONED_CAMP_POS.z, color: '#eab308' },
      { x: WORLD.CAVE_GROTTO_POS.x, z: WORLD.CAVE_GROTTO_POS.z, color: '#38bdf8' },
      { x: WORLD.ANCIENT_RUINS_POS.x, z: WORLD.ANCIENT_RUINS_POS.z, color: '#d97706' },
      { x: WORLD.RESEARCH_STATION_POS.x, z: WORLD.RESEARCH_STATION_POS.z, color: '#f43f5e' },
      { x: WORLD.BOAT_DOCK_POS.x, z: WORLD.BOAT_DOCK_POS.z, color: '#06b6d4' },
    ];
    for (const pin of interiorPins) {
      if (!discoveredSet.has(cellKeyForPos(pin.x, pin.z, SAVE.MAP_CELL_SIZE))) continue;
      const p = toPx(pin.x, pin.z);
      ctx.fillStyle = pin.color;
      ctx.fillRect(p.px - 3.5, p.pz - 3.5, 7, 7);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(p.px - 3.5, p.pz - 3.5, 7, 7);
    }

    // Placed Campfires
    for (const fire of state.campfires) {
      const p = toPx(fire.x, fire.z);
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(p.px, p.pz, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Placed Shelters (Bed Spawn)
    for (const s of state.shelters) {
      const p = toPx(s.x, s.z);
      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.moveTo(p.px, p.pz - 6);
      ctx.lineTo(p.px - 5, p.pz + 4);
      ctx.lineTo(p.px + 5, p.pz + 4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#064e3b';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Placed Stage 4 Base Structures
    for (const st of state.structures ?? []) {
      const p = toPx(st.x, st.z);
      ctx.fillStyle =
        st.type === 'water_collector'
          ? '#38bdf8'
          : st.type === 'farm_plot'
            ? '#84cc16'
            : '#f59e0b';
      ctx.fillRect(p.px - 2.5, p.pz - 2.5, 5, 5);
    }

    // Player heading arrow
    const pl = toPx(state.player.x, state.player.z);
    ctx.save();
    ctx.translate(pl.px, pl.pz);
    ctx.rotate(-state.player.yaw);
    ctx.fillStyle = '#fef08a';
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }, [isOpen, initialTab, state, discoveredSet]);

  if (!isOpen) return null;

  const savedLabel = state.lastSavedAt
    ? `${state.lastSaveKind === 'bed' ? 'Bed Save' : 'Autosave'} at ${new Date(
        state.lastSavedAt
      ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
    : 'Not yet saved this session';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-stone-700 bg-stone-950 text-stone-100 shadow-2xl">
        {/* Header & Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-800 bg-stone-900/90 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-amber-400" />
            <div>
              <h2 className="text-base font-bold tracking-wide text-stone-100">
                Survivor Log &amp; Island Chart
              </h2>
              <p className="text-xs text-stone-400">
                Act {state.act} — {actLabel} • Day {state.clock.day}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onChangeTab('objectives')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                initialTab === 'objectives'
                  ? 'bg-amber-600 text-stone-950'
                  : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Objectives ({completedCount}/{objectives.length})
            </button>
            <button
              type="button"
              onClick={() => onChangeTab('clues')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                initialTab === 'clues'
                  ? 'bg-amber-600 text-stone-950'
                  : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Story Clues ({state.cluesFound.length}/{STORY_CLUES.length})
            </button>
            <button
              type="button"
              onClick={() => onChangeTab('map')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                initialTab === 'map'
                  ? 'bg-amber-600 text-stone-950'
                  : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
              }`}
            >
              <MapIcon className="h-3.5 w-3.5" />
              Island Map ({exploredPct}%)
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Journal"
              className="ml-2 rounded-lg border border-stone-700 p-1.5 text-stone-400 hover:text-stone-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {initialTab === 'objectives' && (
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-xs text-amber-200/90">
                <strong className="text-amber-300">Act {state.act} Goal ({actLabel}):</strong>{' '}
                {state.act === 1
                  ? 'Establish shelter, purify water, craft basic tools, and investigate the blocked passes along the southern shoreline.'
                  : state.act === 2
                    ? 'Build an Improved Base (Workbench, Farm, Water Collector, Forge), clear inland passes with a Machete/Hatchet, and gear up with Climbing Rope & River Raft.'
                    : state.act === 3
                      ? 'Explore Obsidian Caves and Ancient Stone Ruins for Copper Wire, Circuit Boards, Fuel, and the Keycard, then repair the Research Station.'
                      : state.act === 4
                        ? 'Haul timber, metal ingots, copper wire, circuit board, diesel fuel, and sea rations to the Southern Boat Slipway & Dock to construct your 4-stage escape craft.'
                        : 'Cross the final offshore squalls from Lighthouse Shoal into Port Solis Harbor and bring Flight 404 survivor logs home.'}
              </div>

              {objectives.map((step) => (
                <div
                  key={step.id}
                  className={`flex items-start gap-3 rounded-lg border p-3.5 ${
                    step.completed
                      ? 'border-emerald-800/60 bg-emerald-950/25'
                      : 'border-stone-800 bg-stone-900/60'
                  }`}
                >
                  {step.completed ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                  ) : (
                    <Circle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm font-semibold ${
                          step.completed ? 'text-emerald-200 line-through' : 'text-stone-100'
                        }`}
                      >
                        {step.title}
                      </span>
                      {step.progressText && (
                        <span className="rounded bg-stone-800 px-2 py-0.5 text-[11px] font-medium text-stone-300">
                          {step.progressText}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-stone-400">{step.detail}</p>
                  </div>
                </div>
              ))}

              {/* Wood -> Forge -> Driftwood Field Craft Tip */}
              <div className="rounded-lg border border-orange-900/50 bg-orange-950/20 px-4 py-3 text-xs text-orange-100/90">
                <strong className="text-orange-300">Kiln Craft Guide (Wood → Forge → Driftwood):</strong>{' '}
                Chop Palm or Pine trees with an Axe or collect Fallen Branches off the ground for Wood. Build a{' '}
                <strong className="text-stone-100">Stone Charcoal Forge [B]</strong>, press{' '}
                <strong className="text-stone-100">[E]</strong> to insert Wood into the kiln slot, let it burn for{' '}
                a few seconds, and collect <strong className="text-amber-300">Driftwood</strong> for torches, planks, spears &amp; coal.
              </div>

              {/* Island Gates Overview */}
              <div className="mt-2 rounded-lg border border-stone-800 bg-stone-900/40 p-3.5">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-400">
                  <Lock className="h-3.5 w-3.5 text-rose-400" />
                  Island Progression Gates ({state.unlockedGates.length}/{ISLAND_GATES.length} Open)
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {ISLAND_GATES.map((gate) => {
                    const unlocked = state.unlockedGates.includes(gate.id);
                    return (
                      <div
                        key={gate.id}
                        className="rounded border border-stone-800/80 bg-stone-950/70 p-2.5 text-xs"
                      >
                        <div className="font-semibold text-stone-200">{gate.name}</div>
                        <div className={`mt-0.5 text-[11px] ${unlocked ? 'text-emerald-400' : 'text-rose-300'}`}>
                          {unlocked ? 'Open Passage' : `Locked • ${gate.requiredToolLabel}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {state.act >= 3 && (
                <div className="rounded-lg border border-sky-900/50 bg-sky-950/20 p-3.5">
                  <div className="mb-2 text-xs font-bold uppercase tracking-wider text-sky-300">
                    Caldera Research Station Repairs
                  </div>
                  <div className="grid gap-2 md:grid-cols-3">
                    {(['radio', 'generator', 'chart'] as StationRepairId[]).map((partId) => {
                      const def = STATION_REPAIR_DEFS[partId];
                      const repaired = Boolean(state.stationRepairs?.[partId]);
                      return (
                        <div
                          key={partId}
                          className="rounded border border-stone-800 bg-stone-950/80 p-2.5 text-xs"
                        >
                          <div className="font-semibold text-stone-200">{def.name}</div>
                          <div
                            className={`mt-0.5 text-[11px] font-medium ${
                              repaired ? 'text-emerald-400' : 'text-amber-300'
                            }`}
                          >
                            {repaired
                              ? 'Online'
                              : def.ingredients.length > 0
                                ? `Needs ${def.ingredients
                                    .map((i) => `${i.count}x ${i.itemId.replace(/_/g, ' ')}`)
                                    .join(', ')}`
                                : 'Requires Radio & Generator Online'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {initialTab === 'clues' && (
            <div className="flex flex-col gap-3">
              {STORY_CLUES.map((clue) => {
                const found = state.cluesFound.includes(clue.id);
                return (
                  <div
                    key={clue.id}
                    className={`rounded-lg border p-4 ${
                      found
                        ? 'border-amber-800/60 bg-stone-900/80'
                        : 'border-stone-800/70 bg-stone-900/30 opacity-75'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold text-stone-100">
                          {found ? clue.title : 'Undiscovered Story Clue'}
                        </div>
                        <div className="text-xs text-amber-400/85">
                          {found ? clue.subtitle : `Search around ${clue.subtitle.split('—')[0].trim()}`}
                        </div>
                      </div>
                      <span
                        className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                          found
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-stone-800 text-stone-400'
                        }`}
                      >
                        {found ? 'Recorded' : 'Missing'}
                      </span>
                    </div>
                    <p className="mt-2.5 text-xs leading-relaxed text-stone-300">
                      {found
                        ? clue.logText
                        : 'Explore this landmark carefully and inspect any gleaming notes or wreckage.'}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {initialTab === 'map' && (
            <div className="grid gap-5 md:grid-cols-[320px_1fr]">
              <div className="flex flex-col items-center">
                <canvas
                  ref={canvasRef}
                  width={320}
                  height={320}
                  className="rounded-xl border-2 border-stone-700 shadow-inner"
                />
                <div className="mt-2 flex items-center gap-2 text-[11px] text-stone-400">
                  <Compass className="h-3.5 w-3.5 text-amber-400" />
                  <span>Top is North • Fog clears as you walk the island</span>
                </div>
              </div>

              <div className="flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="rounded-lg border border-stone-800 bg-stone-900/80 p-3.5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                      Current Position
                    </div>
                    <div className="mt-0.5 text-sm font-bold text-stone-100">{currentZone.name}</div>
                    <p className="mt-1 text-xs text-stone-400">{currentZone.description}</p>
                    <div className="mt-2 text-[11px] font-mono text-stone-500">
                      Coords: ({Math.round(state.player.x)}m E, {Math.round(-state.player.z)}m N) • Explored ~
                      {exploredPct}%
                    </div>
                  </div>

                  <div className="rounded-lg border border-stone-800 bg-stone-900/60 p-3.5 text-xs">
                    <div className="mb-2 font-bold text-stone-200">Map Key</div>
                    <div className="grid grid-cols-2 gap-2 text-stone-300">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-sm bg-yellow-200 border border-stone-800" />
                        You &amp; Heading
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-cyan-400" />
                        Freshwater Spring
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-orange-500" />
                        Lit Campfire
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-sm bg-emerald-400" />
                        Shelter (Bed Spawn)
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-sm bg-slate-200 border border-red-500" />
                        Flight 404 Wreck
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-1 w-3.5 bg-red-500" />
                        Locked Barrier Gate
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-sm bg-yellow-500" />
                        Abandoned Camp
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-sm bg-sky-400" />
                        Obsidian Caves / Ruins
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-sm bg-rose-500" />
                        Research Station
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-sm bg-cyan-500" />
                        Boat Slipway Dock
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-stone-800 bg-stone-900/50 p-3 text-xs text-stone-400">
                  Distance Travelled: <strong className="text-stone-200">{Math.round(state.stats.distanceTravelled)}m</strong>{' '}
                  • Items Gathered: <strong className="text-stone-200">{state.stats.itemsGathered}</strong>{' '}
                  • Crafted: <strong className="text-stone-200">{state.stats.itemsCrafted}</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-stone-800 bg-stone-900/80 px-5 py-2.5 text-xs text-stone-400">
          <div className="flex items-center gap-2">
            <Save className="h-3.5 w-3.5 text-emerald-400" />
            <span>{savedLabel}</span>
          </div>
          <span>Press [J] Objectives • [M] Map • [Esc] Close</span>
        </div>
      </div>
    </div>
  );
};
