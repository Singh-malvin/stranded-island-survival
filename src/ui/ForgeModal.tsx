import React, { useEffect, useState } from 'react';
import { Flame, ArrowRight, PackagePlus, Sparkles, X, Hammer } from 'lucide-react';
import { FORGE_TUNING } from '../survival/config.ts';
import { countItem, ITEM_DEFS } from '../survival/items.ts';
import { getForgeQueue, isForgeWoodItem } from '../survival/structures.ts';
import type { InventorySlot, PlacedStructure, SurvivalState } from '../survival/types.ts';
import { FloatingItemTooltip, HoverTooltipData } from './ItemTooltip.tsx';

interface ForgeModalProps {
  forge: PlacedStructure | null;
  state: SurvivalState;
  onDepositWood: (forgeId: string, itemId: 'log' | 'stick', slotIdx?: number) => void;
  onCollectDriftwood: (forgeId: string) => void;
  onOpenAlloyRecipes: () => void;
  onClose: () => void;
}

export const ForgeModal: React.FC<ForgeModalProps> = ({
  forge,
  state,
  onDepositWood,
  onCollectDriftwood,
  onOpenAlloyRecipes,
  onClose,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<HoverTooltipData | null>(null);

  useEffect(() => {
    if (!forge) {
      setHoverInfo(null);
      setIsDragOver(false);
    }
  }, [forge]);

  if (!forge) return null;

  const fq = getForgeQueue(forge);
  const isBurning = fq.inputWood > 0;
  const pct = isBurning
    ? Math.min(100, Math.round((fq.progressSec / FORGE_TUNING.WOOD_TO_DRIFTWOOD_SEC) * 100))
    : 0;
  const remainingSec = isBurning
    ? Math.max(0.2, FORGE_TUNING.WOOD_TO_DRIFTWOOD_SEC - fq.progressSec)
    : 0;

  const totalLogs = countItem(state.inventory, 'log');
  const totalSticks = countItem(state.inventory, 'stick');

  const woodSlots: { idx: number; slot: InventorySlot }[] = [];
  state.inventory.forEach((slot, idx) => {
    if (slot && isForgeWoodItem(slot.itemId)) {
      woodSlots.push({ idx, slot });
    }
  });

  const handleDropOnInput = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { itemId?: string; slotIdx?: number };
      if (parsed.itemId === 'log' || parsed.itemId === 'stick') {
        onDepositWood(forge.id, parsed.itemId, parsed.slotIdx);
      }
    } catch {
      // Ignore malformed drop payload
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4 font-sans text-stone-100">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-stone-700 bg-stone-950 shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-800 bg-stone-900/90 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Flame className={`h-5 w-5 ${isBurning ? 'animate-pulse text-orange-400' : 'text-amber-400'}`} />
            <div>
              <h2 className="text-base font-bold text-stone-100">Stone Charcoal Forge — Driftwood Kiln</h2>
              <p className="text-xs text-stone-400">
                Drag or click raw Wood below into the kiln input to cure seasoned Driftwood
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenAlloyRecipes}
              className="flex items-center gap-1.5 rounded-lg border border-stone-700 bg-stone-800 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:border-amber-500/60 hover:bg-stone-700"
            >
              <Hammer className="h-3.5 w-3.5" />
              Alloy Smelting [Tab]
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Stone Forge"
              className="rounded-lg border border-stone-700 p-1.5 text-stone-400 hover:text-stone-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto p-5">
          {/* Kiln Processing Pipeline: Input -> Fire Glow Progress -> Output */}
          <div className="grid grid-cols-1 items-center gap-4 rounded-xl border border-stone-800 bg-stone-900/65 p-4 sm:grid-cols-11">
            {/* Input Dropzone Slot */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDropOnInput}
              className={`sm:col-span-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-3.5 text-center transition ${
                isDragOver
                  ? 'border-orange-400 bg-orange-950/55 ring-2 ring-orange-400/40'
                  : isBurning
                    ? 'border-amber-600/75 bg-amber-950/25'
                    : 'border-stone-700 bg-stone-950/70'
              }`}
            >
              <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                Kiln Input Slot
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-2xl">{isBurning ? '🌲' : '🪵'}</span>
                <span className="text-lg font-bold text-stone-100">
                  {fq.inputWood} / {FORGE_TUNING.MAX_QUEUE_WOOD}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-stone-400">
                Drop Wood here or click below (Log = 2x, Branch = 1x)
              </p>
              <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
                <button
                  type="button"
                  disabled={totalLogs <= 0}
                  onClick={() => onDepositWood(forge.id, 'log')}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                    totalLogs > 0
                      ? 'bg-amber-600 text-stone-950 hover:bg-amber-500'
                      : 'cursor-not-allowed bg-stone-800 text-stone-500'
                  }`}
                >
                  <PackagePlus className="h-3 w-3" /> +1 Log ({totalLogs})
                </button>
                <button
                  type="button"
                  disabled={totalSticks <= 0}
                  onClick={() => onDepositWood(forge.id, 'stick')}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                    totalSticks > 0
                      ? 'border border-amber-600/70 bg-amber-950/60 text-amber-200 hover:bg-amber-900/70'
                      : 'cursor-not-allowed bg-stone-800 text-stone-500'
                  }`}
                >
                  <PackagePlus className="h-3 w-3" /> +1 Branch ({totalSticks})
                </button>
              </div>
            </div>

            {/* Progress & Fire Glow Indicator */}
            <div className="sm:col-span-3 flex flex-col items-center justify-center gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <Flame
                  className={`h-4 w-4 ${
                    isBurning ? 'animate-pulse text-orange-400' : 'text-stone-600'
                  }`}
                />
                <span className={isBurning ? 'text-orange-300' : 'text-stone-500'}>
                  {isBurning ? `Kiln Curing (${remainingSec.toFixed(1)}s)` : 'Kiln Idle'}
                </span>
                <ArrowRight className={`h-4 w-4 ${isBurning ? 'text-orange-400' : 'text-stone-600'}`} />
              </div>

              <div className="h-2.5 w-full overflow-hidden rounded-full border border-stone-700 bg-stone-950">
                <div
                  className={`h-full transition-all duration-150 ${
                    isBurning
                      ? 'bg-gradient-to-r from-orange-600 via-amber-500 to-yellow-400'
                      : 'bg-stone-700'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-[11px] font-mono text-stone-400">
                {pct}% • {FORGE_TUNING.WOOD_TO_DRIFTWOOD_SEC}s / Driftwood
              </div>
            </div>

            {/* Output Driftwood Slot */}
            <div
              className={`sm:col-span-4 flex flex-col items-center justify-center rounded-xl border p-3.5 text-center transition ${
                fq.outputDriftwood > 0
                  ? 'border-emerald-500/80 bg-emerald-950/35'
                  : 'border-stone-800 bg-stone-950/70'
              }`}
            >
              <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                Output Slot
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-2xl">🪵</span>
                <span className="text-lg font-bold text-stone-100">
                  Driftwood x{fq.outputDriftwood}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-stone-400">
                Seasoned wood ready for torches, planks & spears
              </p>
              <button
                type="button"
                disabled={fq.outputDriftwood <= 0}
                onClick={() => onCollectDriftwood(forge.id)}
                className={`mt-2.5 flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-bold transition ${
                  fq.outputDriftwood > 0
                    ? 'bg-emerald-500 text-stone-950 hover:bg-emerald-400'
                    : 'cursor-not-allowed bg-stone-800 text-stone-500'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Collect Driftwood
              </button>
            </div>
          </div>

          {/* Wood Available in Backpack */}
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-400">
              Your Wood in Backpack (Click or Drag into Kiln Input)
            </div>
            {woodSlots.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {woodSlots.map(({ idx, slot }) => {
                  const def = ITEM_DEFS[slot.itemId];
                  return (
                    <button
                      key={idx}
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          'application/json',
                          JSON.stringify({ itemId: slot.itemId, slotIdx: idx })
                        );
                      }}
                      onClick={() =>
                        onDepositWood(forge.id, slot.itemId as 'log' | 'stick', idx)
                      }
                      onMouseEnter={(e) =>
                        setHoverInfo({ slot, x: e.clientX, y: e.clientY, preferAbove: true })
                      }
                      onMouseMove={(e) =>
                        setHoverInfo({ slot, x: e.clientX, y: e.clientY, preferAbove: true })
                      }
                      onMouseLeave={() => setHoverInfo(null)}
                      className="flex h-[74px] flex-col items-center justify-between rounded-lg border border-stone-700 bg-stone-900 px-1.5 py-1.5 transition hover:border-orange-400 hover:bg-stone-800"
                    >
                      <div className="flex w-full items-center justify-between text-[10px] text-stone-400">
                        <span>+{slot.itemId === 'log' ? 2 : 1}</span>
                        <span className="font-bold text-stone-200">x{slot.count}</span>
                      </div>
                      <span className="text-xl leading-none">{def.icon}</span>
                      <span className="w-full truncate text-center text-[9.5px] font-medium text-stone-300">
                        {def.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-stone-800 bg-stone-900/50 px-4 py-3 text-xs text-stone-400">
                No Timber Logs or Fallen Branches in your backpack. Equip an Axe to chop Palm or Pine trees, or collect Fallen Branches off the ground!
              </div>
            )}
          </div>
        </div>
      </div>
      <FloatingItemTooltip hover={hoverInfo} />
    </div>
  );
};
