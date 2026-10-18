import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { addDaysToIstDate, istDateString, istInstant } from "@/lib/notifications/time";

export type SnoozeMode = "1h" | "tomorrow";

/**
 * Pauses reminders for one lead. Snoozing is deliberately NOT an action:
 * it only sets reminder_snoozed_until, which the lead-action trigger does not
 * watch, so the lead stays "pending" and reminders resume afterwards.
 * Only the lead's owner (or an admin / founder) can snooze it.
 */
export async function snoozeLeadReminder(params: {
  leadId: string;
  mode: SnoozeMode;
  userId: string;
  role: string;
}): Promise<{ ok: boolean; until?: string; error?: string }> {
  const admin = createAdminClient();

  const { data: lead } = await admin
    .from("leads")
    .select("id, assigned_to")
    .eq("id", params.leadId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!lead) return { ok: false, error: "Lead not found" };
  const privileged = params.role === "admin" || params.role === "super_admin";
  if (lead.assigned_to !== params.userId && !privileged) {
    return { ok: false, error: "Not allowed" };
  }

  const now = new Date();
  const until =
    params.mode === "1h"
      ? new Date(now.getTime() + 60 * 60 * 1000)
      : istInstant(addDaysToIstDate(istDateString(now), 1), 9, 0);

  const { error } = await admin
    .from("leads")
    .update({ reminder_snoozed_until: until.toISOString() })
    .eq("id", params.leadId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, until: until.toISOString() };
}
