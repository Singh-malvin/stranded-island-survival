// Pure wildlife AI simulation, biome spawning, melee hunting/combat, and respawns.
// No Three.js or React imports.

import { DIFFICULTY, NEEDS, WILDLIFE, WORLD } from './config.ts';
import { addItem, damageSlotDurability, getEquipped, ITEM_DEFS } from './items.ts';
import type { ItemId, SurvivalState, WildlifeEntity, WildlifeKind } from './types.ts';
import { sampleIslandHeight } from './world.ts';

export interface WildlifeSpec {
  kind: WildlifeKind;
  name: string;
  maxHp: number;
  walkSpeed: number;
  rushSpeed: number;
  detectionRange: number;
  attackRange: number;
  attackDamage: number;
  attackCooldownSec: number;
  venomChance: number;
  respawnHours: number;
  aggressive: boolean;
  loot: Array<{ itemId: ItemId; count: number }>;
}

export const WILDLIFE_SPECS: Record<WildlifeKind, WildlifeSpec> = {
  crab: {
    kind: 'crab',
    name: 'Shore Reef Crab',
    maxHp: 2,
    walkSpeed: 1.9,
    rushSpeed: 4.1,
    detectionRange: 7.5,
    attackRange: 1.4,
    attackDamage: 4,
    attackCooldownSec: 2.8,
    venomChance: 0,
    respawnHours: WILDLIFE.CRAB_RESPAWN_HOURS,
    aggressive: false, // Skittish; scuttles away unless cornered/provoked
    loot: [
      { itemId: 'raw_meat', count: 1 },
      { itemId: 'shell', count: 1 },
    ],
  },
  boar: {
    kind: 'boar',
    name: 'Island Razorback Boar',
    maxHp: 6,
    walkSpeed: 2.3,
    rushSpeed: 6.4,
    detectionRange: 14,
    attackRange: 2.3,
    attackDamage: 14,
    attackCooldownSec: 2.2,
    venomChance: 0,
    respawnHours: WILDLIFE.BOAR_RESPAWN_HOURS,
    aggressive: true,
    loot: [
      { itemId: 'raw_meat', count: 3 },
      { itemId: 'fibre', count: 1 },
    ],
  },
  viper: {
    kind: 'viper',
    name: 'Basalt Pit Viper',
    maxHp: 3,
    walkSpeed: 1.6,
    rushSpeed: 4.5,
    detectionRange: 9.5,
    attackRange: 1.9,
    attackDamage: 9,
    attackCooldownSec: 2.4,
    venomChance: 0.45,
    respawnHours: WILDLIFE.VIPER_RESPAWN_HOURS,
    aggressive: true,
    loot: [{ itemId: 'raw_meat', count: 1 }],
  },
};

export function generateInitialWildlife(
  seed: number = WORLD.SEED + 77,
  islandRadius: number = WORLD.ISLAND_RADIUS
): WildlifeEntity[] {
  let s = seed;
  const rng = () => {
    const v = Math.sin(s++) * 10000;
    return v - Math.floor(v);
  };

  const list: WildlifeEntity[] = [];
  const spawn = (kind: WildlifeKind, x: number, z: number) => {
    const spec = WILDLIFE_SPECS[kind];
    list.push({
      id: `wild_${kind}_${list.length}`,
      kind,
      x: Math.round(x * 100) / 100,
      z: Math.round(z * 100) / 100,
      homeX: Math.round(x * 100) / 100,
      homeZ: Math.round(z * 100) / 100,
      heading: Math.round(rng() * Math.PI * 2 * 100) / 100,
      hp: spec.maxHp,
      maxHp: spec.maxHp,
      behavior: 'patrol',
      attackCooldownSec: 0,
      patrolAngle: rng() * Math.PI * 2,
      animPhase: rng() * Math.PI * 2,
      respawnAt: null,
    });
  };

  // Shore Crabs along beach coves & Western Tide Pools (safe offset from initial spawn 0, 146)
  const crabSpots: Array<[number, number]> = [
    [-26, 144],
    [-46, 134],
    [WORLD.TIDE_POOLS_POS.x + 8, WORLD.TIDE_POOLS_POS.z + 6],
    [WORLD.TIDE_POOLS_POS.x - 10, WORLD.TIDE_POOLS_POS.z - 4],
    [WORLD.WRECK_POS.x + 14, WORLD.WRECK_POS.z + 8],
    [62, 118],
    [-88, 92],
  ];
  for (const [cx, cz] of crabSpots) {
    if (sampleIslandHeight(cx, cz, islandRadius) > WORLD.WATER_LEVEL - 0.1) {
      spawn('crab', cx, cz);
    }
  }

  // Wild Boars across Palm Cove (outer edges) and Act 2 Interior Plateau
  const boarSpots: Array<[number, number]> = [
    [WORLD.PALM_COVE_POS.x + 8, WORLD.PALM_COVE_POS.z - 4],
    [-58, 72],
    [22, 68],
    [-22, 16],
    [16, 12],
    [WORLD.ABANDONED_CAMP_POS.x + 18, WORLD.ABANDONED_CAMP_POS.z - 14],
    [WORLD.JUNGLE_TAIL_POS.x - 16, WORLD.JUNGLE_TAIL_POS.z - 16],
    [-18, -32],
    [32, -44],
  ];
  for (const [bx, bz] of boarSpots) {
    if (sampleIslandHeight(bx, bz, islandRadius) > WORLD.WATER_LEVEL + 0.8) {
      spawn('boar', bx, bz);
    }
  }

  // Jungle & Cave Pit Vipers guarding ridge trails, interior plateau, caves, and ruins
  const viperSpots: Array<[number, number]> = [
    [-18, 56],
    [24, 52],
    [-38, -14],
    [8, -22],
    [WORLD.CAVE_GROTTO_POS.x + 7, WORLD.CAVE_GROTTO_POS.z + 4],
    [WORLD.CAVE_GROTTO_POS.x - 5, WORLD.CAVE_GROTTO_POS.z - 6],
    [WORLD.ANCIENT_RUINS_POS.x - 8, WORLD.ANCIENT_RUINS_POS.z + 6],
    [-28, -72],
  ];
  for (const [vx, vz] of viperSpots) {
    if (sampleIslandHeight(vx, vz, islandRadius) > WORLD.WATER_LEVEL + 1.0) {
      spawn('viper', vx, vz);
    }
  }

  return list;
}

export interface WildlifeTickResult {
  wildlife: WildlifeEntity[];
  damageToPlayer: number;
  poisonedPlayer: boolean;
  attackerMessage: string | null;
}

export function tickWildlifeAI(
  wildlife: WildlifeEntity[],
  playerPos: { x: number; z: number },
  totalHours: number,
  dtSec: number,
  isNight: boolean,
  difficulty: 'survivor' | 'hardcore' = 'survivor',
  rng: () => number = Math.random
): WildlifeTickResult {
  if (dtSec <= 0 || wildlife.length === 0) {
    return { wildlife, damageToPlayer: 0, poisonedPlayer: false, attackerMessage: null };
  }

  const diff = DIFFICULTY[difficulty];
  let totalDamage = 0;
  let poisoned = false;
  let attackerMessage: string | null = null;
  const detectMult = isNight ? WILDLIFE.NIGHT_DETECTION_MULT : 1.0;

  const updated = wildlife.map((w) => {
    const spec = WILDLIFE_SPECS[w.kind];

    // Check respawn for dead creatures (far enough from player so they don't pop right on screen)
    if (w.behavior === 'dead' || w.hp <= 0) {
      if (w.respawnAt !== null && totalHours >= w.respawnAt) {
        const distHome = Math.hypot(playerPos.x - w.homeX, playerPos.z - w.homeZ);
        if (distHome > 18) {
          return {
            ...w,
            x: w.homeX,
            z: w.homeZ,
            hp: spec.maxHp,
            behavior: 'patrol' as const,
            attackCooldownSec: 0,
            respawnAt: null,
          };
        }
      }
      return w;
    }

    const dxToPlayer = playerPos.x - w.x;
    const dzToPlayer = playerPos.z - w.z;
    const distToPlayer = Math.hypot(dxToPlayer, dzToPlayer);
    if (distToPlayer > WILDLIFE.ACTIVE_SIM_RADIUS_M) {
      return w;
    }

    const distFromHome = Math.hypot(w.x - w.homeX, w.z - w.homeZ);
    const nextCooldown = Math.max(0, w.attackCooldownSec - dtSec);
    const detectRange = spec.detectionRange * detectMult;

    let nextBehavior = w.behavior;
    let speed = spec.walkSpeed;
    let moveHeading = w.heading;
    let patrolAngle = w.patrolAngle;

    if (spec.aggressive && distToPlayer <= spec.attackRange && distFromHome < 32) {
      nextBehavior = 'attack';
      moveHeading = Math.atan2(dxToPlayer, dzToPlayer);
      speed = 0;
      if (nextCooldown <= 0) {
        totalDamage += Math.round(spec.attackDamage * diff.damageMult);
        if (spec.venomChance > 0 && rng() < spec.venomChance) {
          poisoned = true;
          attackerMessage = `${spec.name} struck you with venomous fangs! Craft a Medicinal Poultice.`;
        } else {
          attackerMessage = `${spec.name} attacked you! (-${Math.round(
            spec.attackDamage * diff.damageMult
          )} HP)`;
        }
      }
    } else if (spec.aggressive && distToPlayer <= detectRange && distFromHome < 28) {
      nextBehavior = 'chase';
      moveHeading = Math.atan2(dxToPlayer, dzToPlayer);
      speed = spec.rushSpeed;
    } else if (!spec.aggressive && distToPlayer <= detectRange) {
      nextBehavior = 'flee';
      moveHeading = Math.atan2(-dxToPlayer, -dzToPlayer);
      speed = spec.rushSpeed;
    } else {
      nextBehavior = 'patrol';
      patrolAngle = (w.patrolAngle + dtSec * 0.45) % (Math.PI * 2);
      const orbitR = w.kind === 'crab' ? 4.5 : 8.5;
      const goalX = w.homeX + Math.cos(patrolAngle) * orbitR;
      const goalZ = w.homeZ + Math.sin(patrolAngle) * orbitR;
      const toGoalX = goalX - w.x;
      const toGoalZ = goalZ - w.z;
      if (Math.hypot(toGoalX, toGoalZ) > 0.6) {
        moveHeading = Math.atan2(toGoalX, toGoalZ);
        speed = spec.walkSpeed;
      } else {
        speed = 0;
      }
    }

    let nextX = w.x;
    let nextZ = w.z;
    if (speed > 0.05) {
      const step = speed * dtSec;
      const candX = w.x + Math.sin(moveHeading) * step;
      const candZ = w.z + Math.cos(moveHeading) * step;
      const candH = sampleIslandHeight(candX, candZ);
      const minFloor = w.kind === 'crab' ? WORLD.WATER_LEVEL - 0.15 : WORLD.WATER_LEVEL + 0.45;
      // Keep wildlife outside Southern cove immediate spawn circle (0, 146) & out of steep walls
      const tooCloseToStart = Math.hypot(candX - WORLD.PLAYER_SPAWN.x, candZ - WORLD.PLAYER_SPAWN.z) < 16;
      const curH = sampleIslandHeight(w.x, w.z);
      const jumpHeight = Math.abs(candH - curH);
      if (candH >= minFloor && jumpHeight < 1.25 && !tooCloseToStart) {
        nextX = candX;
        nextZ = candZ;
      } else {
        patrolAngle += 1.4;
      }
    }

    const attackFired = nextBehavior === 'attack' && nextCooldown <= 0;

    return {
      ...w,
      x: nextX,
      z: nextZ,
      heading: moveHeading,
      behavior: nextBehavior,
      patrolAngle,
      attackCooldownSec: attackFired ? spec.attackCooldownSec : nextCooldown,
      animPhase: w.animPhase + dtSec * (speed > 0 ? speed * 2.8 : 2.0),
    };
  });

  return {
    wildlife: updated,
    damageToPlayer: totalDamage,
    poisonedPlayer: poisoned,
    attackerMessage,
  };
}

export function attackWildlife(
  state: SurvivalState,
  creatureId: string
): {
  state: SurvivalState;
  hit: boolean;
  killed: boolean;
  message: string;
} {
  const target = state.wildlife.find((w) => w.id === creatureId);
  if (!target || target.behavior === 'dead' || target.hp <= 0) {
    return { state, hit: false, killed: false, message: 'Nothing there.' };
  }

  if (state.needs.stamina < NEEDS.STAMINA_PER_SWING) {
    return {
      state,
      hit: false,
      killed: false,
      message: 'Too exhausted to strike!',
    };
  }

  const equipped = getEquipped(state.inventory, state.selectedSlot);
  const tool = equipped.def?.tool;
  const damage =
    tool?.kind === 'spear' || tool?.kind === 'machete'
      ? 3
      : tool && tool.kind !== 'torch' && tool.kind !== 'lantern'
        ? 2
        : 1;

  let nextInventory = state.inventory;
  if (tool && tool.kind !== 'torch' && tool.kind !== 'lantern') {
    nextInventory = damageSlotDurability(nextInventory, state.selectedSlot, 1).inventory;
  }

  const spec = WILDLIFE_SPECS[target.kind];
  const nextHp = Math.max(0, target.hp - damage);
  const killed = nextHp <= 0;

  let itemsGained = 0;
  const dropParts: string[] = [];
  if (killed) {
    for (const drop of spec.loot) {
      const res = addItem(nextInventory, drop.itemId, drop.count);
      nextInventory = res.inventory;
      itemsGained += res.added;
      dropParts.push(`+${res.added} ${ITEM_DEFS[drop.itemId].name}`);
    }
  }

  const nextWildlife = state.wildlife.map((w) =>
    w.id === creatureId
      ? {
          ...w,
          hp: nextHp,
          behavior: killed ? ('dead' as const) : w.behavior,
          respawnAt: killed ? state.clock.totalHours + spec.respawnHours : null,
          // Knock creature back slightly on hit
          x: killed ? w.x : w.x + (w.x - state.player.x > 0 ? 0.65 : -0.65),
          z: killed ? w.z : w.z + (w.z - state.player.z > 0 ? 0.65 : -0.65),
        }
      : w
  );

  const nextFlags = killed ? { ...state.flags, hunted_wildlife: true } : state.flags;

  return {
    state: {
      ...state,
      needs: {
        ...state.needs,
        stamina: Math.max(0, state.needs.stamina - NEEDS.STAMINA_PER_SWING),
      },
      inventory: nextInventory,
      wildlife: nextWildlife,
      flags: nextFlags,
      stats: {
        ...state.stats,
        itemsGathered: state.stats.itemsGathered + itemsGained,
      },
    },
    hit: true,
    killed,
    message: killed
      ? `Hunted ${spec.name}: ${dropParts.join(', ')}`
      : `Struck ${spec.name} for ${damage} dmg (${nextHp}/${target.maxHp} HP)`,
  };
}
