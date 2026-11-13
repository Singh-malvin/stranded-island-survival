/**
 * Item definitions and pure inventory operations.
 */

import {
  INVENTORY,
  LANTERN_BURN_REAL_SEC,
  TOOL_DURABILITY,
  TORCH_BURN_REAL_SEC,
} from './config.ts';
import { InventorySlot, ItemDef, ItemId } from './types.ts';

export const ITEM_DEFS: Record<ItemId, ItemDef> = {
  // --- Raw resources ---
  stick: {
    id: 'stick',
    name: 'Driftwood Branch',
    category: 'resource',
    description: 'Dry seasoned wood gathered from the tideline or underbrush. Used for tool shafts and kindling.',
    icon: '🪵',
    stack: INVENTORY.DEFAULT_STACK,
    loseOnDeath: true,
  },
  log: {
    id: 'log',
    name: 'Timber Log',
    category: 'resource',
    description: 'Heavy trunk felled from a palm or hardwood tree with an axe.',
    icon: '🌲',
    stack: 15,
    loseOnDeath: true,
  },
  stone: {
    id: 'stone',
    name: 'Rough Stone',
    category: 'resource',
    description: 'Dense volcanic rock used for fire rings, tools, and foundations.',
    icon: '🪨',
    stack: INVENTORY.DEFAULT_STACK,
    loseOnDeath: true,
  },
  flint: {
    id: 'flint',
    name: 'Sharp Flint',
    category: 'resource',
    description: 'Fractured dark chert with a razor edge. Knapped into blades and sparks fire.',
    icon: '🔪',
    stack: INVENTORY.DEFAULT_STACK,
    loseOnDeath: true,
  },
  fibre: {
    id: 'fibre',
    name: 'Plant Fibre',
    category: 'resource',
    description: 'Tough fibrous stalks stripped from coastal shrubs. Braided into cordage.',
    icon: '🌿',
    stack: INVENTORY.DEFAULT_STACK,
    loseOnDeath: true,
  },
  palm_frond: {
    id: 'palm_frond',
    name: 'Palm Frond',
    category: 'resource',
    description: 'Broad waxy leaf used for thatch roofing, bedding, and tinder.',
    icon: '🌴',
    stack: INVENTORY.DEFAULT_STACK,
    loseOnDeath: true,
  },
  shell: {
    id: 'shell',
    name: 'Sea Shell',
    category: 'resource',
    description: 'Curved littoral shell useful for scraping, ornaments, and rain catchers.',
    icon: '🐚',
    stack: INVENTORY.DEFAULT_STACK,
    loseOnDeath: true,
  },
  scrap_metal: {
    id: 'scrap_metal',
    name: 'Aircraft Scrap Metal',
    category: 'resource',
    description: 'Torn duralumin and steel ribs salvaged from the crash wreckage.',
    icon: '🔩',
    stack: 20,
    loseOnDeath: true,
  },
  cloth_scrap: {
    id: 'cloth_scrap',
    name: 'Torn Canvas Cloth',
    category: 'resource',
    description: 'Weathered fabric salvaged from luggage and seat upholstery.',
    icon: '🧶',
    stack: 20,
    loseOnDeath: true,
  },
  resin: {
    id: 'resin',
    name: 'Pine Pitch Resin',
    category: 'resource',
    description: 'Sticky flammable tree sap used for waterproofing, lanterns, and torches.',
    icon: '💧',
    stack: 20,
    loseOnDeath: true,
  },
  iron_ore: {
    id: 'iron_ore',
    name: 'Highland Iron Ore',
    category: 'resource',
    description: 'Dense ferric rock veined along cliffs and gorge banks. Smelt in a Stone Forge.',
    icon: '🪨',
    stack: 20,
    loseOnDeath: true,
  },
  coal: {
    id: 'coal',
    name: 'Black Coal Seam',
    category: 'resource',
    description: 'High-heat mineral coal chipped from interior basalt seams.',
    icon: '⬛',
    stack: 20,
    loseOnDeath: true,
  },
  copper_wire: {
    id: 'copper_wire',
    name: 'Spool of Copper Wire',
    category: 'resource',
    description: 'Salvaged conductive cabling essential for repairing the island radio.',
    icon: '🧵',
    stack: 10,
    loseOnDeath: false,
  },
  circuit_board: {
    id: 'circuit_board',
    name: 'Avionics Circuit Board',
    category: 'resource',
    description: 'Intact Flight 404 transceiver module recovered from the tail section.',
    icon: '📟',
    stack: 5,
    loseOnDeath: false,
  },
  fuel_can: {
    id: 'fuel_can',
    name: 'Diesel Jerrycan',
    category: 'resource',
    description: 'Heavy pressurized fuel canister needed to start the Research Station generator.',
    icon: '⛽',
    stack: 4,
    loseOnDeath: false,
  },
  herb: {
    id: 'herb',
    name: 'Jungle Medicinal Leaf',
    category: 'resource',
    description: 'Aromatic broad-leaf herb used to brew antiseptic healing poultices.',
    icon: '🌱',
    stack: 20,
    loseOnDeath: true,
  },

  // --- Processed materials ---
  rope: {
    id: 'rope',
    name: 'Braided Cordage',
    category: 'resource',
    description: 'Strong lashed plant-fibre rope for binding tools and shelter frames.',
    icon: '🪢',
    stack: 20,
    loseOnDeath: true,
  },
  plank: {
    id: 'plank',
    name: 'Hewn Plank',
    category: 'resource',
    description: 'Squared timber board cut at a workbench.',
    icon: '📏',
    stack: 20,
    loseOnDeath: true,
  },
  metal_ingot: {
    id: 'metal_ingot',
    name: 'Forged Alloy Ingot',
    category: 'resource',
    description: 'Refined metal bar smelted in a charcoal forge.',
    icon: '🧱',
    stack: 15,
    loseOnDeath: false,
  },

  // --- Food & water ---
  coconut: {
    id: 'coconut',
    name: 'Fresh Coconut',
    category: 'food',
    description: 'Sweet electrolyte water and white flesh. Safe to consume raw.',
    icon: '🥥',
    stack: 10,
    food: { hunger: 12, thirst: 22, health: 2, sickChance: 0 },
    loseOnDeath: true,
  },
  berries: {
    id: 'berries',
    name: 'Wild Island Berries',
    category: 'food',
    description: 'Tart coastal berries. Refreshing in small handfuls.',
    icon: '🫐',
    stack: 20,
    food: { hunger: 8, thirst: 8, sickChance: 0.03 },
    loseOnDeath: true,
  },
  raw_fish: {
    id: 'raw_fish',
    name: 'Raw Reef Fish',
    category: 'food',
    description: 'Uncooked lagoon fish. Eating raw carries a high risk of food poisoning.',
    icon: '🐟',
    stack: 10,
    food: { hunger: 16, thirst: -4, sickChance: 0.55 },
    loseOnDeath: true,
  },
  cooked_fish: {
    id: 'cooked_fish',
    name: 'Char-Grilled Fish',
    category: 'food',
    description: 'Flaky fish roasted over open coals. Safe and nourishing.',
    icon: '🍣',
    stack: 10,
    food: { hunger: 34, health: 6, sickChance: 0 },
    loseOnDeath: true,
  },
  dried_fish: {
    id: 'dried_fish',
    name: 'Smoked Reef Jerky',
    category: 'food',
    description: 'Sun-and-breeze cured fish strips. Safe, preserved travel rations.',
    icon: '🍤',
    stack: 15,
    food: { hunger: 36, health: 4, sickChance: 0 },
    loseOnDeath: false,
  },
  raw_meat: {
    id: 'raw_meat',
    name: 'Raw Game Meat',
    category: 'food',
    description: 'Freshly butchered island meat. Dangerous to eat without cooking.',
    icon: '🥩',
    stack: 10,
    food: { hunger: 20, thirst: -6, sickChance: 0.65 },
    loseOnDeath: true,
  },
  cooked_meat: {
    id: 'cooked_meat',
    name: 'Fire-Roasted Meat',
    category: 'food',
    description: 'Hearty seared meat cooked over a campfire. Restores substantial strength.',
    icon: '🍖',
    stack: 10,
    food: { hunger: 46, health: 10, sickChance: 0 },
    loseOnDeath: true,
  },
  dried_meat: {
    id: 'dried_meat',
    name: 'Cured Island Jerky',
    category: 'food',
    description: 'Air-dried spiced meat strips preserved for multi-day island crossings.',
    icon: '🥓',
    stack: 15,
    food: { hunger: 48, health: 6, sickChance: 0 },
    loseOnDeath: false,
  },
  ration_bar: {
    id: 'ration_bar',
    name: 'Emergency Ration Bar',
    category: 'food',
    description: 'Vacuum-sealed high-calorie aviation survival ration.',
    icon: '🍫',
    stack: 10,
    food: { hunger: 42, thirst: 5, health: 8, sickChance: 0 },
    loseOnDeath: false,
  },
  medicinal_poultice: {
    id: 'medicinal_poultice',
    name: 'Herbal Healing Poultice',
    category: 'food',
    description: 'Antiseptic leaf compress. Press [F] to heal +28 HP and cure venom or food poisoning.',
    icon: '🩹',
    stack: 8,
    food: { health: 28, hunger: 2, sickChance: 0 },
    loseOnDeath: false,
  },
  empty_bottle: {
    id: 'empty_bottle',
    name: 'Empty Canteen Bottle',
    category: 'water',
    description: 'Salvaged flask. Fill at a freshwater spring or rain collector.',
    icon: '🫙',
    stack: 5,
    loseOnDeath: false,
  },
  water_bottle_dirty: {
    id: 'water_bottle_dirty',
    name: 'Unboiled Spring Water',
    category: 'water',
    description: 'Untreated creek water. Boil at a campfire to make it safe.',
    icon: '🧪',
    stack: 5,
    food: { thirst: 35, sickChance: 0.35, leaves: 'empty_bottle' },
    loseOnDeath: false,
  },
  water_bottle_clean: {
    id: 'water_bottle_clean',
    name: 'Boiled Clean Water',
    category: 'water',
    description: 'Sterilized drinking water. Restores hydration safely.',
    icon: '💧',
    stack: 5,
    food: { thirst: 50, health: 3, sickChance: 0, leaves: 'empty_bottle' },
    loseOnDeath: false,
  },

  // --- Tools & light ---
  stone_axe: {
    id: 'stone_axe',
    name: 'Stone Hatchet',
    category: 'tool',
    description: 'Knapped flint lashed to a hardwood handle. Fells palm trees into logs.',
    icon: '🪓',
    stack: 1,
    tool: { kind: 'axe', tier: 1 },
    loseOnDeath: false,
  },
  stone_pick: {
    id: 'stone_pick',
    name: 'Flint Pickaxe',
    category: 'tool',
    description: 'Heavy stone pick for cracking boulders and prying crash debris.',
    icon: '⛏️',
    stack: 1,
    tool: { kind: 'pick', tier: 1 },
    loseOnDeath: false,
  },
  spear: {
    id: 'spear',
    name: 'Fire-Hardened Spear',
    category: 'tool',
    description: 'Long wooden spear for shallow-water fishing and fending off wildlife.',
    icon: '🔱',
    stack: 1,
    tool: { kind: 'spear', tier: 1 },
    loseOnDeath: false,
  },
  torch: {
    id: 'torch',
    name: 'Pitch Torch',
    category: 'light',
    description: 'Hold in hand to light the dark and stave off night chill.',
    icon: '🔥',
    stack: 1,
    tool: { kind: 'torch', tier: 1 },
    loseOnDeath: false,
  },
  lantern: {
    id: 'lantern',
    name: 'Resin Brass Lantern',
    category: 'light',
    description: 'Weatherproof oil lantern for delving dark basalt caves and stormy nights.',
    icon: '🏮',
    stack: 1,
    tool: { kind: 'lantern', tier: 2 },
    loseOnDeath: false,
  },
  metal_axe: {
    id: 'metal_axe',
    name: 'Salvaged Steel Axe',
    category: 'tool',
    description: 'Keen aircraft-steel blade. Chops trees twice as fast and clears dense thickets.',
    icon: '🪓',
    stack: 1,
    tool: { kind: 'axe', tier: 2 },
    loseOnDeath: false,
  },
  metal_pick: {
    id: 'metal_pick',
    name: 'Salvaged Steel Pickaxe',
    category: 'tool',
    description: 'Tempered steel pick capable of breaking deep cave ore veins.',
    icon: '⛏️',
    stack: 1,
    tool: { kind: 'pick', tier: 2 },
    loseOnDeath: false,
  },
  machete: {
    id: 'machete',
    name: 'Brush Machete',
    category: 'tool',
    description: 'Heavy clearing blade for hacking through jungle vine walls.',
    icon: '🗡️',
    stack: 1,
    tool: { kind: 'machete', tier: 2 },
    loseOnDeath: false,
  },
  climbing_gear: {
    id: 'climbing_gear',
    name: 'Climbing Rope & Pitons',
    category: 'story',
    description: 'Sturdy coiled rope and hammered spikes for scaling steep basalt cliff ledges.',
    icon: '🧗',
    stack: 1,
    loseOnDeath: false,
  },
  river_raft: {
    id: 'river_raft',
    name: 'Lashed Gorge Raft',
    category: 'story',
    description: 'Portable timber-and-rope raft built to ferry across swift highland rivers.',
    icon: '🛶',
    stack: 1,
    loseOnDeath: false,
  },
  station_keycard: {
    id: 'station_keycard',
    name: 'Station 3 Security Keycard',
    category: 'story',
    description: 'Magnetic clearance badge etched "Dr. H. Patel". Opens the Caldera Research Station gate.',
    icon: '🪪',
    stack: 1,
    loseOnDeath: false,
  },

  // --- Placeable kits ---
  campfire_kit: {
    id: 'campfire_kit',
    name: 'Campfire Kit',
    category: 'placeable',
    description: 'Select on hotbar and press [E] or click on the ground to build a warm campfire.',
    icon: '🏕️',
    stack: 5,
    loseOnDeath: false,
  },
  shelter_kit: {
    id: 'shelter_kit',
    name: 'Palm Lean-To Shelter',
    category: 'placeable',
    description: 'Woven palm-frond A-frame shelter. Select on hotbar and press [E] or click to place a bed & respawn point.',
    icon: '🛖',
    stack: 2,
    loseOnDeath: false,
  },
};

export function createEmptyInventory(size: number = INVENTORY.SLOTS): (InventorySlot | null)[] {
  return Array.from({ length: size }, () => null);
}

export function getInitialDurability(itemId: ItemId): number | undefined {
  if (itemId === 'torch') return TORCH_BURN_REAL_SEC;
  if (itemId === 'lantern') return LANTERN_BURN_REAL_SEC;
  if (itemId in TOOL_DURABILITY) return TOOL_DURABILITY[itemId];
  return undefined;
}

export function countItem(inventory: (InventorySlot | null)[], itemId: ItemId): number {
  let total = 0;
  for (const slot of inventory) {
    if (slot && slot.itemId === itemId) {
      total += slot.count;
    }
  }
  return total;
}

export function addItem(
  inventory: (InventorySlot | null)[],
  itemId: ItemId,
  count: number
): { inventory: (InventorySlot | null)[]; added: number; overflow: number } {
  if (count <= 0) return { inventory, added: 0, overflow: 0 };
  const def = ITEM_DEFS[itemId];
  const maxStack = def.stack;
  const next = inventory.map((s) => (s ? { ...s } : null));
  let remaining = count;

  // 1. Top up existing non-full stacks (for stackable items)
  if (maxStack > 1) {
    for (let i = 0; i < next.length && remaining > 0; i++) {
      const slot = next[i];
      if (slot && slot.itemId === itemId && slot.count < maxStack) {
        const space = maxStack - slot.count;
        const delta = Math.min(space, remaining);
        slot.count += delta;
        remaining -= delta;
      }
    }
  }

  // 2. Fill empty slots
  for (let i = 0; i < next.length && remaining > 0; i++) {
    if (next[i] === null) {
      const delta = Math.min(maxStack, remaining);
      const durability = getInitialDurability(itemId);
      next[i] = {
        itemId,
        count: delta,
        ...(durability !== undefined ? { durability } : {}),
      };
      remaining -= delta;
    }
  }

  return {
    inventory: next,
    added: count - remaining,
    overflow: remaining,
  };
}

export function removeItem(
  inventory: (InventorySlot | null)[],
  itemId: ItemId,
  count: number
): { inventory: (InventorySlot | null)[]; success: boolean } {
  if (count <= 0) return { inventory, success: true };
  if (countItem(inventory, itemId) < count) {
    return { inventory, success: false };
  }

  const next = inventory.map((s) => (s ? { ...s } : null));
  let remaining = count;

  // Remove from later slots first so hotbar items stay put when possible
  for (let i = next.length - 1; i >= 0 && remaining > 0; i--) {
    const slot = next[i];
    if (slot && slot.itemId === itemId) {
      const take = Math.min(slot.count, remaining);
      slot.count -= take;
      remaining -= take;
      if (slot.count <= 0) {
        next[i] = null;
      }
    }
  }

  return { inventory: next, success: true };
}

export function damageSlotDurability(
  inventory: (InventorySlot | null)[],
  slotIndex: number,
  amount: number = 1
): { inventory: (InventorySlot | null)[]; broke: boolean; brokenItemId?: ItemId } {
  const slot = inventory[slotIndex];
  if (!slot || slot.durability === undefined) {
    return { inventory, broke: false };
  }
  const next = inventory.map((s) => (s ? { ...s } : null));
  const target = next[slotIndex]!;
  target.durability = Math.max(0, (target.durability ?? 0) - amount);
  if (target.durability <= 0) {
    const brokenItemId = target.itemId;
    next[slotIndex] = null;
    return { inventory: next, broke: true, brokenItemId };
  }
  return { inventory: next, broke: false };
}

export function swapSlots(
  inventory: (InventorySlot | null)[],
  fromIdx: number,
  toIdx: number
): (InventorySlot | null)[] {
  if (
    fromIdx === toIdx ||
    fromIdx < 0 ||
    toIdx < 0 ||
    fromIdx >= inventory.length ||
    toIdx >= inventory.length
  ) {
    return inventory;
  }
  const next = inventory.map((s) => (s ? { ...s } : null));
  const a = next[fromIdx];
  const b = next[toIdx];

  // Merge stack if same stackable item
  if (a && b && a.itemId === b.itemId && ITEM_DEFS[a.itemId].stack > 1) {
    const maxStack = ITEM_DEFS[a.itemId].stack;
    const transfer = Math.min(maxStack - b.count, a.count);
    if (transfer > 0) {
      b.count += transfer;
      a.count -= transfer;
      if (a.count <= 0) next[fromIdx] = null;
      return next;
    }
  }

  next[fromIdx] = b;
  next[toIdx] = a;
  return next;
}

export function getEquipped(
  inventory: (InventorySlot | null)[],
  selectedSlot: number
): { slot: InventorySlot | null; def: ItemDef | null } {
  const slot = inventory[selectedSlot] ?? null;
  if (!slot) return { slot: null, def: null };
  return { slot, def: ITEM_DEFS[slot.itemId] ?? null };
}
