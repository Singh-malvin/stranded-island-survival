// Pure Stage 6 Boat Building (Act 4) & Sea Voyage / City Arrival simulation (Act 5).
// No Three.js or React imports.

import { BOAT, COMPANION_TUNING, DIFFICULTY, TEMPERATURE, TIME, VOYAGE, WORLD } from './config.ts';
import { startFinalSeaChase } from './boss.ts';
import { addItem, countItem, ITEM_DEFS, removeItem } from './items.ts';
import type {
  BoatBuildState,
  BoatStageId,
  InventorySlot,
  ItemId,
  RecipeIngredient,
  SurvivalState,
  VoyageState,
  VoyageStopId,
  VoyageThrottle,
  WeatherState,
} from './types.ts';

export interface BoatStageDef {
  id: BoatStageId;
  stageNumber: 1 | 2 | 3 | 4;
  name: string;
  ingredients: RecipeIngredient[];
  seaRationsRequired?: number;
  description: string;
}

export const BOAT_STAGE_ORDER: BoatStageId[] = [
  'keel_hull',
  'mast_sail',
  'outboard_engine',
  'nav_provisions',
];

export const BOAT_STAGE_DEFS: Record<BoatStageId, BoatStageDef> = {
  keel_hull: {
    id: 'keel_hull',
    stageNumber: 1,
    name: 'Cedar Keel & Pitch-Sealed Hull',
    ingredients: [
      { itemId: 'log', count: 8 },
      { itemId: 'plank', count: 8 },
      { itemId: 'rope', count: 6 },
      { itemId: 'resin', count: 4 },
    ],
    description:
      'Lay the hardwood keel, frame the ocean-going plank ribs, and waterproof seams with pitch resin.',
  },
  mast_sail: {
    id: 'mast_sail',
    stageNumber: 2,
    name: 'Canvas Mainsail & Rigging',
    ingredients: [
      { itemId: 'stick', count: 8 },
      { itemId: 'cloth_scrap', count: 6 },
      { itemId: 'rope', count: 6 },
      { itemId: 'metal_ingot', count: 2 },
    ],
    description:
      'Step a stout spar mast, stitch weathered canvas cloth into a storm sail, and tension steel stays.',
  },
  outboard_engine: {
    id: 'outboard_engine',
    stageNumber: 3,
    name: 'Salvaged Outboard Engine & Helm',
    ingredients: [
      { itemId: 'metal_ingot', count: 4 },
      { itemId: 'scrap_metal', count: 4 },
      { itemId: 'copper_wire', count: 2 },
      { itemId: 'circuit_board', count: 1 },
    ],
    description:
      'Mount an alloy stern drive, wire ignition coils with cave copper, and wire the avionics compass helm.',
  },
  nav_provisions: {
    id: 'nav_provisions',
    stageNumber: 4,
    name: 'Offshore Fuel, Clean Water & Rations',
    ingredients: [
      { itemId: 'fuel_can', count: 1 },
      { itemId: 'water_bottle_clean', count: 2 },
    ],
    seaRationsRequired: BOAT.SEA_RATION_COUNT,
    description:
      'Top off diesel tanks, stow clean drinking flasks, and pack 3x cooked/dried sea rations for the crossing.',
  },
};

export interface VoyageStopDef {
  id: VoyageStopId;
  legNumber: 1 | 2 | 3 | 4;
  distanceNm: number;
  name: string;
  subtitle: string;
  description: string;
  scavengeLoot: Array<{ itemId: ItemId; count: number }>;
}

export const VOYAGE_STOPS: Record<VoyageStopId, VoyageStopDef> = {
  shoal_cay: {
    id: 'shoal_cay',
    legNumber: 1,
    distanceNm: 3.2,
    name: 'Shoal Cay Islet',
    subtitle: 'Outer reef sandbar & palm windbreak',
    description:
      'Fresh palms and washed-up timber dot this sheltered sandbar before the open trench squalls begin.',
    scavengeLoot: [
      { itemId: 'coconut', count: 2 },
      { itemId: 'plank', count: 2 },
      { itemId: 'fuel_can', count: 1 },
    ],
  },
  castaway_atoll: {
    id: 'castaway_atoll',
    legNumber: 2,
    distanceNm: 6.5,
    name: 'Castaway Atoll',
    subtitle: 'Abandoned fishing shack & rain cistern',
    description:
      'A half-collapsed stilt hut holds dried fish racks, sealing pitch, and a rainwater drum mid-ocean.',
    scavengeLoot: [
      { itemId: 'water_bottle_clean', count: 1 },
      { itemId: 'dried_fish', count: 2 },
      { itemId: 'resin', count: 2 },
      { itemId: 'scrap_metal', count: 2 },
    ],
  },
  lighthouse_shoal: {
    id: 'lighthouse_shoal',
    legNumber: 3,
    distanceNm: 9.6,
    name: 'Lighthouse Shoal',
    subtitle: 'Storm-swept beacon outside Port Solis channel',
    description:
      'Through blowing spray, the mainland beacon sweeps the horizon. Patch the hull and top off diesel for the final run.',
    scavengeLoot: [
      { itemId: 'fuel_can', count: 1 },
      { itemId: 'ration_bar', count: 2 },
      { itemId: 'medicinal_poultice', count: 1 },
      { itemId: 'plank', count: 2 },
    ],
  },
  port_solis: {
    id: 'port_solis',
    legNumber: 4,
    distanceNm: VOYAGE.TOTAL_DISTANCE_NM,
    name: 'Port Solis Harbor',
    subtitle: 'Mainland coastguard quay & city skyline',
    description: 'Searchlights, harbor buoys, and the warm city skyline welcome your escape vessel home.',
    scavengeLoot: [],
  },
};

const STOP_ORDER: VoyageStopId[] = [
  'shoal_cay',
  'castaway_atoll',
  'lighthouse_shoal',
  'port_solis',
];

const SEA_RATION_PRIORITY: ItemId[] = [
  'dried_fish',
  'dried_meat',
  'ration_bar',
  'cooked_fish',
  'cooked_meat',
];

export function createInitialBoatState(): BoatBuildState {
  return {
    keel_hull: false,
    mast_sail: false,
    outboard_engine: false,
    nav_provisions: false,
  };
}

export function createInitialVoyageState(): VoyageState {
  return {
    phase: 'docked',
    distanceNm: 0,
    targetNm: VOYAGE_STOPS.shoal_cay.distanceNm,
    legIndex: 1,
    hullIntegrity: 100,
    fuelPct: 100,
    throttle: 'sail',
    currentStopId: null,
    visitedStops: [],
    scavengedStops: [],
    seaEventText: null,
  };
}

export function countBoatStagesComplete(boat: BoatBuildState): number {
  return BOAT_STAGE_ORDER.filter((id) => Boolean(boat[id])).length;
}

export function isBoatReadyToLaunch(boat: BoatBuildState): boolean {
  return countBoatStagesComplete(boat) === BOAT_STAGE_ORDER.length;
}

export function getNextBoatStageId(boat: BoatBuildState): BoatStageId | null {
  return BOAT_STAGE_ORDER.find((id) => !boat[id]) ?? null;
}

export function countSeaRations(inventory: (InventorySlot | null)[]): number {
  return SEA_RATION_PRIORITY.reduce((sum, id) => sum + countItem(inventory, id), 0);
}

function consumeSeaRations(
  inventory: (InventorySlot | null)[],
  needed: number
): { ok: boolean; inventory: (InventorySlot | null)[] } {
  let remNeeded = needed;
  let updated = inventory;
  for (const id of SEA_RATION_PRIORITY) {
    if (remNeeded <= 0) break;
    const have = countItem(updated, id);
    if (have <= 0) continue;
    const take = Math.min(have, remNeeded);
    const res = removeItem(updated, id, take);
    if (res.success) {
      updated = res.inventory;
      remNeeded -= take;
    }
  }
  return { ok: remNeeded === 0, inventory: remNeeded === 0 ? updated : inventory };
}

export function isDanielAssistingBoat(state: SurvivalState): boolean {
  return Boolean(
    state.companion.found &&
      !state.companion.downed &&
      state.companion.trust >= 45 &&
      state.companion.command === 'build'
  );
}

function getEffectiveStageIngredients(
  state: SurvivalState,
  stageId: BoatStageId
): RecipeIngredient[] {
  const def = BOAT_STAGE_DEFS[stageId];
  const discount = isDanielAssistingBoat(state) ? 1 : 0;
  if (discount === 0) return def.ingredients;
  return def.ingredients.map((ing) => ({
    itemId: ing.itemId,
    count: ing.count >= 4 ? ing.count - 2 : ing.count >= 2 ? ing.count - 1 : ing.count,
  }));
}

export function canBuildBoatStage(
  state: SurvivalState,
  stageId: BoatStageId
): { ok: boolean; reason?: string } {
  // Non-linear: Boat can be built anytime materials are gathered without rigid Act gates.
  if (state.boat[stageId]) {
    return { ok: false, reason: 'Stage already completed.' };
  }
  const idx = BOAT_STAGE_ORDER.indexOf(stageId);
  for (let i = 0; i < idx; i++) {
    if (!state.boat[BOAT_STAGE_ORDER[i]]) {
      return {
        ok: false,
        reason: `Complete ${BOAT_STAGE_DEFS[BOAT_STAGE_ORDER[i]].name} first.`,
      };
    }
  }

  const def = BOAT_STAGE_DEFS[stageId];
  const reqs = getEffectiveStageIngredients(state, stageId);
  const missing: string[] = [];
  for (const ing of reqs) {
    const have = countItem(state.inventory, ing.itemId);
    if (have < ing.count) {
      missing.push(`${ing.count - have}x ${ITEM_DEFS[ing.itemId].name}`);
    }
  }
  if (def.seaRationsRequired) {
    const haveRations = countSeaRations(state.inventory);
    if (haveRations < def.seaRationsRequired) {
      missing.push(`${def.seaRationsRequired - haveRations}x Dried/Cooked Food`);
    }
  }

  if (missing.length > 0) {
    return { ok: false, reason: `Missing: ${missing.join(', ')}` };
  }
  return { ok: true };
}

export function buildBoatStage(
  state: SurvivalState,
  stageId: BoatStageId
): { ok: boolean; state: SurvivalState; message: string } {
  const check = canBuildBoatStage(state, stageId);
  if (!check.ok) {
    return { ok: false, state, message: check.reason ?? 'Cannot build stage.' };
  }

  const def = BOAT_STAGE_DEFS[stageId];
  const reqs = getEffectiveStageIngredients(state, stageId);
  const danielHelps = isDanielAssistingBoat(state);
  let inv = state.inventory;
  for (const ing of reqs) {
    const res = removeItem(inv, ing.itemId, ing.count);
    if (!res.success) {
      return { ok: false, state, message: 'Missing boat building materials.' };
    }
    inv = res.inventory;
  }

  if (def.seaRationsRequired) {
    const ratRes = consumeSeaRations(inv, def.seaRationsRequired);
    if (!ratRes.ok) {
      return { ok: false, state, message: 'Missing sea rations.' };
    }
    inv = ratRes.inventory;
  }

  const buildHours = danielHelps
    ? BOAT.STAGE_BUILD_HOURS / COMPANION_TUNING.BOAT_REBUILD_SPEED_MULT
    : BOAT.STAGE_BUILD_HOURS;
  const nextTotalHours = state.clock.totalHours + buildHours;
  const nextHourRaw = state.clock.hour + buildHours;
  const dayBump = Math.floor(nextHourRaw / 24);
  const nextClock = {
    day: state.clock.day + dayBump,
    hour: nextHourRaw % 24,
    totalHours: nextTotalHours,
  };

  const nextBoat: BoatBuildState = {
    ...state.boat,
    [stageId]: true,
  };
  const completeCount = countBoatStagesComplete(nextBoat);

  return {
    ok: true,
    state: {
      ...state,
      inventory: inv,
      clock: nextClock,
      boat: nextBoat,
      flags: {
        ...state.flags,
        [`boat_${stageId}`]: true,
      },
      stats: {
        ...state.stats,
        itemsCrafted: state.stats.itemsCrafted + 1,
      },
    },
    message:
      completeCount === 4
        ? `${def.name} complete!${danielHelps ? ' (Daniel sped up the assembly!)' : ''} Cast Off when ready!`
        : `Completed Stage ${def.stageNumber}/4: ${def.name}${danielHelps ? ' (Fast Assist)' : ''}.`,
  };
}

/**
 * Fixed Event #2: When attempting to sail off the island on Boat #1,
 * The Aura King splits the sky with violet lightning, shatters Boat #1's rigging & engine
 * (leaving the keel intact to salvage), and casts the survivors back onto the beach.
 */
export function triggerFirstBoatDestruction(state: SurvivalState): SurvivalState {
  const beachPos = {
    x: WORLD.BOAT_DOCK_POS.x + 2.5,
    y: 1.5,
    z: WORLD.BOAT_DOCK_POS.z - 5.5,
    yaw: 0,
  };

  // If the player never found Daniel earlier, the storm washes them ashore together
  const nextCompanion = state.companion.found
    ? {
        ...state.companion,
        downed: false,
        x: beachPos.x + 2.8,
        z: beachPos.z + 0.8,
        moodText:
          'That wasn’t a storm... He broke the mast clean in half! We can’t run on brute planks alone — get stronger first.',
      }
    : {
        ...state.companion,
        found: true,
        trust: Math.max(state.companion.trust, 32),
        x: beachPos.x + 2.8,
        z: beachPos.z + 0.8,
        moodText:
          'Wait—grab my hand! You tried punching through his reef blockade too? Name’s Daniel. Let’s regroup.',
      };

  const entryId = 'boat1_shattered_event';
  const nextEntries = state.journalEntries.some((e) => e.id === entryId)
    ? state.journalEntries
    : [
        ...state.journalEntries,
        {
          id: entryId,
          category: 'aura_king' as const,
          title: 'Boat #1 Shattered at the Storm Blockade',
          detail:
            'The Aura King annihilated our first escape boat with purple-gold lightning right beyond the surf. Salvageable hull remains at the dock. Before trying Boat #2, get strong enough: awaken Relic Shrines, craft rare gear or heist the Stronghold Armory, and work with Daniel.',
          day: state.clock.day,
        },
      ];

  return {
    ...state,
    storyPhase: 'preparing',
    weather: { kind: 'storm', rain: 0.72, wind: 0.82 },
    needs: {
      ...state.needs,
      health: Math.max(28, state.needs.health - 24),
      wetness: 85,
    },
    player: beachPos,
    companion: nextCompanion,
    boat: {
      keel_hull: true, // salvaged keel so Boat #2 repairs faster!
      mast_sail: false,
      outboard_engine: false,
      nav_provisions: false,
    },
    voyage: {
      ...createInitialVoyageState(),
      phase: 'docked',
      hullIntegrity: 35,
      seaEventText: 'Boat #1 shattered by the Aura King! Keel salvaged on the slipway — prepare before trying Boat #2.',
    },
    journalEntries: nextEntries,
    flags: {
      ...state.flags,
      boat1_destroyed: true,
      boat_attempted: true,
    },
  };
}

export function launchEscapeVoyage(
  state: SurvivalState
): { ok: boolean; state: SurvivalState; message: string; triggeredBoat1Destruction?: boolean } {
  if (!isBoatReadyToLaunch(state.boat)) {
    return {
      ok: false,
      state,
      message: 'Finish all 4 Boat Slipway stages before setting sail.',
    };
  }

  // Fixed Event #2: First escape attempt ends with Boat #1 shattered at the glowing storm reef!
  if (!state.flags.boat1_destroyed) {
    const wreckedState = triggerFirstBoatDestruction(state);
    return {
      ok: true,
      triggeredBoat1Destruction: true,
      state: wreckedState,
      message:
        'A violet-gold thunderbolt splits Boat #1 at the reef! You wash back ashore alongside Daniel — get stronger first before rebuilding Boat #2.',
    };
  }

  // Fixed Event #3: Rebuilt Boat #2 launches into the Final Sea Chase with Daniel helming!
  const chaseState = startFinalSeaChase(state, state.bossDifficulty ?? 'normal');
  return {
    ok: true,
    triggeredBoat1Destruction: false,
    state: {
      ...chaseState,
      voyage: {
        ...createInitialVoyageState(),
        phase: 'sailing',
        throttle: 'sail',
        hullIntegrity: 100,
        seaEventText:
          'Daniel holds the helm across gale-force swells! Break the Aura King’s storm chase at the outer reef!',
      },
    },
    message:
      'Boat #2 clears the slipway with Daniel helming! Hold the deck and shatter The Aura King!',
  };
}

export function setVoyageThrottle(state: SurvivalState, throttle: VoyageThrottle): SurvivalState {
  if (state.voyage.phase !== 'sailing') return state;
  return {
    ...state,
    voyage: {
      ...state.voyage,
      throttle,
    },
  };
}

export function repairVoyageHull(
  state: SurvivalState
): { ok: boolean; state: SurvivalState; message: string } {
  if (state.voyage.hullIntegrity >= 100) {
    return { ok: false, state, message: 'Hull integrity is already at 100%.' };
  }
  const hasPlanks = countItem(state.inventory, 'plank') >= 2;
  const hasResin = countItem(state.inventory, 'resin') >= 1;
  if (!hasPlanks && !hasResin) {
    return { ok: false, state, message: 'Requires 2x Planks or 1x Pine Resin to seal hull.' };
  }

  let inv = state.inventory;
  if (hasPlanks) {
    inv = removeItem(inv, 'plank', 2).inventory;
  } else {
    inv = removeItem(inv, 'resin', 1).inventory;
  }

  const nextHull = Math.min(100, Math.round(state.voyage.hullIntegrity + BOAT.HULL_PATCH_AMOUNT));
  return {
    ok: true,
    state: {
      ...state,
      inventory: inv,
      voyage: {
        ...state.voyage,
        hullIntegrity: nextHull,
        seaEventText: `Hull planks sealed and caulked (+${nextHull - Math.round(state.voyage.hullIntegrity)}% Integrity).`,
      },
    },
    message: `Patched hull up to ${nextHull}%.`,
  };
}

export function refuelVoyageFromPack(
  state: SurvivalState
): { ok: boolean; state: SurvivalState; message: string } {
  if (state.voyage.fuelPct >= 99) {
    return { ok: false, state, message: 'Outboard diesel tank is already full.' };
  }
  if (countItem(state.inventory, 'fuel_can') < 1) {
    return { ok: false, state, message: 'No Diesel Jerrycan in inventory.' };
  }
  const rem = removeItem(state.inventory, 'fuel_can', 1);
  if (!rem.success) return { ok: false, state, message: 'No Diesel Jerrycan found.' };

  const nextFuel = Math.min(100, Math.round(state.voyage.fuelPct + BOAT.FUEL_PER_CAN_PCT));
  return {
    ok: true,
    state: {
      ...state,
      inventory: rem.inventory,
      voyage: {
        ...state.voyage,
        fuelPct: nextFuel,
        seaEventText: `Refueled outboard engine tank (${nextFuel}% Fuel).`,
      },
    },
    message: `Refueled outboard to ${nextFuel}%.`,
  };
}

export function scavengeVoyageStop(
  state: SurvivalState
): { ok: boolean; state: SurvivalState; message: string } {
  const stopId = state.voyage.currentStopId;
  if (state.voyage.phase !== 'stopover' || !stopId) {
    return { ok: false, state, message: 'Not anchored at a sea stopover.' };
  }
  if (state.voyage.scavengedStops.includes(stopId)) {
    return { ok: false, state, message: 'You have already searched this islet.' };
  }

  const def = VOYAGE_STOPS[stopId];
  let inv = state.inventory;
  let totalAdded = 0;
  const gainedLabels: string[] = [];

  for (const drop of def.scavengeLoot) {
    const res = addItem(inv, drop.itemId, drop.count);
    inv = res.inventory;
    totalAdded += res.added;
    if (res.added > 0) {
      gainedLabels.push(`+${res.added} ${ITEM_DEFS[drop.itemId].name}`);
    }
  }

  return {
    ok: true,
    state: {
      ...state,
      inventory: inv,
      voyage: {
        ...state.voyage,
        scavengedStops: [...state.voyage.scavengedStops, stopId],
        seaEventText:
          gainedLabels.length > 0
            ? `Scavenged ${def.name}: ${gainedLabels.join(', ')}`
            : `Pack full — check space before departing ${def.name}.`,
      },
      stats: {
        ...state.stats,
        itemsGathered: state.stats.itemsGathered + totalAdded,
      },
    },
    message:
      gainedLabels.length > 0
        ? `Scavenged ${def.name}: ${gainedLabels.join(', ')}`
        : 'Backpack full — organize space first.',
  };
}

export function anchorRestAtStop(
  state: SurvivalState
): { ok: boolean; state: SurvivalState; message: string } {
  if (state.voyage.phase !== 'stopover' || !state.voyage.currentStopId) {
    return { ok: false, state, message: 'Drop anchor at an islet to rest.' };
  }
  const restHours = 1.5;
  const rawH = state.clock.hour + restHours;
  return {
    ok: true,
    state: {
      ...state,
      clock: {
        day: state.clock.day + Math.floor(rawH / 24),
        hour: rawH % 24,
        totalHours: state.clock.totalHours + restHours,
      },
      needs: {
        ...state.needs,
        stamina: Math.min(100, state.needs.stamina + 38),
        temperature: Math.min(TEMPERATURE.NORMAL_BODY_C, state.needs.temperature + 1.8),
        wetness: Math.max(0, state.needs.wetness - 35),
      },
      voyage: {
        ...state.voyage,
        seaEventText: `Rested in the lee of ${VOYAGE_STOPS[state.voyage.currentStopId].name}. Warmed & recovered stamina.`,
      },
    },
    message: 'Warmed up & rested at anchor (+Stamina, dried gear).',
  };
}

export function resumeVoyageLeg(
  state: SurvivalState
): { ok: boolean; state: SurvivalState; message: string } {
  if (state.voyage.phase !== 'stopover') {
    return { ok: false, state, message: 'Already underway.' };
  }
  const nextLeg = Math.min(4, state.voyage.legIndex + 1) as 1 | 2 | 3 | 4;
  const nextStopId = STOP_ORDER[nextLeg - 1];
  const nextTarget = VOYAGE_STOPS[nextStopId].distanceNm;
  const enteringAct5 = nextLeg >= 4 || state.voyage.distanceNm >= VOYAGE.FINAL_ACT5_NM;

  return {
    ok: true,
    state: {
      ...state,
      act: enteringAct5 ? 5 : state.act,
      voyage: {
        ...state.voyage,
        phase: 'sailing',
        legIndex: nextLeg,
        targetNm: nextTarget,
        currentStopId: null,
        seaEventText: enteringAct5
          ? 'Final stretch! Heavy squalls ahead — push through to Port Solis Harbor!'
          : `Weighed anchor — sailing Leg ${nextLeg}/4 toward ${VOYAGE_STOPS[nextStopId].name}.`,
      },
    },
    message: `Set sail on Leg ${nextLeg}/4 (${nextTarget.toFixed(1)} nm waypoint).`,
  };
}

export function returnToIslandDock(state: SurvivalState): SurvivalState {
  return {
    ...state,
    voyage: {
      ...createInitialVoyageState(),
      phase: 'docked',
      hullIntegrity: Math.max(55, state.voyage.hullIntegrity),
      fuelPct: Math.max(25, state.voyage.fuelPct),
    },
  };
}

export function computeSeaWeatherForLeg(legIndex: 1 | 2 | 3 | 4, distanceNm: number): WeatherState {
  const wave = 0.5 + 0.5 * Math.sin(distanceNm * 2.1);
  if (legIndex === 4) {
    return { kind: 'storm', rain: 0.78 + wave * 0.22, wind: 0.8 + wave * 0.2 };
  }
  if (legIndex === 2) {
    return wave > 0.45
      ? { kind: 'storm', rain: 0.75, wind: 0.82 }
      : { kind: 'rain', rain: 0.52, wind: 0.55 };
  }
  if (legIndex === 3) {
    return wave > 0.65
      ? { kind: 'storm', rain: 0.68, wind: 0.74 }
      : { kind: 'overcast', rain: 0.15, wind: 0.42 };
  }
  return { kind: 'clear', rain: 0, wind: 0.25 };
}

export interface VoyageTickResult {
  state: SurvivalState;
  arrivedStop?: VoyageStopDef;
  reachedCity?: boolean;
  shipwrecked?: boolean;
}

export function tickVoyage(state: SurvivalState, dtSec: number): VoyageTickResult {
  if (state.voyage.phase !== 'sailing' || dtSec <= 0 || !state.alive) {
    return { state };
  }

  const diff = DIFFICULTY[state.difficulty];
  const v = state.voyage;
  const seaWeather = computeSeaWeatherForLeg(v.legIndex, v.distanceNm);
  const isStorm = seaWeather.kind === 'storm';

  let throttle = v.throttle;
  if (throttle === 'motor' && v.fuelPct <= 0) {
    throttle = 'sail';
  }

  let speedMult = 1.0;
  let fuelUsed = 0;
  if (throttle === 'motor') {
    speedMult = VOYAGE.MOTOR_SPEED_MULT;
    fuelUsed = VOYAGE.MOTOR_FUEL_PER_SEC * dtSec;
  } else if (throttle === 'brace') {
    speedMult = 0.48;
  }

  if (isStorm && throttle === 'sail') {
    speedMult *= 0.72;
  }

  const nmStep = VOYAGE.SAIL_SPEED_NM_PER_SEC * speedMult * dtSec;
  const nextDistance = Math.min(v.targetNm, v.distanceNm + nmStep);
  const nextFuel = Math.max(0, v.fuelPct - fuelUsed);

  let hullDrain = 0;
  if (isStorm) {
    hullDrain = VOYAGE.STORM_HULL_DRAIN_PER_SEC * diff.damageMult * dtSec;
    if (throttle === 'brace') {
      hullDrain *= VOYAGE.BRACE_DAMAGE_MULT;
    } else if (throttle === 'motor') {
      hullDrain *= 1.15;
    }
  } else if (seaWeather.kind === 'rain') {
    hullDrain = 0.28 * dtSec;
  }
  const nextHull = Math.max(0, v.hullIntegrity - hullDrain);

  // Subtle offshore exposure / thirst / hunger while sailing
  const nextNeeds = {
    ...state.needs,
    hunger: Math.max(0, state.needs.hunger - 0.14 * diff.drainMult * dtSec),
    thirst: Math.max(0, state.needs.thirst - 0.18 * diff.drainMult * dtSec),
    temperature: Math.max(
      33.5,
      Math.min(
        TEMPERATURE.NORMAL_BODY_C,
        state.needs.temperature + (isStorm ? -0.05 : 0.015) * dtSec
      )
    ),
    wetness: isStorm
      ? Math.min(100, state.needs.wetness + 4.5 * dtSec)
      : Math.max(0, state.needs.wetness - 2.0 * dtSec),
  };

  // Advance clock slightly at sea pace (1 real sec = ~0.018 in-game hr)
  const deltaHours = dtSec * (24 / (TIME.DAYLIGHT_REAL_MINUTES * 60 + TIME.NIGHT_REAL_MINUTES * 60));
  const rawHour = state.clock.hour + deltaHours;
  const nextClock = {
    day: state.clock.day + Math.floor(rawHour / 24),
    hour: rawHour % 24,
    totalHours: state.clock.totalHours + deltaHours,
  };

  // Check shipwreck loss
  if (nextHull <= 0) {
    return {
      shipwrecked: true,
      state: {
        ...state,
        alive: false,
        clock: nextClock,
        weather: seaWeather,
        needs: { ...nextNeeds, health: 0 },
        voyage: {
          ...v,
          phase: 'docked',
          hullIntegrity: 0,
          fuelPct: nextFuel,
          throttle,
          seaEventText: 'Heavy seas stove in the hull planks!',
        },
      },
    };
  }

  const actualStep = nextDistance - v.distanceNm;
  const nextStats = {
    ...state.stats,
    distanceTravelled: state.stats.distanceTravelled + actualStep * 185,
    playTimeSec: state.stats.playTimeSec + dtSec,
  };

  const nextAct: SurvivalState['act'] =
    nextDistance >= VOYAGE.FINAL_ACT5_NM ? 5 : Math.max(4, state.act) as SurvivalState['act'];

  // Check arrival at leg waypoint
  if (nextDistance >= v.targetNm) {
    const stopId = STOP_ORDER[v.legIndex - 1];
    const stopDef = VOYAGE_STOPS[stopId];

    if (stopId === 'port_solis' || nextDistance >= VOYAGE.TOTAL_DISTANCE_NM) {
      return {
        reachedCity: true,
        arrivedStop: stopDef,
        state: {
          ...state,
          act: 5,
          clock: nextClock,
          weather: { kind: 'clear', rain: 0, wind: 0.2 },
          needs: nextNeeds,
          escapedCity: true,
          escapedAtDay: nextClock.day,
          stats: nextStats,
          voyage: {
            ...v,
            phase: 'arrived',
            distanceNm: VOYAGE.TOTAL_DISTANCE_NM,
            hullIntegrity: nextHull,
            fuelPct: nextFuel,
            throttle: 'sail',
            currentStopId: 'port_solis',
            visitedStops: v.visitedStops.includes('port_solis')
              ? v.visitedStops
              : [...v.visitedStops, 'port_solis'],
            seaEventText: 'Harbor searchlights ahead — Port Solis Coastguard Quay reached!',
          },
        },
      };
    }

    return {
      arrivedStop: stopDef,
      state: {
        ...state,
        act: nextAct,
        clock: nextClock,
        weather: { kind: 'overcast', rain: 0.1, wind: 0.28 },
        needs: nextNeeds,
        stats: nextStats,
        voyage: {
          ...v,
          phase: 'stopover',
          distanceNm: nextDistance,
          hullIntegrity: nextHull,
          fuelPct: nextFuel,
          throttle,
          currentStopId: stopId,
          visitedStops: v.visitedStops.includes(stopId)
            ? v.visitedStops
            : [...v.visitedStops, stopId],
          seaEventText: `Dropped anchor off ${stopDef.name}.`,
        },
      },
    };
  }

  return {
    state: {
      ...state,
      act: nextAct,
      clock: nextClock,
      weather: seaWeather,
      needs: nextNeeds,
      stats: nextStats,
      voyage: {
        ...v,
        distanceNm: nextDistance,
        hullIntegrity: nextHull,
        fuelPct: nextFuel,
        throttle,
        seaEventText: isStorm
          ? throttle === 'brace'
            ? 'Heavy Squall! Crew bracing the hull against breaking waves.'
            : 'Heavy Squall hammering the hull! Brace [Brace Hull] or watch integrity!'
          : throttle === 'motor'
            ? 'Outboard engine roaring cleanly over open swells.'
            : 'Canvas mainsail filling steadily toward the next island.',
      },
    },
  };
}
