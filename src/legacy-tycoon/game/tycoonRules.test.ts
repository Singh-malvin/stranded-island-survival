import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  canAfford,
  deductCost,
  calculateGuestCapacity,
  calculateStarRating,
  calculateDailyRevenue,
  calculateBuildingUpkeep,
  calculateNextCleanliness,
  processEndOfDay,
  buySupplyPack,
  canUpgradeIsland,
  getInitialGameState,
  BUILDING_CATALOG,
  planPathSegments,
  multiplyCost,
  maxAffordableCount,
  formatTimeOfDay,
} from './tycoonRules.ts';
import { buildResortStructure3D } from './ResortBuildings3D.ts';
import { PlacedBuilding } from './tycoonTypes.ts';

describe('Resort Tycoon Rules and Economy', () => {
  it('correctly validates resource affordability', () => {
    const stockpile = { cash: 1000, timber: 50, stone: 30, thatch: 40, decor: 5 };

    assert.strictEqual(canAfford(stockpile, { cash: 500, timber: 20, stone: 10, thatch: 10 }), true);
    assert.strictEqual(canAfford(stockpile, { cash: 1500, timber: 10, stone: 10, thatch: 10 }), false);
    assert.strictEqual(canAfford(stockpile, { cash: 200, timber: 80, stone: 10, thatch: 10 }), false);
    assert.strictEqual(canAfford(stockpile, { cash: 200, timber: 20, stone: 10, thatch: 10, decor: 20 }), false);
  });

  it('deducts costs cleanly without negative numbers', () => {
    const stockpile = { cash: 500, timber: 30, stone: 20, thatch: 20, decor: 5 };
    const cost = { cash: 400, timber: 30, stone: 10, thatch: 5, decor: 2 };
    const result = deductCost(stockpile, cost);

    assert.strictEqual(result.cash, 100);
    assert.strictEqual(result.timber, 0);
    assert.strictEqual(result.stone, 10);
    assert.strictEqual(result.thatch, 15);
    assert.strictEqual(result.decor, 3);
  });

  it('calculates guest capacity from placed accommodation buildings', () => {
    const buildings: PlacedBuilding[] = [
      { id: '1', defId: 'beach_cabana', x: 0, y: 0, z: 0, rotation: 0, constructedAtDay: 1, occupants: 0 },
      { id: '2', defId: 'beach_cabana', x: 10, y: 0, z: 0, rotation: 0, constructedAtDay: 1, occupants: 0 },
      { id: '3', defId: 'overwater_bungalow', x: 20, y: 0, z: 0, rotation: 0, constructedAtDay: 1, occupants: 0 },
      { id: '4', defId: 'tiki_bar', x: 30, y: 0, z: 0, rotation: 0, constructedAtDay: 1, occupants: 0 },
      { id: '5', defId: 'grand_hotel_wing', x: 40, y: 0, z: 0, rotation: 0, constructedAtDay: 1, occupants: 0 },
    ];

    // 2 + 2 + 4 + 0 + 16 = 24
    assert.strictEqual(calculateGuestCapacity(buildings), 24);
  });

  it('includes paths category options, starter items, and massive items', () => {
    assert.strictEqual(BUILDING_CATALOG['stone_pathway'].category, 'paths');
    assert.strictEqual(BUILDING_CATALOG['timber_boardwalk'].category, 'paths');
    assert.strictEqual(BUILDING_CATALOG['garden_trail'].category, 'paths');
    assert.strictEqual(BUILDING_CATALOG['marble_promenade'].category, 'paths');
    assert.ok(BUILDING_CATALOG['koi_pond']);
    assert.strictEqual(BUILDING_CATALOG['water_park'].category, 'massive');
    assert.strictEqual(BUILDING_CATALOG['superyacht_marina'].category, 'massive');
  });

  it('enforces harder economy: zero amenity revenue with zero guests, staff efficiency boost, and building upkeep', () => {
    const buildings: PlacedBuilding[] = [
      { id: '1', defId: 'sunset_lounge', x: 0, y: 0, z: 0, rotation: 0, constructedAtDay: 1, occupants: 0 },
    ];

    // Zero guests => zero dining revenue
    const revZeroGuests = calculateDailyRevenue(buildings, 0, 0);
    assert.strictEqual(revZeroGuests, 0);

    // Unstaffed chef restaurant earns less than staffed chef restaurant
    const unstaffedRev = calculateDailyRevenue(
      buildings,
      4,
      4,
      { cleaners: 0, bartenders: 0, chefs: 0, concierges: 0 },
      100,
      'standard'
    );
    const staffedRev = calculateDailyRevenue(
      buildings,
      4,
      4,
      { cleaners: 0, bartenders: 0, chefs: 1, concierges: 0 },
      100,
      'standard'
    );
    assert.ok(staffedRev > unstaffedRev);

    // Building upkeep scales in hardcore mode
    const stdUpkeep = calculateBuildingUpkeep(buildings, 'standard');
    const hardUpkeep = calculateBuildingUpkeep(buildings, 'hardcore');
    assert.ok(stdUpkeep > 0);
    assert.ok(hardUpkeep > stdUpkeep);
  });

  it('requires real bed capacity and cleanliness for higher star ratings', () => {
    // High prestige alone with 0 capacity cannot exceed 1.0 star
    assert.strictEqual(calculateStarRating(16000, 0, 0, 100), 1.0);
    // High prestige + 24 capacity + >=75 cleanliness unlocks 5.0 stars
    assert.strictEqual(calculateStarRating(16000, 20, 24, 85), 5.0);
  });

  it('decays cleanliness without enough housekeepers and restores it with cleaners', () => {
    const buildings: PlacedBuilding[] = [
      { id: '1', defId: 'beach_cabana', x: 0, y: 0, z: 0, rotation: 0, constructedAtDay: 1, occupants: 0 },
      { id: '2', defId: 'beach_cabana', x: 10, y: 0, z: 0, rotation: 0, constructedAtDay: 1, occupants: 0 },
      { id: '3', defId: 'sunset_lounge', x: 20, y: 0, z: 0, rotation: 0, constructedAtDay: 1, occupants: 0 },
      { id: '4', defId: 'water_park', x: 30, y: 0, z: 0, rotation: 0, constructedAtDay: 1, occupants: 0 },
    ];
    const dirtyNext = calculateNextCleanliness(90, buildings, 8, { cleaners: 0, bartenders: 0, chefs: 0, concierges: 0 });
    assert.ok(dirtyNext < 90);

    const cleanNext = calculateNextCleanliness(70, buildings, 8, { cleaners: 3, bartenders: 0, chefs: 0, concierges: 0 });
    assert.ok(cleanNext > 70);
  });

  it('handles island expansion tiers and validation', () => {
    const state = getInitialGameState();
    assert.strictEqual(state.islandTier, 1);
    assert.strictEqual(state.islandRadius, 75);

    const check1 = canUpgradeIsland(state);
    assert.strictEqual(check1.canUpgrade, false);

    state.stats.prestigeScore = 400;
    state.resources.cash = 3000;
    state.resources.timber = 100;
    state.resources.stone = 100;
    state.resources.thatch = 50;

    const check2 = canUpgradeIsland(state);
    assert.strictEqual(check2.canUpgrade, true);
    assert.strictEqual(check2.nextTier?.radius, 100);
  });

  it('handles supply shipments purchase and returns structured resource data', () => {
    const stockpile = { cash: 1000, timber: 50, stone: 50, thatch: 50, decor: 10 };
    const res = buySupplyPack(stockpile, 'lumber_cargo');

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.updatedStockpile.cash, 890);
    assert.strictEqual(res.updatedStockpile.timber, 100);
    assert.strictEqual(res.resource, 'timber');
    assert.strictEqual(res.amount, 50);
  });

  it('starts both modes at $0 cash with $0 Pier & first Cabana craftable from island materials', () => {
    const std = getInitialGameState('standard');
    const hard = getInitialGameState('hardcore');

    assert.strictEqual(std.resources.cash, 0);
    assert.strictEqual(hard.resources.cash, 0);
    assert.strictEqual(std.guests.length, 0);
    assert.strictEqual(hard.guests.length, 0);
    assert.strictEqual(BUILDING_CATALOG['ferry_dock'].cost.cash, 0);
    assert.strictEqual(BUILDING_CATALOG['beach_cabana'].cost.cash, 0);
    assert.strictEqual(canAfford(std.resources, BUILDING_CATALOG['ferry_dock'].cost), true);
  });

  it('reconciles Hardcore cash 1:1 with HUD daily revenue, staff wages, and building upkeep', () => {
    const hard = getInitialGameState('hardcore');
    hard.buildings = [
      { id: 'dock', defId: 'ferry_dock', x: 0, y: 0, z: 0, rotation: 0, constructedAtDay: 1, occupants: 0 },
      { id: 'cabana', defId: 'beach_cabana', x: 10, y: 0, z: 0, rotation: 0, constructedAtDay: 1, occupants: 0 },
    ];
    hard.guests = [
      { id: 'g1', name: 'A B', tier: 'economy', satisfaction: 90, daysRemaining: 3, preferredActivity: 'swim' },
      { id: 'g2', name: 'C D', tier: 'economy', satisfaction: 90, daysRemaining: 3, preferredActivity: 'relax' },
    ];

    const expectedRev = calculateDailyRevenue(hard.buildings, 2, 2, hard.staff, hard.stats.cleanliness, 'hardcore');
    const expectedUpkeep = calculateBuildingUpkeep(hard.buildings, 'hardcore');
    const expectedNet = expectedRev - expectedUpkeep;
    assert.ok(expectedNet > 0, `Expected positive starter Hardcore profit with 2 guests, got ${expectedNet}`);

    const afterDay = processEndOfDay(hard);
    assert.strictEqual(afterDay.resources.cash, hard.resources.cash + expectedNet);
    assert.strictEqual(afterDay.stats.dailyUpkeep, expectedUpkeep);
  });

  it('applies diminishing returns to duplicate amenities and keeps power curve grounded', () => {
    const oneBar: PlacedBuilding[] = [
      { id: '1', defId: 'tiki_bar', x: 0, y: 0, z: 0, rotation: 0, constructedAtDay: 1, occupants: 0 },
    ];
    const twoBars: PlacedBuilding[] = [
      ...oneBar,
      { id: '2', defId: 'tiki_bar', x: 10, y: 0, z: 0, rotation: 0, constructedAtDay: 1, occupants: 0 },
    ];
    const rev1 = calculateDailyRevenue(oneBar, 6, 6);
    const rev2 = calculateDailyRevenue(twoBars, 6, 6);
    // Second duplicate bar adds strictly less than the first bar
    assert.ok(rev2 - rev1 < rev1, `Expected diminishing returns on 2nd bar: rev1=${rev1}, rev2=${rev2}`);
  });

  it('simulates end-of-day progression, revenue payout, upkeep, and guest flow', () => {
    const initial = getInitialGameState();
    initial.buildings = [
      { id: 'dock', defId: 'ferry_dock', x: 0, y: 0, z: 0, rotation: 0, constructedAtDay: 1, occupants: 0 },
      { id: 'cabana', defId: 'beach_cabana', x: 10, y: 0, z: 0, rotation: 0, constructedAtDay: 1, occupants: 0 },
      { id: 'waterpark', defId: 'water_park', x: 20, y: 0, z: 0, rotation: 0, constructedAtDay: 1, occupants: 0 },
    ];

    const nextState = processEndOfDay(initial);
    assert.strictEqual(nextState.stats.day, 2);
    assert.ok(nextState.guests.length > 0);
    assert.ok(nextState.stats.dailyRevenue > 0);
    assert.ok(nextState.stats.dailyUpkeep > 0);
  });

  it('builds 3D interiors: furnished bedrooms, chef stove with steam, and 5-story walkable penthouse', () => {
    const cabana = buildResortStructure3D('beach_cabana');
    assert.ok(cabana.stations.some((s) => s.type === 'bed'));
    assert.ok(cabana.walkableZones.length > 0);

    const restaurant = buildResortStructure3D('sunset_lounge');
    assert.ok(restaurant.stations.some((s) => s.type === 'stove'));
    assert.ok((restaurant.animatedParts.steamPuffs?.length ?? 0) > 0);

    const penthouse = buildResortStructure3D('presidential_penthouse');
    const maxWalkableY = Math.max(...penthouse.walkableZones.map((z) => Math.max(z.yStart, z.yEnd)));
    assert.ok(maxWalkableY >= 14.0, `Expected penthouse rooftop walkable height >= 14m, got ${maxWalkableY}`);
    assert.ok(penthouse.stations.some((s) => s.type === 'bed'));
    assert.ok(penthouse.stations.some((s) => s.type === 'stove'));
    assert.ok(penthouse.animatedParts.elevatorCab);
  });

  it('plans Start -> End connected path segments and respects resource budgets', () => {
    const segs = planPathSegments({ x: 0, z: 0 }, { x: 0, z: 12 }, 4.0, 24);
    assert.strictEqual(segs.length, 3);
    assert.strictEqual(segs[0].z, 2);
    assert.strictEqual(segs[1].z, 6);
    assert.strictEqual(segs[2].z, 10);

    // Budget cap limits segment count
    const capped = planPathSegments({ x: 0, z: 0 }, { x: 20, z: 0 }, 4.0, 2);
    assert.strictEqual(capped.length, 2);

    const stockpile = { cash: 0, timber: 10, stone: 12, thatch: 10, decor: 0 };
    const trailCost = BUILDING_CATALOG['garden_trail'].cost; // 2 timber, 4 stone, 2 thatch
    assert.strictEqual(maxAffordableCount(stockpile, trailCost, 24), 3);

    const batch = multiplyCost(trailCost, 3);
    assert.strictEqual(batch.timber, 6);
    assert.strictEqual(batch.stone, 12);
    assert.strictEqual(batch.thatch, 6);
  });

  it('formats natural Morning/Midday/Sunset/Night time of day and resets to Morning on Next Day', () => {
    assert.strictEqual(formatTimeOfDay(0.25).phase, 'Dawn');
    assert.strictEqual(formatTimeOfDay(0.35).phase, 'Morning');
    assert.strictEqual(formatTimeOfDay(0.55).phase, 'Midday');
    assert.strictEqual(formatTimeOfDay(0.74).phase, 'Sunset');
    assert.strictEqual(formatTimeOfDay(0.92).phase, 'Night');
    assert.strictEqual(formatTimeOfDay(0.92).isNight, true);

    const initial = getInitialGameState();
    initial.stats.timeOfDay = 0.92;
    const nextDay = processEndOfDay(initial);
    assert.strictEqual(nextDay.stats.timeOfDay, 0.30);
  });

  it('curves path segments smoothly around blocking trees and builds tennis court lines', () => {
    const palmObstacles = [{ x: 0, z: 10, radius: 1.35 }];
    const curved = planPathSegments({ x: 0, z: 0 }, { x: 0, z: 20 }, 4.0, 24, 0, palmObstacles);
    assert.ok(curved.length >= 5);
    // Every segment center should curve outside the tree trunk radius
    for (const seg of curved) {
      const distToTree = Math.hypot(seg.x - 0, seg.z - 10);
      assert.ok(distToTree > 1.35, `Expected path segment to avoid palm tree trunk, got dist=${distToTree}`);
    }
    // Rotations along the curved path should vary smoothly (not all straight 0)
    const maxAbsRot = Math.max(...curved.map((s) => Math.abs(s.rotation)));
    assert.ok(maxAbsRot > 0.12, `Expected path to curve noticeably around tree, maxRot=${maxAbsRot}`);

    const court = buildResortStructure3D('tennis_court');
    let lineCount = 0;
    court.group.traverse((obj) => {
      if (obj.name === 'tennis_court_line') lineCount++;
    });
    assert.ok(lineCount >= 10, `Expected full tennis court line markings, got ${lineCount}`);
  });
});
