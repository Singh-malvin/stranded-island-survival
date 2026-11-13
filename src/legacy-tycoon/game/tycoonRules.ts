/**
 * Pure business logic and calculation rules for Isle of Palms Tycoon
 */

import {
  BuildingDefinition,
  DifficultyMode,
  PlacedBuilding,
  ResourceCost,
  ResourceStockpile,
  StaffRoster,
  GuestRecord,
  TycoonGameState,
  IslandExpansionTier,
} from './tycoonTypes.ts';

export const BUILDING_CATALOG: Record<string, BuildingDefinition> = {
  // --- PATHS & WALKWAYS ---
  garden_trail: {
    id: 'garden_trail',
    name: 'Stepping-Stone Garden Trail',
    category: 'paths',
    description: 'Hand-laid slate stepping stones bordered by island ferns — craftable directly from island stone and thatch.',
    cost: { cash: 0, timber: 2, stone: 4, thatch: 2 },
    capacity: 0,
    dailyRevenue: 0,
    maintenanceCost: 0,
    prestigePoints: 20,
    footprintRadius: 1.8,
    unlockStarRating: 0.5,
    allowedTerrain: 'land',
  },
  stone_pathway: {
    id: 'stone_pathway',
    name: 'Sandstone Resort Walkway',
    category: 'paths',
    description: 'Cut sandstone pavers with solar bollard lights and manicured stone edging to connect resort zones.',
    cost: { cash: 25, timber: 0, stone: 12, thatch: 0 },
    capacity: 0,
    dailyRevenue: 0,
    maintenanceCost: 1,
    prestigePoints: 25,
    footprintRadius: 1.8,
    unlockStarRating: 0.5,
    allowedTerrain: 'any',
  },
  timber_boardwalk: {
    id: 'timber_boardwalk',
    name: 'Elevated Teak Boardwalk',
    category: 'paths',
    description: 'Coastal hardwood boardwalk on pilings with nautical rope posts — ideal across beach sand or shallow water.',
    cost: { cash: 45, timber: 16, stone: 4, thatch: 0 },
    capacity: 0,
    dailyRevenue: 0,
    maintenanceCost: 2,
    prestigePoints: 35,
    footprintRadius: 2.0,
    unlockStarRating: 0.5,
    allowedTerrain: 'any',
  },
  marble_promenade: {
    id: 'marble_promenade',
    name: 'Grand Marble & Palm Promenade',
    category: 'paths',
    description: 'Palatial inlaid white marble avenue flanked by golden lanterns and ornamental potted palms.',
    cost: { cash: 140, timber: 6, stone: 24, thatch: 4, decor: 4 },
    capacity: 0,
    dailyRevenue: 12,
    maintenanceCost: 5,
    prestigePoints: 75,
    footprintRadius: 2.2,
    unlockStarRating: 1.5,
    allowedTerrain: 'any',
  },

  // --- STARTER TIER (Hand-crafted firepits, ponds, hammocks, coconut shacks) ---
  beach_firepit: {
    id: 'beach_firepit',
    name: 'Sunset Beach Bonfire & Log Seats',
    category: 'starter',
    description: 'Crackling rustic firepit encircled by driftwood log seats — craftable with $0 cash from island materials.',
    cost: { cash: 0, timber: 24, stone: 18, thatch: 8 },
    capacity: 0,
    dailyRevenue: 18,
    maintenanceCost: 3,
    prestigePoints: 45,
    footprintRadius: 2.8,
    unlockStarRating: 0.5,
    allowedTerrain: 'any',
  },
  koi_pond: {
    id: 'koi_pond',
    name: 'Zen Koi Garden Pond',
    category: 'starter',
    description: 'Natural rock-rimmed freshwater pond with blooming water lilies and swimming golden koi fish.',
    cost: { cash: 80, timber: 12, stone: 24, thatch: 6 },
    capacity: 0,
    dailyRevenue: 22,
    maintenanceCost: 5,
    prestigePoints: 60,
    footprintRadius: 3,
    unlockStarRating: 0.5,
    allowedTerrain: 'land',
  },
  coconut_stand: {
    id: 'coconut_stand',
    name: 'Fresh Coconut & Juice Shack',
    category: 'starter',
    description: 'Cheerful beachfront timber kiosk with coconut pyramids, chilled dispensers, and blender counter.',
    cost: { cash: 90, timber: 26, stone: 12, thatch: 20 },
    capacity: 0,
    dailyRevenue: 48,
    maintenanceCost: 10,
    prestigePoints: 85,
    footprintRadius: 3.2,
    unlockStarRating: 0.5,
    allowedTerrain: 'any',
    preferredStaffRole: 'bartenders',
  },
  garden_hammock: {
    id: 'garden_hammock',
    name: 'Double Palm Woven Hammock',
    category: 'starter',
    description: 'Pair of tropical palms with a hand-woven artisan hammock swaying gently in the sea breeze.',
    cost: { cash: 60, timber: 16, stone: 6, thatch: 18 },
    capacity: 0,
    dailyRevenue: 20,
    maintenanceCost: 3,
    prestigePoints: 50,
    footprintRadius: 2.5,
    unlockStarRating: 0.5,
    allowedTerrain: 'any',
  },

  // --- INFRASTRUCTURE ---
  ferry_dock: {
    id: 'ferry_dock',
    name: "Founder's Ferry Pier",
    category: 'infrastructure',
    description: 'Hand-built wooden arrival pier ($0 cash) with mooring bollards and ferry boat so paying tourists can land.',
    cost: { cash: 0, timber: 30, stone: 14, thatch: 8 },
    capacity: 0,
    dailyRevenue: 12,
    maintenanceCost: 0,
    prestigePoints: 100,
    footprintRadius: 6,
    unlockStarRating: 0.5,
    allowedTerrain: 'water',
    preferredStaffRole: 'concierges',
  },

  // --- ACCOMMODATIONS ---
  beach_cabana: {
    id: 'beach_cabana',
    name: 'Beachfront Bamboo Cabana',
    category: 'accommodation',
    description: 'Hand-crafted walk-in coastal suite ($0 cash) with full teak bedroom, king bed, nightstands & lamps. Sleeps 2.',
    cost: { cash: 0, timber: 40, stone: 18, thatch: 26 },
    capacity: 2,
    dailyRevenue: 60,
    maintenanceCost: 10,
    prestigePoints: 150,
    footprintRadius: 4.5,
    unlockStarRating: 0.5,
    allowedTerrain: 'beach',
    preferredStaffRole: 'cleaners',
  },
  overwater_bungalow: {
    id: 'overwater_bungalow',
    name: 'Luxury Overwater Bungalow',
    category: 'accommodation',
    description: 'Lagoon stilt villa with sun deck, glass ocean floor, four-poster canopy bed, vanity, and lounge seating. Sleeps 4.',
    cost: { cash: 1200, timber: 90, stone: 45, thatch: 50, decor: 12 },
    capacity: 4,
    dailyRevenue: 210,
    maintenanceCost: 48,
    prestigePoints: 400,
    footprintRadius: 6,
    unlockStarRating: 1.5,
    allowedTerrain: 'water',
    preferredStaffRole: 'cleaners',
  },
  grand_hotel_wing: {
    id: 'grand_hotel_wing',
    name: 'Grand Atoll Hotel - Royal Wing',
    category: 'accommodation',
    description: 'Three-story grand hotel with walk-in marble lobby, concierge desk, interior stair, chandelier, and 16-bed furnished suites.',
    cost: { cash: 9500, timber: 280, stone: 340, thatch: 100, decor: 120 },
    capacity: 16,
    dailyRevenue: 1080,
    maintenanceCost: 260,
    prestigePoints: 1850,
    footprintRadius: 10,
    unlockStarRating: 3.5,
    allowedTerrain: 'land',
    preferredStaffRole: 'concierges',
  },
  presidential_penthouse: {
    id: 'presidential_penthouse',
    name: 'Presidential Atoll Penthouse Tower',
    category: 'accommodation',
    description: 'Towering 5-story sky suite you can walk all the way up! Includes marble lobby, glass elevator, stairs, master bedroom, kitchen, and rooftop sky pool. Sleeps 8 VIPs.',
    cost: { cash: 18500, timber: 360, stone: 500, thatch: 130, decor: 240 },
    capacity: 8,
    dailyRevenue: 1750,
    maintenanceCost: 420,
    prestigePoints: 3200,
    footprintRadius: 9,
    unlockStarRating: 4.5,
    allowedTerrain: 'land',
    preferredStaffRole: 'concierges',
  },

  // --- DINING & BARS ---
  tiki_bar: {
    id: 'tiki_bar',
    name: 'Tiki Beach Bar & Coconut Grill',
    category: 'dining',
    description: 'Walk-in bamboo bar stocked with liquor bottles, barstools, cocktail shakers, and sizzling flat-top grill.',
    cost: { cash: 480, timber: 45, stone: 22, thatch: 32 },
    capacity: 0,
    dailyRevenue: 105,
    maintenanceCost: 26,
    prestigePoints: 220,
    footprintRadius: 5,
    unlockStarRating: 0.5,
    allowedTerrain: 'any',
    preferredStaffRole: 'bartenders',
  },
  sunset_lounge: {
    id: 'sunset_lounge',
    name: 'Sunset Restaurant & Chef Kitchen',
    category: 'dining',
    description: 'Open-air gourmet restaurant with commercial 4-burner stove, steaming pots, range hood, candlelit tables, and wine racks.',
    cost: { cash: 2600, timber: 120, stone: 100, thatch: 45, decor: 36 },
    capacity: 0,
    dailyRevenue: 340,
    maintenanceCost: 85,
    prestigePoints: 740,
    footprintRadius: 7,
    unlockStarRating: 2.0,
    allowedTerrain: 'land',
    preferredStaffRole: 'chefs',
  },

  // --- POOLS & LEISURE ---
  snorkeling_pier: {
    id: 'snorkeling_pier',
    name: 'Coral Reef Snorkeling & Dive Pier',
    category: 'leisure',
    description: 'Water pavilion equipped with gear racks, dive ladder, and reef viewing platform.',
    cost: { cash: 650, timber: 50, stone: 28, thatch: 22 },
    capacity: 0,
    dailyRevenue: 115,
    maintenanceCost: 28,
    prestigePoints: 290,
    footprintRadius: 5.5,
    unlockStarRating: 1.0,
    allowedTerrain: 'water',
  },
  tennis_court: {
    id: 'tennis_court',
    name: 'Seaside Pickleball & Tennis Court',
    category: 'leisure',
    description: 'Championship-grade acrylic blue court with regulation net, lines, and shaded player bench.',
    cost: { cash: 980, timber: 44, stone: 80, thatch: 12, decor: 16 },
    capacity: 0,
    dailyRevenue: 150,
    maintenanceCost: 38,
    prestigePoints: 370,
    footprintRadius: 7,
    unlockStarRating: 1.5,
    allowedTerrain: 'land',
  },
  infinity_pool: {
    id: 'infinity_pool',
    name: 'Seaside Infinity Pool & Deck',
    category: 'leisure',
    description: 'Tiered infinity-edge freshwater pool with poolside loungers, umbrellas, and underwater steps.',
    cost: { cash: 1950, timber: 60, stone: 135, thatch: 14, decor: 24 },
    capacity: 0,
    dailyRevenue: 265,
    maintenanceCost: 65,
    prestigePoints: 580,
    footprintRadius: 7.5,
    unlockStarRating: 2.0,
    allowedTerrain: 'land',
    preferredStaffRole: 'cleaners',
  },
  wellness_spa: {
    id: 'wellness_spa',
    name: 'Lotus Botanical Wellness Spa',
    category: 'leisure',
    description: 'Tranquil sanctuary with twin massage beds, rolled towels, steaming lotus soaking tub, and aromatherapy candles.',
    cost: { cash: 4200, timber: 140, stone: 160, thatch: 60, decor: 55 },
    capacity: 0,
    dailyRevenue: 490,
    maintenanceCost: 125,
    prestigePoints: 980,
    footprintRadius: 8,
    unlockStarRating: 3.0,
    allowedTerrain: 'land',
    preferredStaffRole: 'cleaners',
  },

  // --- MASSIVE ATTRACTIONS (Water parks, superyachts, casino) ---
  water_park: {
    id: 'water_park',
    name: 'Mega Tropical Water Park & Aquaslides',
    category: 'massive',
    description: 'Colossal multi-tower water park with twin twisting aquaslides, splashdown lagoon, and tipping bucket!',
    cost: { cash: 6400, timber: 200, stone: 250, thatch: 60, decor: 75 },
    capacity: 0,
    dailyRevenue: 720,
    maintenanceCost: 190,
    prestigePoints: 1650,
    footprintRadius: 11,
    unlockStarRating: 3.0,
    allowedTerrain: 'land',
    preferredStaffRole: 'cleaners',
  },
  superyacht_marina: {
    id: 'superyacht_marina',
    name: 'Royal Marina & Superyacht Basin',
    category: 'massive',
    description: 'Deepwater floating pontoons with docked 45ft luxury motor yacht, upper sunbridge, and fueling station.',
    cost: { cash: 8400, timber: 235, stone: 280, thatch: 35, decor: 95 },
    capacity: 0,
    dailyRevenue: 880,
    maintenanceCost: 230,
    prestigePoints: 1900,
    footprintRadius: 10.5,
    unlockStarRating: 3.5,
    allowedTerrain: 'water',
    preferredStaffRole: 'concierges',
  },
  casino_nightclub: {
    id: 'casino_nightclub',
    name: 'Starlight Casino & Sky Lounge',
    category: 'massive',
    description: 'Dazzling glass casino palace with emerald roulette & blackjack tables, neon stage, bar, and VIP velvet booths.',
    cost: { cash: 13500, timber: 300, stone: 400, thatch: 85, decor: 180 },
    capacity: 0,
    dailyRevenue: 1350,
    maintenanceCost: 350,
    prestigePoints: 2650,
    footprintRadius: 10,
    unlockStarRating: 4.0,
    allowedTerrain: 'land',
    preferredStaffRole: 'bartenders',
  },

  // --- DECOR ---
  tiki_torch: {
    id: 'tiki_torch',
    name: 'Illuminated Tiki Torch Pair',
    category: 'decor',
    description: 'Hand-crafted bamboo torches ($0 cash) with glowing flames to light island paths at night.',
    cost: { cash: 0, timber: 12, stone: 6, thatch: 8 },
    capacity: 0,
    dailyRevenue: 0,
    maintenanceCost: 1,
    prestigePoints: 30,
    footprintRadius: 2,
    unlockStarRating: 0.5,
    allowedTerrain: 'any',
  },
  sun_lounger_deck: {
    id: 'sun_lounger_deck',
    name: 'Teak Sun Loungers & Parasol',
    category: 'decor',
    description: 'Pair of teak wood reclining loungers with wide canvas umbrella and chilled drink table.',
    cost: { cash: 95, timber: 24, stone: 6, thatch: 12 },
    capacity: 0,
    dailyRevenue: 25,
    maintenanceCost: 4,
    prestigePoints: 65,
    footprintRadius: 2.5,
    unlockStarRating: 0.5,
    allowedTerrain: 'any',
  },
};

export const ISLAND_EXPANSIONS: IslandExpansionTier[] = [
  {
    tier: 1,
    name: 'Natural Coral Atoll',
    description: 'The untouched starter paradise ringed by natural white sands.',
    radius: 75,
    cost: { cash: 0, timber: 0, stone: 0, thatch: 0 },
    unlockedPrestige: 0,
  },
  {
    tier: 2,
    name: 'Coastal Dredge & Beach Reclamation',
    description: 'Extends shoreline by +25 meters, creates broad building flats, and adds fresh driftwood and quarry nodes.',
    radius: 100,
    cost: { cash: 1400, timber: 70, stone: 70, thatch: 25 },
    unlockedPrestige: 350,
  },
  {
    tier: 3,
    name: 'Outer Lagoon Coral Ring Extension',
    description: 'Dredges outer coral barrier reef, expanding the island to 130m radius for massive water parks and marinas.',
    radius: 130,
    cost: { cash: 4200, timber: 140, stone: 160, thatch: 45, decor: 30 },
    unlockedPrestige: 1400,
  },
  {
    tier: 4,
    name: 'Grand Sovereign Archipelago Continent',
    description: 'Transforms the island into a sprawling 170m radius luxury kingdom with infinite room for multi-wing mega-resorts.',
    radius: 170,
    cost: { cash: 9500, timber: 260, stone: 310, thatch: 85, decor: 100 },
    unlockedPrestige: 3800,
  },
];

export const STAFF_SALARIES: Record<keyof StaffRoster, number> = {
  cleaners: 20,
  bartenders: 35,
  chefs: 55,
  concierges: 75,
};

export function getDifficultyMultipliers(difficulty: DifficultyMode = 'standard') {
  if (difficulty === 'hardcore') {
    return {
      revenueMult: 0.8,
      upkeepMult: 1.25,
      dirtScale: 1.35,
    };
  }
  return {
    revenueMult: 1.0,
    upkeepMult: 1.0,
    dirtScale: 1.0,
  };
}

export function canAfford(stockpile: ResourceStockpile, cost: ResourceCost): boolean {
  if (stockpile.cash < cost.cash) return false;
  if (stockpile.timber < cost.timber) return false;
  if (stockpile.stone < cost.stone) return false;
  if (stockpile.thatch < cost.thatch) return false;
  if ((cost.decor ?? 0) > stockpile.decor) return false;
  return true;
}

export function deductCost(stockpile: ResourceStockpile, cost: ResourceCost): ResourceStockpile {
  return {
    cash: Math.max(0, stockpile.cash - cost.cash),
    timber: Math.max(0, stockpile.timber - cost.timber),
    stone: Math.max(0, stockpile.stone - cost.stone),
    thatch: Math.max(0, stockpile.thatch - cost.thatch),
    decor: Math.max(0, stockpile.decor - (cost.decor ?? 0)),
  };
}

export function multiplyCost(cost: ResourceCost, count: number): ResourceCost {
  const n = Math.max(0, Math.floor(count));
  return {
    cash: cost.cash * n,
    timber: cost.timber * n,
    stone: cost.stone * n,
    thatch: cost.thatch * n,
    decor: (cost.decor ?? 0) * n,
  };
}

export function maxAffordableCount(stockpile: ResourceStockpile, cost: ResourceCost, cap: number = 25): number {
  let limit = cap;
  if (cost.cash > 0) limit = Math.min(limit, Math.floor(Math.max(0, stockpile.cash) / cost.cash));
  if (cost.timber > 0) limit = Math.min(limit, Math.floor(stockpile.timber / cost.timber));
  if (cost.stone > 0) limit = Math.min(limit, Math.floor(stockpile.stone / cost.stone));
  if (cost.thatch > 0) limit = Math.min(limit, Math.floor(stockpile.thatch / cost.thatch));
  if ((cost.decor ?? 0) > 0) limit = Math.min(limit, Math.floor(stockpile.decor / (cost.decor ?? 1)));
  return Math.max(0, limit);
}

export interface PathObstacle {
  x: number;
  z: number;
  radius: number;
}

export interface PlannedPathSegment {
  x: number;
  z: number;
  rotation: number;
}

function pointToSegmentDistSq(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number
): { distSq: number; projX: number; projZ: number; t: number } {
  const vx = bx - ax;
  const vz = bz - az;
  const lenSq = vx * vx + vz * vz;
  if (lenSq < 1e-6) {
    return { distSq: (px - ax) ** 2 + (pz - az) ** 2, projX: ax, projZ: az, t: 0 };
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / lenSq));
  const projX = ax + vx * t;
  const projZ = az + vz * t;
  return {
    distSq: (px - projX) ** 2 + (pz - projZ) ** 2,
    projX,
    projZ,
    t,
  };
}

function sampleCatmullRom(
  pts: Array<{ x: number; z: number }>,
  stepDist: number = 0.4
): Array<{ x: number; z: number }> {
  if (pts.length <= 2) return pts.slice();

  const samples: Array<{ x: number; z: number }> = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    const segDist = Math.hypot(p2.x - p1.x, p2.z - p1.z);
    const subSteps = Math.max(4, Math.ceil(segDist / stepDist));

    for (let s = 0; s < subSteps; s++) {
      const t = s / subSteps;
      const t2 = t * t;
      const t3 = t2 * t;
      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const z =
        0.5 *
        (2 * p1.z +
          (-p0.z + p2.z) * t +
          (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 +
          (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3);
      samples.push({ x, z });
    }
  }
  samples.push(pts[pts.length - 1]);
  return samples;
}

/**
 * Plans connected path segments from a start coordinate to an end coordinate,
 * automatically curving smoothly around trees, boulders, and placed obstacles.
 */
export function planPathSegments(
  start: { x: number; z: number },
  end: { x: number; z: number },
  segmentLength: number = 4.0,
  maxSegments: number = 24,
  fallbackRotation: number = 0,
  obstacles: PathObstacle[] = []
): PlannedPathSegment[] {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const dist = Math.hypot(dx, dz);

  if (dist < 1.0) {
    return [{ x: start.x, z: start.z, rotation: fallbackRotation }];
  }

  // Filter obstacles to nearby corridor, excluding ones overlapping the start/end endpoints themselves
  const midX = (start.x + end.x) * 0.5;
  const midZ = (start.z + end.z) * 0.5;
  const corridorRadius = dist * 0.65 + 14;
  const activeObstacles = obstacles.filter((obs) => {
    if (Math.hypot(obs.x - midX, obs.z - midZ) > corridorRadius) return false;
    if (Math.hypot(obs.x - start.x, obs.z - start.z) < obs.radius + 0.5) return false;
    if (Math.hypot(obs.x - end.x, obs.z - end.z) < obs.radius + 0.5) return false;
    return true;
  });

  const waypoints: Array<{ x: number; z: number }> = [
    { x: start.x, z: start.z },
    { x: end.x, z: end.z },
  ];

  // Iteratively insert detour waypoints around blocking trees / rocks / buildings
  if (activeObstacles.length > 0) {
    const pathHalfWidth = 1.05;
    for (let pass = 0; pass < 5 && waypoints.length < 14; pass++) {
      let insertedAny = false;
      const nextWaypoints: Array<{ x: number; z: number }> = [waypoints[0]];

      for (let i = 0; i < waypoints.length - 1; i++) {
        const a = waypoints[i];
        const b = waypoints[i + 1];
        const segLen = Math.hypot(b.x - a.x, b.z - a.z);

        let blocking: PathObstacle | null = null;
        let earliestT = 2;

        if (segLen > 1.2) {
          for (const obs of activeObstacles) {
            const clearance = obs.radius + pathHalfWidth;
            const info = pointToSegmentDistSq(obs.x, obs.z, a.x, a.z, b.x, b.z);
            if (info.t > 0.04 && info.t < 0.96 && info.distSq < clearance * clearance) {
              if (info.t < earliestT) {
                earliestT = info.t;
                blocking = obs;
              }
            }
          }
        }

        if (blocking) {
          const dirX = (b.x - a.x) / segLen;
          const dirZ = (b.z - a.z) / segLen;
          const perpX = -dirZ;
          const perpZ = dirX;
          const detourDist = blocking.radius + pathHalfWidth + 1.05;

          const cand1 = { x: blocking.x + perpX * detourDist, z: blocking.z + perpZ * detourDist };
          const cand2 = { x: blocking.x - perpX * detourDist, z: blocking.z - perpZ * detourDist };

          const scoreCandidate = (cand: { x: number; z: number }) => {
            let penalty = 0;
            for (const o of activeObstacles) {
              const d = Math.hypot(cand.x - o.x, cand.z - o.z);
              const req = o.radius + pathHalfWidth;
              if (d < req) penalty += (req - d) * 100;
            }
            // Slight preference for side away from obstacle center relative to A->B
            const sideAlign = (cand.x - a.x) * perpX + (cand.z - a.z) * perpZ;
            const obsSide = (blocking!.x - a.x) * perpX + (blocking!.z - a.z) * perpZ;
            const awayBonus = Math.sign(sideAlign) !== Math.sign(obsSide) ? 0 : 12;
            return penalty + awayBonus;
          };

          const chosen = scoreCandidate(cand1) <= scoreCandidate(cand2) ? cand1 : cand2;
          // Avoid degenerate duplicate waypoints
          if (
            Math.hypot(chosen.x - a.x, chosen.z - a.z) > 1.1 &&
            Math.hypot(chosen.x - b.x, chosen.z - b.z) > 1.1
          ) {
            nextWaypoints.push(chosen);
            insertedAny = true;
          }
        }
        nextWaypoints.push(b);
      }

      waypoints.splice(0, waypoints.length, ...nextWaypoints);
      if (!insertedAny) break;
    }
  }

  // Straight path fast-path when no obstacles intervened
  if (waypoints.length === 2) {
    const rotation = Math.atan2(dx, dz);
    const dirX = dx / dist;
    const dirZ = dz / dist;
    const count = Math.min(maxSegments, Math.max(1, Math.ceil((dist - 0.5) / segmentLength)));

    const segments: PlannedPathSegment[] = [];
    for (let i = 0; i < count; i++) {
      const offset = segmentLength * (i + 0.5);
      segments.push({
        x: start.x + dirX * offset,
        z: start.z + dirZ * offset,
        rotation,
      });
    }
    return segments;
  }

  // Smooth Catmull-Rom spline curve & fixed-length arc resampling around trees
  const dense = sampleCatmullRom(waypoints, 0.35);
  const cumLen: number[] = [0];
  for (let i = 1; i < dense.length; i++) {
    cumLen.push(cumLen[i - 1] + Math.hypot(dense[i].x - dense[i - 1].x, dense[i].z - dense[i - 1].z));
  }
  const totalLen = cumLen[cumLen.length - 1];

  const sampleAtArc = (targetDist: number): { x: number; z: number } => {
    if (targetDist <= 0) return dense[0];
    if (targetDist >= totalLen) return dense[dense.length - 1];
    for (let i = 1; i < cumLen.length; i++) {
      if (cumLen[i] >= targetDist) {
        const span = Math.max(1e-5, cumLen[i] - cumLen[i - 1]);
        const frac = (targetDist - cumLen[i - 1]) / span;
        return {
          x: dense[i - 1].x + (dense[i].x - dense[i - 1].x) * frac,
          z: dense[i - 1].z + (dense[i].z - dense[i - 1].z) * frac,
        };
      }
    }
    return dense[dense.length - 1];
  };

  const count = Math.min(maxSegments, Math.max(1, Math.ceil((totalLen - 0.5) / segmentLength)));
  const segments: PlannedPathSegment[] = [];
  for (let i = 0; i < count; i++) {
    const p0 = sampleAtArc(i * segmentLength);
    const p1 = sampleAtArc(Math.min(totalLen, (i + 1) * segmentLength));
    const segDx = p1.x - p0.x;
    const segDz = p1.z - p0.z;
    const rot = Math.hypot(segDx, segDz) > 0.05 ? Math.atan2(segDx, segDz) : fallbackRotation;
    segments.push({
      x: (p0.x + p1.x) * 0.5,
      z: (p0.z + p1.z) * 0.5,
      rotation: rot,
    });
  }
  return segments;
}

export function formatTimeOfDay(timeNorm: number): {
  label: string;
  phase: 'Dawn' | 'Morning' | 'Midday' | 'Sunset' | 'Night';
  isNight: boolean;
} {
  const wrapped = ((timeNorm % 1) + 1) % 1;
  const totalMinutes = Math.floor(wrapped * 24 * 60);
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const mins = Math.floor((totalMinutes % 60) / 15) * 15;
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const label = `${hours12}:${mins.toString().padStart(2, '0')} ${suffix}`;

  let phase: 'Dawn' | 'Morning' | 'Midday' | 'Sunset' | 'Night' = 'Day' as unknown as 'Morning';
  if (wrapped >= 0.22 && wrapped < 0.30) phase = 'Dawn';
  else if (wrapped >= 0.30 && wrapped < 0.45) phase = 'Morning';
  else if (wrapped >= 0.45 && wrapped < 0.68) phase = 'Midday';
  else if (wrapped >= 0.68 && wrapped < 0.80) phase = 'Sunset';
  else phase = 'Night';

  return {
    label,
    phase,
    isNight: phase === 'Night',
  };
}

export function calculateGuestCapacity(buildings: PlacedBuilding[]): number {
  let cap = 0;
  for (const b of buildings) {
    const def = BUILDING_CATALOG[b.defId];
    if (def) cap += def.capacity;
  }
  return cap;
}

export function calculatePrestigeScore(buildings: PlacedBuilding[], decorBoost = 0): number {
  let score = 0;
  for (const b of buildings) {
    const def = BUILDING_CATALOG[b.defId];
    if (def) score += def.prestigePoints;
  }
  return score + decorBoost;
}

/**
 * Multi-factor star rating: requires prestige AND real guest accommodations/cleanliness
 * so you cannot reach 5 stars by spamming garden ponds alone.
 */
export function calculateStarRating(
  prestige: number,
  guestCount: number,
  capacity: number,
  cleanliness: number = 90
): number {
  let rawStars = 0.5;
  if (prestige >= 16000 && capacity >= 24 && cleanliness >= 75) rawStars = 5.0;
  else if (prestige >= 11000 && capacity >= 18 && cleanliness >= 70) rawStars = 4.5;
  else if (prestige >= 7500 && capacity >= 12 && cleanliness >= 65) rawStars = 4.0;
  else if (prestige >= 5200 && capacity >= 8) rawStars = 3.5;
  else if (prestige >= 3500 && capacity >= 6) rawStars = 3.0;
  else if (prestige >= 2200 && capacity >= 4) rawStars = 2.5;
  else if (prestige >= 1300 && capacity >= 4) rawStars = 2.0;
  else if (prestige >= 600 && capacity >= 2) rawStars = 1.5;
  else if (prestige >= 220) rawStars = 1.0;

  return rawStars;
}

export function calculateStaffExpenses(staff: StaffRoster): number {
  return (
    staff.cleaners * STAFF_SALARIES.cleaners +
    staff.bartenders * STAFF_SALARIES.bartenders +
    staff.chefs * STAFF_SALARIES.chefs +
    staff.concierges * STAFF_SALARIES.concierges
  );
}

export function calculateBuildingUpkeep(
  buildings: PlacedBuilding[],
  difficulty: DifficultyMode = 'standard'
): number {
  let upkeep = 0;
  for (const b of buildings) {
    const def = BUILDING_CATALOG[b.defId];
    if (def) upkeep += def.maintenanceCost;
  }
  const { upkeepMult } = getDifficultyMultipliers(difficulty);
  return Math.round(upkeep * upkeepMult);
}

export function calculateNextCleanliness(
  currentCleanliness: number,
  buildings: PlacedBuilding[],
  guestCount: number,
  staff: StaffRoster,
  difficulty: DifficultyMode = 'standard'
): number {
  if (buildings.length === 0 && guestCount === 0) return Math.min(100, currentCleanliness + 5);
  const nonPathBuildings = buildings.filter((b) => BUILDING_CATALOG[b.defId]?.category !== 'paths').length;
  const dirtLoad = nonPathBuildings * 4 + guestCount * 3;
  const cleanCapacity = staff.cleaners * 16 + 10; // Player personally tidies ~10 dirt load
  const deficit = dirtLoad - cleanCapacity;
  const { dirtScale } = getDifficultyMultipliers(difficulty);

  let delta = 0;
  if (deficit > 0) {
    delta = -Math.min(22, Math.ceil((deficit / 4) * dirtScale));
  } else {
    delta = Math.min(14, Math.max(3, Math.ceil(Math.abs(deficit) / 5)));
  }

  return Math.max(15, Math.min(100, currentCleanliness + delta));
}

export function calculateDailyRevenue(
  buildings: PlacedBuilding[],
  guestCount: number,
  capacity: number,
  staff: StaffRoster = { cleaners: 0, bartenders: 0, chefs: 0, concierges: 0 },
  cleanliness: number = 90,
  difficulty: DifficultyMode = 'standard'
): number {
  if (guestCount <= 0) return 0;

  let totalRev = 0;
  const occupancyRatio = capacity > 0 ? Math.min(1.0, guestCount / capacity) : 0;
  const cleanMult = cleanliness >= 80 ? 1.0 : cleanliness >= 55 ? 0.85 : 0.6;
  const { revenueMult } = getDifficultyMultipliers(difficulty);
  const seenCounts: Record<string, number> = {};

  for (const b of buildings) {
    const def = BUILDING_CATALOG[b.defId];
    if (!def || def.dailyRevenue <= 0) continue;

    // Staff multiplier: unstaffed role-backed structures earn 65%, staffed earn 110%
    let staffMult = 1.0;
    if (def.preferredStaffRole) {
      const staffCount = staff[def.preferredStaffRole] || 0;
      staffMult = staffCount > 0 ? 1.1 : 0.65;
    }

    if (def.capacity > 0) {
      // Accommodation earns proportionally to occupied beds
      totalRev += def.dailyRevenue * occupancyRatio * staffMult;
    } else {
      // Amenities & Ferry Pier scale up to 100% by guest demand and have diminishing returns per duplicate
      const targetGuests = Math.max(2, Math.min(24, Math.ceil(def.dailyRevenue / 50)));
      const guestDemandScale = Math.min(1.0, guestCount / targetGuests);
      const dupIdx = seenCounts[b.defId] ?? 0;
      seenCounts[b.defId] = dupIdx + 1;
      const dupMult = 1 / (1 + 0.6 * dupIdx);
      totalRev += def.dailyRevenue * guestDemandScale * dupMult * staffMult;
    }
  }

  return Math.round(totalRev * cleanMult * revenueMult);
}

export function generateNewGuests(
  count: number,
  starRating: number,
  existingCount: number,
): GuestRecord[] {
  const FIRST_NAMES = ['Aria', 'Leo', 'Mia', 'Lucas', 'Chloe', 'Oliver', 'Elena', 'Julian', 'Sophia', 'Alexander', 'Maya', 'Liam'];
  const LAST_NAMES = ['Vance', 'Sterling', 'Sinclair', 'Fairchild', 'Castillo', 'Beaumont', 'Mercer', 'DuPont', 'Kowalski', 'Chen'];
  const ACTIVITIES: Array<GuestRecord['preferredActivity']> = ['swim', 'drink', 'dine', 'spa', 'relax', 'waterpark', 'yacht'];

  const guests: GuestRecord[] = [];
  for (let i = 0; i < count; i++) {
    const isVip = starRating >= 4.0 && Math.random() < 0.25;
    const isLuxury = !isVip && starRating >= 2.0 && Math.random() < 0.45;
    const tier: GuestRecord['tier'] = isVip ? 'vip' : isLuxury ? 'luxury' : 'economy';
    const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];

    guests.push({
      id: `guest_${Date.now()}_${existingCount + i}_${Math.floor(Math.random() * 1000)}`,
      name: `${first} ${last}`,
      tier,
      satisfaction: 80 + Math.floor(Math.random() * 18),
      daysRemaining: 2 + Math.floor(Math.random() * 4),
      preferredActivity: ACTIVITIES[Math.floor(Math.random() * ACTIVITIES.length)],
    });
  }

  return guests;
}

export function processEndOfDay(state: TycoonGameState, nextTimeOfDay: number = 0.30): TycoonGameState {
  const nextDay = state.stats.day + 1;
  const difficulty = state.difficulty || 'standard';
  const capacity = calculateGuestCapacity(state.buildings);
  const currentGuestCount = state.guests.length;
  const currentCleanliness = state.stats.cleanliness ?? 100;

  // 1. Settle cash for the day that just concluded — matches the HUD net figure 1:1
  const settledRev = calculateDailyRevenue(
    state.buildings,
    currentGuestCount,
    capacity,
    state.staff,
    currentCleanliness,
    difficulty
  );
  const dailyStaffExp = calculateStaffExpenses(state.staff);
  const dailyUpkeep = calculateBuildingUpkeep(state.buildings, difficulty);
  const netIncome = settledRev - dailyStaffExp - dailyUpkeep;
  const updatedCash = state.resources.cash + netIncome;

  // 2. Advance cleanliness, guest stays, departures & arrivals for the new day
  const nextCleanliness = calculateNextCleanliness(
    currentCleanliness,
    state.buildings,
    currentGuestCount,
    state.staff,
    difficulty
  );

  const hasFood = state.buildings.some((b) => b.defId === 'sunset_lounge' || b.defId === 'tiki_bar' || b.defId === 'coconut_stand');
  const updatedGuests: GuestRecord[] = [];
  let departures = 0;

  for (const guest of state.guests) {
    const satShift = (nextCleanliness < 60 ? -12 : nextCleanliness >= 85 ? 4 : 0) + (hasFood ? 3 : -4);
    const nextSat = Math.max(20, Math.min(100, guest.satisfaction + satShift));

    if (guest.daysRemaining > 1 && nextSat >= 45) {
      updatedGuests.push({
        ...guest,
        satisfaction: nextSat,
        daysRemaining: guest.daysRemaining - 1,
      });
    } else {
      departures++;
    }
  }

  const avgSat = updatedGuests.length > 0
    ? updatedGuests.reduce((acc, g) => acc + g.satisfaction, 0) / updatedGuests.length
    : nextCleanliness;
  const nextReputation = Math.round(Math.max(15, Math.min(100, state.stats.reputation * 0.5 + avgSat * 0.5)));

  const hasFerryDock = state.buildings.some((b) => b.defId === 'ferry_dock');
  const availableBeds = Math.max(0, capacity - updatedGuests.length);

  let newGuests: GuestRecord[] = [];
  if (hasFerryDock && availableBeds > 0 && nextReputation >= 35) {
    const repFactor = nextReputation >= 75 ? 1.0 : 0.6;
    const arrivalDemand = Math.min(
      availableBeds,
      Math.max(1, Math.round((1 + state.stats.starRating * 1.2 + Math.random() * 1.2) * repFactor))
    );
    newGuests = generateNewGuests(arrivalDemand, state.stats.starRating, updatedGuests.length);
  }

  const allGuests = [...updatedGuests, ...newGuests];
  const prestige = calculatePrestigeScore(state.buildings);
  const starRating = calculateStarRating(prestige, allGuests.length, capacity, nextCleanliness);

  // 3. Forecast projected dailyRevenue for the new day so HUD stays exact
  const projectedDailyRev = calculateDailyRevenue(
    state.buildings,
    allGuests.length,
    capacity,
    state.staff,
    nextCleanliness,
    difficulty
  );

  return {
    ...state,
    resources: {
      ...state.resources,
      cash: updatedCash,
    },
    guests: allGuests,
    stats: {
      ...state.stats,
      day: nextDay,
      timeOfDay: nextTimeOfDay,
      starRating,
      prestigeScore: prestige,
      reputation: nextReputation,
      cleanliness: nextCleanliness,
      totalVisitorsServed: state.stats.totalVisitorsServed + departures,
      lifetimeEarnings: state.stats.lifetimeEarnings + Math.max(0, settledRev),
      dailyRevenue: projectedDailyRev,
      dailyExpenses: dailyStaffExp,
      dailyUpkeep,
    },
  };
}

export const SUPPLY_PACKS = [
  { id: 'lumber_cargo', name: 'Timber Cargo Crate', resource: 'timber' as const, amount: 50, cost: 110 },
  { id: 'stone_cargo', name: 'Quarried Stone Freight', resource: 'stone' as const, amount: 50, cost: 130 },
  { id: 'thatch_cargo', name: 'Palm Thatch Bundle', resource: 'thatch' as const, amount: 45, cost: 90 },
  { id: 'luxury_cargo', name: 'Imported Marble & Decor', resource: 'decor' as const, amount: 22, cost: 280 },
];

export function buySupplyPack(
  stockpile: ResourceStockpile,
  packId: string
): { success: boolean; updatedStockpile: ResourceStockpile; message: string; resource?: string; amount?: number } {
  const pack = SUPPLY_PACKS.find((p) => p.id === packId);
  if (!pack) {
    return { success: false, updatedStockpile: stockpile, message: 'Invalid supply pack.' };
  }

  if (stockpile.cash < pack.cost) {
    return { success: false, updatedStockpile: stockpile, message: 'Insufficient cash for supply shipment.' };
  }

  return {
    success: true,
    updatedStockpile: {
      ...stockpile,
      cash: stockpile.cash - pack.cost,
      [pack.resource]: stockpile[pack.resource] + pack.amount,
    },
    message: `Shipment received: +${pack.amount} ${pack.resource.toUpperCase()} delivered to island!`,
    resource: pack.resource,
    amount: pack.amount,
  };
}

export function canUpgradeIsland(state: TycoonGameState): { canUpgrade: boolean; nextTier?: IslandExpansionTier; reason?: string } {
  const nextTierIndex = state.islandTier;
  if (nextTierIndex >= ISLAND_EXPANSIONS.length) {
    return { canUpgrade: false, reason: 'Island is already at maximum expansion!' };
  }
  const nextTier = ISLAND_EXPANSIONS[nextTierIndex];
  if (state.stats.prestigeScore < nextTier.unlockedPrestige) {
    return { canUpgrade: false, nextTier, reason: `Requires ${nextTier.unlockedPrestige} Prestige Points.` };
  }
  if (!canAfford(state.resources, nextTier.cost)) {
    return { canUpgrade: false, nextTier, reason: 'Insufficient funds or resources for island reclamation.' };
  }
  return { canUpgrade: true, nextTier };
}

export function getInitialGameState(difficulty: DifficultyMode = 'standard'): TycoonGameState {
  const isHardcore = difficulty === 'hardcore';
  return {
    difficulty,
    resources: isHardcore
      ? { cash: 0, timber: 24, stone: 12, thatch: 12, decor: 0 }
      : { cash: 0, timber: 45, stone: 24, thatch: 24, decor: 0 },
    buildings: [],
    staff: {
      cleaners: 0,
      bartenders: 0,
      chefs: 0,
      concierges: 0,
    },
    guests: [],
    stats: {
      day: 1,
      timeOfDay: 0.35, // morning sun
      starRating: 0.5,
      prestigeScore: 0,
      reputation: isHardcore ? 75 : 85,
      cleanliness: 100,
      totalVisitorsServed: 0,
      lifetimeEarnings: 0,
      dailyRevenue: 0,
      dailyExpenses: 0,
      dailyUpkeep: 0,
    },
    milestones: [],
    playerPosition: { x: 0, y: 1.8, z: 20, rotationY: 0 },
    islandTier: 1,
    islandRadius: 75,
    cargoCratesCount: 0,
  };
}
