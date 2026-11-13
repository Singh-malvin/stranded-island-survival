import React, { useEffect, useState } from 'react';
import { BUILDING_CATALOG, canAfford, getDifficultyMultipliers } from '../game/tycoonRules.ts';
import { BuildingCategory, DifficultyMode, ResourceStockpile } from '../game/tycoonTypes.ts';
import {
  Flame,
  Home,
  Utensils,
  Waves,
  Crown,
  Anchor,
  Trees,
  Lock,
  X,
  Coins,
  Trees as WoodIcon,
  Mountain,
  Leaf,
  Gem,
  Route,
  Users,
} from 'lucide-react';

interface BuildMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  difficulty: DifficultyMode;
  resources: ResourceStockpile;
  starRating: number;
  initialTab?: BuildingCategory;
  onSelectBuilding: (defId: string) => void;
}

const CATEGORIES: { id: BuildingCategory; label: string; icon: React.ReactNode }[] = [
  { id: 'starter', label: 'Starter & Garden', icon: <Flame className="w-4 h-4" /> },
  { id: 'paths', label: 'Paths & Walkways', icon: <Route className="w-4 h-4" /> },
  { id: 'accommodation', label: 'Villas & Suites', icon: <Home className="w-4 h-4" /> },
  { id: 'dining', label: 'Dining & Kitchens', icon: <Utensils className="w-4 h-4" /> },
  { id: 'leisure', label: 'Pools & Leisure', icon: <Waves className="w-4 h-4" /> },
  { id: 'massive', label: 'Mega Attractions', icon: <Crown className="w-4 h-4" /> },
  { id: 'infrastructure', label: 'Infrastructure', icon: <Anchor className="w-4 h-4" /> },
  { id: 'decor', label: 'Decor', icon: <Trees className="w-4 h-4" /> },
];

export const BuildMenuModal: React.FC<BuildMenuModalProps> = ({
  isOpen,
  onClose,
  difficulty,
  resources,
  starRating,
  initialTab,
  onSelectBuilding,
}) => {
  const [activeTab, setActiveTab] = useState<BuildingCategory>(initialTab || 'starter');
  const { revenueMult, upkeepMult } = getDifficultyMultipliers(difficulty);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const catalogList = Object.values(BUILDING_CATALOG).filter((b) => b.category === activeTab);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="relative w-full max-w-4xl max-h-[88vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div>
            <h2 className="text-xl font-bold tracking-wide text-amber-400">Resort Architecture & Construction</h2>
            <p className="text-xs text-slate-400">
              Build furnished villas, chef kitchens, connected pathways, water parks, and towering 5-story penthouses
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Construction Menu"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-1.5 px-6 py-3 border-b border-slate-800 bg-slate-900/90 overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                activeTab === cat.id
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {cat.icon}
              {cat.label}
            </button>
          ))}
        </div>

        {activeTab === 'paths' && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-sky-950/40 border border-sky-500/40 text-xs text-sky-200">
            <strong>Route Mapping Mode:</strong> Click a <strong>Start Point</strong> (snaps to buildings or paths), move your mouse to the <strong>Destination</strong>, and click once to auto-build the full connected walkway! Your cursor frees automatically so you never have to exit look-lock.
          </div>
        )}

        {/* Building Cards Grid */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
          {catalogList.map((item) => {
            const isUnlocked = starRating >= item.unlockStarRating;
            const affordable = canAfford(resources, item.cost);

            return (
              <div
                key={item.id}
                className={`relative p-5 rounded-2xl border transition flex flex-col justify-between ${
                  !isUnlocked
                    ? 'border-slate-800 bg-slate-950/50 opacity-60'
                    : affordable
                    ? 'border-slate-700 hover:border-amber-500/60 bg-slate-900'
                    : 'border-slate-800 bg-slate-900/60'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="font-bold text-base text-white">{item.name}</h3>
                      <span className="text-xs font-medium text-amber-400/90 capitalize">
                        {item.allowedTerrain === 'any' ? 'Any Terrain' : `${item.allowedTerrain} only`}
                      </span>
                    </div>
                    {item.capacity > 0 && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950 border border-emerald-700/60 text-emerald-300">
                        +{item.capacity} Guests
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                    {item.description}
                  </p>

                  {/* Stats Badges */}
                  <div className="flex flex-wrap gap-1.5 text-xs mb-3">
                    {item.dailyRevenue > 0 && (
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-400">
                        Up to +${Math.round(item.dailyRevenue * revenueMult)}/day
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-rose-300">
                      -${Math.round(item.maintenanceCost * upkeepMult)}/day upkeep
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300">
                      +{item.prestigePoints} Prestige
                    </span>
                    {item.preferredStaffRole && (
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-sky-300 flex items-center gap-1 capitalize">
                        <Users className="w-3 h-3" />
                        Needs {item.preferredStaffRole.slice(0, -1)}
                      </span>
                    )}
                  </div>

                  {/* Resource Costs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs py-2 px-3 rounded-xl bg-slate-950/70 border border-slate-800/80 mb-4">
                    <div className="flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-amber-400" />
                      <span
                        className={
                          item.cost.cash === 0
                            ? 'text-emerald-400 font-semibold'
                            : resources.cash >= item.cost.cash
                            ? 'text-slate-200'
                            : 'text-red-400 font-semibold'
                        }
                      >
                        {item.cost.cash === 0 ? '$0' : `$${item.cost.cash.toLocaleString()}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <WoodIcon className="w-3.5 h-3.5 text-amber-600" />
                      <span className={resources.timber >= item.cost.timber ? 'text-slate-200' : 'text-red-400 font-semibold'}>
                        {item.cost.timber}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Mountain className="w-3.5 h-3.5 text-slate-400" />
                      <span className={resources.stone >= item.cost.stone ? 'text-slate-200' : 'text-red-400 font-semibold'}>
                        {item.cost.stone}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Leaf className="w-3.5 h-3.5 text-lime-400" />
                      <span className={resources.thatch >= item.cost.thatch ? 'text-slate-200' : 'text-red-400 font-semibold'}>
                        {item.cost.thatch}
                      </span>
                    </div>
                    {(item.cost.decor ?? 0) > 0 && (
                      <div className="flex items-center gap-1.5 col-span-2">
                        <Gem className="w-3.5 h-3.5 text-cyan-400" />
                        <span className={resources.decor >= (item.cost.decor ?? 0) ? 'text-slate-200' : 'text-red-400 font-semibold'}>
                          {item.cost.decor} Decor
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Button */}
                <div>
                  {!isUnlocked ? (
                    <div className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-slate-800/60 text-slate-400 text-xs font-medium">
                      <Lock className="w-3.5 h-3.5" />
                      Requires {item.unlockStarRating}★ Resort Rating
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        onSelectBuilding(item.id);
                        onClose();
                      }}
                      disabled={!affordable}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
                        affordable
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg cursor-pointer'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {affordable ? `Construct ${item.name}` : 'Missing Resources'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
