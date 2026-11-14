/**
 * Core survival data types. Pure data only — no three.js / React here so the
 * whole simulation can be unit tested in Node.
 */

export type ItemCategory = 'resource' | 'food' | 'water' | 'tool' | 'light' | 'story' | 'placeable';
export type ToolKind = 'axe' | 'pick' | 'spear' | 'torch' | 'machete' | 'lantern';
export type CraftTier = 1 | 2 | 3; // 1 Primitive, 2 Improved, 3 Advanced
export type CraftStation = 'hands' | 'campfire' | 'workbench' | 'forge';

export interface FoodEffect {
  hunger?: number;
  thirst?: number;
  health?: number;
  /** 0–1 chance of food poisoning when eaten. */
  sickChance?: number;
  /** Item left behind after consuming (e.g. a coconut leaves a shell bowl). */
  leaves?: ItemId;
}

export interface ItemDef {
  id: ItemId;
  name: string;
  category: ItemCategory;
  description: string;
  icon: string; // emoji glyph for the minimal UI (replaced with art later)
  stack: number;
  tool?: { kind: ToolKind; tier: number };
  food?: FoodEffect;
  /** Basic resources are partially lost on death; tools/story items are kept. */
  loseOnDeath?: boolean;
}

export type ItemId =
  // Raw resources
  | 'stick'
  | 'log'
  | 'stone'
  | 'flint'
  | 'fibre'
  | 'palm_frond'
  | 'shell'
  | 'scrap_metal'
  | 'cloth_scrap'
  | 'resin'
  | 'iron_ore'
  | 'coal'
  | 'copper_wire'
  | 'circuit_board'
  | 'fuel_can'
  | 'herb'
  // Processed
  | 'rope'
  | 'plank'
  | 'driftwood'
  | 'metal_ingot'
  // Food & water & medical
  | 'coconut'
  | 'berries'
  | 'raw_fish'
  | 'cooked_fish'
  | 'dried_fish'
  | 'raw_meat'
  | 'cooked_meat'
  | 'dried_meat'
  | 'ration_bar'
  | 'medicinal_poultice'
  | 'water_bottle_dirty'
  | 'water_bottle_clean'
  | 'empty_bottle'
  // Tools & light & progression gear
  | 'stone_axe'
  | 'stone_pick'
  | 'spear'
  | 'torch'
  | 'lantern'
  | 'metal_axe'
  | 'metal_pick'
  | 'machete'
  | 'climbing_gear'
  | 'river_raft'
  | 'station_keycard'
  // Placeables
  | 'campfire_kit'
  | 'shelter_kit';

export interface InventorySlot {
  itemId: ItemId;
  count: number;
  /** Remaining uses (tools) or remaining burn seconds (torch). */
  durability?: number;
}

export interface RecipeIngredient {
  itemId: ItemId;
  count: number;
}

export interface Recipe {
  id: string;
  name: string;
  tier: CraftTier;
  station: CraftStation;
  result: { itemId: ItemId; count: number };
  ingredients: RecipeIngredient[];
  description: string;
  /** Optional story flag required before the recipe is even shown (e.g. found blueprint). */
  requiresFlag?: string;
}

export interface Needs {
  health: number;
  hunger: number;
  thirst: number;
  stamina: number;
  /** Body temperature °C. */
  temperature: number;
  /** 0–100 how soaked your clothes are. */
  wetness: number;
  /** Seconds of food poisoning remaining (0 = healthy). */
  sickness: number;
  /** Human-readable reason for active sickness (e.g. 'Raw Meat', 'Dirty Water', 'Sea Water', 'Spoiled Food'). */
  sicknessCause?: string;
  /** Current body temperature direction ('warming' | 'cooling' | 'stable'). */
  tempTrend?: 'warming' | 'cooling' | 'stable';
}

export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';

export interface GameClock {
  day: number;
  /** In-game hour, 0–24 (fractional). */
  hour: number;
  /** Total in-game hours elapsed since the start (for respawn timers). */
  totalHours: number;
}

export type WeatherKind = 'clear' | 'overcast' | 'rain' | 'storm';

export interface WeatherState {
  kind: WeatherKind;
  /** 0–1 */
  rain: number;
  /** 0–1 */
  wind: number;
  /** Optional debug weather override (?debug=1 test toggle). */
  override?: WeatherKind;
}

/** Runtime state of a gathering node that has been touched. Untouched nodes have no entry. */
export interface NodeState {
  remaining: number;
  /** clock.totalHours at which the node regrows (if depleted & respawnable). */
  respawnAt?: number | null;
}

export type GatherNodeType =
  | 'palm_tree'
  | 'resin_tree'
  | 'fibre_bush'
  | 'berry_bush'
  | 'herb_patch'
  | 'driftwood'
  | 'loose_stone'
  | 'boulder'
  | 'flint_nodule'
  | 'iron_vein'
  | 'copper_vein'
  | 'shell_cluster'
  | 'coconut'
  | 'crash_debris'
  | 'tech_wreck'
  | 'fuel_drum'
  | 'supply_crate';

export interface GatherNodeDef {
  type: GatherNodeType;
  x: number;
  y: number;
  z: number;
  id: string;
  rotation: number;
  scale: number;
}

export interface PlayerContext {
  isMoving: boolean;
  isSprinting: boolean;
  isSwimming: boolean;
  nearFire: boolean;
  sheltered: boolean;
  holdingLitTorch: boolean;
}

export interface SurvivalStats {
  itemsCrafted: number;
  itemsGathered: number;
  distanceTravelled: number;
  deaths: number;
  playTimeSec: number;
}

export interface PlacedCampfire {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface PlacedShelter {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  builtDay: number;
}

export type MapZoneId =
  | 'ocean'
  | 'crash_beach'
  | 'tide_pools'
  | 'palm_cove'
  | 'fresh_spring'
  | 'northern_ridge'
  | 'dense_jungle'
  | 'abandoned_camp'
  | 'jungle_crash'
  | 'eastern_river'
  | 'basalt_caves'
  | 'ancient_ruins'
  | 'research_station'
  | 'volcanic_peak';

export interface BarrierGateDef {
  id: string;
  name: string;
  x: number;
  z: number;
  halfWidth: number;
  halfDepth: number;
  requiredToolLabel: string;
  requiredAnyItems: ItemId[];
  consumeOnUnlock?: boolean;
  unlockAct: 2 | 3;
  description: string;
  blockedMessage: string;
}

export interface StoryClueDef {
  id: string;
  title: string;
  subtitle: string;
  act: 1 | 2 | 3;
  x: number;
  z: number;
  propKind:
    | 'manifest'
    | 'flask_note'
    | 'blazed_marker'
    | 'journal_book'
    | 'black_box'
    | 'cave_note'
    | 'stone_tablet'
    | 'station_log';
  summary: string;
  logText: string;
  grantsItem?: { itemId: ItemId; count: number };
}

export type StationRepairId = 'radio' | 'generator' | 'chart';

export interface StationRepairs {
  radio: boolean;
  generator: boolean;
  chart: boolean;
}

export type BoatStageId = 'keel_hull' | 'mast_sail' | 'outboard_engine' | 'nav_provisions';

export interface BoatBuildState {
  keel_hull: boolean;
  mast_sail: boolean;
  outboard_engine: boolean;
  nav_provisions: boolean;
}

export type VoyageStopId = 'shoal_cay' | 'castaway_atoll' | 'lighthouse_shoal' | 'port_solis';
export type VoyagePhase = 'docked' | 'sailing' | 'stopover' | 'arrived';
export type VoyageThrottle = 'sail' | 'motor' | 'brace';

export interface VoyageState {
  phase: VoyagePhase;
  distanceNm: number;
  targetNm: number;
  legIndex: 1 | 2 | 3 | 4;
  hullIntegrity: number;
  fuelPct: number;
  throttle: VoyageThrottle;
  currentStopId: VoyageStopId | null;
  visitedStops: VoyageStopId[];
  scavengedStops: VoyageStopId[];
  seaEventText: string | null;
}

export type WildlifeKind = 'crab' | 'boar' | 'viper';
export type WildlifeBehavior = 'idle' | 'patrol' | 'flee' | 'chase' | 'attack' | 'dead';

export interface WildlifeEntity {
  id: string;
  kind: WildlifeKind;
  x: number;
  z: number;
  homeX: number;
  homeZ: number;
  heading: number;
  hp: number;
  maxHp: number;
  behavior: WildlifeBehavior;
  attackCooldownSec: number;
  patrolAngle: number;
  animPhase: number;
  respawnAt: number | null;
}

export interface ObjectiveStep {
  id: string;
  act: 1 | 2 | 3 | 4 | 5;
  title: string;
  detail: string;
  progressText?: string;
  completed: boolean;
}

export type SaveKind = 'autosave' | 'bed';

export type StructureType =
  | 'campfire'
  | 'shelter'
  | 'workbench'
  | 'storage_chest'
  | 'water_collector'
  | 'farm_plot'
  | 'snare_trap'
  | 'fish_trap'
  | 'drying_rack'
  | 'forge';

export type StructureCategory = 'camp' | 'production' | 'crafting';
export type PlacementSurface = 'dry_land' | 'shallow_water';

export interface StructureDef {
  id: StructureType;
  name: string;
  category: StructureCategory;
  surface: PlacementSurface;
  icon: string;
  ingredients: RecipeIngredient[];
  unlockAct: 1 | 2 | 3;
  description: string;
  station?: CraftStation;
}

export interface ForgeQueueState {
  inputWood: number;
  progressSec: number;
  outputDriftwood: number;
}

export interface PlacedStructure {
  id: string;
  type: StructureType;
  x: number;
  y: number;
  z: number;
  yaw: number;
  builtDay: number;
  storage?: (InventorySlot | null)[];
  waterDoses?: number;
  cropState?: 'empty' | 'growing' | 'ready';
  cropProgress?: number;
  trapState?: 'set' | 'ready';
  trapProgress?: number;
  dryItem?: 'raw_fish' | 'raw_meat' | null;
  dryProgress?: number;
  forgeQueue?: ForgeQueueState;
}

export interface SurvivalState {
  version: number;
  act: 1 | 2 | 3 | 4 | 5;
  difficulty: 'survivor' | 'hardcore';
  needs: Needs;
  alive: boolean;
  inventory: (InventorySlot | null)[];
  selectedSlot: number;
  clock: GameClock;
  weather: WeatherState;
  nodes: Record<string, NodeState>;
  campfires: PlacedCampfire[];
  shelters: PlacedShelter[];
  structures: PlacedStructure[];
  cluesFound: string[];
  unlockedGates: string[];
  stationRepairs: StationRepairs;
  wildlife: WildlifeEntity[];
  boat: BoatBuildState;
  voyage: VoyageState;
  escapedCity: boolean;
  escapedAtDay?: number;
  discoveredCells: string[];
  player: { x: number; y: number; z: number; yaw: number };
  spawnPoint: { x: number; y: number; z: number; yaw: number };
  flags: Record<string, boolean>;
  stats: SurvivalStats;
  lastSavedAt: number | null;
  lastSaveKind: SaveKind | null;
}
