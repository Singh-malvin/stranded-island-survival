/**
 * Tiered crafting recipes (Primitive -> Improved -> Advanced) and pure crafting logic.
 */

import { addItem, countItem, ITEM_DEFS, removeItem } from './items.ts';
import { CraftStation, InventorySlot, ItemId, Recipe, RecipeIngredient } from './types.ts';

export interface ItemRecipeUsage {
  recipeId: string;
  recipeName: string;
  resultName: string;
}

const recipeUsageCache = new Map<ItemId, ItemRecipeUsage[]>();

/** Returns every crafting recipe that uses `itemId` as an ingredient (memoized). */
export function getRecipesUsingItem(itemId: ItemId): ItemRecipeUsage[] {
  const cached = recipeUsageCache.get(itemId);
  if (cached) return cached;
  const uses: ItemRecipeUsage[] = [];
  for (const r of RECIPES) {
    if (r.ingredients.some((ing) => ing.itemId === itemId)) {
      uses.push({
        recipeId: r.id,
        recipeName: r.name,
        resultName: ITEM_DEFS[r.result.itemId].name,
      });
    }
  }
  recipeUsageCache.set(itemId, uses);
  return uses;
}

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
  {
    id: 'driftwood_torch',
    name: 'Seasoned Driftwood Torch',
    tier: 1,
    station: 'hands',
    result: { itemId: 'torch', count: 1 },
    ingredients: [
      { itemId: 'driftwood', count: 1 },
      { itemId: 'fibre', count: 1 },
    ],
    description: 'Slow-burning torch built from kiln-seasoned Driftwood.',
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
    id: 'driftwood_planks',
    name: 'Seasoned Driftwood Planks (x2)',
    tier: 2,
    station: 'workbench',
    result: { itemId: 'plank', count: 2 },
    ingredients: [{ itemId: 'driftwood', count: 2 }],
    description: 'Mill forge-seasoned Driftwood into weather-resistant boat & bench planks.',
  },
  {
    id: 'driftwood_spear',
    name: 'Balanced Driftwood Spear',
    tier: 2,
    station: 'workbench',
    result: { itemId: 'spear', count: 1 },
    ingredients: [
      { itemId: 'driftwood', count: 2 },
      { itemId: 'flint', count: 1 },
      { itemId: 'rope', count: 1 },
    ],
    description: 'Carve hardened kiln Driftwood into a straight, durable hunting & reef spear.',
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
  {
    id: 'driftwood_charcoal',
    name: 'Kiln Hardwood Coal (x2)',
    tier: 3,
    station: 'forge',
    result: { itemId: 'coal', count: 2 },
    ingredients: [{ itemId: 'driftwood', count: 1 }],
    description: 'Reduce dense forge-cured Driftwood into hot charcoal briquettes for Alloy smelting.',
  },

  // =========================================================================
  // COMBAT ARSENAL (Hunting & Final Showdown Gear)
  // =========================================================================
  {
    id: 'bow',
    name: 'Recurve Hunting Bow',
    tier: 1,
    station: 'hands',
    result: { itemId: 'bow', count: 1 },
    ingredients: [
      { itemId: 'stick', count: 3 },
      { itemId: 'rope', count: 2 },
      { itemId: 'fibre', count: 3 },
    ],
    description: 'Balanced sinew-backed bow for long-range hunting and boss engagements.',
  },
  {
    id: 'arrow',
    name: 'Obsidian Arrows (x6)',
    tier: 1,
    station: 'hands',
    result: { itemId: 'arrow', count: 6 },
    ingredients: [
      { itemId: 'stick', count: 2 },
      { itemId: 'flint', count: 2 },
      { itemId: 'fibre', count: 2 },
    ],
    description: 'Fletched flint-and-obsidian arrows.',
  },
  {
    id: 'fire_bomb',
    name: 'Resin Fire Bomb (x2)',
    tier: 2,
    station: 'hands',
    result: { itemId: 'fire_bomb', count: 2 },
    ingredients: [
      { itemId: 'resin', count: 2 },
      { itemId: 'cloth_scrap', count: 1 },
      { itemId: 'coal', count: 1 },
    ],
    description: 'Incendiary glass flask that bursts in a blazing puddle and ignites tough foes.',
  },
  {
    id: 'flare_gun',
    name: 'Signal Flare Gun',
    tier: 3,
    station: 'workbench',
    result: { itemId: 'flare_gun', count: 1 },
    ingredients: [
      { itemId: 'metal_ingot', count: 1 },
      { itemId: 'scrap_metal', count: 2 },
      { itemId: 'resin', count: 1 },
    ],
    description: 'Reinforced distress launcher firing magnesium flares at critical weak points.',
  },
  {
    id: 'flare_ammo',
    name: 'Magnesium Flares (x3)',
    tier: 2,
    station: 'hands',
    result: { itemId: 'flare_ammo', count: 3 },
    ingredients: [
      { itemId: 'coal', count: 2 },
      { itemId: 'scrap_metal', count: 1 },
      { itemId: 'resin', count: 1 },
    ],
    description: 'High-luminance signal rounds capable of disrupting Aura defenses.',
  },
  {
    id: 'lockpick',
    name: 'Spring-Steel Lockpick',
    tier: 2,
    station: 'workbench',
    result: { itemId: 'lockpick', count: 2 },
    ingredients: [
      { itemId: 'scrap_metal', count: 1 },
      { itemId: 'copper_wire', count: 1 },
    ],
    description: 'Quiet tension picks for slipping Stronghold locks and jail cells.',
  },
  {
    id: 'harpoon_gun',
    name: 'Pneumatic Harpoon Gun',
    tier: 3,
    station: 'forge',
    result: { itemId: 'harpoon_gun', count: 1 },
    ingredients: [
      { itemId: 'metal_ingot', count: 3 },
      { itemId: 'copper_wire', count: 2 },
      { itemId: 'rope', count: 3 },
    ],
    description: 'High-impact maritime harpoon launcher built to pierce Aura guards and chase threats.',
  },
  {
    id: 'harpoon_bolt',
    name: 'Barbed Harpoon Bolts (x4)',
    tier: 3,
    station: 'workbench',
    result: { itemId: 'harpoon_bolt', count: 4 },
    ingredients: [
      { itemId: 'metal_ingot', count: 1 },
      { itemId: 'stick', count: 2 },
    ],
    description: 'Machined steel harpoons.',
  },
  {
    id: 'aura_rifle_craft',
    name: 'Aura-Infused Rifle',
    tier: 3,
    station: 'forge',
    result: { itemId: 'aura_rifle', count: 1 },
    ingredients: [
      { itemId: 'circuit_board', count: 1 },
      { itemId: 'metal_ingot', count: 3 },
      { itemId: 'aura_shard', count: 2 },
    ],
    description: 'Channel island Aura Crystals through salvaged avionics barrels — OR steal one in the Stronghold Armory.',
  },
  {
    id: 'rifle_ammo_craft',
    name: 'Aura Capacitor Cells (x6)',
    tier: 3,
    station: 'workbench',
    result: { itemId: 'rifle_ammo', count: 6 },
    ingredients: [
      { itemId: 'aura_shard', count: 1 },
      { itemId: 'copper_wire', count: 1 },
    ],
    description: 'Recharge Aura Rifle crystal bolts.',
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
