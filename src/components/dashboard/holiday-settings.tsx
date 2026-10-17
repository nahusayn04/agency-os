"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export interface HolidayItem {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
}

const fieldClass =
  "h-11 w-full min-w-0 rounded-xl border bg-card px-3.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/30";

function DateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`holiday-date-input ${fieldClass}`}
    />
  );
}

export function HolidaySettings({
  initialSundayOff,
  initialHolidays,
}: {
  initialSundayOff: boolean;
  initialHolidays: HolidayItem[];
}) {
  const [sundayOff, setSundayOff] = useState(initialSundayOff);
  const [togglePending, startToggleTransition] = useTransition();
  const [toggleError, setToggleError] = useState<string | null>(null);

  const [holidays, setHolidays] = useState(initialHolidays);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [addPending, startAddTransition] = useTransition();
  const [addError, setAddError] = useState<string | null>(null);

  function toggleSunday() {
    const next = !sundayOff;
    setToggleError(null);
    startToggleTransition(async () => {
      const res = await fetch("/api/admin/attendance-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sundayOff: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToggleError(data.error ?? "Save failed.");
        return;
      }
      setSundayOff(next);
    });
  }

  function addHoliday() {
    setAddError(null);
    if (!name.trim() || !startDate || !endDate) {
      setAddError("Please fill in name, start date, and end date.");
      return;
    }
    startAddTransition(async () => {
      const res = await fetch("/api/admin/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, startDate, endDate }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error ?? "Failed to add.");
        return;
      }
      setHolidays((prev) =>
        [...prev, { id: crypto.randomUUID(), name, start_date: startDate, end_date: endDate }].sort((a, b) =>
          a.start_date.localeCompare(b.start_date)
        )
      );
      setName("");
      setStartDate("");
      setEndDate("");
    });
  }

  function removeHoliday(id: string) {
    startAddTransition(async () => {
      const res = await fetch("/api/admin/holidays", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error ?? "Failed to remove.");
        return;
      }
      setHolidays((prev) => prev.filter((h) => h.id !== id));
    });
  }

  return (
    <div className="min-w-0 space-y-4 rounded-2xl border bg-card p-5 shadow-card lg:p-6">
      <h2 className="text-base font-semibold">Off Days &amp; Holidays</h2>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 p-4">
        <div>
          <p className="text-sm font-semibold">Sunday off</p>
          <p className="mt-0.5 text-xs text-muted-foreground">All active users are notified when this changes.</p>
          {toggleError && <p className="mt-1 text-xs text-destructive">{toggleError}</p>}
        </div>
        <button
          type="button"
          disabled={togglePending}
          onClick={toggleSunday}
          className="rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-primary transition-colors hover:bg-accent/70 disabled:opacity-60"
        >
          {togglePending ? "Saving…" : sundayOff ? "Sunday: OFF (turn ON)" : "Sunday: WORKING (turn OFF)"}
        </button>
      </div>

      <div className="space-y-2.5">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Add holiday</p>
        <input
          className={fieldClass}
          placeholder="Holiday name (e.g. Independence Day)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2.5">
          <DateField value={startDate} onChange={setStartDate} />
          <span className="text-xs text-muted-foreground">to</span>
          <DateField value={endDate} onChange={setEndDate} />
        </div>
        <Button className="rounded-xl" disabled={addPending} onClick={addHoliday}>
          {addPending ? "Saving…" : "Add holiday"}
        </Button>
        {addError && <p className="text-xs text-destructive">{addError}</p>}
      </div>

      <div className="space-y-2">
        {holidays.length === 0 && (
          <p className="rounded-xl bg-muted/50 px-3 py-3 text-center text-xs text-muted-foreground">
            No holidays added yet
          </p>
        )}
        {holidays.map((h) => (
          <div key={h.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{h.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(h.start_date)} → {formatDate(h.end_date)}
              </p>
            </div>
            <button
              type="button"
              disabled={addPending}
              onClick={() => removeHoliday(h.id)}
              className="shrink-0 rounded-xl bg-destructive/10 px-3 py-2 text-[13px] font-medium text-destructive disabled:opacity-60"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
