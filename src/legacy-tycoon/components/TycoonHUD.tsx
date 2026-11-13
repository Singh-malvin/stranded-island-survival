import React, { useState } from 'react';
import {
  ResourceStockpile,
  ResortStats,
  PlacedBuilding,
  StaffRoster,
  ToastNotification,
  DifficultyMode,
} from '../game/tycoonTypes.ts';
import { BUILDING_CATALOG, calculateGuestCapacity, formatTimeOfDay, multiplyCost } from '../game/tycoonRules.ts';
import {
  Coins,
  Star,
  Users,
  Sun,
  Moon,
  Trees as WoodIcon,
  Mountain,
  Leaf,
  Gem,
  Hammer,
  Briefcase,
  ChevronUp,
  ChevronDown,
  Volume2,
  VolumeX,
  HelpCircle,
  FastForward,
  MapPin,
  CheckCircle2,
  Package,
  Compass,
  Ship,
  Route,
  Sparkles,
} from 'lucide-react';

interface TycoonHUDProps {
  difficulty: DifficultyMode;
  resources: ResourceStockpile;
  stats: ResortStats;
  buildings: PlacedBuilding[];
  staff: StaffRoster;
  guestCount: number;
  islandRadius: number;
  islandTier: number;
  hoveredNode: { type: string } | null;
  hoveredCargoCrate: { resource: string; amount: number } | null;
  cargoCratesCount: number;
  activeBuildDefId: string | null;
  pathPreviewInfo?: { startSet: boolean; segmentCount: number };
  toasts: ToastNotification[];
  recentHarvestText: string | null;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenBuildMenu: () => void;
  onOpenPathsMenu: () => void;
  onOpenManagement: () => void;
  onOpenHelp: () => void;
  onCancelPlacement: () => void;
  onResetPathStart?: () => void;
  onConfirmPlacement?: () => void;
  onRotatePlacement?: () => void;
  onAdvanceDay: () => void;
  onInviteGuests?: () => void;
}

export const TycoonHUD: React.FC<TycoonHUDProps> = ({
  difficulty,
  resources,
  stats,
  buildings,
  guestCount,
  islandRadius,
  islandTier,
  hoveredNode,
  hoveredCargoCrate,
  cargoCratesCount,
  activeBuildDefId,
  pathPreviewInfo,
  toasts,
  recentHarvestText,
  isMuted,
  onToggleMute,
  onOpenBuildMenu,
  onOpenPathsMenu,
  onOpenManagement,
  onOpenHelp,
  onCancelPlacement,
  onResetPathStart,
  onConfirmPlacement,
  onRotatePlacement,
  onAdvanceDay,
  onInviteGuests,
}) => {
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const capacity = calculateGuestCapacity(buildings);
  const activeDef = activeBuildDefId ? BUILDING_CATALOG[activeBuildDefId] : null;
  const hasFerryDock = buildings.some((b) => b.defId === 'ferry_dock');
  const totalCosts = (stats.dailyExpenses || 0) + (stats.dailyUpkeep || 0);
  const netDaily = stats.dailyRevenue - totalCosts;
  const cleanliness = stats.cleanliness ?? 100;

  const renderStars = () => {
    const stars = [];
    const fullStars = Math.floor(stats.starRating);
    const hasHalf = stats.starRating % 1 !== 0;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />);
      } else if (i === fullStars && hasHalf) {
        stars.push(<Star key={i} className="w-4 h-4 fill-amber-400/50 text-amber-400" />);
      } else {
        stars.push(<Star key={i} className="w-4 h-4 text-slate-600" />);
      }
    }
    return stars;
  };

  const timeInfo = formatTimeOfDay(stats.timeOfDay);
  const isNight = timeInfo.isNight;

  return (
    <div className="pointer-events-none select-none absolute inset-0 z-20 flex flex-col justify-between p-4 overflow-hidden font-sans">
      {/* Top Header Bar */}
      <div className="flex flex-col gap-2 w-full">
        <div className="flex items-start justify-between w-full gap-4">
          {/* Left: Financials & Resort Prestige */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Cash & Daily Revenue Breakdown */}
            <div className="pointer-events-auto flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-slate-900/90 border border-slate-700/80 shadow-lg text-slate-100">
              <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400">
                <Coins className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs text-slate-400 leading-none">
                  Resort Treasury {difficulty === 'hardcore' && <span className="text-rose-400 font-bold">(Hardcore)</span>}
                </div>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span
                    data-testid="treasury-cash"
                    className={`text-lg font-black tracking-tight ${
                      resources.cash < 0 ? 'text-rose-400' : 'text-amber-400'
                    }`}
                  >
                    {resources.cash < 0
                      ? `-$${Math.abs(resources.cash).toLocaleString()}`
                      : `$${resources.cash.toLocaleString()}`}
                  </span>
                  <span
                    className={`text-[11px] font-semibold ${
                      netDaily >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                    title={`Revenue: +$${stats.dailyRevenue} • Staff: -$${stats.dailyExpenses} • Upkeep: -$${stats.dailyUpkeep}`}
                  >
                    {netDaily >= 0 ? `+$${netDaily}/day` : `-$${Math.abs(netDaily)}/day`}
                  </span>
                </div>
                {(buildings.length > 0 || totalCosts > 0) && (
                  <div className="text-[10px] text-slate-400 leading-none mt-0.5">
                    +${stats.dailyRevenue} rev • -${stats.dailyExpenses} staff • -${stats.dailyUpkeep} upkeep
                  </div>
                )}
              </div>
            </div>

            {/* Star Rating Badge */}
            <div className="pointer-events-auto flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-slate-900/90 border border-slate-700/80 shadow-lg text-slate-100">
              <div>
                <div className="flex items-center gap-1">{renderStars()}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                  {stats.starRating.toFixed(1)} Star Resort ({stats.prestigeScore} Prestige)
                </div>
              </div>
            </div>

            {/* Guest Occupancy */}
            <div className="pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-900/90 border border-slate-700/80 shadow-lg text-slate-100">
              <Users className="w-4 h-4 text-sky-400" />
              <div className="text-xs">
                <span className="font-bold text-white text-sm">{guestCount}</span>
                <span className="text-slate-400"> / {capacity} Guests</span>
              </div>
            </div>

            {/* Cleanliness Status */}
            <div
              className={`pointer-events-auto flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-900/90 border shadow-lg text-xs font-semibold ${
                cleanliness >= 75
                  ? 'border-slate-700/80 text-emerald-300'
                  : cleanliness >= 55
                  ? 'border-amber-600/80 text-amber-300'
                  : 'border-rose-600 text-rose-300'
              }`}
              title="Hire Housekeepers in [M] to maintain resort cleanliness above 75%"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Cleanliness {cleanliness}%</span>
            </div>

            {/* Island Size */}
            <div className="pointer-events-auto flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-900/90 border border-slate-700/80 shadow-lg text-slate-100">
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              <div className="text-xs font-semibold text-slate-300">
                {islandRadius}m Territory (T{islandTier})
              </div>
            </div>

            {/* Active Cargo Crates Alert */}
            {cargoCratesCount > 0 && (
              <div className="pointer-events-auto flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-amber-950/95 border border-amber-500 text-amber-300 text-xs font-bold shadow-lg">
                <Package className="w-4 h-4 text-amber-400" />
                <span>{cargoCratesCount} Cargo Dropped! Press [E] on crate to open</span>
              </div>
            )}
          </div>

          {/* Right: Island Calendar & Quick Actions */}
          <div className="flex items-center gap-2">
            {/* Day, Real-Time Clock & Advance */}
            <div className="pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-900/90 border border-slate-700/80 shadow-lg text-slate-100">
              {isNight ? (
                <Moon className="w-4 h-4 text-indigo-400" />
              ) : (
                <Sun className="w-4 h-4 text-amber-400" />
              )}
              <div className="leading-tight">
                <div className="text-xs font-bold text-slate-200" data-testid="day-clock-label">
                  Day {stats.day} • {timeInfo.label}
                </div>
                <div className="text-[10px] font-semibold text-amber-300/90">
                  {timeInfo.phase}
                </div>
              </div>
              <button
                onClick={onAdvanceDay}
                title="Skip to Next Morning & Collect Daily Revenue"
                className="flex items-center gap-1 ml-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black uppercase transition cursor-pointer"
              >
                <FastForward className="w-3 h-3" />
                Next Day [N]
              </button>
            </div>

            {/* Audio Mute */}
            <button
              onClick={onToggleMute}
              aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              className="pointer-events-auto p-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white transition shadow-lg cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
            </button>

            {/* Help */}
            <button
              onClick={onOpenHelp}
              aria-label="Open Controls and Guide"
              className="pointer-events-auto p-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white transition shadow-lg cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-sky-400" />
            </button>
          </div>
        </div>

        {/* Dynamic Resort Objective Banner */}
        <div className="flex items-center gap-2 self-start">
          {!hasFerryDock ? (
            <div className="pointer-events-auto flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-slate-900/95 border-2 border-amber-500/80 text-amber-200 text-xs shadow-xl">
              <Compass className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Step 1 ($0 Start):</strong> Gather island timber, stone & thatch ([E] / Left-Click), then craft the <strong>Founder's Ferry Pier ($0)</strong> in [B] → Infrastructure!
              </span>
              <button
                onClick={onOpenBuildMenu}
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] cursor-pointer"
              >
                Construct Dock [B]
              </button>
            </div>
          ) : capacity === 0 ? (
            <div className="pointer-events-auto flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-slate-900/95 border-2 border-sky-500/80 text-sky-200 text-xs shadow-xl">
              <Users className="w-4 h-4 text-sky-400 shrink-0" />
              <span>
                <strong>Step 2:</strong> Pier is ready! Gather island materials & craft your first <strong>Beach Bamboo Cabana ($0)</strong> in [B] → Villas so paying clients arrive!
              </span>
              <button
                onClick={onOpenBuildMenu}
                className="px-2.5 py-1 rounded-lg bg-sky-400 hover:bg-sky-300 text-slate-950 font-bold text-[11px] cursor-pointer"
              >
                Build Cabana [B]
              </button>
            </div>
          ) : (
            <div className="pointer-events-auto flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-slate-900/95 border border-emerald-500/80 text-emerald-200 text-xs shadow-xl">
              <Ship className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Ferry Pier Active!</strong> Guests arrive daily (Next Day [N]), or invite a tour boat:
              </span>
              {onInviteGuests && (
                <button
                  onClick={onInviteGuests}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] cursor-pointer"
                >
                  <Ship className="w-3 h-3" />
                  Invite Tour Group
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating In-Game Toast Notifications */}
      <div className="absolute top-20 right-4 z-30 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto p-3.5 rounded-2xl bg-slate-950/95 border border-amber-500/80 shadow-2xl flex items-start gap-2.5 text-xs text-slate-100"
          >
            {toast.type === 'cargo' ? (
              <Package className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-bold text-amber-300">{toast.title}</div>
              <div className="text-slate-300 mt-0.5 text-[11px] leading-tight">{toast.message}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Center Screen: First-Person Reticle & Harvest / Placement HUD */}
      <div className="flex flex-col items-center justify-center pointer-events-none">
        {recentHarvestText && (
          <div className="mb-2 px-3.5 py-1 rounded-xl bg-emerald-950/90 border border-emerald-500 text-emerald-300 font-black text-sm tracking-wide shadow-2xl">
            {recentHarvestText}
          </div>
        )}

        {/* Placement Banner — offset above center crosshair so ground aiming stays unobstructed */}
        {activeDef ? (
          <div className="pointer-events-auto mb-56 px-5 py-2.5 rounded-2xl bg-slate-950/90 border-2 border-amber-500 shadow-2xl text-center flex flex-col items-center">
            <div className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-1">
              Constructing: {activeDef.name}
            </div>
            {activeDef.category === 'paths' ? (
              (() => {
                const startSet = Boolean(pathPreviewInfo?.startSet);
                const segCount = pathPreviewInfo?.segmentCount ?? (startSet ? 0 : 1);
                const batchCost = multiplyCost(activeDef.cost, Math.max(1, segCount));
                return (
                  <>
                    <div className="text-[11px] text-sky-300 mb-1.5" data-testid="path-step-hint">
                      {!startSet
                        ? 'Step 1: Click Start Point on ground, building perimeter, or path'
                        : `Step 2: Aim & Click End Point (curves around trees) • Mapping ${segCount} ${segCount === 1 ? 'segment' : 'segments'}`}
                    </div>
                    {startSet && segCount > 0 && (
                      <div className="text-[10px] text-slate-300 mb-2">
                        Batch Cost: {batchCost.timber} Timber • {batchCost.stone} Stone • {batchCost.thatch} Thatch
                        {batchCost.cash > 0 ? ` • $${batchCost.cash}` : ''}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={onConfirmPlacement}
                        disabled={startSet && segCount === 0}
                        className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 font-bold text-xs uppercase shadow transition cursor-pointer"
                      >
                        {!startSet
                          ? 'Set Start [Click]'
                          : `Build ${segCount} ${segCount === 1 ? 'Segment' : 'Segments'} [Click]`}
                      </button>
                      {startSet && onResetPathStart && (
                        <button
                          onClick={onResetPathStart}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 font-semibold text-xs transition cursor-pointer border border-slate-700"
                        >
                          Reset Start [R]
                        </button>
                      )}
                      {!startSet && (
                        <button
                          onClick={onRotatePlacement}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition cursor-pointer border border-slate-700"
                        >
                          Rotate 45° [R]
                        </button>
                      )}
                      <button
                        onClick={onCancelPlacement}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-red-950 text-red-400 font-semibold text-xs transition cursor-pointer border border-slate-700"
                      >
                        Done [Esc]
                      </button>
                    </div>
                  </>
                );
              })()
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={onConfirmPlacement}
                  className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase shadow transition cursor-pointer"
                >
                  Place Here [Click]
                </button>
                <button
                  onClick={onRotatePlacement}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition cursor-pointer border border-slate-700"
                >
                  Rotate 45° [R]
                </button>
                <button
                  onClick={onCancelPlacement}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-red-950 text-red-400 font-semibold text-xs transition cursor-pointer border border-slate-700"
                >
                  Cancel [Esc]
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="w-4 h-4 relative flex items-center justify-center opacity-70 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-white/90 shadow-sm"></div>
          </div>
        )}

        {/* Cargo Crate Unpack Hover Prompt */}
        {!activeDef && hoveredCargoCrate && (
          <div className="pointer-events-none px-4 py-2 rounded-2xl bg-amber-950/95 border-2 border-amber-500 text-xs font-bold text-amber-300 shadow-2xl">
            📦 Press <strong className="text-white bg-slate-900 px-1.5 py-0.5 rounded mr-1">E</strong> or Left-Click to Open Cargo Crate (+{hoveredCargoCrate.amount} {hoveredCargoCrate.resource.toUpperCase()})
          </div>
        )}

        {/* Harvest Hover Prompt */}
        {!activeDef && !hoveredCargoCrate && hoveredNode && (
          <div className="pointer-events-none px-4 py-1.5 rounded-xl bg-slate-950/90 border border-amber-500/80 text-xs font-semibold text-amber-300 shadow-xl">
            Press <strong className="text-white bg-slate-800 px-1.5 py-0.5 rounded mr-1">E</strong> or Left-Click to Mine {hoveredNode.type.toUpperCase()}
          </div>
        )}
      </div>

      {/* Bottom Dock (Collapsible <=15% height) */}
      <div className="pointer-events-auto flex flex-col items-center w-full">
        <button
          onClick={() => setIsDockCollapsed(!isDockCollapsed)}
          className="mb-1 px-3 py-0.5 rounded-t-xl bg-slate-900/90 border-t border-x border-slate-700/80 text-[10px] font-bold text-slate-400 hover:text-white flex items-center gap-1 transition cursor-pointer"
        >
          {isDockCollapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {isDockCollapsed ? 'Show Resort Controls' : 'Hide Controls [H]'}
        </button>

        {!isDockCollapsed && (
          <div className="w-full max-w-4xl p-3 rounded-2xl bg-slate-900/95 border border-slate-700/90 shadow-2xl flex flex-wrap items-center justify-between gap-3 text-slate-100">
            {/* Stockpile Counters */}
            <div className="flex items-center gap-3 sm:gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5" title="Timber Boards">
                <WoodIcon className="w-4 h-4 text-amber-600" />
                <span className="font-bold text-slate-200">{resources.timber}</span>
              </div>
              <div className="flex items-center gap-1.5" title="Quarried Stone & Granite">
                <Mountain className="w-4 h-4 text-slate-400" />
                <span className="font-bold text-slate-200">{resources.stone}</span>
              </div>
              <div className="flex items-center gap-1.5" title="Palm Frond Thatch">
                <Leaf className="w-4 h-4 text-lime-400" />
                <span className="font-bold text-slate-200">{resources.thatch}</span>
              </div>
              <div className="flex items-center gap-1.5" title="Luxury Marble & Pearls">
                <Gem className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-slate-200">{resources.decor}</span>
              </div>
            </div>

            {/* Main Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenBuildMenu}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition shadow-lg cursor-pointer"
              >
                <Hammer className="w-4 h-4" />
                Construct [B]
              </button>

              <button
                onClick={onOpenPathsMenu}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition shadow-lg cursor-pointer"
              >
                <Route className="w-4 h-4" />
                Paths [P]
              </button>

              <button
                onClick={onOpenManagement}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition cursor-pointer border border-slate-700"
              >
                <Briefcase className="w-4 h-4 text-amber-400" />
                Staff, Freight & Land [M]
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
