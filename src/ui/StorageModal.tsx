import React from 'react';
import { Archive, ArrowLeftRight, Backpack, X } from 'lucide-react';
import { BASE_BUILDING } from '../survival/config.ts';
import { ITEM_DEFS } from '../survival/items.ts';
import type { InventorySlot, PlacedStructure, SurvivalState } from '../survival/types.ts';

interface StorageModalProps {
  chest: PlacedStructure | null;
  state: SurvivalState;
  onTransfer: (chestId: string, fromChest: boolean, slotIdx: number) => void;
  onClose: () => void;
}

export const StorageModal: React.FC<StorageModalProps> = ({
  chest,
  state,
  onTransfer,
  onClose,
}) => {
  if (!chest) return null;

  const chestSlots: (InventorySlot | null)[] = Array.from(
    { length: BASE_BUILDING.STORAGE_SLOTS },
    (_, i) => chest.storage?.[i] ?? null
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-stone-700 bg-stone-950 text-stone-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 bg-stone-900/90 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Archive className="h-5 w-5 text-amber-400" />
            <div>
              <h2 className="text-base font-bold text-stone-100">Woven Storage Chest</h2>
              <p className="text-xs text-stone-400">
                Click any item stack to move it between your backpack and camp chest
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Storage Chest"
            className="rounded-lg border border-stone-700 p-1.5 text-stone-400 hover:text-stone-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Two Panels: Chest & Backpack */}
        <div className="grid flex-1 gap-6 overflow-y-auto p-5 md:grid-cols-2">
          {/* Storage Chest */}
          <div>
            <div className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
              <Archive className="h-4 w-4" />
              <span>Camp Chest ({chestSlots.filter(Boolean).length}/{chestSlots.length})</span>
            </div>
            <div className="grid grid-cols-4 gap-2 rounded-xl border border-stone-800 bg-stone-900/60 p-3">
              {chestSlots.map((slot, idx) => {
                const def = slot ? ITEM_DEFS[slot.itemId] : null;
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={!slot}
                    onClick={() => onTransfer(chest.id, true, idx)}
                    title={def ? `Move ${def.name} to Backpack` : 'Empty chest slot'}
                    className={`relative flex h-16 flex-col items-center justify-center rounded-lg border text-center transition-colors ${
                      def
                        ? 'border-stone-700 bg-stone-800/90 hover:border-amber-400'
                        : 'cursor-default border-stone-800/60 bg-stone-950/50'
                    }`}
                  >
                    {def && slot ? (
                      <>
                        <span className="text-xl leading-none">{def.icon}</span>
                        <span className="mt-1 max-w-full truncate px-1 text-[10px] text-stone-300">
                          {def.name}
                        </span>
                        {slot.count > 1 && (
                          <span className="absolute right-1.5 top-1 text-[11px] font-bold text-amber-300">
                            {slot.count}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-[10px] text-stone-600">—</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Player Backpack */}
          <div>
            <div className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <Backpack className="h-4 w-4" />
              <span>
                Your Backpack ({state.inventory.filter(Boolean).length}/{state.inventory.length})
              </span>
            </div>
            <div className="grid grid-cols-6 gap-2 rounded-xl border border-stone-800 bg-stone-900/60 p-3">
              {state.inventory.map((slot, idx) => {
                const def = slot ? ITEM_DEFS[slot.itemId] : null;
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={!slot}
                    onClick={() => onTransfer(chest.id, false, idx)}
                    title={def ? `Store ${def.name} in Chest` : 'Empty backpack slot'}
                    className={`relative flex h-14 flex-col items-center justify-center rounded-lg border transition-colors ${
                      def
                        ? 'border-stone-700 bg-stone-800/90 hover:border-emerald-400'
                        : 'cursor-default border-stone-800/60 bg-stone-950/50'
                    }`}
                  >
                    {def && slot ? (
                      <>
                        <span className="text-lg leading-none">{def.icon}</span>
                        {slot.count > 1 && (
                          <span className="absolute bottom-0.5 right-1 text-[10px] font-bold text-stone-200">
                            {slot.count}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-[10px] text-stone-600">·</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-stone-800 bg-stone-900/80 px-5 py-2.5 text-xs text-stone-400">
          <span className="flex items-center gap-1.5">
            <ArrowLeftRight className="h-3.5 w-3.5 text-amber-400" />
            Click any stack to transfer seamlessly
          </span>
          <span>Press [Esc] to close</span>
        </div>
      </div>
    </div>
  );
};
