/**
 * Tycoon Data Structures and Definitions
 */

export type BuildingCategory =
  | 'starter'
  | 'paths'
  | 'accommodation'
  | 'dining'
  | 'leisure'
  | 'massive'
  | 'infrastructure'
  | 'decor';

export type DifficultyMode = 'standard' | 'hardcore';

export interface ResourceCost {
  cash: number;
  timber: number;
  stone: number;
  thatch: number;
  decor?: number;
}

export interface BuildingDefinition {
  id: string;
  name: string;
  category: BuildingCategory;
  description: string;
  cost: ResourceCost;
  capacity: number; // Guest capacity
  dailyRevenue: number; // Base daily income generated
  maintenanceCost: number; // Daily upkeep / utilities cost
  prestigePoints: number; // Contributes to 1-5 star resort rating
  footprintRadius: number; // Collision and spacing radius
  unlockStarRating: number; // Star rating needed to unlock
  allowedTerrain: 'land' | 'water' | 'beach' | 'any';
  preferredStaffRole?: keyof StaffRoster; // Staff role that boosts this building's efficiency
}

export interface PlacedBuilding {
  id: string;
  defId: string;
  x: number;
  y: number; // height on terrain
  z: number;
  rotation: number; // yaw angle in radians
  constructedAtDay: number;
  occupants: number;
}

export interface ResourceStockpile {
  cash: number;
  timber: number;
  stone: number;
  thatch: number;
  decor: number;
}

export interface StaffRoster {
  cleaners: number;
  bartenders: number;
  chefs: number;
  concierges: number;
}

export interface GuestRecord {
  id: string;
  name: string;
  tier: 'economy' | 'luxury' | 'vip';
  satisfaction: number; // 0 to 100
  daysRemaining: number;
  assignedBuildingId?: string;
  preferredActivity: 'swim' | 'drink' | 'dine' | 'spa' | 'relax' | 'waterpark' | 'yacht';
}

export interface IslandExpansionTier {
  tier: number;
  name: string;
  description: string;
  radius: number;
  cost: ResourceCost;
  unlockedPrestige: number;
}

export interface ResortStats {
  day: number;
  timeOfDay: number; // 0.0 to 1.0 (0.25 = sunrise, 0.5 = noon, 0.75 = sunset, 0.0/1.0 = midnight)
  starRating: number; // 0.5 to 5.0 stars
  prestigeScore: number;
  reputation: number; // 0 - 100%
  cleanliness: number; // 0 - 100%
  totalVisitorsServed: number;
  lifetimeEarnings: number;
  dailyRevenue: number;
  dailyExpenses: number; // Staff wages
  dailyUpkeep: number; // Building utilities & maintenance
}

export interface ToastNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'cargo' | 'build' | 'warning';
  timestamp: number;
}

export interface TycoonGameState {
  difficulty: DifficultyMode;
  resources: ResourceStockpile;
  buildings: PlacedBuilding[];
  staff: StaffRoster;
  guests: GuestRecord[];
  stats: ResortStats;
  milestones: string[];
  playerPosition: { x: number; y: number; z: number; rotationY: number };
  islandTier: number; // 1, 2, 3, or 4
  islandRadius: number; // 75, 100, 130, 170
  cargoCratesCount: number;
}
