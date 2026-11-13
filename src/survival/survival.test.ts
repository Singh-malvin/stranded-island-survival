import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_BUILDING, BOAT, NEEDS, NODE_RESPAWN_HOURS, TIME, VOYAGE, WORLD } from './config.ts';
import {
  addItem,
  countItem,
  createEmptyInventory,
  damageSlotDurability,
  removeItem,
  swapSlots,
} from './items.ts';
import { checkRecipeAvailability, craftRecipeById, RECIPES } from './recipes.ts';
import {
  advanceClock,
  applyFallDamage,
  computeAmbientTempC,
  computeTargetBodyTempC,
  consumeInventorySlot,
  interactFreshwaterSpring,
  respawnAtLastBed,
  stepWeather,
  tickNeeds,
} from './needs.ts';
import {
  createInitialSurvivalState,
  generateIslandNodes,
  hitGatherNode,
  isNodeAvailable,
  tickNodeRespawns,
} from './gathering.ts';
import {
  classifyStepSurface,
  getZoneAt,
  ISLAND_GATES,
  resolveWorldMovement,
  revealMapAround,
  sampleIslandHeight,
  tryUnlockGate,
} from './world.ts';
import {
  computeCurrentAct,
  discoverClue,
  evaluateAct1Objectives,
  evaluateAct2Objectives,
  evaluateAct3Objectives,
  getCurrentObjective,
  repairStationSystem,
  STATION_REPAIR_DEFS,
  STORY_CLUES,
} from './quests.ts';
import {
  parseAndMigrateSave,
  serializeSave,
  sleepAtShelter,
} from './save.ts';
import { attackWildlife, generateInitialWildlife, tickWildlifeAI } from './wildlife.ts';
import {
  anchorRestAtStop,
  BOAT_STAGE_ORDER,
  buildBoatStage,
  canBuildBoatStage,
  computeSeaWeatherForLeg,
  countBoatStagesComplete,
  isBoatReadyToLaunch,
  launchEscapeVoyage,
  refuelVoyageFromPack,
  repairVoyageHull,
  resumeVoyageLeg,
  scavengeVoyageStop,
  setVoyageThrottle,
  tickVoyage,
} from './voyage.ts';
import {
  getNearbyStations,
  interactWithStructure,
  performSpearfishing,
  placeStructure,
  tickStructuresProduction,
  transferChestSlot,
} from './structures.ts';
import {
  GRAPHICS_PRESETS,
  isValidGraphicsQuality,
  loadGraphicsQuality,
} from '../scene/GraphicsConfig.ts';

describe('Stage 2 — Core Survival Systems', () => {
  it('advances day/night clock according to configured daylight and night durations', () => {
    const start = { day: 1, hour: TIME.DAY_START_HOUR, totalHours: 0 };
    // Full 14h daylight in DAYLIGHT_REAL_MINUTES * 60 seconds
    const afterDay = advanceClock(start, TIME.DAYLIGHT_REAL_MINUTES * 60);
    assert.ok(Math.abs(afterDay.clock.hour - TIME.NIGHT_START_HOUR) < 0.01);
    assert.equal(afterDay.clock.day, 1);

    // Full 10h night in NIGHT_REAL_MINUTES * 60 seconds rolls into Day 2 at 06:00
    const afterNight = advanceClock(afterDay.clock, TIME.NIGHT_REAL_MINUTES * 60);
    assert.equal(afterNight.clock.day, 2);
    assert.ok(Math.abs(afterNight.clock.hour - TIME.DAY_START_HOUR) < 0.05);
  });

  it('models diurnal ambient temperature and campfire recovery from night chill', () => {
    const clear = { kind: 'clear' as const, rain: 0, wind: 0.1 };
    const storm = { kind: 'storm' as const, rain: 0.9, wind: 0.85 };

    const preDawnC = computeAmbientTempC({ day: 1, hour: 4, totalHours: 0 }, clear);
    const afternoonC = computeAmbientTempC({ day: 1, hour: 15, totalHours: 0 }, clear);
    const stormNightC = computeAmbientTempC({ day: 1, hour: 3, totalHours: 0 }, storm);

    assert.ok(afternoonC > preDawnC + 12, `Expected warm afternoon (${afternoonC}) > pre-dawn (${preDawnC})`);
    assert.ok(stormNightC < preDawnC - 5, `Expected storm night (${stormNightC}) colder than clear night`);

    // Wet survivor in a night storm without fire drops toward hypothermia
    const exposedTarget = computeTargetBodyTempC(
      stormNightC,
      {
        isMoving: false,
        isSprinting: false,
        isSwimming: false,
        nearFire: false,
        sheltered: false,
        holdingLitTorch: false,
      },
      90
    );
    assert.ok(exposedTarget < 35.0, `Expected hypothermia target in wet night storm, got ${exposedTarget}`);

    // Standing beside a campfire restores body temp target back to normal 37.0°C
    const fireTarget = computeTargetBodyTempC(
      stormNightC,
      {
        isMoving: false,
        isSprinting: false,
        isSwimming: false,
        nearFire: true,
        sheltered: false,
        holdingLitTorch: false,
      },
      20
    );
    assert.equal(fireTarget, 37.0);
  });

  it('drains hunger, thirst, and stamina at balanced rates and triggers death at 0 health', () => {
    const state = createInitialSurvivalState('survivor');
    const clear = state.weather;

    // 60 seconds of walking should drain only a few points of hunger & thirst (never punishing)
    const walkRes = tickNeeds(
      state.needs,
      60,
      25,
      clear,
      {
        isMoving: true,
        isSprinting: false,
        isSwimming: false,
        nearFire: false,
        sheltered: false,
        holdingLitTorch: false,
      },
      'survivor'
    );
    assert.ok(walkRes.needs.hunger > state.needs.hunger - 4);
    assert.ok(walkRes.needs.thirst > state.needs.thirst - 6);
    assert.equal(walkRes.died, false);

    // Dehydrated + starving + hypothermic survivor eventually dies with cause reported
    const fatalRes = tickNeeds(
      { ...state.needs, health: 2, hunger: 0, thirst: 0, temperature: 33.5 },
      60,
      10,
      clear,
      {
        isMoving: false,
        isSprinting: false,
        isSwimming: false,
        nearFire: false,
        sheltered: false,
        holdingLitTorch: false,
      },
      'survivor'
    );
    assert.equal(fatalRes.died, true);
    assert.ok(fatalRes.causeOfDeath);
  });

  it('stacks inventory items, tracks tool durability, and preserves tools on respawn', () => {
    let inv = createEmptyInventory();
    inv = addItem(inv, 'stick', 20).inventory;
    inv = addItem(inv, 'stick', 15).inventory; // 30 in slot 0, 5 in slot 1
    inv = addItem(inv, 'stone_axe', 1).inventory;

    assert.equal(countItem(inv, 'stick'), 35);
    assert.equal(inv[0]?.count, 30);
    assert.equal(inv[1]?.count, 5);
    assert.equal(inv[2]?.itemId, 'stone_axe');
    assert.ok((inv[2]?.durability ?? 0) > 10);

    // Swap slots
    inv = swapSlots(inv, 0, 2);
    assert.equal(inv[0]?.itemId, 'stone_axe');

    // Damage tool until it breaks
    const broken = damageSlotDurability(inv, 0, 999);
    assert.equal(broken.broke, true);
    assert.equal(broken.inventory[0], null);

    // Respawn keeps tools and trims only 25% of raw resource stacks
    let s = createInitialSurvivalState();
    s.inventory = addItem(s.inventory, 'stone_axe', 1).inventory;
    s.inventory = addItem(s.inventory, 'stick', 20).inventory;
    s.needs.health = 0;
    s.alive = false;

    const respawned = respawnAtLastBed(s);
    assert.equal(respawned.alive, true);
    assert.equal(countItem(respawned.inventory, 'stone_axe'), 1);
    assert.equal(countItem(respawned.inventory, 'stick'), 15);
    assert.equal(respawned.stats.deaths, 1);
  });

  it('crafts primitive tools and gates cooking/workbench recipes by nearby station', () => {
    let inv = createEmptyInventory();
    inv = addItem(inv, 'fibre', 4).inventory;
    inv = addItem(inv, 'stick', 4).inventory;
    inv = addItem(inv, 'flint', 2).inventory;
    inv = addItem(inv, 'raw_fish', 1).inventory;

    const noStations = new Set<'hands' | 'campfire' | 'workbench' | 'forge'>(['hands']);

    // Craft rope in hands
    const ropeRes = craftRecipeById('rope_fibre', inv, noStations);
    assert.equal(ropeRes.ok, true);
    inv = ropeRes.inventory;
    assert.equal(countItem(inv, 'rope'), 1);

    // Craft stone hatchet in hands
    const axeRes = craftRecipeById('stone_axe', inv, noStations);
    assert.equal(axeRes.ok, true);
    inv = axeRes.inventory;
    assert.equal(countItem(inv, 'stone_axe'), 1);

    // Cooking fish without a campfire nearby is blocked
    const cookBlocked = craftRecipeById('cook_fish', inv, noStations);
    assert.equal(cookBlocked.ok, false);

    // With a campfire nearby, cooking fish succeeds
    const withFire = new Set<'hands' | 'campfire' | 'workbench' | 'forge'>(['hands', 'campfire']);
    const cookOk = craftRecipeById('cook_fish', inv, withFire);
    assert.equal(cookOk.ok, true);
    assert.equal(countItem(cookOk.inventory, 'cooked_fish'), 1);

    // Workbench recipe is blocked without workbench
    const wbCheck = checkRecipeAvailability(
      {
        id: 'plank',
        name: 'Plank',
        tier: 2,
        station: 'workbench',
        result: { itemId: 'plank', count: 2 },
        ingredients: [{ itemId: 'log', count: 1 }],
        description: '',
      },
      addItem(inv, 'log', 2).inventory,
      noStations
    );
    assert.equal(wbCheck.stationOk, false);
    assert.equal(wbCheck.canCraft, false);
  });

  it('handles food consumption, raw food sickness risk, and freshwater bottle filling', () => {
    let state = createInitialSurvivalState();
    state.needs.hunger = 40;
    state.needs.thirst = 40;
    state.inventory = addItem(state.inventory, 'raw_meat', 1).inventory;
    state.inventory = addItem(state.inventory, 'empty_bottle', 1).inventory;

    // Eating raw meat with low RNG roll triggers food poisoning
    const eatRaw = consumeInventorySlot(state, 0, () => 0.1);
    assert.equal(eatRaw.consumed, true);
    assert.equal(eatRaw.gotSick, true);
    assert.ok(eatRaw.state.needs.sickness > 0);

    // Interacting with freshwater spring while carrying an empty bottle fills it
    const fillRes = interactFreshwaterSpring(eatRaw.state, () => 0.9);
    assert.equal(countItem(fillRes.state.inventory, 'water_bottle_dirty'), 1);
    assert.equal(countItem(fillRes.state.inventory, 'empty_bottle'), 0);
  });

  it('enforces tool requirements on palm trees and respawns renewable nodes over time', () => {
    let state = createInitialSurvivalState();
    const nodes = generateIslandNodes();
    const palm = nodes.find((n) => n.type === 'palm_tree')!;
    const bush = nodes.find((n) => n.type === 'fibre_bush')!;

    // Bare-handed hit on palm tree is blocked
    const blocked = hitGatherNode(state, palm);
    assert.equal(blocked.hit, false);
    assert.equal(blocked.sound, 'blocked');

    // Bare-handed harvest of fibre bush succeeds in 2 hits
    const h1 = hitGatherNode(state, bush);
    assert.equal(h1.hit, true);
    assert.equal(h1.depleted, false);
    const h2 = hitGatherNode(h1.state, bush);
    assert.equal(h2.depleted, true);
    assert.ok(countItem(h2.state.inventory, 'fibre') >= 2);
    assert.equal(isNodeAvailable(bush.id, h2.state.nodes, h2.state.clock.totalHours), false);

    // After respawn hours elapse, the bush becomes available again
    const futureHours = h2.state.clock.totalHours + 25;
    const tickedNodes = tickNodeRespawns(h2.state.nodes, futureHours);
    assert.equal(isNodeAvailable(bush.id, tickedNodes, futureHours), true);

    // Equipping a Stone Hatchet allows chopping down the palm tree
    state = h2.state;
    state.inventory = addItem(state.inventory, 'stone_axe', 1).inventory;
    const axeSlot = state.inventory.findIndex((s) => s?.itemId === 'stone_axe');
    state.selectedSlot = axeSlot;

    let chopState = state;
    for (let i = 0; i < 4; i++) {
      chopState.needs.stamina = 100;
      const res = hitGatherNode(chopState, palm);
      chopState = res.state;
      if (res.depleted) break;
    }
    assert.ok(countItem(chopState.inventory, 'log') >= 2);
  });
});

describe('Stage 3 — Act 1 World, Objectives, Fog-of-War & Save System', () => {
  it('sculpts a walkable Act 1 cove and physically blocks northern ridge passes until unlocked', () => {
    const spawnH = sampleIslandHeight(WORLD.PLAYER_SPAWN.x, WORLD.PLAYER_SPAWN.z);
    const wreckH = sampleIslandHeight(WORLD.WRECK_POS.x, WORLD.WRECK_POS.z);
    const springH = sampleIslandHeight(WORLD.SPRING_POS.x, WORLD.SPRING_POS.z);

    assert.ok(spawnH > WORLD.WATER_LEVEL && spawnH < 5);
    assert.ok(wreckH > WORLD.WATER_LEVEL && wreckH < 6);
    assert.ok(springH > WORLD.WATER_LEVEL);
    assert.equal(getZoneAt(WORLD.PLAYER_SPAWN.x, WORLD.PLAYER_SPAWN.z), 'crash_beach');
    assert.equal(getZoneAt(WORLD.SPRING_POS.x, WORLD.SPRING_POS.z), 'fresh_spring');

    // Attempting to walk across the central banyan pass without unlocking fails
    const blocked = resolveWorldMovement(0, WORLD.ACT1_RIDGE_Z + 3, 0, WORLD.ACT1_RIDGE_Z - 4, []);
    assert.ok(blocked.z >= WORLD.ACT1_RIDGE_Z + 1.0);
    assert.ok(blocked.blockedByGate !== null);

    // Unlocking the banyan gate opens the pass north into the interior jungle
    const unlocked = resolveWorldMovement(
      0,
      WORLD.ACT1_RIDGE_Z + 3,
      0,
      WORLD.ACT1_RIDGE_Z - 3,
      ['gate_jungle_vines']
    );
    assert.ok(unlocked.z < WORLD.ACT1_RIDGE_Z);
    assert.equal(unlocked.blockedByGate, null);
  });

  it('reveals fog-of-war map cells incrementally as the player explores', () => {
    const startCells = revealMapAround([], WORLD.PLAYER_SPAWN.x, WORLD.PLAYER_SPAWN.z);
    assert.ok(startCells.length > 0);
    const unchanged = revealMapAround(startCells, WORLD.PLAYER_SPAWN.x, WORLD.PLAYER_SPAWN.z);
    assert.equal(unchanged, startCells); // same reference when nothing new discovered

    const afterWalk = revealMapAround(startCells, -28, 54);
    assert.ok(afterWalk.length > startCells.length);
  });

  it('tracks Act 1 story clues, shelter crafting, and objective progression', () => {
    let state = createInitialSurvivalState();
    const initialObjs = evaluateAct1Objectives(state);
    assert.equal(getCurrentObjective(initialObjs)?.id, 'act1_wreck');

    // Inspect manifest clue
    const clueRes = discoverClue(state, STORY_CLUES[0].id);
    assert.equal(clueRes.newlyFound, true);
    state = clueRes.state;
    assert.equal(getCurrentObjective(evaluateAct1Objectives(state))?.id, 'act1_tools');

    // Craft shelter kit requires tier-1 ingredients in hands
    let inv = createEmptyInventory();
    inv = addItem(inv, 'log', 4).inventory;
    inv = addItem(inv, 'palm_frond', 6).inventory;
    inv = addItem(inv, 'rope', 2).inventory;
    inv = addItem(inv, 'stick', 4).inventory;
    const shelterCraft = craftRecipeById('shelter_kit', inv, new Set(['hands']));
    assert.equal(shelterCraft.ok, true);
    assert.equal(countItem(shelterCraft.inventory, 'shelter_kit'), 1);
  });

  it('serializes saves, migrates Stage 2 saves, and advances overnight on shelter sleep', () => {
    let state = createInitialSurvivalState();
    state.clock = { day: 1, hour: 21.5, totalHours: 14.5 };
    state.needs.health = 50;
    state.needs.wetness = 70;
    state.inventory = addItem(state.inventory, 'stone_axe', 1).inventory;
    const shelter = { id: 'shelter_1', x: -3, y: 2.1, z: 54, yaw: 0, builtDay: 1 };
    state.shelters = [shelter];

    // Sleep advances to morning Day 2 at WAKE_HOUR, heals health, updates spawnPoint & 'bed' stamp
    const slept = sleepAtShelter(state, shelter, 123456);
    assert.equal(slept.state.clock.day, 2);
    assert.equal(slept.state.clock.hour, TIME.WAKE_HOUR);
    assert.ok(slept.state.needs.health > 50);
    assert.equal(slept.state.lastSaveKind, 'bed');
    assert.equal(slept.state.spawnPoint.x, -3);

    // Round-trip save/load preserves everything
    const json = serializeSave(slept.state, 'bed', 123456);
    const loaded = parseAndMigrateSave(json);
    assert.ok(loaded !== null);
    assert.equal(loaded!.clock.day, 2);
    assert.equal(loaded!.shelters.length, 1);
    assert.equal(countItem(loaded!.inventory, 'stone_axe'), 1);

    // Migrating a Stage 2 save (missing shelters/cluesFound/unlockedGates/discoveredCells) fills defaults
    const legacyObj = JSON.parse(json) as Record<string, unknown>;
    delete legacyObj.shelters;
    delete legacyObj.cluesFound;
    delete legacyObj.unlockedGates;
    delete legacyObj.discoveredCells;
    const migrated = parseAndMigrateSave(JSON.stringify(legacyObj));
    assert.ok(migrated !== null);
    assert.deepEqual(migrated!.shelters, []);
    assert.ok(migrated!.discoveredCells.length > 0);
  });
});

describe('Stage 4 — Base Building, Farming, Fishing, Traps, Water & Storage', () => {
  it('places base structures, validates surface types, and unlocks Workbench/Forge stations', () => {
    let state = createInitialSurvivalState();
    state.inventory = addItem(state.inventory, 'log', 12).inventory;
    state.inventory = addItem(state.inventory, 'stick', 16).inventory;
    state.inventory = addItem(state.inventory, 'rope', 10).inventory;
    state.inventory = addItem(state.inventory, 'stone', 16).inventory;
    state.inventory = addItem(state.inventory, 'flint', 6).inventory;
    state.inventory = addItem(state.inventory, 'shell', 4).inventory;

    // Workbench requires dry land
    const badWb = placeStructure(state, 'workbench', 0, -0.5, 80, 0);
    assert.equal(badWb.ok, false);

    const okWb = placeStructure(state, 'workbench', 2, 1.8, 60, 0, 'wb_1');
    assert.equal(okWb.ok, true);
    state = okWb.state;

    // Fish trap requires shallow coastal water
    const badFish = placeStructure(state, 'fish_trap', 2, 2.0, 60, 0);
    assert.equal(badFish.ok, false);

    const okFish = placeStructure(state, 'fish_trap', 2, WORLD.WATER_LEVEL - 0.25, 74, 0, 'ft_1');
    assert.equal(okFish.ok, true);
    state = okFish.state;

    // Nearby stations includes workbench when player stands next to it
    state.player = { x: 2.5, y: 1.8, z: 60.5, yaw: 0 };
    const stationsNear = getNearbyStations(state);
    assert.equal(stationsNear.has('workbench'), true);
    assert.equal(stationsNear.has('forge'), false);

    // Tier-2 craft (plank) succeeds next to workbench
    const plankRes = craftRecipeById('plank', state.inventory, stationsNear);
    assert.equal(plankRes.ok, true);
    assert.equal(countItem(plankRes.inventory, 'plank'), 2);
  });

  it('simulates rainwater collection (faster in rain), farming, traps, drying racks, and chest transfer', () => {
    let state = createInitialSurvivalState();
    state.inventory = addItem(state.inventory, 'log', 10).inventory;
    state.inventory = addItem(state.inventory, 'stick', 25).inventory;
    state.inventory = addItem(state.inventory, 'palm_frond', 12).inventory;
    state.inventory = addItem(state.inventory, 'shell', 6).inventory;
    state.inventory = addItem(state.inventory, 'rope', 12).inventory;
    state.inventory = addItem(state.inventory, 'fibre', 10).inventory;
    state.inventory = addItem(state.inventory, 'berries', 2).inventory;
    state.inventory = addItem(state.inventory, 'empty_bottle', 1).inventory;

    state = placeStructure(state, 'water_collector', 0, 1.5, 58, 0, 'wc_1').state;
    state = placeStructure(state, 'farm_plot', 3, 1.5, 58, 0, 'fp_1').state;
    state = placeStructure(state, 'snare_trap', 6, 1.5, 58, 0, 'st_1').state;
    state = placeStructure(state, 'drying_rack', 9, 1.5, 58, 0, 'dr_1').state;
    state = placeStructure(state, 'storage_chest', 12, 1.5, 58, 0, 'ch_1').state;

    // Plant 1x berry in farm plot
    const plantRes = interactWithStructure(state, 'fp_1', { kind: 'clear', rain: 0, wind: 0.15 });
    state = plantRes.state;
    assert.equal(countItem(state.inventory, 'berries'), 1);

    // Rain storm accelerates water collector & ripens farm & springs trap across 12 in-game hours
    const storm = { kind: 'storm' as const, rain: 0.9, wind: 0.85 };
    const produced = tickStructuresProduction(state.structures, 12, storm);
    state = { ...state, structures: produced };

    const wc = state.structures.find((s) => s.id === 'wc_1')!;
    assert.ok((wc.waterDoses ?? 0) >= 2);

    // Collect clean water into empty bottle
    const waterRes = interactWithStructure(state, 'wc_1', storm);
    state = waterRes.state;
    assert.equal(countItem(state.inventory, 'water_bottle_clean'), 1);

    // Harvest ripe berries (+4 berries, +2 fibre)
    const harvestRes = interactWithStructure(state, 'fp_1', storm);
    state = harvestRes.state;
    assert.equal(countItem(state.inventory, 'berries'), 5);

    // Collect caught raw_meat from snare & hang on drying rack -> cure into dried_meat
    const snareRes = interactWithStructure(state, 'st_1', storm);
    state = snareRes.state;
    assert.equal(countItem(state.inventory, 'raw_meat'), 1);

    const hangRes = interactWithStructure(state, 'dr_1', storm);
    state = hangRes.state;
    assert.equal(countItem(state.inventory, 'raw_meat'), 0);

    state = {
      ...state,
      structures: tickStructuresProduction(state.structures, 6, { kind: 'clear', rain: 0, wind: 0.15 }),
    };
    const cureRes = interactWithStructure(state, 'dr_1', { kind: 'clear', rain: 0, wind: 0.15 });
    state = cureRes.state;
    assert.equal(countItem(state.inventory, 'dried_meat'), 1);

    // Transfer cured meat into storage chest slot and back
    const bagSlotIdx = state.inventory.findIndex((s) => s?.itemId === 'dried_meat');
    state = transferChestSlot(state, 'ch_1', false, bagSlotIdx);
    assert.equal(countItem(state.inventory, 'dried_meat'), 0);
    const chest = state.structures.find((s) => s.id === 'ch_1')!;
    assert.equal(chest.storage?.[0]?.itemId, 'dried_meat');

    state = transferChestSlot(state, 'ch_1', true, 0);
    assert.equal(countItem(state.inventory, 'dried_meat'), 1);
  });

  it('requires equipped spear for lagoon spearfishing and consumes durability', () => {
    let state = createInitialSurvivalState();
    const failNoSpear = performSpearfishing(state);
    assert.equal(failNoSpear.caught, false);

    state.inventory = addItem(state.inventory, 'spear', 1).inventory;
    state.selectedSlot = 0;
    const beforeDur = state.inventory[0]!.durability!;
    const okFish = performSpearfishing(state);
    assert.equal(okFish.caught, true);
    assert.equal(countItem(okFish.state.inventory, 'raw_fish'), 1);
    assert.equal(okFish.state.inventory[0]!.durability, beforeDur - 1);
  });
});

describe('Stage 5 — Spread World, Fall Damage, Gates, Wildlife AI & Act 3 Station Repairs', () => {
  it('places landmarks cleanly across the 260m island biomes and applies fall damage above safe threshold', () => {
    assert.equal(WORLD.ISLAND_RADIUS, 260);
    assert.equal(getZoneAt(WORLD.PLAYER_SPAWN.x, WORLD.PLAYER_SPAWN.z), 'crash_beach');
    assert.equal(getZoneAt(WORLD.CAVE_GROTTO_POS.x, WORLD.CAVE_GROTTO_POS.z), 'basalt_caves');
    assert.equal(getZoneAt(WORLD.ANCIENT_RUINS_POS.x, WORLD.ANCIENT_RUINS_POS.z), 'ancient_ruins');
    assert.equal(
      getZoneAt(WORLD.RESEARCH_STATION_POS.x, WORLD.RESEARCH_STATION_POS.z),
      'research_station'
    );

    // Safe drop (<3.8m) causes 0 damage; 7.8m drop deals damage
    const s0 = createInitialSurvivalState();
    const startHp = s0.needs.health;
    const safeDrop = applyFallDamage(s0, 2.5);
    assert.equal(safeDrop.damage, 0);
    assert.equal(safeDrop.state.needs.health, startHp);

    const hardDrop = applyFallDamage(s0, 7.8);
    assert.ok(hardDrop.damage > 20);
    assert.equal(hardDrop.state.needs.health, startHp - hardDrop.damage);
  });

  it('gates inland passes behind crafted tools and grants station keycard at Ancient Ruins', () => {
    let state = createInitialSurvivalState();
    const centralGate = ISLAND_GATES.find((g) => g.id === 'gate_jungle_vines')!;
    const cliffsGate = ISLAND_GATES.find((g) => g.id === 'gate_west_cliffs')!;
    const stationGate = ISLAND_GATES.find((g) => g.id === 'gate_research_station')!;

    // Central Jungle barrier rejects bare hands
    const failCentral = tryUnlockGate(state, centralGate.id);
    assert.equal(failCentral.ok, false);

    // Crafting/holding Machete unlocks central pass
    state = { ...state, inventory: addItem(state.inventory, 'machete', 1).inventory };
    const openCentral = tryUnlockGate(state, centralGate.id);
    assert.equal(openCentral.ok, true);
    state = openCentral.state;
    assert.ok(state.unlockedGates.includes(centralGate.id));

    // Climbing gear unlocks Western Cliffs cleanly while keeping reusable rope gear
    state = { ...state, inventory: addItem(state.inventory, 'climbing_gear', 1).inventory };
    const openCliffs = tryUnlockGate(state, cliffsGate.id);
    assert.equal(openCliffs.ok, true);
    state = openCliffs.state;
    assert.ok(state.unlockedGates.includes(cliffsGate.id));
    assert.equal(countItem(state.inventory, 'climbing_gear'), 1);

    // Inspecting Ancient Ruins tablet grants station_keycard -> opens Research Station gate
    const ruinsRes = discoverClue(state, 'clue_ruins_tablet');
    assert.equal(ruinsRes.newlyFound, true);
    assert.ok(ruinsRes.itemGranted);
    state = ruinsRes.state;
    assert.equal(countItem(state.inventory, 'station_keycard'), 1);

    const openStation = tryUnlockGate(state, stationGate.id);
    assert.equal(openStation.ok, true);
    assert.equal(countItem(openStation.state.inventory, 'station_keycard'), 1);
  });

  it('simulates hostile wildlife attacks, venom cure via poultice, and hunting loot drops', () => {
    let state = createInitialSurvivalState();
    const initialWildlife = generateInitialWildlife(WORLD.SEED, WORLD.ISLAND_RADIUS);
    assert.ok(initialWildlife.length >= 12);

    const viper = state.wildlife.find((w) => w.kind === 'viper')!;
    assert.ok(viper);

    // Tick viper next to player with deterministic RNG (< venomChance) -> inflicts bite + venom
    const aiHit = tickWildlifeAI(
      [{ ...viper, attackCooldownSec: 0 }],
      { x: viper.x + 0.5, z: viper.z + 0.5 },
      12,
      0.5,
      false,
      'survivor',
      () => 0.1
    );
    assert.ok(aiHit.damageToPlayer > 0);
    assert.equal(aiHit.poisonedPlayer, true);

    // Poultice cures sickness and restores health
    state = {
      ...state,
      needs: { ...state.needs, health: 65, sickness: 60 },
      inventory: addItem(state.inventory, 'medicinal_poultice', 1).inventory,
    };
    const slotIdx = state.inventory.findIndex((s) => s?.itemId === 'medicinal_poultice');
    const healRes = consumeInventorySlot(state, slotIdx);
    assert.equal(healRes.consumed, true);
    assert.equal(healRes.state.needs.sickness, 0);
    assert.ok(healRes.state.needs.health > 65);

    // Hunting a crab with spear drops raw_meat + shell
    const crab = state.wildlife.find((w) => w.kind === 'crab')!;
    let huntState: typeof state = {
      ...state,
      inventory: addItem(createInitialSurvivalState().inventory, 'spear', 1).inventory,
      selectedSlot: 0,
    };
    const huntRes = attackWildlife(huntState, crab.id);
    assert.equal(huntRes.hit, true);
    assert.equal(huntRes.killed, true);
    assert.equal(countItem(huntRes.state.inventory, 'raw_meat'), 1);
    assert.equal(countItem(huntRes.state.inventory, 'shell'), 1);
  });

  it('repairs Research Station Radio, Generator, and Sea Chart in sequence, advancing to Act 4 & persisting across saves', () => {
    let state = createInitialSurvivalState();
    state = {
      ...state,
      unlockedGates: ['gate_jungle_vines', 'gate_west_cliffs', 'gate_research_station'],
      inventory: [
        'copper_wire',
        'copper_wire',
        'circuit_board',
        'fuel_can',
        'metal_ingot',
        'metal_ingot',
        'scrap_metal',
        'scrap_metal',
      ].reduce((inv, id) => addItem(inv, id as never, 1).inventory, state.inventory),
    };

    assert.equal(computeCurrentAct(state), 3);
    const act2Eval = evaluateAct2Objectives(state);
    assert.ok(act2Eval.length >= 4);

    // Chart cannot be calibrated before radio + generator
    const chartTooSoon = repairStationSystem(state, 'chart');
    assert.equal(chartTooSoon.ok, false);

    // Repair Radio & Generator, then Chart
    const rRadio = repairStationSystem(state, 'radio');
    assert.equal(rRadio.ok, true);
    const rGen = repairStationSystem(rRadio.state, 'generator');
    assert.equal(rGen.ok, true);
    const rChart = repairStationSystem(rGen.state, 'chart');
    assert.equal(rChart.ok, true);

    const finalState = { ...rChart.state, act: computeCurrentAct(rChart.state) };
    assert.equal(finalState.act, 4);
    assert.ok(
      evaluateAct3Objectives(finalState).some((s) => s.id === 'act3_chart_route' && s.completed)
    );

    // Save/load preserves stationRepairs & wildlife
    const serialized = serializeSave(finalState, 'autosave');
    const restored = parseAndMigrateSave(serialized)!;
    assert.equal(restored.stationRepairs.radio, true);
    assert.equal(restored.stationRepairs.generator, true);
    assert.equal(restored.stationRepairs.chart, true);
    assert.equal(restored.act, 4);
    assert.ok(restored.wildlife.length >= 12);
  });
});

describe('Stage 6 — Escape Boat Building, Sea Voyage & Port Solis Arrival', () => {
  it('builds the escape boat sequentially across 4 stages, sails through stopovers & storms to Port Solis (Act 4-5)', () => {
    let state = createInitialSurvivalState('survivor');
    // Cannot construct boat stages while still in Act < 4
    const earlyCheck = canBuildBoatStage(state, 'keel_hull');
    assert.equal(earlyCheck.ok, false);

    // Promote to Act 4 with repaired station and dockyard materials + mixed sea rations
    state = {
      ...state,
      act: 4,
      stationRepairs: { radio: true, generator: true, chart: true },
    };
    const grants: Array<[Parameters<typeof addItem>[1], number]> = [
      ['log', 8],
      ['plank', 12],
      ['rope', 12],
      ['resin', 6],
      ['stick', 8],
      ['cloth_scrap', 6],
      ['metal_ingot', 6],
      ['scrap_metal', 4],
      ['copper_wire', 2],
      ['circuit_board', 1],
      ['fuel_can', 2],
      ['water_bottle_clean', 2],
      ['dried_fish', 2],
      ['cooked_meat', 1],
    ];
    let inv = state.inventory;
    for (const [id, count] of grants) {
      inv = addItem(inv, id, count).inventory;
    }
    state = { ...state, inventory: inv };

    // Out-of-order stage blocked until Stage 1 finishes
    assert.equal(canBuildBoatStage(state, 'mast_sail').ok, false);

    const s1 = buildBoatStage(state, 'keel_hull');
    assert.equal(s1.ok, true);
    const s2 = buildBoatStage(s1.state, 'mast_sail');
    assert.equal(s2.ok, true);
    const s3 = buildBoatStage(s2.state, 'outboard_engine');
    assert.equal(s3.ok, true);
    const s4 = buildBoatStage(s3.state, 'nav_provisions');
    assert.equal(s4.ok, true);

    assert.equal(countBoatStagesComplete(s4.state.boat), 4);
    assert.equal(isBoatReadyToLaunch(s4.state.boat), true);
    assert.equal(countItem(s4.state.inventory, 'dried_fish'), 0);
    assert.equal(countItem(s4.state.inventory, 'cooked_meat'), 0);

    // Launch sea voyage toward Stop 1 (Shoal Cay)
    const launched = launchEscapeVoyage(s4.state);
    assert.equal(launched.ok, true);
    assert.equal(launched.state.voyage.phase, 'sailing');

    // Sail/motor Leg 1 until Shoal Cay anchor stopover
    let sailing = setVoyageThrottle(launched.state, 'motor');
    for (let i = 0; i < 40 && sailing.voyage.phase === 'sailing'; i++) {
      sailing = tickVoyage(sailing, 1.0).state;
    }
    assert.equal(sailing.voyage.phase, 'stopover');
    assert.equal(sailing.voyage.currentStopId, 'shoal_cay');
    assert.ok(sailing.voyage.fuelPct < 100);

    // Scavenge Shoal Cay once, second attempt blocked, rest warms & restores stamina
    sailing = {
      ...sailing,
      needs: { ...sailing.needs, stamina: 40, wetness: 60 },
    };
    const scav1 = scavengeVoyageStop(sailing);
    assert.equal(scav1.ok, true);
    const scav2 = scavengeVoyageStop(scav1.state);
    assert.equal(scav2.ok, false);
    const rested = anchorRestAtStop(scav1.state);
    assert.equal(rested.ok, true);
    assert.ok(rested.state.needs.stamina > 70);
    assert.ok(rested.state.needs.wetness < 60);

    // Hull repair & engine refuel from inventory during passage
    const damagedState = {
      ...rested.state,
      voyage: { ...rested.state.voyage, hullIntegrity: 62, fuelPct: 40 },
    };
    const patched = repairVoyageHull(damagedState);
    assert.equal(patched.ok, true);
    assert.ok(patched.state.voyage.hullIntegrity > 62);
    const refueled = refuelVoyageFromPack(patched.state);
    assert.equal(refueled.ok, true);
    assert.ok(refueled.state.voyage.fuelPct > 40);

    // Verify storm bracing lowers hull damage vs full sail/motor in Leg 4 storm
    assert.equal(computeSeaWeatherForLeg(4, 10.2).kind, 'storm');
    const stormSailState = {
      ...refueled.state,
      voyage: {
        ...refueled.state.voyage,
        phase: 'sailing' as const,
        legIndex: 4 as const,
        distanceNm: 10.2,
        targetNm: 12.0,
        hullIntegrity: 95,
        throttle: 'sail' as const,
      },
    };
    const drainSail = 95 - tickVoyage(stormSailState, 2.0).state.voyage.hullIntegrity;
    const drainBrace =
      95 - tickVoyage(setVoyageThrottle(stormSailState, 'brace'), 2.0).state.voyage.hullIntegrity;
    assert.ok(drainSail > 0 && drainBrace < drainSail * 0.5);

    // Resume from Shoal Cay, fast-forward to Port Solis arrival at 12.0 nm
    const leg2 = resumeVoyageLeg(refueled.state);
    assert.equal(leg2.ok, true);
    const finalApproaching = {
      ...leg2.state,
      voyage: {
        ...leg2.state.voyage,
        legIndex: 4 as const,
        distanceNm: 11.9,
        targetNm: 12.0,
        hullIntegrity: 85,
      },
    };
    const arrivedRes = tickVoyage(finalApproaching, 2.0);
    assert.equal(arrivedRes.reachedCity, true);
    assert.equal(arrivedRes.state.voyage.phase, 'arrived');
    assert.equal(arrivedRes.state.escapedCity, true);
    assert.equal(computeCurrentAct(arrivedRes.state), 5);

    // Shipwreck recovery keeps built boat stages back at dock
    const sinking = {
      ...stormSailState,
      voyage: { ...stormSailState.voyage, hullIntegrity: 0.5 },
    };
    const sunk = tickVoyage(sinking, 2.0);
    assert.equal(sunk.shipwrecked, true);
    assert.equal(sunk.state.alive, false);
    const recovered = respawnAtLastBed(sunk.state);
    assert.equal(recovered.alive, true);
    assert.equal(recovered.voyage.phase, 'docked');
    assert.equal(countBoatStagesComplete(recovered.boat), 4);

    // Save/load preserves Port Solis ending & boat state
    const serialized = serializeSave(arrivedRes.state, 'autosave');
    const loaded = parseAndMigrateSave(serialized)!;
    assert.equal(loaded.escapedCity, true);
    assert.equal(loaded.voyage.phase, 'arrived');
    assert.equal(countBoatStagesComplete(loaded.boat), 4);
  });
});

describe('Stage 7 — Graphics Quality Presets & Atmospheric Settings', () => {
  it('defines progressive Low / Medium / High presets with safe software-GL defaults', () => {
    assert.equal(isValidGraphicsQuality('low'), true);
    assert.equal(isValidGraphicsQuality('medium'), true);
    assert.equal(isValidGraphicsQuality('high'), true);
    assert.equal(isValidGraphicsQuality('ultra'), false);

    assert.equal(GRAPHICS_PRESETS.low.shadows, false);
    assert.equal(GRAPHICS_PRESETS.low.bloom, false);
    assert.equal(GRAPHICS_PRESETS.low.waterShader, false);

    assert.equal(GRAPHICS_PRESETS.medium.shadows, true);
    assert.equal(GRAPHICS_PRESETS.medium.shadowMapSize, 1024);
    assert.equal(GRAPHICS_PRESETS.medium.fireShadow, false);
    assert.equal(GRAPHICS_PRESETS.medium.waterShader, true);

    assert.equal(GRAPHICS_PRESETS.high.shadows, true);
    assert.equal(GRAPHICS_PRESETS.high.shadowMapSize, 2048);
    assert.equal(GRAPHICS_PRESETS.high.fireShadow, true);
    assert.equal(GRAPHICS_PRESETS.high.bloom, true);

    assert.equal(loadGraphicsQuality(true), 'low');
    assert.equal(loadGraphicsQuality(false), 'high');
  });
});

describe('Stage 8 — Surface Audio Classification & 3–4 Hour Pacing Gates', () => {
  it('classifies terrain, water, cave stone, grass, and timber surfaces accurately', () => {
    assert.equal(classifyStepSurface(0, 146, 1.3, false, true), 'wood');
    assert.equal(classifyStepSurface(0, 146, 0.1, true, false), 'water');
    assert.equal(
      classifyStepSurface(WORLD.BOAT_DOCK_POS.x, WORLD.BOAT_DOCK_POS.z, 1.5, false, false),
      'wood'
    );
    assert.equal(
      classifyStepSurface(WORLD.CAVE_GROTTO_POS.x, WORLD.CAVE_GROTTO_POS.z, 8.0, false, false),
      'stone'
    );
    assert.equal(
      classifyStepSurface(WORLD.PLAYER_SPAWN.x, WORLD.PLAYER_SPAWN.z, 1.2, false, false),
      'sand'
    );
    assert.equal(
      classifyStepSurface(WORLD.ABANDONED_CAMP_POS.x, WORLD.ABANDONED_CAMP_POS.z, 5.0, false, false),
      'grass'
    );
  });

  it('enforces multi-hour Act 1–5 progression bounds and prevents early skips', () => {
    const realMinPerDay = TIME.DAYLIGHT_REAL_MINUTES + TIME.NIGHT_REAL_MINUTES;
    assert.ok(realMinPerDay >= 16 && realMinPerDay <= 24);

    // Balanced drain rates: 20+ real min before thirst hits zero, 30+ before hunger hits zero
    assert.ok(100 / NEEDS.THIRST_DRAIN_PER_MIN >= 20);
    assert.ok(100 / NEEDS.HUNGER_DRAIN_PER_MIN >= 30);

    // Non-trivial respawn cooldowns & rare non-respawning copper ore + crash scrap
    assert.equal(NODE_RESPAWN_HOURS.copper_vein, null);
    assert.equal(NODE_RESPAWN_HOURS.tech_wreck, null);
    assert.ok((NODE_RESPAWN_HOURS.iron_vein ?? 0) >= 48);
    assert.ok((NODE_RESPAWN_HOURS.boulder ?? 0) >= 48);

    // Multi-act structural gates & tiered recipes prevent 5-minute completion
    assert.ok(ISLAND_GATES.length >= 4);
    assert.equal(Object.keys(STATION_REPAIR_DEFS).length, 3);
    assert.equal(BOAT_STAGE_ORDER.length, 4);
    assert.ok(RECIPES.some((r) => r.tier === 1));
    assert.ok(RECIPES.some((r) => r.tier === 2));
    assert.ok(RECIPES.some((r) => r.tier === 3));

    // Pacing estimator across Acts 1–5 (~180–240 real minutes target band)
    const islandTraversalCycles = (WORLD.ISLAND_RADIUS * 2) / 5.6 / 60; // minutes per cross-island hike
    const baseAndFarmDays =
      (BASE_BUILDING.FARM_GROW_HOURS * 2 +
        BASE_BUILDING.DRYING_CURE_HOURS * BOAT.SEA_RATION_COUNT +
        BASE_BUILDING.SNARE_CATCH_HOURS) /
      24;
    const gateAndGatherDays =
      1.8 + // Act 1: recovery, campfire, shelter, flint tools
      baseAndFarmDays + // Act 2: base automation, farming, rations, stone/metal tools
      ((NODE_RESPAWN_HOURS.iron_vein ?? 48) + BOAT.STAGE_BUILD_HOURS * BOAT_STAGE_ORDER.length) /
        24; // Act 3–4: interior caves/ruins/station + 4-stage hull build (~3.3 in-game days)

    const landMinutes =
      gateAndGatherDays * (realMinPerDay * 0.9) + islandTraversalCycles * 28;
    const voyageActiveMinutes =
      VOYAGE.TOTAL_DISTANCE_NM / VOYAGE.SAIL_SPEED_NM_PER_SEC / 60 + 28; // sailing legs, island stops, Act 5 squall & arrival
    const estimatedTotalMinutes = landMinutes + voyageActiveMinutes;

    assert.ok(
      estimatedTotalMinutes >= 175 && estimatedTotalMinutes <= 255,
      `Expected full Act 1–5 playthrough in 175–255m (~3–4h), got ${estimatedTotalMinutes.toFixed(1)}m`
    );
  });
});

describe('Stage 9 — Final Playtest & Debug Weather Override Controls', () => {
  it('supports cycling deterministic weather overrides and returning to automatic cycles', () => {
    const storm = stepWeather({ kind: 'clear', rain: 0, wind: 0.15, override: 'storm' }, 10);
    assert.equal(storm.kind, 'storm');
    assert.equal(storm.rain, 0.9);
    assert.equal(storm.override, 'storm');

    const rain = stepWeather({ ...storm, override: 'rain' }, 10);
    assert.equal(rain.kind, 'rain');
    assert.equal(rain.rain, 0.55);

    const auto = stepWeather({ ...rain, override: undefined }, 10);
    assert.equal(auto.override, undefined);
  });
});
