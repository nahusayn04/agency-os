"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const pad = (n: number) => String(n).padStart(2, "0");
const toStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const QUICK_TIMES = [
  { label: "9 AM", h: 9, m: 0 },
  { label: "12 PM", h: 12, m: 0 },
  { label: "3 PM", h: 15, m: 0 },
  { label: "6 PM", h: 18, m: 0 },
  { label: "9 PM", h: 21, m: 0 },
];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function chip(active: boolean, disabled = false) {
  return (
    "rounded-full border px-3.5 py-2 text-sm font-medium transition-colors " +
    (disabled
      ? "cursor-not-allowed border-border bg-muted/40 text-muted-foreground/50"
      : active
        ? "border-primary bg-primary text-primary-foreground shadow-card"
        : "border-border bg-card text-muted-foreground hover:text-foreground")
  );
}

function describe(dateStr: string, h: number, m: number) {
  const d = new Date(`${dateStr}T${pad(h)}:${pad(m)}:00`);
  const today = startOfToday();
  const ds = toStr(d);
  const day =
    ds === toStr(today)
      ? "Aaj"
      : ds === toStr(addDays(today, 1))
        ? "Kal"
        : d.toLocaleDateString("en-IN", { weekday: "short" });
  const date = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${day}, ${date} · ${time}`;
}

/**
 * Compact deadline picker: quick date chips (+ small calendar), quick time chips
 * (+ custom hour/minute). Emits "YYYY-MM-DDTHH:mm" (local time) once BOTH a date
 * and a time are chosen, otherwise "".
 */
export function DeadlinePicker({ onChange }: { onChange: (value: string) => void }) {
  const today = useMemo(startOfToday, []);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<{ h: number; m: number } | null>(null);
  const [showCal, setShowCal] = useState(false);
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [month, setMonth] = useState({ y: today.getFullYear(), m: today.getMonth() });

  const quickDates = [
    { label: "Aaj", value: toStr(today) },
    { label: "Kal", value: toStr(addDays(today, 1)) },
    { label: "Parso", value: toStr(addDays(today, 2)) },
    { label: "Next week", value: toStr(addDays(today, 7)) },
  ];
  const isQuickDate = date !== null && quickDates.some((q) => q.value === date);

  const isPast = (h: number, m: number) => {
    if (date !== toStr(new Date())) return false;
    const now = new Date();
    return h * 60 + m <= now.getHours() * 60 + now.getMinutes();
  };

  // Picking "Aaj" after a time that has already passed clears that time.
  useEffect(() => {
    if (time && isPast(time.h, time.m)) setTime(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  useEffect(() => {
    onChange(date && time ? `${date}T${pad(time.h)}:${pad(time.m)}` : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, time]);

  const first = new Date(month.y, month.m, 1);
  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: first.getDay() }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const canGoBack = month.y > today.getFullYear() || month.m > today.getMonth();

  const hour12 = time ? (time.h % 12 === 0 ? 12 : time.h % 12) : 10;
  const isPm = time ? time.h >= 12 : false;
  const minute = time ? time.m : 0;
  const setCustom = (h12: number, m: number, pm: boolean) => setTime({ h: (h12 % 12) + (pm ? 12 : 0), m });

  const select =
    "h-10 min-w-0 flex-1 rounded-xl border border-input bg-card px-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Date</p>
        <div className="flex flex-wrap gap-2">
          {quickDates.map((q) => (
            <button key={q.label} type="button" onClick={() => setDate(q.value)} className={chip(date === q.value)}>
              {q.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowCal((v) => !v)}
            className={chip(date !== null && !isQuickDate) + " inline-flex items-center gap-1.5"}
          >
            <CalendarDays size={15} />
            {date !== null && !isQuickDate
              ? new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
              : "Calendar"}
          </button>
        </div>

        {showCal && (
          <div className="rounded-xl border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                disabled={!canGoBack}
                onClick={() => setMonth((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))}
                aria-label="Previous month"
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30"
              >
                <ChevronLeft size={18} />
              </button>
              <p className="text-sm font-semibold">
                {MONTHS[month.m]} {month.y}
              </p>
              <button
                type="button"
                onClick={() => setMonth((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))}
                aria-label="Next month"
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map((w) => (
                <span key={w} className="py-1 text-[11px] font-medium text-muted-foreground">
                  {w}
                </span>
              ))}
              {cells.map((d, i) => {
                if (d === null) return <span key={`e${i}`} />;
                const value = `${month.y}-${pad(month.m + 1)}-${pad(d)}`;
                const past = new Date(`${value}T00:00:00`) < today;
                const selected = value === date;
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={past}
                    onClick={() => {
                      setDate(value);
                      setShowCal(false);
                    }}
                    className={
                      "h-9 rounded-lg text-sm transition-colors " +
                      (past
                        ? "text-muted-foreground/40"
                        : selected
                          ? "bg-primary font-semibold text-primary-foreground"
                          : "hover:bg-accent")
                    }
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Time</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_TIMES.map((q) => {
            const disabled = date === null || isPast(q.h, q.m);
            const active = !showCustomTime && time?.h === q.h && time?.m === q.m;
            return (
              <button
                key={q.label}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setShowCustomTime(false);
                  setTime({ h: q.h, m: q.m });
                }}
                className={chip(active, disabled)}
              >
                {q.label}
              </button>
            );
          })}
          <button
            type="button"
            disabled={date === null}
            onClick={() => {
              setShowCustomTime(true);
              if (!time) setCustom(10, 0, false);
            }}
            className={chip(showCustomTime, date === null)}
          >
            Custom
          </button>
        </div>
        {date === null && <p className="text-xs text-muted-foreground">Pehle date chuno.</p>}

        {showCustomTime && date !== null && (
          <div className="flex items-center gap-2">
            <select
              aria-label="Hour"
              value={hour12}
              onChange={(e) => setCustom(Number(e.target.value), minute, isPm)}
              className={select}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <span className="text-muted-foreground">:</span>
            <select
              aria-label="Minute"
              value={minute}
              onChange={(e) => setCustom(hour12, Number(e.target.value), isPm)}
              className={select}
            >
              {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                <option key={m} value={m}>
                  {pad(m)}
                </option>
              ))}
            </select>
            <select
              aria-label="AM or PM"
              value={isPm ? "pm" : "am"}
              onChange={(e) => setCustom(hour12, minute, e.target.value === "pm")}
              className={select}
            >
              <option value="am">AM</option>
              <option value="pm">PM</option>
            </select>
          </div>
        )}
        {showCustomTime && time && isPast(time.h, time.m) && (
          <p className="text-xs text-destructive">Ye time nikal chuka hai, aage ka time chuno.</p>
        )}
      </div>

      <div
        className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${
          date && time ? "bg-accent text-primary" : "bg-muted/50 text-muted-foreground"
        }`}
      >
        {date && time ? `Deadline: ${describe(date, time.h, time.m)}` : "Deadline abhi chuni nahi"}
      </div>
    </div>
  );
}
