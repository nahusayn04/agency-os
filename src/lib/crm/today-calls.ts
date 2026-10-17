import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getTodayDateString } from "@/lib/auth/attendance";

// "Today's Calls" = only the calls that matter on a given day:
//   - Overdue callbacks (only when looking at today)
//   - Callbacks scheduled on that day
//   - Meetings on that day (confirmation calls)
// Deal Won / Deal Lost leads are never included. Day boundaries are IST.

export interface TodayCallLead {
  id: string;
  name: string;
  business_name: string | null;
  phone: string | null;
  stage: string;
  next_followup: string | null;
  meeting_datetime: string | null;
  notes: string | null;
  assigned_to: string;
  assignee_name: string | null;
}

export interface TodayCallsData {
  date: string; // YYYY-MM-DD (IST)
  isToday: boolean;
  overdue: TodayCallLead[];
  callbacks: TodayCallLead[];
  meetings: TodayCallLead[];
}

const FINAL_STAGES = "(deal_won,deal_lost)";
const LEAD_COLUMNS =
  "id, name, business_name, phone, stage, next_followup, meeting_datetime, notes, assigned_to";

export function istDayRange(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00+05:30`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function isValidDate(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
}

export async function getTodayCallsData(params: {
  userId: string;
  role: string | null | undefined;
  date?: string;
  everyone?: boolean;
}): Promise<TodayCallsData> {
  const supabase = createClient();
  const today = getTodayDateString();
  const date = isValidDate(params.date) ? params.date : today;
  const isToday = date === today;
  const { start, end } = istDayRange(date);
  const todayStart = istDayRange(today).start;

  const onlyMine = params.role === "member" || !params.everyone;

  function base() {
    let q = supabase
      .from("leads")
      .select(LEAD_COLUMNS)
      .is("deleted_at", null)
      .not("stage", "in", FINAL_STAGES);
    if (onlyMine) q = q.eq("assigned_to", params.userId);
    return q;
  }

  const [overdueRes, callbackRes, meetingRes] = await Promise.all([
    isToday
      ? base()
          .neq("stage", "meeting")
          .lt("next_followup", todayStart.toISOString())
          .order("next_followup", { ascending: true })
          .limit(300)
      : Promise.resolve({ data: [] as never[], error: null }),
    base()
      .neq("stage", "meeting")
      .gte("next_followup", start.toISOString())
      .lt("next_followup", end.toISOString())
      .order("next_followup", { ascending: true })
      .limit(300),
    base()
      .eq("stage", "meeting")
      .gte("meeting_datetime", start.toISOString())
      .lt("meeting_datetime", end.toISOString())
      .order("meeting_datetime", { ascending: true })
      .limit(300),
  ]);

  const rows = [
    ...(overdueRes.data ?? []),
    ...(callbackRes.data ?? []),
    ...(meetingRes.data ?? []),
  ] as Omit<TodayCallLead, "assignee_name">[];

  const ids = Array.from(new Set(rows.map((r) => r.assigned_to)));
  const names = new Map<string, string>();
  if (ids.length && !onlyMine) {
    const { data: users } = await supabase.from("users").select("id, name").in("id", ids);
    (users ?? []).forEach((u) => names.set(u.id, u.name));
  }

  const withName = (list: unknown): TodayCallLead[] =>
    ((list ?? []) as Omit<TodayCallLead, "assignee_name">[]).map((l) => ({
      ...l,
      assignee_name: names.get(l.assigned_to) ?? null,
    }));

  return {
    date,
    isToday,
    overdue: withName(overdueRes.data),
    callbacks: withName(callbackRes.data),
    meetings: withName(meetingRes.data),
  };
}

/** Number shown on the sidebar badge / dashboard button: the signed-in user's own calls for today. */
export async function getTodayCallsCount(userId: string): Promise<number> {
  try {
    const supabase = createClient();
    const today = getTodayDateString();
    const { start, end } = istDayRange(today);

    function base() {
      return supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .not("stage", "in", FINAL_STAGES)
        .eq("assigned_to", userId);
    }

    const [overdue, callbacks, meetings] = await Promise.all([
      base().neq("stage", "meeting").lt("next_followup", start.toISOString()),
      base()
        .neq("stage", "meeting")
        .gte("next_followup", start.toISOString())
        .lt("next_followup", end.toISOString()),
      base()
        .eq("stage", "meeting")
        .gte("meeting_datetime", start.toISOString())
        .lt("meeting_datetime", end.toISOString()),
    ]);

    return (overdue.count ?? 0) + (callbacks.count ?? 0) + (meetings.count ?? 0);
  } catch {
    return 0;
  }
}
