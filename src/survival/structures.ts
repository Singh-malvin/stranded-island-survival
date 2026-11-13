// Base building catalog, surface validation, offline/hourly production timers,
// station detection, storage transfers, and shallow-water spearfishing.
// Pure domain logic (no Three.js or React imports).

import { BASE_BUILDING, NEEDS, TEMPERATURE, WORLD } from './config.ts';
import {
  addItem,
  countItem,
  damageSlotDurability,
  getEquipped,
  ITEM_DEFS,
  removeItem,
} from './items.ts';
import type {
  CraftStation,
  InventorySlot,
  ItemId,
  PlacedStructure,
  RecipeIngredient,
  StructureDef,
  StructureType,
  SurvivalState,
  WeatherState,
} from './types.ts';

export const STRUCTURE_CATALOG: Record<StructureType, StructureDef> = {
  campfire: {
    id: 'campfire',
    name: 'Stone Ring Campfire',
    category: 'camp',
    surface: 'dry_land',
    icon: '🔥',
    ingredients: [
      { itemId: 'stick', count: 4 },
      { itemId: 'stone', count: 5 },
      { itemId: 'palm_frond', count: 2 },
    ],
    unlockAct: 1,
    station: 'campfire',
    description: 'Warmth against cold nights, sterilizes spring water, and roasts fish or meat.',
  },
  shelter: {
    id: 'shelter',
    name: 'Palm Lean-To Shelter',
    category: 'camp',
    surface: 'dry_land',
    icon: '🛖',
    ingredients: [
      { itemId: 'log', count: 4 },
      { itemId: 'palm_frond', count: 6 },
      { itemId: 'rope', count: 2 },
      { itemId: 'stick', count: 4 },
    ],
    unlockAct: 1,
    description: 'Thatched shelter & bed. Protects from rain/chill, skips night till dawn, and saves respawn.',
  },
  workbench: {
    id: 'workbench',
    name: 'Timber Workbench',
    category: 'crafting',
    surface: 'dry_land',
    icon: '🛠️',
    ingredients: [
      { itemId: 'log', count: 6 },
      { itemId: 'stick', count: 4 },
      { itemId: 'rope', count: 4 },
      { itemId: 'stone', count: 4 },
    ],
    unlockAct: 1,
    station: 'workbench',
    description: 'Sturdy carpentry bench unlocking Tier 2 planks, machetes, and steel tools.',
  },
  storage_chest: {
    id: 'storage_chest',
    name: 'Woven Storage Chest',
    category: 'crafting',
    surface: 'dry_land',
    icon: '🧰',
    ingredients: [
      { itemId: 'log', count: 4 },
      { itemId: 'stick', count: 4 },
      { itemId: 'rope', count: 2 },
    ],
    unlockAct: 1,
    description: 'Stores 16 stacks of camp supplies, ingots, and surplus food safely at base.',
  },
  water_collector: {
    id: 'water_collector',
    name: 'Rainwater Collector',
    category: 'production',
    surface: 'dry_land',
    icon: '🚰',
    ingredients: [
      { itemId: 'stick', count: 4 },
      { itemId: 'palm_frond', count: 6 },
      { itemId: 'shell', count: 3 },
      { itemId: 'rope', count: 2 },
    ],
    unlockAct: 1,
    description: 'Condenses clean drinking water passively over time and fills rapidly during rainstorms.',
  },
  farm_plot: {
    id: 'farm_plot',
    name: 'Raised Farm Plot',
    category: 'production',
    surface: 'dry_land',
    icon: '🌱',
    ingredients: [
      { itemId: 'log', count: 4 },
      { itemId: 'fibre', count: 6 },
      { itemId: 'stick', count: 3 },
    ],
    unlockAct: 1,
    description: 'Plant 1x Wild Berries to cultivate sustainable harvests of berries and plant fibre.',
  },
  snare_trap: {
    id: 'snare_trap',
    name: 'Woodland Snare Trap',
    category: 'production',
    surface: 'dry_land',
    icon: '🪤',
    ingredients: [
      { itemId: 'stick', count: 3 },
      { itemId: 'rope', count: 2 },
    ],
    unlockAct: 1,
    description: 'Automated small-game snare that catches Raw Game Meat every few in-game hours.',
  },
  fish_trap: {
    id: 'fish_trap',
    name: 'Woven Lagoon Fish Trap',
    category: 'production',
    surface: 'shallow_water',
    icon: '🧺',
    ingredients: [
      { itemId: 'stick', count: 5 },
      { itemId: 'rope', count: 3 },
      { itemId: 'shell', count: 2 },
    ],
    unlockAct: 1,
    description: 'Place in shallow beach water along the shore to trap Raw Reef Fish automatically.',
  },
  drying_rack: {
    id: 'drying_rack',
    name: 'Sun & Breeze Drying Rack',
    category: 'production',
    surface: 'dry_land',
    icon: '🥩',
    ingredients: [
      { itemId: 'stick', count: 4 },
      { itemId: 'rope', count: 2 },
      { itemId: 'palm_frond', count: 2 },
    ],
    unlockAct: 1,
    description: 'Hang Raw Fish or Game Meat to slowly cure it into preserved travel jerky without firewood.',
  },
  forge: {
    id: 'forge',
    name: 'Stone Charcoal Forge',
    category: 'crafting',
    surface: 'dry_land',
    icon: '⚒️',
    ingredients: [
      { itemId: 'stone', count: 10 },
      { itemId: 'log', count: 6 },
      { itemId: 'flint', count: 4 },
    ],
    unlockAct: 1,
    station: 'forge',
    description: 'High-heat kiln unlocking Tier 3 smelting of scrap metal into Alloy Ingots.',
  },
};

export const STRUCTURE_ORDER: StructureType[] = [
  'campfire',
  'shelter',
  'workbench',
  'storage_chest',
  'water_collector',
  'farm_plot',
  'snare_trap',
  'fish_trap',
  'drying_rack',
  'forge',
];

export function checkStructureIngredients(
  type: StructureType,
  inventory: (InventorySlot | null)[]
): { canBuild: boolean; missing: RecipeIngredient[] } {
  const def = STRUCTURE_CATALOG[type];
  const missing: RecipeIngredient[] = [];
  for (const ing of def.ingredients) {
    const have = countItem(inventory, ing.itemId);
    if (have < ing.count) {
      missing.push({ itemId: ing.itemId, count: ing.count - have });
    }
  }
  return { canBuild: missing.length === 0, missing };
}

export function isValidPlacementHeight(type: StructureType, groundY: number): boolean {
  const surface = STRUCTURE_CATALOG[type].surface;
  if (surface === 'shallow_water') {
    return groundY >= WORLD.WATER_LEVEL - 0.85 && groundY <= WORLD.WATER_LEVEL + 0.15;
  }
  return groundY > WORLD.WATER_LEVEL + 0.15;
}

export function createEmptyStorage(slots: number = BASE_BUILDING.STORAGE_SLOTS): (InventorySlot | null)[] {
  return Array.from({ length: slots }, () => null);
}

export function placeStructure(
  state: SurvivalState,
  type: StructureType,
  x: number,
  y: number,
  z: number,
  yaw: number,
  idOverride?: string
): { ok: boolean; state: SurvivalState; message: string; structureId?: string } {
  const def = STRUCTURE_CATALOG[type];
  if (!isValidPlacementHeight(type, y)) {
    return {
      ok: false,
      state,
      message:
        def.surface === 'shallow_water'
          ? `Place ${def.name} in shallow coastal water near the shoreline.`
          : `Move onto dry ground above the tide line to build ${def.name}.`,
    };
  }

  const afford = checkStructureIngredients(type, state.inventory);
  if (!afford.canBuild) {
    const miss = afford.missing.map((m) => `${m.count}x ${ITEM_DEFS[m.itemId].name}`).join(', ');
    return { ok: false, state, message: `Missing materials: ${miss}` };
  }

  let nextInventory = state.inventory;
  for (const ing of def.ingredients) {
    const rem = removeItem(nextInventory, ing.itemId, ing.count);
    if (!rem.success) return { ok: false, state, message: 'Insufficient materials.' };
    nextInventory = rem.inventory;
  }

  const uid = idOverride ?? `${type}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  if (type === 'campfire') {
    const nextFire = { id: uid, x, y, z };
    return {
      ok: true,
      structureId: uid,
      message: `Built ${def.name}! Camp spawn updated.`,
      state: {
        ...state,
        inventory: nextInventory,
        campfires: [...state.campfires, nextFire],
        spawnPoint: { x, y, z: z + 2.2, yaw },
      },
    };
  }

  if (type === 'shelter') {
    const nextShelter = { id: uid, x, y, z, yaw, builtDay: state.clock.day };
    return {
      ok: true,
      structureId: uid,
      message: `Built ${def.name}! Sleep inside anytime to rest till dawn & save.`,
      state: {
        ...state,
        inventory: nextInventory,
        shelters: [...state.shelters, nextShelter],
        spawnPoint: { x, y, z: z + 2.1, yaw },
      },
    };
  }

  const placed: PlacedStructure = {
    id: uid,
    type,
    x,
    y,
    z,
    yaw,
    builtDay: state.clock.day,
    ...(type === 'storage_chest' ? { storage: createEmptyStorage() } : {}),
    ...(type === 'water_collector' ? { waterDoses: 0 } : {}),
    ...(type === 'farm_plot' ? { cropState: 'empty', cropProgress: 0 } : {}),
    ...(type === 'snare_trap' || type === 'fish_trap'
      ? { trapState: 'set', trapProgress: 0 }
      : {}),
    ...(type === 'drying_rack' ? { dryItem: null, dryProgress: 0 } : {}),
  };

  return {
    ok: true,
    structureId: uid,
    message: `Built ${def.name}!`,
    state: {
      ...state,
      inventory: nextInventory,
      structures: [...state.structures, placed],
    },
  };
}

/**
 * Advances rainwater collection, farm growth, trap catches, and drying racks
 * against elapsed in-game hours (runs both live and overnight when sleeping).
 */
export function tickStructuresProduction(
  structures: PlacedStructure[],
  deltaGameHours: number,
  weather: WeatherState
): PlacedStructure[] {
  if (deltaGameHours <= 0 || structures.length === 0) return structures;

  const isRaining = weather.kind === 'rain' || weather.kind === 'storm';
  let changed = false;

  const updated = structures.map((s) => {
    if (s.type === 'water_collector') {
      const cur = s.waterDoses ?? 0;
      if (cur >= BASE_BUILDING.WATER_COLLECTOR_CAP) return s;
      const mult = isRaining ? BASE_BUILDING.WATER_COLLECTOR_RAIN_MULT : 1;
      const add = (deltaGameHours * mult) / BASE_BUILDING.WATER_COLLECTOR_DRY_HOURS_PER_DOSE;
      const next = Math.min(BASE_BUILDING.WATER_COLLECTOR_CAP, cur + add);
      changed = true;
      return { ...s, waterDoses: next };
    }

    if (s.type === 'farm_plot' && s.cropState === 'growing') {
      const mult = isRaining ? 1.45 : 1.0;
      const next = Math.min(
        1,
        (s.cropProgress ?? 0) + (deltaGameHours * mult) / BASE_BUILDING.FARM_GROW_HOURS
      );
      changed = true;
      return {
        ...s,
        cropProgress: next,
        cropState: next >= 1 ? ('ready' as const) : ('growing' as const),
      };
    }

    if (s.type === 'snare_trap' && s.trapState !== 'ready') {
      const next = Math.min(
        1,
        (s.trapProgress ?? 0) + deltaGameHours / BASE_BUILDING.SNARE_CATCH_HOURS
      );
      changed = true;
      return {
        ...s,
        trapProgress: next,
        trapState: next >= 1 ? ('ready' as const) : ('set' as const),
      };
    }

    if (s.type === 'fish_trap' && s.trapState !== 'ready') {
      const next = Math.min(
        1,
        (s.trapProgress ?? 0) + deltaGameHours / BASE_BUILDING.FISH_TRAP_CATCH_HOURS
      );
      changed = true;
      return {
        ...s,
        trapProgress: next,
        trapState: next >= 1 ? ('ready' as const) : ('set' as const),
      };
    }

    if (s.type === 'drying_rack' && s.dryItem && (s.dryProgress ?? 0) < 1) {
      // Rain slows outdoor drying slightly
      const mult = isRaining ? 0.5 : 1.0;
      const next = Math.min(
        1,
        (s.dryProgress ?? 0) + (deltaGameHours * mult) / BASE_BUILDING.DRYING_CURE_HOURS
      );
      changed = true;
      return { ...s, dryProgress: next };
    }

    return s;
  });

  return changed ? updated : structures;
}

export function getStructureInteractionPrompt(
  s: PlacedStructure,
  inventory: (InventorySlot | null)[]
): { label: string; prompt: string; subtext?: string; canInteract: boolean } {
  switch (s.type) {
    case 'workbench':
      return {
        label: 'Timber Workbench',
        prompt: '[E / Click] Open Tier 2 Crafting Bench',
        subtext: 'Unlocks Hewn Planks, Brush Machete & Steel Tools nearby',
        canInteract: true,
      };
    case 'forge':
      return {
        label: 'Stone Charcoal Forge',
        prompt: '[E / Click] Open Tier 3 Smelting Forge',
        subtext: 'Smelt Scrap Metal into Forged Alloy Ingots',
        canInteract: true,
      };
    case 'storage_chest': {
      const used = (s.storage ?? []).filter(Boolean).length;
      return {
        label: 'Woven Storage Chest',
        prompt: `[E / Click] Open Camp Storage (${used}/${BASE_BUILDING.STORAGE_SLOTS} used)`,
        subtext: 'Store extra timber, stone, bottles & food at base',
        canInteract: true,
      };
    }
    case 'water_collector': {
      const doses = Math.floor(s.waterDoses ?? 0);
      const pct = Math.round(((s.waterDoses ?? 0) - doses) * 100);
      const hasBottle = countItem(inventory, 'empty_bottle') > 0;
      if (doses < 1) {
        return {
          label: 'Rainwater Collector',
          prompt: `Condensing Clean Water (${pct}% to first dose)`,
          subtext: 'Fills 5.5x faster during rain & storms',
          canInteract: true,
        };
      }
      return {
        label: `Rainwater Collector (${doses}/${BASE_BUILDING.WATER_COLLECTOR_CAP} doses)`,
        prompt: hasBottle
          ? '[E / Click] Fill Bottle with Clean Water'
          : '[E / Click] Drink Clean Water (+32 Thirst)',
        subtext: 'Zero sickness risk — safe condensed rainwater',
        canInteract: true,
      };
    }
    case 'farm_plot': {
      if (s.cropState === 'ready') {
        return {
          label: 'Raised Farm Plot (Ready!)',
          prompt: `[E / Click] Harvest ${BASE_BUILDING.FARM_HARVEST_BERRIES}x Berries & ${BASE_BUILDING.FARM_HARVEST_FIBRE}x Fibre`,
          canInteract: true,
        };
      }
      if (s.cropState === 'growing') {
        const pct = Math.round((s.cropProgress ?? 0) * 100);
        return {
          label: 'Raised Farm Plot (Growing)',
          prompt: `Growing Coastal Berries (${pct}%)`,
          subtext: 'Matures faster during island rainfall',
          canInteract: true,
        };
      }
      const hasSeed = countItem(inventory, 'berries') > 0;
      return {
        label: 'Raised Farm Plot (Empty)',
        prompt: hasSeed ? '[E / Click] Plant 1x Wild Berries' : 'Need 1x Wild Berries to Plant',
        canInteract: hasSeed,
      };
    }
    case 'snare_trap': {
      if (s.trapState === 'ready') {
        return {
          label: 'Snare Trap (Sprung!)',
          prompt: '[E / Click] Collect 1x Raw Game Meat & Reset',
          subtext: 'Cook at a Campfire or cure on a Drying Rack before eating',
          canInteract: true,
        };
      }
      const pct = Math.round((s.trapProgress ?? 0) * 100);
      return {
        label: 'Woodland Snare Trap (Armed)',
        prompt: `Waiting for Game (${pct}%)`,
        canInteract: true,
      };
    }
    case 'fish_trap': {
      if (s.trapState === 'ready') {
        return {
          label: 'Lagoon Fish Trap (Full!)',
          prompt: '[E / Click] Collect Raw Reef Fish & Reset Trap',
          canInteract: true,
        };
      }
      const pct = Math.round((s.trapProgress ?? 0) * 100);
      return {
        label: 'Woven Lagoon Fish Trap (Set)',
        prompt: `Checking Lagoon Current (${pct}%)`,
        canInteract: true,
      };
    }
    case 'drying_rack': {
      if (!s.dryItem) {
        const hasRaw =
          countItem(inventory, 'raw_fish') > 0 || countItem(inventory, 'raw_meat') > 0;
        return {
          label: 'Drying Rack (Empty)',
          prompt: hasRaw
            ? '[E / Click] Hang Raw Fish or Meat to Cure'
            : 'Carry Raw Fish or Game Meat to Cure',
          canInteract: hasRaw,
        };
      }
      if ((s.dryProgress ?? 0) >= 1) {
        const itemLabel = s.dryItem === 'raw_fish' ? 'Smoked Reef Jerky' : 'Cured Island Jerky';
        return {
          label: 'Drying Rack (Cured!)',
          prompt: `[E / Click] Take ${itemLabel}`,
          canInteract: true,
        };
      }
      const pct = Math.round((s.dryProgress ?? 0) * 100);
      return {
        label: 'Drying Rack (Curing...)',
        prompt: `Curing ${s.dryItem === 'raw_fish' ? 'Fish' : 'Meat'} (${pct}%)`,
        canInteract: true,
      };
    }
    default:
      return { label: 'Structure', prompt: '[E] Use', canInteract: true };
  }
}

export function interactWithStructure(
  state: SurvivalState,
  structureId: string,
  weather: WeatherState
): {
  state: SurvivalState;
  message: string;
  sound?: 'pickup' | 'drink' | 'craft';
  openModal?: 'storage' | 'craft';
} {
  const idx = state.structures.findIndex((s) => s.id === structureId);
  if (idx === -1) return { state, message: '' };
  const s = state.structures[idx];

  const replaceStruct = (
    nextStruct: PlacedStructure,
    nextInv = state.inventory,
    nextNeeds = state.needs,
    gatheredDelta = 0
  ): SurvivalState => {
    const nextList = state.structures.slice();
    nextList[idx] = nextStruct;
    return {
      ...state,
      inventory: nextInv,
      needs: nextNeeds,
      structures: nextList,
      stats: {
        ...state.stats,
        itemsGathered: state.stats.itemsGathered + gatheredDelta,
      },
    };
  };

  if (s.type === 'workbench' || s.type === 'forge') {
    return { state, message: `Opened ${STRUCTURE_CATALOG[s.type].name}`, openModal: 'craft' };
  }

  if (s.type === 'storage_chest') {
    return { state, message: 'Opened Woven Storage Chest', openModal: 'storage' };
  }

  if (s.type === 'water_collector') {
    const doses = s.waterDoses ?? 0;
    if (doses < 1) {
      return {
        state,
        message: `Collector is ${Math.round(doses * 100)}% toward 1 dose of clean water.`,
      };
    }
    if (countItem(state.inventory, 'empty_bottle') > 0) {
      const rem = removeItem(state.inventory, 'empty_bottle', 1);
      if (rem.success) {
        const add = addItem(rem.inventory, 'water_bottle_clean', 1);
        if (add.added > 0) {
          return {
            state: replaceStruct({ ...s, waterDoses: Math.max(0, doses - 1) }, add.inventory),
            message: 'Filled Canteen Bottle with clean rainwater!',
            sound: 'drink',
          };
        }
      }
    }
    const nextNeeds = {
      ...state.needs,
      thirst: Math.min(100, state.needs.thirst + 32),
    };
    return {
      state: replaceStruct({ ...s, waterDoses: Math.max(0, doses - 1) }, state.inventory, nextNeeds),
      message: 'Drank clean rainwater (+32 Thirst).',
      sound: 'drink',
    };
  }

  if (s.type === 'farm_plot') {
    if (s.cropState === 'ready') {
      const a1 = addItem(state.inventory, 'berries', BASE_BUILDING.FARM_HARVEST_BERRIES);
      const a2 = addItem(a1.inventory, 'fibre', BASE_BUILDING.FARM_HARVEST_FIBRE);
      const total = a1.added + a2.added;
      if (total === 0) return { state, message: 'Inventory full!' };
      return {
        state: replaceStruct(
          { ...s, cropState: 'empty', cropProgress: 0 },
          a2.inventory,
          state.needs,
          total
        ),
        message: `Harvested +${a1.added} Wild Berries & +${a2.added} Plant Fibre!`,
        sound: 'pickup',
      };
    }
    if (s.cropState === 'growing') {
      return {
        state,
        message: `Berries still growing (${Math.round((s.cropProgress ?? 0) * 100)}%).`,
      };
    }
    const rem = removeItem(state.inventory, 'berries', 1);
    if (!rem.success) return { state, message: 'Carry at least 1x Wild Berries to plant here.' };
    return {
      state: replaceStruct({ ...s, cropState: 'growing', cropProgress: 0 }, rem.inventory),
      message: 'Planted Wild Berries — check back in a few hours to harvest!',
      sound: 'craft',
    };
  }

  if (s.type === 'snare_trap') {
    if (s.trapState !== 'ready') {
      return {
        state,
        message: `Snare armed (${Math.round((s.trapProgress ?? 0) * 100)}%). Check back later.`,
      };
    }
    const add = addItem(state.inventory, 'raw_meat', 1);
    if (add.added === 0) return { state, message: 'Inventory full!' };
    return {
      state: replaceStruct({ ...s, trapState: 'set', trapProgress: 0 }, add.inventory, state.needs, 1),
      message: 'Collected +1 Raw Game Meat & reset Snare Trap.',
      sound: 'pickup',
    };
  }

  if (s.type === 'fish_trap') {
    if (s.trapState !== 'ready') {
      return {
        state,
        message: `Lagoon Fish Trap soaking (${Math.round((s.trapProgress ?? 0) * 100)}%).`,
      };
    }
    const catchCount = weather.kind === 'rain' || weather.kind === 'storm' ? 2 : 1;
    const add = addItem(state.inventory, 'raw_fish', catchCount);
    if (add.added === 0) return { state, message: 'Inventory full!' };
    return {
      state: replaceStruct(
        { ...s, trapState: 'set', trapProgress: 0 },
        add.inventory,
        state.needs,
        add.added
      ),
      message: `Hauled +${add.added} Raw Reef Fish & re-baited trap.`,
      sound: 'pickup',
    };
  }

  if (s.type === 'drying_rack') {
    if (!s.dryItem) {
      const targetItem: 'raw_fish' | 'raw_meat' | null =
        countItem(state.inventory, 'raw_fish') > 0
          ? 'raw_fish'
          : countItem(state.inventory, 'raw_meat') > 0
            ? 'raw_meat'
            : null;
      if (!targetItem) {
        return { state, message: 'Carry Raw Reef Fish or Raw Game Meat to hang on rack.' };
      }
      const rem = removeItem(state.inventory, targetItem, 1);
      if (!rem.success) return { state, message: 'Missing raw food.' };
      return {
        state: replaceStruct({ ...s, dryItem: targetItem, dryProgress: 0 }, rem.inventory),
        message: `Hung ${ITEM_DEFS[targetItem].name} to cure on Drying Rack.`,
        sound: 'craft',
      };
    }
    if ((s.dryProgress ?? 0) < 1) {
      return {
        state,
        message: `Still curing (${Math.round((s.dryProgress ?? 0) * 100)}%).`,
      };
    }
    const resultId: ItemId = s.dryItem === 'raw_fish' ? 'dried_fish' : 'dried_meat';
    const add = addItem(state.inventory, resultId, 1);
    if (add.added === 0) return { state, message: 'Inventory full!' };
    return {
      state: replaceStruct({ ...s, dryItem: null, dryProgress: 0 }, add.inventory, state.needs, 1),
      message: `Collected +1 ${ITEM_DEFS[resultId].name}!`,
      sound: 'pickup',
    };
  }

  return { state, message: '' };
}

export function transferChestSlot(
  state: SurvivalState,
  chestId: string,
  fromChest: boolean,
  slotIndex: number
): SurvivalState {
  const sIdx = state.structures.findIndex((s) => s.id === chestId && s.type === 'storage_chest');
  if (sIdx === -1) return state;
  const chest = state.structures[sIdx];
  const chestSlots = (chest.storage ?? createEmptyStorage()).map((x) => (x ? { ...x } : null));
  const bagSlots = state.inventory.map((x) => (x ? { ...x } : null));

  const sourceList = fromChest ? chestSlots : bagSlots;
  const destList = fromChest ? bagSlots : chestSlots;
  const slot = sourceList[slotIndex];
  if (!slot) return state;

  const addedRes = addItem(destList, slot.itemId, slot.count);
  if (addedRes.added === 0) return state;

  const nextSource = sourceList.slice();
  if (addedRes.overflow <= 0) {
    nextSource[slotIndex] = null;
  } else {
    nextSource[slotIndex] = { ...slot, count: addedRes.overflow };
  }

  const nextChestStorage = fromChest ? nextSource : addedRes.inventory;
  const nextBag = fromChest ? addedRes.inventory : nextSource;

  const nextStructures = state.structures.slice();
  nextStructures[sIdx] = { ...chest, storage: nextChestStorage };

  return {
    ...state,
    inventory: nextBag,
    structures: nextStructures,
  };
}

export function getNearbyStations(
  state: SurvivalState,
  px: number = state.player.x,
  pz: number = state.player.z
): Set<CraftStation> {
  const set = new Set<CraftStation>(['hands']);
  for (const fire of state.campfires) {
    if (Math.hypot(px - fire.x, pz - fire.z) <= TEMPERATURE.CAMPFIRE_RADIUS_M) {
      set.add('campfire');
      break;
    }
  }
  for (const s of state.structures) {
    const def = STRUCTURE_CATALOG[s.type];
    if (def.station && Math.hypot(px - s.x, pz - s.z) <= BASE_BUILDING.STATION_RADIUS_M) {
      set.add(def.station);
    }
  }
  return set;
}

export function performSpearfishing(state: SurvivalState): {
  state: SurvivalState;
  caught: boolean;
  message: string;
} {
  const equipped = getEquipped(state.inventory, state.selectedSlot);
  if (equipped.def?.tool?.kind !== 'spear') {
    return {
      state,
      caught: false,
      message: 'Craft and equip a Fire-Hardened Spear to catch lagoon reef fish.',
    };
  }
  if (state.needs.stamina < BASE_BUILDING.SPEAR_FISH_STAMINA) {
    return { state, caught: false, message: 'Too exhausted to thrust spear!' };
  }

  const add = addItem(state.inventory, 'raw_fish', 1);
  if (add.added === 0) {
    return { state, caught: false, message: 'Backpack is full!' };
  }

  const dmg = damageSlotDurability(add.inventory, state.selectedSlot, 1);
  const brokeNote = dmg.broke ? ' (Spear broke!)' : '';

  return {
    caught: true,
    message: `Speared +1 Raw Reef Fish!${brokeNote} Cook at a Campfire before eating.`,
    state: {
      ...state,
      inventory: dmg.inventory,
      needs: {
        ...state.needs,
        stamina: Math.max(0, state.needs.stamina - BASE_BUILDING.SPEAR_FISH_STAMINA),
      },
      stats: {
        ...state.stats,
        itemsGathered: state.stats.itemsGathered + 1,
      },
    },
  };
}
