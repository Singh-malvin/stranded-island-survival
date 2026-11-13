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
  START: { health: 85, hunger: 70, thirst: 55, stamina: 100, temperature: 36.4 },

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
  /** Below this body temp the player takes cold damage (hypothermia). */
  HYPOTHERMIA_C: 35.0,
  /** Above this body temp the player takes heat damage (heatstroke). */
  HEATSTROKE_C: 39.2,
  /** "Cold" feedback (frost vignette, visible breath) starts below this. */
  COLD_FEEDBACK_C: 36.0,
  /** Health lost per real minute per °C below HYPOTHERMIA_C. */
  COLD_DAMAGE_PER_MIN_PER_DEG: 7,
  HEAT_DAMAGE_PER_MIN_PER_DEG: 5,
  /** How quickly body temp moves toward its target (fraction per real second). */
  BODY_DRIFT_RATE: 0.012,

  /** Ambient air model: coldest at COLDEST_HOUR, warmest 12h later. */
  AMBIENT_MEAN_C: 24,
  AMBIENT_SWING_C: 10, // ±10 → ~14 °C before dawn, ~34 °C mid-afternoon
  COLDEST_HOUR: 4,

  /** Comfortable ambient band — inside it body temp settles at NORMAL_BODY_C. */
  COMFORT_MIN_C: 20,
  COMFORT_MAX_C: 33,
  /** Body target °C shift per °C of ambient outside the comfort band. */
  COLD_TARGET_SLOPE: 0.2,
  HEAT_TARGET_SLOPE: 0.15,

  /** Warmth bonuses (added to effective ambient °C). */
  CAMPFIRE_WARMTH_C: 18,
  CAMPFIRE_RADIUS_M: 5.5,
  TORCH_WARMTH_C: 5,
  SHELTER_WARMTH_C: 6,
  /** Wet clothes chill you by up to this many °C at 100 wetness. */
  WET_CHILL_C: 8,

  /** Wetness gained per real second while swimming / in rain (scaled by rain intensity). */
  WETNESS_SWIM_PER_SEC: 40,
  WETNESS_RAIN_PER_SEC: 4,
  /** Drying per real second (base / near fire / in hot sun). */
  DRY_PER_SEC: 0.8,
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
  /** Chance that drinking straight from an unboiled stream/pond makes you sick. */
  FRESH_SICK_CHANCE: 0.12,
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
  RESPAWN_NEEDS: { health: 60, hunger: 50, thirst: 50, stamina: 100, temperature: 36.8 },
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
  /** Cascaded Shadow Maps config (High / Ultra). */
  CSM_CASCADES: 3,
  CSM_MAX_FAR: 175,
  /** Reflection render-target resolution (width/height) for ocean planar mirror. */
  WATER_REFLECTION_SIZE: 512,
  /** In-game hour delta threshold before refreshing procedural sky PMREM IBL probe. */
  IBL_REFRESH_HOURS: 0.28,
  /** Bloom post-processing (high HDR threshold so only true emissives/glints bloom). */
  BLOOM_STRENGTH: 0.14,
  BLOOM_RADIUS: 0.30,
  BLOOM_THRESHOLD: 1.18,
  /** Screen-space Ambient Occlusion pass parameters. */
  SSAO_KERNEL_RADIUS: 1.05,
  SSAO_MIN_DISTANCE: 0.00028,
  SSAO_MAX_DISTANCE: 0.0075,
  /** Subtle edge lens aberration, grain & vignette. */
  CHROMATIC_ABERRATION_OFFSET: 0.0014,
  FILM_GRAIN_INTENSITY: 0.022,
  VIGNETTE_DARKNESS: 0.24,
  /** Optional Depth of Field focus distance & aperture (Ultra). */
  DOF_FOCUS_DISTANCE: 22.0,
  DOF_APERTURE: 0.000045,
  DOF_MAX_BLUR: 0.0045,
  /** Floating sunlit dust motes count & hot-day shimmer. */
  DUST_MOTE_COUNT: 140,
  HEAT_SHIMMER_TEMP_C: 29.0,
  HEAT_SHIMMER_STRENGTH: 0.0018,
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
  GRASS_BLADE_BASE_COUNT: 48000,
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
  HINT_AUTO_HIDE_SEC: 180,
} as const;
