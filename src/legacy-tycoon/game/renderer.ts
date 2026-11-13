/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EscapeState,
  FloatingText,
  GameEntity,
  GameTime,
  Particle,
  PlayerEquipment,
  PlayerStats,
  ToolType,
} from './types';
import { ISLAND_RADIUS, WORLD_CENTER, WORLD_SIZE } from './worldGen';

export class GameRenderer {
  private ctx: CanvasRenderingContext2D;
  private lightCanvas: HTMLCanvasElement;
  private lightCtx: CanvasRenderingContext2D;

  // Cached background terrain canvas
  private terrainCanvas: HTMLCanvasElement | null = null;
  private terrainCtx: CanvasRenderingContext2D | null = null;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.lightCanvas = document.createElement('canvas');
    this.lightCtx = this.lightCanvas.getContext('2d')!;
    this.buildTerrainCache();
  }

  private buildTerrainCache() {
    this.terrainCanvas = document.createElement('canvas');
    this.terrainCanvas.width = WORLD_SIZE;
    this.terrainCanvas.height = WORLD_SIZE;
    this.terrainCtx = this.terrainCanvas.getContext('2d');
    if (!this.terrainCtx) return;

    const ctx = this.terrainCtx;

    // A. Deep Ocean Base
    ctx.fillStyle = '#103758';
    ctx.fillRect(0, 0, WORLD_SIZE, WORLD_SIZE);

    // B. Ocean Shallows / Turquoise Coastal Lagoon
    const shallowGradient = ctx.createRadialGradient(
      WORLD_CENTER,
      WORLD_CENTER,
      ISLAND_RADIUS - 60,
      WORLD_CENTER,
      WORLD_CENTER,
      ISLAND_RADIUS + 120
    );
    shallowGradient.addColorStop(0, '#2ea1b6');
    shallowGradient.addColorStop(0.65, '#2081a2');
    shallowGradient.addColorStop(1, 'rgba(16, 55, 88, 0)');

    ctx.fillStyle = shallowGradient;
    ctx.beginPath();
    ctx.arc(WORLD_CENTER, WORLD_CENTER, ISLAND_RADIUS + 120, 0, Math.PI * 2);
    ctx.fill();

    // C. Sandy Shoreline Beach
    const sandGradient = ctx.createRadialGradient(
      WORLD_CENTER,
      WORLD_CENTER,
      ISLAND_RADIUS * 0.72,
      WORLD_CENTER,
      WORLD_CENTER,
      ISLAND_RADIUS
    );
    sandGradient.addColorStop(0, '#5ea84c'); // transitions into lush jungle
    sandGradient.addColorStop(0.3, '#d8b979'); // dry interior sand
    sandGradient.addColorStop(0.85, '#e5cd8d'); // golden beach sand
    sandGradient.addColorStop(1, '#a68e59'); // wet shoreline sand

    ctx.fillStyle = sandGradient;
    ctx.beginPath();
    ctx.arc(WORLD_CENTER, WORLD_CENTER, ISLAND_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // D. Lush Jungle Interior
    const jungleGradient = ctx.createRadialGradient(
      WORLD_CENTER,
      WORLD_CENTER,
      ISLAND_RADIUS * 0.35,
      WORLD_CENTER,
      WORLD_CENTER,
      ISLAND_RADIUS * 0.75
    );
    jungleGradient.addColorStop(0, '#53564e'); // rocky foothills
    jungleGradient.addColorStop(0.2, '#2f5b24'); // deep jungle canopy
    jungleGradient.addColorStop(0.8, '#3d7a2f'); // lush tropical palms
    jungleGradient.addColorStop(1, '#5ea84c');

    ctx.fillStyle = jungleGradient;
    ctx.beginPath();
    ctx.arc(WORLD_CENTER, WORLD_CENTER, ISLAND_RADIUS * 0.75, 0, Math.PI * 2);
    ctx.fill();

    // E. Volcanic Rocky Crater & Peak
    const peakGradient = ctx.createRadialGradient(
      WORLD_CENTER - 120,
      WORLD_CENTER - 100,
      20,
      WORLD_CENTER - 50,
      WORLD_CENTER - 50,
      ISLAND_RADIUS * 0.38
    );
    peakGradient.addColorStop(0, '#2b2a29'); // obsidian crater
    peakGradient.addColorStop(0.4, '#47433f'); // dark basalt cliffs
    peakGradient.addColorStop(0.8, '#6b6660'); // granite ridge
    peakGradient.addColorStop(1, 'rgba(83, 86, 78, 0)');

    ctx.fillStyle = peakGradient;
    ctx.beginPath();
    ctx.arc(WORLD_CENTER - 50, WORLD_CENTER - 50, ISLAND_RADIUS * 0.38, 0, Math.PI * 2);
    ctx.fill();

    // F. Freshwater Stream & Spring (curves through jungle to beach)
    ctx.save();
    ctx.strokeStyle = '#32a7cb';
    ctx.lineWidth = 26;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(1120, 1100); // Spring origin
    ctx.bezierCurveTo(1350, 1220, 1500, 1380, 1780, 1620);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Spring pool sanctuary
    ctx.fillStyle = '#2bb8d6';
    ctx.beginPath();
    ctx.arc(1120, 1100, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  public render(
    viewportWidth: number,
    viewportHeight: number,
    camera: { x: number; y: number; zoom: number; shake: number },
    player: {
      x: number;
      y: number;
      angle: number;
      walkCycle: number;
      activeTool: ToolType;
      equipment: PlayerEquipment;
      stats: PlayerStats;
    },
    entities: GameEntity[],
    particles: Particle[],
    floatingTexts: FloatingText[],
    gameTime: GameTime,
    escape: EscapeState,
    targetedEntity: GameEntity | null,
    harvestProgress: number
  ) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, viewportWidth, viewportHeight);

    // Apply camera transform with screenshake
    ctx.save();
    const shakeX = (Math.random() - 0.5) * camera.shake * 12;
    const shakeY = (Math.random() - 0.5) * camera.shake * 12;

    ctx.translate(viewportWidth / 2 + shakeX, viewportHeight / 2 + shakeY);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    const worldTime = gameTime.totalSeconds;

    // 1. Draw Cached Ocean, Beach, Island, and Streams
    if (this.terrainCanvas) {
      ctx.drawImage(this.terrainCanvas, 0, 0);
    }
    // Animated shoreline water wave foam
    this.renderWaveRipples(ctx, worldTime);

    // 2. Render Horizon Events (Passing Ship or Airplane on distant horizon)
    if (escape.horizonEvent.active) {
      this.renderHorizonEvent(ctx, escape.horizonEvent, worldTime);
    }

    // Viewport bounds in world coords for culling
    const halfW = (viewportWidth / 2) / camera.zoom + 100;
    const halfH = (viewportHeight / 2) / camera.zoom + 100;
    const viewLeft = camera.x - halfW;
    const viewRight = camera.x + halfW;
    const viewTop = camera.y - halfH;
    const viewBottom = camera.y + halfH;

    // Filter visible entities
    const visibleEntities = entities.filter(
      (e) => e.x >= viewLeft && e.x <= viewRight && e.y >= viewTop && e.y <= viewBottom
    );

    // 3. Render Ground Shadows for Visible Entities and Player
    this.renderEntityShadows(ctx, visibleEntities, player, gameTime);

    // 4. Render Entities (sorted by Y for correct top-down depth)
    const sortedRenderables = [...visibleEntities, { isPlayer: true, y: player.y } as any].sort(
      (a, b) => a.y - b.y
    );

    for (const item of sortedRenderables) {
      if (item.isPlayer) {
        this.renderPlayer(ctx, player, worldTime);
      } else {
        this.renderEntity(ctx, item, worldTime, escape);
      }
    }

    // 5. Render Harvest Progress Radial Arc on Target
    if (targetedEntity && harvestProgress > 0) {
      this.renderHarvestRing(ctx, targetedEntity, harvestProgress);
    }

    // 6. Render Particles (Embers, Dust, Splashes)
    this.renderParticles(ctx, particles);

    // 7. Render Floating Text Popups
    this.renderFloatingTexts(ctx, floatingTexts);

    ctx.restore();

    // 8. Dynamic Lighting & Day/Night Overlay
    this.renderLightingOverlay(
      viewportWidth,
      viewportHeight,
      camera,
      player,
      visibleEntities,
      gameTime,
      escape
    );

    // 9. Full-screen Weather Effects (Rain streaks & Lightning Strobe)
    if (gameTime.rainIntensity > 0) {
      this.renderWeatherOverlay(viewportWidth, viewportHeight, gameTime, worldTime);
    }
  }

  // --- Dynamic Wave Ripples ---
  private renderWaveRipples(ctx: CanvasRenderingContext2D, time: number) {
    // Shoreline White Foam Breaker
    const waveProgress = (time * 0.8) % 1;
    const foamRadius = ISLAND_RADIUS - 10 + waveProgress * 30;
    const foamAlpha = Math.sin(waveProgress * Math.PI) * 0.45;
    ctx.strokeStyle = `rgba(240, 250, 255, ${foamAlpha})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(WORLD_CENTER, WORLD_CENTER, foamRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // --- Entity Shadows ---
  private renderEntityShadows(
    ctx: CanvasRenderingContext2D,
    entities: GameEntity[],
    player: { x: number; y: number },
    gameTime: GameTime
  ) {
    ctx.save();
    // Sun angle based on time of day
    const hour = gameTime.hour + gameTime.minute / 60;
    const sunAngle = (hour / 24) * Math.PI * 2 - Math.PI / 2;
    const shadowLength = Math.max(0.3, Math.abs(Math.sin((hour / 12) * Math.PI))) * 22;
    const shadowDx = -Math.cos(sunAngle) * shadowLength;
    const shadowDy = -Math.sin(sunAngle) * shadowLength;

    ctx.fillStyle = 'rgba(15, 28, 22, 0.28)';

    // Player shadow
    ctx.beginPath();
    ctx.ellipse(player.x + shadowDx * 0.4, player.y + shadowDy * 0.4 + 4, 14, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Entities shadow
    for (const e of entities) {
      const r = e.radius * 0.8;
      ctx.beginPath();
      ctx.ellipse(e.x + shadowDx * 0.6, e.y + shadowDy * 0.6 + 6, r, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // --- Player Character Rendering ---
  private renderPlayer(
    ctx: CanvasRenderingContext2D,
    player: {
      x: number;
      y: number;
      angle: number;
      walkCycle: number;
      activeTool: ToolType;
      equipment: PlayerEquipment;
      stats: PlayerStats;
    },
    time: number
  ) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);

    const bob = Math.sin(player.walkCycle) * 2.5;

    // A. Torso & Clothes (Tattered survivor tunic)
    ctx.fillStyle = '#b89467'; // khaki tan
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5a462b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // B. Survivor Head & Hair
    ctx.fillStyle = '#e8be92'; // skin tone
    ctx.beginPath();
    ctx.arc(0, bob - 2, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7c5332';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Hair
    ctx.fillStyle = '#4a3319';
    ctx.beginPath();
    ctx.arc(-2, bob - 4, 6.5, Math.PI * 0.8, Math.PI * 2.2);
    ctx.fill();

    // C. Hands and Active Tool
    const handOffset = Math.cos(player.walkCycle) * 3;
    // Left hand
    ctx.fillStyle = '#e8be92';
    ctx.beginPath();
    ctx.arc(-9, 4 + handOffset, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Right hand (holding tool)
    ctx.beginPath();
    ctx.arc(10, 4 - handOffset, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Render Equipped Tool in hand
    this.renderEquippedTool(ctx, player.activeTool, time);

    ctx.restore();
  }

  private renderEquippedTool(ctx: CanvasRenderingContext2D, tool: ToolType, time: number) {
    ctx.save();
    ctx.translate(11, 4);

    if (tool === 'axe') {
      // Wooden shaft
      ctx.strokeStyle = '#7d5226';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(8, -14);
      ctx.stroke();

      // Stone flint blade
      ctx.fillStyle = '#5c646b';
      ctx.beginPath();
      ctx.moveTo(7, -15);
      ctx.lineTo(15, -17);
      ctx.lineTo(13, -11);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#343a40';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (tool === 'spear') {
      // Long wooden spear
      ctx.strokeStyle = '#8d5e31';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-4, 8);
      ctx.lineTo(16, -24);
      ctx.stroke();

      // Sharp flint point
      ctx.fillStyle = '#d1d5db';
      ctx.beginPath();
      ctx.moveTo(15, -23);
      ctx.lineTo(20, -30);
      ctx.lineTo(13, -27);
      ctx.closePath();
      ctx.fill();
    } else if (tool === 'torch') {
      // Torch handle
      ctx.strokeStyle = '#5a3b1a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(6, -12);
      ctx.stroke();

      // Animated Torch flame
      const flameFlicker = Math.sin(time * 18) * 2;
      const flameGrad = ctx.createRadialGradient(6, -15, 2, 6, -15, 12);
      flameGrad.addColorStop(0, '#ffffff');
      flameGrad.addColorStop(0.3, '#ffcc00');
      flameGrad.addColorStop(0.8, '#ff5500');
      flameGrad.addColorStop(1, 'rgba(255, 60, 0, 0)');

      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.arc(6 + flameFlicker * 0.4, -14, 9 + flameFlicker * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (tool === 'flask') {
      // Coconut water canteen
      ctx.fillStyle = '#4c2e17';
      ctx.beginPath();
      ctx.arc(6, -4, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(4, -10, 4, 3);
    }

    ctx.restore();
  }

  // --- Entity Rendering ---
  private renderEntity(
    ctx: CanvasRenderingContext2D,
    entity: GameEntity,
    time: number,
    escape: EscapeState
  ) {
    ctx.save();
    ctx.translate(entity.x, entity.y);

    switch (entity.type) {
      case 'palm_tree': {
        // Wind sway
        const sway = Math.sin(time * 2 + entity.x * 0.02) * 4;

        // Tree trunk
        ctx.strokeStyle = '#7c532b';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(sway * 0.5, -25, sway, -52);
        ctx.stroke();

        // Rings on trunk
        ctx.strokeStyle = '#57381a';
        ctx.lineWidth = 2;
        [-12, -26, -38].forEach((h) => {
          ctx.beginPath();
          ctx.moveTo(-4 + sway * 0.4, h);
          ctx.lineTo(4 + sway * 0.4, h);
          ctx.stroke();
        });

        // Palm Fronds Canopy
        ctx.translate(sway, -52);
        const frondCount = 7;
        for (let i = 0; i < frondCount; i++) {
          const frondAngle = (i / frondCount) * Math.PI * 2 + time * 0.05;
          const frondLen = 38 + Math.sin(time * 3 + i) * 2;
          ctx.save();
          ctx.rotate(frondAngle);
          ctx.strokeStyle = i % 2 === 0 ? '#2d6a1e' : '#3f8c2b';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(frondLen * 0.5, 12, frondLen, 18);
          ctx.stroke();
          ctx.restore();
        }

        // Coconuts hanging from crown
        ctx.fillStyle = '#59381e';
        [-4, 4].forEach((cx) => {
          ctx.beginPath();
          ctx.arc(cx, 4, 4.5, 0, Math.PI * 2);
          ctx.fill();
        });
        break;
      }

      case 'driftwood_node': {
        ctx.fillStyle = '#8f7756';
        ctx.strokeStyle = '#5c4832';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 16, 6, 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'boulder_node': {
        ctx.fillStyle = '#676d75';
        ctx.strokeStyle = '#393e46';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-16, 4);
        ctx.lineTo(-12, -14);
        ctx.lineTo(8, -18);
        ctx.lineTo(18, -4);
        ctx.lineTo(12, 12);
        ctx.lineTo(-10, 14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Cracks on rock
        ctx.strokeStyle = '#2b2f36';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-4, -12);
        ctx.lineTo(2, 0);
        ctx.lineTo(8, 6);
        ctx.stroke();
        break;
      }

      case 'flint_node': {
        ctx.fillStyle = '#222831';
        ctx.strokeStyle = '#929a9e';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-7, 2);
        ctx.lineTo(-2, -8);
        ctx.lineTo(8, -5);
        ctx.lineTo(6, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'coconut_pickup': {
        ctx.fillStyle = '#563319';
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7a4b27';
        ctx.beginPath();
        ctx.arc(-1.5, -1.5, 3.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'palm_frond_node': {
        // Fallen green palm frond on ground
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-9, 6);
        ctx.quadraticCurveTo(0, -4, 11, -8);
        ctx.stroke();

        ctx.strokeStyle = '#15803d';
        ctx.lineWidth = 1.8;
        [-4, 0, 4].forEach((ox) => {
          ctx.beginPath();
          ctx.moveTo(ox - 3, -ox * 0.4);
          ctx.lineTo(ox + 4, -ox * 0.4 - 5);
          ctx.stroke();
        });
        break;
      }

      case 'vine_node': {
        // Jungle vine bundle on ground
        ctx.strokeStyle = '#16a34a';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0.4, Math.PI * 1.8);
        ctx.stroke();

        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.ellipse(5, -6, 4, 2, 0.6, 0, Math.PI * 2);
        ctx.ellipse(-6, 4, 4, 2, -0.4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'loose_stone_node': {
        // Basalt stone chunk
        ctx.fillStyle = '#475569';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-6, 3);
        ctx.lineTo(-3, -5);
        ctx.lineTo(5, -4);
        ctx.lineTo(7, 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'freshwater_spring': {
        // Sparkling water ripple
        const rip = (time * 1.5) % 1;
        ctx.strokeStyle = `rgba(255, 255, 255, ${1 - rip})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 10 + rip * 24, 0, Math.PI * 2);
        ctx.stroke();

        // Spring Rock border
        ctx.strokeStyle = '#5a626a';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }

      case 'shipwreck_crate': {
        ctx.fillStyle = '#755436';
        ctx.strokeStyle = '#412d1b';
        ctx.lineWidth = 2;
        ctx.fillRect(-12, -12, 24, 24);
        ctx.strokeRect(-12, -12, 24, 24);

        // Metal reinforcing bands
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(-10, -10, 20, 20);

        // Cross planks
        ctx.beginPath();
        ctx.moveTo(-12, -12);
        ctx.lineTo(12, 12);
        ctx.moveTo(12, -12);
        ctx.lineTo(-12, 12);
        ctx.stroke();
        break;
      }

      case 'campfire': {
        // Stones circle
        ctx.strokeStyle = '#4b5563';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.stroke();

        // Logs
        ctx.strokeStyle = '#543d2b';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-10, -10);
        ctx.lineTo(10, 10);
        ctx.moveTo(10, -10);
        ctx.lineTo(-10, 10);
        ctx.stroke();

        // Fire flame
        const flamePulse = Math.sin(time * 12) * 3;
        const fireGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 16);
        fireGrad.addColorStop(0, '#ffffcc');
        fireGrad.addColorStop(0.4, '#ff9900');
        fireGrad.addColorStop(0.8, '#ff3300');
        fireGrad.addColorStop(1, 'rgba(255, 50, 0, 0)');

        ctx.fillStyle = fireGrad;
        ctx.beginPath();
        ctx.arc(0, -2, 11 + flamePulse, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'lean_to': {
        // Thatched survival shelter
        ctx.fillStyle = '#3f6212';
        ctx.strokeStyle = '#713f12';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-22, 14);
        ctx.lineTo(0, -18);
        ctx.lineTo(22, 14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'raft_dock': {
        // Escape Method 1: The Sea Raft
        const phase = escape.raftProgress.phase;

        // Sand slipway
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.fillRect(-28, -20, 56, 40);

        if (phase === 0) {
          // Blueprint marker
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.setLineDash([5, 5]);
          ctx.lineWidth = 2;
          ctx.strokeRect(-26, -18, 52, 36);
          ctx.setLineDash([]);
        } else {
          // Wooden Logs Hull
          ctx.fillStyle = '#78350f';
          ctx.strokeStyle = '#451a03';
          ctx.lineWidth = 2;
          for (let y = -14; y <= 14; y += 7) {
            ctx.beginPath();
            ctx.roundRect(-24, y - 3, 48, 6, 3);
            ctx.fill();
            ctx.stroke();
          }

          if (phase >= 2) {
            // Decking planks across
            ctx.fillStyle = '#92400e';
            ctx.fillRect(-20, -16, 40, 32);
          }

          if (phase >= 3) {
            // Mast and Woven Sail
            ctx.strokeStyle = '#451a03';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -32);
            ctx.stroke();

            // Sail cloth (flutters slightly)
            const flutter = Math.sin(time * 3) * 3;
            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.moveTo(0, -30);
            ctx.quadraticCurveTo(14 + flutter, -15, 0, 0);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }

          if (phase >= 4) {
            // Provisions barrels & water canteens
            ctx.fillStyle = '#0284c7';
            ctx.beginPath();
            ctx.arc(-10, 8, 4, 0, Math.PI * 2);
            ctx.arc(10, 8, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;
      }

      case 'signal_bonfire': {
        // Escape Method 2: Peak Signal Fire
        const bp = escape.bonfireProgress;

        // Base Hearth
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, 24, 0, Math.PI * 2);
        ctx.stroke();

        if (bp.built) {
          // Tall Pyre logs stacked
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(-16, 14);
          ctx.lineTo(0, -22);
          ctx.lineTo(16, 14);
          ctx.moveTo(-14, -14);
          ctx.lineTo(14, 14);
          ctx.stroke();

          if (bp.isLit) {
            // Huge Roaring Bonfire!
            const roar = Math.sin(time * 16) * 6;
            const roarGrad = ctx.createRadialGradient(0, -6, 4, 0, -6, 34);
            roarGrad.addColorStop(0, '#ffffff');
            roarGrad.addColorStop(0.3, '#fde047');
            roarGrad.addColorStop(0.7, '#ea580c');
            roarGrad.addColorStop(1, 'rgba(234, 88, 12, 0)');

            ctx.fillStyle = roarGrad;
            ctx.beginPath();
            ctx.arc(0, -10, 26 + roar, 0, Math.PI * 2);
            ctx.fill();

            // Rising Smoke Plume
            for (let s = 1; s <= 4; s++) {
              const smokeY = -35 - s * 22;
              const smokeWander = Math.sin(time * 2 + s) * 16;
              const smokeAlpha = Math.max(0, 0.4 - s * 0.08);
              ctx.fillStyle = `rgba(30, 41, 59, ${smokeAlpha})`;
              ctx.beginPath();
              ctx.arc(smokeWander, smokeY, 14 + s * 8, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
        break;
      }

      case 'radio_tower': {
        // Escape Method 3: High Ground Transceiver
        const rp = escape.radioProgress;

        // Steel lattice mast
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-14, 16);
        ctx.lineTo(0, -42);
        ctx.lineTo(14, 16);
        ctx.moveTo(-8, -10);
        ctx.lineTo(8, -10);
        ctx.moveTo(-11, 4);
        ctx.lineTo(11, 4);
        ctx.stroke();

        // Top Antenna beacon
        const beaconActive = rp.built;
        const beaconFlash = (Math.sin(time * 6) + 1) * 0.5;
        ctx.fillStyle = beaconActive ? `rgba(239, 68, 68, ${beaconFlash})` : '#334155';
        ctx.beginPath();
        ctx.arc(0, -44, 4.5, 0, Math.PI * 2);
        ctx.fill();

        if (beaconActive) {
          // Radiating radio waves
          const wavePulse = (time * 1.8) % 1;
          ctx.strokeStyle = `rgba(56, 189, 248, ${1 - wavePulse})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, -44, wavePulse * 45, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      }

      case 'crab': {
        // Beach Crab
        ctx.fillStyle = '#dc2626'; // bright crab red
        ctx.beginPath();
        ctx.ellipse(0, 0, 9, 6.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Claws
        const clawSnap = Math.sin(time * 8) * 2;
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-7, -2);
        ctx.lineTo(-12, -6 + clawSnap);
        ctx.moveTo(7, -2);
        ctx.lineTo(12, -6 - clawSnap);
        ctx.stroke();
        break;
      }

      case 'boar': {
        // Jungle Wild Boar
        const isCharging = entity.state?.isCharging;
        ctx.fillStyle = isCharging ? '#7f1d1d' : '#451a03'; // angry red-brown when charging
        ctx.beginPath();
        ctx.ellipse(0, 0, 16, 11, entity.state?.angle || 0, 0, Math.PI * 2);
        ctx.fill();

        // White Tusks
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(14, -3, 3, 0, Math.PI * 2);
        ctx.arc(14, 3, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'snake': {
        // Jungle Snake
        ctx.strokeStyle = '#15803d'; // snake green
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        const slither = Math.sin(time * 6) * 4;
        ctx.moveTo(-10, slither);
        ctx.quadraticCurveTo(0, -slither, 10, slither * 0.5);
        ctx.stroke();

        // Tongue flicker
        if (Math.sin(time * 10) > 0.6) {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(11, slither * 0.5);
          ctx.lineTo(16, slither * 0.5);
          ctx.stroke();
        }
        break;
      }
    }

    ctx.restore();
  }

  // --- Horizon Vessel (Ship or Plane) ---
  private renderHorizonEvent(
    ctx: CanvasRenderingContext2D,
    event: EscapeState['horizonEvent'],
    time: number
  ) {
    ctx.save();
    const horizonY = WORLD_CENTER - ISLAND_RADIUS - 160;
    const vesselX = event.x;

    if (event.type === 'ship') {
      // Distant Cargo Ship silhouette crossing the sea
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(vesselX - 25, horizonY - 6, 50, 10);
      ctx.fillRect(vesselX - 6, horizonY - 14, 12, 8);
      ctx.fillRect(vesselX + 8, horizonY - 18, 4, 12);

      // Ship smoke puff
      const puff = (time * 2) % 1;
      ctx.fillStyle = `rgba(200, 200, 200, ${0.4 - puff * 0.3})`;
      ctx.beginPath();
      ctx.arc(vesselX + 10 - puff * 15, horizonY - 22 - puff * 8, 4 + puff * 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (event.type === 'plane') {
      // Search Airplane
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(vesselX - 16, horizonY - 40, 32, 6);
      ctx.fillRect(vesselX - 4, horizonY - 48, 8, 20);
    }

    ctx.restore();
  }

  // --- Radial Harvesting Ring ---
  private renderHarvestRing(
    ctx: CanvasRenderingContext2D,
    entity: GameEntity,
    progress: number
  ) {
    ctx.save();
    ctx.translate(entity.x, entity.y);

    const radius = entity.radius + 12;
    // Background ring
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Active progress arc
    ctx.strokeStyle = '#22c55e'; // vivid green
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  // --- Particles Rendering ---
  private renderParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
    ctx.save();
    for (const p of particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // --- Floating Text Popups ---
  private renderFloatingTexts(ctx: CanvasRenderingContext2D, texts: FloatingText[]) {
    ctx.save();
    ctx.font = 'bold 13px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const ft of texts) {
      ctx.globalAlpha = Math.max(0, ft.alpha);
      // Dark outline for high readability
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();
  }

  // --- Lighting & Day/Night Overlay ---
  private renderLightingOverlay(
    viewportWidth: number,
    viewportHeight: number,
    camera: { x: number; y: number; zoom: number },
    player: { x: number; y: number; activeTool: ToolType },
    entities: GameEntity[],
    gameTime: GameTime,
    escape: EscapeState
  ) {
    if (this.lightCanvas.width !== viewportWidth || this.lightCanvas.height !== viewportHeight) {
      this.lightCanvas.width = viewportWidth;
      this.lightCanvas.height = viewportHeight;
    }

    const lCtx = this.lightCtx;
    lCtx.clearRect(0, 0, viewportWidth, viewportHeight);

    // Calculate ambient darkness & color based on game hour
    const hour = gameTime.hour + gameTime.minute / 60;
    let darknessAlpha = 0;
    let tintColor = '0, 0, 0';

    if (hour >= 6 && hour < 9) {
      // Dawn (soft rose-amber)
      const t = (hour - 6) / 3;
      darknessAlpha = (1 - t) * 0.7;
      tintColor = '30, 20, 50';
    } else if (hour >= 9 && hour < 17) {
      // Day (clear, minimal tint)
      darknessAlpha = 0.0;
    } else if (hour >= 17 && hour < 20) {
      // Sunset (golden orange tint)
      const t = (hour - 17) / 3;
      darknessAlpha = t * 0.75;
      tintColor = '45, 20, 10';
    } else {
      // Night (deep navy pitch black)
      darknessAlpha = 0.92;
      tintColor = '5, 8, 20';
    }

    // Storm increases darkness
    if (gameTime.weather === 'storm') {
      darknessAlpha = Math.min(0.95, darknessAlpha + 0.35);
    }

    if (darknessAlpha <= 0.02) {
      return; // No need for lighting cutout
    }

    // Fill screen with ambient darkness
    lCtx.fillStyle = `rgba(${tintColor}, ${darknessAlpha})`;
    lCtx.fillRect(0, 0, viewportWidth, viewportHeight);

    // Cut out light circles using destination-out
    lCtx.globalCompositeOperation = 'destination-out';

    // Helper: screen coordinate converter
    const toScreen = (wx: number, wy: number) => ({
      x: (wx - camera.x) * camera.zoom + viewportWidth / 2,
      y: (wy - camera.y) * camera.zoom + viewportHeight / 2,
    });

    // 1. Player light (Torch = radius 160, Hands/Tools = soft personal halo of 55)
    const pScreen = toScreen(player.x, player.y);
    const hasTorch = player.activeTool === 'torch';
    const playerLightRadius = (hasTorch ? 175 : 60) * camera.zoom;

    const pGrad = lCtx.createRadialGradient(
      pScreen.x,
      pScreen.y,
      playerLightRadius * 0.15,
      pScreen.x,
      pScreen.y,
      playerLightRadius
    );
    pGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
    pGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.7)');
    pGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    lCtx.fillStyle = pGrad;
    lCtx.beginPath();
    lCtx.arc(pScreen.x, pScreen.y, playerLightRadius, 0, Math.PI * 2);
    lCtx.fill();

    // 2. Light from Campfires & Signal Fires
    for (const e of entities) {
      if (e.type === 'campfire') {
        const s = toScreen(e.x, e.y);
        const radius = 210 * camera.zoom;
        const grad = lCtx.createRadialGradient(s.x, s.y, radius * 0.2, s.x, s.y, radius);
        grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
        grad.addColorStop(0.8, 'rgba(0, 0, 0, 0.6)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        lCtx.fillStyle = grad;
        lCtx.beginPath();
        lCtx.arc(s.x, s.y, radius, 0, Math.PI * 2);
        lCtx.fill();
      } else if (e.type === 'signal_bonfire' && escape.bonfireProgress.isLit) {
        const s = toScreen(e.x, e.y);
        const radius = 380 * camera.zoom;
        const grad = lCtx.createRadialGradient(s.x, s.y, radius * 0.3, s.x, s.y, radius);
        grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
        grad.addColorStop(0.85, 'rgba(0, 0, 0, 0.7)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        lCtx.fillStyle = grad;
        lCtx.beginPath();
        lCtx.arc(s.x, s.y, radius, 0, Math.PI * 2);
        lCtx.fill();
      }
    }

    // Reset composite operation and blit lighting layer onto main canvas
    lCtx.globalCompositeOperation = 'source-over';
    this.ctx.drawImage(this.lightCanvas, 0, 0);
  }

  // --- Rain Streaks & Lightning Strobe ---
  private renderWeatherOverlay(
    viewportWidth: number,
    viewportHeight: number,
    gameTime: GameTime,
    time: number
  ) {
    const ctx = this.ctx;
    ctx.save();

    // Rain Streaks
    const numDrops = Math.floor(gameTime.rainIntensity * 120);
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < numDrops; i++) {
      const rx = (Math.sin(i * 99 + time * 14) * 0.5 + 0.5) * viewportWidth;
      const ry = (Math.cos(i * 33 + time * 18) * 0.5 + 0.5) * viewportHeight;
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 8, ry + 18);
    }
    ctx.stroke();

    // Lightning Flash
    if (gameTime.weather === 'storm' && Math.sin(time * 5.7) > 0.985) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.fillRect(0, 0, viewportWidth, viewportHeight);
    }

    ctx.restore();
  }
}
