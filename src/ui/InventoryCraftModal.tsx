import React, { useEffect, useState } from 'react';
import { X, Hammer, Flame, Backpack, CheckCircle2, Lock } from 'lucide-react';
import { INVENTORY } from '../survival/config.ts';
import { countItem, getInitialDurability, ITEM_DEFS } from '../survival/items.ts';
import { checkRecipeAvailability, RECIPES } from '../survival/recipes.ts';
import { CraftStation, CraftTier, SurvivalState } from '../survival/types.ts';
import { FloatingItemTooltip, HoverTooltipData } from './ItemTooltip.tsx';

interface InventoryCraftModalProps {
  isOpen: boolean;
  focusMode?: 'inventory' | 'craft';
  state: SurvivalState;
  nearbyStations: ReadonlySet<CraftStation>;
  onClose: () => void;
  onSwapSlots: (fromIdx: number, toIdx: number) => void;
  onSelectHotbar: (slotIdx: number) => void;
  onConsumeSlot: (slotIdx: number) => void;
  onDropSlot: (slotIdx: number) => void;
  onCraftRecipe: (recipeId: string) => void;
}

export const InventoryCraftModal: React.FC<InventoryCraftModalProps> = ({
  isOpen,
  focusMode = 'inventory',
  state,
  nearbyStations,
  onClose,
  onSwapSlots,
  onSelectHotbar,
  onConsumeSlot,
  onDropSlot,
  onCraftRecipe,
}) => {
  const [selectedSlotIdx, setSelectedSlotIdx] = useState<number | null>(null);
  const [activeTier, setActiveTier] = useState<CraftTier>(1);
  const [hoverInfo, setHoverInfo] = useState<HoverTooltipData | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setHoverInfo(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const { inventory, flags } = state;
  const inspectedIdx = selectedSlotIdx ?? state.selectedSlot;
  const inspectedSlot = inventory[inspectedIdx] ?? null;
  const inspectedDef = inspectedSlot ? ITEM_DEFS[inspectedSlot.itemId] : null;

  const handleSlotClick = (idx: number) => {
    if (selectedSlotIdx === null) {
      setSelectedSlotIdx(idx);
      if (idx < INVENTORY.HOTBAR_SIZE) {
        onSelectHotbar(idx);
      }
      return;
    }
    if (selectedSlotIdx === idx) {
      setSelectedSlotIdx(null);
      return;
    }
    onSwapSlots(selectedSlotIdx, idx);
    setSelectedSlotIdx(null);
  };

  const filteredRecipes = RECIPES.filter((r) => r.tier === activeTier);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4 font-sans text-stone-100">
      <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-stone-700 bg-stone-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <Backpack className="h-5 w-5 text-amber-400" />
            <div>
              <h2 className="text-lg font-bold tracking-wide text-stone-100">
                {focusMode === 'craft' ? 'FIELD CRAFTING & SURVIVOR PACK' : 'SURVIVOR PACK & FIELD CRAFTING'}
              </h2>
              <p className="text-xs text-stone-400">
                [I] Pack • [Tab] Crafting • Click two slots to swap or stack items
              </p>
            </div>
          </div>

          {/* Nearby Station Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium border ${
                nearbyStations.has('campfire')
                  ? 'border-amber-600/80 bg-amber-950/80 text-amber-300'
                  : 'border-stone-800 bg-stone-900 text-stone-500'
              }`}
            >
              <Flame className="h-3.5 w-3.5" />
              {nearbyStations.has('campfire') ? 'Campfire' : 'No Fire'}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium border ${
                nearbyStations.has('workbench')
                  ? 'border-emerald-600/80 bg-emerald-950/80 text-emerald-300'
                  : 'border-stone-800 bg-stone-900 text-stone-500'
              }`}
            >
              <Hammer className="h-3.5 w-3.5" />
              {nearbyStations.has('workbench') ? 'Workbench' : 'No Bench'}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium border ${
                nearbyStations.has('forge')
                  ? 'border-orange-600/80 bg-orange-950/80 text-orange-300'
                  : 'border-stone-800 bg-stone-900 text-stone-500'
              }`}
            >
              {nearbyStations.has('forge') ? '⚒️ Forge' : 'No Forge'}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Backpack and Crafting"
              className="rounded-lg border border-stone-700 bg-stone-900 p-2 text-stone-300 hover:border-stone-500 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto p-6 lg:grid-cols-12">
          {/* Left Column: Hotbar + Backpack Grid + Item Inspector (5 cols) */}
          <div
            className={`flex flex-col gap-5 rounded-xl p-2 transition lg:col-span-5 ${
              focusMode === 'inventory' ? 'ring-1 ring-amber-400/35 bg-stone-900/25' : ''
            }`}
          >
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                Quick Hotbar (Keys 1–6)
              </div>
              <div className="grid grid-cols-6 gap-2">
                {inventory.slice(0, INVENTORY.HOTBAR_SIZE).map((slot, idx) => {
                  const def = slot ? ITEM_DEFS[slot.itemId] : null;
                  const isPicked = selectedSlotIdx === idx;
                  const maxDur = slot ? getInitialDurability(slot.itemId) : undefined;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSlotClick(idx)}
                      onMouseEnter={(e) =>
                        slot && setHoverInfo({ slot, x: e.clientX, y: e.clientY })
                      }
                      onMouseMove={(e) =>
                        slot && setHoverInfo({ slot, x: e.clientX, y: e.clientY })
                      }
                      onMouseLeave={() => setHoverInfo(null)}
                      className={`relative flex h-[74px] flex-col items-center justify-between rounded-lg border px-1 py-1.5 transition ${
                        isPicked
                          ? 'border-amber-400 bg-amber-950/50 ring-2 ring-amber-400/40'
                          : 'border-stone-700 bg-stone-900 hover:border-stone-500'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between px-0.5 text-[10px] leading-none">
                        <span className="font-mono text-stone-400">{idx + 1}</span>
                        {slot && slot.count > 1 ? (
                          <span className="font-bold text-stone-200">{slot.count}</span>
                        ) : (
                          <span />
                        )}
                      </div>
                      {def ? (
                        <>
                          <span className="text-xl leading-none">{def.icon}</span>
                          <span className="w-full truncate text-center text-[9.5px] font-medium leading-tight text-stone-300">
                            {def.name}
                          </span>
                          {slot?.durability !== undefined && maxDur && (
                            <div className="absolute bottom-0.5 left-1.5 right-1.5 h-0.5 overflow-hidden rounded-full bg-stone-700">
                              <div
                                className="h-full bg-amber-400"
                                style={{
                                  width: `${Math.max(0, Math.min(100, Math.round((slot.durability / maxDur) * 100)))}%`,
                                }}
                              />
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="my-auto text-[10px] text-stone-600">—</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-400">
                Rucksack Storage ({INVENTORY.SLOTS - INVENTORY.HOTBAR_SIZE} Slots)
              </div>
              <div className="grid grid-cols-6 gap-2">
                {inventory.slice(INVENTORY.HOTBAR_SIZE).map((slot, offset) => {
                  const idx = offset + INVENTORY.HOTBAR_SIZE;
                  const def = slot ? ITEM_DEFS[slot.itemId] : null;
                  const isPicked = selectedSlotIdx === idx;
                  const maxDur = slot ? getInitialDurability(slot.itemId) : undefined;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSlotClick(idx)}
                      onMouseEnter={(e) =>
                        slot && setHoverInfo({ slot, x: e.clientX, y: e.clientY })
                      }
                      onMouseMove={(e) =>
                        slot && setHoverInfo({ slot, x: e.clientX, y: e.clientY })
                      }
                      onMouseLeave={() => setHoverInfo(null)}
                      className={`relative flex h-[72px] flex-col items-center justify-between rounded-lg border px-1 py-1.5 transition ${
                        isPicked
                          ? 'border-amber-400 bg-amber-950/50 ring-2 ring-amber-400/40'
                          : 'border-stone-800 bg-stone-900/75 hover:border-stone-600'
                      }`}
                    >
                      <div className="flex w-full justify-end px-0.5 text-[10px] leading-none">
                        {slot && slot.count > 1 ? (
                          <span className="font-bold text-stone-200">{slot.count}</span>
                        ) : (
                          <span className="h-2.5" />
                        )}
                      </div>
                      {def ? (
                        <>
                          <span className="text-xl leading-none">{def.icon}</span>
                          <span className="w-full truncate text-center text-[9.5px] font-medium leading-tight text-stone-300">
                            {def.name}
                          </span>
                          {slot?.durability !== undefined && maxDur && (
                            <div className="absolute bottom-0.5 left-1.5 right-1.5 h-0.5 overflow-hidden rounded-full bg-stone-700">
                              <div
                                className="h-full bg-amber-400"
                                style={{
                                  width: `${Math.max(0, Math.min(100, Math.round((slot.durability / maxDur) * 100)))}%`,
                                }}
                              />
                            </div>
                          )}
                        </>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Slot Quick Actions */}
            <div className="mt-auto rounded-lg border border-stone-800 bg-stone-900/80 px-3.5 py-2.5">
              {inspectedDef && inspectedSlot ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl">{inspectedDef.icon}</span>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-stone-100">
                        {inspectedDef.name} (x{inspectedSlot.count})
                      </div>
                      <div className="text-[11px] text-stone-400">
                        Hover any slot for recipes & full info • Click another slot to swap
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {inspectedDef.food && (
                      <button
                        type="button"
                        onClick={() => onConsumeSlot(inspectedIdx)}
                        className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-bold text-stone-950 hover:bg-amber-400"
                      >
                        Consume
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setHoverInfo(null);
                        onDropSlot(inspectedIdx);
                      }}
                      className="rounded-md border border-stone-700 bg-stone-800 px-2.5 py-1.5 text-xs text-stone-300 hover:border-red-500/60 hover:text-red-300"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-stone-500">
                  Hover any item for recipes & details, or click a slot to swap / use / discard.
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Tiered Crafting Recipes (7 cols) */}
          <div
            className={`flex flex-col gap-4 rounded-xl p-2 transition lg:col-span-7 ${
              focusMode === 'craft' ? 'ring-1 ring-amber-400/35 bg-stone-900/25' : ''
            }`}
          >
            {/* Tier Tabs */}
            <div className="flex items-center gap-2 border-b border-stone-800 pb-3">
              {(
                [
                  { tier: 1 as CraftTier, label: 'Tier 1: Primitive & Fire' },
                  { tier: 2 as CraftTier, label: 'Tier 2: Workbench' },
                  { tier: 3 as CraftTier, label: 'Tier 3: Alloy Forge' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.tier}
                  type="button"
                  onClick={() => setActiveTier(tab.tier)}
                  className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                    activeTier === tab.tier
                      ? 'bg-amber-500 text-stone-950'
                      : 'border border-stone-800 bg-stone-900 text-stone-300 hover:border-stone-700'
                  }`}
                >
                  <Hammer className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Recipe Cards */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {filteredRecipes.map((recipe) => {
                const check = checkRecipeAvailability(
                  recipe,
                  inventory,
                  nearbyStations,
                  flags
                );
                const outDef = ITEM_DEFS[recipe.result.itemId];

                return (
                  <div
                    key={recipe.id}
                    className={`flex flex-col justify-between rounded-lg border p-3.5 transition ${
                      check.canCraft
                        ? 'border-stone-700 bg-stone-900/95'
                        : 'border-stone-800/80 bg-stone-900/45 opacity-80'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{outDef.icon}</span>
                          <div>
                            <div className="text-sm font-bold text-stone-100">
                              {recipe.name}
                            </div>
                            <div className="text-[11px] text-stone-400">
                              Station:{' '}
                              <span
                                className={
                                  check.stationOk ? 'text-emerald-400' : 'text-amber-400'
                                }
                              >
                                {recipe.station === 'hands'
                                  ? 'Hands'
                                  : recipe.station === 'campfire'
                                    ? '🔥 Lit Campfire'
                                    : recipe.station === 'workbench'
                                      ? '🛠️ Workbench'
                                      : '⚒️ Forge'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <p className="mt-2 text-xs leading-snug text-stone-400">
                        {recipe.description}
                      </p>

                      {/* Ingredients list */}
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {recipe.ingredients.map((req) => {
                          const have = countItem(inventory, req.itemId);
                          const enough = have >= req.count;
                          const ingDef = ITEM_DEFS[req.itemId];
                          return (
                            <span
                              key={req.itemId}
                              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium border ${
                                enough
                                  ? 'border-emerald-800/70 bg-emerald-950/50 text-emerald-300'
                                  : 'border-stone-700 bg-stone-800/80 text-stone-400'
                              }`}
                            >
                              <span>{ingDef.icon}</span>
                              <span>
                                {have}/{req.count} {ingDef.name}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!check.canCraft}
                      onClick={() => onCraftRecipe(recipe.id)}
                      className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-bold transition ${
                        check.canCraft
                          ? 'bg-amber-500 text-stone-950 hover:bg-amber-400'
                          : 'cursor-not-allowed bg-stone-800 text-stone-500'
                      }`}
                    >
                      {check.canCraft ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Craft Item
                        </>
                      ) : !check.stationOk ? (
                        <>
                          <Lock className="h-3.5 w-3.5" /> Move Near {recipe.station}
                        </>
                      ) : (
                        'Missing Materials'
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <FloatingItemTooltip hover={hoverInfo} />
    </div>
  );
};
