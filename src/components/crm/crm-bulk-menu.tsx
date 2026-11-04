"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CheckSquare, EllipsisVertical, Trash2, X } from "lucide-react";

type Props = {
  selectionActive: boolean;
  selectedCount: number;
  pending: boolean;
  stageOptions: { value: string; label: string }[];
  assignees: { id: string; name: string }[];
  canReassign: boolean;
  onEnterSelect: () => void;
  onExitSelect: () => void;
  onMove: (stage: string) => void;
  onAssign: (userId: string) => void;
  onDelete: () => void;
};

const selectClass =
  "h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50";

/**
 * Three-dot button that replaces the old "Select" button and the bulk toolbar.
 * Not selecting: one item, "Select leads". Selecting: Move to, Assign to,
 * Delete and Cancel. Rendered in a portal because the sticky filter bar's
 * blur would otherwise trap a fixed-position sheet inside it.
 */
export function BulkMenu({
  selectionActive,
  selectedCount,
  pending,
  stageOptions,
  assignees,
  canReassign,
  onEnterSelect,
  onExitSelect,
  onMove,
  onAssign,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    }
    setOpen((o) => !o);
  }

  const close = () => setOpen(false);
  const noneSelected = selectedCount === 0;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label="More options"
        aria-expanded={open}
        className={`relative ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-card transition-colors ${
          selectionActive
            ? "border-primary bg-primary/10 text-primary"
            : "bg-card text-muted-foreground hover:text-primary"
        }`}
      >
        <EllipsisVertical size={18} />
        {selectionActive && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {selectedCount}
          </span>
        )}
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <>
                <motion.div
                  key="backdrop"
                  className="fixed inset-0 z-[60] bg-black/40 sm:bg-transparent"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={close}
                />
                <motion.div
                  key="panel"
                  role="dialog"
                  aria-label="Lead options"
                  style={
                    {
                      "--menu-top": `${pos.top}px`,
                      "--menu-right": `${pos.right}px`,
                    } as CSSProperties
                  }
                  className="fixed inset-x-0 bottom-0 z-[70] rounded-t-3xl border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:inset-x-auto sm:bottom-auto sm:right-[var(--menu-right)] sm:top-[var(--menu-top)] sm:w-72 sm:rounded-2xl"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ duration: 0.15 }}
                >
                  {!selectionActive ? (
                    <button
                      type="button"
                      onClick={() => {
                        onEnterSelect();
                        close();
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors hover:bg-accent"
                    >
                      <CheckSquare size={17} className="text-primary" />
                      Select leads
                    </button>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold">
                          {selectedCount} lead{selectedCount !== 1 ? "s" : ""} selected
                        </h2>
                        <button
                          type="button"
                          onClick={close}
                          aria-label="Close"
                          className="rounded-full p-1 text-muted-foreground hover:bg-accent"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      {noneSelected && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Tick leads on the cards to use these actions.
                        </p>
                      )}

                      <div className="mt-4 space-y-3">
                        <select
                          disabled={pending || noneSelected}
                          value=""
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) return;
                            onMove(v);
                            close();
                          }}
                          className={selectClass}
                        >
                          <option value="" disabled>
                            Move to…
                          </option>
                          {stageOptions.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>

                        {canReassign && (
                          <select
                            disabled={pending || noneSelected}
                            value=""
                            onChange={(e) => {
                              const v = e.target.value;
                              if (!v) return;
                              onAssign(v);
                              close();
                            }}
                            className={selectClass}
                          >
                            <option value="" disabled>
                              Assign to…
                            </option>
                            {assignees.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                        )}

                        <button
                          type="button"
                          disabled={pending || noneSelected}
                          onClick={() => {
                            onDelete();
                            close();
                          }}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/5 disabled:opacity-40"
                        >
                          <Trash2 size={15} /> Delete
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          onExitSelect();
                          close();
                        }}
                        className="mt-3 w-full rounded-xl border px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
                      >
                        Cancel selection
                      </button>
                    </>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
