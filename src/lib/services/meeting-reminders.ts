import "server-only";

import { runNotificationSweeps } from "@/lib/notifications/lead-reminders";

/**
 * Kept so an existing cron job pointing at /api/cron/meeting-reminders keeps
 * working. Meeting reminders now live in the unified lead reminder engine
 * (see src/lib/notifications/lead-reminders.ts), which also handles
 * callbacks, overdue summaries, escalation and the email fallback.
 */
export async function sweepMeetingReminders() {
  return runNotificationSweeps();
}
