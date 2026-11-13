/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CraftingRecipe,
  EscapeState,
  InventorySlot,
  ItemId,
  PlayerStats,
  RecipeRequirement,
  WeatherType,
} from './types';

export interface ItemDef {
  id: ItemId;
  name: string;
  description: string;
  locationHint: string;
  maxStack: number;
  category: 'material' | 'tool' | 'food' | 'valuable';
  foodValue?: number;
  hydrationValue?: number;
}

export const ITEM_DEFINITIONS: Record<ItemId, ItemDef> = {
  flint: {
    id: 'flint',
    name: 'Flint Stone',
    description: 'Sharp hard mineral. Essential for stone tools, spearheads, and sparks.',
    locationHint: 'Found on rocky beaches, along cliff bases, and on the volcano slopes.',
    maxStack: 20,
    category: 'material',
  },
  driftwood: {
    id: 'driftwood',
    name: 'Driftwood',
    description: 'Dry weathered timber washed up from the sea. Easy to gather by hand.',
    locationHint: 'Abundant all along the sandy beaches and coastlines.',
    maxStack: 20,
    category: 'material',
  },
  wood: {
    id: 'wood',
    name: 'Palm Log',
    description: 'Sturdy tropical hardwood felled from mature palm trees using an axe.',
    locationHint: 'Chop standing palm trees in the jungle with a Stone Hatchet.',
    maxStack: 20,
    category: 'material',
  },
  palm_frond: {
    id: 'palm_frond',
    name: 'Palm Fronds',
    description: 'Flexible foliage for thatch, cordage, and tinder.',
    locationHint: 'Pick up fallen fronds on the beach or shake palm trees with bare hands!',
    maxStack: 30,
    category: 'material',
  },
  vine: {
    id: 'vine',
    name: 'Jungle Vine',
    description: 'Tough fibrous vines ideal for twisting into strong rope.',
    locationHint: 'Gather from vine clusters and shrubs in the dense green jungle.',
    maxStack: 20,
    category: 'material',
  },
  rope: {
    id: 'rope',
    name: 'Braided Rope',
    description: 'Essential cordage for tools, rafts, and shelters.',
    locationHint: 'Craft in your backpack using 2 Jungle Vines OR 2 Palm Fronds!',
    maxStack: 15,
    category: 'material',
  },
  stone: {
    id: 'stone',
    name: 'Heavy Stone',
    description: 'Volcanic basalt and granite chunks. Crucial for hearths and bonfires.',
    locationHint: 'Pick up loose basalt stones around cliffs, or mine boulders.',
    maxStack: 20,
    category: 'material',
  },
  coconut: {
    id: 'coconut',
    name: 'Fresh Coconut',
    description: 'Nutritious milk and sweet meat. Great for quick hydration and food.',
    locationHint: 'Found on sandy beaches, under palm trees, or shaken loose from palms.',
    maxStack: 10,
    category: 'food',
    foodValue: 18,
    hydrationValue: 28,
  },
  raw_meat: {
    id: 'raw_meat',
    name: 'Raw Meat',
    description: 'Harvested from crabs, boars, or snakes. Safe once cooked over fire.',
    locationHint: 'Hunt beach crabs, jungle wild boars, or snakes with bare hands or a spear.',
    maxStack: 10,
    category: 'food',
    foodValue: 12,
    hydrationValue: 0,
  },
  cooked_meat: {
    id: 'cooked_meat',
    name: 'Roasted Ration',
    description: 'Nutritious cooked meat prepared over fire. Long lasting voyage food.',
    locationHint: 'Cook Raw Meat at any campfire using 1 piece of driftwood.',
    maxStack: 10,
    category: 'food',
    foodValue: 45,
    hydrationValue: 10,
  },
  clean_water: {
    id: 'clean_water',
    name: 'Purified Water',
    description: 'Boiled or spring-fresh water stored safely.',
    locationHint: 'Drink directly at the jungle river spring, or boil at a campfire.',
    maxStack: 10,
    category: 'food',
    foodValue: 0,
    hydrationValue: 50,
  },
  torch: {
    id: 'torch',
    name: 'Pitch Torch',
    description: 'Illuminates darkness, warms in cold storms, and deters beasts.',
    locationHint: 'Craft with 1 Driftwood + 1 Palm Frond.',
    maxStack: 1,
    category: 'tool',
  },
  stone_axe: {
    id: 'stone_axe',
    name: 'Stone Hatchet',
    description: 'Primitive tool capable of chopping mature palm trees into logs.',
    locationHint: 'Craft immediately with 2 Flint + 2 Driftwood found right on the beach!',
    maxStack: 1,
    category: 'tool',
  },
  spear: {
    id: 'spear',
    name: 'Sharpened Spear',
    description: 'Defensive hunting weapon with extended reach.',
    locationHint: 'Craft with 2 Driftwood + 1 Flint + 1 Vine.',
    maxStack: 1,
    category: 'tool',
  },
  water_flask: {
    id: 'water_flask',
    name: 'Water Canteen',
    description: 'Stores potable water harvested from streams or rain.',
    locationHint: 'Craft with 1 Coconut + 1 Vine or Rope.',
    maxStack: 1,
    category: 'tool',
  },
  battery: {
    id: 'battery',
    name: 'Marine Battery',
    description: 'Heavy lead-acid battery salvaged from shipwreck locker.',
    locationHint: 'Pry open cargo crates in the shipwreck shallows on the northeast coast.',
    maxStack: 1,
    category: 'valuable',
  },
  copper_wire: {
    id: 'copper_wire',
    name: 'Copper Wire Spool',
    description: 'High conductivity electrical wiring salvaged from wreck.',
    locationHint: 'Salvaged from crates around the sunken shipwreck hull.',
    maxStack: 5,
    category: 'valuable',
  },
  antenna: {
    id: 'antenna',
    name: 'Radio Mast Antenna',
    description: 'VHF emergency antenna salvaged from fallen mast.',
    locationHint: 'Found inside shipwreck wreckage crates.',
    maxStack: 1,
    category: 'valuable',
  },
  flare_gun: {
    id: 'flare_gun',
    name: 'Emergency Flare Gun',
    description: 'Distress flare with one red phosphorus round.',
    locationHint: 'Found inside shipwreck captain crates on the northeast reef.',
    maxStack: 1,
    category: 'valuable',
  },
};

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  {
    id: 'stone_axe',
    name: 'Stone Hatchet',
    category: 'tools',
    description: 'Primitive flint blade wedged into driftwood. Essential for chopping palm trees into logs.',
    resultItemId: 'stone_axe',
    resultCount: 1,
    ingredients: [
      { itemId: 'flint', count: 2 },
      { itemId: 'driftwood', count: 2 },
    ],
  },
  {
    id: 'torch',
    name: 'Pitch Torch',
    category: 'tools',
    description: 'Dry palm fronds bound to driftwood. Emits light, staves off night hypothermia, and deters beasts.',
    resultItemId: 'torch',
    resultCount: 1,
    ingredients: [
      { itemId: 'driftwood', count: 1 },
      { itemId: 'palm_frond', count: 1 },
    ],
  },
  {
    id: 'rope_from_vines',
    name: 'Braided Vine Rope',
    category: 'survival',
    description: 'Twisted jungle vines woven into strong cordage for rafts and structures.',
    resultItemId: 'rope',
    resultCount: 1,
    ingredients: [{ itemId: 'vine', count: 2 }],
  },
  {
    id: 'rope_from_fronds',
    name: 'Frond Cordage',
    category: 'survival',
    description: 'Dried palm fronds stripped and twisted into sturdy rope.',
    resultItemId: 'rope',
    resultCount: 1,
    ingredients: [{ itemId: 'palm_frond', count: 2 }],
  },
  {
    id: 'spear',
    name: 'Sharpened Spear',
    category: 'tools',
    description: 'Hardened wooden shaft with sharp flint point for hunting crabs, boars, and self-defense.',
    resultItemId: 'spear',
    resultCount: 1,
    ingredients: [
      { itemId: 'driftwood', count: 2 },
      { itemId: 'flint', count: 1 },
      { itemId: 'vine', count: 1 },
    ],
  },
  {
    id: 'water_flask',
    name: 'Coconut Canteen',
    category: 'tools',
    description: 'Hollow coconut flask bound with vine for carrying potable fresh water.',
    resultItemId: 'water_flask',
    resultCount: 1,
    ingredients: [
      { itemId: 'coconut', count: 1 },
      { itemId: 'vine', count: 1 },
    ],
  },
  {
    id: 'cooked_meat',
    name: 'Roasted Meat Ration',
    category: 'survival',
    description: 'Cooked protein that restores high nourishment safely.',
    resultItemId: 'cooked_meat',
    resultCount: 1,
    requiresCampfire: true,
    ingredients: [
      { itemId: 'raw_meat', count: 1 },
      { itemId: 'driftwood', count: 1 },
    ],
  },
  {
    id: 'clean_water',
    name: 'Purified Water',
    category: 'survival',
    description: 'Boil collected water over a campfire to eliminate bacteria.',
    resultItemId: 'clean_water',
    resultCount: 1,
    requiresCampfire: true,
    ingredients: [
      { itemId: 'coconut', count: 1 },
      { itemId: 'driftwood', count: 1 },
    ],
  },
];

// Helper to count items
export function getItemCount(inventory: InventorySlot[], itemId: ItemId): number {
  const slot = inventory.find((s) => s.itemId === itemId);
  return slot ? slot.count : 0;
}

// Check if player has required materials
export function canCraftRecipe(
  inventory: InventorySlot[],
  recipe: CraftingRecipe,
  isNearCampfire: boolean = false
): boolean {
  if (recipe.requiresCampfire && !isNearCampfire) {
    return false;
  }
  for (const ing of recipe.ingredients) {
    if (getItemCount(inventory, ing.itemId) < ing.count) {
      return false;
    }
  }
  return true;
}

// Add item to inventory
export function addItemToInventory(
  inventory: InventorySlot[],
  itemId: ItemId,
  count: number = 1
): InventorySlot[] {
  const next = inventory.map((s) => ({ ...s }));
  const existing = next.find((s) => s.itemId === itemId);
  if (existing) {
    existing.count += count;
  } else {
    next.push({ itemId, count });
  }
  return next;
}

// Remove item from inventory
export function removeItemFromInventory(
  inventory: InventorySlot[],
  itemId: ItemId,
  count: number = 1
): { success: boolean; inventory: InventorySlot[] } {
  const currentCount = getItemCount(inventory, itemId);
  if (currentCount < count) {
    return { success: false, inventory };
  }

  const next = inventory
    .map((s) => {
      if (s.itemId === itemId) {
        return { ...s, count: s.count - count };
      }
      return { ...s };
    })
    .filter((s) => s.count > 0);

  return { success: true, inventory: next };
}

// Craft recipe
export function craftRecipe(
  inventory: InventorySlot[],
  recipe: CraftingRecipe,
  isNearCampfire: boolean = false
): { success: boolean; inventory: InventorySlot[]; message?: string } {
  if (!canCraftRecipe(inventory, recipe, isNearCampfire)) {
    return { success: false, inventory, message: 'Missing required ingredients or campfire' };
  }

  let updated = inventory;
  for (const ing of recipe.ingredients) {
    const res = removeItemFromInventory(updated, ing.itemId, ing.count);
    if (!res.success) {
      return { success: false, inventory, message: 'Ingredient deduction failed' };
    }
    updated = res.inventory;
  }

  updated = addItemToInventory(updated, recipe.resultItemId, recipe.resultCount);
  return { success: true, inventory: updated };
}

// Ambient temperature calculation
export function calculateAmbientTemp(hour: number, weather: WeatherType): number {
  // Base daily curve: min ~18°C around 04:00, max ~36°C around 13:00
  const hourNormalized = (hour - 4 + 24) % 24; // 0 at 4am
  const solarFactor = Math.sin((hourNormalized / 24) * Math.PI * 2 - Math.PI / 2); // -1 at 4am, +1 at 16:00
  let base = 26 + solarFactor * 9; // Range: 17°C to 35°C

  if (weather === 'sweltering') {
    base += 5;
  } else if (weather === 'rain') {
    base -= 4;
  } else if (weather === 'storm') {
    base -= 7;
  }
  return Math.round(base * 10) / 10;
}

// Body temperature drift calculation
export function calculateBodyTempDrift(
  currentTemp: number,
  ambientTemp: number,
  isNearFire: boolean,
  holdingTorch: boolean,
  isWet: boolean,
  isSheltered: boolean = false
): number {
  let effectiveAmbient = ambientTemp;

  if (isNearFire) {
    effectiveAmbient += 16;
  }
  if (holdingTorch) {
    effectiveAmbient += 4;
  }
  if (isWet) {
    effectiveAmbient -= 5;
  }
  if (isSheltered) {
    // Shelter buffers extreme weather towards pleasant 28°C
    effectiveAmbient = effectiveAmbient * 0.5 + 28 * 0.5;
  }

  // Target body temp shifts towards ambient if extreme, otherwise normalizes to 37.0°C
  let targetTemp = 37.0;
  if (effectiveAmbient < 20) {
    // Cold environment
    targetTemp = 37.0 - (20 - effectiveAmbient) * 0.15; // e.g. 10C -> 35.5C
  } else if (effectiveAmbient > 36) {
    // Sweltering environment
    targetTemp = 37.0 + (effectiveAmbient - 36) * 0.18; // e.g. 42C -> 38.08C
  }

  // Drift rate towards target
  const diff = targetTemp - currentTemp;
  return diff;
}

// Player survival stats tick
export function updatePlayerStats(
  stats: PlayerStats,
  dtSeconds: number,
  ambientTemp: number,
  options: {
    isNearFire: boolean;
    holdingTorch: boolean;
    isSheltered: boolean;
    isMoving: boolean;
  }
): PlayerStats {
  const next = { ...stats };

  // Stamina regeneration or drain
  if (next.isSprinting && options.isMoving) {
    next.stamina = Math.max(0, next.stamina - dtSeconds * 16);
    if (next.stamina <= 0) {
      next.isSprinting = false;
    }
  } else {
    // Regain stamina
    const regenMultiplier = next.thirst > 30 && next.hunger > 30 ? 1.0 : 0.4;
    next.stamina = Math.min(100, next.stamina + dtSeconds * 20 * regenMultiplier);
  }

  // Hunger drain: ~1 unit per 80s, increased by sprint
  const sprintHungerMul = next.isSprinting ? 1.8 : 1.0;
  next.hunger = Math.max(0, next.hunger - (dtSeconds / 60) * 1.5 * sprintHungerMul);

  // Thirst drain: base ~1 unit per 40s. Heavy noon heat and sprint accelerates it
  const heatThirstMul = ambientTemp > 33 ? 2.2 : 1.0;
  const sprintThirstMul = next.isSprinting ? 1.6 : 1.0;
  next.thirst = Math.max(0, next.thirst - (dtSeconds / 60) * 2.5 * heatThirstMul * sprintThirstMul);

  // Temperature adjustment
  const driftRate = calculateBodyTempDrift(
    next.temperature,
    ambientTemp,
    options.isNearFire,
    options.holdingTorch,
    next.isWet,
    options.isSheltered
  );
  // Drift smoothly
  next.temperature = Math.round((next.temperature + driftRate * (dtSeconds * 0.05)) * 100) / 100;

  // Health damage from starvation, dehydration, hypothermia, heatstroke
  let healthChange = 0;
  if (next.hunger <= 0) healthChange -= dtSeconds * 1.2;
  if (next.thirst <= 0) healthChange -= dtSeconds * 2.0;

  // Hypothermia (< 35.0 C)
  if (next.temperature < 35.0) {
    healthChange -= dtSeconds * (35.0 - next.temperature) * 1.5;
  }
  // Heatstroke (> 39.0 C)
  if (next.temperature > 39.0) {
    healthChange -= dtSeconds * (next.temperature - 39.0) * 1.5;
  }

  // Health natural regeneration if well-fed, hydrated, and normal temp
  if (
    healthChange === 0 &&
    next.hunger > 65 &&
    next.thirst > 65 &&
    next.temperature >= 36.2 &&
    next.temperature <= 37.8
  ) {
    healthChange += dtSeconds * 0.8;
  }

  next.health = Math.min(100, Math.max(0, next.health + healthChange));

  return next;
}

// Escape System Helpers
export function canAdvanceRaft(
  escape: EscapeState,
  inventory: InventorySlot[]
): { canAdvance: boolean; nextPhaseName: string; required: RecipeRequirement[] } {
  const p = escape.raftProgress;
  if (p.isComplete) {
    return { canAdvance: false, nextPhaseName: 'Complete', required: [] };
  }

  if (p.phase === 0) {
    // Phase 1: Hull Keel & Logs
    const req: RecipeRequirement[] = [
      { itemId: 'wood', count: 6 },
      { itemId: 'rope', count: 4 },
    ];
    const can = req.every((r) => getItemCount(inventory, r.itemId) >= r.count);
    return { canAdvance: can, nextPhaseName: 'Assemble Hull & Lashings', required: req };
  } else if (p.phase === 1) {
    // Phase 2: Decking & Outriggers
    const req: RecipeRequirement[] = [
      { itemId: 'wood', count: 4 },
      { itemId: 'rope', count: 2 },
    ];
    const can = req.every((r) => getItemCount(inventory, r.itemId) >= r.count);
    return { canAdvance: can, nextPhaseName: 'Construct Deck & Stabilizers', required: req };
  } else if (p.phase === 2) {
    // Phase 3: Mast & Woven Frond Sail
    const req: RecipeRequirement[] = [
      { itemId: 'wood', count: 2 },
      { itemId: 'palm_frond', count: 6 },
      { itemId: 'rope', count: 2 },
    ];
    const can = req.every((r) => getItemCount(inventory, r.itemId) >= r.count);
    return { canAdvance: can, nextPhaseName: 'Erect Mast & Rig Sail', required: req };
  } else if (p.phase === 3) {
    // Phase 4: Stockpile 3 Rations & 3 Purified Water
    const req: RecipeRequirement[] = [
      { itemId: 'cooked_meat', count: 3 },
      { itemId: 'clean_water', count: 3 },
    ];
    const can = req.every((r) => getItemCount(inventory, r.itemId) >= r.count);
    return { canAdvance: can, nextPhaseName: 'Stockpile Sea Rations & Launch', required: req };
  }

  return { canAdvance: false, nextPhaseName: 'Ready', required: [] };
}

export function advanceRaft(
  escape: EscapeState,
  inventory: InventorySlot[]
): { success: boolean; escape: EscapeState; inventory: InventorySlot[]; message: string } {
  const check = canAdvanceRaft(escape, inventory);
  if (!check.canAdvance) {
    return {
      success: false,
      escape,
      inventory,
      message: `Need materials for ${check.nextPhaseName}`,
    };
  }

  let updatedInventory = inventory;
  for (const r of check.required) {
    const res = removeItemFromInventory(updatedInventory, r.itemId, r.count);
    if (!res.success) return { success: false, escape, inventory, message: 'Deduction failed' };
    updatedInventory = res.inventory;
  }

  const nextEscape: EscapeState = JSON.parse(JSON.stringify(escape));
  nextEscape.raftProgress.phase += 1;
  if (nextEscape.raftProgress.phase >= 4) {
    nextEscape.raftProgress.isComplete = true;
    nextEscape.escaped = true;
    nextEscape.escapeMethod = 'raft';
    return {
      success: true,
      escape: nextEscape,
      inventory: updatedInventory,
      message: 'Raft Fully Stocked! You push off into the open ocean currents towards freedom!',
    };
  }

  return {
    success: true,
    escape: nextEscape,
    inventory: updatedInventory,
    message: `Raft upgrade complete: ${check.nextPhaseName}!`,
  };
}

// Bonfire signal check
export function canBuildBonfire(
  escape: EscapeState,
  inventory: InventorySlot[]
): { canBuild: boolean; required: RecipeRequirement[] } {
  if (escape.bonfireProgress.built) {
    return { canBuild: false, required: [] };
  }
  const req: RecipeRequirement[] = [
    { itemId: 'stone', count: 6 },
    { itemId: 'wood', count: 8 },
    { itemId: 'palm_frond', count: 4 },
  ];
  const can = req.every((r) => getItemCount(inventory, r.itemId) >= r.count);
  return { canBuild: can, required: req };
}

export function buildBonfire(
  escape: EscapeState,
  inventory: InventorySlot[]
): { success: boolean; escape: EscapeState; inventory: InventorySlot[]; message: string } {
  const check = canBuildBonfire(escape, inventory);
  if (!check.canBuild) {
    return {
      success: false,
      escape,
      inventory,
      message: 'Need 6 Stones, 8 Wood, and 4 Palm Fronds to build the Peak Signal Pyre',
    };
  }

  let updatedInventory = inventory;
  for (const r of check.required) {
    const res = removeItemFromInventory(updatedInventory, r.itemId, r.count);
    if (!res.success) return { success: false, escape, inventory, message: 'Deduction failed' };
    updatedInventory = res.inventory;
  }

  const nextEscape: EscapeState = JSON.parse(JSON.stringify(escape));
  nextEscape.bonfireProgress.built = true;
  return {
    success: true,
    escape: nextEscape,
    inventory: updatedInventory,
    message: 'Giant Signal Bonfire built atop the volcanic peak! Light it when a ship/plane passes!',
  };
}

export function lightBonfire(
  escape: EscapeState,
  hasTorchOrFlare: boolean
): { success: boolean; escape: EscapeState; message: string } {
  if (!escape.bonfireProgress.built) {
    return { success: false, escape, message: 'Build the bonfire hearth first.' };
  }
  if (!hasTorchOrFlare) {
    return { success: false, escape, message: 'Need a lit Torch or Flare Gun to ignite the pyre.' };
  }

  const nextEscape: EscapeState = JSON.parse(JSON.stringify(escape));
  nextEscape.bonfireProgress.isLit = true;
  nextEscape.bonfireProgress.burnTimeRemaining = 90; // burns for 90s

  // If horizon event is active right now, rescue is triggered!
  if (escape.horizonEvent.active) {
    nextEscape.escaped = true;
    nextEscape.escapeMethod = 'signal_fire';
    return {
      success: true,
      escape: nextEscape,
      message:
        'The massive smoke plume is spotted by the passing vessel! Foghorn responds — Rescue is here!',
    };
  }

  return {
    success: true,
    escape: nextEscape,
    message: 'Signal Bonfire ignited! Dense smoke ascends high into the sky!',
  };
}

// Radio escape helpers
export function canRepairRadio(
  escape: EscapeState,
  inventory: InventorySlot[]
): { canRepair: boolean; required: RecipeRequirement[] } {
  if (escape.radioProgress.built) {
    return { canRepair: false, required: [] };
  }
  const req: RecipeRequirement[] = [
    { itemId: 'battery', count: 1 },
    { itemId: 'copper_wire', count: 2 },
    { itemId: 'antenna', count: 1 },
    { itemId: 'flint', count: 1 },
  ];
  const can = req.every((r) => getItemCount(inventory, r.itemId) >= r.count);
  return { canRepair: can, required: req };
}

export function repairRadio(
  escape: EscapeState,
  inventory: InventorySlot[]
): { success: boolean; escape: EscapeState; inventory: InventorySlot[]; message: string } {
  const check = canRepairRadio(escape, inventory);
  if (!check.canRepair) {
    return {
      success: false,
      escape,
      inventory,
      message: 'Need Marine Battery, 2 Copper Wire, Antenna, and Flint to restore the transceiver.',
    };
  }

  let updatedInventory = inventory;
  for (const r of check.required) {
    const res = removeItemFromInventory(updatedInventory, r.itemId, r.count);
    if (!res.success) return { success: false, escape, inventory, message: 'Deduction failed' };
    updatedInventory = res.inventory;
  }

  const nextEscape: EscapeState = JSON.parse(JSON.stringify(escape));
  nextEscape.radioProgress.built = true;
  nextEscape.radioProgress.isCalibrated = true;
  nextEscape.escaped = true;
  nextEscape.escapeMethod = 'radio';

  return {
    success: true,
    escape: nextEscape,
    inventory: updatedInventory,
    message:
      'Transceiver powered up! "Mayday Mayday!" ... Coast Guard responds: "Rescue chopper inbound!"',
  };
}
