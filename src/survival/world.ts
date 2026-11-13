// Pure world geography, sculpted spread-out terrain heightmap, Act 1/2/3 barrier gating,
// zone classification, gate unlocking, and Fog-of-War map helpers. No Three.js or React imports.

import { SAVE, WORLD } from './config.ts';
import { countItem, removeItem } from './items.ts';
import type { BarrierGateDef, MapZoneId, SurvivalState } from './types.ts';

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

/**
 * Deterministic spread-out 3D heightmap shared between pure gameplay physics,
 * node/wildlife placement, Fog-of-War, and Three.js terrain geometry.
 */
export function sampleIslandHeight(
  x: number,
  z: number,
  islandRadius: number = WORLD.ISLAND_RADIUS
): number {
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

    // 3. Freshwater Spring mossy hollow (-34, 82)
    const springDist = Math.hypot(x - WORLD.SPRING_POS.x, z - WORLD.SPRING_POS.z);
    if (springDist < 12) {
      const w = 1 - smoothstep(2.0, 12, springDist);
      const basin = springDist < 3.0 ? 2.55 : 3.25;
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

export interface MovementResolution {
  x: number;
  z: number;
  blockedByGate: BarrierGateDef | null;
  blockedByCliff: boolean;
}

/**
 * Enforces island boundaries, steep basalt walls, and locked Act 1/2/3 gates.
 */
export function resolveWorldMovement(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  unlockedGates: string[],
  waterLevel: number = WORLD.WATER_LEVEL
): MovementResolution {
  let nx = toX;
  let nz = toZ;
  let blockedByGate: BarrierGateDef | null = null;
  let blockedByCliff = false;

  // 1. Keep player within outer coastal swim boundary
  const maxSwimDist = WORLD.ISLAND_RADIUS * 0.86;
  const dist = Math.hypot(nx, nz);
  if (dist > maxSwimDist) {
    const scale = maxSwimDist / dist;
    nx *= scale;
    nz *= scale;
  }

  // 2. Prevent swimming into deep abyss
  const targetH = sampleIslandHeight(nx, nz);
  const curH = sampleIslandHeight(fromX, fromZ);
  if (targetH < waterLevel - 1.7) {
    nx = fromX;
    nz = fromZ;
  }

  // 3. Enforce all locked Barrier Gates
  const playerPad = 0.8;
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

  // 4. Hard progression seal across Basalt Spine Ridge if no Act-2 gate is unlocked
  const act2Gates = ISLAND_GATES.filter((g) => g.unlockAct === 2);
  const inUnlockedAct2Pass = act2Gates.some(
    (g) => unlockedGates.includes(g.id) && Math.abs(nx - g.x) <= g.halfWidth
  );
  const ridgeFrontZ = WORLD.ACT1_RIDGE_Z + 1.8;
  if (fromZ >= ridgeFrontZ - 0.6 && nz < ridgeFrontZ && !inUnlockedAct2Pass) {
    if (!blockedByGate) {
      const nearGate = act2Gates.find(
        (g) => !unlockedGates.includes(g.id) && Math.abs(nx - g.x) <= g.halfWidth + 3.5
      );
      if (nearGate) blockedByGate = nearGate;
      else blockedByCliff = true;
    }
    nz = Math.max(nz, ridgeFrontZ);
  }

  // 5. Hard seal at Station 3 Perimeter Fence unless gate_research_station unlocked
  const stationGate = ISLAND_GATES.find((g) => g.id === 'gate_research_station');
  const stationFrontZ = WORLD.STATION_GATE_Z + 1.8;
  if (
    stationGate &&
    !unlockedGates.includes(stationGate.id) &&
    fromZ >= stationFrontZ - 0.6 &&
    nz < stationFrontZ &&
    Math.abs(nx - stationGate.x) <= 22
  ) {
    if (!blockedByGate) blockedByGate = stationGate;
    nz = Math.max(nz, stationFrontZ);
  }

  // 6. Steep cliff guard everywhere else on the island (cannot climb vertical walls)
  const stepDist = Math.hypot(nx - fromX, nz - fromZ);
  const resolvedH = sampleIslandHeight(nx, nz);
  const dh = resolvedH - curH;
  if (stepDist > 0.001 && dh > 1.0 && dh / Math.max(0.15, stepDist) > 1.45) {
    blockedByCliff = true;
    nx = fromX;
    nz = fromZ;
  }

  return { x: nx, z: nz, blockedByGate, blockedByCliff };
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
