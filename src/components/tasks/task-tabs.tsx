"use client";

import { useState, type ReactNode } from "react";

export interface TaskTab {
  key: string;
  label: string;
  count: number;
  content: ReactNode;
}

// Native-style filter chips. The server page builds the (already rendered)
// content for each tab; this only switches which one is visible.
export function TaskTabs({
  tabs,
  defaultKey = "all",
}: {
  tabs: TaskTab[];
  defaultKey?: string;
}) {
  const [active, setActive] = useState(defaultKey);
  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div className="space-y-4">
      <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {tabs.map((tab) => {
          const isActive = tab.key === current.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActive(tab.key)}
              className={
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors " +
                (isActive
                  ? "border-primary bg-primary text-primary-foreground shadow-card"
                  : "border-border bg-card text-muted-foreground hover:text-foreground")
              }
            >
              {tab.label}
              <span
                className={
                  "rounded-full px-1.5 text-[11px] " +
                  (isActive ? "bg-white/25" : "bg-muted")
                }
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {current.count === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
          No tasks here.
        </div>
      ) : (
        current.content
      )}
    </div>
  );
}
