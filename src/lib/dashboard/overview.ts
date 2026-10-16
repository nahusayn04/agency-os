import { getTodayDateString } from "@/lib/auth/attendance";
import { LEAD_STAGE_LABELS, type LeadStage } from "@/lib/types/crm";
import type { createClient } from "@/lib/supabase/server";

type Db = ReturnType<typeof createClient>;

export type OverviewLead = {
  id: string;
  name: string;
  sub: string;
  time?: string;
  tag?: "Overdue" | "Today";
};

export type OverviewTodo = {
  id: string;
  title: string;
  due: string;
  status: string;
  overdue: boolean;
};

export type OverviewChart = {
  days: { label: string; added: number; closed: number }[];
  stages: { label: string; count: number }[];
};

export type OverviewData = {
  tasksToday: number;
  meetingsCount: number;
  followupsCount: number;
  meetings: OverviewLead[];
  followups: OverviewLead[];
  todos: OverviewTodo[];
  todosCount: number;
  chart: OverviewChart;
};

export type Kpi = {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  tone?: "primary" | "green" | "red" | "amber";
  hint?: string;
  href?: string;
};

const IST = "Asia/Kolkata";
const DAY_MS = 86_400_000;

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: IST,
  });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: IST,
  });
}

const TASK_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "Active",
  paused: "Paused",
  revision_required: "Revision",
  waiting_review: "In review",
};

const FUNNEL: LeadStage[] = [
  "new_lead",
  "hot_lead",
  "call_pending",
  "interested",
  "meeting",
  "negotiation",
  "deal_won",
];

/**
 * Personal agenda (assigned to `userId`) + CRM chart data (scope follows the
 * caller's RLS: admins see the whole org, members only their own leads).
 */
export async function getOverviewData(supabase: Db, userId: string): Promise<OverviewData> {
  const today = getTodayDateString();
  const dayStart = new Date(`${today}T00:00:00+05:30`).toISOString();
  const dayEnd = new Date(`${today}T23:59:59.999+05:30`).toISOString();
  const weekAgo = new Date(Date.now() - 7 * DAY_MS).toISOString();
  const OPEN_TASK = '("completed","approved")';

  const [meet, follow, todos, tasksDue, added, closedAudit, stageRows] = await Promise.all([
    supabase
      .from("leads")
      .select("id, name, business_name, meeting_datetime", { count: "exact" })
      .is("deleted_at", null)
      .eq("assigned_to", userId)
      .eq("stage", "meeting")
      .gte("meeting_datetime", dayStart)
      .lte("meeting_datetime", dayEnd)
      .order("meeting_datetime", { ascending: true })
      .limit(5),
    supabase
      .from("leads")
      .select("id, name, business_name, next_followup, stage", { count: "exact" })
      .is("deleted_at", null)
      .eq("assigned_to", userId)
      .not("stage", "in", '("deal_won","deal_lost")')
      .lte("next_followup", dayEnd)
      .order("next_followup", { ascending: true })
      .limit(5),
    supabase
      .from("tasks")
      .select("id, title, status, deadline", { count: "exact" })
      .eq("assigned_to", userId)
      .not("status", "in", OPEN_TASK)
      .order("deadline", { ascending: true, nullsFirst: false })
      .limit(6),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", userId)
      .not("status", "in", OPEN_TASK)
      .lte("deadline", dayEnd),
    supabase
      .from("leads")
      .select("created_at")
      .is("deleted_at", null)
      .gte("created_at", weekAgo)
      .limit(5000),
    supabase
      .from("lead_audit")
      .select("changed_at")
      .eq("field_changed", "stage")
      .eq("new_value", "deal_won")
      .gte("changed_at", weekAgo)
      .limit(5000),
    supabase.from("leads").select("stage").is("deleted_at", null).limit(10000),
  ]);

  const meetings: OverviewLead[] = (meet.data ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    sub: l.business_name ?? "Meeting",
    time: l.meeting_datetime ? fmtTime(l.meeting_datetime) : undefined,
  }));

  const followups: OverviewLead[] = (follow.data ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    sub: [LEAD_STAGE_LABELS[l.stage as LeadStage] ?? l.stage, l.business_name]
      .filter(Boolean)
      .join(" · "),
    tag: l.next_followup && l.next_followup < dayStart ? "Overdue" : "Today",
  }));

  const nowIso = new Date().toISOString();
  const todoRows: OverviewTodo[] = (todos.data ?? []).map((t) => {
    const overdue = !!t.deadline && t.deadline < nowIso && t.status !== "waiting_review";
    let due = "No deadline";
    if (t.deadline) {
      const sameDay = getTodayDateString(new Date(t.deadline)) === today;
      due = sameDay ? `Due ${fmtTime(t.deadline)}` : overdue ? `Was due ${fmtDate(t.deadline)}` : `Due ${fmtDate(t.deadline)}`;
    }
    return {
      id: t.id,
      title: t.title,
      due,
      status: overdue ? "Overdue" : TASK_STATUS_LABELS[t.status] ?? t.status,
      overdue,
    };
  });

  // Last 7 IST calendar days, oldest first.
  const dayKeys = Array.from({ length: 7 }, (_, i) =>
    getTodayDateString(new Date(Date.now() - (6 - i) * DAY_MS))
  );
  const addedBy = new Map<string, number>();
  for (const r of added.data ?? []) {
    const k = getTodayDateString(new Date(r.created_at));
    addedBy.set(k, (addedBy.get(k) ?? 0) + 1);
  }
  const closedBy = new Map<string, number>();
  for (const r of closedAudit.data ?? []) {
    const k = getTodayDateString(new Date(r.changed_at));
    closedBy.set(k, (closedBy.get(k) ?? 0) + 1);
  }
  const days = dayKeys.map((k) => ({
    label: new Date(`${k}T12:00:00+05:30`).toLocaleDateString("en-US", { weekday: "short", timeZone: IST }),
    added: addedBy.get(k) ?? 0,
    closed: closedBy.get(k) ?? 0,
  }));

  const stageCount = new Map<string, number>();
  for (const r of stageRows.data ?? []) {
    stageCount.set(r.stage, (stageCount.get(r.stage) ?? 0) + 1);
  }
  const stages = FUNNEL.map((s) => ({ label: LEAD_STAGE_LABELS[s], count: stageCount.get(s) ?? 0 }));

  return {
    tasksToday: tasksDue.count ?? 0,
    meetingsCount: meet.count ?? meetings.length,
    followupsCount: follow.count ?? followups.length,
    meetings,
    followups,
    todos: todoRows,
    todosCount: todos.count ?? todoRows.length,
    chart: { days, stages },
  };
}

/** Lead KPI numbers (RLS-scoped: org for admins, own leads for members). */
export async function getLeadKpis(supabase: Db) {
  const [total, active, closed, won, lost] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true }).is("deleted_at", null),
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null)
      .not("stage", "in", '("deal_won","deal_lost")'),
    supabase.from("leads").select("*", { count: "exact", head: true }).is("deleted_at", null).eq("stage", "deal_won"),
    supabase.from("leads").select("deal_value").is("deleted_at", null).eq("stage", "deal_won"),
    supabase.from("leads").select("*", { count: "exact", head: true }).is("deleted_at", null).eq("stage", "deal_lost"),
  ]);
  return {
    totalLeads: total.count ?? 0,
    activeLeads: active.count ?? 0,
    dealsClosed: closed.count ?? 0,
    revenue: (won.data ?? []).reduce((sum, l) => sum + (l.deal_value ?? 0), 0),
    lostDeals: lost.count ?? 0,
  };
}

/** Org-wide mandatory cold-call tasks for today: how many are submitted. */
export async function getOrgColdCalls(supabase: Db, today: string) {
  const { data } = await supabase
    .from("tasks")
    .select("status")
    .eq("is_mandatory", true)
    .eq("mandatory_type", "cold_calls")
    .eq("mandatory_date", today);
  const rows = data ?? [];
  const open = ["pending", "in_progress", "paused", "revision_required"];
  return { total: rows.length, submitted: rows.filter((r) => !open.includes(r.status)).length };
}

/** The 8 KPI boxes, in the agreed order. */
export function buildKpis(i: {
  totalLeads: number;
  activeLeads: number;
  dealsClosed: number;
  lostDeals: number;
  revenue: number;
  coldCalls: { value: number; suffix: string; tone?: Kpi["tone"]; hint?: string; href?: string };
  pendingTasks: number;
  totalFines: number;
  pendingFines: number;
}): Kpi[] {
  return [
    { label: "Total Leads", value: i.totalLeads },
    { label: "Active Leads", value: i.activeLeads },
    { label: "Deals Closed", value: i.dealsClosed, tone: "green" },
    { label: "Lost Deals", value: i.lostDeals, tone: "red" },
    { label: "Revenue", value: Math.round(i.revenue), prefix: "₹", tone: "green" },
    { label: "Cold Calls Today", value: i.coldCalls.value, suffix: i.coldCalls.suffix, tone: i.coldCalls.tone ?? "amber", hint: i.coldCalls.hint, href: i.coldCalls.href },
    { label: "Pending Tasks", value: i.pendingTasks, tone: "amber" },
    { label: "Total Fines", value: i.totalFines, tone: "red", hint: i.pendingFines > 0 ? `${i.pendingFines} pending` : undefined },
  ];
}
