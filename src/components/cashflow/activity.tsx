import { ArrowDownLeft, ArrowUpRight, FilePlus } from "lucide-react";
import { dayLabel, inr } from "@/lib/cashflow/calc";
import { cn } from "@/lib/utils";

export type ActivityItem = {
  id: string;
  date: string;
  title: string;
  sub: string;
  amount: number;
  kind: "in" | "out" | "bill";
};

const ICON = {
  in: { Icon: ArrowDownLeft, cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  out: { Icon: ArrowUpRight, cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
  bill: { Icon: FilePlus, cls: "bg-accent text-primary" },
} as const;

export function ActivityList({ items, empty }: { items: ActivityItem[]; empty: string }) {
  if (items.length === 0) {
    return <div className="rounded-2xl border bg-card p-3 text-sm text-muted-foreground">{empty}</div>;
  }
  const groups: { date: string; rows: ActivityItem[] }[] = [];
  for (const it of items) {
    const g = groups[groups.length - 1];
    if (g && g.date === it.date) g.rows.push(it);
    else groups.push({ date: it.date, rows: [it] });
  }
  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => (
        <div key={g.date}>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{dayLabel(g.date)}</p>
          <div className="divide-y rounded-2xl border bg-card px-3">
            {g.rows.map(({ id, title, sub, amount, kind }) => {
              const { Icon, cls } = ICON[kind];
              return (
                <div key={id} className="flex items-center gap-3 py-2.5">
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", cls)}>
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{title}</p>
                    <p className="truncate text-xs text-muted-foreground">{sub}</p>
                  </div>
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      kind === "in" && "text-emerald-600",
                      kind === "out" && "text-red-600"
                    )}
                  >
                    {kind === "in" ? "+" : kind === "out" ? "−" : ""}
                    {inr(amount)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
