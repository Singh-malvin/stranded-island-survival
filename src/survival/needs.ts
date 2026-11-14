/**
 * Pure simulation logic for Day/Night clock, Weather, Ambient & Body Temperature,
 * Needs (health, hunger, thirst, stamina, wetness, sickness), Consumables, and Respawn.
 */

import {
  DEATH,
  DIFFICULTY,
  NEEDS,
  SICKNESS,
  STANCE_TUNING,
  TEMPERATURE,
  TIME,
  WATER,
} from './config.ts';
import { addItem, ITEM_DEFS, removeItem } from './items.ts';
import {
  DayPhase,
  GameClock,
  Needs,
  PlayerContext,
  SurvivalState,
  WeatherKind,
  WeatherState,
} from './types.ts';

// ---------------------------------------------------------------------------
// DAY / NIGHT CLOCK
// ---------------------------------------------------------------------------

export function getDayPhase(hour: number): DayPhase {
  const h = ((hour % 24) + 24) % 24;
  if (h >= TIME.DAWN_HOURS[0] && h < TIME.DAWN_HOURS[1]) return 'dawn';
  if (h >= TIME.DAWN_HOURS[1] && h < TIME.DUSK_HOURS[0]) return 'day';
  if (h >= TIME.DUSK_HOURS[0] && h < TIME.DUSK_HOURS[1]) return 'dusk';
  return 'night';
}

export function isNightHour(hour: number): boolean {
  const h = ((hour % 24) + 24) % 24;
  return h >= TIME.NIGHT_START_HOUR || h < TIME.DAY_START_HOUR;
}

export function formatClock(clock: GameClock): {
  timeText: string;
  phase: DayPhase;
  phaseLabel: string;
  isNight: boolean;
} {
  const h = ((clock.hour % 24) + 24) % 24;
  const wholeH = Math.floor(h);
  const mins = Math.floor((h - wholeH) * 60);
  const timeText = `${String(wholeH).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  const phase = getDayPhase(h);
  const phaseLabel =
    phase === 'dawn'
      ? 'Sunrise'
      : phase === 'day'
        ? 'Daylight'
        : phase === 'dusk'
          ? 'Dusk'
          : 'Night';
  return {
    timeText,
    phase,
    phaseLabel,
    isNight: isNightHour(h),
  };
}

/**
 * Advances the in-game clock based on real elapsed seconds.
 * Daylight hours (06:00 -> 20:00 = 14 game hours) take DAYLIGHT_REAL_MINUTES.
 * Night hours (20:00 -> 06:00 = 10 game hours) take NIGHT_REAL_MINUTES.
 */
export function advanceClock(
  clock: GameClock,
  realDtSec: number
): { clock: GameClock; newDay: boolean } {
  if (realDtSec <= 0) return { clock, newDay: false };

  const daySpanHours = TIME.NIGHT_START_HOUR - TIME.DAY_START_HOUR; // 14h
  const nightSpanHours = 24 - daySpanHours; // 10h

  const dayHoursPerRealSec = daySpanHours / (TIME.DAYLIGHT_REAL_MINUTES * 60);
  const nightHoursPerRealSec = nightSpanHours / (TIME.NIGHT_REAL_MINUTES * 60);

  const rate = isNightHour(clock.hour) ? nightHoursPerRealSec : dayHoursPerRealSec;
  const deltaHours = realDtSec * rate;

  let nextHour = clock.hour + deltaHours;
  let nextDay = clock.day;
  let newDay = false;

  while (nextHour >= 24) {
    nextHour -= 24;
    nextDay += 1;
    newDay = true;
  }

  return {
    clock: {
      day: nextDay,
      hour: nextHour,
      totalHours: clock.totalHours + deltaHours,
    },
    newDay,
  };
}

// ---------------------------------------------------------------------------
// WEATHER & AMBIENT TEMPERATURE
// ---------------------------------------------------------------------------

export function stepWeather(
  weather: WeatherState,
  totalHours: number
): WeatherState {
  if (weather.override) {
    if (weather.override === 'storm') return { kind: 'storm', rain: 0.9, wind: 0.85, override: 'storm' };
    if (weather.override === 'rain') return { kind: 'rain', rain: 0.55, wind: 0.5, override: 'rain' };
    if (weather.override === 'overcast') return { kind: 'overcast', rain: 0, wind: 0.32, override: 'overcast' };
    return { kind: 'clear', rain: 0, wind: 0.15, override: 'clear' };
  }

  // Deterministic atmospheric cycle across in-game hours so storms roll in naturally
  const wave = Math.sin(totalHours * 0.23) + 0.5 * Math.cos(totalHours * 0.61);
  let kind: WeatherKind = 'clear';
  let rain = 0;
  let wind = 0.15;

  if (wave > 1.05) {
    kind = 'storm';
    rain = 0.9;
    wind = 0.85;
  } else if (wave > 0.55) {
    kind = 'rain';
    rain = 0.55;
    wind = 0.5;
  } else if (wave > 0.15) {
    kind = 'overcast';
    rain = 0;
    wind = 0.32;
  } else {
    kind = 'clear';
    rain = 0;
    wind = 0.15;
  }

  return { kind, rain, wind };
}

export function computeAmbientTempC(clock: GameClock, weather: WeatherState): number {
  // Coldest at 04:00, warmest at 16:00
  const shifted = ((clock.hour - TEMPERATURE.COLDEST_HOUR + 24) % 24) / 24;
  const diurnal = -Math.cos(shifted * Math.PI * 2); // -1 at 04:00, +1 at 16:00
  let temp = TEMPERATURE.AMBIENT_MEAN_C + diurnal * TEMPERATURE.AMBIENT_SWING_C;

  if (weather.kind === 'overcast') temp -= 1.8;
  if (weather.kind === 'rain') temp -= 4.2;
  if (weather.kind === 'storm') temp -= 6.8;

  temp -= weather.wind * 2.0;
  return Math.round(temp * 10) / 10;
}

export type BodyTempStageName = 'Normal' | 'Chilly' | 'Cold' | 'Hypothermic' | 'Severe';

export interface BodyTempStageInfo {
  stage: BodyTempStageName;
  speedMult: number;
  staminaRegenMult: number;
  shivering: boolean;
  frostIntensity: number;
  blurredEdges: boolean;
}

/**
 * Maps core body temperature (37°C -> 32°C) to survival stages:
 * - 37°C — Normal (>= 36.5°C)
 * - 36°C — Chilly (35.5°C – 36.49°C): cold warning on HUD
 * - 35°C — Cold (34.5°C – 35.49°C): shivering, slower stamina regen
 * - 34°C — Hypothermic (33.0°C – 34.49°C): blurred screen edges, slow movement, slow health drain
 * - 32°C — Severe (< 33.0°C, down to 32.0°C): heavy screen frost, faster health drain
 */
export function getBodyTempStage(tempC: number): BodyTempStageInfo {
  if (tempC >= TEMPERATURE.STAGE_NORMAL_C) {
    return {
      stage: 'Normal',
      speedMult: 1.0,
      staminaRegenMult: 1.0,
      shivering: false,
      frostIntensity: 0,
      blurredEdges: false,
    };
  }
  if (tempC >= TEMPERATURE.STAGE_CHILLY_C) {
    return {
      stage: 'Chilly',
      speedMult: 0.98,
      staminaRegenMult: 0.92,
      shivering: false,
      frostIntensity: 0.12,
      blurredEdges: false,
    };
  }
  if (tempC >= TEMPERATURE.STAGE_COLD_C) {
    const t = (TEMPERATURE.STAGE_CHILLY_C - tempC) / (TEMPERATURE.STAGE_CHILLY_C - TEMPERATURE.STAGE_COLD_C);
    return {
      stage: 'Cold',
      speedMult: 0.90,
      staminaRegenMult: 0.65,
      shivering: true,
      frostIntensity: 0.22 + t * 0.22,
      blurredEdges: false,
    };
  }
  if (tempC >= TEMPERATURE.STAGE_HYPOTHERMIC_C) {
    const t = (TEMPERATURE.STAGE_COLD_C - tempC) / (TEMPERATURE.STAGE_COLD_C - TEMPERATURE.STAGE_HYPOTHERMIC_C);
    return {
      stage: 'Hypothermic',
      speedMult: 0.76,
      staminaRegenMult: 0.42,
      shivering: true,
      frostIntensity: 0.48 + t * 0.27,
      blurredEdges: true,
    };
  }
  const t = Math.min(1, Math.max(0, (TEMPERATURE.STAGE_HYPOTHERMIC_C - tempC) / 1.0));
  return {
    stage: 'Severe',
    speedMult: 0.62,
    staminaRegenMult: 0.25,
    shivering: true,
    frostIntensity: 0.78 + t * 0.22,
    blurredEdges: true,
  };
}

export function computeTargetBodyTempC(
  ambientC: number,
  ctx: PlayerContext,
  wetness: number
): number {
  let effectiveAmbient = ambientC;

  if (ctx.nearFire) {
    const sitFireMult = ctx.stance === 'sit' ? STANCE_TUNING.SIT_NEAR_FIRE_WARMTH_MULT : 1.0;
    effectiveAmbient += TEMPERATURE.CAMPFIRE_WARMTH_C * sitFireMult;
  }
  if (ctx.holdingLitTorch) {
    effectiveAmbient += TEMPERATURE.TORCH_WARMTH_C;
  }
  if (ctx.sheltered) {
    effectiveAmbient += TEMPERATURE.SHELTER_WARMTH_C * (ctx.stance === 'sit' || ctx.stance === 'sleep' ? 1.25 : 1.0);
  }
  if (wetness > 0) {
    effectiveAmbient -= (wetness / 100) * TEMPERATURE.WET_CHILL_C;
  }

  if (effectiveAmbient < TEMPERATURE.COMFORT_MIN_C) {
    const wetPenalty = !ctx.nearFire ? (wetness / 100) * TEMPERATURE.WET_MAX_PENALTY_C : 0;
    const raw =
      TEMPERATURE.NORMAL_BODY_C -
      (TEMPERATURE.COMFORT_MIN_C - effectiveAmbient) * TEMPERATURE.COLD_TARGET_SLOPE -
      wetPenalty;
    return Math.max(TEMPERATURE.MIN_BODY_C, raw);
  }
  if (effectiveAmbient > TEMPERATURE.COMFORT_MAX_C) {
    const raw =
      TEMPERATURE.NORMAL_BODY_C +
      (effectiveAmbient - TEMPERATURE.COMFORT_MAX_C) * TEMPERATURE.HEAT_TARGET_SLOPE;
    return Math.min(TEMPERATURE.MAX_BODY_C, raw);
  }
  return TEMPERATURE.NORMAL_BODY_C;
}

// ---------------------------------------------------------------------------
// PLAYER NEEDS TICK
// ---------------------------------------------------------------------------

export function tickNeeds(
  needs: Needs,
  realDtSec: number,
  ambientC: number,
  weather: WeatherState,
  ctx: PlayerContext,
  difficulty: 'survivor' | 'hardcore' = 'survivor'
): { needs: Needs; died: boolean; causeOfDeath?: string } {
  if (realDtSec <= 0) return { needs, died: needs.health <= 0 };

  const diff = DIFFICULTY[difficulty];
  const dtMin = realDtSec / 60;
  const next: Needs = { ...needs };

  // 1. Wetness
  if (ctx.isSwimming) {
    next.wetness = Math.min(100, next.wetness + realDtSec * TEMPERATURE.WETNESS_SWIM_PER_SEC);
  } else if (weather.rain > 0 && !ctx.sheltered) {
    next.wetness = Math.min(
      100,
      next.wetness + realDtSec * TEMPERATURE.WETNESS_RAIN_PER_SEC * weather.rain
    );
  } else {
    const dryRate = ctx.nearFire ? TEMPERATURE.DRY_FIRE_PER_SEC : TEMPERATURE.DRY_PER_SEC;
    next.wetness = Math.max(0, next.wetness - realDtSec * dryRate);
  }

  // 2. Sickness countdown
  const isSick = next.sickness > 0;
  if (next.sickness > 0) {
    next.sickness = Math.max(0, next.sickness - realDtSec);
    if (next.sickness <= 0) {
      next.sicknessCause = undefined;
    } else if (!next.sicknessCause) {
      next.sicknessCause = 'Raw Meat';
    }
  } else {
    next.sicknessCause = undefined;
  }

  // 3. Stamina (affected by low hunger/thirst and Cold/Hypothermic stages)
  const tempStagePre = getBodyTempStage(next.temperature);
  if (ctx.isSprinting && ctx.isMoving) {
    next.stamina = Math.max(0, next.stamina - realDtSec * NEEDS.STAMINA_SPRINT_DRAIN_PER_SEC);
  } else if (ctx.isSwimming && ctx.isMoving) {
    next.stamina = Math.max(0, next.stamina - realDtSec * NEEDS.STAMINA_SWIM_DRAIN_PER_SEC);
  } else {
    const lowNeeds =
      next.hunger < NEEDS.LOW_NEED_THRESHOLD || next.thirst < NEEDS.LOW_NEED_THRESHOLD;
    const stanceRegenMult =
      ctx.stance === 'sit'
        ? STANCE_TUNING.SIT_STAMINA_REGEN_MULT
        : ctx.stance === 'prone'
          ? STANCE_TUNING.PRONE_STAMINA_REGEN_MULT
          : 1.0;
    const regenMult =
      (lowNeeds ? NEEDS.STAMINA_REGEN_LOW_NEEDS_MULT : 1.0) *
      tempStagePre.staminaRegenMult *
      stanceRegenMult;
    next.stamina = Math.min(
      100,
      next.stamina + realDtSec * NEEDS.STAMINA_REGEN_PER_SEC * regenMult
    );
  }

  // 4. Hunger & Thirst
  const sprintMult = ctx.isSprinting && ctx.isMoving ? NEEDS.SPRINT_DRAIN_MULT : 1.0;
  const sickMult = isSick ? SICKNESS.DRAIN_MULT : 1.0;
  const heatMult = ambientC >= NEEDS.HOT_AMBIENT_C ? NEEDS.HEAT_THIRST_MULT : 1.0;

  next.hunger = Math.max(
    0,
    next.hunger - dtMin * NEEDS.HUNGER_DRAIN_PER_MIN * sprintMult * sickMult * diff.drainMult
  );
  next.thirst = Math.max(
    0,
    next.thirst -
      dtMin * NEEDS.THIRST_DRAIN_PER_MIN * sprintMult * heatMult * sickMult * diff.drainMult
  );

  // 5. Body temperature (clamped 32.0°C to 41.5°C, with warming/cooling trend)
  const targetBodyC = computeTargetBodyTempC(ambientC, ctx, next.wetness);
  const tempDiff = targetBodyC - next.temperature;
  next.tempTrend = tempDiff > 0.08 ? 'warming' : tempDiff < -0.08 ? 'cooling' : 'stable';
  const blend = Math.min(1, realDtSec * TEMPERATURE.BODY_DRIFT_RATE);
  const blendedTemp = next.temperature + tempDiff * blend;
  next.temperature =
    Math.round(
      Math.max(TEMPERATURE.MIN_BODY_C, Math.min(TEMPERATURE.MAX_BODY_C, blendedTemp)) * 100
    ) / 100;

  // 6. Health drain / recovery
  let healthDelta = 0;
  let primaryCause: string | undefined;

  if (next.thirst <= 0) {
    healthDelta -= dtMin * NEEDS.DEHYDRATED_DAMAGE_PER_MIN * diff.damageMult;
    primaryCause = 'severe dehydration';
  }
  if (next.hunger <= 0) {
    healthDelta -= dtMin * NEEDS.STARVING_DAMAGE_PER_MIN * diff.damageMult;
    if (!primaryCause) primaryCause = 'starvation';
  }
  if (next.temperature < TEMPERATURE.HYPOTHERMIA_C) {
    const degBelow = TEMPERATURE.HYPOTHERMIA_C - next.temperature;
    const severeBoost = next.temperature < TEMPERATURE.STAGE_HYPOTHERMIC_C ? 1.35 : 1.0;
    healthDelta -=
      dtMin * degBelow * TEMPERATURE.COLD_DAMAGE_PER_MIN_PER_DEG * severeBoost * diff.damageMult;
    if (!primaryCause) primaryCause = 'hypothermia in the night cold';
  } else if (next.temperature > TEMPERATURE.HEATSTROKE_C) {
    const degAbove = next.temperature - TEMPERATURE.HEATSTROKE_C;
    healthDelta -=
      dtMin * degAbove * TEMPERATURE.HEAT_DAMAGE_PER_MIN_PER_DEG * diff.damageMult;
    if (!primaryCause) primaryCause = 'heatstroke';
  }
  if (isSick) {
    healthDelta -= dtMin * SICKNESS.DAMAGE_PER_MIN * diff.damageMult;
    if (!primaryCause) primaryCause = 'acute food poisoning';
  }
  if (ctx.isSwimming && next.stamina <= 0) {
    healthDelta -= realDtSec * 5 * diff.damageMult;
    primaryCause = 'exhaustion and drowning';
  }

  // Gentle natural healing when well-fed, hydrated, warm, and not sick
  if (
    healthDelta === 0 &&
    !isSick &&
    next.hunger >= NEEDS.WELL_FED_THRESHOLD &&
    next.thirst >= NEEDS.WELL_FED_THRESHOLD &&
    next.temperature >= TEMPERATURE.COLD_FEEDBACK_C &&
    next.temperature <= TEMPERATURE.HEATSTROKE_C - 0.5
  ) {
    healthDelta += dtMin * NEEDS.HEALTH_REGEN_PER_MIN;
  }

  next.health = Math.max(0, Math.min(100, next.health + healthDelta));

  return {
    needs: next,
    died: next.health <= 0,
    causeOfDeath: next.health <= 0 ? primaryCause ?? 'exposure' : undefined,
  };
}

// ---------------------------------------------------------------------------
// CONSUMABLES, FRESHWATER SPRING & DEATH RESPAWN
// ---------------------------------------------------------------------------

export function consumeInventorySlot(
  state: SurvivalState,
  slotIndex: number,
  rng: () => number = Math.random
): {
  state: SurvivalState;
  consumed: boolean;
  message: string;
  gotSick: boolean;
} {
  const slot = state.inventory[slotIndex];
  if (!slot) {
    return { state, consumed: false, message: 'Nothing in that slot.', gotSick: false };
  }
  const def = ITEM_DEFS[slot.itemId];
  if (!def?.food) {
    return {
      state,
      consumed: false,
      message: `${def.name} cannot be eaten or drunk.`,
      gotSick: false,
    };
  }

  const nextInv = state.inventory.map((s) => (s ? { ...s } : null));
  nextInv[slotIndex]!.count -= 1;
  if (nextInv[slotIndex]!.count <= 0) {
    nextInv[slotIndex] = null;
  }

  let finalInv = nextInv;
  if (def.food.leaves) {
    finalInv = addItem(finalInv, def.food.leaves, 1).inventory;
  }

  const needs: Needs = { ...state.needs };
  if (def.food.hunger) {
    needs.hunger = Math.max(0, Math.min(100, needs.hunger + def.food.hunger));
  }
  if (def.food.thirst) {
    needs.thirst = Math.max(0, Math.min(100, needs.thirst + def.food.thirst));
  }
  if (def.food.health) {
    needs.health = Math.max(0, Math.min(100, needs.health + def.food.health));
  }

  let gotSick = false;
  if (def.id === 'medicinal_poultice') {
    needs.sickness = 0;
    needs.sicknessCause = undefined;
  } else if (def.food.sickChance && rng() < def.food.sickChance) {
    needs.sickness = SICKNESS.DURATION_SEC;
    needs.sicknessCause =
      def.id === 'water_bottle_dirty'
        ? 'Dirty Water'
        : def.id === 'raw_meat'
          ? 'Raw Meat'
          : def.id === 'raw_fish'
            ? 'Raw Fish'
            : def.name;
    gotSick = true;
  }

  // Eating warm/cooked food or drinking boiled water warms core body temperature toward 37.0°C
  if (
    def.id === 'cooked_meat' ||
    def.id === 'cooked_fish' ||
    def.id === 'dried_fish' ||
    def.id === 'water_bottle_clean' ||
    def.id === 'dried_meat'
  ) {
    if (needs.temperature < TEMPERATURE.NORMAL_BODY_C) {
      needs.temperature =
        Math.round(
          Math.min(
            TEMPERATURE.NORMAL_BODY_C,
            needs.temperature + TEMPERATURE.WARM_CONSUME_BOOST_C
          ) * 100
        ) / 100;
      needs.tempTrend = 'warming';
    }
  }

  const message =
    def.id === 'medicinal_poultice'
      ? 'Applied Herbal Healing Poultice (+28 Health, cured venom & food poisoning).'
      : gotSick
        ? `Consumed ${def.name} — Sick: ${needs.sicknessCause ?? def.name}! Boil water and cook meat over a fire.`
        : `Consumed ${def.name}.`;

  return {
    state: {
      ...state,
      needs,
      inventory: finalInv,
    },
    consumed: true,
    message,
    gotSick,
  };
}

export function applyFallDamage(
  state: SurvivalState,
  fallMeters: number
): { state: SurvivalState; damage: number; died: boolean } {
  if (!state.alive || fallMeters <= NEEDS.FALL_SAFE_HEIGHT_M) {
    return { state, damage: 0, died: false };
  }
  const extraDrop = fallMeters - NEEDS.FALL_SAFE_HEIGHT_M;
  const dmg = Math.round(
    extraDrop * NEEDS.FALL_DAMAGE_PER_M * DIFFICULTY[state.difficulty].damageMult
  );
  if (dmg <= 0) {
    return { state, damage: 0, died: false };
  }
  const nextHealth = Math.max(0, state.needs.health - dmg);
  return {
    state: {
      ...state,
      needs: {
        ...state.needs,
        health: nextHealth,
      },
      alive: nextHealth > 0,
    },
    damage: dmg,
    died: nextHealth <= 0,
  };
}

export function interactFreshwaterSpring(
  state: SurvivalState,
  rng: () => number = Math.random
): {
  state: SurvivalState;
  message: string;
  gotSick: boolean;
} {
  // If player has an empty bottle, fill it with dirty spring water first!
  const removed = removeItem(state.inventory, 'empty_bottle', 1);
  if (removed.success) {
    const added = addItem(removed.inventory, 'water_bottle_dirty', 1);
    return {
      state: { ...state, inventory: added.inventory },
      message: 'Filled Canteen Bottle with spring water. Boil it at a campfire before drinking!',
      gotSick: false,
    };
  }

  // Otherwise drink directly from the freshwater pond (safe, FRESH_SICK_CHANCE = 0)
  const needs: Needs = {
    ...state.needs,
    thirst: Math.min(100, state.needs.thirst + WATER.FRESH_DRINK_THIRST),
  };
  let gotSick = false;
  if (WATER.FRESH_SICK_CHANCE > 0 && rng() < WATER.FRESH_SICK_CHANCE) {
    needs.sickness = SICKNESS.DURATION_SEC;
    needs.sicknessCause = 'Stagnant Water';
    gotSick = true;
  }

  return {
    state: { ...state, needs },
    message: gotSick
      ? 'Drank stagnant water — contracted parasites! Boil water in a bottle at a campfire.'
      : 'Cupped your hands and drank cool, clean freshwater from the spring (+22 Thirst).',
    gotSick,
  };
}

export function drinkSeawater(state: SurvivalState): {
  state: SurvivalState;
  message: string;
  gotSick: boolean;
} {
  const needs: Needs = {
    ...state.needs,
    thirst: Math.max(0, state.needs.thirst + WATER.SEA_DRINK_THIRST),
    health: Math.max(0, state.needs.health - WATER.SEA_DRINK_DAMAGE),
    sickness: SICKNESS.DURATION_SEC,
    sicknessCause: 'Sea Water',
  };
  return {
    state: {
      ...state,
      needs,
      alive: needs.health > 0,
    },
    message: 'Drank salty sea water — Sick: Sea Water! Dehydration and nausea worsen.',
    gotSick: true,
  };
}

/**
 * Respawns the player at their last bed / camp without losing hours of work:
 * - Keeps all tools, story items, and structures
 * - Trims only DEATH.RESOURCE_LOSS_FRACTION (25%) of raw stackable resources
 */
export function respawnAtLastBed(state: SurvivalState): SurvivalState {
  const updatedInventory = state.inventory.map((slot) => {
    if (!slot) return null;
    const def = ITEM_DEFS[slot.itemId];
    if (def?.loseOnDeath && slot.count > 1) {
      const kept = Math.max(1, Math.ceil(slot.count * (1 - DEATH.RESOURCE_LOSS_FRACTION)));
      return { ...slot, count: kept };
    }
    return { ...slot };
  });

  return {
    ...state,
    alive: true,
    needs: {
      health: DEATH.RESPAWN_NEEDS.health,
      hunger: DEATH.RESPAWN_NEEDS.hunger,
      thirst: DEATH.RESPAWN_NEEDS.thirst,
      stamina: DEATH.RESPAWN_NEEDS.stamina,
      temperature: DEATH.RESPAWN_NEEDS.temperature,
      wetness: 0,
      sickness: 0,
    },
    inventory: updatedInventory,
    player: { ...state.spawnPoint },
    voyage:
      state.voyage && state.voyage.phase !== 'docked'
        ? {
            ...state.voyage,
            phase: 'docked',
            hullIntegrity: Math.max(60, state.voyage.hullIntegrity),
            fuelPct: Math.max(30, state.voyage.fuelPct),
            seaEventText: null,
          }
        : state.voyage,
    stats: {
      ...state.stats,
      deaths: state.stats.deaths + 1,
    },
  };
}
