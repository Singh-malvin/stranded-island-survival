/**
 * Pure simulation for Daniel (Cave Survivor Companion):
 * discovery, medical treatment, trust consequences, Command Wheel orders,
 * terrain-safe autonomous AI, gathering/building/combat help, and downed revive.
 * No Three.js or React imports.
 */

import { COMPANION_TUNING, PRISON_TUNING, WORLD } from './config.ts';
import { addItem, countItem, ITEM_DEFS, removeItem } from './items.ts';
import type {
  DanielCommand,
  DanielState,
  ItemId,
  JournalEntry,
  SurvivalState,
} from './types.ts';
import { sampleIslandHeight } from './world.ts';

export type DanielTreatAction = 'feed' | 'water' | 'heal' | 'talk' | 'neglect' | 'harm';

const FEED_PRIORITY: ItemId[] = [
  'ration_bar',
  'cooked_meat',
  'cooked_fish',
  'dried_meat',
  'dried_fish',
  'berries',
  'coconut',
];

const HEAL_PRIORITY: ItemId[] = ['medicinal_poultice', 'herb'];

const GATHER_DROPS: ItemId[] = ['stick', 'stone', 'fibre', 'flint', 'berries'];

export function createInitialDanielState(): DanielState {
  const { x, z } = COMPANION_TUNING.SPAWN_POS;
  const y = sampleIslandHeight(x, z, WORLD.ISLAND_RADIUS);
  return {
    found: false,
    trust: COMPANION_TUNING.START_TRUST,
    treatsGiven: 0,
    neglectedCount: 0,
    health: 58,
    maxHealth: COMPANION_TUNING.MAX_HEALTH,
    hunger: 38,
    thirst: 34,
    downed: false,
    command: 'wait',
    targetPos: null,
    guardCenter: null,
    x,
    y,
    z,
    yaw: 0.4,
    moodText: 'Keep back... stay low near the rocks.',
    loreUnlockedTier: 0,
    inRescueCooldownSec: 0,
  };
}

export function normalizeDanielState(raw?: Partial<DanielState> | null): DanielState {
  const base = createInitialDanielState();
  if (!raw || typeof raw !== 'object') return base;
  const trust = Math.max(0, Math.min(100, Number(raw.trust ?? base.trust)));
  return {
    ...base,
    ...raw,
    trust,
    treatsGiven: Math.max(0, Number(raw.treatsGiven ?? 0)),
    neglectedCount: Math.max(0, Number(raw.neglectedCount ?? 0)),
    health: Math.max(0, Math.min(base.maxHealth, Number(raw.health ?? base.health))),
    maxHealth: base.maxHealth,
    hunger: Math.max(0, Math.min(100, Number(raw.hunger ?? base.hunger))),
    thirst: Math.max(0, Math.min(100, Number(raw.thirst ?? base.thirst))),
    downed: Boolean(raw.downed),
    command: raw.command ?? 'wait',
    loreUnlockedTier: Math.max(0, Math.min(4, Number(raw.loreUnlockedTier ?? Math.floor(trust / 25)))),
    inRescueCooldownSec: Math.max(0, Number(raw.inRescueCooldownSec ?? 0)),
  };
}

function clampTrust(val: number): number {
  return Math.max(0, Math.min(100, Math.round(val)));
}

function appendJournalEntry(
  entries: JournalEntry[],
  entry: JournalEntry
): JournalEntry[] {
  if (entries.some((e) => e.id === entry.id)) return entries;
  return [...entries, entry];
}

export function getDanielTrustLabel(trust: number): string {
  if (trust >= 80) return 'Steadfast Ally';
  if (trust >= 60) return 'Trusted Partner';
  if (trust >= 40) return 'Guarded Ally';
  if (trust >= 20) return 'Wary Survivor';
  return 'Distrustful';
}

export function getDanielSharedLore(loreTier: number): string[] {
  const lines: string[] = [];
  if (loreTier >= 1) {
    lines.push(
      'Daniel: "I washed up two weeks ago before your Flight 404 went down. Stay out of open ground when clouds thicken — the Aura King watches from the ridges."'
    );
  }
  if (loreTier >= 2) {
    lines.push(
      'Daniel: "Crouching or crawling through ferns hides you, especially at night or during squalls — but lit campfires near the Stronghold draw him like a moth."'
    );
  }
  if (loreTier >= 3) {
    lines.push(
      'Daniel: "Inside the Caldera Stronghold up north he hoards an Aura-Infused Rifle and Harpoon Gun. If you get thrown in his dungeon cell, feel the cracked vent near the west wall."'
    );
  }
  if (loreTier >= 4) {
    lines.push(
      'Daniel: "I know offshore navigation. Build the hull with me on [G] Help Build — I’ll cut assembly work fast and take the helm through the storm reef."'
    );
  }
  return lines;
}

/**
 * First meeting inside Western Basalt Caves (`found: false -> true`).
 * Does NOT force the player into a fixed quest; lets the player decide how to treat him.
 */
export function discoverDaniel(state: SurvivalState): {
  state: SurvivalState;
  newlyFound: boolean;
  message: string;
} {
  if (state.companion.found) {
    return {
      state,
      newlyFound: false,
      message: state.companion.moodText ?? 'Daniel nods toward the cave mouth.',
    };
  }

  const nextStory =
    state.storyPhase === 'alone' ? 'found_daniel' : state.storyPhase;
  const entry: JournalEntry = {
    id: 'daniel_discovered',
    category: 'daniel',
    title: 'Found Another Survivor: Daniel',
    detail:
      'Met an injured survivor sheltering deep inside the Western Basalt Caves. He is wary and hurt — you can share food, clean water, or poultices to earn his trust, or leave him to fend for himself.',
    day: state.clock.day,
  };

  return {
    state: {
      ...state,
      storyPhase: nextStory,
      companion: {
        ...state.companion,
        found: true,
        command: 'wait',
        moodText: 'Easy! Keep your weapon down... who are you? Did you survive the crash too?',
      },
      journalEntries: appendJournalEntry(state.journalEntries, entry),
    },
    newlyFound: true,
    message:
      'Found Daniel injured inside the cave! Share food, clean water, or poultice with [E] — or leave him.',
  };
}

/**
 * Treats, feeds, talks with, neglects, or antagonizes Daniel.
 * Decisions alter Trust, lore sharing, work efficiency, and dungeon rescue willingness.
 */
export function treatDaniel(
  state: SurvivalState,
  action: DanielTreatAction
): { ok: boolean; state: SurvivalState; message: string } {
  const base = state.companion.found ? state : discoverDaniel(state).state;
  const d = base.companion;

  if (action === 'feed') {
    const foodId = FEED_PRIORITY.find((id) => countItem(base.inventory, id) > 0);
    if (!foodId) {
      return { ok: false, state: base, message: 'No food rations, berries, coconut, or meat to share with Daniel.' };
    }
    const rem = removeItem(base.inventory, foodId, 1);
    if (!rem.success) return { ok: false, state: base, message: 'No food available.' };
    const nextTrust = clampTrust(d.trust + COMPANION_TUNING.TRUST_FEED_DELTA);
    const nextLore = Math.max(d.loreUnlockedTier, Math.min(4, Math.floor(nextTrust / 22)));
    return {
      ok: true,
      state: {
        ...base,
        inventory: rem.inventory,
        companion: {
          ...d,
          trust: nextTrust,
          treatsGiven: d.treatsGiven + 1,
          hunger: Math.min(100, d.hunger + 36),
          health: Math.min(d.maxHealth, d.health + 14),
          loreUnlockedTier: nextLore,
          moodText: `Thanks... sharing ${ITEM_DEFS[foodId].name} saved my strength.`,
        },
      },
      message: `Shared ${ITEM_DEFS[foodId].name} with Daniel (+${COMPANION_TUNING.TRUST_FEED_DELTA} Trust -> ${nextTrust}).`,
    };
  }

  if (action === 'water') {
    if (countItem(base.inventory, 'water_bottle_clean') < 1) {
      return { ok: false, state: base, message: 'Need Clean Water Bottle to hydrate Daniel.' };
    }
    const rem = removeItem(base.inventory, 'water_bottle_clean', 1);
    if (!rem.success) return { ok: false, state: base, message: 'No clean water bottle.' };
    const ret = addItem(rem.inventory, 'empty_bottle', 1);
    const nextTrust = clampTrust(d.trust + COMPANION_TUNING.TRUST_WATER_DELTA);
    const nextLore = Math.max(d.loreUnlockedTier, Math.min(4, Math.floor(nextTrust / 22)));
    return {
      ok: true,
      state: {
        ...base,
        inventory: ret.inventory,
        companion: {
          ...d,
          trust: nextTrust,
          treatsGiven: d.treatsGiven + 1,
          thirst: Math.min(100, d.thirst + 42),
          health: Math.min(d.maxHealth, d.health + 8),
          loreUnlockedTier: nextLore,
          moodText: 'Clean water... I was rationing rainwater off basalt drips.',
        },
      },
      message: `Gave Clean Water to Daniel (+${COMPANION_TUNING.TRUST_WATER_DELTA} Trust -> ${nextTrust}).`,
    };
  }

  if (action === 'heal') {
    const healId = HEAL_PRIORITY.find((id) => countItem(base.inventory, id) > 0);
    if (!healId) {
      return { ok: false, state: base, message: 'Need Medicinal Poultice or Healing Herb to tend Daniel’s wounds.' };
    }
    const rem = removeItem(base.inventory, healId, 1);
    if (!rem.success) return { ok: false, state: base, message: 'No medical item found.' };
    const hpGain = healId === 'medicinal_poultice' ? 48 : 22;
    const trustGain =
      healId === 'medicinal_poultice'
        ? COMPANION_TUNING.TRUST_HEAL_DELTA
        : Math.round(COMPANION_TUNING.TRUST_HEAL_DELTA * 0.6);
    const nextTrust = clampTrust(d.trust + trustGain);
    const nextLore = Math.max(d.loreUnlockedTier, Math.min(4, Math.floor(nextTrust / 22)));
    return {
      ok: true,
      state: {
        ...base,
        inventory: rem.inventory,
        companion: {
          ...d,
          trust: nextTrust,
          treatsGiven: d.treatsGiven + 1,
          health: Math.min(d.maxHealth, d.health + hpGain),
          downed: false,
          loreUnlockedTier: nextLore,
          moodText: 'That dressing helps a lot — I can finally walk and swing a tool again.',
        },
        journalEntries: appendJournalEntry(base.journalEntries, {
          id: 'daniel_treated',
          category: 'daniel',
          title: 'Tended Daniel’s Cave Wounds',
          detail:
            'Bandaged Daniel and earned his confidence. Hold [G] to open the Companion Command Wheel.',
          day: base.clock.day,
        }),
      },
      message: `Tended Daniel with ${ITEM_DEFS[healId].name} (+${trustGain} Trust -> ${nextTrust}). Hold [G] to command him!`,
    };
  }

  if (action === 'talk') {
    const nextTrust = clampTrust(d.trust + COMPANION_TUNING.TRUST_TALK_DELTA);
    const nextLore = Math.max(d.loreUnlockedTier, Math.min(4, Math.floor(nextTrust / 20)));
    const lore = getDanielSharedLore(nextLore);
    const spoken =
      lore.length > 0
        ? lore[lore.length - 1]
        : 'Daniel: "I barely got away from the northern caldera walls. Prove I can count on you and I’ll watch your back."';

    const journal =
      nextLore >= 3
        ? appendJournalEntry(base.journalEntries, {
            id: 'daniel_intel_stronghold',
            category: 'heist',
            title: 'Daniel’s Stronghold & Dungeon Intel',
            detail:
              'Daniel revealed that the Northern Caldera Stronghold houses stolen weapons (Aura Rifle & Harpoon Gun) plus a weak west-wall basalt vent in its dungeon cell.',
            day: base.clock.day,
          })
        : base.journalEntries;

    return {
      ok: true,
      state: {
        ...base,
        companion: {
          ...d,
          trust: nextTrust,
          loreUnlockedTier: nextLore,
          moodText: spoken,
          command: d.treatsGiven > 0 && d.command === 'wait' && nextTrust >= 38 ? 'follow' : d.command,
        },
        journalEntries: journal,
      },
      message: spoken,
    };
  }

  if (action === 'neglect' || action === 'harm') {
    const delta =
      action === 'harm' ? COMPANION_TUNING.TRUST_HARM_DELTA : COMPANION_TUNING.TRUST_NEGLECT_DELTA;
    const nextTrust = clampTrust(d.trust + delta);
    const nextLore = Math.min(d.loreUnlockedTier, Math.floor(nextTrust / 25));
    return {
      ok: true,
      state: {
        ...base,
        companion: {
          ...d,
          trust: nextTrust,
          neglectedCount: d.neglectedCount + 1,
          loreUnlockedTier: nextLore,
          command: nextTrust < 25 ? 'wait' : d.command,
          moodText:
            action === 'harm'
              ? 'Watch it! Try that again and you’re on your own out here!'
              : 'Yeah... figure it’s every survivor for themselves.',
        },
      },
      message:
        action === 'harm'
          ? `Daniel recoils in anger (${delta} Trust -> ${nextTrust}).`
          : `Left Daniel unattended (${delta} Trust -> ${nextTrust}).`,
    };
  }

  return { ok: false, state: base, message: 'Unknown companion action.' };
}

/**
 * Applies Command Wheel orders ([G] held) with real trust/downed consequences.
 */
export function issueDanielCommand(
  state: SurvivalState,
  command: DanielCommand,
  targetPos?: { x: number; z: number } | null
): { ok: boolean; state: SurvivalState; message: string } {
  const d = state.companion;
  if (!d.found) {
    return { ok: false, state, message: 'You have not found another survivor yet.' };
  }
  if (d.downed) {
    return { ok: false, state, message: 'Daniel is downed — revive him with [E] first!' };
  }
  if ((command === 'attack' || command === 'guard') && d.trust < 35) {
    return {
      ok: false,
      state: {
        ...state,
        companion: {
          ...d,
          moodText: 'I barely know you — tend my wounds or share food before sending me into a fight!',
        },
      },
      message: 'Daniel refuses risky combat orders until Trust >= 35.',
    };
  }
  if (command === 'build' && d.trust < 28) {
    return {
      ok: false,
      state: {
        ...state,
        companion: {
          ...d,
          moodText: 'Why help you build an escape hull when you haven’t shown I can trust you?',
        },
      },
      message: 'Daniel refuses heavy build duty until Trust >= 28.',
    };
  }

  const resolvedTarget =
    command === 'build'
      ? { x: WORLD.BOAT_DOCK_POS.x + 2.4, z: WORLD.BOAT_DOCK_POS.z - 1.5 }
      : command === 'goto' && targetPos
        ? targetPos
        : command === 'guard'
          ? targetPos ?? { x: state.player.x, z: state.player.z }
          : null;

  const cmdLabel: Record<DanielCommand, string> = {
    follow: 'Daniel is falling in behind you.',
    wait: 'Daniel will hold position here.',
    gather: 'Daniel is scavenging nearby branches, flint, stone, and berries.',
    guard: 'Daniel is sweeping the perimeter for wildlife and Aura Shades.',
    build: 'Daniel is heading to the Boat Slipway Dock to speed up construction.',
    attack: 'Daniel is moving aggressively on nearby threats!',
    goto: 'Daniel is moving toward your pinged location.',
  };

  return {
    ok: true,
    state: {
      ...state,
      companion: {
        ...d,
        command,
        targetPos: resolvedTarget,
        guardCenter: command === 'guard' ? resolvedTarget : d.guardCenter,
        moodText: cmdLabel[command],
      },
    },
    message: cmdLabel[command],
  };
}

/**
 * Non-permanent downed damage handler: at 0 HP Daniel drops injured until revived.
 */
export function damageDaniel(state: SurvivalState, rawDmg: number): SurvivalState {
  const d = state.companion;
  if (!d.found || d.downed || rawDmg <= 0) return state;
  const nextHp = Math.max(0, d.health - rawDmg);
  const nowDowned = nextHp <= 0;
  return {
    ...state,
    companion: {
      ...d,
      health: nextHp,
      downed: nowDowned,
      moodText: nowDowned ? 'I’m down—help me up!' : d.moodText,
    },
  };
}

/**
 * Revives downed Daniel ([E]), permanently forgiving past panic and lifting trust.
 */
export function reviveDaniel(state: SurvivalState): {
  ok: boolean;
  state: SurvivalState;
  message: string;
} {
  const d = state.companion;
  if (!d.found || !d.downed) {
    return { ok: false, state, message: 'Daniel does not need revival.' };
  }
  const hasPoultice = countItem(state.inventory, 'medicinal_poultice') > 0;
  let inv = state.inventory;
  if (hasPoultice) {
    inv = removeItem(inv, 'medicinal_poultice', 1).inventory;
  }
  const nextTrust = clampTrust(d.trust + (hasPoultice ? 16 : 10));
  return {
    ok: true,
    state: {
      ...state,
      inventory: inv,
      companion: {
        ...d,
        downed: false,
        health: hasPoultice ? 72 : 42,
        trust: nextTrust,
        moodText: 'Owe you my life again... let’s keep moving.',
      },
    },
    message: hasPoultice
      ? `Revived Daniel with Poultice (+16 Trust -> ${nextTrust}).`
      : `Helped Daniel back to his feet (+10 Trust -> ${nextTrust}).`,
  };
}

export interface DanielTickResult {
  state: SurvivalState;
  gatheredNote: string | null;
  warningNote: string | null;
}

/**
 * Pure simulation update for Daniel AI:
 * movement/terrain/hazard avoidance, passive needs, self-eating, gather ticks, and danger warnings.
 */
export function tickDanielSimulation(
  state: SurvivalState,
  dtSec: number,
  options: { gameHoursDelta: number; gatherAccumSec?: number } = { gameHoursDelta: 0 }
): DanielTickResult {
  const d = state.companion;
  if (!d.found || dtSec <= 0) {
    return { state, gatheredNote: null, warningNote: null };
  }

  // Drain hunger & thirst gently; if player isn't feeding him and he has scraps, he forages small berries to survive
  let hunger = Math.max(5, d.hunger - COMPANION_TUNING.HUNGER_DRAIN_PER_HOUR * options.gameHoursDelta);
  let thirst = Math.max(5, d.thirst - COMPANION_TUNING.THIRST_DRAIN_PER_HOUR * options.gameHoursDelta);
  let health = d.health;
  if (hunger < 18) {
    hunger += 14; // forages wild roots/berries autonomously so he feels self-reliant
  }
  if (!d.downed && hunger > 50 && thirst > 45 && health < d.maxHealth) {
    health = Math.min(d.maxHealth, health + dtSec * 0.45);
  }

  let nextX = d.x;
  let nextZ = d.z;
  let nextYaw = d.yaw;

  if (!d.downed) {
    let goalX = d.x;
    let goalZ = d.z;
    let stopDist = 0.6;
    let speed: number = COMPANION_TUNING.WALK_SPEED_MPS;

    if (state.prison.inPrison && d.trust >= COMPANION_TUNING.RESCUE_TRUST_THRESHOLD) {
      // Moves stealthily toward outer wall of stronghold dungeon to prep jailbreak
      goalX = PRISON_TUNING.VENT_EXIT_WORLD_POS.x + 1.5;
      goalZ = PRISON_TUNING.VENT_EXIT_WORLD_POS.z + 1.5;
      speed = COMPANION_TUNING.RUN_SPEED_MPS;
    } else if (state.storyPhase === 'final_boat_chase' || state.voyage.phase === 'sailing') {
      // On deck helm position during Boat #2 final chase!
      goalX = state.player.x;
      goalZ = state.player.z - 1.8;
    } else if (d.command === 'follow') {
      goalX = state.player.x - Math.sin(state.player.yaw) * 2.2 + Math.cos(state.player.yaw) * 1.4;
      goalZ = state.player.z - Math.cos(state.player.yaw) * 2.2 - Math.sin(state.player.yaw) * 1.4;
      stopDist = 1.2;
      const distP = Math.hypot(goalX - d.x, goalZ - d.z);
      if (distP > COMPANION_TUNING.FOLLOW_MAX_TELEPORT_M && !state.prison.inPrison) {
        // Safely catch up if player fast-traveled or jumped down ridge
        const hCatch = sampleIslandHeight(goalX, goalZ, WORLD.ISLAND_RADIUS);
        if (hCatch > 0.35) {
          nextX = goalX;
          nextZ = goalZ;
        }
      } else if (distP > 8.5) {
        speed = COMPANION_TUNING.RUN_SPEED_MPS;
      }
    } else if ((d.command === 'goto' || d.command === 'build') && d.targetPos) {
      goalX = d.targetPos.x;
      goalZ = d.targetPos.z;
      speed = COMPANION_TUNING.RUN_SPEED_MPS * 0.85;
    } else if (d.command === 'guard' && (d.guardCenter || d.targetPos)) {
      const c = d.guardCenter ?? d.targetPos!;
      const patrolT = state.clock.totalHours * 0.9;
      goalX = c.x + Math.cos(patrolT) * 4.5;
      goalZ = c.z + Math.sin(patrolT) * 4.5;
    } else if (d.command === 'gather') {
      const gatherT = state.clock.totalHours * 1.2;
      goalX = state.player.x + Math.cos(gatherT) * 8.0;
      goalZ = state.player.z + Math.sin(gatherT) * 8.0;
    } else if (d.command === 'attack') {
      const guard = state.stronghold.guards.find((g) => g.hp > 0 && Math.hypot(g.x - d.x, g.z - d.z) < 28);
      if (guard) {
        goalX = guard.x;
        goalZ = guard.z;
        stopDist = 2.0;
        speed = COMPANION_TUNING.RUN_SPEED_MPS;
      }
    }

    const dx = goalX - nextX;
    const dz = goalZ - nextZ;
    const dist = Math.hypot(dx, dz);
    if (dist > stopDist) {
      const step = Math.min(dist - stopDist, speed * dtSec);
      const candX = nextX + (dx / dist) * step;
      const candZ = nextZ + (dz / dist) * step;
      const candH = sampleIslandHeight(candX, candZ, WORLD.ISLAND_RADIUS);
      const curH = sampleIslandHeight(nextX, nextZ, WORLD.ISLAND_RADIUS);
      // Avoid deep ocean (> 0.15m minimum beach wade) and shear cliffs (> 1.8m instantaneous jump)
      if (candH > 0.15 && Math.abs(candH - curH) < 2.2) {
        nextX = candX;
        nextZ = candZ;
      } else {
        // Strafe sidestep along contour
        const sideX = nextX + (-dz / dist) * step * 0.8;
        const sideZ = nextZ + (dx / dist) * step * 0.8;
        if (sampleIslandHeight(sideX, sideZ, WORLD.ISLAND_RADIUS) > 0.25) {
          nextX = sideX;
          nextZ = sideZ;
        }
      }
      nextYaw = Math.atan2(dx, dz);
    }
  }

  let nextInventory = state.inventory;
  let gatheredNote: string | null = null;
  if (
    !d.downed &&
    d.command === 'gather' &&
    options.gatherAccumSec &&
    options.gatherAccumSec >= COMPANION_TUNING.GATHER_INTERVAL_SEC
  ) {
    const idx = Math.floor(state.clock.totalHours * 10 + state.stats.itemsGathered) % GATHER_DROPS.length;
    const drop = GATHER_DROPS[idx];
    const added = addItem(nextInventory, drop, 1);
    if (added.added > 0) {
      nextInventory = added.inventory;
      gatheredNote = `Daniel scavenged +1 ${ITEM_DEFS[drop].name}`;
    }
  }

  let warningNote: string | null = null;
  if (state.auraKingAI.awareness === 'hunting' && d.trust >= 35) {
    warningNote = 'Daniel: "Get down! The Aura King is sweeping toward us!"';
  } else if (state.weather.kind === 'storm' && d.command === 'follow') {
    warningNote = 'Daniel: "Storm squall rolling in — good cover for sneaking near the Stronghold."';
  }

  const nextY = sampleIslandHeight(nextX, nextZ, WORLD.ISLAND_RADIUS);
  const rescueCd = Math.max(0, d.inRescueCooldownSec - dtSec);

  return {
    state: {
      ...state,
      inventory: nextInventory,
      companion: {
        ...d,
        health,
        hunger,
        thirst,
        x: nextX,
        y: nextY,
        z: nextZ,
        yaw: nextYaw,
        inRescueCooldownSec: rescueCd,
      },
    },
    gatheredNote,
    warningNote,
  };
}
