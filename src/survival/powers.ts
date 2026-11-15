/**
 * Pure simulation for the 4 Island Relic Shrines & Unlockable Powers:
 * Aura Ward, Tempest Dash, Sovereign Cleave, and Aura Sight.
 * Can be discovered and unlocked in ANY order (player-driven).
 */

import { POWER_TUNING } from './config.ts';
import { countItem, removeItem } from './items.ts';
import type { JournalEntry, PowerId, PowersState, SurvivalState } from './types.ts';

export function createInitialPowersState(): PowersState {
  return {
    unlocked: [],
    cooldowns: {
      aura_ward: 0,
      tempest_dash: 0,
      sovereign_cleave: 0,
      aura_sight: 0,
    },
    activeAuraSightSec: 0,
  };
}

export function normalizePowersState(raw?: Partial<PowersState> | null): PowersState {
  const base = createInitialPowersState();
  if (!raw || typeof raw !== 'object') return base;
  return {
    unlocked: Array.isArray(raw.unlocked) ? [...new Set(raw.unlocked)] : [],
    cooldowns: { ...base.cooldowns, ...(raw.cooldowns ?? {}) },
    activeAuraSightSec: Math.max(0, Number(raw.activeAuraSightSec ?? 0)),
  };
}

export function getShrineDef(powerId: PowerId) {
  return POWER_TUNING.SHRINES.find((s) => s.id === powerId)!;
}

/**
 * Unlocks any shrine power independently; Sovereign Cleave supports multiple routes
 * (offering an Aura Shard OR decrypting the Ancient Ruins monolith).
 */
export function unlockShrinePower(
  state: SurvivalState,
  powerId: PowerId
): { ok: boolean; state: SurvivalState; message: string } {
  if (state.powers.unlocked.includes(powerId)) {
    return {
      ok: true,
      state,
      message: `${getShrineDef(powerId).name} is already attuned to your spirit.`,
    };
  }

  let inv = state.inventory;
  if (powerId === 'sovereign_cleave') {
    const hasRuinsLore =
      state.cluesFound.includes('clue_ruins_tablet') ||
      state.cluesFound.includes('clue_station_log');
    if (countItem(inv, 'aura_shard') > 0) {
      inv = removeItem(inv, 'aura_shard', 1).inventory;
    } else if (!hasRuinsLore) {
      return {
        ok: false,
        state,
        message:
          'Offer 1x Condensed Aura Shard OR read the Ancient Ruins Monolith first to awaken Sovereign Cleave.',
      };
    }
  }

  const def = getShrineDef(powerId);
  const entry: JournalEntry = {
    id: `power_${powerId}`,
    category: 'discovery',
    title: `Awakened ${def.name}`,
    detail: def.description,
    day: state.clock.day,
  };

  return {
    ok: true,
    state: {
      ...state,
      inventory: inv,
      powers: {
        ...state.powers,
        unlocked: [...state.powers.unlocked, powerId],
      },
      journalEntries: state.journalEntries.some((e) => e.id === entry.id)
        ? state.journalEntries
        : [...state.journalEntries, entry],
      flags: {
        ...state.flags,
        [`power_${powerId}`]: true,
      },
    },
    message: `Relic Power Awakened: ${def.name} — ${def.description}`,
  };
}

export function activatePower(
  state: SurvivalState,
  powerId: 'sovereign_cleave' | 'aura_sight'
): { ok: boolean; state: SurvivalState; message: string } {
  if (!state.powers.unlocked.includes(powerId)) {
    return { ok: false, state, message: `Find the ${getShrineDef(powerId).name} first.` };
  }
  const remCd = state.powers.cooldowns[powerId] ?? 0;
  if (remCd > 0) {
    return {
      ok: false,
      state,
      message: `${getShrineDef(powerId).name} recharging (${Math.ceil(remCd)}s).`,
    };
  }

  if (powerId === 'aura_sight') {
    return {
      ok: true,
      state: {
        ...state,
        powers: {
          ...state.powers,
          activeAuraSightSec: POWER_TUNING.SIGHT_DURATION_SEC,
          cooldowns: {
            ...state.powers.cooldowns,
            aura_sight: POWER_TUNING.SIGHT_COOLDOWN_SEC,
          },
        },
      },
      message: 'Aura Sight active — sensing the Aura King and Stronghold Shades through cover.',
    };
  }

  return {
    ok: true,
    state: {
      ...state,
      powers: {
        ...state.powers,
        cooldowns: {
          ...state.powers.cooldowns,
          sovereign_cleave: POWER_TUNING.CLEAVE_COOLDOWN_SEC,
        },
      },
    },
    message: 'Sovereign Cleave unleashed — shattering Aura shields in an arc!',
  };
}

export function tickPowers(state: SurvivalState, dtSec: number): SurvivalState {
  if (dtSec <= 0) return state;
  const cd = state.powers.cooldowns;
  const nextSight = Math.max(0, state.powers.activeAuraSightSec - dtSec);
  const nextCd = {
    aura_ward: Math.max(0, cd.aura_ward - dtSec),
    tempest_dash: Math.max(0, cd.tempest_dash - dtSec),
    sovereign_cleave: Math.max(0, cd.sovereign_cleave - dtSec),
    aura_sight: Math.max(0, cd.aura_sight - dtSec),
  };
  if (
    nextSight === state.powers.activeAuraSightSec &&
    nextCd.sovereign_cleave === cd.sovereign_cleave &&
    nextCd.aura_sight === cd.aura_sight
  ) {
    return state;
  }
  return {
    ...state,
    powers: {
      ...state.powers,
      activeAuraSightSec: nextSight,
      cooldowns: nextCd,
    },
  };
}

export function getIncomingAuraDamageMult(state: SurvivalState): number {
  return state.powers.unlocked.includes('aura_ward')
    ? POWER_TUNING.AURA_WARD_DAMAGE_MULT
    : 1.0;
}

export function getDodgeSpeedBonusMult(state: SurvivalState): number {
  return state.powers.unlocked.includes('tempest_dash')
    ? POWER_TUNING.TEMPEST_DASH_SPEED_MULT
    : 1.0;
}

export function getDodgeIframeBonusMult(state: SurvivalState): number {
  return state.powers.unlocked.includes('tempest_dash')
    ? POWER_TUNING.TEMPEST_DASH_IFRAME_MULT
    : 1.0;
}
