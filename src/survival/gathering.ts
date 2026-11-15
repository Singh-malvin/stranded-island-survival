/**
 * Gathering nodes, tool-tier checks, yields, deterministic island node layout,
 * and initial survival state factory.
 */

import {
  BOSS_TUNING,
  NEEDS,
  NODE_RESPAWN_HOURS,
  SAVE,
  TIME,
  TOOL_POWER,
  WORLD,
} from './config.ts';
import { createInitialBossState } from './boss.ts';
import { createInitialDanielState } from './companion.ts';
import { createInitialPowersState } from './powers.ts';
import {
  createInitialAuraKingAIState,
  createInitialPrisonState,
  createInitialStrongholdState,
} from './auraAI.ts';
import {
  addItem,
  createEmptyInventory,
  damageSlotDurability,
  getEquipped,
  ITEM_DEFS,
} from './items.ts';
import {
  GatherNodeDef,
  GatherNodeType,
  ItemId,
  NodeState,
  SurvivalState,
  ToolKind,
} from './types.ts';
import { revealMapAround, sampleIslandHeight } from './world.ts';
import { createInitialBoatState, createInitialVoyageState } from './voyage.ts';
import { generateInitialWildlife } from './wildlife.ts';

export { sampleIslandHeight } from './world.ts';

export interface GatherNodeMeta {
  type: GatherNodeType;
  label: string;
  promptVerb: string;
  maxHealth: number;
  requiredTool?: { kind: ToolKind; minTier: number };
  yields: Array<{ itemId: ItemId; count: number }>;
  sound: 'chop' | 'mine' | 'pickup';
}

export const GATHER_NODE_META: Record<GatherNodeType, GatherNodeMeta> = {
  driftwood: {
    type: 'driftwood',
    label: 'Fallen Wood Branches',
    promptVerb: 'Collect',
    maxHealth: 2,
    yields: [{ itemId: 'stick', count: 2 }],
    sound: 'chop',
  },
  loose_stone: {
    type: 'loose_stone',
    label: 'Loose Volcanic Stone',
    promptVerb: 'Pick Up',
    maxHealth: 1,
    yields: [{ itemId: 'stone', count: 2 }],
    sound: 'pickup',
  },
  flint_nodule: {
    type: 'flint_nodule',
    label: 'Tide-Pool Flint Outcrop',
    promptVerb: 'Knap',
    maxHealth: 2,
    yields: [
      { itemId: 'flint', count: 2 },
      { itemId: 'stone', count: 1 },
    ],
    sound: 'mine',
  },
  fibre_bush: {
    type: 'fibre_bush',
    label: 'Wild Agave Fibre Shrub',
    promptVerb: 'Harvest',
    maxHealth: 2,
    yields: [
      { itemId: 'fibre', count: 2 },
      { itemId: 'palm_frond', count: 1 },
    ],
    sound: 'pickup',
  },
  berry_bush: {
    type: 'berry_bush',
    label: 'Coastal Berry Thicket',
    promptVerb: 'Forage',
    maxHealth: 2,
    yields: [
      { itemId: 'berries', count: 3 },
      { itemId: 'fibre', count: 1 },
    ],
    sound: 'pickup',
  },
  coconut: {
    type: 'coconut',
    label: 'Fallen Coconut',
    promptVerb: 'Pick Up',
    maxHealth: 1,
    yields: [{ itemId: 'coconut', count: 1 }],
    sound: 'pickup',
  },
  shell_cluster: {
    type: 'shell_cluster',
    label: 'Tidewater Shells',
    promptVerb: 'Collect',
    maxHealth: 1,
    yields: [{ itemId: 'shell', count: 2 }],
    sound: 'pickup',
  },
  palm_tree: {
    type: 'palm_tree',
    label: 'Coconut Palm Tree',
    promptVerb: 'Chop',
    maxHealth: 6,
    requiredTool: { kind: 'axe', minTier: 1 },
    yields: [
      { itemId: 'log', count: 2 },
      { itemId: 'stick', count: 1 },
      { itemId: 'palm_frond', count: 2 },
      { itemId: 'coconut', count: 1 },
    ],
    sound: 'chop',
  },
  boulder: {
    type: 'boulder',
    label: 'Basalt Boulder',
    promptVerb: 'Mine',
    maxHealth: 6,
    requiredTool: { kind: 'pick', minTier: 1 },
    yields: [
      { itemId: 'stone', count: 4 },
      { itemId: 'flint', count: 2 },
    ],
    sound: 'mine',
  },
  crash_debris: {
    type: 'crash_debris',
    label: 'Torn Fuselage Wreckage',
    promptVerb: 'Salvage',
    maxHealth: 3,
    yields: [
      { itemId: 'scrap_metal', count: 2 },
      { itemId: 'cloth_scrap', count: 1 },
      { itemId: 'empty_bottle', count: 1 },
    ],
    sound: 'mine',
  },
  supply_crate: {
    type: 'supply_crate',
    label: 'Washed-Up Flight Case',
    promptVerb: 'Pry Open',
    maxHealth: 1,
    yields: [
      { itemId: 'ration_bar', count: 1 },
      { itemId: 'water_bottle_clean', count: 1 },
      { itemId: 'rope', count: 1 },
    ],
    sound: 'pickup',
  },
  resin_tree: {
    type: 'resin_tree',
    label: 'Amber Pitch Pine',
    promptVerb: 'Tap Resin & Chop',
    maxHealth: 6,
    requiredTool: { kind: 'axe', minTier: 1 },
    yields: [
      { itemId: 'resin', count: 2 },
      { itemId: 'log', count: 1 },
      { itemId: 'stick', count: 1 },
    ],
    sound: 'chop',
  },
  herb_patch: {
    type: 'herb_patch',
    label: 'Jungle Medicinal Aloe',
    promptVerb: 'Gather',
    maxHealth: 2,
    yields: [
      { itemId: 'herb', count: 2 },
      { itemId: 'fibre', count: 1 },
    ],
    sound: 'pickup',
  },
  iron_vein: {
    type: 'iron_vein',
    label: 'Highland Iron & Coal Seam',
    promptVerb: 'Mine',
    maxHealth: 7,
    requiredTool: { kind: 'pick', minTier: 1 },
    yields: [
      { itemId: 'iron_ore', count: 2 },
      { itemId: 'coal', count: 1 },
      { itemId: 'stone', count: 1 },
    ],
    sound: 'mine',
  },
  copper_vein: {
    type: 'copper_vein',
    label: 'Cave Copper & Wire Conduit',
    promptVerb: 'Extract',
    maxHealth: 6,
    requiredTool: { kind: 'pick', minTier: 1 },
    yields: [
      { itemId: 'copper_wire', count: 1 },
      { itemId: 'coal', count: 2 },
    ],
    sound: 'mine',
  },
  fuel_drum: {
    type: 'fuel_drum',
    label: 'Sealed Aviation Fuel Drum',
    promptVerb: 'Siphon',
    maxHealth: 3,
    yields: [
      { itemId: 'fuel_can', count: 1 },
      { itemId: 'scrap_metal', count: 2 },
    ],
    sound: 'mine',
  },
  tech_wreck: {
    type: 'tech_wreck',
    label: 'Flight 404 Avionics Pod',
    promptVerb: 'Salvage',
    maxHealth: 3,
    yields: [
      { itemId: 'circuit_board', count: 1 },
      { itemId: 'copper_wire', count: 1 },
      { itemId: 'scrap_metal', count: 2 },
    ],
    sound: 'mine',
  },
};

export function generateIslandNodes(
  seed: number = WORLD.SEED,
  islandRadius: number = WORLD.ISLAND_RADIUS
): GatherNodeDef[] {
  let s = seed;
  const rng = () => {
    const x = Math.sin(s++) * 10000;
    return x - Math.floor(x);
  };

  const nodes: GatherNodeDef[] = [];
  const nearImportantSpot = (x: number, z: number) =>
    Math.hypot(x - WORLD.PLAYER_SPAWN.x, z - WORLD.PLAYER_SPAWN.z) < 7.0 ||
    Math.hypot(x - WORLD.BOAT_DOCK_POS.x, z - WORLD.BOAT_DOCK_POS.z) < 8.5 ||
    Math.hypot(x - BOSS_TUNING.ARENA_CENTER_X, z - BOSS_TUNING.ARENA_CENTER_Z) < 14.5 ||
    Math.hypot(x - WORLD.SPRING_POS.x, z - WORLD.SPRING_POS.z) < 6.0 ||
    Math.hypot(x - WORLD.ABANDONED_CAMP_POS.x, z - WORLD.ABANDONED_CAMP_POS.z) < 7.0 ||
    Math.hypot(x - WORLD.RESEARCH_STATION_POS.x, z - WORLD.RESEARCH_STATION_POS.z) < 8.0 ||
    Math.abs(z - WORLD.ACT1_RIDGE_Z) < 6.5 ||
    Math.abs(z - WORLD.STATION_GATE_Z) < 5.5;

  const pushNode = (type: GatherNodeType, x: number, z: number, scale: number = 1) => {
    const y = sampleIslandHeight(x, z, islandRadius);
    nodes.push({
      id: `node_${type}_${nodes.length}`,
      type,
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      z: Math.round(z * 100) / 100,
      rotation: Math.round(rng() * Math.PI * 2 * 100) / 100,
      scale: Math.round(scale * 100) / 100,
    });
  };

  // --- Act 1 Beach & Crash Scatter (spread out from Spawn 0,146 -> Wreck 38,132) ---
  pushNode('driftwood', -6.5, 148.0, 1.0);
  pushNode('driftwood', 8.5, 143.0, 1.05);
  pushNode('driftwood', 22.0, 138.0, 1.0);
  pushNode('loose_stone', -10.5, 138.5, 1.0);
  pushNode('loose_stone', 14.0, 134.0, 1.0);
  pushNode('loose_stone', -24.0, 132.0, 1.05);
  pushNode('coconut', -13.0, 128.0, 1.0);
  pushNode('coconut', 19.0, 122.0, 1.0);
  pushNode('fibre_bush', -15.5, 118.0, 1.0);
  pushNode('fibre_bush', 12.0, 112.0, 1.05);
  pushNode('berry_bush', -8.0, 102.0, 1.05);
  pushNode('berry_bush', 24.0, 104.0, 1.0);

  // Flight 404 Wing Wreckage Cluster (38, 132)
  pushNode('supply_crate', WORLD.WRECK_POS.x - 5.5, WORLD.WRECK_POS.z + 4.5, 1.0);
  pushNode('supply_crate', WORLD.WRECK_POS.x + 6.5, WORLD.WRECK_POS.z - 3.5, 1.0);
  pushNode('crash_debris', WORLD.WRECK_POS.x - 3.0, WORLD.WRECK_POS.z - 4.0, 1.15);
  pushNode('crash_debris', WORLD.WRECK_POS.x + 5.5, WORLD.WRECK_POS.z + 5.5, 1.05);
  pushNode('crash_debris', WORLD.WRECK_POS.x - 12.0, WORLD.WRECK_POS.z + 7.5, 1.0);
  pushNode('crash_debris', 12.0, 142.0, 0.95);

  // --- Act 1 Western Tide Pools Flint Quarry (-68, 118) ---
  pushNode('flint_nodule', WORLD.TIDE_POOLS_POS.x + 6.0, WORLD.TIDE_POOLS_POS.z + 4.5, 1.15);
  pushNode('flint_nodule', WORLD.TIDE_POOLS_POS.x - 3.5, WORLD.TIDE_POOLS_POS.z - 2.0, 1.1);
  pushNode('flint_nodule', WORLD.TIDE_POOLS_POS.x - 10.5, WORLD.TIDE_POOLS_POS.z + 3.0, 1.08);
  pushNode('flint_nodule', WORLD.TIDE_POOLS_POS.x + 1.5, WORLD.TIDE_POOLS_POS.z - 9.0, 1.1);
  pushNode('shell_cluster', WORLD.TIDE_POOLS_POS.x - 7.5, WORLD.TIDE_POOLS_POS.z + 8.5, 1.05);
  pushNode('shell_cluster', WORLD.TIDE_POOLS_POS.x + 11.0, WORLD.TIDE_POOLS_POS.z + 6.0, 1.0);
  pushNode('driftwood', WORLD.TIDE_POOLS_POS.x + 14.0, WORLD.TIDE_POOLS_POS.z + 10.0, 1.05);

  // --- Act 1 Spring & Palm Cove Groves (-34, 82) & (48, 86) ---
  pushNode('palm_tree', -24.0, 96.0, 1.05);
  pushNode('palm_tree', -42.0, 74.0, 1.02);
  pushNode('palm_tree', 36.0, 98.0, 1.08);
  pushNode('palm_tree', 52.0, 90.0, 1.12);
  pushNode('palm_tree', 58.0, 76.0, 0.98);
  pushNode('palm_tree', 18.0, 76.0, 1.04);
  pushNode('palm_tree', -14.0, 68.0, 1.06);
  pushNode('boulder', -46.0, 80.0, 0.98);
  pushNode('boulder', 28.0, 78.0, 1.04);
  pushNode('boulder', 58.0, 98.0, 0.95);
  pushNode('fibre_bush', -25.0, 79.0, 1.05);
  pushNode('berry_bush', -41.0, 88.0, 1.0);
  pushNode('herb_patch', -28.0, 72.0, 1.0);

  // --- Act 2 Interior: Abandoned Camp (-56, 8) ---
  pushNode('supply_crate', WORLD.ABANDONED_CAMP_POS.x - 5.5, WORLD.ABANDONED_CAMP_POS.z + 4.5, 1.05);
  pushNode('crash_debris', WORLD.ABANDONED_CAMP_POS.x + 6.5, WORLD.ABANDONED_CAMP_POS.z - 4.0, 1.0);
  pushNode('berry_bush', WORLD.ABANDONED_CAMP_POS.x + 8.0, WORLD.ABANDONED_CAMP_POS.z + 6.5, 1.05);
  pushNode('herb_patch', WORLD.ABANDONED_CAMP_POS.x - 9.0, WORLD.ABANDONED_CAMP_POS.z - 6.0, 1.05);
  pushNode('resin_tree', WORLD.ABANDONED_CAMP_POS.x - 14.0, WORLD.ABANDONED_CAMP_POS.z + 10.0, 1.05);

  // --- Act 2 Interior: Tail Wreckage Clearing (48, -12) ---
  pushNode('tech_wreck', WORLD.JUNGLE_TAIL_POS.x + 4.5, WORLD.JUNGLE_TAIL_POS.z + 3.5, 1.1);
  pushNode('tech_wreck', WORLD.JUNGLE_TAIL_POS.x - 6.0, WORLD.JUNGLE_TAIL_POS.z - 4.5, 1.0);
  pushNode('fuel_drum', WORLD.JUNGLE_TAIL_POS.x + 6.0, WORLD.JUNGLE_TAIL_POS.z - 6.5, 1.0);
  pushNode('fuel_drum', WORLD.JUNGLE_TAIL_POS.x - 10.0, WORLD.JUNGLE_TAIL_POS.z - 1.5, 1.05);
  pushNode('crash_debris', WORLD.JUNGLE_TAIL_POS.x - 4.0, WORLD.JUNGLE_TAIL_POS.z + 7.5, 1.12);
  pushNode('supply_crate', WORLD.JUNGLE_TAIL_POS.x - 9.5, WORLD.JUNGLE_TAIL_POS.z + 2.5, 1.0);

  // --- Act 2/3 Eastern Gorge Iron Seams ---
  pushNode('iron_vein', 52.0, 18.0, 1.05);
  pushNode('iron_vein', 84.0, -4.0, 1.1);
  pushNode('iron_vein', 54.0, -34.0, 1.08);
  pushNode('iron_vein', 86.0, -28.0, 1.0);

  // --- Act 3 Western Basalt Caves (-78, -48) ---
  pushNode('copper_vein', WORLD.CAVE_GROTTO_POS.x - 4.0, WORLD.CAVE_GROTTO_POS.z - 2.0, 1.1);
  pushNode('copper_vein', WORLD.CAVE_GROTTO_POS.x + 5.0, WORLD.CAVE_GROTTO_POS.z + 1.5, 1.05);
  pushNode('copper_vein', WORLD.CAVE_GROTTO_POS.x + 0.5, WORLD.CAVE_GROTTO_POS.z - 7.5, 1.15);
  pushNode('iron_vein', WORLD.CAVE_GROTTO_POS.x - 7.5, WORLD.CAVE_GROTTO_POS.z + 4.0, 1.05);
  pushNode('flint_nodule', WORLD.CAVE_GROTTO_POS.x + 7.0, WORLD.CAVE_GROTTO_POS.z - 5.0, 1.0);

  // --- Act 3 Ancient Ruins (76, -62) & Research Station (-16, -112) ---
  pushNode('herb_patch', WORLD.ANCIENT_RUINS_POS.x - 8.5, WORLD.ANCIENT_RUINS_POS.z + 5.0, 1.05);
  pushNode('supply_crate', WORLD.ANCIENT_RUINS_POS.x + 7.0, WORLD.ANCIENT_RUINS_POS.z + 4.0, 1.0);
  pushNode('fuel_drum', WORLD.RESEARCH_STATION_POS.x + 9.5, WORLD.RESEARCH_STATION_POS.z + 6.5, 1.05);
  pushNode('fuel_drum', WORLD.RESEARCH_STATION_POS.x - 6.5, WORLD.RESEARCH_STATION_POS.z + 8.5, 1.0);
  pushNode('tech_wreck', WORLD.RESEARCH_STATION_POS.x - 9.5, WORLD.RESEARCH_STATION_POS.z - 4.5, 1.05);
  pushNode('tech_wreck', WORLD.RESEARCH_STATION_POS.x + 4.0, WORLD.RESEARCH_STATION_POS.z + 8.0, 1.0);
  pushNode('supply_crate', WORLD.RESEARCH_STATION_POS.x + 5.0, WORLD.RESEARCH_STATION_POS.z - 10.5, 1.0);

  // Scattered Palm trees across Act 1 cove and Act 2 plateaus
  for (let i = 0; i < 82; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = 16 + rng() * (islandRadius * 0.66);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius - 8;
    if (nearImportantSpot(x, z)) continue;
    const y = sampleIslandHeight(x, z, islandRadius);
    if (y > 1.2 && y < 13.5) {
      pushNode('palm_tree', x, z, 0.9 + rng() * 0.36);
      if (i % 4 === 0) {
        pushNode('coconut', x + (rng() - 0.5) * 3.0, z + (rng() - 0.5) * 3.0, 1.0);
      }
    }
  }

  // Interior Pitch Pines (resin source) predominantly north of ACT1_RIDGE_Z (Act 2+)
  for (let i = 0; i < 34; i++) {
    const x = (rng() - 0.5) * 260;
    const z = WORLD.ACT1_RIDGE_Z - 14 - rng() * 145;
    if (nearImportantSpot(x, z)) continue;
    const y = sampleIslandHeight(x, z, islandRadius);
    if (y > 3.5 && y < 18.0) {
      pushNode('resin_tree', x, z, 0.95 + rng() * 0.35);
    }
  }

  // Fibre, Berry & Medicinal Herb patches spread across island biomes
  for (let i = 0; i < 68; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = 18 + rng() * (islandRadius * 0.64);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius - 8;
    if (nearImportantSpot(x, z)) continue;
    const y = sampleIslandHeight(x, z, islandRadius);
    if (y > 1.0 && y < 14.0) {
      const kind: GatherNodeType =
        z < WORLD.ACT1_RIDGE_Z && i % 4 === 0
          ? 'herb_patch'
          : i % 3 === 0
            ? 'berry_bush'
            : 'fibre_bush';
      pushNode(kind, x, z, 0.9 + rng() * 0.25);
    }
  }

  // Wide Coastal rim: Driftwood, Flint, Loose Stone & Shells
  for (let i = 0; i < 60; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = islandRadius * 0.54 + rng() * (islandRadius * 0.18);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius - 8;
    if (nearImportantSpot(x, z)) continue;
    const y = sampleIslandHeight(x, z, islandRadius);
    if (y >= 0.2 && y <= 2.6) {
      const kind: GatherNodeType =
        i % 4 === 0
          ? 'flint_nodule'
          : i % 4 === 1
            ? 'driftwood'
            : i % 4 === 2
              ? 'loose_stone'
              : 'shell_cluster';
      pushNode(kind, x, z, 0.9 + rng() * 0.25);
    }
  }

  // Basalt boulders & occasional inland iron outcrops
  for (let i = 0; i < 38; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = 16 + rng() * (islandRadius * 0.58);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius - 8;
    if (nearImportantSpot(x, z)) continue;
    const y = sampleIslandHeight(x, z, islandRadius);
    if (y > 2.2 && y < 19.0) {
      pushNode(z < WORLD.ACT1_RIDGE_Z - 10 && i % 4 === 0 ? 'iron_vein' : 'boulder', x, z, 0.88 + rng() * 0.42);
    }
  }

  return nodes;
}

export function isNodeAvailable(
  nodeId: string,
  nodeStates: Record<string, NodeState>,
  totalHours: number
): boolean {
  const st = nodeStates[nodeId];
  if (!st) return true;
  if (st.remaining > 0) return true;
  if (st.respawnAt !== undefined && st.respawnAt !== null && totalHours >= st.respawnAt) {
    return true;
  }
  return false;
}

export function tickNodeRespawns(
  nodeStates: Record<string, NodeState>,
  totalHours: number
): Record<string, NodeState> {
  let mutated = false;
  const next: Record<string, NodeState> = {};

  for (const [id, st] of Object.entries(nodeStates)) {
    if (st.remaining <= 0 && st.respawnAt !== null && st.respawnAt !== undefined && totalHours >= st.respawnAt) {
      mutated = true;
      // Removing the entry resets the node back to full maxHealth
      continue;
    }
    next[id] = st;
  }

  return mutated ? next : nodeStates;
}

export function hitGatherNode(
  state: SurvivalState,
  nodeDef: GatherNodeDef
): {
  state: SurvivalState;
  hit: boolean;
  depleted: boolean;
  message: string;
  sound: 'chop' | 'mine' | 'pickup' | 'blocked';
  granted?: { itemId: ItemId; count: number }[];
} {
  const meta = GATHER_NODE_META[nodeDef.type];
  if (!isNodeAvailable(nodeDef.id, state.nodes, state.clock.totalHours)) {
    return {
      state,
      hit: false,
      depleted: true,
      message: `${meta.label} is depleted.`,
      sound: 'blocked',
    };
  }

  const equipped = getEquipped(state.inventory, state.selectedSlot);
  const heldTool = equipped.def?.tool;

  // Check tool requirement
  if (meta.requiredTool) {
    const { kind, minTier } = meta.requiredTool;
    if (!heldTool || heldTool.kind !== kind || heldTool.tier < minTier) {
      const toolName = kind === 'axe' ? 'an Axe (craft a Stone Hatchet)' : 'a Pickaxe (craft a Flint Pickaxe)';
      return {
        state,
        hit: false,
        depleted: false,
        message: `Requires ${toolName} equipped on your hotbar to harvest ${meta.label}.`,
        sound: 'blocked',
      };
    }
  }

  if (state.needs.stamina < NEEDS.STAMINA_PER_SWING) {
    return {
      state,
      hit: false,
      depleted: false,
      message: 'Too exhausted! Catch your breath before swinging.',
      sound: 'blocked',
    };
  }

  // Compute strike power
  const matchingToolTier =
    heldTool && (!meta.requiredTool || heldTool.kind === meta.requiredTool.kind)
      ? heldTool.tier
      : 0;
  const power = TOOL_POWER[Math.min(TOOL_POWER.length - 1, matchingToolTier)];

  const prevNodeState = state.nodes[nodeDef.id];
  const currentHp =
    prevNodeState && prevNodeState.remaining > 0 ? prevNodeState.remaining : meta.maxHealth;
  const nextHp = Math.max(0, currentHp - power);
  const depleted = nextHp <= 0;

  let nextInventory = state.inventory;
  let toolBrokeNote = '';

  // Damage equipped tool durability if a physical tool was used
  if (heldTool && heldTool.kind !== 'torch' && heldTool.kind !== 'lantern') {
    const dmgRes = damageSlotDurability(nextInventory, state.selectedSlot, 1);
    nextInventory = dmgRes.inventory;
    if (dmgRes.broke && dmgRes.brokenItemId) {
      toolBrokeNote = ` (Your ${ITEM_DEFS[dmgRes.brokenItemId].name} broke!)`;
    }
  }

  let itemsGatheredDelta = 0;
  const gainedSummary: string[] = [];
  const granted: { itemId: ItemId; count: number }[] = [];

  if (depleted) {
    for (const y of meta.yields) {
      const res = addItem(nextInventory, y.itemId, y.count);
      nextInventory = res.inventory;
      itemsGatheredDelta += res.added;
      gainedSummary.push(`+${res.added} ${ITEM_DEFS[y.itemId].name}`);
      if (res.added > 0) {
        granted.push({ itemId: y.itemId, count: res.added });
      }
    }
  }

  const respawnHours = NODE_RESPAWN_HOURS[nodeDef.type] ?? null;
  const nextNodeState: NodeState = {
    remaining: nextHp,
    respawnAt: depleted && respawnHours !== null ? state.clock.totalHours + respawnHours : null,
  };

  const nextNeeds = {
    ...state.needs,
    stamina: Math.max(0, state.needs.stamina - NEEDS.STAMINA_PER_SWING),
  };

  const message = depleted
    ? `Harvested ${meta.label}: ${gainedSummary.join(', ')}${toolBrokeNote}`
    : `${meta.promptVerb} ${meta.label} (${nextHp}/${meta.maxHealth})${toolBrokeNote}`;

  return {
    state: {
      ...state,
      needs: nextNeeds,
      inventory: nextInventory,
      nodes: {
        ...state.nodes,
        [nodeDef.id]: nextNodeState,
      },
      stats: {
        ...state.stats,
        itemsGathered: state.stats.itemsGathered + itemsGatheredDelta,
      },
    },
    hit: true,
    depleted,
    message,
    sound: meta.sound,
    granted,
  };
}

export function createInitialSurvivalState(
  difficulty: 'survivor' | 'hardcore' = 'survivor'
): SurvivalState {
  const spawnX = WORLD.PLAYER_SPAWN.x;
  const spawnZ = WORLD.PLAYER_SPAWN.z;
  const spawnY = Math.max(0.5, sampleIslandHeight(spawnX, spawnZ, WORLD.ISLAND_RADIUS));

  return {
    version: SAVE.VERSION,
    act: 1,
    storyPhase: 'alone',
    difficulty,
    needs: {
      health: NEEDS.START.health,
      hunger: NEEDS.START.hunger,
      thirst: NEEDS.START.thirst,
      stamina: NEEDS.START.stamina,
      temperature: NEEDS.START.temperature,
      wetness: 20, // Washed ashore damp on the sand
      sickness: 0,
    },
    alive: true,
    inventory: createEmptyInventory(),
    selectedSlot: 0,
    clock: {
      day: 1,
      hour: TIME.START_HOUR,
      totalHours: 0,
    },
    weather: {
      kind: 'clear',
      rain: 0,
      wind: 0.15,
    },
    nodes: {},
    campfires: [],
    shelters: [],
    structures: [],
    cluesFound: [],
    unlockedGates: [],
    stationRepairs: { radio: false, generator: false, chart: false },
    wildlife: generateInitialWildlife(WORLD.SEED + 77, WORLD.ISLAND_RADIUS),
    boat: createInitialBoatState(),
    voyage: createInitialVoyageState(),
    bossDifficulty: 'normal',
    boss: createInitialBossState('normal'),
    companion: createInitialDanielState(),
    powers: createInitialPowersState(),
    auraKingAI: createInitialAuraKingAIState(),
    stronghold: createInitialStrongholdState(),
    prison: createInitialPrisonState(),
    journalEntries: [],
    achievements: [],
    escapedCity: false,
    discoveredCells: revealMapAround([], spawnX, spawnZ),
    player: { x: spawnX, y: spawnY, z: spawnZ, yaw: 0 },
    spawnPoint: { x: spawnX, y: spawnY, z: spawnZ, yaw: 0 },
    flags: {},
    stats: {
      itemsCrafted: 0,
      itemsGathered: 0,
      distanceTravelled: 0,
      deaths: 0,
      playTimeSec: 0,
      bossFightTimeSec: 0,
    },
    lastSavedAt: null,
    lastSaveKind: null,
  };
}
