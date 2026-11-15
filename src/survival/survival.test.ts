import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_BUILDING,
  BOAT,
  BOSS_TUNING,
  COMBAT_TUNING,
  FORGE_TUNING,
  NEEDS,
  NODE_RESPAWN_HOURS,
  PART5_IMMERSION_TUNING,
  TEMPERATURE,
  TIME,
  VOYAGE,
  WATER,
  WORLD,
} from './config.ts';
import {
  applyPlayerDamageToBoss,
  destroyBossCrystal,
  detonateBossBarrel,
  getBossDifficultyConfig,
  getEquippedWeaponDamage,
  retryBossFromCheckpoint,
  setBossCombatPhase,
  startBossEncounter,
} from './boss.ts';
import {
  addItem,
  countItem,
  createEmptyInventory,
  damageSlotDurability,
  removeItem,
  swapSlots,
} from './items.ts';
import { checkRecipeAvailability, craftRecipeById, getRecipesUsingItem, RECIPES } from './recipes.ts';
import {
  advanceClock,
  applyFallDamage,
  computeAmbientTempC,
  computeTargetBodyTempC,
  consumeInventorySlot,
  drinkSeawater,
  getBodyTempStage,
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
  clampCameraClearance,
  canEnterStance,
  classifyStepSurface,
  getEffectiveWaterLevel,
  getOceanTideOffset,
  getZoneAt,
  ISLAND_GATES,
  resolveCollidersPushout,
  resolveWorldMovement,
  revealMapAround,
  sampleIslandHeight,
  tryUnlockGate,
  WORLD_LOW_CEILING_ZONES,
} from './world.ts';
import {
  computeCurrentAct,
  computeMilestones,
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
  collectForgeDriftwood,
  depositWoodToForge,
  getForgeQueue,
  getNearbyStations,
  interactWithStructure,
  performSpearfishing,
  placeStructure,
  tickForgeJobs,
  tickStructuresProduction,
  transferChestSlot,
} from './structures.ts';
import {
  DEFAULT_KEYBINDS,
  GRAPHICS_PRESETS,
  isValidGraphicsQuality,
  loadExtendedGraphicsSettings,
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
  it('defines progressive Low / Medium / High / Ultra presets with safe software-GL defaults', () => {
    assert.equal(isValidGraphicsQuality('low'), true);
    assert.equal(isValidGraphicsQuality('medium'), true);
    assert.equal(isValidGraphicsQuality('high'), true);
    assert.equal(isValidGraphicsQuality('ultra'), true);
    assert.equal(isValidGraphicsQuality('potato'), false);

    assert.equal(GRAPHICS_PRESETS.low.shadows, false);
    assert.equal(GRAPHICS_PRESETS.low.bloom, false);
    assert.equal(GRAPHICS_PRESETS.low.waterShader, false);
    assert.equal(GRAPHICS_PRESETS.low.pbrMaps, false);
    assert.equal(GRAPHICS_PRESETS.low.grassDensity, 0);

    assert.equal(GRAPHICS_PRESETS.medium.shadows, true);
    assert.equal(GRAPHICS_PRESETS.medium.shadowMapSize, 1024);
    assert.equal(GRAPHICS_PRESETS.medium.fireShadow, false);
    assert.equal(GRAPHICS_PRESETS.medium.waterShader, true);
    assert.equal(GRAPHICS_PRESETS.medium.pbrMaps, true);
    assert.equal(GRAPHICS_PRESETS.medium.smaa, true);

    assert.equal(GRAPHICS_PRESETS.high.shadows, true);
    assert.equal(GRAPHICS_PRESETS.high.shadowMapSize, 2048);
    assert.equal(GRAPHICS_PRESETS.high.csm, true);
    assert.equal(GRAPHICS_PRESETS.high.ssao, true);
    assert.equal(GRAPHICS_PRESETS.high.planarReflection, true);
    assert.equal(GRAPHICS_PRESETS.high.fireShadow, true);
    assert.equal(GRAPHICS_PRESETS.high.bloom, true);

    assert.equal(GRAPHICS_PRESETS.ultra.shadows, true);
    assert.equal(GRAPHICS_PRESETS.ultra.csm, true);
    assert.equal(GRAPHICS_PRESETS.ultra.ssao, true);
    assert.equal(GRAPHICS_PRESETS.ultra.dof, true);
    assert.equal(GRAPHICS_PRESETS.ultra.grassDensity, 1.0);

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

describe('Fix 3 — Mountain Cliff, Plane Wreckage & Camera Solid Collision', () => {
  it('blocks climbing steep mountains from multiple sides while allowing smooth contour sliding', () => {
    const allGates = ISLAND_GATES.map((g) => g.id);

    // Even with all gates unlocked, central basalt mountain ridges at x=28 and x=-38 block straight ascent
    let px = 28;
    let pz = 54;
    for (let step = 0; step < 30; step++) {
      const res = resolveWorldMovement(px, pz, px, pz - 0.5, allGates);
      px = res.x;
      pz = res.z;
    }
    assert.ok(pz > 43, `Player walked over south basalt mountain ridge to z=${pz.toFixed(2)}`);

    // Approaching steep north side of same mountain ridge (moving +Z)
    let nx = -36;
    let nz = 30;
    for (let step = 0; step < 30; step++) {
      const res = resolveWorldMovement(nx, nz, nx, nz + 0.5, allGates);
      nx = res.x;
      nz = res.z;
    }
    assert.ok(nz < 41, `Player walked over north face of mountain ridge to z=${nz.toFixed(2)}`);

    // Diagonal movement into mountain slope slides laterally without freezing
    const diagStartX = 28;
    const diagStartZ = 48.5;
    let sx = diagStartX;
    let sz = diagStartZ;
    for (let step = 0; step < 12; step++) {
      const res = resolveWorldMovement(sx, sz, sx + 0.35, sz - 0.35, allGates);
      sx = res.x;
      sz = res.z;
    }
    assert.ok(sx > diagStartX + 1.0, `Expected smooth diagonal slide along mountain, sx=${sx.toFixed(2)}`);
  });

  it('prevents walking inside Flight 404 fuselage, wing, engine nacelle, and keeps camera clear', () => {
    const wx = WORLD.WRECK_POS.x;
    const wz = WORLD.WRECK_POS.z;

    // Approach fuselage center from ALL 4 cardinal directions
    const approaches = [
      { name: '-X west', fx: wx - 7, fz: wz, tx: wx, tz: wz },
      { name: '+X east', fx: wx + 7, fz: wz, tx: wx, tz: wz },
      { name: '-Z north', fx: wx, fz: wz - 6, tx: wx, tz: wz },
      { name: '+Z south', fx: wx, fz: wz + 8, tx: wx, tz: wz + 2.6 },
    ];
    for (const a of approaches) {
      const res = resolveWorldMovement(a.fx, a.fz, a.tx, a.tz, []);
      assert.equal(res.blockedByObstacle, true, `Expected wreckage block from ${a.name}`);
      const stillInside = resolveCollidersPushout(res.x, res.z, 0.42).hit;
      assert.equal(stillInside, false, `Player remained inside wreckage collider from ${a.name}`);
    }

    // Dynamic obstacle collider (tree / placed forge) & camera clearance pushout
    const dynamicForge = [{ kind: 'circle' as const, id: 'test_forge', x: 5, z: 140, radius: 0.92 }];
    const hitForge = resolveWorldMovement(2, 140, 5, 140, [], WORLD.WATER_LEVEL, dynamicForge);
    assert.ok(Math.hypot(hitForge.x - 5, hitForge.z - 140) >= 1.3, 'Clipped into dynamic forge');

    const camSafe = clampCameraClearance(wx, 1.8, wz, dynamicForge);
    assert.ok(Math.hypot(camSafe.x - wx, camSafe.z - wz) >= 1.4, 'Camera clipped inside wreckage');
  });
});

describe('Fix 5 & Fix 6 — Recipe Usage Lookup & Wood -> Forge -> Driftwood Kiln', () => {
  it('returns crafting recipes using each item and processes Wood into Driftwood via Forge', () => {
    let state = createInitialSurvivalState();
    state.inventory = addItem(state.inventory, 'stone', 12).inventory;
    state.inventory = addItem(state.inventory, 'log', 8).inventory;
    state.inventory = addItem(state.inventory, 'flint', 6).inventory;
    state.inventory = addItem(state.inventory, 'stick', 2).inventory;

    const forgePlace = placeStructure(state, 'forge', 6, 0.8, 138, 0);
    assert.equal(forgePlace.ok, true);
    state = forgePlace.state;
    const forgeId = forgePlace.structureId!;

    // Interacting with placed Forge opens Forge modal
    const inter = interactWithStructure(state, forgeId, state.weather);
    assert.equal(inter.openModal, 'forge');

    // Deposit 1 Timber Log (+2 kiln wood) and 1 Fallen Branch (+1 kiln wood)
    const depLog = depositWoodToForge(state, forgeId, 'log');
    assert.equal(depLog.ok, true);
    state = depLog.state;
    const depStick = depositWoodToForge(state, forgeId, 'stick');
    assert.equal(depStick.ok, true);
    state = depStick.state;

    const fqBefore = getForgeQueue(state.structures.find((s) => s.id === forgeId)!);
    assert.equal(fqBefore.inputWood, 3);
    assert.equal(fqBefore.outputDriftwood, 0);

    // Advance half a batch -> still burning, progress > 0, no output yet
    state = {
      ...state,
      structures: tickForgeJobs(state.structures, FORGE_TUNING.WOOD_TO_DRIFTWOOD_SEC * 0.5),
    };
    const fqMid = getForgeQueue(state.structures.find((s) => s.id === forgeId)!);
    assert.ok(fqMid.progressSec > 0 && fqMid.outputDriftwood === 0);

    // Finish all 3 wood items -> yields 3 Driftwood
    state = {
      ...state,
      structures: tickForgeJobs(state.structures, FORGE_TUNING.WOOD_TO_DRIFTWOOD_SEC * 3),
    };
    const fqDone = getForgeQueue(state.structures.find((s) => s.id === forgeId)!);
    assert.equal(fqDone.inputWood, 0);
    assert.equal(fqDone.outputDriftwood, 3);

    // Collect Driftwood into backpack & craft with it
    const collected = collectForgeDriftwood(state, forgeId);
    assert.equal(collected.collected, 3);
    state = collected.state;
    assert.equal(countItem(state.inventory, 'driftwood'), 3);

    const driftwoodRecipes = getRecipesUsingItem('driftwood');
    assert.ok(driftwoodRecipes.some((r) => r.recipeId === 'driftwood_planks'));
    assert.ok(driftwoodRecipes.some((r) => r.recipeId === 'driftwood_charcoal'));

    const crafted = craftRecipeById('driftwood_charcoal', state.inventory, new Set(['forge']), state.flags);
    assert.equal(crafted.ok, true);
    assert.equal(countItem(crafted.inventory, 'coal'), 2);
  });
});

describe('Phase 3 — Freshwater Pond Walkable Slope, Sickness Rules & 5-Stage Hypothermia', () => {
  it('allows walking smoothly into and out of the Freshwater Spring pond from all 4 directions', () => {
    const sx = WORLD.SPRING_POS.x;
    const sz = WORLD.SPRING_POS.z;

    const dirs = [
      { dx: 1, dz: 0, label: 'East' },
      { dx: -1, dz: 0, label: 'West' },
      { dx: 0, dz: 1, label: 'South' },
      { dx: 0, dz: -1, label: 'North' },
    ];

    for (const d of dirs) {
      let x = sx;
      let z = sz;
      for (let step = 0; step < 20; step++) {
        const res = resolveWorldMovement(x, z, x + d.dx * 0.45, z + d.dz * 0.45, []);
        x = res.x;
        z = res.z;
      }
      assert.ok(
        Math.hypot(x - sx, z - sz) > 7.5,
        `Player failed to walk out of pond toward ${d.label}`
      );
    }
  });

  it('never causes sickness from freshwater pond, while dirty water, seawater, and raw meat set explicit sicknessCause', () => {
    assert.equal(WATER.FRESH_SICK_CHANCE, 0);

    let state = createInitialSurvivalState();
    state.needs.thirst = 30;
    const springDrink = interactFreshwaterSpring(state, () => 0.0); // even lowest RNG roll must not sicken
    assert.equal(springDrink.gotSick, false);
    assert.equal(springDrink.state.needs.sickness, 0);

    const seaRes = drinkSeawater(state);
    assert.equal(seaRes.gotSick, true);
    assert.equal(seaRes.state.needs.sicknessCause, 'Sea Water');
    assert.ok(seaRes.state.needs.thirst < state.needs.thirst);

    let dirtyState = createInitialSurvivalState();
    dirtyState.inventory = addItem(dirtyState.inventory, 'water_bottle_dirty', 1).inventory;
    const dirtySlot = dirtyState.inventory.findIndex((s) => s?.itemId === 'water_bottle_dirty');
    const dirtyRes = consumeInventorySlot(dirtyState, dirtySlot, () => 0.01);
    assert.equal(dirtyRes.gotSick, true);
    assert.equal(dirtyRes.state.needs.sicknessCause, 'Dirty Water');

    let rawState = createInitialSurvivalState();
    rawState.inventory = addItem(rawState.inventory, 'raw_meat', 1).inventory;
    const rawSlot = rawState.inventory.findIndex((s) => s?.itemId === 'raw_meat');
    const rawRes = consumeInventorySlot(rawState, rawSlot, () => 0.01);
    assert.equal(rawRes.gotSick, true);
    assert.equal(rawRes.state.needs.sicknessCause, 'Raw Meat');
  });

  it('progresses body temperature gradually across day/rain/night/storm with Day 1 grace and fast fire recovery', () => {
    assert.equal(TEMPERATURE.MIN_BODY_C, 32.0);
    assert.equal(createInitialSurvivalState().needs.temperature, 37.0);
    assert.equal(getBodyTempStage(37.0).stage, 'Normal');
    assert.equal(getBodyTempStage(36.0).stage, 'Chilly');
    assert.equal(getBodyTempStage(35.0).stage, 'Cold');
    assert.equal(getBodyTempStage(33.8).stage, 'Hypothermic');
    assert.equal(getBodyTempStage(32.5).stage, 'Severe');

    // Cold night storm while wet and swimming pushes target body temp down to 32.0°C
    const coldAmbient = computeAmbientTempC(
      { day: 2, hour: 2, totalHours: 26 },
      { kind: 'storm', rain: 0.9, wind: 0.95 }
    );
    const coldTarget = computeTargetBodyTempC(
      coldAmbient,
      {
        isMoving: false,
        isSprinting: false,
        isSwimming: true,
        nearFire: false,
        sheltered: false,
        holdingLitTorch: false,
      },
      100,
      { day: 2, hour: 2 },
      { kind: 'storm', rain: 0.9, wind: 0.95 }
    );
    assert.equal(coldTarget, 32.0);

    // 1) Day 1 08:15 AM stays Normal (36.5-37.0°C) even if cool or slightly damp
    let day1Needs = createInitialSurvivalState().needs;
    for (let i = 0; i < 60; i++) {
      day1Needs = tickNeeds(
        day1Needs,
        1.0,
        19.0,
        { kind: 'overcast', rain: 0, wind: 0.3 },
        {
          isMoving: false,
          isSprinting: false,
          isSwimming: false,
          nearFire: false,
          sheltered: false,
          holdingLitTorch: false,
        },
        'survivor',
        { day: 1, hour: 8.25 }
      ).needs;
    }
    assert.ok(day1Needs.temperature >= 36.5 && day1Needs.temperature <= 37.0);
    assert.equal(getBodyTempStage(day1Needs.temperature).stage, 'Normal');

    // 2) Day 1 grace period prevents dropping below "Chilly" (>= 35.5°C) even in extreme storm
    let graceNeeds = createInitialSurvivalState().needs;
    for (let i = 0; i < 180; i++) {
      graceNeeds = tickNeeds(
        graceNeeds,
        2.0,
        10.0,
        { kind: 'storm', rain: 0.9, wind: 0.9 },
        {
          isMoving: false,
          isSprinting: false,
          isSwimming: true,
          nearFire: false,
          sheltered: false,
          holdingLitTorch: false,
        },
        'survivor',
        { day: 1, hour: 23 }
      ).needs;
    }
    assert.ok(graceNeeds.temperature >= 35.5, `Day 1 must not go below Chilly, got ${graceNeeds.temperature}`);

    // 3) Day 2 soaked daytime rain cools ~1°C in ~6-7 real minutes (within 5-10 min band)
    let rainNeeds = { ...createInitialSurvivalState().needs, wetness: 100 };
    for (let i = 0; i < 360; i++) {
      rainNeeds = tickNeeds(
        rainNeeds,
        1.0,
        17.5,
        { kind: 'rain', rain: 0.55, wind: 0.5 },
        {
          isMoving: false,
          isSprinting: false,
          isSwimming: false,
          nearFire: false,
          sheltered: false,
          holdingLitTorch: false,
        },
        'survivor',
        { day: 2, hour: 14 }
      ).needs;
    }
    const rainDrop6m = 37.0 - rainNeeds.temperature;
    assert.ok(
      rainDrop6m >= 0.55 && rainDrop6m <= 1.25,
      `Expected ~0.6-1.2°C drop after 6 min soaked in rain, got ${rainDrop6m.toFixed(2)}°C`
    );

    // 4) Full 6-min storm night on Day 2 progresses smoothly into Severe (< 33.0°C)
    let stormNeeds = { ...createInitialSurvivalState().needs, wetness: 100 };
    for (let i = 0; i < 190; i++) {
      const stepped = tickNeeds(
        stormNeeds,
        2.0,
        11.0,
        { kind: 'storm', rain: 0.9, wind: 0.85 },
        {
          isMoving: false,
          isSprinting: false,
          isSwimming: false,
          nearFire: false,
          sheltered: false,
          holdingLitTorch: false,
        },
        'survivor',
        { day: 2, hour: 2 }
      );
      stormNeeds = stepped.needs;
      if (i === 5) assert.equal(stormNeeds.tempTrend, 'cooling');
    }
    assert.ok(stormNeeds.temperature < 33.0, `Expected Severe < 33.0°C after full storm night, got ${stormNeeds.temperature.toFixed(2)}°C`);
    assert.equal(getBodyTempStage(stormNeeds.temperature).stage, 'Severe');

    // 5) Old v1 broken save (32.8°C) migrates cleanly back to 37.0°C
    const oldSave = JSON.parse(serializeSave(createInitialSurvivalState(), 'autosave'));
    oldSave.version = 1;
    oldSave.needs.temperature = 32.8;
    const migrated = parseAndMigrateSave(JSON.stringify(oldSave));
    assert.equal(migrated?.needs.temperature, 37.0);

    // 6) Consuming boiled water & sitting by campfire warms significantly faster than cooling
    let coldState = createInitialSurvivalState();
    coldState.needs = { ...stormNeeds, temperature: 34.0 };
    coldState.inventory = addItem(coldState.inventory, 'water_bottle_clean', 1).inventory;
    const cleanSlot = coldState.inventory.findIndex((s) => s?.itemId === 'water_bottle_clean');
    const warmRes = consumeInventorySlot(coldState, cleanSlot);
    assert.ok(warmRes.state.needs.temperature > 34.5);
    assert.equal(warmRes.state.needs.tempTrend, 'warming');
  });
});

describe('Part 3 — Stances, Overhead Clearance & Sit Recovery', () => {
  it('blocks standing under low wing/shelter roofs while allowing crouch/prone/sit', () => {
    const wingZone = WORLD_LOW_CEILING_ZONES[0];
    assert.equal(canEnterStance('stand', wingZone.x, wingZone.z).allowed, false);
    assert.equal(canEnterStance('prone', wingZone.x, wingZone.z).allowed, true);
    const campZone = WORLD_LOW_CEILING_ZONES[1];
    assert.equal(canEnterStance('stand', campZone.x, campZone.z).allowed, false);
    assert.equal(canEnterStance('crouch', campZone.x, campZone.z).allowed, true);

    const shelterRoof = [{ id: 's1', x: 40, y: 2, z: 40, yaw: 0, builtDay: 1 }];
    assert.equal(canEnterStance('stand', 40.2, 40.1, shelterRoof).allowed, false);
    assert.equal(canEnterStance('crouch', 40.2, 40.1, shelterRoof).allowed, true);
    assert.equal(canEnterStance('stand', 60, 60, shelterRoof).allowed, true);
  });

  it('accelerates stamina and campfire warmth recovery while sitting', () => {
    const base = createInitialSurvivalState().needs;
    const tired = { ...base, stamina: 20, temperature: 35.4 };
    const ctxStand = {
      isMoving: false,
      isSprinting: false,
      isSwimming: false,
      nearFire: true,
      sheltered: false,
      holdingLitTorch: false,
      stance: 'stand' as const,
    };
    const ctxSit = { ...ctxStand, stance: 'sit' as const };
    const weather = { kind: 'clear' as const, rain: 0, wind: 0.2 };
    const afterStand = tickNeeds(tired, 3.0, 14, weather, ctxStand).needs;
    const afterSit = tickNeeds(tired, 3.0, 14, weather, ctxSit).needs;

    assert.ok(afterSit.stamina > afterStand.stamina);
    assert.ok(
      computeTargetBodyTempC(14, ctxSit, 0) > computeTargetBodyTempC(14, ctxStand, 0)
    );
  });
});

describe('Part 5 — Dynamic Tides, Survival Milestones & Control Defaults', () => {
  it('oscillates ocean tides across a semi-diurnal cycle around base sea level', () => {
    const samples = Array.from({ length: 24 }, (_, h) => getOceanTideOffset(h));
    const minOff = Math.min(...samples);
    const maxOff = Math.max(...samples);
    assert.ok(minOff < -PART5_IMMERSION_TUNING.TIDE_AMPLITUDE_M * 0.7);
    assert.ok(maxOff > PART5_IMMERSION_TUNING.TIDE_AMPLITUDE_M * 0.7);
    assert.equal(getEffectiveWaterLevel(0), WORLD.WATER_LEVEL + getOceanTideOffset(0));
  });

  it('tracks survival milestones accurately from initial state to advanced progress', () => {
    const fresh = createInitialSurvivalState('survivor');
    const freshList = computeMilestones(fresh);
    assert.ok(freshList.length >= 8);
    assert.equal(freshList.filter((m) => m.unlocked).length, 0);

    const progressed = {
      ...fresh,
      clock: { ...fresh.clock, day: 7 },
      stats: { ...fresh.stats, distanceTravelled: 1200, itemsGathered: 60, itemsCrafted: 12 },
      campfires: [{ id: 'cf1', x: 0, y: 1, z: 0, builtDay: 1, fuel: 100 }],
      cluesFound: [STORY_CLUES[0].id],
      escapedCity: true,
    };
    const unlockedIds = new Set(
      computeMilestones(progressed)
        .filter((m) => m.unlocked)
        .map((m) => m.id)
    );
    assert.ok(unlockedIds.has('ms_first_fire'));
    assert.ok(unlockedIds.has('ms_survivor_3'));
    assert.ok(unlockedIds.has('ms_crafter'));
    assert.ok(unlockedIds.has('ms_harbor'));
  });

  it('provides clean default FOV, sensitivity, captions, and unique custom keybinds without clashes', () => {
    const ext = loadExtendedGraphicsSettings();
    assert.equal(ext.fovDeg, 75);
    assert.equal(ext.mouseSensitivity, 1.0);
    assert.equal(ext.headBob, true);
    assert.equal(ext.closedCaptions, true);
    assert.equal(ext.keybinds.photoMode, DEFAULT_KEYBINDS.photoMode);
    assert.equal(ext.keybinds.interact, 'KeyE');
    assert.equal(ext.keybinds.inspect, 'KeyF');
    const allDefaultKeys = [
      ...Object.values(DEFAULT_KEYBINDS),
      'F3',   // Perf Overlay
      'Escape',
    ];
    assert.equal(new Set(allDefaultKeys).size, allDefaultKeys.length, 'All action keys must be unique');
  });
});

describe('Final Boss Showdown — The Aura King, Weapons, Save Migration & Checkpoints', () => {
  it('crafts combat arsenal recipes (bow, arrow, fire_bomb, flare_gun, flare_ammo) and computes weapon damage', () => {
    let inv = createEmptyInventory();
    const mats: Array<[Parameters<typeof addItem>[1], number]> = [
      ['stick', 10],
      ['rope', 4],
      ['fibre', 8],
      ['flint', 4],
      ['resin', 6],
      ['cloth_scrap', 2],
      ['coal', 4],
      ['metal_ingot', 2],
      ['scrap_metal', 4],
    ];
    for (const [id, n] of mats) {
      inv = addItem(inv, id, n).inventory;
    }

    const nearHands = new Set(['hands'] as const);
    const nearBench = new Set(['hands', 'workbench'] as const);

    const bowRes = craftRecipeById('bow', inv, nearHands);
    assert.equal(bowRes.ok, true);
    inv = bowRes.inventory;

    const arrowRes = craftRecipeById('arrow', inv, nearHands);
    assert.equal(arrowRes.ok, true);
    inv = arrowRes.inventory;
    assert.equal(countItem(inv, 'arrow'), 6);

    const bombRes = craftRecipeById('fire_bomb', inv, nearHands);
    assert.equal(bombRes.ok, true);
    inv = bombRes.inventory;
    assert.equal(countItem(inv, 'fire_bomb'), 2);

    const flareRes = craftRecipeById('flare_gun', inv, nearBench);
    assert.equal(flareRes.ok, true);
    inv = flareRes.inventory;

    const ammoRes = craftRecipeById('flare_ammo', inv, nearHands);
    assert.equal(ammoRes.ok, true);
    inv = ammoRes.inventory;
    assert.equal(countItem(inv, 'flare_ammo'), 3);

    assert.ok(getEquippedWeaponDamage('machete', true) > getEquippedWeaponDamage('machete', false));
    assert.ok(getEquippedWeaponDamage('flare_gun', false) > getEquippedWeaponDamage('stone_axe', false));
    assert.equal(COMBAT_TUNING.LIGHT_STAMINA_COST > 0, true);
    assert.equal(BOSS_TUNING.DIFFICULTIES.normal.maxHp > 0, true);
  });

  it('migrates legacy saves cleanly with default boss encounter state and achievements array', () => {
    const fresh = createInitialSurvivalState('survivor');
    const serialized = JSON.parse(serializeSave(fresh)) as Record<string, unknown>;
    delete serialized.boss;
    delete serialized.achievements;
    delete serialized.bossDifficulty;

    const migrated = parseAndMigrateSave(JSON.stringify(serialized));
    assert.ok(migrated !== null);
    assert.equal(migrated!.boss.combatPhase, 'inactive');
    assert.equal(migrated!.boss.phase, 1);
    assert.equal(migrated!.boss.defeated, false);
    assert.deepEqual(migrated!.achievements, []);
    assert.equal(migrated!.bossDifficulty, 'normal');
  });

  it('runs difficulty scaling, Phase 1->2 crystal shield, barrel AoE, Phase 3 boat flare bonus, defeat & checkpoint retry', () => {
    const base = createInitialSurvivalState('survivor');
    const easyCfg = getBossDifficultyConfig('easy');
    const hardCfg = getBossDifficultyConfig('hard');
    assert.ok(easyCfg.maxHp < hardCfg.maxHp);

    let s = startBossEncounter(base, 'normal', 1);
    assert.equal(s.boss.combatPhase, 'intro');
    assert.equal(s.boss.phase, 1);

    s = setBossCombatPhase(s, 'phase1');
    assert.equal(s.boss.combatPhase, 'phase1');

    // Push HP below Phase 2 threshold to trigger Phase 2 shield cutscene
    const toPhase2Dmg = Math.ceil(s.boss.maxHp * (1 - BOSS_TUNING.PHASE2_HP_RATIO)) + 5;
    const p2Res = applyPlayerDamageToBoss(s, toPhase2Dmg, { isHeavy: true });
    s = p2Res.state;
    assert.equal(p2Res.triggeredPhase, 'phase2_cutscene');
    assert.equal(s.boss.phase, 2);

    s = setBossCombatPhase(s, 'phase2');
    assert.equal(s.boss.shielded, true);
    // Shielded boss resists heavy strike until all 3 Aura Crystals are shattered
    const shieldedHit = applyPlayerDamageToBoss(s, 100);
    assert.ok(shieldedHit.dealt < 50);

    for (let i = 0 as 0 | 1 | 2; i < 3; i = (i + 1) as 0 | 1 | 2) {
      const cRes = destroyBossCrystal(s, i);
      assert.equal(cRes.destroyed, true);
      s = cRes.state;
    }
    assert.equal(s.boss.shielded, false);
    assert.ok(s.boss.staggeredSec > 0);

    // Barrel AoE within blast radius deals heavy damage + stagger
    const barrelRes = detonateBossBarrel(s, 0, BOSS_TUNING.EXPLOSIVE_BARREL_RADIUS_M * 0.5);
    assert.equal(barrelRes.exploded, true);
    assert.equal(barrelRes.hitBoss, true);
    assert.ok(barrelRes.dealt > 0);
    s = barrelRes.state;

    // Checkpoint retry restores alive state, places player at Shore Sanctum & keeps reached checkpoint phase
    const deadPhase2 = { ...s, alive: false, needs: { ...s.needs, health: 0 } };
    const retriedPhase2 = retryBossFromCheckpoint(deadPhase2, false);
    assert.equal(retriedPhase2.alive, true);
    assert.equal(retriedPhase2.boss.phase, 2);
    assert.equal(retriedPhase2.needs.health, 100);
    assert.equal(retriedPhase2.player.x, BOSS_TUNING.ARENA_CENTER_X - 1.6);
    assert.equal(retriedPhase2.player.z, BOSS_TUNING.ARENA_CENTER_Z + 7.2);

    const restartedPhase1 = retryBossFromCheckpoint(deadPhase2, true);
    assert.equal(restartedPhase1.boss.phase, 1);

    // Push to Phase 3 boat transition
    const toPhase3Dmg = Math.max(10, Math.ceil(s.boss.hp - s.boss.maxHp * BOSS_TUNING.PHASE3_HP_RATIO) + 10);
    const p3Res = applyPlayerDamageToBoss(s, toPhase3Dmg, { isHeavy: true });
    s = p3Res.state;
    assert.equal(p3Res.triggeredPhase, 'phase3_transition');
    assert.equal(s.boss.phase, 3);

    s = setBossCombatPhase(s, 'phase3_boat');
    s = { ...s, boss: { ...s.boss, fightElapsedSec: 42 } };

    // Final flare blow defeats The Aura King, grants achievement & records bossFightTimeSec
    const finRes = applyPlayerDamageToBoss(s, s.boss.hp + 500, { isFireOrFlare: true });
    assert.equal(finRes.defeatedNow, true);
    assert.equal(finRes.state.boss.combatPhase, 'defeat_cutscene');
    assert.equal(finRes.state.boss.defeated, true);
    assert.ok(finRes.state.achievements.includes(BOSS_TUNING.ACHIEVEMENT_NAME));
    assert.ok(finRes.state.stats.bossFightTimeSec >= 42);
  });
});
