/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  Hammer,
  Flame,
  Package,
  Check,
  Compass,
  MapPin,
  Anchor,
  Radio,
  BookOpen,
} from 'lucide-react';
import {
  CRAFTING_RECIPES,
  ITEM_DEFINITIONS,
  canCraftRecipe,
  craftRecipe,
  getItemCount,
} from '../game/rules';
import { CraftingRecipe, InventorySlot, ItemId, ToolType } from '../game/types';
import { audio } from '../game/audio';

interface CraftingMenuProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventorySlot[];
  onUpdateInventory: (newInv: InventorySlot[]) => void;
  onEquipTool: (slotIndex: number, tool: ToolType) => void;
  isNearCampfire: boolean;
  initialTab?: 'tools' | 'survival' | 'guide';
}

export const CraftingMenu: React.FC<CraftingMenuProps> = ({
  isOpen,
  onClose,
  inventory,
  onUpdateInventory,
  onEquipTool,
  isNearCampfire,
  initialTab = 'tools',
}) => {
  const [activeTab, setActiveTab] = useState<'tools' | 'survival' | 'guide'>(initialTab);
  const [craftMessage, setCraftMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  if (!isOpen) return null;

  const filteredRecipes = CRAFTING_RECIPES.filter((r) => r.category === activeTab);
  // Sort craftable items first
  const sortedRecipes = [...filteredRecipes].sort((a, b) => {
    const canA = canCraftRecipe(inventory, a, isNearCampfire) ? 1 : 0;
    const canB = canCraftRecipe(inventory, b, isNearCampfire) ? 1 : 0;
    return canB - canA;
  });

  const handleCraft = (recipe: CraftingRecipe) => {
    const res = craftRecipe(inventory, recipe, isNearCampfire);
    if (res.success) {
      audio.playCraft();
      onUpdateInventory(res.inventory);
      setCraftMessage(`Crafted 1x ${recipe.name}!`);

      // Automatically equip newly crafted tool to hotbar
      if (recipe.resultItemId === 'stone_axe') onEquipTool(2, 'axe');
      if (recipe.resultItemId === 'spear') onEquipTool(3, 'spear');
      if (recipe.resultItemId === 'torch') onEquipTool(4, 'torch');
      if (recipe.resultItemId === 'water_flask') onEquipTool(5, 'flask');

      setTimeout(() => setCraftMessage(null), 2500);
    } else {
      setCraftMessage(res.message || 'Cannot craft item');
      setTimeout(() => setCraftMessage(null), 2500);
    }
  };

  // Grouped resources guide list
  const resourceGuideList: ItemId[] = [
    'driftwood',
    'flint',
    'palm_frond',
    'vine',
    'stone',
    'coconut',
    'wood',
    'clean_water',
    'raw_meat',
    'battery',
    'copper_wire',
    'antenna',
    'flare_gun',
  ];

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/75 select-none">
      <div className="w-full max-w-4xl bg-[rgba(15,23,42,0.96)] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100 max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/80 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Hammer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Crafting & Survival Compendium</h2>
              <p className="text-xs text-slate-400">
                Craft primitive tools, synthesize ropes, and check where every resource spawns
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-slate-700 hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content: Left Inventory (4/12) & Right Recipes or Resource Guide (8/12) */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-slate-800">
          {/* Inventory Column */}
          <div className="md:col-span-4 p-5 flex flex-col overflow-y-auto bg-slate-900/30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs uppercase font-bold tracking-wider text-slate-400 flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-400" /> Backpack ({inventory.length} types)
              </h3>
            </div>

            {inventory.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500 text-sm">
                <span>Pockets are empty.</span>
                <span className="text-xs text-slate-600 mt-1">
                  Pick up driftwood & flint on the beach to get started!
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {inventory.map((slot) => {
                  const def = ITEM_DEFINITIONS[slot.itemId];
                  return (
                    <div
                      key={slot.itemId}
                      className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-200">
                          {def ? def.name : slot.itemId}
                        </span>
                        <span className="text-xs font-mono font-bold text-amber-400">
                          x{slot.count}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                        {def ? def.locationHint : ''}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recipes / Guide Column */}
          <div className="md:col-span-8 p-5 flex flex-col overflow-y-auto">
            {/* Category Filter Tabs */}
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setActiveTab('tools')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'tools'
                    ? 'bg-amber-500 text-slate-950 shadow-md scale-102'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Hammer className="w-3.5 h-3.5" /> Primitive Tools
              </button>

              <button
                onClick={() => setActiveTab('survival')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'survival'
                    ? 'bg-amber-500 text-slate-950 shadow-md scale-102'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Flame className="w-3.5 h-3.5" /> Survival & Rope
              </button>

              <button
                onClick={() => setActiveTab('guide')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'guide'
                    ? 'bg-cyan-500 text-slate-950 shadow-md scale-102'
                    : 'bg-slate-800 text-cyan-300 hover:bg-slate-700 border border-cyan-500/30'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" /> Resource Locations & Guide
              </button>
            </div>

            {/* Notification Toast */}
            {craftMessage && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-semibold flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                {craftMessage}
              </div>
            )}

            {/* View A: Crafting Recipes */}
            {activeTab !== 'guide' && (
              <div className="flex flex-col gap-3">
                {sortedRecipes.map((recipe) => {
                  const canCraft = canCraftRecipe(inventory, recipe, isNearCampfire);

                  return (
                    <div
                      key={recipe.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        canCraft
                          ? 'bg-amber-500/10 border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                          : 'bg-slate-800/40 border-slate-700/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-100">{recipe.name}</span>
                            {canCraft && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-bold uppercase tracking-wider animate-pulse">
                                Ready to Craft
                              </span>
                            )}
                            {recipe.requiresCampfire && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-950/80 border border-orange-600/50 text-orange-300 font-semibold">
                                Needs Campfire
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{recipe.description}</p>

                          {/* Ingredients list with location tips if missing */}
                          <div className="flex flex-wrap items-center gap-2 mt-2.5">
                            {recipe.ingredients.map((ing) => {
                              const owned = getItemCount(inventory, ing.itemId);
                              const hasEnough = owned >= ing.count;
                              const def = ITEM_DEFINITIONS[ing.itemId];

                              return (
                                <div
                                  key={ing.itemId}
                                  className={`text-[11px] px-2.5 py-1 rounded-md border font-mono flex items-center gap-1.5 ${
                                    hasEnough
                                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 font-semibold'
                                      : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                                  }`}
                                  title={def ? def.locationHint : ''}
                                >
                                  <span>{def ? def.name : ing.itemId}:</span>
                                  <span>
                                    {owned}/{ing.count}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <button
                          onClick={() => handleCraft(recipe)}
                          disabled={!canCraft}
                          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95 ${
                            canCraft
                              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg cursor-pointer'
                              : 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                          }`}
                        >
                          {canCraft ? 'Craft Item' : 'Missing Mats'}
                        </button>
                      </div>

                      {/* Where to find ingredients tip banner for this recipe */}
                      {!canCraft && (
                        <div className="mt-2.5 pt-2 border-t border-slate-700/40 text-[10px] text-slate-400 flex items-start gap-1.5">
                          <MapPin className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                          <span>
                            {recipe.ingredients
                              .filter((ing) => getItemCount(inventory, ing.itemId) < ing.count)
                              .map((ing) => {
                                const def = ITEM_DEFINITIONS[ing.itemId];
                                return `${def?.name || ing.itemId}: ${def?.locationHint || ''}`;
                              })
                              .join(' · ')}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* View B: Dedicated Resource Locations Directory */}
            {activeTab === 'guide' && (
              <div className="flex flex-col gap-4">
                <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-xs text-cyan-200">
                  <div className="font-bold uppercase tracking-wider text-cyan-300 mb-1 flex items-center gap-2">
                    <Compass className="w-4 h-4" /> Island Biome Resource Radar
                  </div>
                  Walk across the island biomes to gather materials. You start on the beach! Pick up
                  driftwood and flint right around you to craft your first Stone Hatchet.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {resourceGuideList.map((itemId) => {
                    const def = ITEM_DEFINITIONS[itemId];
                    if (!def) return null;
                    return (
                      <div
                        key={itemId}
                        className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/70 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-amber-300">{def.name}</span>
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400">
                              {def.category}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300 mt-1 font-medium flex items-start gap-1.5">
                            <MapPin className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                            <span>{def.locationHint}</span>
                          </p>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2 border-t border-slate-700/50 pt-1.5">
                          {def.description}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Escape Paths Quick Blueprint */}
                <div className="p-4 rounded-xl bg-slate-800/70 border border-amber-500/30 text-xs text-slate-300 space-y-2 mt-2">
                  <div className="font-bold text-amber-400 uppercase tracking-wider">
                    How To Win & Escape:
                  </div>
                  <div>
                    1. <strong className="text-white">Ocean Raft (South-East Shore):</strong> Build
                    Stone Axe $\rightarrow$ Chop 10 Palm Logs $\rightarrow$ Twist 6 Ropes $\rightarrow$
                    Weave 6 Fronds for Sail $\rightarrow$ Stockpile 3 Cooked Meats + 3 Waters $\rightarrow$
                    Launch!
                  </div>
                  <div>
                    2. <strong className="text-white">Signal Pyre (North-West Peak):</strong> Gather
                    6 Stones + 8 Wood + 4 Fronds $\rightarrow$ Build Pyre atop the volcano $\rightarrow$
                    Wait for passing ship/plane $\rightarrow$ Light with Torch or Flare!
                  </div>
                  <div>
                    3. <strong className="text-white">Radio Rescue (North-East Cliff):</strong>
                    Scavenge 4 crates in the shipwreck shallows for Battery, Wire, Antenna $\rightarrow$
                    Repair Transceiver on the cliff to call Coast Guard airlift!
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
