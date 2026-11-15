/**
 * Pure simulation for The Aura King's Autonomous Island Patrol & Stealth AI,
 * Caldera Stronghold Patrols & Armory Theft, and Repeatable Multi-Path Dungeon Escapes.
 * No Three.js or React imports.
 */

import { AURA_AI_TUNING, PRISON_TUNING, WORLD } from './config.ts';
import { addItem, removeItem } from './items.ts';
import type {
  AuraGuardState,
  AuraKingAIState,
  InventorySlot,
  JournalEntry,
  PlayerStance,
  PrisonEscapePath,
  PrisonState,
  StrongholdState,
  SurvivalState,
} from './types.ts';

export function createInitialAuraKingAIState(): AuraKingAIState {
  const start = AURA_AI_TUNING.PATROL_WAYPOINTS[0];
  return {
    awareness: 'unaware',
    suspicion: 0,
    x: start.x,
    z: start.z,
    yaw: 0,
    patrolIndex: 1,
    lastKnownPlayerPos: null,
    huntTimerSec: 0,
    provokedByTheftCount: 0,
    lastSightingHour: null,
  };
}

export function createInitialStrongholdState(): StrongholdState {
  const sh = PRISON_TUNING.STRONGHOLD_POS;
  return {
    alertLevel: 0,
    highAlertUntilHour: null,
    stolenRifle: false,
    stolenHarpoon: false,
    stolenShards: 0,
    guards: [
      {
        id: 'guard_gate',
        x: sh.x + 0.5,
        z: sh.z + 11.5,
        yaw: 0,
        patrolA: { x: sh.x - 5, z: sh.z + 11.5 },
        patrolB: { x: sh.x + 5.5, z: sh.z + 11.5 },
        hp: 75,
        maxHp: 75,
        alert: 0,
        downedUntilHour: null,
      },
      {
        id: 'guard_armory',
        x: sh.x + 5.2,
        z: sh.z + 1.5,
        yaw: -1.5,
        patrolA: { x: sh.x + 4.8, z: sh.z - 4.5 },
        patrolB: { x: sh.x + 5.2, z: sh.z + 6.5 },
        hp: 80,
        maxHp: 80,
        alert: 0,
        downedUntilHour: null,
      },
      {
        id: 'guard_prison',
        x: sh.x - 4.5,
        z: sh.z - 2.0,
        yaw: 1.5,
        patrolA: { x: sh.x - 4.5, z: sh.z - 6.0 },
        patrolB: { x: sh.x - 4.5, z: sh.z + 4.5 },
        hp: 80,
        maxHp: 80,
        alert: 0,
        downedUntilHour: null,
      },
    ],
  };
}

export function createInitialPrisonState(): PrisonState {
  return {
    inPrison: false,
    capturedCount: 0,
    escapedPathsUsed: [],
    confiscatedItems: [],
    lockerRecovered: true,
    escapeHoursElapsed: 0,
  };
}

export function normalizeAuraKingAIState(raw?: Partial<AuraKingAIState> | null): AuraKingAIState {
  const base = createInitialAuraKingAIState();
  if (!raw || typeof raw !== 'object') return base;
  return { ...base, ...raw };
}

export function normalizeStrongholdState(raw?: Partial<StrongholdState> | null): StrongholdState {
  const base = createInitialStrongholdState();
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    guards: Array.isArray(raw.guards) && raw.guards.length > 0 ? raw.guards : base.guards,
  };
}

export function normalizePrisonState(raw?: Partial<PrisonState> | null): PrisonState {
  const base = createInitialPrisonState();
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    escapedPathsUsed: Array.isArray(raw.escapedPathsUsed) ? raw.escapedPathsUsed : [],
    confiscatedItems: Array.isArray(raw.confiscatedItems) ? raw.confiscatedItems : [],
  };
}

function appendJournal(entries: JournalEntry[], entry: JournalEntry): JournalEntry[] {
  if (entries.some((e) => e.id === entry.id)) return entries;
  return [...entries, entry];
}

/**
 * Computes stealth detection rate multiplier (0.14..2.0) reacting to crouch/prone,
 * night shadows, storm rain/fog, lit nearby campfires, and post-escape heat.
 */
export function computeStealthVisibility(
  state: SurvivalState,
  stance: PlayerStance,
  hasActiveFireNearby: boolean
): number {
  let mult = 1.0;
  if (stance === 'crouch') mult *= AURA_AI_TUNING.CROUCH_VISIBILITY_MULT;
  else if (stance === 'prone') mult *= AURA_AI_TUNING.PRONE_VISIBILITY_MULT;

  const isNight = state.clock.hour >= 19.5 || state.clock.hour < 5.5;
  if (isNight) mult *= AURA_AI_TUNING.NIGHT_VISIBILITY_MULT;

  if (state.weather.kind === 'storm' || state.weather.rain > 0.45) {
    mult *= AURA_AI_TUNING.STORM_VISIBILITY_MULT;
  }
  if (hasActiveFireNearby) {
    mult *= AURA_AI_TUNING.CAMPFIRE_BEACON_MULT;
  }
  if (
    state.stronghold.highAlertUntilHour !== null &&
    state.clock.totalHours < state.stronghold.highAlertUntilHour
  ) {
    mult *= 1.35;
  }
  return Math.max(0.12, Math.min(2.2, mult));
}

/**
 * Stealing high-tier gear from the Stronghold Armory without crafting it.
 * Raises Aura King suspicion once he realizes weapons went missing.
 */
export function stealStrongholdItem(
  state: SurvivalState,
  target: 'aura_rifle' | 'harpoon_gun' | 'aura_shard'
): { ok: boolean; state: SurvivalState; message: string } {
  let inv = state.inventory;
  const sh = { ...state.stronghold };

  if (target === 'aura_rifle') {
    if (sh.stolenRifle) {
      return { ok: false, state, message: 'Armory rifle rack is already empty.' };
    }
    inv = addItem(inv, 'aura_rifle', 1).inventory;
    inv = addItem(inv, 'rifle_ammo', 6).inventory;
    sh.stolenRifle = true;
  } else if (target === 'harpoon_gun') {
    if (sh.stolenHarpoon) {
      return { ok: false, state, message: 'Armory harpoon cradle is already empty.' };
    }
    inv = addItem(inv, 'harpoon_gun', 1).inventory;
    inv = addItem(inv, 'harpoon_bolt', 4).inventory;
    sh.stolenHarpoon = true;
  } else {
    if (sh.stolenShards >= 3) {
      return { ok: false, state, message: 'Shard vault already cleaned out.' };
    }
    inv = addItem(inv, 'aura_shard', 1).inventory;
    sh.stolenShards += 1;
  }

  const nextSuspicion = Math.min(
    100,
    state.auraKingAI.suspicion + AURA_AI_TUNING.THEFT_SUSPICION_SPIKE
  );
  const nextAwareness = nextSuspicion >= 75 ? 'hunting' : 'suspicious';

  return {
    ok: true,
    state: {
      ...state,
      inventory: inv,
      stronghold: {
        ...sh,
        alertLevel: Math.min(100, sh.alertLevel + 35),
      },
      auraKingAI: {
        ...state.auraKingAI,
        suspicion: nextSuspicion,
        awareness: nextAwareness,
        provokedByTheftCount: state.auraKingAI.provokedByTheftCount + 1,
        lastKnownPlayerPos: { x: state.player.x, z: state.player.z },
        huntTimerSec: 28,
      },
      journalEntries: appendJournal(state.journalEntries, {
        id: `heist_${target}`,
        category: 'heist',
        title: `Stole ${target === 'aura_rifle' ? 'Aura-Infused Rifle' : target === 'harpoon_gun' ? 'Pneumatic Harpoon Gun' : 'Aura Shard'} from Stronghold`,
        detail:
          'Liberated Stronghold hardware cleanly! The Aura King has noticed missing vault gear and is increasing island sweeps.',
        day: state.clock.day,
      }),
    },
    message:
      target === 'aura_rifle'
        ? 'Stole Aura-Infused Rifle + 6x Capacitor Cells! Stay low — the King will hunt for missing armory gear.'
        : target === 'harpoon_gun'
          ? 'Stole Pneumatic Harpoon Gun + 4x Steel Harpoons! Slip out before the Stronghold locks down.'
          : 'Pocketed Condensed Aura Shard (+1)!',
  };
}

/**
 * Captures the player when caught by the Aura King or Stronghold guards:
 * moves player inside the Stronghold Dungeon Cell, confiscates stolen/heavy items to the Evidence Locker.
 */
export function capturePlayerToPrison(state: SurvivalState): SurvivalState {
  if (state.prison.inPrison) return state;

  const confiscateIds = new Set(['aura_rifle', 'rifle_ammo', 'harpoon_gun', 'harpoon_bolt', 'aura_shard', 'scrap_metal']);
  const confiscated: (InventorySlot | null)[] = [...state.prison.confiscatedItems];
  const keptInventory = state.inventory.map((slot) => {
    if (!slot) return null;
    if (confiscateIds.has(slot.itemId)) {
      confiscated.push({ ...slot });
      return null;
    }
    return slot;
  });

  const cell = PRISON_TUNING.CELL_WORLD_POS;
  const entry: JournalEntry = {
    id: `prison_capture_${state.prison.capturedCount + 1}`,
    category: 'heist',
    title: 'Captured & Thrown in Stronghold Dungeon',
    detail:
      'Captured by Stronghold forces! Confiscated gear sits in the brass Evidence Locker right outside the bars. Escape via lockpick, crouching through the cracked west stone vent, fighting the guard, or waiting for Daniel.',
    day: state.clock.day,
  };

  return {
    ...state,
    inventory: keptInventory,
    needs: {
      ...state.needs,
      health: Math.max(35, state.needs.health),
      stamina: Math.max(40, state.needs.stamina),
    },
    player: {
      x: cell.x,
      y: state.player.y,
      z: cell.z,
      yaw: 0.2,
    },
    auraKingAI: {
      ...state.auraKingAI,
      awareness: 'unaware',
      suspicion: 15,
      huntTimerSec: 0,
      lastKnownPlayerPos: null,
    },
    prison: {
      ...state.prison,
      inPrison: true,
      capturedCount: state.prison.capturedCount + 1,
      confiscatedItems: confiscated,
      lockerRecovered: confiscated.length === 0,
      escapeHoursElapsed: 0,
    },
    journalEntries: appendJournal(state.journalEntries, entry),
  };
}

/**
 * Repeatable Prison Breakout with 4 distinct player-driven paths:
 * 1) `lockpick`: silent unlock (uses Lockpick item, or loose cell pin after searching)
 * 2) `vent_sneak`: crouch/prone slip through the cracked stone floor/wall vent
 * 3) `daniel_rescue`: Daniel busts you out (requires Trust >= 50)
 * 4) `fight_out`: brawl past cell bars (deals minor scuff damage and raises Stronghold high-alert)
 */
export function attemptPrisonEscape(
  state: SurvivalState,
  path: PrisonEscapePath,
  opts: { stance?: PlayerStance } = {}
): { ok: boolean; state: SurvivalState; message: string } {
  if (!state.prison.inPrison) {
    return { ok: false, state, message: 'You are not locked inside the Stronghold Dungeon.' };
  }

  let nextInv = state.inventory;
  let exitPos: { x: number; z: number } = { x: PRISON_TUNING.LOCKER_WORLD_POS.x + 1.5, z: PRISON_TUNING.LOCKER_WORLD_POS.z };
  let alertSpike = 0;
  let highAlertUntil: number | null = state.stronghold.highAlertUntilHour;
  let nextHealth = state.needs.health;
  let escapeMsg = '';

  if (path === 'lockpick') {
    const rem = removeItem(nextInv, 'lockpick', 1);
    if (!rem.success && state.prison.escapeHoursElapsed < 0.35) {
      return {
        ok: false,
        state,
        message: 'No Spring-Steel Lockpick in bag (search the cell floor over a short wait or pick another route).',
      };
    }
    if (rem.success) nextInv = rem.inventory;
    escapeMsg = 'Picked the Stronghold Dungeon padlock silently! Grab your gear from the Evidence Locker outside.';
  } else if (path === 'vent_sneak') {
    if (opts.stance && opts.stance !== 'crouch' && opts.stance !== 'prone') {
      return {
        ok: false,
        state,
        message: 'Too narrow to squeeze through standing — Crouch [C] or go Prone [Z] to slip through the cracked vent!',
      };
    }
    exitPos = PRISON_TUNING.VENT_EXIT_WORLD_POS;
    escapeMsg = 'Crawled silently through the cracked basalt dungeon vent outside the West Stronghold wall!';
  } else if (path === 'daniel_rescue') {
    if (!state.companion.found || state.companion.trust < 50) {
      return {
        ok: false,
        state,
        message: 'Daniel has not bonded closely enough (requires Trust >= 50) to risk breaking into the Stronghold for you.',
      };
    }
    if (state.companion.trust < 65 && state.prison.escapeHoursElapsed < PRISON_TUNING.DANIEL_RESCUE_HOURS_WAIT) {
      return {
        ok: false,
        state,
        message: `Hold on — Daniel is circling the perimeter waiting for a guard gap (~${Math.max(0.2, PRISON_TUNING.DANIEL_RESCUE_HOURS_WAIT - state.prison.escapeHoursElapsed).toFixed(1)}h).`,
      };
    }
    escapeMsg = 'Daniel popped the dungeon hinge pin with a pry-bar — let’s grab your locker gear and bolt!';
  } else if (path === 'fight_out') {
    alertSpike = 65;
    highAlertUntil = state.clock.totalHours + PRISON_TUNING.HIGH_ALERT_DURATION_HOURS;
    nextHealth = Math.max(15, state.needs.health - 18);
    escapeMsg = 'Smashed open the rusted bars and knocked back the cell sentry! Stronghold High Alert triggered!';
  }

  const nextUsed = state.prison.escapedPathsUsed.includes(path)
    ? state.prison.escapedPathsUsed
    : [...state.prison.escapedPathsUsed, path];

  return {
    ok: true,
    state: {
      ...state,
      inventory: nextInv,
      needs: { ...state.needs, health: nextHealth },
      player: {
        ...state.player,
        x: exitPos.x,
        z: exitPos.z,
      },
      stronghold: {
        ...state.stronghold,
        alertLevel: Math.min(100, state.stronghold.alertLevel + alertSpike),
        highAlertUntilHour: highAlertUntil,
      },
      prison: {
        ...state.prison,
        inPrison: false,
        escapedPathsUsed: nextUsed,
      },
      flags: {
        ...state.flags,
        escaped_stronghold_prison: true,
      },
    },
    message: escapeMsg,
  };
}

/**
 * Reclaims confiscated Armory weapons & supplies from the Evidence Locker outside the cell.
 */
export function recoverEvidenceLocker(state: SurvivalState): {
  ok: boolean;
  state: SurvivalState;
  message: string;
} {
  if (state.prison.confiscatedItems.length === 0) {
    return {
      ok: false,
      state,
      message: 'Evidence Locker is empty.',
    };
  }
  let inv = state.inventory;
  const restoredNames: string[] = [];
  for (const slot of state.prison.confiscatedItems) {
    if (!slot) continue;
    inv = addItem(inv, slot.itemId, slot.count).inventory;
    restoredNames.push(slot.itemId);
  }
  return {
    ok: true,
    state: {
      ...state,
      inventory: inv,
      prison: {
        ...state.prison,
        confiscatedItems: [],
        lockerRecovered: true,
      },
    },
    message: `Recovered all confiscated items (${restoredNames.length} stacks) from the Evidence Locker!`,
  };
}

/**
 * Attacks a patrolling Stronghold Aura Shade guard. Drops Condensed Aura Shards on knockout.
 */
export function attackStrongholdGuard(
  state: SurvivalState,
  guardId: string,
  damage: number
): { hit: boolean; knockedOut: boolean; state: SurvivalState; message: string } {
  const idx = state.stronghold.guards.findIndex((g) => g.id === guardId);
  if (idx < 0) return { hit: false, knockedOut: false, state, message: 'No guard nearby.' };

  const g = state.stronghold.guards[idx];
  if (g.hp <= 0) return { hit: false, knockedOut: false, state, message: 'Guard already incapacitated.' };

  const nextHp = Math.max(0, g.hp - Math.max(1, Math.round(damage)));
  const knockedOut = nextHp <= 0;
  const nextGuards = [...state.stronghold.guards];
  nextGuards[idx] = {
    ...g,
    hp: nextHp,
    alert: 100,
    downedUntilHour: knockedOut ? state.clock.totalHours + AURA_AI_TUNING.PATROL_RESPAWN_HOURS : null,
  };

  let inv = state.inventory;
  if (knockedOut) {
    inv = addItem(inv, 'aura_shard', 1).inventory;
  }

  return {
    hit: true,
    knockedOut,
    state: {
      ...state,
      inventory: inv,
      stronghold: {
        ...state.stronghold,
        alertLevel: Math.min(100, state.stronghold.alertLevel + (knockedOut ? 22 : 12)),
        guards: nextGuards,
      },
      auraKingAI: {
        ...state.auraKingAI,
        suspicion: Math.min(100, state.auraKingAI.suspicion + 26),
        awareness: state.auraKingAI.suspicion + 26 >= 70 ? 'hunting' : 'suspicious',
        lastKnownPlayerPos: { x: state.player.x, z: state.player.z },
        huntTimerSec: 22,
      },
    },
    message: knockedOut
      ? 'Banished Stronghold Aura Sentinel! Looted +1x Condensed Aura Shard.'
      : `Struck Aura Sentinel (${nextHp}/${g.maxHp} HP)!`,
  };
}

/**
 * Autonomous island & Stronghold AI tick:
 * updates patrols, stealth awareness/suspicion, and triggers prison capture if caught.
 */
export function tickAuraKingAI(
  state: SurvivalState,
  dtSec: number,
  opts: { stance: PlayerStance; hasActiveFireNearby: boolean; gameHoursDelta: number }
): { state: SurvivalState; caughtNow: boolean; alertMessage: string | null } {
  if (dtSec <= 0 || state.escapedCity || state.voyage.phase === 'sailing') {
    return { state, caughtNow: false, alertMessage: null };
  }

  // If currently in prison cell, simply advance wait hours and patrol outside
  if (state.prison.inPrison) {
    return {
      state: {
        ...state,
        prison: {
          ...state.prison,
          escapeHoursElapsed: state.prison.escapeHoursElapsed + opts.gameHoursDelta,
        },
      },
      caughtNow: false,
      alertMessage: null,
    };
  }

  const ai = state.auraKingAI;
  const px = state.player.x;
  const pz = state.player.z;
  const visibility = computeStealthVisibility(state, opts.stance, opts.hasActiveFireNearby);
  const stolenHeat =
    (state.stronghold.stolenRifle ? 1 : 0) + (state.stronghold.stolenHarpoon ? 1 : 0);

  // Move Stronghold Guards & check guard vision cones
  let guardSawPlayer = false;
  const nextGuards: AuraGuardState[] = state.stronghold.guards.map((g, gi) => {
    if (g.hp <= 0) {
      if (g.downedUntilHour !== null && state.clock.totalHours >= g.downedUntilHour) {
        return { ...g, hp: g.maxHp, downedUntilHour: null, alert: 0 };
      }
      return g;
    }
    const phaseT = 0.5 + 0.5 * Math.sin(state.clock.totalHours * 0.75 + gi * 2.1);
    const gx = g.patrolA.x + (g.patrolB.x - g.patrolA.x) * phaseT;
    const gz = g.patrolA.z + (g.patrolB.z - g.patrolA.z) * phaseT;
    const gYaw = Math.atan2(g.patrolB.x - g.patrolA.x, g.patrolB.z - g.patrolA.z) + (Math.cos(state.clock.totalHours * 0.75 + gi * 2.1) < 0 ? Math.PI : 0);
    const dPlayer = Math.hypot(px - gx, pz - gz);
    const effectiveRange = AURA_AI_TUNING.GUARD_VISION_RANGE_M * visibility;
    let gAlert = Math.max(0, g.alert - dtSec * 8);

    if (dPlayer < effectiveRange) {
      const toPx = (px - gx) / Math.max(0.01, dPlayer);
      const toPz = (pz - gz) / Math.max(0.01, dPlayer);
      const fwdX = Math.sin(gYaw);
      const fwdZ = Math.cos(gYaw);
      const dot = toPx * fwdX + toPz * fwdZ;
      if (dot >= AURA_AI_TUNING.GUARD_VISION_FOV_COS || dPlayer < 3.8 * visibility) {
        guardSawPlayer = true;
        gAlert = Math.min(100, gAlert + dtSec * (45 / Math.max(0.35, dPlayer * 0.14)));
      }
    }
    return { ...g, x: gx, z: gz, yaw: gYaw, alert: gAlert };
  });

  // Update Aura King autonomous patrol vs hunt vector
  const waypoints = AURA_AI_TUNING.PATROL_WAYPOINTS;
  let patIdx = ai.patrolIndex % waypoints.length;
  const targetWp =
    ai.awareness === 'hunting' && ai.lastKnownPlayerPos
      ? ai.lastKnownPlayerPos
      : waypoints[patIdx];

  const dx = targetWp.x - ai.x;
  const dz = targetWp.z - ai.z;
  const distToTarget = Math.hypot(dx, dz);
  const moveSpeed =
    ai.awareness === 'hunting' || stolenHeat > 0
      ? AURA_AI_TUNING.HUNT_SPEED_MPS
      : AURA_AI_TUNING.PATROL_SPEED_MPS;

  let nextX = ai.x;
  let nextZ = ai.z;
  let nextYaw = ai.yaw;
  if (distToTarget > 1.5) {
    const step = Math.min(distToTarget, moveSpeed * dtSec);
    nextX += (dx / distToTarget) * step;
    nextZ += (dz / distToTarget) * step;
    nextYaw = Math.atan2(dx, dz);
  } else if (ai.awareness !== 'hunting') {
    patIdx = (patIdx + 1) % waypoints.length;
  }

  const distKingPlayer = Math.hypot(px - nextX, pz - nextZ);
  const detectRange =
    AURA_AI_TUNING.BASE_DETECT_RADIUS_M *
    visibility *
    (1 + stolenHeat * 0.25);

  let suspicion = ai.suspicion;
  let huntTimer = Math.max(0, ai.huntTimerSec - dtSec);
  let lastKnown = ai.lastKnownPlayerPos;

  if (guardSawPlayer || distKingPlayer < detectRange) {
    const gainRate =
      (guardSawPlayer ? 28 : 0) +
      (distKingPlayer < detectRange ? 42 * (1 - distKingPlayer / (detectRange + 2)) : 0);
    suspicion = Math.min(100, suspicion + gainRate * dtSec);
    lastKnown = { x: px, z: pz };
    if (suspicion >= 70) {
      huntTimer = Math.max(huntTimer, 18);
    }
  } else if (huntTimer <= 0) {
    suspicion = Math.max(stolenHeat > 0 ? 20 : 0, suspicion - dtSec * 6.5);
  }

  const maxGuardAlert = nextGuards.reduce((m, g) => Math.max(m, g.alert), 0);
  const insideStronghold =
    Math.hypot(px - PRISON_TUNING.STRONGHOLD_POS.x, pz - PRISON_TUNING.STRONGHOLD_POS.z) < 22;

  const catchingNow =
    (suspicion >= 96 && distKingPlayer <= AURA_AI_TUNING.CATCH_RADIUS_M + 1.8) ||
    (maxGuardAlert >= 98 && insideStronghold);

  const awareness =
    catchingNow
      ? 'catching'
      : suspicion >= 68 || huntTimer > 0
        ? 'hunting'
        : suspicion >= 28
          ? 'suspicious'
          : 'unaware';

  let alertMessage: string | null = null;
  if (awareness === 'hunting' && ai.awareness !== 'hunting') {
    alertMessage = 'WARNING: The Aura King sensed your presence and is hunting your trail!';
  } else if (awareness === 'suspicious' && ai.awareness === 'unaware') {
    alertMessage = 'Aura Shadows stir nearby — crouch or stay out of open light.';
  }

  const highAlertActive =
    state.stronghold.highAlertUntilHour !== null &&
    state.clock.totalHours < state.stronghold.highAlertUntilHour;

  let nextState: SurvivalState = {
    ...state,
    stronghold: {
      ...state.stronghold,
      alertLevel: highAlertActive
        ? Math.max(60, state.stronghold.alertLevel)
        : Math.max(0, state.stronghold.alertLevel - dtSec * 2.5),
      guards: nextGuards,
    },
    auraKingAI: {
      ...ai,
      x: nextX,
      z: nextZ,
      yaw: nextYaw,
      patrolIndex: patIdx,
      suspicion,
      awareness,
      lastKnownPlayerPos: lastKnown,
      huntTimerSec: huntTimer,
      lastSightingHour: distKingPlayer < 45 ? state.clock.totalHours : ai.lastSightingHour,
    },
  };

  // Capture player cleanly into Stronghold Dungeon if caught (unless Final Sea Chase is active)
  let caughtNow = false;
  if (catchingNow && state.storyPhase !== 'final_boat_chase') {
    nextState = capturePlayerToPrison(nextState);
    caughtNow = true;
    alertMessage = 'CAPTURED by the Aura King’s Stronghold patrol and thrown in the Dungeon!';
  }

  return { state: nextState, caughtNow, alertMessage };
}
