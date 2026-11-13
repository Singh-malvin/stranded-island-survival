import React, { useState } from 'react';
import { Hammer, X } from 'lucide-react';
import { countItem, ITEM_DEFS } from '../survival/items.ts';
import {
  checkStructureIngredients,
  STRUCTURE_CATALOG,
  STRUCTURE_ORDER,
} from '../survival/structures.ts';
import type { StructureCategory, StructureType, SurvivalState } from '../survival/types.ts';

interface BuildModalProps {
  isOpen: boolean;
  state: SurvivalState;
  onSelectBuild: (type: StructureType) => void;
  onClose: () => void;
}

export const BuildModal: React.FC<BuildModalProps> = ({
  isOpen,
  state,
  onSelectBuild,
  onClose,
}) => {
  const [category, setCategory] = useState<'all' | StructureCategory>('all');

  if (!isOpen) return null;

  const filtered = STRUCTURE_ORDER.map((id) => STRUCTURE_CATALOG[id]).filter(
    (def) => category === 'all' || def.category === category
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
      <div className="flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-stone-700 bg-stone-950 text-stone-100 shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-800 bg-stone-900/90 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Hammer className="h-5 w-5 text-amber-400" />
            <div>
              <h2 className="text-base font-bold text-stone-100">Base Building</h2>
              <p className="text-xs text-stone-400">
                Select a structure to preview and place it directly in the world ([R] rotate, [E/Click] place)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'all', label: 'All (10)' },
                { id: 'camp', label: 'Camp & Shelter' },
                { id: 'production', label: 'Food & Water' },
                { id: 'crafting', label: 'Bench & Storage' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategory(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  category === tab.id
                    ? 'bg-amber-600 text-stone-950'
                    : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Build Menu"
              className="ml-2 rounded-lg border border-stone-700 p-1.5 text-stone-400 hover:text-stone-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Grid of Structures */}
        <div className="grid flex-1 gap-3 overflow-y-auto p-5 sm:grid-cols-2">
          {filtered.map((def) => {
            const afford = checkStructureIngredients(def.id, state.inventory);
            return (
              <div
                key={def.id}
                className={`flex flex-col justify-between rounded-xl border p-4 ${
                  afford.canBuild
                    ? 'border-stone-700 bg-stone-900/80'
                    : 'border-stone-800/80 bg-stone-900/40 opacity-80'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{def.icon}</span>
                      <div>
                        <div className="text-sm font-bold text-stone-100">{def.name}</div>
                        <div className="text-[11px] uppercase tracking-wide text-stone-400">
                          {def.surface === 'shallow_water' ? 'Shallow Lagoon Water' : 'Dry Ground'}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                        afford.canBuild
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-stone-800 text-stone-400'
                      }`}
                    >
                      {afford.canBuild ? 'Ready' : 'Need Parts'}
                    </span>
                  </div>

                  <p className="mt-2 text-xs leading-relaxed text-stone-400">{def.description}</p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {def.ingredients.map((ing) => {
                      const have = countItem(state.inventory, ing.itemId);
                      const ok = have >= ing.count;
                      const item = ITEM_DEFS[ing.itemId];
                      return (
                        <span
                          key={ing.itemId}
                          className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium ${
                            ok
                              ? 'border-emerald-800/70 bg-emerald-950/30 text-emerald-300'
                              : 'border-rose-900/70 bg-rose-950/25 text-rose-300'
                          }`}
                        >
                          <span>{item.icon}</span>
                          <span>
                            {have}/{ing.count} {item.name}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!afford.canBuild}
                  onClick={() => onSelectBuild(def.id)}
                  className={`mt-4 w-full rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                    afford.canBuild
                      ? 'bg-amber-600 text-stone-950 hover:bg-amber-500'
                      : 'cursor-not-allowed bg-stone-800 text-stone-500'
                  }`}
                >
                  {afford.canBuild ? 'Place Structure' : 'Insufficient Materials'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-stone-800 bg-stone-900/80 px-5 py-2.5 text-xs text-stone-400">
          <span>Structures persist automatically in your save file across days and respawns.</span>
          <span>Press [B] or [Esc] to close</span>
        </div>
      </div>
    </div>
  );
};
