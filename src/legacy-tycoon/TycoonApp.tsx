/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { ResortScene3D } from './game/ResortScene3D.ts';
import {
  BUILDING_CATALOG,
  canAfford,
  deductCost,
  multiplyCost,
  maxAffordableCount,
  getInitialGameState,
  processEndOfDay,
  generateNewGuests,
  buySupplyPack,
  canUpgradeIsland,
  calculateGuestCapacity,
  calculateStarRating,
  calculatePrestigeScore,
  calculateBuildingUpkeep,
  calculateDailyRevenue,
  calculateStaffExpenses,
  STAFF_SALARIES,
} from './game/tycoonRules.ts';
import {
  BuildingCategory,
  DifficultyMode,
  TycoonGameState,
  PlacedBuilding,
  StaffRoster,
  ToastNotification,
} from './game/tycoonTypes.ts';
import { TycoonHUD } from './components/TycoonHUD.tsx';
import { BuildMenuModal } from './components/BuildMenuModal.tsx';
import { ManagementModal } from './components/ManagementModal.tsx';
import { TitleScreen, HelpModal, ResetConfirmModal } from './components/ResortModals.tsx';
import { audio } from './game/audio.ts';

const SAVE_KEY = 'isle_of_palms_tycoon_save_v4';

function loadSavedState(): TycoonGameState {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.stats && parsed.resources) {
        const difficulty: DifficultyMode = parsed.difficulty || 'standard';
        const base = getInitialGameState(difficulty);
        const merged: TycoonGameState = {
          ...base,
          ...parsed,
          difficulty,
          resources: {
            ...base.resources,
            ...parsed.resources,
          },
          staff: {
            ...base.staff,
            ...parsed.staff,
          },
          stats: {
            ...base.stats,
            ...parsed.stats,
          },
        };
        const capacity = calculateGuestCapacity(merged.buildings);
        merged.stats.dailyUpkeep = calculateBuildingUpkeep(merged.buildings, difficulty);
        merged.stats.dailyExpenses = calculateStaffExpenses(merged.staff);
        merged.stats.dailyRevenue = calculateDailyRevenue(
          merged.buildings,
          merged.guests.length,
          capacity,
          merged.staff,
          merged.stats.cleanliness ?? 100,
          difficulty
        );
        return merged;
      }
    }
  } catch (e) {
    console.error('Failed to load save', e);
  }
  return getInitialGameState('standard');
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ResortScene3D | null>(null);

  // Support ?autostart=1 for automated checks & direct play
  const [screen, setScreen] = useState<'title' | 'playing'>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('autostart') === '1' ? 'playing' : 'title';
  });

  // Tycoon State
  const [gameState, setGameState] = useState<TycoonGameState>(() => loadSavedState());

  // UI Modals
  const [isBuildMenuOpen, setIsBuildMenuOpen] = useState(false);
  const [buildMenuTab, setBuildMenuTab] = useState<BuildingCategory>('starter');
  const [isManagementOpen, setIsManagementOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Placement & Interaction State
  const [activeBuildDefId, setActiveBuildDefId] = useState<string | null>(null);
  const [pathPreviewInfo, setPathPreviewInfo] = useState<{ startSet: boolean; segmentCount: number }>({
    startSet: false,
    segmentCount: 0,
  });
  const [hoveredNode, setHoveredNode] = useState<{ type: string } | null>(null);
  const [hoveredCargoCrate, setHoveredCargoCrate] = useState<{ resource: string; amount: number } | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [recentHarvestText, setRecentHarvestText] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const isAnyModalOpen =
    screen !== 'playing' || isBuildMenuOpen || isManagementOpen || isHelpOpen || isResetConfirmOpen;

  const hasSavedGame = gameState.stats.day > 1 || gameState.buildings.length > 0 || gameState.islandTier > 1;

  // Persist game state
  useEffect(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
    } catch (e) {
      console.error('Failed to save game state', e);
    }
  }, [gameState]);

  const addToast = (title: string, message: string, type: ToastNotification['type'] = 'info') => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    const newToast: ToastNotification = { id, title, message, type, timestamp: Date.now() };
    setToasts((prev) => [newToast, ...prev.slice(0, 3)]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Callback refs so Three.js scene mounted once always invokes fresh handlers
  const callbacksRef = useRef({
    onHarvest: (_type: string) => {},
    onPlaceBuilding: (_defId: string, _x: number, _y: number, _z: number, _rotation: number) => {},
    onPlacePathChain: (
      _defId: string,
      _segments: Array<{ x: number; y: number; z: number; rotation: number }>
    ) => {},
    onPathStateChange: (_info: { startSet: boolean; segmentCount: number }) => {},
    onBuildingsReseated: (_buildings: PlacedBuilding[]) => {},
    onOpenCargo: (_crateId: string, _resource: string, _amount: number) => {},
  });

  // Initialize Three.js 3D Scene once per playing session
  useEffect(() => {
    if (screen !== 'playing' || !containerRef.current) return;

    const scene = new ResortScene3D(containerRef.current, gameState.islandRadius);
    sceneRef.current = scene;

    scene.syncBuildings(gameState.buildings);
    scene.syncGuests(gameState.guests);
    scene.syncStaff(gameState.staff, gameState.buildings);
    scene.updateTimeOfDay(gameState.stats.timeOfDay);

    scene.setCallbacks({
      onHarvest: (type) => callbacksRef.current.onHarvest(type),
      onPlaceBuilding: (defId, x, y, z, rotation) =>
        callbacksRef.current.onPlaceBuilding(defId, x, y, z, rotation),
      onPlacePathChain: (defId, segments) =>
        callbacksRef.current.onPlacePathChain(defId, segments),
      onPathStateChange: (info) => callbacksRef.current.onPathStateChange(info),
      onBuildingsReseated: (buildings) => callbacksRef.current.onBuildingsReseated(buildings),
      onOpenCargo: (crateId, resource, amount) =>
        callbacksRef.current.onOpenCargo(crateId, resource, amount),
      onStepSound: () => audio.playStep(),
    });

    const hoverInterval = setInterval(() => {
      if (sceneRef.current) {
        setHoveredNode(sceneRef.current.hoveredNode);
        const crate = sceneRef.current.hoveredCargoCrate;
        setHoveredCargoCrate(crate ? { resource: crate.resource, amount: crate.amount } : null);
      }
    }, 120);

    return () => {
      clearInterval(hoverInterval);
      scene.dispose();
      sceneRef.current = null;
    };
  }, [screen]);

  // Synchronize building, staff and guest changes into 3D scene
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.syncBuildings(gameState.buildings);
      sceneRef.current.syncGuests(gameState.guests);
      sceneRef.current.syncStaff(gameState.staff, gameState.buildings);
      sceneRef.current.updateTimeOfDay(gameState.stats.timeOfDay);
    }
  }, [gameState.buildings, gameState.guests, gameState.staff, gameState.stats.timeOfDay]);

  // Keep path affordability cap synced if player is in path mapping mode
  useEffect(() => {
    if (activeBuildDefId && sceneRef.current) {
      const def = BUILDING_CATALOG[activeBuildDefId];
      if (def?.category === 'paths') {
        sceneRef.current.updateMaxPathSegments(maxAffordableCount(gameState.resources, def.cost, 24));
      }
    }
  }, [activeBuildDefId, gameState.resources]);

  // Auto-release pointer lock & pop cursor up whenever any menu/modal opens
  useEffect(() => {
    sceneRef.current?.setUiBlocked(isAnyModalOpen);
    if (isAnyModalOpen && document.pointerLockElement) {
      try {
        document.exitPointerLock?.();
      } catch {
        // ignore pointer lock exit error
      }
    }
  }, [isAnyModalOpen]);

  // Natural Real-Time Day/Night Cycle (~100s per 24h day) + Automatic Daytime Ferry Arrivals
  useEffect(() => {
    if (isAnyModalOpen) return;

    const timer = window.setInterval(() => {
      let rolloverSummary: { day: number; rev: number; net: number; cleanliness: number } | null = null;
      let ferryArrivedCount = 0;

      setGameState((prev) => {
        const prevTime = prev.stats.timeOfDay;
        const step = 0.0025; // 0.01/sec => 100s per full Morning -> Midday -> Sunset -> Night -> Dawn cycle
        const rawNext = prevTime + step;
        const nextTime = rawNext >= 1.0 ? rawNext - 1.0 : rawNext;

        // Crossed Dawn (0.25) -> Settle completed day automatically!
        const crossedDawn = prevTime < 0.25 && rawNext >= 0.25;
        if (crossedDawn) {
          const next = processEndOfDay(prev, nextTime);
          rolloverSummary = {
            day: next.stats.day,
            rev: next.stats.dailyRevenue,
            net: next.stats.dailyRevenue - next.stats.dailyExpenses - next.stats.dailyUpkeep,
            cleanliness: next.stats.cleanliness,
          };
          return next;
        }

        // Scheduled Ferry Arrivals in Morning (0.38) and Afternoon (0.58)
        const crossedMorningFerry = prevTime < 0.38 && nextTime >= 0.38;
        const crossedAfternoonFerry = prevTime < 0.58 && nextTime >= 0.58;
        let updatedGuests = prev.guests;
        let nextDailyRev = prev.stats.dailyRevenue;

        if (crossedMorningFerry || crossedAfternoonFerry) {
          const hasDock = prev.buildings.some((b) => b.defId === 'ferry_dock');
          const capacity = calculateGuestCapacity(prev.buildings);
          const openBeds = Math.max(0, capacity - prev.guests.length);

          if (hasDock && openBeds > 0 && prev.stats.reputation >= 35) {
            const count = Math.min(openBeds, prev.stats.starRating >= 2.0 ? 2 : 1);
            const arrived = generateNewGuests(count, prev.stats.starRating, prev.guests.length);
            updatedGuests = [...prev.guests, ...arrived];
            ferryArrivedCount = arrived.length;
            nextDailyRev = calculateDailyRevenue(
              prev.buildings,
              updatedGuests.length,
              capacity,
              prev.staff,
              prev.stats.cleanliness ?? 100,
              prev.difficulty
            );
          }
        }

        return {
          ...prev,
          guests: updatedGuests,
          stats: {
            ...prev.stats,
            timeOfDay: nextTime,
            dailyRevenue: nextDailyRev,
          },
        };
      });

      if (ferryArrivedCount > 0) {
        audio.playFoghorn();
        audio.playGuestCheer();
        addToast(
          '⛴️ Passenger Ferry Docked!',
          `${ferryArrivedCount} paying ${ferryArrivedCount === 1 ? 'guest' : 'guests'} stepped off the pier onto your resort.`,
          'success'
        );
      }

      if (rolloverSummary) {
        const s = rolloverSummary as { day: number; rev: number; net: number; cleanliness: number };
        audio.playChaChing();
        addToast(
          `Dawn • Day ${s.day}`,
          `Revenue: +$${s.rev} • Net: ${s.net >= 0 ? `+$${s.net}` : `-$${Math.abs(s.net)}`} • Cleanliness: ${s.cleanliness}%`,
          s.net >= 0 ? 'success' : 'warning'
        );
      }
    }, 250);

    return () => window.clearInterval(timer);
  }, [isAnyModalOpen]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    if (screen !== 'playing') return;

    const releaseCursor = () => {
      if (document.pointerLockElement) {
        try {
          document.exitPointerLock?.();
        } catch {
          // ignore
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'KeyB') {
        releaseCursor();
        if (activeBuildDefId) {
          cancelPlacement();
        } else {
          setIsManagementOpen(false);
          setIsHelpOpen(false);
          setBuildMenuTab('starter');
          setIsBuildMenuOpen((prev) => !prev);
        }
      } else if (e.code === 'KeyP') {
        releaseCursor();
        if (activeBuildDefId) {
          cancelPlacement();
        } else {
          setIsManagementOpen(false);
          setIsHelpOpen(false);
          setBuildMenuTab('paths');
          setIsBuildMenuOpen(true);
        }
      } else if (e.code === 'KeyM') {
        releaseCursor();
        setIsBuildMenuOpen(false);
        setIsHelpOpen(false);
        setIsManagementOpen((prev) => !prev);
      } else if (e.code === 'KeyN') {
        advanceDay();
      } else if (e.code === 'Escape') {
        if (activeBuildDefId) {
          cancelPlacement();
        } else if (isBuildMenuOpen) {
          setIsBuildMenuOpen(false);
        } else if (isManagementOpen) {
          setIsManagementOpen(false);
        } else if (isHelpOpen) {
          setIsHelpOpen(false);
        } else if (isResetConfirmOpen) {
          setIsResetConfirmOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screen, activeBuildDefId, isBuildMenuOpen, isManagementOpen, isHelpOpen, isResetConfirmOpen]);

  // --- Mining & Harvesting Handlers ---

  const handleHarvestNode = (type: string) => {
    let text = '+6 Resources';
    if (type === 'rock') {
      text = '+6 Quarried Stone';
      audio.playMine();
    } else if (type === 'palm') {
      text = '+8 Palm Thatch & +4 Timber';
      audio.playChop();
    } else if (type === 'driftwood') {
      text = '+6 Timber Boards';
      audio.playChop();
    } else if (type === 'shells') {
      text = '+3 Luxury Pearl Decor';
      audio.playPickup();
    }

    setRecentHarvestText(text);
    setTimeout(() => setRecentHarvestText(null), 1800);

    setGameState((prev) => {
      const stock = { ...prev.resources };
      if (type === 'driftwood') {
        stock.timber += 6;
      } else if (type === 'palm') {
        stock.thatch += 8;
        stock.timber += 4;
      } else if (type === 'rock') {
        stock.stone += 6;
      } else if (type === 'shells') {
        stock.decor += 3;
      }
      return { ...prev, resources: stock };
    });
  };

  const handleSelectBuildingToConstruct = (defId: string) => {
    const def = BUILDING_CATALOG[defId];
    const maxSeg = def?.category === 'paths' ? maxAffordableCount(gameState.resources, def.cost, 24) : 24;
    setActiveBuildDefId(defId);
    setPathPreviewInfo({ startSet: false, segmentCount: def?.category === 'paths' ? 1 : 0 });
    sceneRef.current?.setPlacementMode(defId, maxSeg);
  };

  const cancelPlacement = () => {
    setActiveBuildDefId(null);
    setPathPreviewInfo({ startSet: false, segmentCount: 0 });
    sceneRef.current?.setPlacementMode(null);
  };

  const handleConfirmBuild = (defId: string, x: number, y: number, z: number, rotation: number) => {
    const def = BUILDING_CATALOG[defId];
    if (!def) return;

    let canBuild = false;
    let canAffordNextPath = false;

    setGameState((prev) => {
      if (!canAfford(prev.resources, def.cost)) {
        return prev;
      }
      canBuild = true;

      const updatedStockpile = deductCost(prev.resources, def.cost);
      canAffordNextPath = def.category === 'paths' && canAfford(updatedStockpile, def.cost);

      const newBuilding: PlacedBuilding = {
        id: `bld_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        defId,
        x,
        y,
        z,
        rotation,
        constructedAtDay: prev.stats.day,
        occupants: 0,
      };

      const newBuildings = [...prev.buildings, newBuilding];
      const newPrestige = calculatePrestigeScore(newBuildings);
      const capacity = calculateGuestCapacity(newBuildings);
      const newStarRating = calculateStarRating(
        newPrestige,
        prev.guests.length,
        capacity,
        prev.stats.cleanliness ?? 100
      );

      let updatedGuests = prev.guests;
      const hasDock = newBuildings.some((b) => b.defId === 'ferry_dock');
      if (hasDock && capacity > 0 && updatedGuests.length === 0) {
        const initialCount = Math.min(2, capacity);
        const STARTER_GUESTS = [
          { id: 'g_init_1', name: 'Sophia Miller', tier: 'economy' as const, satisfaction: 90, daysRemaining: 4, preferredActivity: 'swim' as const },
          { id: 'g_init_2', name: 'Lucas Sinclair', tier: 'economy' as const, satisfaction: 88, daysRemaining: 3, preferredActivity: 'relax' as const },
        ];
        updatedGuests = STARTER_GUESTS.slice(0, initialCount);
      }

      const nextUpkeep = calculateBuildingUpkeep(newBuildings, prev.difficulty);
      const nextStaffExpenses = calculateStaffExpenses(prev.staff);
      const nextDailyRev = calculateDailyRevenue(
        newBuildings,
        updatedGuests.length,
        capacity,
        prev.staff,
        prev.stats.cleanliness ?? 100,
        prev.difficulty
      );

      return {
        ...prev,
        resources: updatedStockpile,
        buildings: newBuildings,
        guests: updatedGuests,
        stats: {
          ...prev.stats,
          prestigeScore: newPrestige,
          starRating: newStarRating,
          dailyUpkeep: nextUpkeep,
          dailyExpenses: nextStaffExpenses,
          dailyRevenue: nextDailyRev,
        },
      };
    });

    if (!canBuild) {
      addToast('Missing Materials', 'You need more resources to construct this structure.', 'info');
      return;
    }

    audio.playBuild();
    audio.playChaChing();
    addToast('Construction Complete', `Successfully constructed ${def.name}!`, 'build');

    // Keep path placement mode open if building paths and still able to afford next segment
    if (def.category === 'paths' && canAffordNextPath) {
      return;
    }
    cancelPlacement();
  };

  const handleConfirmPathChain = (
    defId: string,
    segments: Array<{ x: number; y: number; z: number; rotation: number }>
  ) => {
    const def = BUILDING_CATALOG[defId];
    if (!def || segments.length === 0) return;

    let builtCount = 0;
    let canAffordMore = false;

    setGameState((prev) => {
      const affordableCount = Math.min(
        segments.length,
        maxAffordableCount(prev.resources, def.cost, 24)
      );
      if (affordableCount <= 0) return prev;

      builtCount = affordableCount;
      const totalCost = multiplyCost(def.cost, affordableCount);
      const updatedStockpile = deductCost(prev.resources, totalCost);
      canAffordMore = canAfford(updatedStockpile, def.cost);

      const addedSegments: PlacedBuilding[] = segments.slice(0, affordableCount).map((seg, idx) => ({
        id: `bld_path_${Date.now()}_${idx}_${Math.floor(Math.random() * 1000)}`,
        defId,
        x: seg.x,
        y: seg.y,
        z: seg.z,
        rotation: seg.rotation,
        constructedAtDay: prev.stats.day,
        occupants: 0,
      }));

      const newBuildings = [...prev.buildings, ...addedSegments];
      const newPrestige = calculatePrestigeScore(newBuildings);
      const capacity = calculateGuestCapacity(newBuildings);
      const newStarRating = calculateStarRating(
        newPrestige,
        prev.guests.length,
        capacity,
        prev.stats.cleanliness ?? 100
      );
      const nextUpkeep = calculateBuildingUpkeep(newBuildings, prev.difficulty);
      const nextStaffExpenses = calculateStaffExpenses(prev.staff);
      const nextDailyRev = calculateDailyRevenue(
        newBuildings,
        prev.guests.length,
        capacity,
        prev.staff,
        prev.stats.cleanliness ?? 100,
        prev.difficulty
      );

      return {
        ...prev,
        resources: updatedStockpile,
        buildings: newBuildings,
        stats: {
          ...prev.stats,
          prestigeScore: newPrestige,
          starRating: newStarRating,
          dailyUpkeep: nextUpkeep,
          dailyExpenses: nextStaffExpenses,
          dailyRevenue: nextDailyRev,
        },
      };
    });

    if (builtCount <= 0) {
      addToast('Missing Materials', 'Not enough stone/timber/cash to build this path segment.', 'warning');
      return;
    }

    audio.playBuild();
    audio.playChaChing();
    addToast(
      '🛣️ Pathway Mapped!',
      `Connected ${builtCount} ${builtCount === 1 ? 'segment' : 'segments'} of ${def.name}.`,
      'build'
    );

    if (!canAffordMore) {
      cancelPlacement();
    }
  };

  const handleOpenCargo = (_crateId: string, resource: string, amount: number) => {
    audio.playChaChing();
    audio.playPickup();
    setGameState((prev) => {
      const key = resource as keyof typeof prev.resources;
      const currentVal = prev.resources[key] || 0;
      return {
        ...prev,
        resources: {
          ...prev.resources,
          [key]: currentVal + amount,
        },
        cargoCratesCount: Math.max(0, prev.cargoCratesCount - 1),
      };
    });
    addToast('📦 Cargo Unpacked!', `Retrieved +${amount} ${resource.toUpperCase()} from delivery crate!`, 'cargo');
  };

  // Sync latest handlers to ref for Three.js callbacks
  callbacksRef.current = {
    onHarvest: handleHarvestNode,
    onPlaceBuilding: handleConfirmBuild,
    onPlacePathChain: handleConfirmPathChain,
    onPathStateChange: setPathPreviewInfo,
    onBuildingsReseated: (updatedBuildings) => {
      setGameState((prev) => ({
        ...prev,
        buildings: updatedBuildings,
      }));
    },
    onOpenCargo: handleOpenCargo,
  };

  const advanceDay = () => {
    setGameState((prev) => {
      const next = processEndOfDay(prev);
      audio.playChaChing();
      audio.playGuestCheer();
      const net = next.stats.dailyRevenue - next.stats.dailyExpenses - next.stats.dailyUpkeep;
      addToast(
        `Day ${next.stats.day} Begun`,
        `Revenue: +$${next.stats.dailyRevenue} • Net: ${net >= 0 ? `+$${net}` : `-$${Math.abs(net)}`} • Cleanliness: ${next.stats.cleanliness}%`,
        net >= 0 ? 'success' : 'warning'
      );
      return next;
    });
  };

  const handleHireStaff = (role: keyof StaffRoster) => {
    const wage = STAFF_SALARIES[role];
    let hired = false;
    setGameState((prev) => {
      if (prev.resources.cash < wage) {
        return prev;
      }
      hired = true;
      const nextStaff = { ...prev.staff, [role]: prev.staff[role] + 1 };
      const capacity = calculateGuestCapacity(prev.buildings);
      const nextRev = calculateDailyRevenue(
        prev.buildings,
        prev.guests.length,
        capacity,
        nextStaff,
        prev.stats.cleanliness ?? 100,
        prev.difficulty
      );
      return {
        ...prev,
        staff: nextStaff,
        stats: {
          ...prev.stats,
          dailyExpenses: calculateStaffExpenses(nextStaff),
          dailyRevenue: nextRev,
        },
      };
    });
    if (!hired) {
      addToast(
        'Client Cash Needed',
        `Earn at least $${wage} from arriving resort guests before hiring this staff role.`,
        'warning'
      );
      return;
    }
    audio.playChaChing();
    addToast('Staff Hired', `New ${role.slice(0, -1)} joined the island team!`, 'info');
  };

  const handleFireStaff = (role: keyof StaffRoster) => {
    setGameState((prev) => {
      if (prev.staff[role] <= 0) return prev;
      const nextStaff = { ...prev.staff, [role]: prev.staff[role] - 1 };
      const capacity = calculateGuestCapacity(prev.buildings);
      const nextRev = calculateDailyRevenue(
        prev.buildings,
        prev.guests.length,
        capacity,
        nextStaff,
        prev.stats.cleanliness ?? 100,
        prev.difficulty
      );
      return {
        ...prev,
        staff: nextStaff,
        stats: {
          ...prev.stats,
          dailyExpenses: calculateStaffExpenses(nextStaff),
          dailyRevenue: nextRev,
        },
      };
    });
  };

  const handleBuySupplyPack = (packId: string) => {
    setGameState((prev) => {
      const res = buySupplyPack(prev.resources, packId);
      if (res.success) {
        audio.playChaChing();
        audio.playFoghorn();

        if (res.resource && res.amount) {
          sceneRef.current?.spawnCargoDelivery(res.resource, res.amount);
        }

        addToast(
          '🚢 Cargo Freight Delivered!',
          `A crate with +${res.amount} ${res.resource?.toUpperCase()} was dropped nearby! Walk up to it and press [E] or click to open.`,
          'cargo'
        );

        return {
          ...prev,
          resources: {
            ...prev.resources,
            cash: res.updatedStockpile.cash,
          },
          cargoCratesCount: prev.cargoCratesCount + 1,
        };
      } else {
        addToast('⚠️ Order Failed', res.message, 'info');
        return prev;
      }
    });
  };

  const handleInviteGuests = () => {
    const hasDock = gameState.buildings.some((b) => b.defId === 'ferry_dock');
    const capacity = calculateGuestCapacity(gameState.buildings);

    if (!hasDock) {
      addToast('⚓ Ferry Pier Required', 'Build the Ferry Pier (Infrastructure tab in [B]) so tourist boats can arrive!', 'info');
      return;
    }

    if (capacity <= gameState.guests.length) {
      addToast('🛏️ No Rooms Available', 'Build more Beach Cabanas or Overwater Bungalows to provide guest beds!', 'info');
      return;
    }

    audio.playFoghorn();
    audio.playGuestCheer();

    setGameState((prev) => {
      const remainingBeds = capacity - prev.guests.length;
      const countToAdd = Math.min(3, remainingBeds);
      const NAMES = ['Aria Vance', 'Leo Sterling', 'Chloe DuPont', 'Oliver Chen', 'Maya Mercer'];
      const newGuests = [];

      for (let i = 0; i < countToAdd; i++) {
        const name = NAMES[(prev.guests.length + i) % NAMES.length];
        newGuests.push({
          id: `guest_tour_${Date.now()}_${i}`,
          name,
          tier: 'economy' as const,
          satisfaction: 92,
          daysRemaining: 4,
          preferredActivity: 'relax' as const,
        });
      }

      const allGuests = [...prev.guests, ...newGuests];
      const nextRev = calculateDailyRevenue(
        prev.buildings,
        allGuests.length,
        capacity,
        prev.staff,
        prev.stats.cleanliness ?? 100,
        prev.difficulty
      );

      return {
        ...prev,
        guests: allGuests,
        stats: {
          ...prev.stats,
          dailyRevenue: nextRev,
        },
      };
    });

    addToast('🚢 Ferry Arrived!', 'New tourist group stepped onto the island from the passenger boat!', 'success');
  };

  const handleUpgradeIsland = () => {
    const check = canUpgradeIsland(gameState);
    if (!check.canUpgrade || !check.nextTier) {
      addToast('Reclamation Blocked', check.reason || 'Cannot expand island yet.', 'info');
      return;
    }

    const nextTier = check.nextTier;
    const updatedStockpile = deductCost(gameState.resources, nextTier.cost);

    audio.playVictoryFanfare();
    sceneRef.current?.expandIsland(nextTier.radius);

    setGameState((prev) => ({
      ...prev,
      resources: updatedStockpile,
      islandTier: nextTier.tier,
      islandRadius: nextTier.radius,
    }));

    addToast('🌊 Coastal Dredging Complete!', `Island landmass expanded to ${nextTier.radius}m radius!`, 'success');
  };

  const handleToggleMute = () => {
    const muted = audio.toggleMute();
    setIsMuted(muted);
  };

  const handleStartGame = (difficulty?: DifficultyMode) => {
    if (difficulty && !hasSavedGame) {
      setGameState(getInitialGameState(difficulty));
    }
    setScreen('playing');
  };

  const handleConfirmResetIsland = (difficulty: DifficultyMode = 'standard') => {
    localStorage.removeItem(SAVE_KEY);
    const cleanState = getInitialGameState(difficulty);
    setGameState(cleanState);
    sceneRef.current?.resetToDayOne();
    audio.playChaChing();
    addToast(
      'Island Reset to Day 1',
      `Your island atoll is reset (${difficulty === 'hardcore' ? 'Executive Hardcore' : 'Resort Tycoon'} mode). Happy building!`,
      'info'
    );
  };

  return (
    <div
      data-state={screen}
      data-buildings={gameState.buildings.length}
      className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none"
    >
      {/* Title Screen Overlay */}
      {screen === 'title' && (
        <TitleScreen
          onStartGame={handleStartGame}
          onOpenHelp={() => setIsHelpOpen(true)}
          hasSavedGame={hasSavedGame}
          onOpenResetConfirm={() => setIsResetConfirmOpen(true)}
        />
      )}

      {/* 3D First-Person Viewport Canvas */}
      <div
        ref={containerRef}
        data-testid="resort-canvas-mount"
        className="absolute inset-0 z-0 w-full h-full cursor-crosshair"
      />

      {/* Tycoon Heads-Up Display */}
      {screen === 'playing' && (
        <TycoonHUD
          difficulty={gameState.difficulty || 'standard'}
          resources={gameState.resources}
          stats={gameState.stats}
          buildings={gameState.buildings}
          staff={gameState.staff}
          guestCount={gameState.guests.length}
          islandRadius={gameState.islandRadius}
          islandTier={gameState.islandTier}
          hoveredNode={hoveredNode}
          hoveredCargoCrate={hoveredCargoCrate}
          cargoCratesCount={gameState.cargoCratesCount}
          activeBuildDefId={activeBuildDefId}
          pathPreviewInfo={pathPreviewInfo}
          toasts={toasts}
          recentHarvestText={recentHarvestText}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onOpenBuildMenu={() => {
            const hasDock = gameState.buildings.some((b) => b.defId === 'ferry_dock');
            const cap = calculateGuestCapacity(gameState.buildings);
            if (!hasDock) setBuildMenuTab('infrastructure');
            else if (cap === 0) setBuildMenuTab('accommodation');
            else setBuildMenuTab('starter');
            setIsBuildMenuOpen(true);
          }}
          onOpenPathsMenu={() => {
            setBuildMenuTab('paths');
            setIsBuildMenuOpen(true);
          }}
          onOpenManagement={() => setIsManagementOpen(true)}
          onOpenHelp={() => setIsHelpOpen(true)}
          onCancelPlacement={cancelPlacement}
          onResetPathStart={() => sceneRef.current?.resetPathStart()}
          onConfirmPlacement={() => sceneRef.current?.confirmPlacement()}
          onRotatePlacement={() => sceneRef.current?.rotatePlacement()}
          onAdvanceDay={advanceDay}
          onInviteGuests={handleInviteGuests}
        />
      )}

      {/* Modals */}
      <BuildMenuModal
        isOpen={isBuildMenuOpen}
        onClose={() => setIsBuildMenuOpen(false)}
        difficulty={gameState.difficulty || 'standard'}
        resources={gameState.resources}
        starRating={gameState.stats.starRating}
        initialTab={buildMenuTab}
        onSelectBuilding={handleSelectBuildingToConstruct}
      />

      <ManagementModal
        isOpen={isManagementOpen}
        onClose={() => setIsManagementOpen(false)}
        gameState={gameState}
        onHireStaff={handleHireStaff}
        onFireStaff={handleFireStaff}
        onBuySupplyPack={handleBuySupplyPack}
        onUpgradeIsland={handleUpgradeIsland}
        onOpenResetConfirm={() => setIsResetConfirmOpen(true)}
      />

      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      <ResetConfirmModal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirmReset={handleConfirmResetIsland}
      />
    </div>
  );
}
