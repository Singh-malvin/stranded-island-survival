/**
 * ============================================================================
 *  STRANDED — GAME BALANCE CONFIG
 * ============================================================================
 *  Every tuning number for the survival game lives in this file so the whole
 *  game can be rebalanced without touching logic code.
 *
 *  Units:
 *   - "per real minute" values are applied against real (wall-clock) time.
 *   - Game time is measured in in-game HOURS (0–24). See TIME below for how
 *     real seconds map onto game hours.
 *   - Needs (health/hunger/thirst/stamina/wetness) run 0–100.
 *   - Temperatures are in °C.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// TIME & DAY/NIGHT
// ---------------------------------------------------------------------------
export const TIME = {
  /** Real minutes the daylight portion (DAY_START_HOUR → NIGHT_START_HOUR) lasts. */
  DAYLIGHT_REAL_MINUTES: 14,
  /** Real minutes the night portion (NIGHT_START_HOUR → DAY_START_HOUR) lasts. */
  NIGHT_REAL_MINUTES: 6,
  /** In-game hour the sun rises / daylight clock speed begins. */
  DAY_START_HOUR: 6,
  /** In-game hour night begins (darkness, cold, danger). */
  NIGHT_START_HOUR: 20,
  /** Golden-hour windows (in game hours) used for lighting + HUD phase names. */
  DAWN_HOURS: [5, 7.5] as const,
  DUSK_HOURS: [18, 20.5] as const,
  /** Hour the player wakes up on the beach on day 1. */
  START_HOUR: 7.0,
  /** Hour you wake up after sleeping through the night in a bed. */
  WAKE_HOUR: 6.5,
};

// ---------------------------------------------------------------------------
// PLAYER NEEDS (balanced, not punishing)
// ---------------------------------------------------------------------------
export const NEEDS = {
  START: { health: 85, hunger: 70, thirst: 55, stamina: 100, temperature: 37.0 },

  /** Hunger lost per real minute (100 → 0 in ~40 real minutes ≈ 2 in-game days). */
  HUNGER_DRAIN_PER_MIN: 2.5,
  /** Thirst lost per real minute (100 → 0 in ~25 real minutes). */
  THIRST_DRAIN_PER_MIN: 4.0,
  /** Extra multiplier on hunger/thirst drain while sprinting. */
  SPRINT_DRAIN_MULT: 1.6,
  /** Extra thirst multiplier in hot ambient air (above HOT_AMBIENT_C). */
  HEAT_THIRST_MULT: 1.5,
  HOT_AMBIENT_C: 32,

  /** Stamina (per real SECOND). */
  STAMINA_SPRINT_DRAIN_PER_SEC: 16.5,
  STAMINA_SWIM_DRAIN_PER_SEC: 4.5,
  STAMINA_REGEN_PER_SEC: 15,
  /** Regen multiplier when hungry or thirsty (below LOW_NEED_THRESHOLD). */
  STAMINA_REGEN_LOW_NEEDS_MULT: 0.45,
  /** Stamina cost of one gathering swing / attack, and jumping. */
  STAMINA_PER_SWING: 5,
  STAMINA_JUMP: 8,
  /** Fall damage threshold (m) & damage multiplier per extra meter fallen. */
  FALL_SAFE_HEIGHT_M: 3.8,
  FALL_DAMAGE_PER_M: 8.5,
  /** Below this stamina the player is "exhausted" (slow, heavy camera sway). */
  EXHAUSTED_THRESHOLD: 15,
  LOW_NEED_THRESHOLD: 25,

  /** Health damage per real MINUTE while starving / dehydrated. */
  STARVING_DAMAGE_PER_MIN: 6,
  DEHYDRATED_DAMAGE_PER_MIN: 9,
  /** Health regen per real minute when fed (>WELL_FED) + hydrated + warm. */
  HEALTH_REGEN_PER_MIN: 4,
  WELL_FED_THRESHOLD: 55,
  /** Sleeping in a bed heals this much health. */
  SLEEP_HEAL: 35,
  /** Sleeping costs this much hunger & thirst (you were out for hours). */
  SLEEP_HUNGER_COST: 18,
  SLEEP_THIRST_COST: 22,
};

// ---------------------------------------------------------------------------
// BODY TEMPERATURE & WETNESS
// ---------------------------------------------------------------------------
export const TEMPERATURE = {
  NORMAL_BODY_C: 37.0,
  /** Minimum core body temperature reachable in severe cold/wet storms (°C). */
  MIN_BODY_C: 32.0,
  /** Maximum core body temperature reachable in extreme heat (°C). */
  MAX_BODY_C: 41.5,
  /** Hypothermia stage thresholds (°C): 37 Normal -> 36 Chilly -> 35 Cold -> 34 Hypothermic -> 32 Severe. */
  STAGE_NORMAL_C: 36.5,
  STAGE_CHILLY_C: 35.5,
  STAGE_COLD_C: 34.5,
  STAGE_HYPOTHERMIC_C: 33.0,
  STAGE_SEVERE_C: 32.0,
  /** Below this body temp the player takes cold damage (hypothermia). */
  HYPOTHERMIA_C: 34.5,
  /** Above this body temp the player takes heat damage (heatstroke). */
  HEATSTROKE_C: 39.2,
  /** "Cold" feedback (frost vignette, visible breath) starts below Chilly (< 35.5°C). */
  COLD_FEEDBACK_C: 35.5,
  /** Health lost per real minute per °C below HYPOTHERMIA_C. */
  COLD_DAMAGE_PER_MIN_PER_DEG: 7,
  HEAT_DAMAGE_PER_MIN_PER_DEG: 5,
  /** Direct core body °C boost when consuming warm/cooked food or boiled water. */
  WARM_CONSUME_BOOST_C: 0.65,

  /** Explicit warming rates (°C per real second) — noticeably faster than cooling. */
  WARM_RATE_FIRE_C_PER_SEC: 0.025, // +1.50 °C/min near campfire
  WARM_RATE_SHELTER_C_PER_SEC: 0.015, // +0.90 °C/min inside shelter
  WARM_RATE_TORCH_C_PER_SEC: 0.008, // +0.48 °C/min holding lit torch/lantern
  WARM_RATE_DRY_DAY_C_PER_SEC: 0.014, // +0.84 °C/min dry warm daytime recovery

  /** Explicit cooling drivers (°C per real second) for slow, realistic progression. */
  COOL_RATE_BASE_C_PER_SEC: 0.0005, // +0.03 °C/min gentle drift floor when below comfort
  COOL_RATE_DAY_RAIN_MAX_DROP: 2.1, // daytime rain alone never drops below ~34.9°C (Cold)
  COOL_RATE_CLEAR_NIGHT_MAX_DROP: 2.2, // dry clear single night bottoms at ~34.8°C (Cold)
  COOL_RATE_NIGHT_C_PER_SEC: 0.0053, // +0.318 °C/min exposed unsheltered at night -> Cold in ~4.7 min
  COOL_RATE_RAIN_C_PER_SEC: 0.0012, // +0.072 °C/min active rain when unsheltered
  COOL_RATE_WET_C_PER_SEC: 0.0013, // +0.078 °C/min soaked clothing when away from fire (~1°C/6.2m in rain)
  COOL_RATE_WIND_C_PER_SEC: 0.0022, // +0.132 °C/min strong cool wind chill when unsheltered
  COOL_RATE_SWIM_C_PER_SEC: 0.0040, // +0.240 °C/min cold ocean swimming
  COOL_RATE_STORM_NIGHT_C_PER_SEC: 0.0020, // +0.120 °C/min soaked night gale exposure -> Severe by full ~5.8m storm night

  /** Night/shelter/torch protection factors. */
  SHELTER_NIGHT_CHILL_REDUCTION: 0.78, // shelter blocks rain/wind & cuts night chill by 78%
  TORCH_CHILL_MITIGATION: 0.55, // lit torch/lantern cuts exposed night chill by 55%
  NIGHT_EXPOSURE_PENALTY_C: 2.5, // additional effective cooling at night without sun/fire/shelter
  NIGHT_INFER_AMBIENT_C: 17.0, // fallback night threshold when clock is omitted

  /** Day 1 grace & clear-morning window. */
  DAY1_CLEAR_WEATHER_HOURS: 5.0, // Day 1 07:00 -> 12:00 starts clear before weather rolls in
  DAY1_MIN_BODY_C: 35.5, // Day 1 never drops below "Chilly" (>= 35.5°C)
  DAYLIGHT_COMFORT_FLOOR_C: 36.6, // Normal daytime dry/cool air keeps core in 36.5–37.0°C

  /** Ambient air model: coldest at COLDEST_HOUR, warmest 12h later. */
  AMBIENT_MEAN_C: 23.0,
  AMBIENT_SWING_C: 9.0, // ±9 → ~14 °C before dawn, ~32 °C mid-afternoon
  COLDEST_HOUR: 4,

  /** Comfortable ambient band — inside it body temp settles at NORMAL_BODY_C. */
  COMFORT_MIN_C: 17.5,
  COMFORT_MAX_C: 33,
  /** Body target °C shift per °C of ambient outside the comfort band. */
  COLD_TARGET_SLOPE: 0.34,
  HEAT_TARGET_SLOPE: 0.15,

  /** Warmth bonuses (added to effective ambient °C). */
  CAMPFIRE_WARMTH_C: 18,
  CAMPFIRE_RADIUS_M: 5.5,
  TORCH_WARMTH_C: 5,
  SHELTER_WARMTH_C: 7,
  /** Wet clothes chill effective ambient by up to this many °C at 100 wetness. */
  WET_CHILL_C: 7.5,
  /** Direct extra body target drop (°C) when 100% soaked in cold/windy air. */
  WET_MAX_PENALTY_C: 1.8,

  /** Wetness gained per real second while swimming / in rain (scaled by rain intensity). */
  WETNESS_SWIM_PER_SEC: 40,
  WETNESS_RAIN_PER_SEC: 2.5,
  /** Drying per real second (base / near fire / in hot sun). */
  DRY_PER_SEC: 1.0,
  DRY_FIRE_PER_SEC: 6,
};

// ---------------------------------------------------------------------------
// FOOD, WATER & SICKNESS
// ---------------------------------------------------------------------------
export const SICKNESS = {
  /** Duration of food poisoning in real seconds. */
  DURATION_SEC: 120,
  /** While sick: health lost per real minute, and extra hunger/thirst drain mult. */
  DAMAGE_PER_MIN: 5,
  DRAIN_MULT: 1.8,
};

/** Water source behaviour (drinking directly with [E]). */
export const WATER = {
  FRESH_DRINK_THIRST: 22,
  /** Drinking from the freshwater pond/spring does NOT make the player sick (0% chance). */
  FRESH_SICK_CHANCE: 0,
  SEA_DRINK_THIRST: -10,
  SEA_DRINK_DAMAGE: 4,
};

// ---------------------------------------------------------------------------
// TOOLS & GATHERING
// ---------------------------------------------------------------------------
/** Harvest damage per swing, by tool tier (0 = bare hands). */
export const TOOL_POWER = [1, 2, 4, 6] as const;

/** Durability (number of uses) for each tool item. */
export const TOOL_DURABILITY: Record<string, number> = {
  stone_axe: 60,
  stone_pick: 60,
  spear: 45,
  torch: 1, // torches burn by time instead — see TORCH_BURN_REAL_SEC
  lantern: 1, // oil lanterns burn much longer — see LANTERN_BURN_REAL_SEC
  metal_axe: 180,
  metal_pick: 180,
  machete: 150,
  climbing_gear: 12,
  river_raft: 12,
  aura_rifle: 80,
  harpoon_gun: 60,
  lockpick: 4,
};
export const TORCH_BURN_REAL_SEC = 240;
export const LANTERN_BURN_REAL_SEC = 900;

/** Inventory size (first HOTBAR_SIZE slots form the hotbar). */
export const INVENTORY = {
  SLOTS: 24,
  HOTBAR_SIZE: 6,
  DEFAULT_STACK: 30,
};

/**
 * Respawn time for depleted gathering nodes, in IN-GAME HOURS.
 * `null` = never respawns (rare / story resources).
 */
export const NODE_RESPAWN_HOURS: Record<string, number | null> = {
  palm_tree: 48,
  resin_tree: 42,
  fibre_bush: 22,
  berry_bush: 32,
  herb_patch: 36,
  driftwood: 20,
  loose_stone: 26,
  boulder: 72,
  flint_nodule: 60,
  iron_vein: 72,
  copper_vein: null,
  shell_cluster: 24,
  coconut: 28,
  crash_debris: null,
  supply_crate: null,
  fuel_drum: null,
  tech_wreck: null,
};

// ---------------------------------------------------------------------------
// DEATH & RESPAWN
// ---------------------------------------------------------------------------
export const DEATH = {
  /** Fraction of each stack of *basic resources* lost on death (tools & story items kept). */
  RESOURCE_LOSS_FRACTION: 0.25,
  /** Needs you respawn with. */
  RESPAWN_NEEDS: { health: 60, hunger: 50, thirst: 50, stamina: 100, temperature: 37.0 },
};

// ---------------------------------------------------------------------------
// DIFFICULTY
// ---------------------------------------------------------------------------
export const DIFFICULTY = {
  survivor: { drainMult: 1.0, damageMult: 1.0, label: 'Survivor' },
  hardcore: { drainMult: 1.35, damageMult: 1.5, label: 'Hardcore' },
} as const;

// ---------------------------------------------------------------------------
// WORLD & ZONE GEOMETRY (Spread-out island: ~520m diameter)
// ---------------------------------------------------------------------------
export const WORLD = {
  SEED: 1337,
  ISLAND_RADIUS: 260,
  WATER_LEVEL: 0.3,
  /** Latitude (z) separating the Act 1 starting cove (z > ACT1_RIDGE_Z) from the deep island interior. */
  ACT1_RIDGE_Z: 42,
  /** Latitude (z) guarding the Act 3 Caldera Research Station compound. */
  STATION_GATE_Z: -84,
  PLAYER_SPAWN: { x: 0, z: 146 },
  WRECK_POS: { x: 38, z: 132 },
  TIDE_POOLS_POS: { x: -68, z: 118 },
  SPRING_POS: { x: -34, z: 82 },
  PALM_COVE_POS: { x: 48, z: 86 },
  ABANDONED_CAMP_POS: { x: -56, z: 8 },
  JUNGLE_TAIL_POS: { x: 48, z: -12 },
  CAVE_GROTTO_POS: { x: -78, z: -48 },
  ANCIENT_RUINS_POS: { x: 76, z: -62 },
  RESEARCH_STATION_POS: { x: -16, z: -112 },
  BOAT_DOCK_POS: { x: -16, z: 154 },
  /** Real seconds between HUD/UI refreshes (React re-render cap ≈ 8 Hz). */
  UI_REFRESH_SEC: 0.12,
  /** Reach distance (m) for gathering / interacting. */
  INTERACT_RANGE: 3.5,
};

// ---------------------------------------------------------------------------
// SAVE SYSTEM & EXPLORATION MAP
// ---------------------------------------------------------------------------
export const SAVE = {
  VERSION: 2,
  STORAGE_KEY: 'stranded_survival_save_v1',
  /** Real seconds between automatic background saves while playing. */
  AUTOSAVE_REAL_SEC: 30,
  /** Width/height in meters of each Fog-of-War map cell. */
  MAP_CELL_SIZE: 15,
  /** Radius (m) around the player revealed automatically as they walk. */
  MAP_REVEAL_RADIUS_M: 28,
  /** Warmth / weather shelter radius (m) around a placed Palm Lean-To Shelter. */
  SHELTER_RADIUS_M: 3.8,
  /** Extra ambient cold inside damp basalt caves (°C). */
  CAVE_CHILL_C: 6.5,
};

// ---------------------------------------------------------------------------
// BASE BUILDING, FARMING, TRAPS & PRODUCTION TIMERS
// ---------------------------------------------------------------------------
export const BASE_BUILDING = {
  /** Radius (m) within which a Workbench or Forge enables crafting recipes. */
  STATION_RADIUS_M: 4.5,
  /** Maximum clean drinking water doses stored in one Rainwater Collector. */
  WATER_COLLECTOR_CAP: 4,
  /** In-game hours to condense 1 dose in dry air. */
  WATER_COLLECTOR_DRY_HOURS_PER_DOSE: 6.0,
  /** Speed multiplier when raining or storming. */
  WATER_COLLECTOR_RAIN_MULT: 5.5,
  /** In-game hours for a planted Farm Plot to ripen for harvest. */
  FARM_GROW_HOURS: 10.0,
  /** Yield when harvesting a ripe Farm Plot. */
  FARM_HARVEST_BERRIES: 4,
  FARM_HARVEST_FIBRE: 2,
  /** In-game hours for a Snare Trap to catch game meat. */
  SNARE_CATCH_HOURS: 8.0,
  /** In-game hours for a Lagoon Fish Trap to catch reef fish. */
  FISH_TRAP_CATCH_HOURS: 6.0,
  /** In-game hours to cure raw fish/meat into preserved jerky on a Drying Rack. */
  DRYING_CURE_HOURS: 4.5,
  /** Storage chest slot capacity. */
  STORAGE_SLOTS: 16,
  /** Stamina spent lunging at lagoon reef fish with a spear. */
  SPEAR_FISH_STAMINA: 7,
};

// ---------------------------------------------------------------------------
// WILDLIFE & INTERIOR HAZARDS
// ---------------------------------------------------------------------------
export const WILDLIFE = {
  /** Radius (m) within which wildlife becomes active. */
  ACTIVE_SIM_RADIUS_M: 75,
  /** Night multiplier on wildlife detection distance. */
  NIGHT_DETECTION_MULT: 1.35,
  /** In-game hours before killed wildlife respawns. */
  CRAB_RESPAWN_HOURS: 18,
  BOAR_RESPAWN_HOURS: 28,
  VIPER_RESPAWN_HOURS: 24,
  /** Viper venom sickness duration added on venomous bite (seconds). */
  VIPER_VENOM_SEC: 75,
};

// ---------------------------------------------------------------------------
// STAGE 6 — BOAT BUILDING (ACT 4) & OCEAN VOYAGE TO PORT SOLIS (ACT 5)
// ---------------------------------------------------------------------------
export const BOAT = {
  /** In-game hours advanced each time a boat construction stage finishes. */
  STAGE_BUILD_HOURS: 2.0,
  /** Sea-worthy preserved rations required in Stage 4 provisioning. */
  SEA_RATION_COUNT: 3,
  /** Planks & resin patch repair amount at sea / stopovers. */
  HULL_PATCH_AMOUNT: 28,
  /** Fuel % restored per Diesel Jerrycan poured into the outboard tank. */
  FUEL_PER_CAN_PCT: 45,
};

export const VOYAGE = {
  /** Total offshore nautical miles from the island slipway to Port Solis. */
  TOTAL_DISTANCE_NM: 12.0,
  /** Nautical miles marking transition from Act 4 into Act 5 (final storm crossing). */
  FINAL_ACT5_NM: 8.5,
  /** Base sailboat speed (nm / real sec). */
  SAIL_SPEED_NM_PER_SEC: 0.13,
  /** Outboard motor speed bonus multiplier when fueled. */
  MOTOR_SPEED_MULT: 1.75,
  /** Fuel % burned per real second while running the outboard motor. */
  MOTOR_FUEL_PER_SEC: 1.4,
  /** Hull damage per real second during heavy squalls when unbraced. */
  STORM_HULL_DRAIN_PER_SEC: 2.6,
  /** Hull damage reduction multiplier when crew selects "Brace Hull". */
  BRACE_DAMAGE_MULT: 0.28,
};

// ---------------------------------------------------------------------------
// VISUAL OVERHAUL — GRAPHICS, TERRAIN SPLAT/GRASS, COLLISION, FORGE & HUD TUNING
// ---------------------------------------------------------------------------
export const GRAPHICS_TUNING = {
  /** Base atmospheric exponential fog density in clear daylight. */
  BASE_FOG_DENSITY: 0.0021,
  /** Peak exponential fog density during tropical storms. */
  STORM_FOG_DENSITY: 0.0058,
  /** Dense turquoise underwater exponential fog density when submerged. */
  UNDERWATER_FOG_DENSITY: 0.048,
  UNDERWATER_FOG_COLOR: 0x0b4a5e,
  /** Temporal exponential smoothing rates (1/sec) for fog, weather atmosphere & diving transitions. */
  FOG_COLOR_DAMP_SPEED: 3.2,
  FOG_DENSITY_DAMP_SPEED: 2.6,
  WEATHER_ATMOSPHERE_DAMP_SPEED: 1.85,
  UNDERWATER_TRANSITION_SPEED: 9.0,
  /** Physical Sky shader defaults blended across time of day. */
  SKY_TURBIDITY_DAY: 2.2,
  SKY_TURBIDITY_DUSK: 7.4,
  SKY_RAYLEIGH_DAY: 1.18,
  SKY_RAYLEIGH_DUSK: 2.55,
  SKY_MIE_COEFFICIENT: 0.0032,
  SKY_MIE_DIRECTIONAL_G: 0.82,
  /** Layered volumetric-look cloud cover speed & density. */
  CLOUD_DRIFT_SPEED: 0.011,
  CLOUD_COVERAGE_CLEAR: 0.42,
  CLOUD_COVERAGE_STORM: 0.86,
  /** Storm horizon/fog slate tint that damps flat vivid sunset cutouts during heavy storms. */
  STORM_FOG_SLATE_COLOR: 0x455365,
  STORM_FOG_SLATE_BLEND: 0.72,
  /** Rain particle volume & camera-lens near-exclusion cylinder. */
  RAIN_DROP_COUNT: 520,
  RAIN_AREA_HALF_EXTENT: 24,
  RAIN_HEIGHT_RANGE: 22,
  RAIN_SPRITE_SIZE: 0.24,
  RAIN_NEAR_EXCLUSION_RADIUS: 2.8,
  /** Cascaded Shadow Maps config (High / Ultra). */
  CSM_CASCADES: 2,
  CSM_MAX_FAR: 125,
  /** Reflection render-target resolution (width/height) for ocean planar mirror. */
  WATER_REFLECTION_SIZE: 384,
  /** In-game hour delta threshold before refreshing procedural sky PMREM IBL probe. */
  IBL_REFRESH_HOURS: 0.35,
  /** Softened ACES Filmic exposure & grading (Phase 4.2: softer contrast, lifted shadows, warm sun, cool shadows). */
  TONE_EXPOSURE_DAY: 1.0,
  TONE_EXPOSURE_NIGHT: 0.72,
  GRADE_CONTRAST: 0.06,
  GRADE_SATURATION: 1.03,
  SHADOW_LIFT_FLOOR: 0.025,
  AMBIENT_HEMI_INTENSITY_DAY: 0.68,
  AMBIENT_HEMI_INTENSITY_NIGHT: 0.32,
  /** Bloom post-processing (high HDR threshold so only true fire/sun glints bloom, never sand). */
  BLOOM_STRENGTH: 0.11,
  BLOOM_RADIUS: 0.28,
  BLOOM_THRESHOLD: 1.24,
  /** Screen-space Ambient Occlusion pass parameters & adaptive optimization budgets. */
  SSAO_RESOLUTION_SCALE: 0.5,
  SSAO_KERNEL_SIZE: 16,
  SHADOW_UPDATE_STRIDE: 2,
  NODE_MIN_SHADOW_RADIUS: 1.05,
  SMALL_NODE_CULL_DIST_M: 120,
  BOULDER_MAX_CLIFF_DROP_M: 4.5,
  SSAO_KERNEL_RADIUS: 0.95,
  SSAO_MIN_DISTANCE: 0.00032,
  SSAO_MAX_DISTANCE: 0.0068,
  /** Subtle edge lens aberration, grain & vignette (only strong below 25% health). */
  CHROMATIC_ABERRATION_OFFSET: 0.0008,
  FILM_GRAIN_INTENSITY: 0.016,
  VIGNETTE_DARKNESS: 0.15,
  LOW_HEALTH_VIGNETTE_THRESHOLD: 25,
  /** Optional Depth of Field focus distance & aperture (Ultra). */
  DOF_FOCUS_DISTANCE: 22.0,
  DOF_APERTURE: 0.000045,
  DOF_MAX_BLUR: 0.0040,
  /** Floating sunlit dust motes count & hot-day shimmer. */
  DUST_MOTE_COUNT: 120,
  HEAT_SHIMMER_TEMP_C: 29.0,
  HEAT_SHIMMER_STRENGTH: 0.0014,
} as const;

export const MOVEMENT_TUNING = {
  /** Base walking speed on dry land (m/s). */
  WALK_SPEED_MPS: 5.5,
  /** Sprinting speed on dry land (m/s). */
  SPRINT_SPEED_MPS: 9.2,
  /** Crouch-walking speed (m/s). */
  CROUCH_SPEED_MPS: 2.9,
  /** Speed multiplier when wading in waist-deep water. */
  WADE_SPEED_MULT: 0.62,
  /** Speed multiplier when swimming in deep water. */
  SWIM_SPEED_MULT: 0.56,
  /** Speed multiplier when exhausted (stamina below EXHAUSTED_THRESHOLD). */
  EXHAUSTED_SPEED_MULT: 0.60,
  /** Velocity acceleration damping factor (1/sec) — smooth ramp-up (~0.15 s). */
  ACCEL_DAMPING: 13.5,
  /** Velocity deceleration damping factor (1/sec) — smooth coast to stop (~0.18 s). */
  DECEL_DAMPING: 11.0,
  /** Air control acceleration damping while airborne. */
  AIR_CONTROL_DAMPING: 4.2,
  /** Base world camera vertical FOV (degrees). */
  BASE_FOV_DEG: 68,
  /** Extra FOV boost when sprinting (degrees). */
  SPRINT_FOV_BOOST_DEG: 5,
  /** Dedicated FOV for the first-person arms & held-tool pass (degrees, prevents distortion). */
  FP_ARMS_FOV_DEG: 54,
  /** FOV transition damping speed (1/sec). */
  FOV_LERP_SPEED: 8.5,
  /** Mouse-look exponential smoothing factor (1/sec) for weight without lag. */
  MOUSE_LOOK_SMOOTHING: 28.0,
  /** Standing eye height above ground (meters). */
  EYE_HEIGHT_STAND_M: 1.65,
  /** Crouching eye height above ground (meters). */
  EYE_HEIGHT_CROUCH_M: 1.08,
  /** Crouch transition damping speed (1/sec). */
  CROUCH_LERP_SPEED: 10.0,
  /** Upward jump velocity (m/s). */
  JUMP_VELOCITY_MPS: 6.3,
  /** Gravity acceleration (m/s²). */
  GRAVITY_MPS2: 17.5,
} as const;

export const STANCE_TUNING = {
  /** Camera eye height above foot level for each stance (metres). */
  EYE_HEIGHT_STAND_M: 1.65,
  EYE_HEIGHT_CROUCH_M: 1.08,
  EYE_HEIGHT_PRONE_M: 0.42,
  EYE_HEIGHT_SIT_M: 0.85,
  EYE_HEIGHT_SLEEP_M: 0.34,

  /** Physical standing/capsule headroom required above foot level to occupy a stance (metres). */
  CLEARANCE_STAND_M: 1.76,
  CLEARANCE_CROUCH_M: 1.18,
  CLEARANCE_SIT_M: 1.05,
  CLEARANCE_PRONE_M: 0.54,

  /** Horizontal movement speeds per stance (m/s). */
  SPEED_STAND_WALK_MPS: 5.0,
  SPEED_STAND_SPRINT_MPS: 8.1,
  SPEED_CROUCH_MPS: 2.95,
  SPEED_PRONE_MPS: 1.45,

  /** Eye-height / stance blend transition damping speed (0.3-0.6 s smooth transitions). */
  EYE_LERP_SPEED: 10.5,
  STANCE_BLEND_SPEED: 8.5,

  /** Hold C duration (sec) to drop from crouch/stand into prone (tapping Z also toggles prone). */
  HOLD_C_FOR_PRONE_SEC: 0.38,

  /** Resting stamina & fire-warmth multipliers while sitting/prone. */
  SIT_STAMINA_REGEN_MULT: 1.85,
  PRONE_STAMINA_REGEN_MULT: 1.25,
  SIT_NEAR_FIRE_WARMTH_MULT: 1.65,
  COMFORT_SEAT_RADIUS_M: 3.4,

  /** Noise / detection multipliers per stance (lower = harder for wildlife to spot). */
  PRONE_NOISE_MULT: 0.35,
  CROUCH_NOISE_MULT: 0.58,
  STAND_NOISE_MULT: 1.0,

  /** Cinematic sleep transition durations (sec). */
  SLEEP_LIEDOWN_SEC: 0.55,
  SLEEP_BLACK_HOLD_SEC: 0.45,
  SLEEP_WAKEUP_SEC: 0.60,
} as const;

export const ACTION_TUNING = {
  /** Action IK animation durations (sec). */
  EAT_DURATION_SEC: 0.85,
  DRINK_BOTTLE_DURATION_SEC: 0.90,
  DRINK_SPRING_DURATION_SEC: 1.05,
  BANDAGE_DURATION_SEC: 1.15,
  MAP_GLANCE_DURATION_SEC: 0.48,
  HEAT_WIPE_DURATION_SEC: 0.80,
  COUGH_DURATION_SEC: 0.58,
  CRAFT_DURATION_SEC: 0.68,
  PLACE_DURATION_SEC: 0.52,

  /** Felled tree physics & carved stump persistence. */
  TREE_FALL_GRAVITY_TORQUE: 2.85,
  TREE_FALL_REST_SEC: 3.0,
  TREE_FALL_DISSOLVE_SEC: 1.25,
  TREE_BOUNCE_RESTITUTION: 0.22,

  /** Swim breaststroke stroke period & physiological cadence timers (sec). */
  SWIM_STROKE_CYCLE_RAD_PER_SEC: 5.2,
  SHIVER_SFX_INTERVAL_SEC: 7.5,
  HEAT_WIPE_INTERVAL_SEC: 14.0,
  COUGH_INTERVAL_SEC: 13.5,
  HOT_BROW_WIPE_AMBIENT_C: 33.0,
  BANDAGE_HEAL_THRESHOLD_HP: 88,
} as const;

export const PART5_IMMERSION_TUNING = {
  /** Ocean lunar tide oscillation amplitude (metres around WORLD.WATER_LEVEL) & period in game hours. */
  TIDE_AMPLITUDE_M: 0.42,
  TIDE_CYCLE_HOURS: 12.4,

  /** Underwater submersion oxygen drain/recovery (0..100%) and drowning health drain per sec. */
  UNDERWATER_EYE_SUBMERGE_OFFSET_M: 0.08,
  OXYGEN_MAX: 100,
  OXYGEN_DRAIN_PER_SEC: 5.5,
  OXYGEN_RECOVER_PER_SEC: 24.0,
  DROWNING_DAMAGE_PER_SEC: 9.0,

  /** Skin/clothing grime, blood, and rain/swim wash & sun drying rates (0..1/sec). */
  DIRT_GAIN_PER_ACTION: 0.085,
  DIRT_GAIN_PRONE_PER_SEC: 0.045,
  BLOOD_GAIN_ON_HIT: 0.38,
  WASH_RATE_SWIM: 0.58,
  WASH_RATE_WADE: 0.25,
  WASH_RATE_RAIN: 0.14,
  DRY_RATE_SUN: 0.045,

  /** Low HP audio lowpass & heartbeat BPM bounds. */
  LOW_HP_AUDIO_THRESHOLD: 32,
  HEARTBEAT_MIN_BPM: 68,
  HEARTBEAT_MAX_BPM: 124,

  /** Cold-breath ambient °C threshold, camera lens droplet dry time, and Photo Mode tuning. */
  COLD_BREATH_AMBIENT_C: 12.0,
  RAIN_DROPLET_DECAY_SEC: 3.6,
  PHOTO_FLY_SPEED_MPS: 9.0,
  PHOTO_FLY_MAX_DIST_M: 28.0,
  PHOTO_FILTER_NAMES: ['Natural', 'Warm Sunset', 'Gritty Noir', 'Tropical Vivid'] as const,
} as const;

export const ANIMATION_TUNING = {
  /** Idle breathing cycle frequency (rad/sec) and vertical amplitude (m). */
  IDLE_BREATH_FREQ: 1.65,
  IDLE_BREATH_AMP_Y: 0.0045,
  IDLE_SWAY_AMP_X: 0.0032,
  /** Walk head-bob & hand-sway frequency (rad/sec) and amplitudes. */
  WALK_BOB_FREQ: 8.2,
  WALK_BOB_AMP_Y: 0.022,
  WALK_BOB_AMP_X: 0.014,
  /** Sprint head-bob & hand-sway frequency (rad/sec) and amplitudes. */
  SPRINT_BOB_FREQ: 12.4,
  SPRINT_BOB_AMP_Y: 0.042,
  SPRINT_BOB_AMP_X: 0.028,
  /** Crouch-walk head-bob frequency and amplitude. */
  CROUCH_BOB_FREQ: 5.8,
  CROUCH_BOB_AMP_Y: 0.012,
  /** Mouse-look procedural hand lag & recovery damping (1/sec). */
  HAND_SWAY_LAG_SCALE: 0.032,
  HAND_SWAY_MAX_OFFSET: 0.065,
  HAND_SWAY_DAMPING: 12.0,
  /** Jump anticipation camera/hand dip duration (sec) and depth (m). */
  JUMP_DIP_DURATION_SEC: 0.09,
  JUMP_DIP_DEPTH_M: 0.06,
  /** Landing impact camera/hand spring compression max depth (m) and recovery speed (1/sec). */
  LAND_DIP_MAX_M: 0.16,
  LAND_DIP_RECOVERY_SPEED: 9.5,
  /** Chop / harvest swing total duration (sec) and impact hit fraction (0–1). */
  CHOP_SWING_DURATION_SEC: 0.60,
  CHOP_IMPACT_PHASE: 0.45,
  /** Satisfying item pick-up animation duration (sec) and hold-E repeat interval (sec). */
  PICKUP_DURATION_SEC: 0.50,
  HOLD_E_REPEAT_INTERVAL_SEC: 0.45,
  /** Crossfade duration (sec) when blending between skeletal NLA clips. */
  CLIP_CROSSFADE_SEC: 0.18,
} as const;

export const PERFORMANCE_TUNING = {
  /** Default frame rate cap (FPS) so laptop runs cool and quiet. */
  DEFAULT_FPS_LIMIT: 60,
  /** Available FPS cap choices (0 = uncapped). */
  FPS_CAP_OPTIONS: [30, 60, 0] as const,
  /** Automatic FPS cap when browser window loses focus. */
  UNFOCUSED_FPS_LIMIT: 30,
  /** Alias used by scene frame pacing. */
  BACKGROUND_FPS_CAP: 30,
  /** Automatic FPS cap while game is paused or a full-screen menu is open. */
  PAUSED_MENU_FPS_LIMIT: 10,
  /** Alias used by scene frame pacing. */
  MENU_OPEN_FPS_CAP: 10,
  /** Dynamic resolution threshold: lower internal render scale slightly if FPS stays below this. */
  DYNAMIC_RES_LOW_FPS_THRESHOLD: 45,
  DYNAMIC_RES_RECOVER_FPS: 52,
  DYNAMIC_RES_MIN_SCALE: 0.65,
  /** Skip dynamic resolution downscaling during initial shader/asset warmup (ms). */
  DYNAMIC_RES_WARMUP_MS: 3500,
  DYNAMIC_RES_STEP_DOWN: 0.04,
  DYNAMIC_RES_STEP_UP: 0.05,
  /** Maximum devicePixelRatio per quality preset (critical for Retina Mac thermal control). */
  PIXEL_RATIO_CAP_LOW: 1.0,
  PIXEL_RATIO_CAP_MEDIUM: 1.25,
  PIXEL_RATIO_CAP_HIGH: 1.5,
  PIXEL_RATIO_CAP_ULTRA: 1.5,
} as const;

export const TERRAIN_TUNING = {
  /** Elevation above Y=0 sea level stayed darkened as wet wave-wash sand. */
  WET_SAND_MAX_Y: 0.55,
  /** Transition zone boundaries blending rippled dry sand -> soil/pebbles -> grass (with FBM noise). */
  SAND_TO_GRASS_START_Y: 1.42,
  SAND_TO_GRASS_END_Y: 3.10,
  /** Minimum world height and normal slope threshold where basalt rock cliffs dominate. */
  ROCK_CLIFF_MIN_Y: 6.2,
  ROCK_SLOPE_COS_THRESHOLD: 0.72,
  /** World-space UV repeat frequencies per material class. */
  SAND_UV_SCALE: 0.22,
  GRASS_UV_SCALE: 0.18,
  ROCK_UV_SCALE: 0.16,
  BARK_UV_SCALE: 0.45,
  WOOD_UV_SCALE: 0.62,
  METAL_UV_SCALE: 0.35,
  /** Base 3D instanced grass blade count (scaled by quality preset grassDensity). */
  GRASS_BLADE_BASE_COUNT: 24000,
  GRASS_MIN_HEIGHT: 0.22,
  GRASS_MAX_HEIGHT: 0.56,
  GRASS_WIND_SPEED: 1.85,
  GRASS_LOD_FADE_START: 46,
  GRASS_LOD_FADE_END: 84,
  /** Natural ground scatter prop budgets (scaled cleanly with grass/detail density). */
  GROUND_DETAIL_SHELLS: 460,
  GROUND_DETAIL_PEBBLES: 680,
  GROUND_DETAIL_TWIGS: 300,
  GROUND_DETAIL_FERNS: 420,
} as const;

export const COLLISION_TUNING = {
  /** Horizontal player collision cylinder radius (meters). */
  PLAYER_RADIUS: 0.44,
  /** Default tree trunk collision radius (meters). */
  TREE_TRUNK_RADIUS: 0.42,
  /** Maximum terrain vertical step delta per horizontal meter considered walkable without blocking. */
  MAX_SLOPE_RISE_PER_M: 1.08,
  /** Minimum horizontal clearance maintained around camera vs solid walls. */
  CAMERA_CLEARANCE_RADIUS: 0.3,
  /** Minimum vertical clearance kept between camera eye and sampled ground/cliff surface. */
  CAMERA_MIN_TERRAIN_CLEARANCE: 0.42,
} as const;

export const FORGE_TUNING = {
  /** Seconds required for the Stone Forge to kiln-cure 1 raw Wood into 1 Driftwood. */
  WOOD_TO_DRIFTWOOD_SEC: 6.0,
  /** Maximum queued wood logs/sticks buffered inside a single forge kiln at once. */
  MAX_QUEUE_WOOD: 12,
  /** Active kiln ember glow peak intensity and smoke particle emission cadence. */
  EMBER_GLOW_INTENSITY: 2.6,
  SMOKE_SPAWN_INTERVAL_SEC: 0.22,
} as const;

export const HUD_TUNING = {
  /** Controls hint bar automatically fades away after this many seconds (toggle anytime with H). */
  HINT_AUTO_HIDE_SEC: 4.5,
  /** Smooth fade/slide duration (ms) for menus, modals, tooltips, and prompts. */
  UI_FADE_DURATION_MS: 220,
  /** Duration (ms) that "+1 Item" pickup popups remain visible near the hotbar. */
  PICKUP_TOAST_DURATION_MS: 1600,
  /** Minimal HUD auto-fade thresholds & delays. */
  VITALS_FADE_DELAY_SEC: 4.5,
  VITALS_HEALTH_SHOW_THRESHOLD: 95,
  VITALS_NEEDS_SHOW_THRESHOLD: 85,
  VITALS_STAMINA_SHOW_THRESHOLD: 92,
  COMPASS_FADE_DELAY_SEC: 5.0,
  AREA_BANNER_DURATION_SEC: 2.6,
  TIP_AUTO_HIDE_SEC: 4.5,
} as const;

export const IK_SWAY_TUNING = {
  /** Two-bone IK arm stretch limit when grip point is slightly out of reach (1.045 = 4.5% soft stretch). */
  MAX_ARM_STRETCH: 1.045,
  /** Shoulder -> elbow pole targets relative to camera local space (natural downward/outward elbows). */
  ELBOW_POLE_R: [0.42, -0.58, 0.14] as const,
  ELBOW_POLE_L: [-0.42, -0.58, 0.14] as const,
  /** Blend speed (per second) for two-bone IK target smoothing & offhand engage/disengage. */
  IK_TARGET_BLEND_SPEED: 16.0,

  /** Spring-damper Modern Warfare camera-turn weapon/hand inertia. */
  INERTIA_STIFFNESS: 145.0,
  INERTIA_DAMPING: 18.5,
  INERTIA_INPUT_SCALE_X: 0.0022,
  INERTIA_INPUT_SCALE_Y: 0.0020,
  INERTIA_MAX_OFFSET: 0.042,
  INERTIA_ROT_YAW_MULT: 2.4,
  INERTIA_ROT_PITCH_MULT: 2.2,
  INERTIA_ROT_ROLL_MULT: 1.6,

  /** Figure-8 Lissajous walk & sprint movement bob. */
  WALK_BOB_AMP_X: 0.011,
  WALK_BOB_AMP_Y: 0.010,
  WALK_BOB_FREQ: 8.6,
  SPRINT_BOB_MULT: 1.85,
  SPRINT_DROP_Y: -0.055,
  SPRINT_FORWARD_Z: 0.035,
  SPRINT_TILT_PITCH: -0.18,
  SPRINT_TILT_YAW: 0.52,
  SPRINT_TILT_ROLL: 0.24,
  SPRINT_POSE_BLEND_SPEED: 10.5,

  /** Subtle idle breathing cycle. */
  BREATH_AMP_Y: 0.0038,
  BREATH_AMP_PITCH: 0.009,
  BREATH_FREQ_RAD: 1.75,

  /** Wall / tree / prop avoidance raycast pullback (prevents clipping into nearby solids). */
  WALL_AVOID_RAY_DIST: 0.72,
  WALL_PULLBACK_MAX_Z: 0.22,
  WALL_PULLBACK_MAX_Y: -0.07,
  WALL_PULLBACK_PITCH: 0.42,
  WALL_AVOID_BLEND_SPEED: 15.0,

  /** Melee / chop impact stop + recoil kick so tools stop on contact and never clip through trunks. */
  IMPACT_HITSTOP_SEC: 0.068,
  IMPACT_RECOIL_BACK_Z: 0.095,
  IMPACT_RECOIL_PITCH: 0.28,
  IMPACT_RECOIL_DECAY_SPEED: 14.0,

  /** Smooth weapon/item equip raise & ranged firing kick. */
  EQUIP_DRAW_SPEED: 11.5,
  EQUIP_DRAW_DROP_Y: 0.13,
  WEAPON_RECOIL_KICK_Z: 0.075,
  WEAPON_RECOIL_PITCH: 0.16,
  WEAPON_RECOIL_DECAY_SPEED: 16.0,

  /** Inspect item (F on non-consumables or T anytime). */
  INSPECT_DURATION_SEC: 3.4,
  INSPECT_POS_OFFSET: [-0.09, 0.05, 0.14] as const,
  INSPECT_ROT_SPEED: 1.55,
  /** Downward shoulder pitch (rad) keeping the idle offhand cleanly below the bottom hotbar in 1H grips. */
  OFFHAND_1H_DROP_PITCH: 0.48,
} as const;

export const BODY_IK_TUNING = {
  /** Offset full player body backward behind camera eye origin so looking down shows chest, hips & feet cleanly. */
  BODY_BACK_OFFSET_M: 0.22,
  /** Height above foot target from which downward Foot IK raycast starts, and max probe length. */
  FOOT_RAY_HEIGHT_ABOVE: 0.90,
  FOOT_RAY_MAX_DIST: 1.50,
  /** Hip lowering multiplier when one foot stands lower on a slope or step (0.5..0.75). */
  HIP_DROP_SLOPE_FACTOR: 0.62,
  MAX_HIP_DROP_M: 0.28,
  HIP_SMOOTH_SPEED: 14.0,
  /** Speed at which feet plant to terrain normals and step arc height/stride. */
  FOOT_PLANT_SMOOTH_SPEED: 18.0,
  FOOT_STRIDE_LENGTH: 0.34,
  FOOT_STRIDE_LIFT: 0.10,

  /** Torso lean multipliers for turning, lateral strafing, and terrain slope pitch. */
  LEAN_TURN_SCALE: 0.14,
  LEAN_STRAFE_SCALE: 0.09,
  LEAN_SLOPE_SCALE: 0.20,

  /** Sand footprint trail pool & fading. */
  FOOTPRINT_POOL_SIZE: 72,
  FOOTPRINT_FADE_SEC: 18.0,
  FOOTPRINT_SAND_MAX_Y: 3.20,
  FOOTPRINT_STEP_INTERVAL_DIST: 0.72,

  /** Limp when health is low or after a heavy fall. */
  LIMP_HEALTH_THRESHOLD: 32,
  LIMP_FALL_DURATION_SEC: 4.5,
  LIMP_SPEED_MULT: 0.78,
  LIMP_DIP_AMPLITUDE: 0.048,
  LIMP_ROLL_RAD: 0.042,

  /** Simplified GTA Euphoria limb stiffness reactions (stumble, fall flail, landing brace). */
  EUPHORIA_HIT_STIFFNESS: 0.24,
  EUPHORIA_FALL_FLAIL_STIFFNESS: 0.34,
  EUPHORIA_LAND_BRACE_DIST_M: 2.0,
  EUPHORIA_RECOVERY_RATE: 3.4,
} as const;

export const WORLD_VISUAL_TUNING = {
  /** Layered Blender storm-break cloud panorama blending & drift. */
  STORM_CLOUD_DRIFT_SPEED: 0.0022,
  STORM_CLOUD_OPACITY: 0.96,
  STORM_CLOUD_CONTRAST: 1.24,
  STORM_CLOUD_SUN_RIM_BOOST: 0.44,

  /** High-contrast storm-break sun lighting & canyon shadow shaping. */
  SUN_KEY_INTENSITY_DAY: 1.78,
  SUN_KEY_Z_BIAS_M: 26,
  CLIFF_MICRO_DETAIL_SCALE: 0.19,
  CLIFF_MICRO_NORMAL_STRENGTH: 0.92,
  CLIFF_AO_INTENSITY: 0.86,
  CLIFF_ENV_INTENSITY: 0.34,
  TERRAIN_MACRO_BLEND_WEIGHT: 0.68,

  /** Exponential valley depth haze + forward Mie sun scatter on distant cliffs. */
  HAZE_HEIGHT_FALLOFF: 0.026,
  HAZE_HEIGHT_DENSITY: 0.72,
  HAZE_SUN_GLOW_POWER: 5.5,
  HAZE_SUN_GLOW_STRENGTH: 0.42,

  /** Screen-space volumetric sun shafts (god rays) breaking past cliffs & clouds. */
  GODRAY_INTENSITY_ULTRA: 0.42,
  GODRAY_INTENSITY_HIGH: 0.32,
  GODRAY_INTENSITY_MEDIUM: 0.20,
  GODRAY_DECAY: 0.94,
  GODRAY_DENSITY: 0.84,
  GODRAY_WEIGHT: 0.36,
  GODRAY_SAMPLES_ULTRA: 22,
  GODRAY_SAMPLES_HIGH: 14,

  /** Chunked InstancedMesh vegetation grid, LODs & wind sway (11,601 Blender instances). */
  VEG_CHUNK_GRID_N: 5,
  VEG_GRASS_FADE_START_M: 42,
  VEG_GRASS_FADE_END_M: 88,
  VEG_SHRUB_FADE_START_M: 76,
  VEG_SHRUB_FADE_END_M: 148,
  VEG_FERN_LOD1_DIST_M: 52,
  VEG_PALM_LOD1_DIST_M: 92,
  VEG_WIND_SWAY_SPEED: 1.95,
  VEG_WIND_SWAY_AMP: 0.085,
  VEG_BACKLIT_TRANSLUCENCY: 0.38,

  /** Terrain mesh grid resolution caps per quality preset to maintain 60 FPS Ultra. */
  TERRAIN_SEGMENTS_LOW: 128,
  TERRAIN_SEGMENTS_MEDIUM: 168,
  TERRAIN_SEGMENTS_HIGH: 224,
  TERRAIN_SEGMENTS_ULTRA: 224,
} as const;

// ---------------------------------------------------------------------------
// COMBAT SYSTEM & WEAPON TUNING (Lavans Bali Showdown + Survival Defense)
// ---------------------------------------------------------------------------
export const COMBAT_TUNING = {
  /** Hold LMB duration (sec) that upgrades a click into a charged heavy attack. */
  HEAVY_HOLD_THRESHOLD_SEC: 0.26,
  /** Light attack cooldown & stamina cost. */
  LIGHT_COOLDOWN_SEC: 0.42,
  LIGHT_STAMINA_COST: 7,
  /** Heavy attack cooldown, damage multiplier, poise damage multiplier, stamina cost. */
  HEAVY_COOLDOWN_SEC: 0.72,
  HEAVY_DAMAGE_MULT: 2.05,
  HEAVY_POISE_MULT: 2.5,
  HEAVY_STAMINA_COST: 16,
  /** Brief impact hit-stop freeze duration (sec) for melee/heavy punchiness. */
  HIT_STOP_SEC: 0.042,

  /** Block damage reduction & timed parry window (sec). */
  BLOCK_DAMAGE_MULT: 0.30,
  BLOCK_STAMINA_HIT_COST: 9,
  PARRY_WINDOW_SEC: 0.24,

  /** Dodge roll burst movement, invulnerability window, cooldown & stamina cost. */
  DODGE_DURATION_SEC: 0.42,
  DODGE_IFRAME_SEC: 0.34,
  DODGE_COOLDOWN_SEC: 0.68,
  DODGE_SPEED_MPS: 13.5,
  DODGE_STAMINA_COST: 18,

  /** Bow draw timing & projectile speeds (m/s). */
  BOW_MAX_DRAW_SEC: 0.65,
  BOW_MIN_DRAW_SEC: 0.16,
  ARROW_SPEED_MPS: 44.0,
  ARROW_GRAVITY_MPS2: 8.6,
  FIRE_BOMB_SPEED_MPS: 21.0,
  FLARE_SPEED_MPS: 56.0,
  AURA_RIFLE_SPEED_MPS: 78.0,
  HARPOON_SPEED_MPS: 54.0,
  SPEAR_THROW_SPEED_MPS: 24.0,

  /** Base damage by equipped item id. */
  WEAPON_DAMAGE: {
    bare_hands: 7,
    stone_axe: 16,
    stone_pick: 14,
    machete: 24,
    spear: 28,
    metal_axe: 27,
    metal_pick: 21,
    torch: 15,
    bow_min: 18,
    bow_full: 48,
    fire_bomb: 95,
    flare_gun: 130,
    aura_rifle: 84,
    harpoon_gun: 112,
    lockpick: 6,
  } as const,
} as const;

// ---------------------------------------------------------------------------
// NON-LINEAR STORY: DANIEL COMPANION, POWERS, STRONGHOLD HEIST & PRISON
// ---------------------------------------------------------------------------
export const COMPANION_TUNING = {
  SPAWN_POS: { x: -75, z: -46 }, // Deep inside Western Basalt Caves
  START_TRUST: 22,
  TRUST_FEED_DELTA: 16,
  TRUST_WATER_DELTA: 14,
  TRUST_HEAL_DELTA: 22,
  TRUST_TALK_DELTA: 6,
  TRUST_NEGLECT_DELTA: -10,
  TRUST_HARM_DELTA: -22,
  HIGH_TRUST_THRESHOLD: 65,
  RESCUE_TRUST_THRESHOLD: 50,
  FOLLOW_MIN_DIST_M: 3.2,
  FOLLOW_MAX_TELEPORT_M: 46,
  WALK_SPEED_MPS: 4.4,
  RUN_SPEED_MPS: 6.8,
  GATHER_INTERVAL_SEC: 14,
  GUARD_RADIUS_M: 12,
  ATTACK_DAMAGE: 18,
  ATTACK_COOLDOWN_SEC: 1.35,
  MAX_HEALTH: 120,
  HUNGER_DRAIN_PER_HOUR: 3.2,
  THIRST_DRAIN_PER_HOUR: 4.2,
  BOAT_REBUILD_SPEED_MULT: 1.75,
} as const;

export const POWER_TUNING = {
  SHRINES: [
    {
      id: 'aura_ward' as const,
      name: 'Shrine of the Aura Ward',
      description: 'Absorbs 35% incoming Aura & lightning damage permanently.',
      x: 52,
      z: 36,
      requirementText: 'Open to any survivor — commune at the eastern coastal overlook shrine.',
    },
    {
      id: 'tempest_dash' as const,
      name: 'Shrine of Tempest Dash',
      description: 'Empowers [Q] Dodge with longer shadow-step lunge & extended invulnerability.',
      x: -54,
      z: 22,
      requirementText: 'Traverse the wet mist cliffs west of the freshwater valley.',
    },
    {
      id: 'sovereign_cleave' as const,
      name: 'Shrine of Sovereign Cleave',
      description: 'Press [K] to unleash a golden shockwave breaking Aura guards & shattering shields.',
      x: 74,
      z: -60,
      requirementText: 'Offer 1x Aura Shard OR solve the Ancient Ruins alignment.',
    },
    {
      id: 'aura_sight' as const,
      name: 'Shrine of Aura Sight',
      description: 'Press [T] to sense The Aura King & patrolling Shades through jungle and walls.',
      x: -76,
      z: -54,
      requirementText: 'Deep within Western Basalt Caves beyond Daniel’s shelter.',
    },
  ],
  AURA_WARD_DAMAGE_MULT: 0.65,
  TEMPEST_DASH_SPEED_MULT: 1.42,
  TEMPEST_DASH_IFRAME_MULT: 1.5,
  CLEAVE_COOLDOWN_SEC: 10.0,
  CLEAVE_RADIUS_M: 7.5,
  CLEAVE_DAMAGE: 56,
  SIGHT_DURATION_SEC: 14.0,
  SIGHT_COOLDOWN_SEC: 18.0,
} as const;

export const AURA_AI_TUNING = {
  PATROL_WAYPOINTS: [
    { x: -16, z: -102 }, // Caldera Stronghold courtyard
    { x: 46, z: -64 },   // Eastern ruins ridge
    { x: 18, z: -14 },   // Central valley high crest
    { x: -58, z: -26 },  // Outer cave ravine overlook
    { x: -120, z: -38 }, // Western cliff shelf
  ],
  PATROL_SPEED_MPS: 3.4,
  HUNT_SPEED_MPS: 5.8,
  BASE_DETECT_RADIUS_M: 28,
  GUARD_VISION_RANGE_M: 18,
  GUARD_VISION_FOV_COS: 0.45, // ~63 deg half cone
  CROUCH_VISIBILITY_MULT: 0.48,
  PRONE_VISIBILITY_MULT: 0.24,
  NIGHT_VISIBILITY_MULT: 0.58,
  STORM_VISIBILITY_MULT: 0.65,
  CAMPFIRE_BEACON_MULT: 1.45,
  THEFT_SUSPICION_SPIKE: 68,
  CATCH_RADIUS_M: 3.2,
  PATROL_RESPAWN_HOURS: 6,
} as const;

export const PRISON_TUNING = {
  /** Stronghold coordinates align with stronghold_citadel.glb at RESEARCH_STATION_POS (-16, -112) */
  STRONGHOLD_POS: { x: -16, z: -112 },
  CELL_WORLD_POS: { x: -23.5, z: -115.5 },
  LOCKER_WORLD_POS: { x: -20.2, z: -114.6 },
  VENT_EXIT_WORLD_POS: { x: -27.8, z: -117.2 },
  ARMORY_RIFLE_POS: { x: -9.5, z: -108.8 },
  ARMORY_HARPOON_POS: { x: -9.5, z: -112.2 },
  DANIEL_RESCUE_HOURS_WAIT: 2.0,
  HIGH_ALERT_DURATION_HOURS: 8.0,
} as const;

// ---------------------------------------------------------------------------
// FINAL BOSS FIGHT — LAVANS BALI, THE AURA KING
// ---------------------------------------------------------------------------
export const BOSS_TUNING = {
  DISPLAY_NAME: 'THE AURA KING',
  ACHIEVEMENT_NAME: 'Dethroned the Aura King',

  /** Phase 1–2 Shore Sanctum center on the secluded Western Cliff Cove (far from Flight 404 Beach). */
  ARENA_CENTER_X: -140,
  ARENA_CENTER_Z: -40,
  ARENA_RADIUS_M: 28,
  DOCK_TRIGGER_RADIUS_M: 9.0,

  /** Night cliffside silhouette foreshadowing position overlooking the central island valley (Acts 2-4). */
  WATCHER_CLIFF_POS: { x: 26, z: -24 },
  WATCHER_VANISH_DIST_M: 22,

  /** Phase transition HP ratios. */
  PHASE2_HP_RATIO: 0.66,
  PHASE3_HP_RATIO: 0.33,

  /** Difficulty presets scaling HP, outgoing damage, and incoming player damage. */
  DIFFICULTIES: {
    easy: {
      label: 'Story / Easy',
      description: 'More forgiving hits and faster Aura breaks.',
      maxHp: 1350,
      bossDmgMult: 0.65,
      playerDmgMult: 1.25,
      attackRateMult: 0.85,
    },
    normal: {
      label: 'Survivor / Normal',
      description: 'Intended epic multi-phase showdown (8–12 min).',
      maxHp: 2100,
      bossDmgMult: 1.0,
      playerDmgMult: 1.0,
      attackRateMult: 1.0,
    },
    hard: {
      label: 'Sovereign / Hard',
      description: 'Relentless storm aggression, lethal aura waves.',
      maxHp: 2900,
      bossDmgMult: 1.4,
      playerDmgMult: 0.85,
      attackRateMult: 1.18,
    },
  } as const,

  /** Weak-point & environmental hazard multipliers. */
  STAGGER_DURATION_SEC: 3.6,
  STAGGER_DAMAGE_MULT: 1.65,
  PHASE2_CRYSTAL_SHIELD_DR: 0.56,
  PHASE3_FLARE_WEAKPOINT_MULT: 2.15,
  EXPLOSIVE_BARREL_DAMAGE: 210,
  EXPLOSIVE_BARREL_RADIUS_M: 6.2,
  CRYSTAL_HP: 80,

  /** Boss attack timings & damage values (scaled by difficulty). */
  MELEE_WINDUP_SEC: 0.72,
  MELEE_DAMAGE: 22,
  MELEE_RANGE_M: 3.6,
  SHOCKWAVE_WINDUP_SEC: 1.05,
  SHOCKWAVE_DAMAGE: 28,
  SHOCKWAVE_MAX_RADIUS_M: 18,
  SHOCKWAVE_SPEED_MPS: 13.5,
  ORB_DAMAGE: 16,
  ORB_SPEED_MPS: 15.5,
  ORB_COOLDOWN_SEC: 4.2,

  /** Phase 2 Aura Shades & Phase 3 Boat Arena tuning. */
  SHADE_MAX_COUNT: 3,
  SHADE_HP: 65,
  SHADE_SPEED_MPS: 4.3,
  SHADE_DAMAGE: 11,

  /** Cutscene & slow-mo final blow timings. */
  INTRO_DURATION_SEC: 4.4,
  PHASE2_CUTSCENE_SEC: 3.2,
  PHASE3_TRANSITION_SEC: 3.4,
  DEFEAT_CUTSCENE_SEC: 5.2,
  FINISHER_SLOWMO_SCALE: 0.24,
  FINISHER_SLOWMO_REAL_SEC: 1.35,

  /** Pooled VFX capacities (zero per-frame heap allocation on Ultra 60 FPS). */
  POOL_AURA_ORBS: 14,
  POOL_SHOCKWAVES: 4,
  POOL_PLAYER_PROJECTILES: 12,
  POOL_VFX_PARTICLES: 160,
} as const;

/** Playable Flight 404 Plane Crash Opening Sequence timings, camera limits, and cues. */
export const INTRO_TUNING = {
  /** Stage durations in seconds (total ~105s = 1.75 min playable intro). */
  CALM_DURATION_SEC: 26,
  STORM_DURATION_SEC: 36,
  BREAKUP_CABIN_SEC: 9,
  CRASH_VIDEO_SEC: 9,
  IMPACT_BLACKOUT_SEC: 5,
  WAKEUP_DURATION_SEC: 18,
  /** Derived cumulative phase timestamps. */
  get STORM_START_SEC() {
    return this.CALM_DURATION_SEC;
  },
  get BREAKUP_START_SEC() {
    return this.CALM_DURATION_SEC + this.STORM_DURATION_SEC;
  },
  get VIDEO_START_SEC() {
    return this.BREAKUP_START_SEC + this.BREAKUP_CABIN_SEC;
  },
  get BLACKOUT_START_SEC() {
    return this.VIDEO_START_SEC + this.CRASH_VIDEO_SEC;
  },
  get WAKEUP_START_SEC() {
    return this.BLACKOUT_START_SEC + this.IMPACT_BLACKOUT_SEC;
  },
  get TOTAL_DURATION_SEC() {
    return this.WAKEUP_START_SEC + this.WAKEUP_DURATION_SEC;
  },
  /** Key dramatic beats inside Stage B (relative to intro elapsedSec). */
  OXYGEN_DROP_SEC: 34,
  OVERHEAD_BIN_OPEN_SEC: 41,
  BULKHEAD_SPARK_SEC: 47,
  /** Hold Spacebar duration (seconds) to skip the intro cleanly. */
  SKIP_HOLD_SEC: 1.0,
  /** Seated window seat 4A eye position inside flight404_cabin.glb (Three.js Y-up space). */
  CABIN_EYE_X: -0.96,
  CABIN_EYE_Y: 1.24,
  CABIN_EYE_Z: 0.78,
  CABIN_LOOK_MAX_YAW_RAD: 1.55,
  CABIN_LOOK_MAX_PITCH_RAD: 0.56,
  /** Wake-up eye position & facing direction toward Flight 404 beach wreckage. */
  WAKE_START_EYE_HEIGHT_M: 0.36,
  WAKE_YAW_FACING_WRECK: -0.58,
} as const;
