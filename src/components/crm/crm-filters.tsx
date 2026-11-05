"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Funnel, X } from "lucide-react";

export type FollowupFilter = "all" | "overdue" | "due_today" | "not_set";

const FOLLOWUP_OPTIONS: { value: FollowupFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "due_today", label: "Today" },
  { value: "overdue", label: "Overdue" },
  { value: "not_set", label: "Not set" },
];

type FiltersCtx = {
  followup: FollowupFilter;
  setFollowup: (v: FollowupFilter) => void;
  assignedTo: string;
  setAssignedTo: (v: string) => void;
  /** Selected category tags (lowercase keys). Empty = all. */
  categories: string[];
  toggleCategory: (key: string) => void;
  /** Categories present in the current leads, with counts (set by the board). */
  availableCategories: { name: string; count: number }[];
  setAvailableCategories: (v: { name: string; count: number }[]) => void;
  activeCount: number;
  clear: () => void;
};

const Ctx = createContext<FiltersCtx | null>(null);

/** Holds the CRM filters so the header icon and the kanban board share them. */
export function CrmFiltersProvider({ children }: { children: ReactNode }) {
  const [followup, setFollowup] = useState<FollowupFilter>("all");
  const [assignedTo, setAssignedTo] = useState("all");
  const [categories, setCategories] = useState<string[]>([]);
  const [availableCategories, setAvailableCategoriesState] = useState<
    { name: string; count: number }[]
  >([]);

  const setAvailableCategories = useCallback(
    (next: { name: string; count: number }[]) => {
      setAvailableCategoriesState((cur) =>
        JSON.stringify(cur) === JSON.stringify(next) ? cur : next
      );
    },
    []
  );

  const value = useMemo<FiltersCtx>(
    () => ({
      followup,
      setFollowup,
      assignedTo,
      setAssignedTo,
      categories,
      toggleCategory: (key) =>
        setCategories((cur) =>
          cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]
        ),
      availableCategories,
      setAvailableCategories,
      activeCount:
        (followup !== "all" ? 1 : 0) +
        (assignedTo !== "all" ? 1 : 0) +
        (categories.length > 0 ? 1 : 0),
      clear: () => {
        setFollowup("all");
        setAssignedTo("all");
        setCategories([]);
      },
    }),
    [followup, assignedTo, categories, availableCategories, setAvailableCategories]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCrmFilters() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCrmFilters must be used inside CrmFiltersProvider");
  return ctx;
}

/**
 * Funnel icon with a count badge. Opens a bottom sheet on mobile and a small
 * dropdown on larger screens. "Assigned to" is only shown to non-members.
 */
export function CrmFilterButton({
  assignees,
  canFilterAssignee,
}: {
  assignees: { id: string; name: string }[];
  canFilterAssignee: boolean;
}) {
  const {
    followup,
    setFollowup,
    assignedTo,
    setAssignedTo,
    categories,
    toggleCategory,
    availableCategories,
    activeCount,
    clear,
  } = useCrmFilters();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Filters"
        aria-expanded={open}
        className={`relative flex h-10 w-10 items-center justify-center rounded-xl border shadow-card transition-colors ${
          activeCount > 0
            ? "border-primary bg-primary/10 text-primary"
            : "bg-card text-muted-foreground hover:text-primary"
        }`}
      >
        <Funnel size={17} />
        {activeCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {activeCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-40 bg-black/40 sm:bg-transparent"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              key="panel"
              role="dialog"
              aria-label="Filters"
              className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-3xl border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72 sm:rounded-2xl"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.15 }}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Filters</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="rounded-full p-1 text-muted-foreground hover:bg-accent"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Follow-up</p>
                <div className="flex flex-wrap gap-2">
                  {FOLLOWUP_OPTIONS.map((o) => {
                    const active = followup === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => setFollowup(o.value)}
                        className={
                          "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors " +
                          (active
                            ? "border-primary bg-primary text-primary-foreground"
                            : o.value === "overdue"
                            ? "border-red-200 bg-card text-red-600 dark:border-red-800 dark:text-red-400"
                            : "border-border bg-card text-muted-foreground")
                        }
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {canFilterAssignee && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Assigned to</p>
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="all">All assignees</option>
                    {assignees.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {availableCategories.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Category</p>
                  <div className="flex flex-wrap gap-2">
                    {availableCategories.map((c) => {
                      const key = c.name.toLowerCase();
                      const active = categories.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleCategory(key)}
                          aria-pressed={active}
                          className={
                            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
                            (active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card text-muted-foreground")
                          }
                        >
                          {c.name} <span className="opacity-70">{c.count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={clear}
                  disabled={activeCount === 0}
                  className="flex-1 rounded-xl border px-3 py-2 text-xs font-semibold text-muted-foreground disabled:opacity-40"
                >
                  Clear all
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
