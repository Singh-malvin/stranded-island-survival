import React, { useState } from 'react';
import {
  StaffRoster,
  TycoonGameState,
} from '../game/tycoonTypes.ts';
import {
  STAFF_SALARIES,
  SUPPLY_PACKS,
  ISLAND_EXPANSIONS,
  canUpgradeIsland,
} from '../game/tycoonRules.ts';
import {
  Users,
  Package,
  Heart,
  Award,
  X,
  Plus,
  Minus,
  Coins,
  ShieldCheck,
  CheckCircle,
  MapPin,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface ManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: TycoonGameState;
  onHireStaff: (role: keyof StaffRoster) => void;
  onFireStaff: (role: keyof StaffRoster) => void;
  onBuySupplyPack: (packId: string) => void;
  onUpgradeIsland: () => void;
  onOpenResetConfirm: () => void;
}

export const ManagementModal: React.FC<ManagementModalProps> = ({
  isOpen,
  onClose,
  gameState,
  onHireStaff,
  onFireStaff,
  onBuySupplyPack,
  onUpgradeIsland,
  onOpenResetConfirm,
}) => {
  const [activeTab, setActiveTab] = useState<'staff' | 'cargo' | 'expansion' | 'guests' | 'milestones'>('staff');

  if (!isOpen) return null;

  const { staff, resources, guests, stats, islandTier, islandRadius } = gameState;
  const totalCosts = (stats.dailyExpenses || 0) + (stats.dailyUpkeep || 0);
  const netDaily = stats.dailyRevenue - totalCosts;

  const ROLES: Array<{
    key: keyof StaffRoster;
    title: string;
    description: string;
    salary: number;
    benefit: string;
  }> = [
    {
      key: 'cleaners',
      title: 'Resort Housekeeper',
      description: 'Walks between bedrooms & villas with a broom to keep resort cleanliness high.',
      salary: STAFF_SALARIES.cleaners,
      benefit: 'Prevents Cleanliness Decay & Boosts Cabin Revenue to 110%',
    },
    {
      key: 'bartenders',
      title: 'Master Mixologist',
      description: 'Stands behind the Tiki Bar or Coconut Stand counter shaking tropical cocktails.',
      salary: STAFF_SALARIES.bartenders,
      benefit: 'Unlocks 110% Bar, Casino & Juice Stand Revenue',
    },
    {
      key: 'chefs',
      title: 'Executive Seafood Chef',
      description: 'Cooks at the commercial stove inside Sunset Restaurant & Penthouse Kitchen.',
      salary: STAFF_SALARIES.chefs,
      benefit: 'Unlocks 110% Restaurant Income & Keeps Guests Fed',
    },
    {
      key: 'concierges',
      title: 'VIP Island Concierge',
      description: 'Greets arriving tourists at Ferry Pier, Hotel Lobby & Presidential Penthouse.',
      salary: STAFF_SALARIES.concierges,
      benefit: 'Boosts Hotel, Marina & Penthouse Profits to 110%',
    },
  ];

  const MILESTONES = [
    { title: 'Island Founder', desc: 'Build the Ferry Pier and check in your first tourist.', unlocked: stats.totalVisitorsServed >= 1 || guests.length > 0 },
    { title: 'Tropical Oasis (2★)', desc: 'Reach 2.0 Star Rating with furnished Cabanas/Bungalows & 1,300+ Prestige.', unlocked: stats.starRating >= 2.0 },
    { title: 'High Society (3★)', desc: 'Construct the Seaside Infinity Pool & host 6+ bed capacity.', unlocked: stats.starRating >= 3.0 },
    { title: 'Mega Resort (4★)', desc: 'Build the Mega Water Park or Royal Marina & keep Cleanliness >= 65%.', unlocked: stats.starRating >= 4.0 },
    { title: 'Five-Star Crown Jewel (5★)', desc: 'Build the 5-Story Presidential Penthouse & achieve 5.0 Star Prestige.', unlocked: stats.starRating >= 5.0 },
  ];

  const islandUpgradeStatus = canUpgradeIsland(gameState);
  const currentIslandInfo = ISLAND_EXPANSIONS[islandTier - 1] || ISLAND_EXPANSIONS[0];
  const nextIslandInfo = islandUpgradeStatus.nextTier;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="relative w-full max-w-4xl max-h-[88vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div>
            <h2 className="text-xl font-bold tracking-wide text-amber-400">Resort Operations & Island Expansion</h2>
            <p className="text-xs text-slate-400">Manage hospitality staff, cargo freight, island land reclamation, and VIP guests</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Operations Menu"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1.5 px-6 py-3 border-b border-slate-800 bg-slate-900/90 overflow-x-auto">
          <button
            onClick={() => setActiveTab('staff')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'staff' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
            }`}
          >
            <Users className="w-4 h-4" />
            Staff & Hospitality
          </button>
          <button
            onClick={() => setActiveTab('cargo')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'cargo' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
            }`}
          >
            <Package className="w-4 h-4" />
            Import Freight Cargo
          </button>
          <button
            onClick={() => setActiveTab('expansion')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'expansion' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
            }`}
          >
            <MapPin className="w-4 h-4" />
            Expand Island Land ({islandRadius}m)
          </button>
          <button
            onClick={() => setActiveTab('guests')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'guests' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
            }`}
          >
            <Heart className="w-4 h-4" />
            Guests ({guests.length})
          </button>
          <button
            onClick={() => setActiveTab('milestones')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'milestones' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
            }`}
          >
            <Award className="w-4 h-4" />
            5-Star Roadmap
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'staff' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
                <div className="flex flex-wrap gap-3">
                  <span>Revenue: <strong className="text-emerald-400">+${stats.dailyRevenue}/day</strong></span>
                  <span>Staff Wages: <strong className="text-red-400">-${stats.dailyExpenses}/day</strong></span>
                  <span>Building Upkeep: <strong className="text-rose-400">-${stats.dailyUpkeep || 0}/day</strong></span>
                  <span>Cleanliness: <strong className="text-sky-300">{stats.cleanliness ?? 100}%</strong></span>
                </div>
                <div className={`font-semibold ${netDaily >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  Net: {netDaily >= 0 ? `+$${netDaily}/day profit` : `-$${Math.abs(netDaily)}/day loss`}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-500/40 text-xs text-blue-200">
                💡 <strong>Operations Tip:</strong>{' '}
                {gameState.difficulty === 'hardcore'
                  ? 'Hardcore Mode active (-20% client revenue, +25% building upkeep, faster cleanliness decay). '
                  : ''}
                Amenities earn <strong>$0</strong> with zero checked-in guests, and duplicate attractions have diminishing demand. Earn client cash from your Pier + Cabana before hiring staff or importing cargo!
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ROLES.map((role) => (
                  <div
                    key={role.key}
                    className="p-4 rounded-xl border border-slate-700/80 bg-slate-900 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-bold text-white text-sm">{role.title}</h3>
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-amber-400">
                          ${role.salary}/day
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mb-2">{role.description}</p>
                      <div className="text-xs text-emerald-400 font-medium mb-3 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {role.benefit}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                      <span className="text-xs text-slate-300">
                        Employed: <strong className="text-white text-sm">{staff[role.key]}</strong>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onFireStaff(role.key)}
                          disabled={staff[role.key] <= 0}
                          aria-label={`Dismiss ${role.title}`}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onHireStaff(role.key)}
                          disabled={resources.cash < role.salary}
                          title={resources.cash < role.salary ? `Need $${role.salary} client cash to hire` : `Hire ${role.title}`}
                          aria-label={`Hire ${role.title}`}
                          className="p-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-950 font-bold transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'cargo' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/70 text-xs text-amber-200">
                📦 <strong>How Cargo Delivery Works:</strong> When you order freight, a physical shipping crate with a glowing beacon and parachute is dropped directly onto your island in front of you. <strong>To open cargo:</strong> Close this menu, walk up to the crate, and press <strong>[E]</strong> or left-click to unpack the materials!
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SUPPLY_PACKS.map((pack) => {
                  const canBuy = resources.cash >= pack.cost;
                  return (
                    <div
                      key={pack.id}
                      className="p-4 rounded-xl border border-slate-700 bg-slate-900 flex justify-between items-center"
                    >
                      <div>
                        <h4 className="font-bold text-white text-sm">{pack.name}</h4>
                        <p className="text-xs text-emerald-400 font-medium">
                          +{pack.amount} {pack.resource.toUpperCase()}
                        </p>
                        <div className="flex items-center gap-1 mt-1 text-xs text-amber-400 font-semibold">
                          <Coins className="w-3.5 h-3.5" />
                          ${pack.cost}
                        </div>
                      </div>

                      <button
                        onClick={() => onBuySupplyPack(pack.id)}
                        disabled={!canBuy}
                        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition ${
                          canBuy
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow cursor-pointer'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {canBuy ? `Order ${pack.name}` : 'Need Cash'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'expansion' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-amber-400 font-bold uppercase">Current Territory</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-700 text-emerald-300 text-xs font-bold">
                    Tier {islandTier}: {islandRadius}m Radius
                  </span>
                </div>
                <h3 className="font-black text-white text-lg">{currentIslandInfo.name}</h3>
                <p className="text-xs text-slate-400 mt-1">{currentIslandInfo.description}</p>
              </div>

              {nextIslandInfo ? (
                <div className="p-5 rounded-2xl border-2 border-amber-500/70 bg-amber-950/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                        Next Coastal Reclamation Project
                      </span>
                      <h4 className="text-base font-black text-white">{nextIslandInfo.name}</h4>
                      <p className="text-xs text-slate-300 mt-1">{nextIslandInfo.description}</p>
                    </div>
                    <span className="text-lg font-black text-amber-300 shrink-0">
                      → {nextIslandInfo.radius}m Radius
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs py-2 px-3 rounded-xl bg-slate-950/80 border border-slate-800">
                    <div>Cash: <strong className={resources.cash >= nextIslandInfo.cost.cash ? 'text-white' : 'text-red-400'}>${nextIslandInfo.cost.cash}</strong></div>
                    <div>Timber: <strong className={resources.timber >= nextIslandInfo.cost.timber ? 'text-white' : 'text-red-400'}>{nextIslandInfo.cost.timber}</strong></div>
                    <div>Stone: <strong className={resources.stone >= nextIslandInfo.cost.stone ? 'text-white' : 'text-red-400'}>{nextIslandInfo.cost.stone}</strong></div>
                    <div>Thatch: <strong className={resources.thatch >= nextIslandInfo.cost.thatch ? 'text-white' : 'text-red-400'}>{nextIslandInfo.cost.thatch}</strong></div>
                  </div>

                  {islandUpgradeStatus.canUpgrade ? (
                    <button
                      onClick={onUpgradeIsland}
                      className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-lg flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      Dredge & Expand Island Landmass
                    </button>
                  ) : (
                    <div className="p-3 text-center rounded-xl bg-slate-900 border border-slate-800 text-xs text-amber-400 font-semibold">
                      {islandUpgradeStatus.reason}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 text-center rounded-xl bg-emerald-950/30 border border-emerald-700/60 text-emerald-300 text-xs font-bold">
                  👑 Sovereign Archipelago Achieved! Your island is at maximum continental expansion.
                </div>
              )}
            </div>
          )}

          {activeTab === 'guests' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs text-slate-300">
                <span>Current Guests: <strong>{guests.length}</strong></span>
                <span>Resort Reputation: <strong className="text-amber-300">{stats.reputation}%</strong></span>
                <span>Total Visitors Served: <strong>{stats.totalVisitorsServed}</strong></span>
              </div>

              {guests.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-slate-950/60 border border-slate-800">
                  <p className="text-sm font-semibold text-slate-300 mb-1">No tourists currently staying.</p>
                  <p className="text-xs text-slate-500">
                    Construct a <strong>Founder's Ferry Pier</strong> and build <strong>Beach Cabanas</strong> to welcome your first guests!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {guests.map((g) => (
                    <div key={g.id} className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/70 text-xs">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-white text-sm">{g.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full font-semibold uppercase text-[10px] ${
                            g.tier === 'vip'
                              ? 'bg-amber-950 border border-amber-600 text-amber-300'
                              : g.tier === 'luxury'
                              ? 'bg-sky-950 border border-sky-600 text-sky-300'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {g.tier}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-400 mt-2">
                        <span>Activity: <span className="capitalize text-slate-200">{g.preferredActivity}</span></span>
                        <span>Satisfaction: <strong className={g.satisfaction >= 75 ? 'text-emerald-400' : 'text-amber-400'}>{g.satisfaction}%</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'milestones' && (
            <div className="space-y-3">
              {MILESTONES.map((m, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border flex items-start gap-3 transition ${
                    m.unlocked
                      ? 'border-amber-500/60 bg-amber-950/20 text-white'
                      : 'border-slate-800 bg-slate-950/40 text-slate-400'
                  }`}
                >
                  <div className={`mt-0.5 ${m.unlocked ? 'text-amber-400' : 'text-slate-600'}`}>
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className={`text-sm font-bold ${m.unlocked ? 'text-amber-300' : 'text-slate-300'}`}>
                      {m.title}
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">{m.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with Reset Island Option */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex justify-between items-center">
          <button
            onClick={onOpenResetConfirm}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/50 hover:bg-red-900/60 border border-red-800/60 text-red-300 hover:text-white text-xs font-semibold transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Island to Day 1
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
