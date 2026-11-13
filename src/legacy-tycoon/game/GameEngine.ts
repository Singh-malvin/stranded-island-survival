/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { audio } from './audio';
import { GameRenderer } from './renderer';
import {
  addItemToInventory,
  advanceRaft,
  buildBonfire,
  calculateAmbientTemp,
  canAdvanceRaft,
  canBuildBonfire,
  canRepairRadio,
  getItemCount,
  lightBonfire,
  repairRadio,
  updatePlayerStats,
} from './rules';
import {
  EscapeState,
  FloatingText,
  GameEntity,
  GameTime,
  InventorySlot,
  ItemId,
  Particle,
  PlayerEquipment,
  PlayerStats,
  ToolType,
} from './types';
import { generateWorldEntities, getTerrainInfo, WORLD_CENTER, WORLD_SIZE } from './worldGen';

export interface GameEngineCallbacks {
  onInventoryChange: (inventory: InventorySlot[]) => void;
  onStatsChange: (stats: PlayerStats) => void;
  onTimeChange: (time: GameTime) => void;
  onEscapeChange: (escape: EscapeState) => void;
  onEquipmentChange: (equipment: PlayerEquipment) => void;
  onGameOver: (reason: string) => void;
  onVictory: (method: 'raft' | 'signal_fire' | 'radio') => void;
  onInteractionHint: (hint: string | null) => void;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private renderer: GameRenderer;
  private callbacks: GameEngineCallbacks;

  // Running state
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private animFrameId: number | null = null;
  private lastTime: number = 0;

  // Player state
  public player = {
    x: WORLD_CENTER,
    y: WORLD_CENTER + 150,
    vx: 0,
    vy: 0,
    angle: 0,
    walkCycle: 0,
    speed: 155, // base pixels/sec
    sprintSpeed: 245,
    activeTool: 'hands' as ToolType,
    equipment: {
      slot1: 'hands' as ToolType,
      slot2: null as ToolType | null,
      slot3: null as ToolType | null,
      slot4: null as ToolType | null,
      slot5: null as ToolType | null,
    } as PlayerEquipment,
    stats: {
      health: 100,
      hunger: 90,
      thirst: 90,
      stamina: 100,
      temperature: 37.0,
      isSprinting: false,
      isWet: false,
      activeHotbarSlot: 1,
    } as PlayerStats,
  };

  // Inventory: 2 Flint + 2 Driftwood lets player craft their Stone Hatchet immediately!
  public inventory: InventorySlot[] = [
    { itemId: 'flint', count: 2 },
    { itemId: 'driftwood', count: 2 },
    { itemId: 'coconut', count: 1 },
  ];

  // World Entities & Particles
  public entities: GameEntity[] = [];
  public particles: Particle[] = [];
  public floatingTexts: FloatingText[] = [];

  // Game Time & Weather
  public gameTime: GameTime = {
    day: 1,
    totalSeconds: 36000, // starts at 10:00 AM (bright morning sun)
    hour: 10,
    minute: 0,
    timeOfDay: 'day',
    weather: 'clear',
    rainIntensity: 0,
    windAngle: 0.5,
    windSpeed: 0.2,
  };

  // Escape Progress
  public escape: EscapeState = {
    raftProgress: {
      phase: 0,
      logs: 0,
      ropes: 0,
      fronds: 0,
      rations: 0,
      water: 0,
      isComplete: false,
    },
    bonfireProgress: {
      built: false,
      stones: 0,
      wood: 0,
      tinder: 0,
      isLit: false,
      burnTimeRemaining: 0,
    },
    radioProgress: {
      built: false,
      hasBattery: false,
      hasWire: false,
      hasAntenna: false,
      scraps: 0,
      isCalibrated: false,
    },
    horizonEvent: {
      type: 'none',
      x: WORLD_CENTER - 600,
      distance: 100,
      timer: 0,
      active: false,
    },
    escaped: false,
    escapeMethod: null,
  };

  // Camera & Controls
  public camera = {
    x: WORLD_CENTER,
    y: WORLD_CENTER,
    zoom: 1.15,
    shake: 0,
  };

  // Input Tracker
  private keysHeld = new Set<string>();
  private mousePos = { x: 0, y: 0 };
  private isMouseDown = false;
  private targetedEntity: GameEntity | null = null;
  private harvestProgress = 0; // 0 to 1

  // Statistics tracker for end-of-run summary
  public runStats = {
    resourcesGathered: 0,
    foodEaten: 0,
    distanceTraveled: 0,
    startRealTime: Date.now(),
  };

  constructor(canvas: HTMLCanvasElement, callbacks: GameEngineCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.renderer = new GameRenderer(this.ctx);
    this.callbacks = callbacks;

    this.entities = generateWorldEntities();
    this.setupEventListeners();
  }

  private setupEventListeners() {
    window.addEventListener('keydown', (e) => {
      this.keysHeld.add(e.code);

      // Hotbar selection 1-5
      if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].includes(e.code)) {
        const slot = parseInt(e.code.replace('Digit', ''), 10);
        this.selectHotbarSlot(slot);
      }

      // Quick interact 'E'
      if (e.code === 'KeyE') {
        this.handlePlayerAction();
      }

      // Mute audio 'KeyM'
      if (e.code === 'KeyM') {
        audio.toggleMute();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysHeld.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.keysHeld.clear();
      this.isMouseDown = false;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mousePos.x = e.clientX - rect.left;
      this.mousePos.y = e.clientY - rect.top;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isMouseDown = true;
        this.handlePlayerAction();
      }
    });

    this.canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isMouseDown = false;
      }
    });
  }

  public selectHotbarSlot(slotIndex: number) {
    this.player.stats.activeHotbarSlot = slotIndex;
    const eq = this.player.equipment;
    let tool: ToolType = 'hands';
    if (slotIndex === 1) tool = eq.slot1;
    else if (slotIndex === 2 && eq.slot2) tool = eq.slot2;
    else if (slotIndex === 3 && eq.slot3) tool = eq.slot3;
    else if (slotIndex === 4 && eq.slot4) tool = eq.slot4;
    else if (slotIndex === 5 && eq.slot5) tool = eq.slot5;

    this.player.activeTool = tool;
    this.callbacks.onStatsChange({ ...this.player.stats });
  }

  public setToolInSlot(slotIndex: number, tool: ToolType) {
    if (slotIndex === 2) this.player.equipment.slot2 = tool;
    if (slotIndex === 3) this.player.equipment.slot3 = tool;
    if (slotIndex === 4) this.player.equipment.slot4 = tool;
    if (slotIndex === 5) this.player.equipment.slot5 = tool;

    this.callbacks.onEquipmentChange({ ...this.player.equipment });
    this.selectHotbarSlot(this.player.stats.activeHotbarSlot);
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.callbacks.onInventoryChange(this.inventory);
    this.callbacks.onStatsChange(this.player.stats);
    this.callbacks.onTimeChange(this.gameTime);
    this.callbacks.onEscapeChange(this.escape);
    this.loop(this.lastTime);
  }

  public pause() {
    this.isPaused = true;
  }

  public resume() {
    this.isPaused = false;
    this.lastTime = performance.now();
  }

  public stop() {
    this.isRunning = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
  }

  private loop = (timestamp: number) => {
    if (!this.isRunning) return;

    const rawDt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    const dt = Math.min(rawDt, 0.05); // clamp delta time for stability

    if (!this.isPaused) {
      this.update(dt);
    }

    // Render viewport
    this.renderer.render(
      this.canvas.width,
      this.canvas.height,
      this.camera,
      this.player,
      this.entities,
      this.particles,
      this.floatingTexts,
      this.gameTime,
      this.escape,
      this.targetedEntity,
      this.harvestProgress
    );

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  // --- Main Simulation Update ---
  private update(dt: number) {
    this.updateClockAndWeather(dt);
    this.updatePlayerMovement(dt);
    this.updateEntitiesAndWildlife(dt);
    this.updateSurvivalStats(dt);
    this.updateEscapeAndHorizon(dt);
    this.updateParticles(dt);
    this.updateFloatingTexts(dt);
    this.updateCamera(dt);
    this.updateTargeting();

    // Check game over
    if (this.player.stats.health <= 0) {
      this.stop();
      audio.playDefeat();
      let reason = 'Exhaustion & exposure claimed your life on the island.';
      if (this.player.stats.temperature < 35.0) reason = 'Hypothermia set in during the freezing night.';
      else if (this.player.stats.temperature > 39.5) reason = 'Severe heatstroke from the sweltering midday sun.';
      else if (this.player.stats.thirst <= 0) reason = 'Dehydration in the tropical heat.';
      else if (this.player.stats.hunger <= 0) reason = 'Starvation.';
      this.callbacks.onGameOver(reason);
    }
  }

  // --- Clock, Day/Night, and Weather ---
  private updateClockAndWeather(dt: number) {
    // 1 real second = 12 game seconds (1 full 24h game day = 120 real seconds)
    this.gameTime.totalSeconds += dt * 12;

    const daySeconds = this.gameTime.totalSeconds % 86400;
    this.gameTime.day = Math.floor(this.gameTime.totalSeconds / 86400) + 1;
    this.gameTime.hour = Math.floor(daySeconds / 3600);
    this.gameTime.minute = Math.floor((daySeconds % 3600) / 60);

    // Time of day classification
    const h = this.gameTime.hour;
    if (h >= 5 && h < 8) this.gameTime.timeOfDay = 'dawn';
    else if (h >= 8 && h < 17) this.gameTime.timeOfDay = 'day';
    else if (h >= 17 && h < 20) this.gameTime.timeOfDay = 'dusk';
    else this.gameTime.timeOfDay = 'night';

    // Weather cycle: occasional tropical rainstorms
    const weatherCycleTime = (this.gameTime.totalSeconds / 300) % 1;
    if (weatherCycleTime > 0.75) {
      this.gameTime.weather = 'storm';
      this.gameTime.rainIntensity = Math.min(1, (weatherCycleTime - 0.75) * 4);
    } else if (weatherCycleTime > 0.6) {
      this.gameTime.weather = 'rain';
      this.gameTime.rainIntensity = 0.5;
    } else if (h >= 11 && h <= 14) {
      this.gameTime.weather = 'sweltering';
      this.gameTime.rainIntensity = 0;
    } else {
      this.gameTime.weather = 'clear';
      this.gameTime.rainIntensity = 0;
    }

    // Audio ambience parameters
    const terrain = getTerrainInfo(this.player.x, this.player.y);
    const nearFire = this.isNearActiveCampfire();
    audio.updateAmbience({
      distanceToOcean: Math.abs(terrain.distanceFromCenter - 920),
      rainIntensity: this.gameTime.rainIntensity,
      windSpeed: this.gameTime.windSpeed,
      nearCampfire: nearFire,
    });

    this.callbacks.onTimeChange({ ...this.gameTime });
  }

  // --- Player Movement & Aiming ---
  private updatePlayerMovement(dt: number) {
    let moveX = 0;
    let moveY = 0;

    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) moveY -= 1;
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) moveY += 1;
    if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) moveX -= 1;
    if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight')) moveX += 1;

    // Normalize diagonal movement
    const len = Math.sqrt(moveX * moveX + moveY * moveY);
    if (len > 0) {
      moveX /= len;
      moveY /= len;
    }

    // Sprinting check
    const isShift = this.keysHeld.has('ShiftLeft') || this.keysHeld.has('ShiftRight');
    const canSprint = isShift && this.player.stats.stamina > 5 && len > 0;
    this.player.stats.isSprinting = canSprint;

    const currentSpeed = canSprint ? this.player.sprintSpeed : this.player.speed;
    const targetVx = moveX * currentSpeed;
    const targetVy = moveY * currentSpeed;

    // Smooth velocity interpolation
    this.player.vx += (targetVx - this.player.vx) * Math.min(1, dt * 12);
    this.player.vy += (targetVy - this.player.vy) * Math.min(1, dt * 12);

    const nextX = this.player.x + this.player.vx * dt;
    const nextY = this.player.y + this.player.vy * dt;

    // Check terrain collision (cannot walk deep into the open ocean without raft)
    const terrain = getTerrainInfo(nextX, nextY);
    const deepOceanBoundary = 1000;
    if (terrain.distanceFromCenter < deepOceanBoundary) {
      this.player.x = nextX;
      this.player.y = nextY;
      this.runStats.distanceTraveled += Math.sqrt(this.player.vx * this.player.vx + this.player.vy * this.player.vy) * dt;
    }

    // Walking animation cycle
    if (len > 0) {
      this.player.walkCycle += dt * (canSprint ? 16 : 10);
    }

    // Player facing angle towards mouse cursor in world space
    const worldMouse = this.screenToWorld(this.mousePos.x, this.mousePos.y);
    this.player.angle = Math.atan2(worldMouse.y - this.player.y, worldMouse.x - this.player.x);
  }

  // --- Targeting and Interaction Tooltip ---
  private updateTargeting() {
    const interactRadius = 60;
    let closest: GameEntity | null = null;
    let closestDist = interactRadius;

    for (const e of this.entities) {
      const dx = e.x - this.player.x;
      const dy = e.y - this.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < closestDist + e.radius) {
        closest = e;
        closestDist = dist;
      }
    }

    this.targetedEntity = closest;

    // Update UI interaction prompt
    if (closest) {
      let hint = '';
      switch (closest.type) {
        case 'palm_tree':
          hint =
            this.player.activeTool === 'axe'
              ? '[E / Click] Chop Palm for Logs'
              : '[E / Click] Shake Palm for Fronds & Coconuts';
          break;
        case 'driftwood_node':
          hint = '[E / Click] Pick up Driftwood';
          break;
        case 'coconut_pickup':
          hint = '[E / Click] Pick up Fresh Coconut';
          break;
        case 'flint_node':
          hint = '[E / Click] Pick up Flint';
          break;
        case 'palm_frond_node':
          hint = '[E / Click] Pick up Palm Fronds';
          break;
        case 'vine_node':
          hint = '[E / Click] Harvest Jungle Vine';
          break;
        case 'loose_stone_node':
          hint = '[E / Click] Pick up Basalt Stone';
          break;
        case 'boulder_node':
          hint = '[E / Click] Mine Boulder for Stones';
          break;
        case 'shipwreck_crate':
          hint = '[E / Click] Salvage Shipwreck Cargo';
          break;
        case 'freshwater_spring':
          hint = '[E / Click] Drink Fresh Spring Water';
          break;
        case 'raft_dock':
          const raftCheck = canAdvanceRaft(this.escape, this.inventory);
          hint = raftCheck.canAdvance
            ? `[E] Upgrade Raft: ${raftCheck.nextPhaseName}`
            : `Raft: Needs ${raftCheck.required.map((r) => `${r.count} ${r.itemId}`).join(', ')}`;
          break;
        case 'signal_bonfire':
          if (!this.escape.bonfireProgress.built) {
            const bonCheck = canBuildBonfire(this.escape, this.inventory);
            hint = bonCheck.canBuild
              ? '[E] Build Peak Signal Pyre'
              : 'Bonfire: Needs 6 Stones, 8 Wood, 4 Fronds';
          } else if (!this.escape.bonfireProgress.isLit) {
            hint = '[E] Light Pyre with Torch or Flare';
          } else {
            hint = 'Signal Pyre is roaring!';
          }
          break;
        case 'radio_tower':
          hint = this.escape.radioProgress.built
            ? 'Radio Transceiver Active'
            : '[E] Repair Transceiver (Needs Battery, Wire, Antenna)';
          break;
        case 'crab':
          hint = '[E / Click] Hunt Shore Crab';
          break;
        case 'boar':
          hint = '[E / Click] Attack Wild Boar';
          break;
        case 'snake':
          hint = 'Warning: Viper Snake! [E / Click] Strike with Spear';
          break;
      }
      this.callbacks.onInteractionHint(hint);
    } else {
      this.callbacks.onInteractionHint(null);
    }
  }

  // --- Player Action Handling (Click or E) ---
  public handlePlayerAction() {
    const target = this.targetedEntity;
    if (!target) return;

    const dist = Math.hypot(target.x - this.player.x, target.y - this.player.y);
    if (dist > target.radius + 65) return;

    switch (target.type) {
      case 'driftwood_node': {
        this.addItem('driftwood', 1);
        this.addPopup('+1 Driftwood', target.x, target.y, '#e5cd8d');
        audio.playPickup();
        this.removeEntity(target.id);
        break;
      }

      case 'coconut_pickup': {
        this.addItem('coconut', 1);
        this.addPopup('+1 Coconut', target.x, target.y, '#86efac');
        audio.playPickup();
        this.removeEntity(target.id);
        break;
      }

      case 'flint_node': {
        this.addItem('flint', 1);
        this.addPopup('+1 Flint', target.x, target.y, '#94a3b8');
        audio.playPickup();
        this.removeEntity(target.id);
        break;
      }

      case 'palm_frond_node': {
        this.addItem('palm_frond', 2);
        this.addPopup('+2 Palm Fronds', target.x, target.y, '#86efac');
        audio.playPickup();
        this.removeEntity(target.id);
        break;
      }

      case 'vine_node': {
        this.addItem('vine', 2);
        this.addPopup('+2 Jungle Vines', target.x, target.y, '#4ade80');
        audio.playPickup();
        this.removeEntity(target.id);
        break;
      }

      case 'loose_stone_node': {
        this.addItem('stone', 1);
        this.addPopup('+1 Basalt Stone', target.x, target.y, '#cbd5e1');
        audio.playPickup();
        this.removeEntity(target.id);
        break;
      }

      case 'palm_tree': {
        if (this.player.activeTool !== 'axe') {
          // Shake tree by hand
          this.addItem('palm_frond', 1);
          const hasCoco = Math.random() > 0.4;
          if (hasCoco) this.addItem('coconut', 1);
          this.addPopup(
            '+1 Frond' + (hasCoco ? ' & +1 Coconut!' : '') + ' (Craft Axe for Logs)',
            target.x,
            target.y,
            '#86efac'
          );
          audio.playPickup();
          this.camera.shake = 0.15;
          return;
        }
        audio.playChop();
        this.spawnWoodParticles(target.x, target.y);
        target.health -= 1;
        this.camera.shake = 0.25;

        if (target.health <= 0) {
          this.addItem('wood', 3);
          this.addItem('palm_frond', 2);
          if (target.state?.hasCoconuts) this.addItem('coconut', 1);
          if (target.state?.hasVines) this.addItem('vine', 1);

          this.addPopup('+3 Palm Wood, +2 Fronds', target.x, target.y, '#fde047');
          this.removeEntity(target.id);
        } else {
          this.addPopup(`Chopping (${target.health}/${target.maxHealth})`, target.x, target.y, '#fef08a');
        }
        break;
      }

      case 'boulder_node': {
        audio.playMine();
        this.spawnStoneParticles(target.x, target.y);
        target.health -= 1;
        this.camera.shake = 0.2;

        if (target.health <= 0) {
          this.addItem('stone', 3);
          if (Math.random() > 0.5) this.addItem('flint', 1);
          this.addPopup('+3 Stones', target.x, target.y, '#cbd5e1');
          this.removeEntity(target.id);
        } else {
          this.addPopup(`Mining (${target.health}/${target.maxHealth})`, target.x, target.y, '#e2e8f0');
        }
        break;
      }

      case 'freshwater_spring': {
        audio.playDrink();
        this.player.stats.thirst = Math.min(100, this.player.stats.thirst + 35);
        this.addPopup('+35 Hydration', this.player.x, this.player.y - 20, '#38bdf8');
        this.callbacks.onStatsChange({ ...this.player.stats });
        break;
      }

      case 'shipwreck_crate': {
        audio.playMine();
        const loot = target.state?.loot as ItemId;
        if (loot) {
          this.addItem(loot, 1);
          this.addPopup(`Salvaged: ${loot.replace('_', ' ')}!`, target.x, target.y, '#38bdf8');
          audio.playPickup();
        }
        this.removeEntity(target.id);
        break;
      }

      case 'raft_dock': {
        const res = advanceRaft(this.escape, this.inventory);
        this.addPopup(res.message, target.x, target.y, res.success ? '#4ade80' : '#f87171');
        if (res.success) {
          audio.playCraft();
          this.escape = res.escape;
          this.inventory = res.inventory;
          this.callbacks.onEscapeChange(this.escape);
          this.callbacks.onInventoryChange(this.inventory);

          if (this.escape.escaped) {
            audio.playVictoryFanfare();
            this.callbacks.onVictory('raft');
          }
        }
        break;
      }

      case 'signal_bonfire': {
        if (!this.escape.bonfireProgress.built) {
          const res = buildBonfire(this.escape, this.inventory);
          this.addPopup(res.message, target.x, target.y, res.success ? '#4ade80' : '#f87171');
          if (res.success) {
            audio.playCraft();
            this.escape = res.escape;
            this.inventory = res.inventory;
            this.callbacks.onEscapeChange(this.escape);
            this.callbacks.onInventoryChange(this.inventory);
          }
        } else {
          const hasLightSource =
            this.player.activeTool === 'torch' || getItemCount(this.inventory, 'flare_gun') > 0;
          const res = lightBonfire(this.escape, hasLightSource);
          this.addPopup(res.message, target.x, target.y, res.success ? '#fbbf24' : '#f87171');
          if (res.success) {
            audio.playThunder();
            this.escape = res.escape;
            this.callbacks.onEscapeChange(this.escape);
            if (this.escape.escaped) {
              audio.playFoghorn();
              audio.playVictoryFanfare();
              this.callbacks.onVictory('signal_fire');
            }
          }
        }
        break;
      }

      case 'radio_tower': {
        const res = repairRadio(this.escape, this.inventory);
        this.addPopup(res.message, target.x, target.y, res.success ? '#38bdf8' : '#f87171');
        if (res.success) {
          audio.playCraft();
          audio.playVictoryFanfare();
          this.escape = res.escape;
          this.inventory = res.inventory;
          this.callbacks.onEscapeChange(this.escape);
          this.callbacks.onInventoryChange(this.inventory);
          this.callbacks.onVictory('radio');
        }
        break;
      }

      case 'crab': {
        audio.playAnimalBite();
        target.health -= 15;
        if (target.health <= 0) {
          this.addItem('raw_meat', 1);
          this.addPopup('+1 Crab Meat', target.x, target.y, '#f87171');
          this.removeEntity(target.id);
        }
        break;
      }

      case 'boar': {
        audio.playAnimalBite();
        const damage = this.player.activeTool === 'spear' ? 25 : 12;
        target.health -= damage;
        target.state.isCharging = true; // Boar fights back!
        this.camera.shake = 0.35;
        if (target.health <= 0) {
          this.addItem('raw_meat', 2);
          this.addPopup('+2 Boar Meat', target.x, target.y, '#f87171');
          this.removeEntity(target.id);
        }
        break;
      }

      case 'snake': {
        audio.playAnimalBite();
        target.health -= 20;
        if (target.health <= 0) {
          this.addItem('raw_meat', 1);
          this.addPopup('+1 Snake Meat', target.x, target.y, '#4ade80');
          this.removeEntity(target.id);
        }
        break;
      }
    }
  }

  // --- Wildlife AI Updates ---
  private updateEntitiesAndWildlife(dt: number) {
    for (const e of this.entities) {
      if (e.type === 'crab') {
        const dx = e.x - this.player.x;
        const dy = e.y - this.player.y;
        const dist = Math.hypot(dx, dy);

        // Crabs flee if player gets within 90px
        if (dist < 90) {
          e.x += (dx / dist) * dt * 75;
          e.y += (dy / dist) * dt * 75;
        }
      } else if (e.type === 'boar') {
        const dx = this.player.x - e.x;
        const dy = this.player.y - e.y;
        const dist = Math.hypot(dx, dy);

        if (e.state?.isCharging) {
          // Charge directly at player!
          e.x += (dx / dist) * dt * 160;
          e.y += (dy / dist) * dt * 160;
          e.state.angle = Math.atan2(dy, dx);

          // Hit player check
          if (dist < 28) {
            audio.playHurt();
            this.player.stats.health -= 15;
            this.camera.shake = 0.5;
            this.addPopup('-15 HP (Boar Gored!)', this.player.x, this.player.y - 25, '#ef4444');
            e.state.isCharging = false; // reset charge
          }
        }
      } else if (e.type === 'snake') {
        const dist = Math.hypot(e.x - this.player.x, e.y - this.player.y);
        if (dist < 32) {
          audio.playAnimalBite();
          this.player.stats.health -= 12;
          this.camera.shake = 0.3;
          this.addPopup('-12 HP (Snake Venom!)', this.player.x, this.player.y - 25, '#ef4444');
          e.x += (Math.random() - 0.5) * 40;
          e.y += (Math.random() - 0.5) * 40;
        }
      }
    }
  }

  // --- Survival Stats & Temperature ---
  private updateSurvivalStats(dt: number) {
    const ambientTemp = calculateAmbientTemp(this.gameTime.hour, this.gameTime.weather);
    const nearFire = this.isNearActiveCampfire();
    const holdingTorch = this.player.activeTool === 'torch';
    const isMoving = Math.abs(this.player.vx) > 5 || Math.abs(this.player.vy) > 5;

    this.player.stats = updatePlayerStats(this.player.stats, dt, ambientTemp, {
      isNearFire: nearFire,
      holdingTorch,
      isSheltered: false,
      isMoving,
    });

    this.callbacks.onStatsChange({ ...this.player.stats });
  }

  // --- Horizon Events & Escape Triggers ---
  private updateEscapeAndHorizon(dt: number) {
    const h = this.escape.horizonEvent;
    h.timer += dt;

    // Periodically spawn passing ship or airplane on horizon every ~100s
    if (!h.active && h.timer > 85) {
      h.active = true;
      h.type = Math.random() > 0.4 ? 'ship' : 'plane';
      h.x = WORLD_CENTER - 700;
      h.timer = 0;
      audio.playFoghorn();
      this.addPopup('Horn on the Horizon: A Vessel Approaches!', this.player.x, this.player.y - 45, '#38bdf8');
    }

    if (h.active) {
      h.x += dt * 32; // moves across the horizon
      if (h.x > WORLD_CENTER + 700) {
        h.active = false;
        h.timer = 0;
      }

      // If peak bonfire is burning while ship is in sight -> trigger rescue!
      if (this.escape.bonfireProgress.isLit && !this.escape.escaped) {
        this.escape.escaped = true;
        this.escape.escapeMethod = 'signal_fire';
        audio.playFoghorn();
        audio.playVictoryFanfare();
        this.callbacks.onVictory('signal_fire');
      }
    }
  }

  // --- Utility Helpers ---
  private isNearActiveCampfire(): boolean {
    return this.entities.some(
      (e) =>
        (e.type === 'campfire' || (e.type === 'signal_bonfire' && this.escape.bonfireProgress.isLit)) &&
        Math.hypot(e.x - this.player.x, e.y - this.player.y) < 160
    );
  }

  public addItem(itemId: ItemId, count = 1) {
    this.inventory = addItemToInventory(this.inventory, itemId, count);
    this.runStats.resourcesGathered += count;
    this.callbacks.onInventoryChange(this.inventory);
  }

  public addPopup(text: string, x: number, y: number, color = '#ffffff') {
    this.floatingTexts.push({
      id: Math.random().toString(),
      text,
      x,
      y,
      color,
      alpha: 1,
      vy: -25,
      duration: 1.6,
    });
  }

  private removeEntity(id: string) {
    this.entities = this.entities.filter((e) => e.id !== id);
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life += dt;
      p.alpha = 1 - p.life / p.maxLife;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
      }
    }
  }

  private updateFloatingTexts(dt: number) {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.duration -= dt;
      ft.alpha = Math.max(0, ft.duration / 1.6);
      if (ft.duration <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  private updateCamera(dt: number) {
    // Smooth exponential camera follow
    const targetX = this.player.x;
    const targetY = this.player.y;
    this.camera.x += (targetX - this.camera.x) * Math.min(1, dt * 5);
    this.camera.y += (targetY - this.camera.y) * Math.min(1, dt * 5);

    // Decay screenshake
    if (this.camera.shake > 0) {
      this.camera.shake = Math.max(0, this.camera.shake - dt * 2);
    }
  }

  private spawnWoodParticles(x: number, y: number) {
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 80,
        vy: (Math.random() - 0.5) * 80,
        size: 3 + Math.random() * 2,
        color: '#a16207',
        alpha: 1,
        life: 0,
        maxLife: 0.5,
        type: 'wood_chip',
      });
    }
  }

  private spawnStoneParticles(x: number, y: number) {
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 70,
        vy: (Math.random() - 0.5) * 70,
        size: 2.5 + Math.random() * 2,
        color: '#94a3b8',
        alpha: 1,
        life: 0,
        maxLife: 0.45,
        type: 'stone_dust',
      });
    }
  }

  public screenToWorld(sx: number, sy: number) {
    return {
      x: (sx - this.canvas.width / 2) / this.camera.zoom + this.camera.x,
      y: (sy - this.canvas.height / 2) / this.camera.zoom + this.camera.y,
    };
  }
}
