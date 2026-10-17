"use client";

import { useRouter } from "next/navigation";

export function TodayDatePicker({
  date,
  todayStr,
  who,
}: {
  date: string;
  todayStr: string;
  who: "mine" | "all";
}) {
  const router = useRouter();

  function go(d: string) {
    const qs = new URLSearchParams();
    if (d && d !== todayStr) qs.set("date", d);
    if (who === "all") qs.set("who", "all");
    const s = qs.toString();
    router.push("/crm/today" + (s ? "?" + s : ""));
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={date}
        onChange={(e) => e.target.value && go(e.target.value)}
        className="h-10 rounded-xl border border-input bg-card px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
      />
      {date !== todayStr && (
        <button
          type="button"
          onClick={() => go(todayStr)}
          className="h-10 rounded-xl bg-accent px-3 text-xs font-semibold text-primary"
        >
          Today
        </button>
      )}
    </div>
  );
}
