import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { emailFallback, notifyUser } from "@/lib/notifications/notify";
import {
  addDaysToIstDate,
  isQuietHours,
  istDateString,
  istDayDiff,
  istInstant,
  istParts,
  istTimeLabel,
} from "@/lib/notifications/time";

// ============================================================
// Lead reminder engine. Called every ~5 minutes by the external cron
// (cron-job.org) through /api/cron/notifications.
//
// What counts as "due":   stage != meeting  -> next_followup
//                         stage  = meeting  -> meeting_datetime
// What counts as "action": stage change, new callback date, Spoke or a new
//   meeting time (tracked by the leads_track_action trigger, migration 028).
//   A lead is unresolved while last_action_at < its due time. Snooze only
//   pauses reminders, it is never an action.
//
// Pattern
//   before due : 60 min and 15 min before (one notification per lead that
//                is updated in place)
//   due day    : at the time, +15 min, +30 min, then every hour
//   later days : ONE overdue summary per user at 10:00, 14:00 and 18:00
//   daily      : 9 AM "today" summary, 6 PM "tomorrow" summary
//   escalation : managers (admins) after 1 day, founders after 2 days,
//                one summary per day
//   quiet hours: nothing goes out 10 PM - 8 AM IST, 8 AM summary instead
// ============================================================

const FINAL_STAGES = "(deal_won,deal_lost)";
const MAX_INDIVIDUAL_PER_USER = 5;
const OVERDUE_SLOT_HOURS = [10, 14, 18];

type LeadRow = {
  id: string;
  name: string;
  business_name: string | null;
  assigned_to: string | null;
  stage: string;
  next_followup: string | null;
  meeting_datetime: string | null;
  last_action_at: string;
  reminder_snoozed_until: string | null;
};

type Due = {
  lead: LeadRow;
  kind: "callback" | "meeting";
  due: Date;
  snoozed: boolean;
};

export type SweepStats = {
  skipped?: "quiet_hours";
  leadReminders: number;
  overdueSummaries: number;
  dailySummaries: number;
  escalations: number;
  quietSummaries: number;
  emailFallbacks: number;
};

const LEAD_COLUMNS =
  "id, name, business_name, assigned_to, stage, next_followup, meeting_datetime, last_action_at, reminder_snoozed_until";

function leadLabel(lead: LeadRow): string {
  return lead.business_name ? `${lead.name} · ${lead.business_name}` : lead.name;
}

async function loadUnresolvedDues(now: Date): Promise<Due[]> {
  const admin = createAdminClient();
  const horizon = istInstant(addDaysToIstDate(istDateString(now), 2)); // end of tomorrow IST

  const [callbacks, meetings] = await Promise.all([
    admin
      .from("leads")
      .select(LEAD_COLUMNS)
      .is("deleted_at", null)
      .not("stage", "in", FINAL_STAGES)
      .neq("stage", "meeting")
      .not("assigned_to", "is", null)
      .not("next_followup", "is", null)
      .lt("next_followup", horizon.toISOString())
      .limit(3000),
    admin
      .from("leads")
      .select(LEAD_COLUMNS)
      .is("deleted_at", null)
      .eq("stage", "meeting")
      .not("assigned_to", "is", null)
      .not("meeting_datetime", "is", null)
      .lt("meeting_datetime", horizon.toISOString())
      .limit(3000),
  ]);

  if (callbacks.error) console.error("lead-reminders: callbacks query failed:", callbacks.error.message);
  if (meetings.error) console.error("lead-reminders: meetings query failed:", meetings.error.message);

  const out: Due[] = [];
  const push = (rows: LeadRow[] | null, kind: Due["kind"], col: "next_followup" | "meeting_datetime") => {
    for (const lead of rows ?? []) {
      const raw = lead[col];
      if (!raw) continue;
      const due = new Date(raw);
      if (isNaN(due.getTime())) continue;
      // Already actioned after the due time -> nothing to remind about.
      if (new Date(lead.last_action_at).getTime() >= due.getTime()) continue;
      const snoozed =
        !!lead.reminder_snoozed_until && new Date(lead.reminder_snoozed_until).getTime() > now.getTime();
      out.push({ lead, kind, due, snoozed });
    }
  };
  push(callbacks.data as LeadRow[] | null, "callback", "next_followup");
  push(meetings.data as LeadRow[] | null, "meeting", "meeting_datetime");
  return out;
}

/** Same-day nag rounds: 0 = at due time, 1 = +15m, 2 = +30m, then hourly. */
function nagRound(minutesLate: number): number {
  if (minutesLate < 15) return 0;
  if (minutesLate < 30) return 1;
  if (minutesLate < 60) return 2;
  return 3 + Math.floor((minutesLate - 60) / 60);
}

function lateLabel(minutes: number): string {
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min late`;
  const h = Math.floor(minutes / 60);
  return `${h} hr${h > 1 ? "s" : ""} late`;
}

// ------------------------------------------------------------------
// 1. Per-lead reminders (before due + same-day nags)
// ------------------------------------------------------------------
async function sendLeadReminders(dues: Due[], now: Date): Promise<number> {
  let sent = 0;
  const perUser = new Map<string, number>();
  const overflow = new Map<string, number>();

  for (const d of dues) {
    if (d.snoozed) continue;
    const userId = d.lead.assigned_to!;
    const kindLabel = d.kind === "callback" ? "Callback" : "Meeting";
    const minutesLate = (now.getTime() - d.due.getTime()) / 60000;
    const dueKey = d.due.toISOString();

    let slot: string | null = null;
    let title = "";
    let message = "";
    let type = "";
    let urgent = true;

    if (minutesLate < 0) {
      // Upcoming
      const minsLeft = Math.round(-minutesLate);
      if (minsLeft <= 15) {
        slot = "m15";
        urgent = true;
      } else if (minsLeft <= 60) {
        slot = "h1";
        urgent = false;
      }
      if (!slot) continue;
      title = `${kindLabel} in ${minsLeft} min`;
      message = `${leadLabel(d.lead)} · ${istTimeLabel(d.due)}`;
      type = d.kind === "callback" ? "callback_reminder" : "meeting_reminder";
    } else if (istDateString(d.due) === istDateString(now)) {
      // Due earlier today: keep nagging until action.
      const round = nagRound(minutesLate);
      slot = `n${round}`;
      if (round === 0) {
        title = `${kindLabel} time now`;
        message = `${leadLabel(d.lead)} · ${istTimeLabel(d.due)}`;
        type = d.kind === "callback" ? "callback_due" : "meeting_due";
      } else {
        title = `${kindLabel} overdue (${lateLabel(minutesLate)})`;
        message = `${leadLabel(d.lead)} · was due ${istTimeLabel(d.due)}. Call now or set a new time.`;
        type = d.kind === "callback" ? "callback_overdue" : "meeting_overdue";
      }
    } else {
      // Earlier days are handled by the overdue summary below.
      continue;
    }

    const count = perUser.get(userId) ?? 0;
    if (count >= MAX_INDIVIDUAL_PER_USER) {
      overflow.set(userId, (overflow.get(userId) ?? 0) + 1);
      continue;
    }
    perUser.set(userId, count + 1);

    await notifyUser({
      userId,
      title,
      message,
      link: `/crm/${d.lead.id}`,
      type,
      referenceId: d.lead.id,
      priority: urgent ? "urgent" : "normal",
      needsAction: true,
      group: { key: `lead:${d.lead.id}:${dueKey}`, mode: "refresh", slot },
    });
    sent += 1;
  }

  // Too many at once for one person: fold the rest into a single line.
  const bucket = Math.floor(now.getTime() / (15 * 60 * 1000));
  for (const [userId, extra] of overflow) {
    await notifyUser({
      userId,
      title: `${extra} more ${extra === 1 ? "lead needs" : "leads need"} a call`,
      message: "Open Today's Calls to see the full list.",
      link: "/crm/today",
      type: "callback_overdue",
      priority: "urgent",
      group: { key: `lead-more:${userId}:${bucket}`, mode: "once" },
    });
  }

  return sent;
}

// ------------------------------------------------------------------
// 2. Overdue summary for leads missed on earlier days (10 / 2 / 6)
// ------------------------------------------------------------------
async function sendOverdueSummaries(dues: Due[], now: Date): Promise<number> {
  const hour = istParts(now).hour;
  const slotHour = [...OVERDUE_SLOT_HOURS].reverse().find((h) => hour >= h);
  if (!slotHour) return 0;

  const byUser = new Map<string, Due[]>();
  for (const d of dues) {
    if (d.snoozed) continue;
    if (istDayDiff(d.due, now) < 1) continue;
    const list = byUser.get(d.lead.assigned_to!) ?? [];
    list.push(d);
    byUser.set(d.lead.assigned_to!, list);
  }

  let sent = 0;
  const today = istDateString(now);
  for (const [userId, list] of byUser) {
    list.sort((a, b) => a.due.getTime() - b.due.getTime());
    const oldestDays = istDayDiff(list[0].due, now);
    const names = list.slice(0, 3).map((d) => d.lead.name);
    const more = list.length > 3 ? ` +${list.length - 3} more` : "";

    await notifyUser({
      userId,
      title: `${list.length} overdue ${list.length === 1 ? "lead" : "leads"}`,
      message: `${names.join(", ")}${more}. Oldest is ${oldestDays} day${oldestDays > 1 ? "s" : ""} overdue.`,
      link: "/crm/today",
      type: "lead_overdue_digest",
      priority: "urgent",
      group: { key: `overdue-digest:${today}`, mode: "refresh", slot: String(slotHour) },
    });
    sent += 1;
  }
  return sent;
}

// ------------------------------------------------------------------
// 3. Morning (today) and evening (tomorrow) summaries
// ------------------------------------------------------------------
async function sendDailySummaries(dues: Due[], now: Date): Promise<number> {
  const hour = istParts(now).hour;
  const today = istDateString(now);
  const tomorrow = addDaysToIstDate(today, 1);
  let sent = 0;

  const isMorning = hour >= 9 && hour < 12;
  const isEvening = hour >= 18 && hour < 22;
  if (!isMorning && !isEvening) return 0;

  type Counts = { callbacks: number; meetings: number; overdue: number };
  const byUser = new Map<string, Counts>();
  const target = isMorning ? today : tomorrow;

  for (const d of dues) {
    if (d.snoozed) continue;
    const userId = d.lead.assigned_to!;
    const c = byUser.get(userId) ?? { callbacks: 0, meetings: 0, overdue: 0 };
    const dueDay = istDateString(d.due);
    if (dueDay === target) {
      if (d.kind === "callback") c.callbacks += 1;
      else c.meetings += 1;
    } else if (isMorning && istDayDiff(d.due, now) >= 1) {
      c.overdue += 1;
    }
    byUser.set(userId, c);
  }

  for (const [userId, c] of byUser) {
    if (c.callbacks + c.meetings + c.overdue === 0) continue;

    const parts: string[] = [];
    if (c.callbacks) parts.push(`${c.callbacks} callback${c.callbacks > 1 ? "s" : ""}`);
    if (c.meetings) parts.push(`${c.meetings} meeting${c.meetings > 1 ? "s" : ""}`);
    let message = parts.length ? `${parts.join(", ")} ${isMorning ? "today" : "tomorrow"}.` : "";
    if (c.overdue) message += `${message ? " " : ""}${c.overdue} overdue from earlier days.`;

    await notifyUser({
      userId,
      title: isMorning ? "Today's follow-ups" : "Tomorrow's follow-ups",
      message,
      link: "/crm/today",
      type: isMorning ? "daily_digest" : "tomorrow_digest",
      group: { key: `${isMorning ? "digest-morning" : "digest-evening"}:${today}`, mode: "once" },
    });
    sent += 1;
  }
  return sent;
}

// ------------------------------------------------------------------
// 4. Escalation: managers (admins) after 1 day, founders after 2 days
// ------------------------------------------------------------------
async function sendEscalations(dues: Due[], now: Date): Promise<number> {
  const hour = istParts(now).hour;
  if (hour < 10 || hour >= 22) return 0;

  const admin = createAdminClient();
  const today = istDateString(now);

  const missed = dues.filter((d) => !d.snoozed && istDayDiff(d.due, now) >= 1);
  if (missed.length === 0) return 0;

  const { data: staff } = await admin
    .from("users")
    .select("id, name, role")
    .in("role", ["admin", "super_admin"])
    .eq("is_active", true);
  if (!staff?.length) return 0;

  const ownerIds = Array.from(new Set(missed.map((d) => d.lead.assigned_to!)));
  const { data: owners } = await admin.from("users").select("id, name").in("id", ownerIds);
  const ownerName = new Map((owners ?? []).map((o) => [o.id, o.name as string]));

  let sent = 0;
  for (const person of staff) {
    const minDays = person.role === "super_admin" ? 2 : 1;
    const list = missed
      .filter((d) => istDayDiff(d.due, now) >= minDays)
      .sort((a, b) => a.due.getTime() - b.due.getTime());
    if (list.length === 0) continue;

    const employees = new Set(list.map((d) => d.lead.assigned_to));
    const top = list
      .slice(0, 2)
      .map((d) => `${d.lead.name} (${ownerName.get(d.lead.assigned_to!) ?? "team"}, ${istDayDiff(d.due, now)}d)`)
      .join("; ");

    await notifyUser({
      userId: person.id,
      title: "Team follow-ups missed",
      message: `${list.length} lead${list.length > 1 ? "s" : ""} overdue across ${employees.size} employee${
        employees.size > 1 ? "s" : ""
      }. ${top}${list.length > 2 ? ` +${list.length - 2} more` : ""}.`,
      link: "/crm",
      type: "lead_escalation",
      priority: "urgent",
      group: { key: `escalation:${person.role}:${today}`, mode: "once" },
    });
    sent += 1;
  }
  return sent;
}

// ------------------------------------------------------------------
// 5. 8 AM summary of what arrived during quiet hours
// ------------------------------------------------------------------
async function sendQuietSummaries(now: Date): Promise<number> {
  if (istParts(now).hour !== 8) return 0;

  const admin = createAdminClient();
  const today = istDateString(now);
  const windowStart = istInstant(addDaysToIstDate(today, -1), 22, 0);
  const windowEnd = istInstant(today, 8, 0);

  const { data: rows } = await admin
    .from("notifications")
    .select("user_id, title, type")
    .gte("updated_at", windowStart.toISOString())
    .lt("updated_at", windowEnd.toISOString())
    .is("push_sent_at", null)
    .eq("is_read", false)
    .limit(5000);

  const byUser = new Map<string, { title: string }[]>();
  for (const r of rows ?? []) {
    if (r.type === "quiet_summary") continue;
    const list = byUser.get(r.user_id) ?? [];
    list.push({ title: r.title });
    byUser.set(r.user_id, list);
  }

  let sent = 0;
  for (const [userId, list] of byUser) {
    const first = list
      .slice(0, 2)
      .map((i) => i.title)
      .join(", ");
    await notifyUser({
      userId,
      title: `${list.length} notification${list.length > 1 ? "s" : ""} overnight`,
      message: `${first}${list.length > 2 ? ` +${list.length - 2} more` : ""}`,
      link: "/notifications",
      type: "quiet_summary",
      group: { key: `quiet-summary:${today}`, mode: "once" },
    });
    sent += 1;
  }

  // Housekeeping once a day: drop old, already-read notifications.
  const cutoff = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
  await admin.from("notifications").delete().eq("is_read", true).eq("needs_action", false).lt("created_at", cutoff);

  return sent;
}

// ------------------------------------------------------------------
// 6. Email fallback for urgent notifications the device never confirmed
// ------------------------------------------------------------------
async function sendPushHealthEmails(now: Date): Promise<number> {
  const admin = createAdminClient();
  const olderThan = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const newerThan = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();

  const { data: rows } = await admin
    .from("notifications")
    .select("id, user_id, title, message, link")
    .eq("priority", "urgent")
    .eq("email_fallback_sent", false)
    .eq("is_read", false)
    .is("push_acked_at", null)
    .not("push_sent_at", "is", null)
    .lt("push_sent_at", olderThan)
    .gt("push_sent_at", newerThan)
    .limit(500);

  const byUser = new Map<string, { id: string; title: string; message: string; link: string | null }[]>();
  for (const r of rows ?? []) {
    const list = byUser.get(r.user_id) ?? [];
    list.push({ id: r.id, title: r.title, message: r.message, link: r.link });
    byUser.set(r.user_id, list);
  }

  let sent = 0;
  for (const [userId, items] of byUser) {
    const ok = await emailFallback(userId, items.slice(0, 8));
    if (ok) sent += 1;
  }
  return sent;
}

// ------------------------------------------------------------------
export async function runNotificationSweeps(now: Date = new Date()): Promise<SweepStats> {
  const stats: SweepStats = {
    leadReminders: 0,
    overdueSummaries: 0,
    dailySummaries: 0,
    escalations: 0,
    quietSummaries: 0,
    emailFallbacks: 0,
  };

  if (isQuietHours(now)) {
    stats.skipped = "quiet_hours";
    return stats;
  }

  // 8 AM: summary of the night first, so it lands before everything else.
  stats.quietSummaries = await sendQuietSummaries(now);

  const dues = await loadUnresolvedDues(now);

  stats.leadReminders = await sendLeadReminders(dues, now);
  stats.overdueSummaries = await sendOverdueSummaries(dues, now);
  stats.dailySummaries = await sendDailySummaries(dues, now);
  stats.escalations = await sendEscalations(dues, now);
  stats.emailFallbacks = await sendPushHealthEmails(now);

  return stats;
}
