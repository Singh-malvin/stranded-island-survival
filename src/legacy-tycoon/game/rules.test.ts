/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CRAFTING_RECIPES,
  addItemToInventory,
  removeItemFromInventory,
  getItemCount,
  canCraftRecipe,
  craftRecipe,
  calculateAmbientTemp,
  calculateBodyTempDrift,
  updatePlayerStats,
  canAdvanceRaft,
  advanceRaft,
  canBuildBonfire,
  buildBonfire,
  lightBonfire,
  canRepairRadio,
  repairRadio,
} from './rules';
import { EscapeState, InventorySlot, PlayerStats } from './types';

test('inventory item operations (add, count, remove)', () => {
  let inv: InventorySlot[] = [];
  assert.equal(getItemCount(inv, 'wood'), 0);

  inv = addItemToInventory(inv, 'wood', 3);
  assert.equal(getItemCount(inv, 'wood'), 3);

  inv = addItemToInventory(inv, 'wood', 2);
  assert.equal(getItemCount(inv, 'wood'), 5);

  const res1 = removeItemFromInventory(inv, 'wood', 2);
  assert.equal(res1.success, true);
  assert.equal(getItemCount(res1.inventory, 'wood'), 3);

  const res2 = removeItemFromInventory(res1.inventory, 'wood', 10);
  assert.equal(res2.success, false);
  assert.equal(getItemCount(res2.inventory, 'wood'), 3);
});

test('crafting recipe validation and execution', () => {
  const axeRecipe = CRAFTING_RECIPES.find((r) => r.id === 'stone_axe')!;
  assert.ok(axeRecipe);

  let inv: InventorySlot[] = [
    { itemId: 'flint', count: 1 },
    { itemId: 'driftwood', count: 2 },
  ];
  // Missing 1 flint
  assert.equal(canCraftRecipe(inv, axeRecipe), false);

  inv = addItemToInventory(inv, 'flint', 1);
  assert.equal(canCraftRecipe(inv, axeRecipe), true);

  const craftRes = craftRecipe(inv, axeRecipe);
  assert.equal(craftRes.success, true);
  assert.equal(getItemCount(craftRes.inventory, 'stone_axe'), 1);
  assert.equal(getItemCount(craftRes.inventory, 'flint'), 0);
  assert.equal(getItemCount(craftRes.inventory, 'driftwood'), 0);
});

test('campfire-dependent recipes require campfire proximity', () => {
  const cookedMeatRecipe = CRAFTING_RECIPES.find((r) => r.id === 'cooked_meat')!;
  assert.ok(cookedMeatRecipe);

  const inv: InventorySlot[] = [
    { itemId: 'raw_meat', count: 1 },
    { itemId: 'driftwood', count: 1 },
  ];

  assert.equal(canCraftRecipe(inv, cookedMeatRecipe, false), false);
  assert.equal(canCraftRecipe(inv, cookedMeatRecipe, true), true);

  const res = craftRecipe(inv, cookedMeatRecipe, true);
  assert.equal(res.success, true);
  assert.equal(getItemCount(res.inventory, 'cooked_meat'), 1);
});

test('ambient temperature calculation matches diurnal curve', () => {
  // Midnight/dawn should be colder than noon
  const nightTemp = calculateAmbientTemp(4, 'clear');
  const noonTemp = calculateAmbientTemp(13, 'clear');
  assert.ok(noonTemp > nightTemp, `Noon (${noonTemp}C) should be warmer than 4am (${nightTemp}C)`);

  // Storm should cool ambient temperature
  const stormTemp = calculateAmbientTemp(13, 'storm');
  assert.ok(stormTemp < noonTemp, `Storm at noon (${stormTemp}C) should be cooler than clear (${noonTemp}C)`);
});

test('body temperature drift and warmth sources', () => {
  // Freezing night cold without fire drifts downwards
  const driftCold = calculateBodyTempDrift(37.0, 14, false, false, false);
  assert.ok(driftCold < 0, 'In cold ambient temp without fire, body temp should drift down');

  // Being near a fire counteracts cold
  const driftWithFire = calculateBodyTempDrift(37.0, 14, true, false, false);
  assert.ok(driftWithFire > driftCold, 'Fire should significantly warm effective ambient temperature');
});

test('player survival stats tick logic', () => {
  const stats: PlayerStats = {
    health: 100,
    hunger: 50,
    thirst: 50,
    stamina: 80,
    temperature: 37.0,
    isSprinting: false,
    isWet: false,
    activeHotbarSlot: 1,
  };

  const updated = updatePlayerStats(stats, 10, 28, {
    isNearFire: false,
    holdingTorch: false,
    isSheltered: false,
    isMoving: true,
  });

  // Hunger & thirst should tick down gently
  assert.ok(updated.hunger < stats.hunger);
  assert.ok(updated.thirst < stats.thirst);
  // Stamina should regenerate when not sprinting
  assert.ok(updated.stamina > stats.stamina);
});

test('escape method 1: raft construction and provisioning progression', () => {
  const initialEscape: EscapeState = {
    raftProgress: { phase: 0, logs: 0, ropes: 0, fronds: 0, rations: 0, water: 0, isComplete: false },
    bonfireProgress: { built: false, stones: 0, wood: 0, tinder: 0, isLit: false, burnTimeRemaining: 0 },
    radioProgress: { built: false, hasBattery: false, hasWire: false, hasAntenna: false, scraps: 0, isCalibrated: false },
    horizonEvent: { type: 'none', x: 0, distance: 100, timer: 0, active: false },
    escaped: false,
    escapeMethod: null,
  };

  // Phase 0 -> Phase 1 requires 6 wood, 4 rope
  let inv: InventorySlot[] = [
    { itemId: 'wood', count: 6 },
    { itemId: 'rope', count: 4 },
  ];

  const check1 = canAdvanceRaft(initialEscape, inv);
  assert.equal(check1.canAdvance, true);

  const res1 = advanceRaft(initialEscape, inv);
  assert.equal(res1.success, true);
  assert.equal(res1.escape.raftProgress.phase, 1);
  assert.equal(getItemCount(res1.inventory, 'wood'), 0);
});

test('escape method 2: peak signal bonfire building and rescue signaling', () => {
  const escape: EscapeState = {
    raftProgress: { phase: 0, logs: 0, ropes: 0, fronds: 0, rations: 0, water: 0, isComplete: false },
    bonfireProgress: { built: false, stones: 0, wood: 0, tinder: 0, isLit: false, burnTimeRemaining: 0 },
    radioProgress: { built: false, hasBattery: false, hasWire: false, hasAntenna: false, scraps: 0, isCalibrated: false },
    horizonEvent: { type: 'ship', x: 200, distance: 40, timer: 30, active: true },
    escaped: false,
    escapeMethod: null,
  };

  const inv: InventorySlot[] = [
    { itemId: 'stone', count: 6 },
    { itemId: 'wood', count: 8 },
    { itemId: 'palm_frond', count: 4 },
  ];

  assert.equal(canBuildBonfire(escape, inv).canBuild, true);
  const buildRes = buildBonfire(escape, inv);
  assert.equal(buildRes.success, true);
  assert.equal(buildRes.escape.bonfireProgress.built, true);

  // Light with torch while horizon ship is active -> triggers rescue escape!
  const lightRes = lightBonfire(buildRes.escape, true);
  assert.equal(lightRes.success, true);
  assert.equal(lightRes.escape.escaped, true);
  assert.equal(lightRes.escape.escapeMethod, 'signal_fire');
});

test('escape method 3: radio transceiver repair and mayday broadcast', () => {
  const escape: EscapeState = {
    raftProgress: { phase: 0, logs: 0, ropes: 0, fronds: 0, rations: 0, water: 0, isComplete: false },
    bonfireProgress: { built: false, stones: 0, wood: 0, tinder: 0, isLit: false, burnTimeRemaining: 0 },
    radioProgress: { built: false, hasBattery: false, hasWire: false, hasAntenna: false, scraps: 0, isCalibrated: false },
    horizonEvent: { type: 'none', x: 0, distance: 100, timer: 0, active: false },
    escaped: false,
    escapeMethod: null,
  };

  const inv: InventorySlot[] = [
    { itemId: 'battery', count: 1 },
    { itemId: 'copper_wire', count: 2 },
    { itemId: 'antenna', count: 1 },
    { itemId: 'flint', count: 1 },
  ];

  assert.equal(canRepairRadio(escape, inv).canRepair, true);
  const repRes = repairRadio(escape, inv);
  assert.equal(repRes.success, true);
  assert.equal(repRes.escape.escaped, true);
  assert.equal(repRes.escape.escapeMethod, 'radio');
});
