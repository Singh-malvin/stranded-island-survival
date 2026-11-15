// Multi-act progression objectives (Acts 1–5), interactive story clues,
// Act transitions, and Station 3 equipment repairs. Pure domain logic.

import { VOYAGE, WORLD } from './config.ts';
import { addItem, countItem, ITEM_DEFS, removeItem } from './items.ts';
import type {
  ObjectiveStep,
  RecipeIngredient,
  StationRepairId,
  StoryClueDef,
  SurvivalState,
} from './types.ts';
import { BOAT_STAGE_DEFS } from './voyage.ts';
import { getZoneAt, ISLAND_GATES } from './world.ts';

export const STORY_CLUES: StoryClueDef[] = [
  // --- ACT 1 CLUES ---
  {
    id: 'clue_manifest',
    title: 'Flight 404 Cargo Manifest',
    subtitle: 'Wreckage Beach — Wing Section',
    act: 1,
    x: WORLD.WRECK_POS.x + 2.5,
    z: WORLD.WRECK_POS.z + 3.2,
    propKind: 'manifest',
    summary: 'Water-stained passenger & cargo manifest from Charter Flight 404.',
    logText:
      'Charter Flight 404 departed Darwin toward Manila with surveying gear and six relief crates. Last radio stamp before tail-strike: "Uncharted volcanic atoll ~190 nm southeast of shipping lane. Compass spinning near caldera ridge." Search the western spring and northern passes if the tail broke off inland.',
  },
  {
    id: 'clue_spring_note',
    title: 'Carved Bamboo Flask & Note',
    subtitle: 'Freshwater Spring — Moss Terrace',
    act: 1,
    x: WORLD.SPRING_POS.x + 3.2,
    z: WORLD.SPRING_POS.z + 1.5,
    propKind: 'flask_note',
    summary: 'An older weathered bamboo canteen tied with hemp twine near the seep.',
    logText:
      'Dated at least two monsoons ago — well before Flight 404. Scratched inside the leather tag: "Dr. H. Patel — Station 3. Spring water safe once boiled. Banyan wall blocks the north saddle; stone blades bounce right off it. Craft steel tools or climbing gear on a workbench before heading inland."',
  },
  {
    id: 'clue_vine_gate',
    title: 'Surveyor Blazed Marker',
    subtitle: 'Basalt Spine — Overgrown Banyan Thicket',
    act: 1,
    x: -2.5,
    z: WORLD.ACT1_RIDGE_Z + 4.5,
    propKind: 'blazed_marker',
    summary: 'A rusted steel stake driven into the root wall with faded yellow flagging tape.',
    logText:
      'Surveyors marked this narrow notch as the central pass through the basalt spine. Craft a Brush Machete or Steel Axe at a Workbench to hack through, or rig Climbing Gear on the western cliffs or a Gorge Raft down at the eastern river.',
  },

  // --- ACT 2 CLUES ---
  {
    id: 'clue_abandoned_camp',
    title: "Predecessor's Field Journal",
    subtitle: 'Abandoned Survivor Camp — Plateau West',
    act: 2,
    x: WORLD.ABANDONED_CAMP_POS.x + 2.2,
    z: WORLD.ABANDONED_CAMP_POS.z + 1.8,
    propKind: 'journal_book',
    summary: 'Salt-stiffened waterproof notebook tucked under a collapsed tarpaulin frame.',
    logText:
      'Entries by survey engineer Mara Chen: "Month 3. At dusk, a crown of purple stormlight flickers along the high basalt ridge — the locals called him the King. Nobody who launched from the south cove ever cleared his squall line. Station 3 up on the caldera still has a shortwave tower, and we dropped the keycard out at the eastern stone ruins before abandoning camp."',
  },
  {
    id: 'clue_tail_blackbox',
    title: 'Flight 404 Tail Black Box Log',
    subtitle: 'Tail Wreckage Clearing — Jungle East',
    act: 2,
    x: WORLD.JUNGLE_TAIL_POS.x - 2.5,
    z: WORLD.JUNGLE_TAIL_POS.z + 2.2,
    propKind: 'black_box',
    summary: 'Scorched orange cockpit voice & avionics pod nestled among shattered canopy trunks.',
    logText:
      'Recovered black-box telemetry: Flight 404 encountered an impossible localized amethyst vortex dead above the caldera — clear sky turning into violent lightning in 12 seconds. Salvage circuit boards, diesel drums, and signal flare components before confronting whatever commands the storm.',
  },

  // --- ACT 3 CLUES ---
  {
    id: 'clue_cave_note',
    title: "Miner's Lamp & Glowing Aura Glyphs",
    subtitle: 'Western Basalt Caves — Grotto Floor',
    act: 3,
    x: WORLD.CAVE_GROTTO_POS.x + 2.4,
    z: WORLD.CAVE_GROTTO_POS.z + 2.0,
    propKind: 'cave_note',
    summary: 'Charcoal tally sheet wedged beside strange violet-gold runes pulsing in wet basalt.',
    logText:
      'The survey team carved warning marks next to glowing reef-coral sigils etched into the rock: "When the King’s aura dims after a slam, strike with everything you have — fire bombs and magnesium flares tear through his storm shroud!" Collect thick copper wire from these conduits.',
  },
  {
    id: 'clue_ruins_tablet',
    title: 'Overgrown Aura Altar & Keycard',
    subtitle: 'Ancient Stone Ruins — Northeast Cliffs',
    act: 3,
    x: WORLD.ANCIENT_RUINS_POS.x,
    z: WORLD.ANCIENT_RUINS_POS.z + 2.2,
    propKind: 'stone_tablet',
    summary: 'Carved basalt plinth cradling glowing purple-gold runes and Dr. Patel’s keycard.',
    logText:
      'Ancient sanctuary to the Aura King: "He rules tide, basalt, and tempest; three reef-crystal monoliths lock his shield until shattered." Resting beside the pulsing inscription lies Dr. H. Patel’s Station 3 Security Keycard — enough to open the northern caldera gate.',
    grantsItem: { itemId: 'station_keycard', count: 1 },
  },
  {
    id: 'clue_station_log',
    title: "Dr. Patel's Evacuation & Sovereign Tape",
    subtitle: 'Station 3 Radio Compound — Caldera Ridge',
    act: 3,
    x: WORLD.RESEARCH_STATION_POS.x + 3.5,
    z: WORLD.RESEARCH_STATION_POS.z + 4.8,
    propKind: 'station_log',
    summary: 'Laminated checklist taped onto the steel radio hut door beside scorched headphones.',
    logText:
      'Protocol for departure: 1) Wire the Radio Transceiver (beware the sovereign voice bleeding through static on band 4). 2) Repair the Generator & Nautical Chart Table. 3) Craft a Hunting Bow, Fire Bombs, and Signal Flare Gun before finishing the boat — the Aura King blocks anyone trying to sail past the reef.',
  },
];

export interface StationRepairDef {
  id: StationRepairId;
  name: string;
  x: number;
  z: number;
  ingredients: RecipeIngredient[];
  requiresRepaired?: StationRepairId[];
  description: string;
}

export const STATION_REPAIR_DEFS: Record<StationRepairId, StationRepairDef> = {
  radio: {
    id: 'radio',
    name: 'Shortwave Radio Transceiver',
    x: WORLD.RESEARCH_STATION_POS.x - 4.2,
    z: WORLD.RESEARCH_STATION_POS.z + 2.4,
    ingredients: [
      { itemId: 'copper_wire', count: 2 },
      { itemId: 'circuit_board', count: 1 },
    ],
    description: 'Re-solder corroded antenna leads and slot in a surviving avionics circuit board.',
  },
  generator: {
    id: 'generator',
    name: 'Diesel Backup Generator',
    x: WORLD.RESEARCH_STATION_POS.x + 4.4,
    z: WORLD.RESEARCH_STATION_POS.z - 1.5,
    ingredients: [
      { itemId: 'fuel_can', count: 1 },
      { itemId: 'metal_ingot', count: 2 },
      { itemId: 'scrap_metal', count: 2 },
    ],
    description: 'Forge replacement housing struts, tighten manifold plates, and prime diesel fuel.',
  },
  chart: {
    id: 'chart',
    name: 'Offshore Nautical Chart Table',
    x: WORLD.RESEARCH_STATION_POS.x,
    z: WORLD.RESEARCH_STATION_POS.z - 4.6,
    ingredients: [],
    requiresRepaired: ['radio', 'generator'],
    description: 'Powered hydrographic plotter locking in sea-current bearings toward the mainland city.',
  },
};

export function getClueById(clueId: string): StoryClueDef | undefined {
  return STORY_CLUES.find((c) => c.id === clueId);
}

/**
 * Records discovery of a story clue idempotently and grants any linked story key item once.
 */
export function discoverClue(
  state: SurvivalState,
  clueId: string
): { state: SurvivalState; newlyFound: boolean; clue: StoryClueDef | undefined; itemGranted?: string } {
  const clue = getClueById(clueId);
  if (!clue) {
    return { state, newlyFound: false, clue: undefined };
  }
  if (state.cluesFound.includes(clueId)) {
    return { state, newlyFound: false, clue };
  }

  let nextInventory = state.inventory;
  let itemGranted: string | undefined;
  if (clue.grantsItem) {
    const added = addItem(nextInventory, clue.grantsItem.itemId, clue.grantsItem.count);
    nextInventory = added.inventory;
    if (added.added > 0) {
      itemGranted = `${added.added}x ${ITEM_DEFS[clue.grantsItem.itemId].name}`;
    }
  }

  const nextState: SurvivalState = {
    ...state,
    inventory: nextInventory,
    cluesFound: [...state.cluesFound, clueId],
  };

  return {
    state: {
      ...nextState,
      act: computeCurrentAct(nextState),
    },
    newlyFound: true,
    clue,
    itemGranted,
  };
}

export function repairStationSystem(
  state: SurvivalState,
  partId: StationRepairId
): { ok: boolean; state: SurvivalState; message: string } {
  const def = STATION_REPAIR_DEFS[partId];
  if (state.stationRepairs[partId]) {
    return { ok: true, state, message: `${def.name} is already repaired and online.` };
  }

  if (def.requiresRepaired) {
    for (const reqId of def.requiresRepaired) {
      if (!state.stationRepairs[reqId]) {
        return {
          ok: false,
          state,
          message: `Power required: repair ${STATION_REPAIR_DEFS[reqId].name} before activating ${def.name}.`,
        };
      }
    }
  }

  const missing: string[] = [];
  for (const ing of def.ingredients) {
    const have = countItem(state.inventory, ing.itemId);
    if (have < ing.count) {
      missing.push(`${ing.count - have}x ${ITEM_DEFS[ing.itemId].name}`);
    }
  }
  if (missing.length > 0) {
    return {
      ok: false,
      state,
      message: `Need ${missing.join(', ')} to repair ${def.name}.`,
    };
  }

  let nextInventory = state.inventory;
  for (const ing of def.ingredients) {
    const rem = removeItem(nextInventory, ing.itemId, ing.count);
    if (!rem.success) return { ok: false, state, message: 'Missing required components.' };
    nextInventory = rem.inventory;
  }

  const nextRepairs = {
    ...state.stationRepairs,
    [partId]: true,
  };
  const allComplete = nextRepairs.radio && nextRepairs.generator && nextRepairs.chart;
  const nextAct: SurvivalState['act'] = allComplete ? 4 : Math.max(state.act, 3) as SurvivalState['act'];

  return {
    ok: true,
    state: {
      ...state,
      act: nextAct,
      inventory: nextInventory,
      stationRepairs: nextRepairs,
      flags: {
        ...state.flags,
        [`repaired_${partId}`]: true,
        ...(allComplete ? { act3_complete: true } : {}),
        ...(partId === 'radio' ? { heard_boss_radio_static: true } : {}),
      },
    },
    message: allComplete
      ? 'Sea Chart Online! Shipping lane toward Port Solis locked — Act 3 Complete! Prepare for Escape in Act 4.'
      : partId === 'radio'
        ? 'Shortwave Radio Online! Static cuts in: "...NO ONE LEAVES MY ISLAND..." — The Aura King awaits at the western cliff sanctum.'
        : `Repaired ${def.name}! Station systems coming online.`,
  };
}

export function evaluateAct1Objectives(state: SurvivalState): ObjectiveStep[] {
  const inspectedWreck = state.cluesFound.includes('clue_manifest');
  const hasHatchet =
    countItem(state.inventory, 'stone_axe') >= 1 ||
    Boolean(state.flags.crafted_stone_axe);
  const hasPick =
    countItem(state.inventory, 'stone_pick') >= 1 ||
    Boolean(state.flags.crafted_stone_pick);
  const toolsDone = hasHatchet && hasPick;

  const hasFire = state.campfires.length > 0;
  const hasCleanWater =
    countItem(state.inventory, 'water_bottle_clean') >= 1 ||
    Boolean(state.flags.drank_water_bottle_clean) ||
    Boolean(state.flags.cooked_boil_water);
  const fireAndWaterDone = hasFire && hasCleanWater;

  const hasShelter = state.shelters.length > 0;
  const exploredCluesCount = state.cluesFound.filter((id) =>
    ['clue_manifest', 'clue_spring_note', 'clue_vine_gate'].includes(id)
  ).length;
  const ridgeScouted =
    state.cluesFound.includes('clue_vine_gate') ||
    state.cluesFound.includes('clue_spring_note');
  const survivedNight = state.clock.day >= 2 || Boolean(state.flags.slept_in_shelter);

  return [
    {
      id: 'act1_wreck',
      act: 1,
      title: 'Inspect the Flight 404 Wreckage',
      detail:
        'Follow the smoke east along the wide southern beach to find the cargo manifest ([E] on glowing clipboard).',
      progressText: inspectedWreck ? 'Done' : '0/1',
      completed: inspectedWreck,
    },
    {
      id: 'act1_tools',
      act: 1,
      title: 'Gather Wood & Craft First Stone Tools',
      detail:
        'Collect Fallen Branches off the ground, gather Tide-Pool Flint & Plant Fibre, craft a Stone Hatchet & Flint Pickaxe, then chop Palm & Pine trees for Timber Logs.',
      progressText: `${(hasHatchet ? 1 : 0) + (hasPick ? 1 : 0)}/2 tools`,
      completed: toolsDone,
    },
    {
      id: 'act1_fire_water',
      act: 1,
      title: 'Make Fire & Purify Spring Water',
      detail:
        'Locate the Freshwater Spring inland NW, fill bottles or sip cautiously, build a Campfire [B], and boil Clean Water.',
      progressText: `${(hasFire ? 1 : 0) + (hasCleanWater ? 1 : 0)}/2`,
      completed: fireAndWaterDone,
    },
    {
      id: 'act1_shelter',
      act: 1,
      title: 'Build a Palm Lean-To Shelter',
      detail:
        'Craft a Shelter Kit [Tab] or place via Build [B] before nightfall to rest till dawn, heal, and anchor respawn.',
      progressText: hasShelter ? `${state.shelters.length} built` : '0/1',
      completed: hasShelter,
    },
    {
      id: 'act1_scout_ridge',
      act: 1,
      title: 'Scout the Northern Ridge & Breach Act 2',
      detail:
        'Investigate clues at the Basalt Spine Ridge, survive to Day 2+, and build a Timber Workbench [B] to craft Tier 2 crossing gear.',
      progressText: `Day ${state.clock.day} • ${exploredCluesCount}/3 clues`,
      completed: ridgeScouted && survivedNight,
    },
  ];
}

export function evaluateAct2Objectives(state: SurvivalState): ObjectiveStep[] {
  const hasWorkbench = (state.structures ?? []).some((s) => s.type === 'workbench');
  const hasCrossingGear =
    countItem(state.inventory, 'machete') >= 1 ||
    countItem(state.inventory, 'metal_axe') >= 1 ||
    countItem(state.inventory, 'climbing_gear') >= 1 ||
    countItem(state.inventory, 'river_raft') >= 1 ||
    state.unlockedGates.some((g) => g !== 'gate_research_station');

  const act2GatesCount = ISLAND_GATES.filter(
    (g) => g.unlockAct === 2 && state.unlockedGates.includes(g.id)
  ).length;
  const crossedRidge = act2GatesCount >= 1;

  const foundCamp = state.cluesFound.includes('clue_abandoned_camp');
  const foundTail = state.cluesFound.includes('clue_tail_blackbox');
  const cluesCount = (foundCamp ? 1 : 0) + (foundTail ? 1 : 0);

  const hunted = Boolean(state.flags.hunted_wildlife);
  const hasResinOrOre =
    countItem(state.inventory, 'resin') >= 1 ||
    countItem(state.inventory, 'iron_ore') >= 1 ||
    Boolean(state.flags.crafted_lantern);

  const hasForge = (state.structures ?? []).some((s) => s.type === 'forge');
  const hasIngots =
    countItem(state.inventory, 'metal_ingot') >= 1 ||
    Boolean(state.flags.crafted_smelt_ingot) ||
    Boolean(state.flags.crafted_smelt_iron_ingot);

  return [
    {
      id: 'act2_workbench',
      act: 2,
      title: 'Build Workbench & Tier-2 Crossing Gear',
      detail:
        'Place a Timber Workbench [B], chop timber logs into planks, and craft a Brush Machete, Climbing Gear, or Gorge Raft.',
      progressText: `${(hasWorkbench ? 1 : 0) + (hasCrossingGear ? 1 : 0)}/2`,
      completed: hasWorkbench && hasCrossingGear,
    },
    {
      id: 'act2_breach_ridge',
      act: 2,
      title: 'Cross the Basalt Spine into the Interior',
      detail:
        'Approach one of the 3 locked Ridge Passes (Banyan Thicket, West Cliffs, or East River) with matching gear and press [E].',
      progressText: `${act2GatesCount}/3 passes open`,
      completed: crossedRidge,
    },
    {
      id: 'act2_plateau_clues',
      act: 2,
      title: 'Explore Abandoned Camp & Tail Wreckage',
      detail:
        'Cross the interior plateau to uncover Maya\'s Abandoned Camp (West) and the Flight 404 Tail Section (East).',
      progressText: `${cluesCount}/2 landmarks`,
      completed: foundCamp && foundTail,
    },
    {
      id: 'act2_hunt_forage',
      act: 2,
      title: 'Hunt Island Wildlife & Harvest Interior Resources',
      detail:
        'Carry a Spear or Machete to fend off boars & vipers, gather Pitch Resin from pines, and mine Highland Iron seams.',
      progressText: `${(hunted ? 1 : 0) + (hasResinOrOre ? 1 : 0)}/2`,
      completed: hunted && hasResinOrOre,
    },
    {
      id: 'act2_forge',
      act: 2,
      title: 'Build a Stone Forge, Cure Driftwood & Smelt Alloy',
      detail:
        'Build a Stone Charcoal Forge [B], open it [E] to feed Timber Logs or Fallen Branches for kiln-dried Driftwood, and smelt Alloy Ingots.',
      progressText: `${(hasForge ? 1 : 0) + (hasIngots ? 1 : 0)}/2`,
      completed: hasForge && hasIngots,
    },
  ];
}

export function evaluateAct3Objectives(state: SurvivalState): ObjectiveStep[] {
  const foundCave =
    state.cluesFound.includes('clue_cave_note') ||
    countItem(state.inventory, 'copper_wire') >= 1;
  const foundRuins =
    state.cluesFound.includes('clue_ruins_tablet') ||
    countItem(state.inventory, 'station_keycard') >= 1;
  const unlockedStation = state.unlockedGates.includes('gate_research_station');

  return [
    {
      id: 'act3_caves_ruins',
      act: 3,
      title: 'Delve the Basalt Caves & Ancient Ruins',
      detail:
        'Carry a Torch/Lantern into the Western Basalt Caves for Copper Wire, and search the Northeast Ruins Altar for Dr. Patel\'s Keycard.',
      progressText: `${(foundCave ? 1 : 0) + (foundRuins ? 1 : 0)}/2 sites`,
      completed: foundCave && foundRuins,
    },
    {
      id: 'act3_unlock_station',
      act: 3,
      title: 'Enter Station 3 Radio Compound',
      detail:
        'Climb the central Caldera approach road and use your Security Keycard ([E]) on the Perimeter Gate.',
      progressText: unlockedStation ? 'Unlocked' : 'Locked',
      completed: unlockedStation,
    },
    {
      id: 'act3_repair_radio',
      act: 3,
      title: 'Repair the Shortwave Radio Transceiver',
      detail:
        'Repair at Station 3 using 2x Copper Wire (Caves) and 1x Avionics Circuit Board (Tail Wreck / Compound).',
      progressText: state.stationRepairs.radio ? 'Online' : 'Offline',
      completed: state.stationRepairs.radio,
    },
    {
      id: 'act3_repair_generator',
      act: 3,
      title: 'Restore the Diesel Backup Generator',
      detail:
        'Rebuild and fuel the Station 3 Generator with 1x Diesel Jerrycan, 2x Alloy Ingots, and 2x Scrap Metal.',
      progressText: state.stationRepairs.generator ? 'Running' : 'Offline',
      completed: state.stationRepairs.generator,
    },
    {
      id: 'act3_chart_route',
      act: 3,
      title: 'Activate Offshore Nautical Chart Table',
      detail:
        'Once Radio & Generator are online, inspect the Chart Table [E] to plot the deep-sea course to the city.',
      progressText: state.stationRepairs.chart ? 'Plotted' : 'Awaiting Power',
      completed: state.stationRepairs.chart,
    },
  ];
}

export function evaluateAct4Objectives(state: SurvivalState): ObjectiveStep[] {
  const b = state.boat;
  const v = state.voyage;
  return [
    {
      id: 'act4_keel',
      act: 4,
      title: `Boat Stage 1: ${BOAT_STAGE_DEFS.keel_hull.name}`,
      detail:
        'Visit the Southern Boat Slipway Dock beside Flight 404 Beach ([E]) and build the timber hull with pitch resin.',
      progressText: b.keel_hull ? 'Built' : 'Stage 1/4',
      completed: b.keel_hull,
    },
    {
      id: 'act4_sail',
      act: 4,
      title: `Boat Stage 2: ${BOAT_STAGE_DEFS.mast_sail.name}`,
      detail:
        'Rig the wooden spar mast with Abandoned Camp canvas cloth, rope, and alloy fittings at the Dock.',
      progressText: b.mast_sail ? 'Rigged' : 'Stage 2/4',
      completed: b.mast_sail,
    },
    {
      id: 'act4_engine',
      act: 4,
      title: `Boat Stage 3: ${BOAT_STAGE_DEFS.outboard_engine.name}`,
      detail:
        'Install forged ingots, scrap metal, cave copper wire, and an avionics circuit board at the Boat Slipway.',
      progressText: b.outboard_engine ? 'Mounted' : 'Stage 3/4',
      completed: b.outboard_engine,
    },
    {
      id: 'act4_provisions',
      act: 4,
      title: `Boat Stage 4: ${BOAT_STAGE_DEFS.nav_provisions.name}`,
      detail:
        'Load diesel fuel, sterilized water bottles, and 3x preserved rations, then Cast Off — be ready to face The Aura King!',
      progressText: b.nav_provisions ? 'Stocked' : 'Stage 4/4',
      completed: b.nav_provisions,
    },
    {
      id: 'act4_boss_shore',
      act: 4,
      title: 'Confront The Aura King',
      detail:
        'Attempt to launch from the Boat Slipway and shatter the Aura King’s reef shield to force your escape across the storm.',
      progressText: state.boss?.defeated
        ? 'Vanquished'
        : state.boss?.phase === 3
          ? 'Pursuit at Sea'
          : `${Math.round((state.boss?.hp ?? 1) / Math.max(1, state.boss?.maxHp ?? 1) * 100)}% HP`,
      completed: state.boss?.defeated || v.distanceNm >= VOYAGE.FINAL_ACT5_NM || state.escapedCity,
    },
  ];
}

export function evaluateAct5Objectives(state: SurvivalState): ObjectiveStep[] {
  const v = state.voyage;
  const defeatedBoss = Boolean(state.boss?.defeated || state.flags?.boss_lavans_defeated);
  return [
    {
      id: 'act5_boss_storm',
      act: 5,
      title: 'Defeat The Aura King on the Escape Boat',
      detail:
        'Weather the roaring storm on deck, strike with Flare Gun, Fire Bombs, and Heavy Attacks, and break the Aura King forever!',
      progressText: defeatedBoss
        ? 'Aura Shattered'
        : `${Math.round((state.boss?.hp ?? 1) / Math.max(1, state.boss?.maxHp ?? 1) * 100)}% HP`,
      completed: defeatedBoss || state.escapedCity,
    },
    {
      id: 'act5_city_harbor',
      act: 5,
      title: 'Sail to Port Solis Harbor at Sunrise',
      detail:
        'With the storm cleared and the island freed, guide the vessel into the glowing mainland city harbor.',
      progressText: state.escapedCity ? 'Arrived!' : `${v.distanceNm.toFixed(1)} / 12.0 nm`,
      completed: state.escapedCity,
    },
  ];
}

export function evaluateObjectivesForAct(
  state: SurvivalState,
  act: SurvivalState['act'] = state.act
): ObjectiveStep[] {
  if (act <= 1) return evaluateAct1Objectives(state);
  if (act === 2) return evaluateAct2Objectives(state);
  if (act === 3) return evaluateAct3Objectives(state);
  if (act === 4) return evaluateAct4Objectives(state);
  return evaluateAct5Objectives(state);
}

export function getActLabel(act: SurvivalState['act']): string {
  switch (act) {
    case 1:
      return 'Act 1 — Washed Ashore';
    case 2:
      return 'Act 2 — Making Camp';
    case 3:
      return 'Act 3 — Secrets of the Island';
    case 4:
      return 'Act 4 — The Escape';
    case 5:
      return 'Act 5 — Reaching the City';
  }
}

export function computeCurrentAct(state: SurvivalState): SurvivalState['act'] {
  if (state.escapedCity || state.voyage.distanceNm >= VOYAGE.FINAL_ACT5_NM) {
    return Math.max(state.act, 5) as SurvivalState['act'];
  }
  if (
    state.stationRepairs.radio &&
    state.stationRepairs.generator &&
    state.stationRepairs.chart
  ) {
    return Math.max(state.act, 4) as SurvivalState['act'];
  }

  const zone = getZoneAt(state.player.x, state.player.z);
  const enteredAct3Area =
    zone === 'basalt_caves' ||
    zone === 'ancient_ruins' ||
    zone === 'research_station' ||
    state.cluesFound.some((id) =>
      ['clue_cave_note', 'clue_ruins_tablet', 'clue_station_log'].includes(id)
    ) ||
    state.unlockedGates.includes('gate_research_station');

  if (enteredAct3Area) {
    return Math.max(state.act, 3) as SurvivalState['act'];
  }

  const enteredInterior =
    state.unlockedGates.some((g) => g !== 'gate_research_station') ||
    state.player.z < WORLD.ACT1_RIDGE_Z - 4;
  if (enteredInterior) {
    return Math.max(state.act, 2) as SurvivalState['act'];
  }

  return Math.max(state.act, 1) as SurvivalState['act'];
}

export function getCurrentObjective(steps: ObjectiveStep[]): ObjectiveStep | null {
  return steps.find((s) => !s.completed) ?? (steps.length > 0 ? steps[steps.length - 1] : null);
}

export interface SurvivalMilestone {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
}

/** Computes Part 5 survivor milestones for the Journal & Death Summary screen. */
export function computeMilestones(state: SurvivalState): SurvivalMilestone[] {
  const f = state.flags ?? {};
  return [
    {
      id: 'ms_first_fire',
      title: 'Spark in the Dark',
      description: 'Built and lit your first Stone Ring Campfire.',
      unlocked: state.campfires.length > 0 || Boolean(f.cooked_boil_water),
    },
    {
      id: 'ms_clean_water',
      title: 'Safe to Drink',
      description: 'Boiled clean water or drank safely from the Freshwater Spring.',
      unlocked: Boolean(f.cooked_boil_water || f.drank_water_bottle_clean),
    },
    {
      id: 'ms_shelter',
      title: 'Home Under the Palms',
      description: 'Built a Palm Lean-To Shelter to guard against storms.',
      unlocked: state.shelters.length > 0,
    },
    {
      id: 'ms_crash_clue',
      title: 'Flight 404 Black Box',
      description: 'Examined the crash wreckage manifest & distress logs.',
      unlocked: state.cluesFound.includes('clue_crash_manifest'),
    },
    {
      id: 'ms_cave_ruins',
      title: 'Beneath the Basalt',
      description: 'Explored the Basalt Caves and Ancient Ruins.',
      unlocked:
        state.unlockedGates.includes('gate_north_pass') ||
        state.cluesFound.some((c) => c === 'clue_cave_note' || c === 'clue_ruins_tablet'),
    },
    {
      id: 'ms_station',
      title: 'Signal Restored',
      description: 'Repaired systems at the Abandoned Research Station.',
      unlocked:
        Boolean(state.stationRepairs?.radio) ||
        Boolean(state.stationRepairs?.generator) ||
        Boolean(state.stationRepairs?.chart),
    },
    {
      id: 'ms_crafter',
      title: 'Island Engineer',
      description: 'Crafted 10 or more tools, structures, or survival supplies.',
      unlocked: state.stats.itemsCrafted >= 10,
    },
    {
      id: 'ms_survivor_3',
      title: 'Three Dawn Veteran',
      description: 'Survived to Day 3 or beyond on the island.',
      unlocked: state.clock.day >= 3,
    },
    {
      id: 'ms_harbor',
      title: 'Open Horizon',
      description: 'Built the Escape Boat or reached Port Solis.',
      unlocked: state.escapedCity || state.act >= 5,
    },
    {
      id: 'ms_dethroned',
      title: 'Dethroned the Aura King',
      description: 'Defeated The Aura King in battle and broke the storm gripping the island.',
      unlocked: Boolean(state.boss?.defeated || state.flags?.boss_lavans_defeated),
    },
  ];
}
