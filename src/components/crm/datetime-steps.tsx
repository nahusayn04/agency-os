"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft } from "lucide-react";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                             */
/* -------------------------------------------------------------------------- */

export interface TimeState {
  h: number; // 1-12
  m: number; // 0-55, multiple of 5
  pm: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dateToTimeState(d: Date): TimeState {
  const h24 = d.getHours();
  return {
    h: h24 % 12 === 0 ? 12 : h24 % 12,
    m: Math.min(55, Math.round(d.getMinutes() / 5) * 5),
    pm: h24 >= 12,
  };
}

export function buildDate(dateStr: string, t: TimeState): Date {
  const h24 = (t.h % 12) + (t.pm ? 12 : 0);
  return new Date(`${dateStr}T${pad(h24)}:${pad(t.m)}:00`);
}

/** Sensible starting time: next 5 minutes (+10) if the date is today, else 10:00 AM. */
export function defaultTimeFor(dateStr: string): TimeState {
  if (dateStr === dateToStr(new Date())) {
    const d = new Date(Date.now() + 10 * 60 * 1000);
    d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
    return dateToTimeState(d);
  }
  return { h: 10, m: 0, pm: false };
}

/** "Kal, 18 Oct · 4:30 PM" */
export function describeWhen(d: Date): string {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const ds = dateToStr(d);
  const day =
    ds === dateToStr(today)
      ? "Aaj"
      : ds === dateToStr(tomorrow)
        ? "Kal"
        : d.toLocaleDateString("en-IN", { weekday: "short" });
  const date = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${day}, ${date} · ${time}`;
}

/* -------------------------------------------------------------------------- */
/* Step header (title + back + "1/2")                                         */
/* -------------------------------------------------------------------------- */

export function StepHeader({
  title,
  sub,
  onBack,
}: {
  title: string;
  sub?: string;
  onBack?: () => void;
}) {
  return (
    <DialogHeader>
      <div className="flex items-center gap-1 pr-8">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        <div className="min-w-0">
          <DialogTitle>{title}</DialogTitle>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </div>
    </DialogHeader>
  );
}

/* -------------------------------------------------------------------------- */
/* Date: one slidable strip of days                                           */
/* -------------------------------------------------------------------------- */

export function DateStrip({
  value,
  onPick,
}: {
  value: string;
  onPick: (dateStr: string) => void;
}) {
  const todayStr = dateToStr(new Date());
  const selRef = useRef<HTMLButtonElement | null>(null);

  const days: Date[] = [];
  for (let i = 0; i < 90; i++) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  const inRange = days.some((d) => dateToStr(d) === value);
  if (value && !inRange) days.unshift(new Date(`${value}T12:00:00`));

  useEffect(() => {
    selRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, []);

  const tomorrowStr = dateToStr(days.find((d) => dateToStr(d) > todayStr) ?? days[0]);

  return (
    <div className="space-y-2">
      <div className="scrollbar-hide -mx-4 flex snap-x gap-2 overflow-x-auto px-4 py-1">
        {days.map((d) => {
          const ds = dateToStr(d);
          const selected = ds === value;
          const top =
            ds === todayStr
              ? "Aaj"
              : ds === tomorrowStr
                ? "Kal"
                : d.toLocaleDateString("en-IN", { weekday: "short" });
          return (
            <button
              key={ds}
              ref={selected ? selRef : undefined}
              type="button"
              onClick={() => onPick(ds)}
              className={
                "flex h-[72px] w-[58px] shrink-0 snap-start flex-col items-center justify-center rounded-2xl border text-center transition-colors " +
                (selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-card text-foreground")
              }
            >
              <span className="text-[11px] font-medium opacity-80">{top}</span>
              <span className="text-xl font-bold leading-tight">{d.getDate()}</span>
              <span className="text-[10px] opacity-70">
                {d.toLocaleDateString("en-IN", { month: "short" })}
              </span>
            </button>
          );
        })}
      </div>

      {/* Far-away date: native calendar, only when really needed */}
      <label className="relative flex h-9 w-fit cursor-pointer items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-primary">
        <CalendarDays size={14} /> Calendar
        <input
          type="date"
          min={todayStr}
          value={value}
          onChange={(e) => e.target.value && onPick(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Time: three spinning wheels (hour / minute / AM-PM)                        */
/* -------------------------------------------------------------------------- */

const ITEM_H = 40;
const VISIBLE = 5;
const PAD_H = ITEM_H * ((VISIBLE - 1) / 2);

function Wheel({
  items,
  index,
  onIndex,
  className,
}: {
  items: string[];
  index: number;
  onIndex: (i: number) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = index * ITEM_H;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleScroll() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!ref.current) return;
      const i = Math.max(
        0,
        Math.min(items.length - 1, Math.round(ref.current.scrollTop / ITEM_H))
      );
      if (i !== index) onIndex(i);
    }, 90);
  }

  return (
    <div
      ref={ref}
      onScroll={handleScroll}
      className={
        "scrollbar-hide relative snap-y snap-mandatory overflow-y-auto overscroll-contain " +
        (className ?? "")
      }
      style={{ height: ITEM_H * VISIBLE }}
    >
      <div style={{ height: PAD_H }} />
      {items.map((label, i) => (
        <button
          key={label}
          type="button"
          onClick={() =>
            ref.current?.scrollTo({ top: i * ITEM_H, behavior: "smooth" })
          }
          className={
            "flex w-full snap-center items-center justify-center text-lg transition-colors " +
            (i === index ? "font-bold text-foreground" : "text-muted-foreground/60")
          }
          style={{ height: ITEM_H }}
        >
          {label}
        </button>
      ))}
      <div style={{ height: PAD_H }} />
    </div>
  );
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5));
const AMPM = ["AM", "PM"];

export function TimeWheel({
  value,
  onChange,
}: {
  value: TimeState;
  onChange: (t: TimeState) => void;
}) {
  return (
    <div className="relative mx-auto flex w-full max-w-[260px] items-center">
      <div
        className="pointer-events-none absolute inset-x-0 rounded-xl bg-accent"
        style={{ top: PAD_H, height: ITEM_H }}
      />
      <Wheel
        className="flex-1"
        items={HOURS}
        index={value.h - 1}
        onIndex={(i) => onChange({ ...value, h: i + 1 })}
      />
      <span className="relative z-10 text-lg font-bold">:</span>
      <Wheel
        className="flex-1"
        items={MINUTES}
        index={value.m / 5}
        onIndex={(i) => onChange({ ...value, m: i * 5 })}
      />
      <Wheel
        className="flex-1"
        items={AMPM}
        index={value.pm ? 1 : 0}
        onIndex={(i) => onChange({ ...value, pm: i === 1 })}
      />
    </div>
  );
}

/** Small hook-less helper so dialogs can keep date+time state together. */
export function useDateTimeState(initial: Date | null) {
  const [dateStr, setDateStr] = useState(initial ? dateToStr(initial) : "");
  const [time, setTime] = useState<TimeState>(
    initial ? dateToTimeState(initial) : { h: 10, m: 0, pm: false }
  );
  return { dateStr, setDateStr, time, setTime };
}
