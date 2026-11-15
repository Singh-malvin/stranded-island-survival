// Versioned save/load persistence, Stage 2 migration, autosave stamps,
// and sleeping in a shelter bed (advance night, heal, update respawn point, save).

import { INVENTORY, NEEDS, SAVE, TEMPERATURE, TIME, WORLD } from './config.ts';
import { createInitialBossState, normalizeBossState } from './boss.ts';
import { tickNodeRespawns } from './gathering.ts';
import { stepWeather } from './needs.ts';
import { tickStructuresProduction } from './structures.ts';
import type { PlacedShelter, SaveKind, SurvivalState } from './types.ts';
import { createInitialBoatState, createInitialVoyageState } from './voyage.ts';
import { generateInitialWildlife } from './wildlife.ts';
import { revealMapAround, sampleIslandHeight } from './world.ts';

function getStorage(explicit?: Storage): Storage | null {
  if (explicit) return explicit;
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
      return globalThis.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

export function stampSavedState(
  state: SurvivalState,
  kind: SaveKind,
  nowMs: number = Date.now()
): SurvivalState {
  return {
    ...state,
    lastSavedAt: nowMs,
    lastSaveKind: kind,
  };
}

export function serializeSave(
  state: SurvivalState,
  kind: SaveKind = state.lastSaveKind ?? 'autosave',
  nowMs: number = Date.now()
): string {
  return JSON.stringify(stampSavedState(state, kind, nowMs));
}

export function parseAndMigrateSave(rawJson: string): SurvivalState | null {
  try {
    const parsed = JSON.parse(rawJson) as Partial<SurvivalState> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.needs || !Array.isArray(parsed.inventory) || !parsed.clock) return null;

    const paddedInventory = Array.from({ length: INVENTORY.SLOTS }, (_, i) =>
      i < parsed.inventory!.length ? parsed.inventory![i] ?? null : null
    );

    const player = parsed.player ?? {
      x: WORLD.PLAYER_SPAWN.x,
      y: Math.max(0.5, sampleIslandHeight(WORLD.PLAYER_SPAWN.x, WORLD.PLAYER_SPAWN.z)),
      z: WORLD.PLAYER_SPAWN.z,
      yaw: 0,
    };

    const spawnPoint = parsed.spawnPoint ?? { ...player };

    const discoveredCells =
      Array.isArray(parsed.discoveredCells) && parsed.discoveredCells.length > 0
        ? parsed.discoveredCells
        : revealMapAround([], player.x, player.z);

    const savedVersion = typeof parsed.version === 'number' ? parsed.version : 1;
    const rawTemp = Number(parsed.needs.temperature ?? TEMPERATURE.NORMAL_BODY_C);
    const saveDay = Number(parsed.clock.day ?? 1);
    const migratedTemp =
      savedVersion < SAVE.VERSION || !Number.isFinite(rawTemp)
        ? TEMPERATURE.NORMAL_BODY_C
        : saveDay <= 1
          ? Math.max(TEMPERATURE.DAY1_MIN_BODY_C, Math.min(TEMPERATURE.MAX_BODY_C, rawTemp))
          : Math.max(TEMPERATURE.MIN_BODY_C, Math.min(TEMPERATURE.MAX_BODY_C, rawTemp));

    return {
      version: SAVE.VERSION,
      act: parsed.act ?? 1,
      difficulty: parsed.difficulty === 'hardcore' ? 'hardcore' : 'survivor',
      needs: {
        health: Number(parsed.needs.health ?? NEEDS.START.health),
        hunger: Number(parsed.needs.hunger ?? NEEDS.START.hunger),
        thirst: Number(parsed.needs.thirst ?? NEEDS.START.thirst),
        stamina: Number(parsed.needs.stamina ?? NEEDS.START.stamina),
        temperature: migratedTemp,
        wetness: Number(parsed.needs.wetness ?? 0),
        sickness: Number(parsed.needs.sickness ?? 0),
      },
      alive: parsed.alive !== false,
      inventory: paddedInventory,
      selectedSlot:
        typeof parsed.selectedSlot === 'number'
          ? Math.max(0, Math.min(INVENTORY.HOTBAR_SIZE - 1, parsed.selectedSlot))
          : 0,
      clock: {
        day: Number(parsed.clock.day ?? 1),
        hour: Number(parsed.clock.hour ?? TIME.START_HOUR),
        totalHours: Number(parsed.clock.totalHours ?? 0),
      },
      weather: parsed.weather ?? { kind: 'clear', rain: 0, wind: 0.15 },
      nodes: parsed.nodes && typeof parsed.nodes === 'object' ? parsed.nodes : {},
      campfires: Array.isArray(parsed.campfires) ? parsed.campfires : [],
      shelters: Array.isArray(parsed.shelters) ? parsed.shelters : [],
      structures: Array.isArray(parsed.structures) ? parsed.structures : [],
      cluesFound: Array.isArray(parsed.cluesFound) ? parsed.cluesFound : [],
      unlockedGates: Array.isArray(parsed.unlockedGates) ? parsed.unlockedGates : [],
      stationRepairs: parsed.stationRepairs
        ? {
            radio: Boolean(parsed.stationRepairs.radio),
            generator: Boolean(parsed.stationRepairs.generator),
            chart: Boolean(parsed.stationRepairs.chart),
          }
        : { radio: false, generator: false, chart: false },
      wildlife:
        Array.isArray(parsed.wildlife) && parsed.wildlife.length > 0
          ? parsed.wildlife
          : generateInitialWildlife(WORLD.SEED + 77, WORLD.ISLAND_RADIUS),
      boat: parsed.boat
        ? {
            keel_hull: Boolean(parsed.boat.keel_hull),
            mast_sail: Boolean(parsed.boat.mast_sail),
            outboard_engine: Boolean(parsed.boat.outboard_engine),
            nav_provisions: Boolean(parsed.boat.nav_provisions),
          }
        : createInitialBoatState(),
      voyage: parsed.voyage
        ? {
            ...createInitialVoyageState(),
            ...parsed.voyage,
          }
        : createInitialVoyageState(),
      bossDifficulty:
        parsed.bossDifficulty === 'easy' || parsed.bossDifficulty === 'hard'
          ? parsed.bossDifficulty
          : 'normal',
      boss: parsed.boss
        ? normalizeBossState(
            parsed.boss,
            parsed.bossDifficulty === 'easy' || parsed.bossDifficulty === 'hard'
              ? parsed.bossDifficulty
              : 'normal'
          )
        : createInitialBossState('normal'),
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
      escapedCity: Boolean(parsed.escapedCity),
      escapedAtDay: typeof parsed.escapedAtDay === 'number' ? parsed.escapedAtDay : undefined,
      discoveredCells,
      player,
      spawnPoint,
      flags: parsed.flags && typeof parsed.flags === 'object' ? parsed.flags : {},
      stats: {
        itemsCrafted: Number(parsed.stats?.itemsCrafted ?? 0),
        itemsGathered: Number(parsed.stats?.itemsGathered ?? 0),
        distanceTravelled: Number(parsed.stats?.distanceTravelled ?? 0),
        deaths: Number(parsed.stats?.deaths ?? 0),
        playTimeSec: Number(parsed.stats?.playTimeSec ?? 0),
        bossFightTimeSec: Number(parsed.stats?.bossFightTimeSec ?? 0),
      },
      lastSavedAt: typeof parsed.lastSavedAt === 'number' ? parsed.lastSavedAt : null,
      lastSaveKind: parsed.lastSaveKind ?? null,
    };
  } catch {
    return null;
  }
}

export function loadSurvivalSave(explicitStorage?: Storage): SurvivalState | null {
  const storage = getStorage(explicitStorage);
  if (!storage) return null;
  try {
    const raw = storage.getItem(SAVE.STORAGE_KEY);
    if (!raw) return null;
    return parseAndMigrateSave(raw);
  } catch {
    return null;
  }
}

export function writeSurvivalSave(
  state: SurvivalState,
  kind: SaveKind,
  explicitStorage?: Storage,
  nowMs: number = Date.now()
): SurvivalState {
  const stamped = stampSavedState(state, kind, nowMs);
  const storage = getStorage(explicitStorage);
  if (storage) {
    try {
      storage.setItem(SAVE.STORAGE_KEY, JSON.stringify(stamped));
    } catch {
      // Ignore quota / private mode failures gracefully
    }
  }
  return stamped;
}

export function clearSurvivalSave(explicitStorage?: Storage): void {
  const storage = getStorage(explicitStorage);
  if (!storage) return;
  try {
    storage.removeItem(SAVE.STORAGE_KEY);
  } catch {
    // Ignore storage removal errors
  }
}

/**
 * Sleeps in a placed shelter: advances the clock to morning, heals health,
 * refreshes stamina & temperature, ticks respawns & weather, anchors the
 * respawn point to the shelter, and stamps a 'bed' save.
 */
export function sleepAtShelter(
  state: SurvivalState,
  shelter: PlacedShelter,
  nowMs: number = Date.now()
): { state: SurvivalState; hoursSlept: number; message: string } {
  const curHour = ((state.clock.hour % 24) + 24) % 24;
  let deltaHours = 0;
  let nextDay = state.clock.day;
  let nextHour = TIME.WAKE_HOUR;

  if (curHour >= TIME.WAKE_HOUR) {
    deltaHours = 24 - curHour + TIME.WAKE_HOUR;
    nextDay = state.clock.day + 1;
    nextHour = TIME.WAKE_HOUR;
  } else if (curHour < TIME.WAKE_HOUR - 1.5) {
    deltaHours = TIME.WAKE_HOUR - curHour;
    nextDay = state.clock.day;
    nextHour = TIME.WAKE_HOUR;
  } else {
    deltaHours = 4;
    nextHour = curHour + 4;
  }

  const nextTotalHours = state.clock.totalHours + deltaHours;
  const nextWeather = stepWeather(state.weather, nextTotalHours);
  const nextNodes = tickNodeRespawns(state.nodes, nextTotalHours);
  const nextStructures = tickStructuresProduction(state.structures ?? [], deltaHours, nextWeather);
  const nextWildlife = (state.wildlife ?? []).map((w) => {
    if ((w.behavior === 'dead' || w.hp <= 0) && w.respawnAt !== null && nextTotalHours >= w.respawnAt) {
      return {
        ...w,
        x: w.homeX,
        z: w.homeZ,
        hp: w.maxHp,
        behavior: 'patrol' as const,
        attackCooldownSec: 0,
        respawnAt: null,
      };
    }
    return w;
  });

  const wakeZ = shelter.z + 2.1;
  const wakeY = Math.max(0.5, sampleIslandHeight(shelter.x, wakeZ, WORLD.ISLAND_RADIUS));
  const nextSpawn = {
    x: shelter.x,
    y: wakeY,
    z: wakeZ,
    yaw: shelter.yaw,
  };

  const nextNeeds = {
    ...state.needs,
    health: Math.min(100, state.needs.health + NEEDS.SLEEP_HEAL),
    hunger: Math.max(0, state.needs.hunger - NEEDS.SLEEP_HUNGER_COST),
    thirst: Math.max(0, state.needs.thirst - NEEDS.SLEEP_THIRST_COST),
    stamina: 100,
    wetness: Math.max(0, state.needs.wetness - 45),
    temperature: Math.min(37.2, Math.max(state.needs.temperature, TEMPERATURE.NORMAL_BODY_C)),
    sickness: Math.max(0, state.needs.sickness - 25),
  };

  const hoursRounded = Math.round(deltaHours * 10) / 10;
  const nextState: SurvivalState = {
    ...state,
    needs: nextNeeds,
    clock: {
      day: nextDay,
      hour: nextHour,
      totalHours: nextTotalHours,
    },
    weather: nextWeather,
    nodes: nextNodes,
    structures: nextStructures,
    wildlife: nextWildlife,
    spawnPoint: nextSpawn,
    flags: {
      ...state.flags,
      slept_in_shelter: true,
    },
    lastSavedAt: nowMs,
    lastSaveKind: 'bed',
  };

  return {
    state: nextState,
    hoursSlept: hoursRounded,
    message: `Slept ${hoursRounded}h in shelter — woke at dawn on Day ${nextDay}. Spawn & game saved.`,
  };
}
