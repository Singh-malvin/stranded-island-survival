import React, { useLayoutEffect, useRef, useState } from 'react';
import { getInitialDurability, ITEM_DEFS } from '../survival/items.ts';
import { getRecipesUsingItem } from '../survival/recipes.ts';
import { InventorySlot } from '../survival/types.ts';

export interface HoverTooltipData {
  slot: InventorySlot;
  x: number;
  y: number;
  preferAbove?: boolean;
}

/**
 * Floating instant hover tooltip clamped cleanly inside the browser viewport.
 */
export const FloatingItemTooltip: React.FC<{ hover: HoverTooltipData | null }> = ({ hover }) => {
  const tipRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: -9999, top: -9999 });

  useLayoutEffect(() => {
    if (!hover || !tipRef.current) return;
    const rect = tipRef.current.getBoundingClientRect();
    const pad = 10;
    const offset = 16;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = hover.x + offset;
    if (left + rect.width > vw - pad) {
      left = hover.x - rect.width - offset;
    }
    left = Math.max(pad, Math.min(vw - rect.width - pad, left));

    let top = hover.preferAbove ? hover.y - rect.height - offset : hover.y + offset;
    if (top + rect.height > vh - pad) {
      top = hover.y - rect.height - offset;
    }
    if (top < pad) {
      top = hover.y + offset;
    }
    top = Math.max(pad, Math.min(vh - rect.height - pad, top));

    setPos({ left, top });
  }, [hover]);

  if (!hover) return null;

  const { slot } = hover;
  const def = ITEM_DEFS[slot.itemId];
  if (!def) return null;

  const maxDurability = getInitialDurability(slot.itemId);
  const recipes = getRecipesUsingItem(slot.itemId);
  const shownRecipes = recipes.slice(0, 6);
  const extraCount = recipes.length - shownRecipes.length;

  return (
    <div
      ref={tipRef}
      role="tooltip"
      style={{ left: pos.left, top: pos.top }}
      className="pointer-events-none fixed z-[90] w-[264px] max-w-[84vw] rounded-lg border border-stone-600/85 bg-stone-950/95 p-3 text-left text-stone-100 shadow-2xl"
    >
      <div className="flex items-start justify-between gap-2 border-b border-stone-800/90 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl leading-none">{def.icon}</span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-stone-50">{def.name}</div>
            <div className="text-[10px] uppercase tracking-wider text-stone-400">{def.category}</div>
          </div>
        </div>
        <span className="shrink-0 rounded border border-amber-500/40 bg-amber-950/70 px-1.5 py-0.5 text-[11px] font-bold text-amber-300">
          x{slot.count}
        </span>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-stone-300">{def.description}</p>

      {slot.durability !== undefined && (
        <div className="mt-2 rounded border border-stone-800 bg-stone-900/70 px-2 py-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-stone-400">
              {def.id === 'torch' || def.id === 'lantern' ? 'Fuel Remaining' : 'Durability'}
            </span>
            <span className="font-mono font-semibold text-amber-300">
              {Math.ceil(slot.durability)}
              {maxDurability ? ` / ${maxDurability}` : ''}
              {def.id === 'torch' || def.id === 'lantern' ? 's' : ''}
            </span>
          </div>
          {maxDurability && (
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-stone-800">
              <div
                className="h-full bg-amber-400"
                style={{ width: `${Math.max(0, Math.min(100, (slot.durability / maxDurability) * 100))}%` }}
              />
            </div>
          )}
        </div>
      )}

      {def.food && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
          {def.food.hunger ? (
            <span className="rounded bg-amber-950/70 px-1.5 py-0.5 text-amber-300">
              +{def.food.hunger} Hunger
            </span>
          ) : null}
          {def.food.thirst ? (
            <span className="rounded bg-sky-950/70 px-1.5 py-0.5 text-sky-300">
              +{def.food.thirst} Thirst
            </span>
          ) : null}
          {def.food.health ? (
            <span className="rounded bg-emerald-950/70 px-1.5 py-0.5 text-emerald-300">
              +{def.food.health} Health
            </span>
          ) : null}
        </div>
      )}

      <div className="mt-2 border-t border-stone-800/80 pt-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
          Used For Crafting
        </div>
        {shownRecipes.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {shownRecipes.map((use) => (
              <span
                key={use.recipeId}
                className="rounded border border-stone-700/80 bg-stone-900 px-1.5 py-0.5 text-[10px] text-stone-200"
              >
                {use.recipeName}
              </span>
            ))}
            {extraCount > 0 && (
              <span className="px-1 py-0.5 text-[10px] text-stone-400">+{extraCount} more</span>
            )}
          </div>
        ) : (
          <div className="mt-0.5 text-[11px] text-stone-500">
            {def.category === 'tool'
              ? 'Equip in hotbar to chop, mine, hunt, or fend off wildlife.'
              : def.category === 'light'
                ? 'Equip in hotbar at night or inside the cave for light.'
                : def.category === 'placeable'
                  ? 'Select in hotbar & click dry ground to deploy.'
                  : def.category === 'story'
                    ? 'Key expedition item — inspect Journal [J] for details.'
                    : 'Not directly used as a crafting ingredient.'}
          </div>
        )}
      </div>
    </div>
  );
};
