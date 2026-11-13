/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ItemId =
  | 'flint'
  | 'driftwood'
  | 'wood'
  | 'palm_frond'
  | 'vine'
  | 'rope'
  | 'stone'
  | 'coconut'
  | 'raw_meat'
  | 'cooked_meat'
  | 'clean_water'
  | 'torch'
  | 'stone_axe'
  | 'spear'
  | 'water_flask'
  | 'battery'
  | 'copper_wire'
  | 'antenna'
  | 'flare_gun';

export interface InventorySlot {
  itemId: ItemId;
  count: number;
}

export interface RecipeRequirement {
  itemId: ItemId;
  count: number;
}

export type RecipeCategory = 'tools' | 'survival' | 'structures' | 'escape';

export interface CraftingRecipe {
  id: string;
  name: string;
  category: RecipeCategory;
  description: string;
  resultItemId: ItemId;
  resultCount: number;
  ingredients: RecipeRequirement[];
  requiresCampfire?: boolean;
}

export interface PlayerStats {
  health: number; // 0 - 100
  hunger: number; // 0 - 100
  thirst: number; // 0 - 100
  stamina: number; // 0 - 100
  temperature: number; // in Celsius, ~37.0 normal, <35.0 hypothermia, >39.5 heatstroke
  isSprinting: boolean;
  isWet: boolean;
  activeHotbarSlot: number; // 1 - 5
}

export type ToolType = 'hands' | 'axe' | 'spear' | 'torch' | 'flask';

export interface PlayerEquipment {
  slot1: ToolType; // hands
  slot2: ToolType | null; // axe
  slot3: ToolType | null; // spear
  slot4: ToolType | null; // torch
  slot5: ToolType | null; // flask
}

export type WeatherType = 'clear' | 'sweltering' | 'overcast' | 'rain' | 'storm';

export interface GameTime {
  day: number;
  totalSeconds: number; // game seconds (1 real sec = 24 game seconds, 1 day = 60 real seconds or 120s)
  hour: number; // 0 - 23
  minute: number; // 0 - 59
  timeOfDay: 'dawn' | 'day' | 'dusk' | 'night';
  weather: WeatherType;
  rainIntensity: number; // 0 to 1
  windAngle: number;
  windSpeed: number;
}

export type EntityType =
  | 'palm_tree'
  | 'driftwood_node'
  | 'boulder_node'
  | 'flint_node'
  | 'coconut_pickup'
  | 'palm_frond_node'
  | 'vine_node'
  | 'loose_stone_node'
  | 'freshwater_spring'
  | 'shipwreck_crate'
  | 'campfire'
  | 'lean_to'
  | 'signal_bonfire'
  | 'raft_dock'
  | 'radio_tower'
  | 'crab'
  | 'boar'
  | 'snake';

export interface GameEntity {
  id: string;
  type: EntityType;
  x: number;
  y: number;
  radius: number;
  health: number;
  maxHealth: number;
  interactive: boolean;
  harvestTool?: ToolType;
  harvestProgress?: number; // 0 to 1
  state?: any;
}

export interface EscapeState {
  raftProgress: {
    phase: number; // 0: unstarted, 1: frame, 2: deck, 3: mast & sail, 4: stocked
    logs: number; // needs 10 total
    ropes: number; // needs 6 total
    fronds: number; // needs 6 total
    rations: number; // needs 3
    water: number; // needs 3
    isComplete: boolean;
  };
  bonfireProgress: {
    built: boolean;
    stones: number; // 8
    wood: number; // 10
    tinder: number; // 4
    isLit: boolean;
    burnTimeRemaining: number;
  };
  radioProgress: {
    built: boolean;
    hasBattery: boolean;
    hasWire: boolean;
    hasAntenna: boolean;
    scraps: number; // 4
    isCalibrated: boolean;
  };
  horizonEvent: {
    type: 'ship' | 'plane' | 'none';
    x: number;
    distance: number;
    timer: number;
    active: boolean;
  };
  escaped: boolean;
  escapeMethod: 'raft' | 'signal_fire' | 'radio' | null;
}

export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  alpha: number;
  vy: number;
  duration: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  type: 'ember' | 'water_splash' | 'rain' | 'wood_chip' | 'stone_dust' | 'blood' | 'spark';
}
