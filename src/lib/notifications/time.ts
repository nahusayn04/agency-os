// India Standard Time helpers. IST is a fixed UTC+5:30 (no daylight saving),
// so plain arithmetic is safe and avoids Intl quirks on the server.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export const QUIET_START_HOUR = 22; // 10 PM
export const QUIET_END_HOUR = 8; // 8 AM

export interface IstParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
}

export function istParts(date: Date = new Date()): IstParts {
  const d = new Date(date.getTime() + IST_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-10-18" in IST. */
export function istDateString(date: Date = new Date()): string {
  const p = istParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** The instant for a given IST wall-clock time. */
export function istInstant(dateStr: string, hour = 0, minute = 0): Date {
  return new Date(`${dateStr}T${pad(hour)}:${pad(minute)}:00+05:30`);
}

/** Whole IST calendar days from `from` to `to` (can be negative). */
export function istDayDiff(from: Date, to: Date): number {
  const a = istInstant(istDateString(from)).getTime();
  const b = istInstant(istDateString(to)).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

export function addDaysToIstDate(dateStr: string, days: number): string {
  const base = istInstant(dateStr, 12, 0);
  return istDateString(new Date(base.getTime() + days * 24 * 60 * 60 * 1000));
}

/** True between 10 PM and 8 AM IST — no push/email goes out in this window. */
export function isQuietHours(date: Date = new Date()): boolean {
  const h = istParts(date).hour;
  return h >= QUIET_START_HOUR || h < QUIET_END_HOUR;
}

/** "4:30 PM" in IST. */
export function istTimeLabel(date: Date): string {
  return date.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** "18 Oct, 4:30 PM" in IST. */
export function istDateTimeLabel(date: Date): string {
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
