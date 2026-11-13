/**
 * Tiered crafting recipes (Primitive -> Improved -> Advanced) and pure crafting logic.
 */

import { addItem, countItem, ITEM_DEFS, removeItem } from './items.ts';
import { CraftStation, InventorySlot, Recipe, RecipeIngredient } from './types.ts';

export const RECIPES: Recipe[] = [
  // =========================================================================
  // TIER 1 — PRIMITIVE (Hand-Crafted & Campfire)
  // =========================================================================
  {
    id: 'rope_fibre',
    name: 'Braided Plant Cordage',
    tier: 1,
    station: 'hands',
    result: { itemId: 'rope', count: 1 },
    ingredients: [{ itemId: 'fibre', count: 2 }],
    description: 'Twist tough coastal plant fibres into sturdy lashing rope.',
  },
  {
    id: 'rope_frond',
    name: 'Stripped Frond Rope',
    tier: 1,
    station: 'hands',
    result: { itemId: 'rope', count: 1 },
    ingredients: [{ itemId: 'palm_frond', count: 2 }],
    description: 'Split and braid palm frond ribs into serviceable cordage.',
  },
  {
    id: 'stone_axe',
    name: 'Stone Hatchet',
    tier: 1,
    station: 'hands',
    result: { itemId: 'stone_axe', count: 1 },
    ingredients: [
      { itemId: 'stick', count: 2 },
      { itemId: 'flint', count: 2 },
      { itemId: 'rope', count: 1 },
    ],
    description: 'Essential primitive axe for felling palm trees into heavy logs.',
  },
  {
    id: 'stone_pick',
    name: 'Flint Pickaxe',
    tier: 1,
    station: 'hands',
    result: { itemId: 'stone_pick', count: 1 },
    ingredients: [
      { itemId: 'stick', count: 2 },
      { itemId: 'flint', count: 2 },
      { itemId: 'stone', count: 1 },
      { itemId: 'rope', count: 1 },
    ],
    description: 'Cracks volcanic boulders and pries open fuselage wreckage.',
  },
  {
    id: 'spear',
    name: 'Fire-Hardened Spear',
    tier: 1,
    station: 'hands',
    result: { itemId: 'spear', count: 1 },
    ingredients: [
      { itemId: 'stick', count: 3 },
      { itemId: 'flint', count: 1 },
      { itemId: 'rope', count: 1 },
    ],
    description: 'Balanced throwing and thrusting spear for lagoon fishing and defense.',
  },
  {
    id: 'torch',
    name: 'Pitch Torch',
    tier: 1,
    station: 'hands',
    result: { itemId: 'torch', count: 1 },
    ingredients: [
      { itemId: 'stick', count: 1 },
      { itemId: 'palm_frond', count: 1 },
      { itemId: 'fibre', count: 1 },
    ],
    description: 'Portable firelight that pushes back darkness and night chill.',
  },
  {
    id: 'campfire_kit',
    name: 'Stone Ring Campfire',
    tier: 1,
    station: 'hands',
    result: { itemId: 'campfire_kit', count: 1 },
    ingredients: [
      { itemId: 'stick', count: 4 },
      { itemId: 'stone', count: 5 },
      { itemId: 'palm_frond', count: 2 },
    ],
    description: 'Assemble a sheltered fire pit for warmth, boiling water, and roasting food.',
  },
  {
    id: 'shelter_kit',
    name: 'Palm Lean-To Shelter',
    tier: 1,
    station: 'hands',
    result: { itemId: 'shelter_kit', count: 1 },
    ingredients: [
      { itemId: 'log', count: 4 },
      { itemId: 'palm_frond', count: 6 },
      { itemId: 'rope', count: 2 },
      { itemId: 'stick', count: 4 },
    ],
    description: 'Sturdy frond lean-to with woven mat. Protects from rain/chill and lets you sleep till dawn & save.',
  },
  {
    id: 'boil_water',
    name: 'Boil Clean Water',
    tier: 1,
    station: 'campfire',
    result: { itemId: 'water_bottle_clean', count: 1 },
    ingredients: [
      { itemId: 'water_bottle_dirty', count: 1 },
      { itemId: 'stick', count: 1 },
    ],
    description: 'Sterilize murky spring water over a lit campfire so it is safe to drink.',
  },
  {
    id: 'cook_fish',
    name: 'Char-Grilled Reef Fish',
    tier: 1,
    station: 'campfire',
    result: { itemId: 'cooked_fish', count: 1 },
    ingredients: [
      { itemId: 'raw_fish', count: 1 },
      { itemId: 'stick', count: 1 },
    ],
    description: 'Roast raw lagoon fish over hot embers for safe, restorative protein.',
  },
  {
    id: 'cook_meat',
    name: 'Fire-Roasted Game Meat',
    tier: 1,
    station: 'campfire',
    result: { itemId: 'cooked_meat', count: 1 },
    ingredients: [
      { itemId: 'raw_meat', count: 1 },
      { itemId: 'stick', count: 1 },
    ],
    description: 'Sear raw meat over open flames to eliminate parasites and boost nutrition.',
  },
  {
    id: 'medicinal_poultice',
    name: 'Herbal Healing Poultice',
    tier: 1,
    station: 'hands',
    result: { itemId: 'medicinal_poultice', count: 1 },
    ingredients: [
      { itemId: 'herb', count: 2 },
      { itemId: 'fibre', count: 1 },
    ],
    description: 'Crush soothing jungle herbs in plant wrap. Restores health and cures viper venom or poisoning.',
  },

  // =========================================================================
  // TIER 2 — IMPROVED (Requires Workbench)
  // =========================================================================
  {
    id: 'plank',
    name: 'Hewn Timber Planks (x2)',
    tier: 2,
    station: 'workbench',
    result: { itemId: 'plank', count: 2 },
    ingredients: [{ itemId: 'log', count: 1 }],
    description: 'Split a heavy timber log into flat structural boards.',
  },
  {
    id: 'machete',
    name: 'Brush Machete',
    tier: 2,
    station: 'workbench',
    result: { itemId: 'machete', count: 1 },
    ingredients: [
      { itemId: 'scrap_metal', count: 2 },
      { itemId: 'stick', count: 1 },
      { itemId: 'rope', count: 1 },
    ],
    description: 'Sharpened aircraft-alloy blade that cuts through dense banyan vine barriers.',
  },
  {
    id: 'climbing_gear',
    name: 'Climbing Rope & Pitons',
    tier: 2,
    station: 'workbench',
    result: { itemId: 'climbing_gear', count: 1 },
    ingredients: [
      { itemId: 'rope', count: 3 },
      { itemId: 'scrap_metal', count: 2 },
      { itemId: 'plank', count: 1 },
    ],
    description: 'Heavy belay cord and piton spikes for scaling the Western Basalt Cliff Ledge.',
  },
  {
    id: 'river_raft',
    name: 'Lashed Gorge Raft',
    tier: 2,
    station: 'workbench',
    result: { itemId: 'river_raft', count: 1 },
    ingredients: [
      { itemId: 'log', count: 6 },
      { itemId: 'plank', count: 3 },
      { itemId: 'rope', count: 4 },
    ],
    description: 'Buoyant log pontoon capable of ferrying across the Eastern River Rapids.',
  },
  {
    id: 'lantern',
    name: 'Resin Brass Lantern',
    tier: 2,
    station: 'workbench',
    result: { itemId: 'lantern', count: 1 },
    ingredients: [
      { itemId: 'resin', count: 2 },
      { itemId: 'scrap_metal', count: 2 },
      { itemId: 'cloth_scrap', count: 1 },
    ],
    description: 'Clean-burning pitch-oil lantern built for exploring dark caves and stormy highland nights.',
  },
  {
    id: 'metal_axe',
    name: 'Salvaged Steel Axe',
    tier: 2,
    station: 'workbench',
    result: { itemId: 'metal_axe', count: 1 },
    ingredients: [
      { itemId: 'scrap_metal', count: 3 },
      { itemId: 'plank', count: 1 },
      { itemId: 'rope', count: 1 },
    ],
    description: 'Heavy-duty axe with triple durability, double chopping power, and thicket clearing.',
  },
  {
    id: 'metal_pick',
    name: 'Salvaged Steel Pickaxe',
    tier: 2,
    station: 'workbench',
    result: { itemId: 'metal_pick', count: 1 },
    ingredients: [
      { itemId: 'scrap_metal', count: 3 },
      { itemId: 'plank', count: 1 },
      { itemId: 'rope', count: 1 },
    ],
    description: 'Reinforced steel pick capable of breaking highland iron and deep cave copper veins.',
  },

  // =========================================================================
  // TIER 3 — ADVANCED (Requires Forge)
  // =========================================================================
  {
    id: 'smelt_ingot',
    name: 'Smelt Alloy Ingot',
    tier: 3,
    station: 'forge',
    result: { itemId: 'metal_ingot', count: 1 },
    ingredients: [
      { itemId: 'scrap_metal', count: 2 },
      { itemId: 'log', count: 1 },
    ],
    description: 'Smelt salvaged fuselage scrap into high-grade structural alloy.',
  },
  {
    id: 'smelt_iron_ingot',
    name: 'Smelt Highland Iron (x2)',
    tier: 3,
    station: 'forge',
    result: { itemId: 'metal_ingot', count: 2 },
    ingredients: [
      { itemId: 'iron_ore', count: 2 },
      { itemId: 'coal', count: 1 },
    ],
    description: 'Refine mined ferric rock with coal embers into twin Alloy Ingots.',
  },
];

export function checkRecipeAvailability(
  recipe: Recipe,
  inventory: (InventorySlot | null)[],
  nearbyStations: ReadonlySet<CraftStation>,
  flags: Record<string, boolean> = {}
): {
  canCraft: boolean;
  stationOk: boolean;
  flagOk: boolean;
  missingIngredients: RecipeIngredient[];
} {
  const flagOk = !recipe.requiresFlag || Boolean(flags[recipe.requiresFlag]);
  const stationOk = recipe.station === 'hands' || nearbyStations.has(recipe.station);
  const missingIngredients: RecipeIngredient[] = [];

  for (const req of recipe.ingredients) {
    const have = countItem(inventory, req.itemId);
    if (have < req.count) {
      missingIngredients.push({ itemId: req.itemId, count: req.count - have });
    }
  }

  return {
    canCraft: flagOk && stationOk && missingIngredients.length === 0,
    stationOk,
    flagOk,
    missingIngredients,
  };
}

export function craftRecipeById(
  recipeId: string,
  inventory: (InventorySlot | null)[],
  nearbyStations: ReadonlySet<CraftStation>,
  flags: Record<string, boolean> = {}
): {
  ok: boolean;
  inventory: (InventorySlot | null)[];
  message: string;
} {
  const recipe = RECIPES.find((r) => r.id === recipeId);
  if (!recipe) {
    return { ok: false, inventory, message: 'Unknown recipe.' };
  }

  const check = checkRecipeAvailability(recipe, inventory, nearbyStations, flags);
  if (!check.flagOk) {
    return { ok: false, inventory, message: 'You have not discovered how to craft this yet.' };
  }
  if (!check.stationOk) {
    const stationLabel =
      recipe.station === 'campfire'
        ? 'a lit Campfire'
        : recipe.station === 'workbench'
          ? 'a Workbench'
          : 'a Forge';
    return { ok: false, inventory, message: `Requires ${stationLabel} nearby.` };
  }
  if (check.missingIngredients.length > 0) {
    const missingText = check.missingIngredients
      .map((m) => `${m.count}x ${ITEM_DEFS[m.itemId].name}`)
      .join(', ');
    return { ok: false, inventory, message: `Missing: ${missingText}` };
  }

  let updated = inventory;
  for (const req of recipe.ingredients) {
    const res = removeItem(updated, req.itemId, req.count);
    if (!res.success) {
      return { ok: false, inventory, message: 'Missing required materials.' };
    }
    updated = res.inventory;
  }

  const addedRes = addItem(updated, recipe.result.itemId, recipe.result.count);
  if (addedRes.added === 0) {
    return { ok: false, inventory, message: 'Inventory is full!' };
  }

  return {
    ok: true,
    inventory: addedRes.inventory,
    message: `Crafted ${recipe.result.count}x ${ITEM_DEFS[recipe.result.itemId].name}`,
  };
}
