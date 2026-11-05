"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  ALL_CATEGORIES,
  CATEGORY_MAX,
  normalizeCategory,
} from "@/lib/crm/lead-category";

/**
 * Small dialog to change a lead's category tag: pick from the list, type your
 * own (max 12 letters), or go back to the automatic guess.
 */
export function CategoryPicker({
  leadName,
  current,
  isManual,
  onSelect,
  onClose,
}: {
  leadName: string;
  current: string;
  isManual: boolean;
  /** null = reset to automatic */
  onSelect: (category: string | null) => void;
  onClose: () => void;
}) {
  const [custom, setCustom] = useState("");
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Presses inside this portal must not reach the lead card's long-press handlers.
  const isolate = (e: React.SyntheticEvent) => e.stopPropagation();
  const customValue = normalizeCategory(custom);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onMouseDown={isolate}
      onMouseMove={isolate}
      onMouseUp={isolate}
      onTouchStart={isolate}
      onTouchMove={isolate}
      onTouchEnd={isolate}
      onTouchCancel={isolate}
      onClick={isolate}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Change category"
        className="relative max-h-[85vh] w-full overflow-y-auto rounded-t-3xl border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Category</h2>
            <p className="truncate text-xs text-muted-foreground">{leadName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-muted-foreground hover:bg-accent"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {ALL_CATEGORIES.map((c) => {
            const active = c.toLowerCase() === current.toLowerCase();
            return (
              <button
                key={c}
                type="button"
                onClick={() => onSelect(c)}
                className={
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors " +
                  (active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-primary")
                }
              >
                {c}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={custom}
            onChange={(e) => setCustom(e.target.value.slice(0, CATEGORY_MAX))}
            maxLength={CATEGORY_MAX}
            placeholder={`Own tag (max ${CATEGORY_MAX} letters)`}
            aria-label="Custom category"
            className="h-10 min-w-0 flex-1 rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="button"
            disabled={!customValue}
            onClick={() => customValue && onSelect(customValue)}
            className="rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-40"
          >
            Set
          </button>
        </div>

        {isManual && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="mt-3 w-full rounded-xl border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent"
          >
            Reset to auto
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}
