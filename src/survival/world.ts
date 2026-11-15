// Pure world geography, sculpted spread-out terrain heightmap, Act 1/2/3 barrier gating,
// zone classification, gate unlocking, and Fog-of-War map helpers. No Three.js or React imports.

import { COLLISION_TUNING, PART5_IMMERSION_TUNING, SAVE, STANCE_TUNING, WORLD } from './config.ts';
import { countItem, removeItem } from './items.ts';
import type {
  BarrierGateDef,
  MapZoneId,
  PlacedShelter,
  PlayerStance,
  SurvivalState,
} from './types.ts';

export interface IslandZoneMeta {
  id: MapZoneId;
  name: string;
  act: 1 | 2 | 3;
  mapColor: string;
  description: string;
}

export const ISLAND_ZONES: Record<MapZoneId, IslandZoneMeta> = {
  ocean: {
    id: 'ocean',
    name: 'Pacific Shallows',
    act: 1,
    mapColor: '#1a5a75',
    description: 'Warm reef surf encircling the island. Deep currents pull you back offshore.',
  },
  crash_beach: {
    id: 'crash_beach',
    name: 'Flight 404 Beach',
    act: 1,
    mapColor: '#d9bf8c',
    description: 'Broad southern shore scattered with wing debris, driftwood, and washed-up crates.',
  },
  tide_pools: {
    id: 'tide_pools',
    name: 'Western Tide Pools',
    act: 1,
    mapColor: '#7f9396',
    description: 'Basalt rocky point rich in sharp flint nodules, driftwood, and tidewater shells.',
  },
  palm_cove: {
    id: 'palm_cove',
    name: 'Palm Cove Groves',
    act: 1,
    mapColor: '#568c48',
    description: 'Spreading coastal groves of coconut palms, wild berry thickets, and coastal boars.',
  },
  fresh_spring: {
    id: 'fresh_spring',
    name: 'Freshwater Spring',
    act: 1,
    mapColor: '#489186',
    description: 'Moss-lined rock seep below the basalt foothills. Boil water before drinking.',
  },
  northern_ridge: {
    id: 'northern_ridge',
    name: 'Basalt Spine Ridge',
    act: 2,
    mapColor: '#5c5852',
    description: 'Sheer volcanic escarpment bisecting the island, passable only through three gated passes.',
  },
  dense_jungle: {
    id: 'dense_jungle',
    name: 'Interior Jungle Plateau',
    act: 2,
    mapColor: '#2f6334',
    description: 'Wide humid jungle interior rich in pine resin, medicinal herbs, boars, and vipers.',
  },
  abandoned_camp: {
    id: 'abandoned_camp',
    name: 'Abandoned Survivor Camp',
    act: 2,
    mapColor: '#6f8749',
    description: 'An older weathered clearing with salvaged canvas tarps and notes left years ago.',
  },
  jungle_crash: {
    id: 'jungle_crash',
    name: 'Tail Wreckage Clearing',
    act: 2,
    mapColor: '#64748b',
    description: 'Broken Flight 404 tail section in the eastern jungle — rich in alloy scrap and avionics.',
  },
  eastern_river: {
    id: 'eastern_river',
    name: 'Eastern Gorge River',
    act: 2,
    mapColor: '#2f7285',
    description: 'Swift gorge river carving down from highland iron veins toward the eastern sea.',
  },
  basalt_caves: {
    id: 'basalt_caves',
    name: 'Western Basalt Caves',
    act: 3,
    mapColor: '#312e42',
    description: 'Cold shadowed rock caverns rich in copper wire, coal seams, and lurking vipers. Bring light.',
  },
  ancient_ruins: {
    id: 'ancient_ruins',
    name: 'Overgrown Stone Ruins',
    act: 3,
    mapColor: '#78716c',
    description: 'Moss-covered basalt monoliths and stone plinths overlooking the northeast cliffs.',
  },
  research_station: {
    id: 'research_station',
    name: 'Station 3 Radio Compound',
    act: 3,
    mapColor: '#991b1b',
    description: 'Abandoned survey outpost and radio mast perched high beneath the volcanic caldera.',
  },
  volcanic_peak: {
    id: 'volcanic_peak',
    name: 'Caldera Ridge Highlands',
    act: 3,
    mapColor: '#4a4340',
    description: 'Exposed basalt summit rim swept by cold highland winds.',
  },
};

export const ISLAND_GATES: BarrierGateDef[] = [
  {
    id: 'gate_jungle_vines',
    name: 'Overgrown Banyan Thicket',
    x: 0,
    z: WORLD.ACT1_RIDGE_Z,
    halfWidth: 7.5,
    halfDepth: 3.4,
    requiredToolLabel: 'Brush Machete or Steel Axe (Tier 2)',
    requiredAnyItems: ['machete', 'metal_axe'],
    unlockAct: 2,
    description: 'Iron-hard banyan roots and thorny lianas choke the central saddle pass.',
    blockedMessage:
      'Too thick for stone tools. Craft a Brush Machete or Steel Axe at a Workbench, then press [E] to cut through.',
  },
  {
    id: 'gate_west_cliffs',
    name: 'Western Basalt Cliff Ledge',
    x: -64,
    z: WORLD.ACT1_RIDGE_Z + 2,
    halfWidth: 6.5,
    halfDepth: 3.4,
    requiredToolLabel: 'Climbing Rope & Pitons (Tier 2)',
    requiredAnyItems: ['climbing_gear'],
    unlockAct: 2,
    description: 'Slick stepped basalt ledges towering above the western spring highlands.',
    blockedMessage:
      'Too sheer to free-climb. Craft Climbing Rope & Pitons at a Workbench, then press [E] to rig a route.',
  },
  {
    id: 'gate_east_river',
    name: 'Eastern River Rapids',
    x: 68,
    z: WORLD.ACT1_RIDGE_Z + 2,
    halfWidth: 7.5,
    halfDepth: 3.4,
    requiredToolLabel: 'Lashed Gorge Raft (Tier 2)',
    requiredAnyItems: ['river_raft'],
    unlockAct: 2,
    description: 'Churning whitewater channel roaring down out of the eastern highland gorge.',
    blockedMessage:
      'Current is too swift to ford safely. Craft a Lashed Gorge Raft at a Workbench, then press [E] to cross.',
  },
  {
    id: 'gate_research_station',
    name: 'Station 3 Perimeter Security Gate',
    x: WORLD.RESEARCH_STATION_POS.x,
    z: WORLD.STATION_GATE_Z,
    halfWidth: 7.5,
    halfDepth: 3.2,
    requiredToolLabel: 'Station 3 Security Keycard (Ancient Ruins)',
    requiredAnyItems: ['station_keycard'],
    unlockAct: 3,
    description: 'Chain-link steel compound fence locking down the Caldera Research Station.',
    blockedMessage:
      'Locked security fence. Search the Ancient Stone Ruins in the northeast highlands for Dr. Patel\'s Security Keycard.',
  },
];

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function hash2D(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function valueNoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const a = hash2D(ix, iz);
  const b = hash2D(ix + 1, iz);
  const c = hash2D(ix, iz + 1);
  const d = hash2D(ix + 1, iz + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function fbm(x: number, z: number): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < 4; i++) {
    sum += amp * (valueNoise(x * freq, z * freq) * 2 - 1);
    freq *= 2.04;
    amp *= 0.5;
  }
  return sum;
}

export function getEasternRiverCenterX(z: number): number {
  return 68 + Math.sin((z - (WORLD.ACT1_RIDGE_Z + 2)) * 0.032) * 12;
}

interface ExternalTerrainGrid {
  heights: Float32Array;
  cliffMask: Uint8Array | null;
  res: number;
  spanM: number;
}

let externalTerrainGrid: ExternalTerrainGrid | null = null;

/**
 * Registers the high-resolution Blender-sculpted terrain heightfield & BVH cliff obstacle mask.
 * Pure Node tests keep `externalTerrainGrid = null` and use the deterministic analytic baseline.
 */
export function setExternalTerrainGrid(
  heights: Float32Array,
  cliffMask: Uint8Array | null,
  res: number,
  spanM: number
): void {
  externalTerrainGrid = { heights, cliffMask, res, spanM };
}

export function clearExternalTerrainGrid(): void {
  externalTerrainGrid = null;
}

export function isPointBlockedByCliffMask(x: number, z: number): boolean {
  const g = externalTerrainGrid;
  if (!g || !g.cliffMask) return false;
  const half = g.spanM * 0.5;
  if (x < -half || x > half || z < -half || z > half) return false;
  const ix = Math.max(0, Math.min(g.res - 1, Math.round(((x + half) / g.spanM) * (g.res - 1))));
  const iy = Math.max(0, Math.min(g.res - 1, Math.round(((-z + half) / g.spanM) * (g.res - 1))));
  return g.cliffMask[iy * g.res + ix] > 0;
}

/** Sample bilinear terrain height from an external TerrainGridData buffer at world (x, z). */
export function sampleTerrainGridBilinear(
  g: { heights: Float32Array; res: number; spanM: number },
  x: number,
  z: number
): number | null {
  const half = g.spanM * 0.5;
  if (x < -half || x > half || z < -half || z > half) return null;
  const u = Math.max(0, Math.min(g.res - 1.0001, ((x + half) / g.spanM) * (g.res - 1)));
  const v = Math.max(0, Math.min(g.res - 1.0001, ((-z + half) / g.spanM) * (g.res - 1)));
  const i0 = Math.floor(u);
  const j0 = Math.floor(v);
  const fx = u - i0;
  const fy = v - j0;
  const r = g.res;
  const h00 = g.heights[j0 * r + i0];
  const h10 = g.heights[j0 * r + i0 + 1];
  const h01 = g.heights[(j0 + 1) * r + i0];
  const h11 = g.heights[(j0 + 1) * r + i0 + 1];
  return (h00 * (1 - fx) + h10 * fx) * (1 - fy) + (h01 * (1 - fx) + h11 * fx) * fy;
}

/**
 * Deterministic spread-out 3D heightmap shared between pure gameplay physics,
 * node/wildlife placement, Fog-of-War, and Three.js terrain geometry.
 */
export function sampleIslandHeight(
  x: number,
  z: number,
  islandRadius: number = WORLD.ISLAND_RADIUS
): number {
  const g = externalTerrainGrid;
  if (g && Math.abs(islandRadius - WORLD.ISLAND_RADIUS) < 1) {
    const hSample = sampleTerrainGridBilinear(g, x, z);
    if (hSample !== null) return hSample;
  }
  const cz = -8;
  const rx = islandRadius * 0.72; // ~187m half-width
  const rz = islandRadius * 0.68; // ~177m half-length

  const ang = Math.atan2(z - cz, x);
  const coastWarp =
    0.055 * Math.sin(ang * 3 + 0.5) +
    0.035 * Math.cos(ang * 5 - 1.1) +
    0.03 * fbm(x * 0.015, z * 0.015);
  const ell = Math.hypot(x / rx, (z - cz) / rz) + coastWarp;

  const shoreMask = 1 - smoothstep(0.76, 0.97, ell);
  let h = -8.5 * (1 - shoreMask);

  if (shoreMask > 0.001) {
    // Broad undulating elevation climbing gradually north into jungle plateau & volcanic ridge
    const northRise = smoothstep(138, -90, z) * 10.5;
    const micro = fbm(x * 0.022, z * 0.022) * 2.1 + fbm(x * 0.068, z * 0.068) * 0.52;
    const beachSlope = (1 - smoothstep(0.68, 0.94, ell)) * 3.8;
    h = -1.2 + beachSlope + shoreMask * (northRise + micro * (0.35 + 0.65 * shoreMask));

    // 1. Broad Golden Southern Crash Cove spanning spawn (0, 146) -> wreck (38, 132)
    const dxCrash = x - 18;
    const dzCrash = z - 140;
    const crashDist = Math.hypot(dxCrash / 52, dzCrash / 24);
    if (crashDist < 1.3) {
      const w = 1 - smoothstep(0.35, 1.3, crashDist);
      const flatBeach = 1.1 + smoothstep(158, 114, z) * 1.9 + fbm(x * 0.055, z * 0.055) * 0.28;
      h = h * (1 - w) + flatBeach * w;
    }

    // 2. Western Tide Pools rocky flint shelf (-68, 118)
    const dxPool = x - WORLD.TIDE_POOLS_POS.x;
    const dzPool = z - WORLD.TIDE_POOLS_POS.z;
    const poolDist = Math.hypot(dxPool / 26, dzPool / 20);
    if (poolDist < 1.25) {
      const w = 1 - smoothstep(0.3, 1.25, poolDist);
      const shelf = 0.72 + Math.sin(x * 0.26) * Math.cos(z * 0.26) * 0.3;
      h = h * (1 - w) + shelf * w;
    }

    // 3. Freshwater Spring mossy hollow (-34, 82) — smooth, gently sloped walkable bank
    const springDist = Math.hypot(x - WORLD.SPRING_POS.x, z - WORLD.SPRING_POS.z);
    if (springDist < 12) {
      const w = 1 - smoothstep(2.0, 12, springDist);
      const basin = 2.48 + 0.77 * smoothstep(1.2, 6.8, springDist);
      h = h * (1 - w) + basin * w;
    }

    // 4. Towering Basalt Spine Ridge across z ≈ ACT1_RIDGE_Z (42), guarding Act 2 interior
    const ridgeLine = WORLD.ACT1_RIDGE_Z + Math.sin(x * 0.048) * 2.8;
    const ridgeBand = Math.exp(-Math.pow((z - ridgeLine) / 6.2, 2));
    if (ridgeBand > 0.02 && ell < 0.91) {
      const centerPass = Math.exp(-Math.pow(x / 7.5, 2));
      const westLedge = Math.exp(-Math.pow((x + 64) / 6.5, 2));
      const eastRiver = Math.exp(-Math.pow((x - 68) / 7.5, 2));

      const wallMultiplier = Math.max(
        0,
        1 - centerPass * 0.92 - westLedge * 0.56 - eastRiver * 1.05
      );
      const crag = 15.5 + Math.abs(fbm(x * 0.09, z * 0.09)) * 6.5;
      h += ridgeBand * crag * wallMultiplier;
    }

    // 5. Eastern Gorge River cutting north-to-south past gate_east_river (68, 44)
    const riverCenterX = getEasternRiverCenterX(z);
    const riverDist = Math.abs(x - riverCenterX);
    if (z < 76 && z > -98 && riverDist < 10.5) {
      const rw = 1 - smoothstep(2.6, 10.5, riverDist);
      const riverFlowFade = smoothstep(76, 52, z);
      const riverBed = -0.65;
      h = h * (1 - rw * riverFlowFade * 0.92) + riverBed * (rw * riverFlowFade * 0.92);
    }

    // 6. Act 2 Abandoned Camp (-56, 8) & Tail Wreckage (48, -12) gentle levelings
    const campDist = Math.hypot(x - WORLD.ABANDONED_CAMP_POS.x, z - WORLD.ABANDONED_CAMP_POS.z);
    if (campDist < 16) {
      const w = 1 - smoothstep(4, 16, campDist);
      h = h * (1 - w) + 7.4 * w;
    }
    const tailDist = Math.hypot(x - WORLD.JUNGLE_TAIL_POS.x, z - WORLD.JUNGLE_TAIL_POS.z);
    if (tailDist < 16) {
      const w = 1 - smoothstep(4, 16, tailDist);
      h = h * (1 - w) + 8.2 * w;
    }

    // 7. Act 3 Western Basalt Caves sunken amphitheater (-78, -48)
    const caveDist = Math.hypot(x - WORLD.CAVE_GROTTO_POS.x, z - WORLD.CAVE_GROTTO_POS.z);
    if (caveDist < 22) {
      const inner = 1 - smoothstep(6, 14, caveDist);
      const rim = Math.exp(-Math.pow((caveDist - 15.5) / 3.5, 2));
      // Keep southern entrance arch open for walking in
      const entranceMask = z > WORLD.CAVE_GROTTO_POS.z + 5 && Math.abs(x - WORLD.CAVE_GROTTO_POS.x) < 7 ? 0.1 : 1;
      h = h * (1 - inner * 0.75) + 6.4 * (inner * 0.75) + rim * 8.5 * entranceMask;
    }

    // 8. Act 3 Ancient Stone Ruins terrace (76, -62)
    const ruinsDist = Math.hypot(x - WORLD.ANCIENT_RUINS_POS.x, z - WORLD.ANCIENT_RUINS_POS.z);
    if (ruinsDist < 18) {
      const w = 1 - smoothstep(6, 18, ruinsDist);
      h = h * (1 - w) + 11.2 * w;
    }

    // 9. Northern Caldera Peak & Research Station Compound (-16, -112)
    const stationDist = Math.hypot(x - WORLD.RESEARCH_STATION_POS.x, z - WORLD.RESEARCH_STATION_POS.z);
    if (stationDist < 48) {
      const rise = Math.pow(1 - smoothstep(0, 48, stationDist), 1.25);
      h += rise * 10.5;
    }
    if (stationDist < 20) {
      const w = 1 - smoothstep(8, 20, stationDist);
      h = h * (1 - w) + 21.5 * w;
    }

    // Graded south approach ramp through Station Perimeter Gate (-16, -84)
    const gateLineX = WORLD.RESEARCH_STATION_POS.x;
    if (z <= -58 && z >= -108 && Math.abs(x - gateLineX) < 12) {
      const tRamp = smoothstep(-58, -104, z);
      const rampWidth = 1 - smoothstep(5, 12, Math.abs(x - gateLineX));
      const rampH = 12.2 + tRamp * 9.3;
      h = h * (1 - rampWidth * 0.85) + rampH * (rampWidth * 0.85);
    }

    // Flanking volcanic cliffs around station gate so you enter via the locked perimeter gate
    const stationRidgeBand = Math.exp(-Math.pow((z - WORLD.STATION_GATE_Z) / 5.0, 2));
    if (stationRidgeBand > 0.02 && ell < 0.88) {
      const gateNotch = Math.exp(-Math.pow((x - gateLineX) / 8.0, 2));
      const sideCliffMask = Math.max(0, 1 - gateNotch * 1.05);
      const stationCrag = 12 * Math.exp(-Math.pow((x - gateLineX) / 38, 2));
      h += stationRidgeBand * stationCrag * sideCliffMask;
    }
  }

  return h;
}

/**
 * Classifies a world point into a named island zone for HUD, weather hazards, and map.
 */
export function getZoneAt(x: number, z: number): MapZoneId {
  const h = sampleIslandHeight(x, z);
  if (h <= WORLD.WATER_LEVEL + 0.05) {
    if (z < 64 && Math.abs(x - getEasternRiverCenterX(z)) < 11) {
      return 'eastern_river';
    }
    return 'ocean';
  }
  if (Math.hypot(x - WORLD.SPRING_POS.x, z - WORLD.SPRING_POS.z) <= 13) {
    return 'fresh_spring';
  }
  if (Math.hypot(x - WORLD.TIDE_POOLS_POS.x, z - WORLD.TIDE_POOLS_POS.z) <= 24) {
    return 'tide_pools';
  }
  if (Math.hypot(x - WORLD.ABANDONED_CAMP_POS.x, z - WORLD.ABANDONED_CAMP_POS.z) <= 18) {
    return 'abandoned_camp';
  }
  if (Math.hypot(x - WORLD.JUNGLE_TAIL_POS.x, z - WORLD.JUNGLE_TAIL_POS.z) <= 18) {
    return 'jungle_crash';
  }
  if (Math.hypot(x - WORLD.CAVE_GROTTO_POS.x, z - WORLD.CAVE_GROTTO_POS.z) <= 20) {
    return 'basalt_caves';
  }
  if (Math.hypot(x - WORLD.ANCIENT_RUINS_POS.x, z - WORLD.ANCIENT_RUINS_POS.z) <= 19) {
    return 'ancient_ruins';
  }
  if (Math.hypot(x - WORLD.RESEARCH_STATION_POS.x, z - WORLD.RESEARCH_STATION_POS.z) <= 24) {
    return 'research_station';
  }
  if (Math.abs(z - WORLD.ACT1_RIDGE_Z) <= 8 && h > 10.5) {
    return 'northern_ridge';
  }
  if (z >= WORLD.ACT1_RIDGE_Z) {
    return z >= 104 || h < 2.8 ? 'crash_beach' : 'palm_cove';
  }
  if (Math.abs(x - getEasternRiverCenterX(z)) <= 12) {
    return 'eastern_river';
  }
  if (z < -76 || h > 20) {
    return 'volcanic_peak';
  }
  return 'dense_jungle';
}

export function canUnlockGate(
  gate: BarrierGateDef,
  inventory: SurvivalState['inventory']
): boolean {
  return gate.requiredAnyItems.some((itemId) => countItem(inventory, itemId) >= 1);
}

export function tryUnlockGate(
  state: SurvivalState,
  gateId: string
): { ok: boolean; state: SurvivalState; message: string; gate?: BarrierGateDef } {
  const gate = ISLAND_GATES.find((g) => g.id === gateId);
  if (!gate) {
    return { ok: false, state, message: 'Unknown barrier.' };
  }
  if (state.unlockedGates.includes(gateId)) {
    return { ok: true, state, gate, message: `${gate.name} is already open.` };
  }
  if (!canUnlockGate(gate, state.inventory)) {
    return { ok: false, state, gate, message: gate.blockedMessage };
  }

  let nextInventory = state.inventory;
  if (gate.consumeOnUnlock) {
    const matched = gate.requiredAnyItems.find((id) => countItem(nextInventory, id) >= 1);
    if (matched) {
      nextInventory = removeItem(nextInventory, matched, 1).inventory;
    }
  }

  const nextAct: SurvivalState['act'] =
    gate.unlockAct > state.act ? gate.unlockAct : state.act;

  return {
    ok: true,
    gate,
    state: {
      ...state,
      act: nextAct,
      inventory: nextInventory,
      unlockedGates: [...state.unlockedGates, gateId],
    },
    message: `Cleared ${gate.name}! Route into ${
      gate.unlockAct === 3 ? 'Station 3 Compound' : 'the Island Interior'
    } is now open.`,
  };
}

export type WorldCollider =
  | {
      kind: 'circle';
      id: string;
      x: number;
      z: number;
      radius: number;
    }
  | {
      kind: 'obb';
      id: string;
      x: number;
      z: number;
      halfW: number;
      halfD: number;
      yaw: number;
    };

function buildStaticWorldColliders(): WorldCollider[] {
  const list: WorldCollider[] = [
    // Flight 404 Beach Wreckage (WORLD.WRECK_POS = { x: 38, z: 132 })
    {
      kind: 'obb',
      id: 'wreck_fuselage',
      x: WORLD.WRECK_POS.x,
      z: WORLD.WRECK_POS.z,
      halfW: 3.55,
      halfD: 1.68,
      yaw: 0.35,
    },
    {
      kind: 'obb',
      id: 'wreck_wing',
      x: WORLD.WRECK_POS.x - 1.5,
      z: WORLD.WRECK_POS.z + 2.6,
      halfW: 3.8,
      halfD: 1.18,
      yaw: -0.4,
    },
    {
      kind: 'circle',
      id: 'wreck_engine',
      x: WORLD.WRECK_POS.x - 2.2,
      z: WORLD.WRECK_POS.z + 3.5,
      radius: 1.05,
    },
    {
      kind: 'obb',
      id: 'wreck_tail_fin',
      x: WORLD.WRECK_POS.x + 2.8,
      z: WORLD.WRECK_POS.z - 1.9,
      halfW: 1.35,
      halfD: 0.58,
      yaw: 0.8,
    },
    {
      kind: 'obb',
      id: 'wreck_debris_panel',
      x: WORLD.WRECK_POS.x - 2.9,
      z: WORLD.WRECK_POS.z - 1.2,
      halfW: 1.05,
      halfD: 0.75,
      yaw: 0.5,
    },
    {
      kind: 'circle',
      id: 'wreck_seat',
      x: WORLD.WRECK_POS.x - 1.8,
      z: WORLD.WRECK_POS.z + 1.4,
      radius: 0.55,
    },
    {
      kind: 'obb',
      id: 'wreck_suitcase',
      x: WORLD.WRECK_POS.x + 1.4,
      z: WORLD.WRECK_POS.z + 2.2,
      halfW: 0.48,
      halfD: 0.35,
      yaw: 0.9,
    },
    // Jungle Tail Section (WORLD.JUNGLE_TAIL_POS = { x: 48, z: -12 })
    {
      kind: 'obb',
      id: 'tail_fuselage',
      x: WORLD.JUNGLE_TAIL_POS.x,
      z: WORLD.JUNGLE_TAIL_POS.z,
      halfW: 2.75,
      halfD: 1.45,
      yaw: -0.35,
    },
    {
      kind: 'obb',
      id: 'tail_fin',
      x: WORLD.JUNGLE_TAIL_POS.x - 1.6,
      z: WORLD.JUNGLE_TAIL_POS.z + 0.35,
      halfW: 0.55,
      halfD: 2.15,
      yaw: -0.35,
    },
    // Abandoned Camp timber shelter posts
    {
      kind: 'circle',
      id: 'camp_post_w',
      x: WORLD.ABANDONED_CAMP_POS.x - 1.4,
      z: WORLD.ABANDONED_CAMP_POS.z,
      radius: 0.3,
    },
    {
      kind: 'circle',
      id: 'camp_post_e',
      x: WORLD.ABANDONED_CAMP_POS.x + 1.4,
      z: WORLD.ABANDONED_CAMP_POS.z,
      radius: 0.3,
    },
    // Ancient Stone Ruins altar
    {
      kind: 'obb',
      id: 'ruins_altar',
      x: WORLD.ANCIENT_RUINS_POS.x,
      z: WORLD.ANCIENT_RUINS_POS.z,
      halfW: 0.98,
      halfD: 0.68,
      yaw: 0,
    },
    // Research Station back & side hut walls (open south doorway preserved) + radio mast
    {
      kind: 'obb',
      id: 'station_wall_back',
      x: WORLD.RESEARCH_STATION_POS.x,
      z: WORLD.RESEARCH_STATION_POS.z - 5.2,
      halfW: 3.3,
      halfD: 0.35,
      yaw: 0,
    },
    {
      kind: 'obb',
      id: 'station_wall_west',
      x: WORLD.RESEARCH_STATION_POS.x - 3.1,
      z: WORLD.RESEARCH_STATION_POS.z - 2.7,
      halfW: 0.35,
      halfD: 2.7,
      yaw: 0,
    },
    {
      kind: 'obb',
      id: 'station_wall_east',
      x: WORLD.RESEARCH_STATION_POS.x + 3.1,
      z: WORLD.RESEARCH_STATION_POS.z - 2.7,
      halfW: 0.35,
      halfD: 2.7,
      yaw: 0,
    },
    {
      kind: 'circle',
      id: 'station_mast',
      x: WORLD.RESEARCH_STATION_POS.x - 5.6,
      z: WORLD.RESEARCH_STATION_POS.z - 3.8,
      radius: 0.95,
    },
    // Station Repair Consoles (Radio, Generator, Chart desk)
    {
      kind: 'obb',
      id: 'station_console_radio',
      x: WORLD.RESEARCH_STATION_POS.x - 4.2,
      z: WORLD.RESEARCH_STATION_POS.z + 2.4,
      halfW: 0.95,
      halfD: 0.52,
      yaw: 0,
    },
    {
      kind: 'obb',
      id: 'station_console_generator',
      x: WORLD.RESEARCH_STATION_POS.x + 4.4,
      z: WORLD.RESEARCH_STATION_POS.z - 1.5,
      halfW: 0.95,
      halfD: 0.68,
      yaw: 0,
    },
    {
      kind: 'obb',
      id: 'station_console_chart',
      x: WORLD.RESEARCH_STATION_POS.x,
      z: WORLD.RESEARCH_STATION_POS.z - 4.1,
      halfW: 1.1,
      halfD: 0.55,
      yaw: 0,
    },
  ];

  // Cave Grotto horseshoe basalt pillars (open south entrance)
  for (let i = 0; i < 9; i++) {
    const ang = Math.PI * 0.25 + (i / 8) * Math.PI * 1.5;
    list.push({
      kind: 'circle',
      id: `cave_pillar_${i}`,
      x: WORLD.CAVE_GROTTO_POS.x + Math.cos(ang) * 11.5,
      z: WORLD.CAVE_GROTTO_POS.z + Math.sin(ang) * 11.5,
      radius: 3.1,
    });
  }

  // Ancient Ruins 6 perimeter stone pillars
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    list.push({
      kind: 'circle',
      id: `ruins_pillar_${i}`,
      x: WORLD.ANCIENT_RUINS_POS.x + Math.cos(a) * 5.6,
      z: WORLD.ANCIENT_RUINS_POS.z + Math.sin(a) * 5.6,
      radius: 0.62,
    });
  }

  return list;
}

export const WORLD_STATIC_COLLIDERS: WorldCollider[] = buildStaticWorldColliders();

function resolveCircleVsCollider(
  px: number,
  pz: number,
  radius: number,
  col: WorldCollider
): { x: number; z: number; hit: boolean } {
  if (col.kind === 'circle') {
    const dx = px - col.x;
    const dz = pz - col.z;
    const minDist = radius + col.radius;
    const dSq = dx * dx + dz * dz;
    if (dSq >= minDist * minDist) {
      return { x: px, z: pz, hit: false };
    }
    const dist = Math.sqrt(dSq);
    if (dist < 0.0001) {
      return { x: col.x + minDist, z: col.z, hit: true };
    }
    const push = (minDist - dist) / dist;
    return { x: px + dx * push, z: pz + dz * push, hit: true };
  }

  // Circle vs Oriented 2D Bounding Box (yaw matches Three.js mesh.rotation.y)
  const cosY = Math.cos(col.yaw);
  const sinY = Math.sin(col.yaw);
  const dx = px - col.x;
  const dz = pz - col.z;
  const lx = dx * cosY - dz * sinY;
  const lz = dx * sinY + dz * cosY;

  const clampedX = Math.max(-col.halfW, Math.min(col.halfW, lx));
  const clampedZ = Math.max(-col.halfD, Math.min(col.halfD, lz));
  const offX = lx - clampedX;
  const offZ = lz - clampedZ;
  const distSq = offX * offX + offZ * offZ;

  if (distSq >= radius * radius) {
    return { x: px, z: pz, hit: false };
  }

  let pushLX = 0;
  let pushLZ = 0;
  if (distSq > 0.000001) {
    const dist = Math.sqrt(distSq);
    const pen = radius - dist;
    pushLX = (offX / dist) * pen;
    pushLZ = (offZ / dist) * pen;
  } else {
    // Center is inside box: push out along nearest box face
    const penX = col.halfW - Math.abs(lx) + radius;
    const penZ = col.halfD - Math.abs(lz) + radius;
    if (penX < penZ) {
      pushLX = lx >= 0 ? penX : -penX;
    } else {
      pushLZ = lz >= 0 ? penZ : -penZ;
    }
  }

  // Transform push vector back from OBB local space to world space
  const pushWX = pushLX * cosY + pushLZ * sinY;
  const pushWZ = -pushLX * sinY + pushLZ * cosY;
  return { x: px + pushWX, z: pz + pushWZ, hit: true };
}

export function resolveCollidersPushout(
  px: number,
  pz: number,
  radius: number,
  extraColliders: WorldCollider[] = []
): { x: number; z: number; hit: boolean } {
  let x = px;
  let z = pz;
  let hit = false;
  for (let pass = 0; pass < 3; pass++) {
    let anyPassHit = false;
    for (let i = 0; i < WORLD_STATIC_COLLIDERS.length; i++) {
      const r = resolveCircleVsCollider(x, z, radius, WORLD_STATIC_COLLIDERS[i]);
      if (r.hit) {
        x = r.x;
        z = r.z;
        hit = true;
        anyPassHit = true;
      }
    }
    for (let i = 0; i < extraColliders.length; i++) {
      const r = resolveCircleVsCollider(x, z, radius, extraColliders[i]);
      if (r.hit) {
        x = r.x;
        z = r.z;
        hit = true;
        anyPassHit = true;
      }
    }
    if (!anyPassHit) break;
  }
  return { x, z, hit };
}

export function clampCameraClearance(
  camX: number,
  camY: number,
  camZ: number,
  extraColliders: WorldCollider[] = []
): { x: number; y: number; z: number } {
  const pushed = resolveCollidersPushout(
    camX,
    camZ,
    COLLISION_TUNING.CAMERA_CLEARANCE_RADIUS,
    extraColliders
  );
  const probeR = COLLISION_TUNING.CAMERA_CLEARANCE_RADIUS;
  const maxGround = Math.max(
    sampleIslandHeight(pushed.x, pushed.z),
    sampleIslandHeight(pushed.x + probeR, pushed.z),
    sampleIslandHeight(pushed.x - probeR, pushed.z),
    sampleIslandHeight(pushed.x, pushed.z + probeR),
    sampleIslandHeight(pushed.x, pushed.z - probeR)
  );
  return {
    x: pushed.x,
    y: Math.max(camY, maxGround + COLLISION_TUNING.CAMERA_MIN_TERRAIN_CLEARANCE),
    z: pushed.z,
  };
}

export interface MovementResolution {
  x: number;
  z: number;
  blockedByGate: BarrierGateDef | null;
  blockedByCliff: boolean;
  blockedByObstacle?: boolean;
}

/**
 * Enforces island boundaries, steep basalt walls with contour wall-sliding,
 * solid wreckage/landmark/tree/rock/structure colliders, and locked Act 1/2/3 gates.
 */
export function resolveWorldMovement(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  unlockedGates: string[],
  waterLevel: number = WORLD.WATER_LEVEL,
  extraColliders: WorldCollider[] = []
): MovementResolution {
  const totalDx = toX - fromX;
  const totalDz = toZ - fromZ;
  const totalDist = Math.hypot(totalDx, totalDz);
  const steps = totalDist <= 0.0001 ? 1 : Math.min(36, Math.max(1, Math.ceil(totalDist / 0.14)));

  let cx = fromX;
  let cz = fromZ;
  let blockedByGate: BarrierGateDef | null = null;
  let blockedByCliff = false;
  let blockedByObstacle = false;

  const act2Gates = ISLAND_GATES.filter((g) => g.unlockAct === 2);
  const stationGate = ISLAND_GATES.find((g) => g.id === 'gate_research_station');
  const maxSwimDist = WORLD.ISLAND_RADIUS * 0.86;
  const playerPad = 0.8;

  const enforceGatesAndBounds = (px: number, pz: number, refX: number, refZ: number) => {
    let nx = px;
    let nz = pz;

    const dist = Math.hypot(nx, nz);
    if (dist > maxSwimDist) {
      const scale = maxSwimDist / dist;
      nx *= scale;
      nz *= scale;
    }

    if (sampleIslandHeight(nx, nz) < waterLevel - 1.7) {
      nx = refX;
      nz = refZ;
    }

    for (const gate of ISLAND_GATES) {
      if (unlockedGates.includes(gate.id)) continue;
      const minX = gate.x - gate.halfWidth - playerPad;
      const maxX = gate.x + gate.halfWidth + playerPad;
      const minZ = gate.z - gate.halfDepth - playerPad;
      const maxZ = gate.z + gate.halfDepth + playerPad;
      if (nx >= minX && nx <= maxX && nz >= minZ && nz <= maxZ) {
        blockedByGate = gate;
        const penLeft = Math.abs(nx - minX);
        const penRight = Math.abs(maxX - nx);
        const penSouth = Math.abs(maxZ - nz);
        const penNorth = Math.abs(nz - minZ);
        const minPen = Math.min(penLeft, penRight, penSouth, penNorth);
        if (minPen === penSouth) nz = maxZ;
        else if (minPen === penNorth) nz = minZ;
        else if (minPen === penLeft) nx = minX;
        else nx = maxX;
      }
    }

    const inUnlockedAct2Pass = act2Gates.some(
      (g) => unlockedGates.includes(g.id) && Math.abs(nx - g.x) <= g.halfWidth
    );
    const ridgeFrontZ = WORLD.ACT1_RIDGE_Z + 1.8;
    if (refZ >= ridgeFrontZ - 0.6 && nz < ridgeFrontZ && !inUnlockedAct2Pass) {
      if (!blockedByGate) {
        const nearGate = act2Gates.find(
          (g) => !unlockedGates.includes(g.id) && Math.abs(nx - g.x) <= g.halfWidth + 3.5
        );
        if (nearGate) blockedByGate = nearGate;
        else blockedByCliff = true;
      }
      nz = Math.max(nz, ridgeFrontZ);
    }

    const stationFrontZ = WORLD.STATION_GATE_Z + 1.8;
    if (
      stationGate &&
      !unlockedGates.includes(stationGate.id) &&
      refZ >= stationFrontZ - 0.6 &&
      nz < stationFrontZ &&
      Math.abs(nx - stationGate.x) <= 22
    ) {
      if (!blockedByGate) blockedByGate = stationGate;
      nz = Math.max(nz, stationFrontZ);
    }

    return { x: nx, z: nz };
  };

  const stepDx = totalDx / steps;
  const stepDz = totalDz / steps;

  for (let s = 0; s < steps; s++) {
    const stepTargetX = cx + stepDx;
    const stepTargetZ = cz + stepDz;

    // 1. Bounds & locked Progression Gates
    let next = enforceGatesAndBounds(stepTargetX, stepTargetZ, cx, cz);

    // 2. Smooth mountain/cliff slope guard with contour sliding (never freeze unless wedged)
    const stepD = Math.hypot(next.x - cx, next.z - cz);
    if (stepD > 0.0005) {
      const curH = sampleIslandHeight(cx, cz);
      const nextH = sampleIslandHeight(next.x, next.z);
      const uphillRise = nextH - curH;

      // Also probe capsule perimeter (PLAYER_RADIUS = 0.44m) ahead along heading so steep walls stop the capsule shell cleanly
      const dirX = (next.x - cx) / stepD;
      const dirZ = (next.z - cz) / stepD;
      const probeDist = COLLISION_TUNING.PLAYER_RADIUS;
      const cliffMaskBlocked =
        isPointBlockedByCliffMask(next.x + dirX * probeDist, next.z + dirZ * probeDist) ||
        isPointBlockedByCliffMask(next.x, next.z);
      const aheadH = sampleIslandHeight(next.x + dirX * probeDist, next.z + dirZ * probeDist);
      const stepSlope = uphillRise / stepD;
      const aheadSlope = (aheadH - curH) / (stepD + probeDist);

      if (
        cliffMaskBlocked ||
        (uphillRise > 0.005 && stepSlope > COLLISION_TUNING.MAX_SLOPE_RISE_PER_M) ||
        (aheadH - curH > 0.18 && aheadSlope > COLLISION_TUNING.MAX_SLOPE_RISE_PER_M)
      ) {
        blockedByCliff = true;

        // Compute mountain contour gradient to slide tangentially along slope base
        const eps = 0.45;
        const gradX =
          (sampleIslandHeight(cx + eps, cz) - sampleIslandHeight(cx - eps, cz)) / (2 * eps);
        const gradZ =
          (sampleIslandHeight(cx, cz + eps) - sampleIslandHeight(cx, cz - eps)) / (2 * eps);
        const gradLen = Math.hypot(gradX, gradZ);

        let slid = false;
        if (cliffMaskBlocked) {
          // Axis-separated tangential slide against solid Blender cliff mask
          const tryX = !isPointBlockedByCliffMask(next.x + dirX * probeDist * 0.6, cz) && !isPointBlockedByCliffMask(next.x, cz);
          const tryZ = !isPointBlockedByCliffMask(cx, next.z + dirZ * probeDist * 0.6) && !isPointBlockedByCliffMask(cx, next.z);
          if (tryX && Math.abs(next.x - cx) >= Math.abs(next.z - cz)) {
            next = enforceGatesAndBounds(next.x, cz, cx, cz);
            slid = true;
          } else if (tryZ) {
            next = enforceGatesAndBounds(cx, next.z, cx, cz);
            slid = true;
          }
        } else if (gradLen > 0.05) {
          const nxGrad = gradX / gradLen;
          const nzGrad = gradZ / gradLen;
          const intoWall = (next.x - cx) * nxGrad + (next.z - cz) * nzGrad;
          if (intoWall > 0) {
            const slideX = next.x - nxGrad * intoWall * 1.05;
            const slideZ = next.z - nzGrad * intoWall * 1.05;
            const slideDist = Math.hypot(slideX - cx, slideZ - cz);
            if (slideDist > 0.0005) {
              const sH = sampleIslandHeight(slideX, slideZ);
              if (
                !isPointBlockedByCliffMask(slideX, slideZ) &&
                sH - curH <= COLLISION_TUNING.MAX_SLOPE_RISE_PER_M * slideDist
              ) {
                next = enforceGatesAndBounds(slideX, slideZ, cx, cz);
                slid = true;
              }
            }
          }
        }
        if (!slid) {
          next = { x: cx, z: cz };
        }
      }
    }

    // 3. Solid Wreckage / Landmarks / Trees / Rocks / Placed Structure Circle-vs-OBB pushout
    const push = resolveCollidersPushout(
      next.x,
      next.z,
      COLLISION_TUNING.PLAYER_RADIUS,
      extraColliders
    );
    if (push.hit) {
      blockedByObstacle = true;
      const guarded = enforceGatesAndBounds(push.x, push.z, cx, cz);
      // Do not allow an obstacle pushout to shove player up an impassable cliff
      const pDist = Math.hypot(guarded.x - cx, guarded.z - cz);
      const curH = sampleIslandHeight(cx, cz);
      const pH = sampleIslandHeight(guarded.x, guarded.z);
      if (pDist > 0.001 && (pH - curH) / pDist > COLLISION_TUNING.MAX_SLOPE_RISE_PER_M * 1.25) {
        cx = cx;
        cz = cz;
      } else {
        cx = guarded.x;
        cz = guarded.z;
      }
    } else {
      cx = next.x;
      cz = next.z;
    }
  }

  return { x: cx, z: cz, blockedByGate, blockedByCliff, blockedByObstacle };
}

export function cellKeyForPos(
  x: number,
  z: number,
  cellSize: number = SAVE.MAP_CELL_SIZE
): string {
  return `${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}`;
}

export function parseCellKey(key: string): { gx: number; gz: number } | null {
  const parts = key.split(',');
  if (parts.length !== 2) return null;
  const gx = Number(parts[0]);
  const gz = Number(parts[1]);
  if (!Number.isFinite(gx) || !Number.isFinite(gz)) return null;
  return { gx, gz };
}

export function revealMapAround(
  existingCells: string[],
  x: number,
  z: number,
  radius: number = SAVE.MAP_REVEAL_RADIUS_M,
  cellSize: number = SAVE.MAP_CELL_SIZE
): string[] {
  const known = new Set(existingCells);
  const cellRadius = Math.ceil(radius / cellSize);
  const centerGx = Math.floor(x / cellSize);
  const centerGz = Math.floor(z / cellSize);
  let changed = false;

  for (let dz = -cellRadius; dz <= cellRadius; dz++) {
    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      const gx = centerGx + dx;
      const gz = centerGz + dz;
      const cx = (gx + 0.5) * cellSize;
      const cz = (gz + 0.5) * cellSize;
      if (Math.hypot(cx - x, cz - z) <= radius) {
        const key = `${gx},${gz}`;
        if (!known.has(key)) {
          known.add(key);
          changed = true;
        }
      }
    }
  }

  return changed ? Array.from(known) : existingCells;
}

/** Approximate count of walkable/coastal map cells on the island for accurate % explored. */
export const ESTIMATED_ISLAND_MAP_CELLS = Math.round(
  (Math.PI * (WORLD.ISLAND_RADIUS * 0.72) * (WORLD.ISLAND_RADIUS * 0.68)) /
    (SAVE.MAP_CELL_SIZE * SAVE.MAP_CELL_SIZE)
);

export type StepSurface = 'sand' | 'grass' | 'stone' | 'water' | 'wood';

/**
 * Maps player coordinates and height to a physical ground material for procedural footsteps.
 */
export function classifyStepSurface(
  x: number,
  z: number,
  height: number,
  isSwimming: boolean,
  inVoyage: boolean
): StepSurface {
  if (inVoyage) return 'wood';
  if (isSwimming || height <= WORLD.WATER_LEVEL + 0.16) return 'water';

  // Slipway pier or research compound timber floor
  if (
    (Math.abs(x - WORLD.BOAT_DOCK_POS.x) < 4.5 && Math.abs(z - WORLD.BOAT_DOCK_POS.z) < 6.5) ||
    Math.hypot(x - WORLD.RESEARCH_STATION_POS.x, z - WORLD.RESEARCH_STATION_POS.z) < 7
  ) {
    return 'wood';
  }

  const zone = getZoneAt(x, z);
  if (
    zone === 'basalt_caves' ||
    zone === 'ancient_ruins' ||
    zone === 'northern_ridge' ||
    zone === 'volcanic_peak' ||
    height > 12.5
  ) {
    return 'stone';
  }
  if (zone === 'crash_beach' || zone === 'tide_pools' || height < 1.95) {
    return 'sand';
  }
  return 'grass';
}

// ---------------------------------------------------------------------------
// STANCE OVERHEAD CLEARANCE & CRAWL SPACES (Part 3)
// ---------------------------------------------------------------------------

export interface OverheadCeilingZone {
  id: string;
  label: string;
  x: number;
  z: number;
  radius: number;
  ceilingHeightM: number;
}

/**
 * Natural & wreckage crawlspaces / low overhangs where standing upright is physically blocked
 * while crouch/prone/sit can occupy the space.
 */
export const WORLD_LOW_CEILING_ZONES: OverheadCeilingZone[] = [
  {
    id: 'wing_undercut',
    label: 'Flight 404 wing overhang',
    x: WORLD.WRECK_POS.x + 5.2,
    z: WORLD.WRECK_POS.z + 2.4,
    radius: 2.35,
    ceilingHeightM: 1.08,
  },
  {
    id: 'camp_lean_to',
    label: 'Abandoned camp lean-to roof',
    x: WORLD.ABANDONED_CAMP_POS.x + 1.5,
    z: WORLD.ABANDONED_CAMP_POS.z - 2.0,
    radius: 1.85,
    ceilingHeightM: 1.24,
  },
  {
    id: 'cave_low_arch',
    label: 'Basalt cave low arch',
    x: WORLD.CAVE_GROTTO_POS.x - 4.4,
    z: WORLD.CAVE_GROTTO_POS.z + 3.2,
    radius: 2.25,
    ceilingHeightM: 1.15,
  },
];

export function requiredClearanceForStance(stance: PlayerStance): number {
  switch (stance) {
    case 'crouch':
      return STANCE_TUNING.CLEARANCE_CROUCH_M;
    case 'sit':
      return STANCE_TUNING.CLEARANCE_SIT_M;
    case 'prone':
    case 'sleep':
      return STANCE_TUNING.CLEARANCE_PRONE_M;
    case 'stand':
    default:
      return STANCE_TUNING.CLEARANCE_STAND_M;
  }
}

export function getOverheadCeilingClearance(
  x: number,
  z: number,
  shelters: PlacedShelter[] = [],
  rayClearanceM: number = Infinity
): { hasCeiling: boolean; clearanceM: number; reason: string } {
  let clearanceM = Number.isFinite(rayClearanceM) ? Math.max(0.45, rayClearanceM) : Infinity;
  let reason = clearanceM < STANCE_TUNING.CLEARANCE_STAND_M ? 'Overhead structure' : '';

  for (const zone of WORLD_LOW_CEILING_ZONES) {
    if (Math.hypot(x - zone.x, z - zone.z) <= zone.radius && zone.ceilingHeightM < clearanceM) {
      clearanceM = zone.ceilingHeightM;
      reason = zone.label;
    }
  }

  for (const shelter of shelters) {
    if (Math.hypot(x - shelter.x, z - shelter.z) <= 1.48 && 1.28 < clearanceM) {
      clearanceM = 1.28;
      reason = 'Palm lean-to shelter roof';
    }
  }

  return {
    hasCeiling: clearanceM < STANCE_TUNING.CLEARANCE_STAND_M,
    clearanceM,
    reason,
  };
}

export function canEnterStance(
  targetStance: PlayerStance,
  x: number,
  z: number,
  shelters: PlacedShelter[] = [],
  rayClearanceM: number = Infinity
): { allowed: boolean; reason?: string; maxClearanceM: number } {
  const needed = requiredClearanceForStance(targetStance);
  const { clearanceM, reason } = getOverheadCeilingClearance(x, z, shelters, rayClearanceM);
  if (clearanceM < needed) {
    return {
      allowed: false,
      reason: `Not enough headroom (${reason || 'low overhead'})`,
      maxClearanceM: clearanceM,
    };
  }
  return { allowed: true, maxClearanceM: clearanceM };
}

/**
 * Semi-diurnal coastal tide height offset (metres) & instantaneous water elevation.
 * Rises and falls smoothly over ~12.4 game hours so low tide exposes wider beach flats.
 */
export function getOceanTideOffset(totalHours: number): number {
  const phase = (totalHours / PART5_IMMERSION_TUNING.TIDE_CYCLE_HOURS) * Math.PI * 2;
  return Math.sin(phase) * PART5_IMMERSION_TUNING.TIDE_AMPLITUDE_M;
}

export function getEffectiveWaterLevel(totalHours: number): number {
  return WORLD.WATER_LEVEL + getOceanTideOffset(totalHours);
}
