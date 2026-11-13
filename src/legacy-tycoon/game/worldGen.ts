/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameEntity, ToolType } from './types';

export const WORLD_SIZE = 2600;
export const WORLD_CENTER = WORLD_SIZE / 2; // 1300
export const ISLAND_RADIUS = 920;

// Simple deterministic pseudo-random & 2D perlin-like noise
export function hash2d(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
  return n - Math.floor(n);
}

export function smoothNoise(x: number, y: number): number {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;

  // Smoothstep
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  const n00 = hash2d(i, j);
  const n10 = hash2d(i + 1, j);
  const n01 = hash2d(i, j + 1);
  const n11 = hash2d(i + 1, j + 1);

  const ix0 = n00 * (1 - sx) + n10 * sx;
  const ix1 = n01 * (1 - sx) + n11 * sx;
  return ix0 * (1 - sy) + ix1 * sy;
}

export function fbm(x: number, y: number, octaves = 3): number {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += smoothNoise(x * freq, y * freq) * amp;
    freq *= 2;
    amp *= 0.5;
  }
  return val;
}

// Biome evaluation
export type BiomeType = 'deep_ocean' | 'ocean_shallows' | 'beach' | 'jungle' | 'volcanic_peak' | 'river';

export function getTerrainInfo(x: number, y: number): {
  elevation: number;
  biome: BiomeType;
  isWater: boolean;
  isFreshWater: boolean;
  distanceFromCenter: number;
} {
  const dx = x - WORLD_CENTER;
  const dy = y - WORLD_CENTER;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Island boundary noise
  const angle = Math.atan2(dy, dx);
  const radiusPerturbation =
    Math.sin(angle * 5) * 60 +
    Math.cos(angle * 9) * 35 +
    (fbm(x * 0.003, y * 0.003) - 0.5) * 110;
  const effectiveCoastRadius = ISLAND_RADIUS + radiusPerturbation;

  // Freshwater stream check: curves from (1200, 1150) to (1800, 1500)
  const streamT = Math.max(0, Math.min(1, (x - 1100) / 700));
  const streamExpectedY = 1100 + Math.sin(streamT * Math.PI) * 220 + streamT * 350;
  const distToStream = Math.abs(y - streamExpectedY);
  const isStream = x >= 1100 && x <= 1850 && distToStream < 32 && dist < effectiveCoastRadius - 40;

  if (isStream) {
    return {
      elevation: 0.25,
      biome: 'river',
      isWater: true,
      isFreshWater: true,
      distanceFromCenter: dist,
    };
  }

  if (dist > effectiveCoastRadius) {
    // Ocean
    const shallows = dist <= effectiveCoastRadius + 75;
    return {
      elevation: -0.2,
      biome: shallows ? 'ocean_shallows' : 'deep_ocean',
      isWater: true,
      isFreshWater: false,
      distanceFromCenter: dist,
    };
  }

  // Island land biomes
  const normalizedDist = dist / effectiveCoastRadius; // 0 (center) to 1 (coast)

  if (normalizedDist > 0.82) {
    return {
      elevation: 0.15,
      biome: 'beach',
      isWater: false,
      isFreshWater: false,
      distanceFromCenter: dist,
    };
  } else if (normalizedDist > 0.38) {
    return {
      elevation: 0.45,
      biome: 'jungle',
      isWater: false,
      isFreshWater: false,
      distanceFromCenter: dist,
    };
  } else {
    return {
      elevation: 0.85,
      biome: 'volcanic_peak',
      isWater: false,
      isFreshWater: false,
      distanceFromCenter: dist,
    };
  }
}

// Generate all initial world entities
export function generateWorldEntities(): GameEntity[] {
  const entities: GameEntity[] = [];
  let idCount = 1;

  // 1. Key Landmarks & Fixed Escape Sites
  // A. South-East Sandy Shore Raft Launch Dock
  entities.push({
    id: `escape_raft_${idCount++}`,
    type: 'raft_dock',
    x: WORLD_CENTER + 480,
    y: WORLD_CENTER + 520,
    radius: 38,
    health: 100,
    maxHealth: 100,
    interactive: true,
  });

  // B. North-West Volcanic Peak Lookout & Signal Bonfire site
  entities.push({
    id: `escape_bonfire_${idCount++}`,
    type: 'signal_bonfire',
    x: WORLD_CENTER - 340,
    y: WORLD_CENTER - 320,
    radius: 36,
    health: 100,
    maxHealth: 100,
    interactive: true,
  });

  // C. North-East Cliff Radio Tower Mast
  entities.push({
    id: `escape_radio_${idCount++}`,
    type: 'radio_tower',
    x: WORLD_CENTER + 360,
    y: WORLD_CENTER - 380,
    radius: 34,
    health: 100,
    maxHealth: 100,
    interactive: true,
  });

  // D. Freshwater Spring Sanctuary
  entities.push({
    id: `spring_sanctuary_${idCount++}`,
    type: 'freshwater_spring',
    x: 1120,
    y: 1100,
    radius: 40,
    health: 100,
    maxHealth: 100,
    interactive: true,
  });

  // E. Shipwreck Craters & Cargo Crates near North-East Reef
  const wreckPositions = [
    { x: WORLD_CENTER + 580, y: WORLD_CENTER - 450, loot: 'battery' },
    { x: WORLD_CENTER + 620, y: WORLD_CENTER - 410, loot: 'copper_wire' },
    { x: WORLD_CENTER + 540, y: WORLD_CENTER - 490, loot: 'antenna' },
    { x: WORLD_CENTER + 650, y: WORLD_CENTER - 480, loot: 'flare_gun' },
  ];

  wreckPositions.forEach((wp) => {
    entities.push({
      id: `wreck_crate_${idCount++}`,
      type: 'shipwreck_crate',
      x: wp.x,
      y: wp.y,
      radius: 24,
      health: 3,
      maxHealth: 3,
      interactive: true,
      state: { loot: wp.loot, opened: false },
    });
  });

  // 2. Starter Landing Beach Cache right at player spawn (1300, 1450)
  const spawnCache = [
    { type: 'flint_node' as const, dx: -35, dy: -25 },
    { type: 'flint_node' as const, dx: 40, dy: -30 },
    { type: 'driftwood_node' as const, dx: -45, dy: 35 },
    { type: 'driftwood_node' as const, dx: 30, dy: 40 },
    { type: 'driftwood_node' as const, dx: -70, dy: 10 },
    { type: 'palm_frond_node' as const, dx: 55, dy: 15 },
    { type: 'palm_frond_node' as const, dx: -20, dy: -60 },
    { type: 'vine_node' as const, dx: 25, dy: -55 },
    { type: 'vine_node' as const, dx: 70, dy: -10 },
    { type: 'coconut_pickup' as const, dx: -60, dy: -40 },
    { type: 'coconut_pickup' as const, dx: 50, dy: 60 },
    { type: 'loose_stone_node' as const, dx: -15, dy: 65 },
    { type: 'loose_stone_node' as const, dx: 65, dy: -45 },
  ];

  spawnCache.forEach((sc) => {
    entities.push({
      id: `starter_${sc.type}_${idCount++}`,
      type: sc.type,
      x: 1300 + sc.dx,
      y: 1450 + sc.dy,
      radius: 16,
      health: 1,
      maxHealth: 1,
      interactive: true,
    });
  });

  // 3. Procedural Biome Scatter
  const rng = (seed: number) => {
    let s = seed;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  };
  const rand = rng(12345);

  const numSamples = 280;
  for (let i = 0; i < numSamples; i++) {
    const rx = 200 + rand() * (WORLD_SIZE - 400);
    const ry = 200 + rand() * (WORLD_SIZE - 400);
    const terrain = getTerrainInfo(rx, ry);

    if (terrain.isWater && !terrain.isFreshWater) continue;

    // Check distance to other entities
    const tooClose = entities.some((e) => {
      const dx = e.x - rx;
      const dy = e.y - ry;
      return Math.sqrt(dx * dx + dy * dy) < 40;
    });
    if (tooClose) continue;

    if (terrain.biome === 'beach') {
      const roll = rand();
      if (roll < 0.28) {
        // Driftwood
        entities.push({
          id: `driftwood_${idCount++}`,
          type: 'driftwood_node',
          x: rx,
          y: ry,
          radius: 18,
          health: 1,
          maxHealth: 1,
          interactive: true,
        });
      } else if (roll < 0.48) {
        // Flint stone
        entities.push({
          id: `flint_${idCount++}`,
          type: 'flint_node',
          x: rx,
          y: ry,
          radius: 14,
          health: 1,
          maxHealth: 1,
          interactive: true,
        });
      } else if (roll < 0.65) {
        // Fallen Palm Fronds
        entities.push({
          id: `frond_${idCount++}`,
          type: 'palm_frond_node',
          x: rx,
          y: ry,
          radius: 15,
          health: 1,
          maxHealth: 1,
          interactive: true,
        });
      } else if (roll < 0.78) {
        // Coconut pickup
        entities.push({
          id: `coconut_${idCount++}`,
          type: 'coconut_pickup',
          x: rx,
          y: ry,
          radius: 14,
          health: 1,
          maxHealth: 1,
          interactive: true,
        });
      } else if (roll < 0.88) {
        // Loose Stone
        entities.push({
          id: `stone_${idCount++}`,
          type: 'loose_stone_node',
          x: rx,
          y: ry,
          radius: 14,
          health: 1,
          maxHealth: 1,
          interactive: true,
        });
      } else {
        // Shore Crab
        entities.push({
          id: `crab_${idCount++}`,
          type: 'crab',
          x: rx,
          y: ry,
          radius: 15,
          health: 15,
          maxHealth: 15,
          interactive: true,
          state: {
            vx: 0,
            vy: 0,
            wanderTimer: rand() * 4,
            fleeTimer: 0,
            angle: rand() * Math.PI * 2,
          },
        });
      }
    } else if (terrain.biome === 'jungle') {
      const roll = rand();
      if (roll < 0.45) {
        // Palm Tree (Can shake for fronds/coconuts, or chop with axe for logs)
        entities.push({
          id: `palm_${idCount++}`,
          type: 'palm_tree',
          x: rx,
          y: ry,
          radius: 28,
          health: 4,
          maxHealth: 4,
          interactive: true,
          state: { hasVines: rand() > 0.45, hasCoconuts: rand() > 0.4 },
        });
      } else if (roll < 0.62) {
        // Jungle Vine Cluster
        entities.push({
          id: `vine_${idCount++}`,
          type: 'vine_node',
          x: rx,
          y: ry,
          radius: 16,
          health: 1,
          maxHealth: 1,
          interactive: true,
        });
      } else if (roll < 0.75) {
        // Fallen Fronds in jungle
        entities.push({
          id: `frond_${idCount++}`,
          type: 'palm_frond_node',
          x: rx,
          y: ry,
          radius: 15,
          health: 1,
          maxHealth: 1,
          interactive: true,
        });
      } else if (roll < 0.86) {
        // Jungle Wild Boar
        entities.push({
          id: `boar_${idCount++}`,
          type: 'boar',
          x: rx,
          y: ry,
          radius: 22,
          health: 45,
          maxHealth: 45,
          interactive: true,
          state: {
            vx: 0,
            vy: 0,
            wanderTimer: rand() * 5,
            chargeTimer: 0,
            isCharging: false,
            angle: rand() * Math.PI * 2,
          },
        });
      } else if (roll < 0.94) {
        // Jungle Viper Snake
        entities.push({
          id: `snake_${idCount++}`,
          type: 'snake',
          x: rx,
          y: ry,
          radius: 16,
          health: 20,
          maxHealth: 20,
          interactive: true,
          state: {
            rattleWarning: false,
            strikeTimer: 0,
            coiled: true,
            angle: rand() * Math.PI * 2,
          },
        });
      } else {
        // Coconut fallen under tree
        entities.push({
          id: `coconut_${idCount++}`,
          type: 'coconut_pickup',
          x: rx,
          y: ry,
          radius: 14,
          health: 1,
          maxHealth: 1,
          interactive: true,
        });
      }
    } else if (terrain.biome === 'volcanic_peak') {
      const roll = rand();
      if (roll < 0.45) {
        // Boulder (Heavy stone)
        entities.push({
          id: `boulder_${idCount++}`,
          type: 'boulder_node',
          x: rx,
          y: ry,
          radius: 26,
          health: 5,
          maxHealth: 5,
          interactive: true,
        });
      } else if (roll < 0.75) {
        // Loose Basalt Stones (Pick up directly by hand!)
        entities.push({
          id: `stone_${idCount++}`,
          type: 'loose_stone_node',
          x: rx,
          y: ry,
          radius: 14,
          health: 1,
          maxHealth: 1,
          interactive: true,
        });
      } else {
        // Flint node
        entities.push({
          id: `flint_${idCount++}`,
          type: 'flint_node',
          x: rx,
          y: ry,
          radius: 15,
          health: 1,
          maxHealth: 1,
          interactive: true,
        });
      }
    }
  }

  return entities;
}
