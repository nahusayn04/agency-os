export type NotificationPriority = "normal" | "urgent";

export type NotificationCategory = "crm" | "tasks" | "attendance" | "messages" | "other";

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  crm: "CRM",
  tasks: "Tasks",
  attendance: "Attendance & fines",
  messages: "Messages",
  other: "Other",
};

/** Types that are always urgent (stronger vibration, red tag, email fallback). */
export const URGENT_TYPES = new Set<string>([
  "callback_due",
  "callback_overdue",
  "meeting_due",
  "meeting_reminder",
  "meeting_overdue",
  "lead_overdue_digest",
  "lead_escalation",
  "strike",
  "fine",
  "fine_deadline_reminder",
  "emergency_checkout",
]);

/** Lead-linked reminders. These carry the Snooze buttons and stay pinned until action. */
export const LEAD_REMINDER_TYPES = new Set<string>([
  "callback_reminder",
  "callback_due",
  "callback_overdue",
  "meeting_reminder",
  "meeting_due",
  "meeting_overdue",
]);

export function defaultPriority(type?: string | null): NotificationPriority {
  return type && URGENT_TYPES.has(type) ? "urgent" : "normal";
}

export function categoryFor(type?: string | null): NotificationCategory {
  if (!type) return "other";
  if (
    type.startsWith("lead") ||
    type.startsWith("callback") ||
    type.startsWith("meeting") ||
    type.startsWith("cold_call") ||
    type === "daily_digest" ||
    type === "tomorrow_digest"
  ) {
    return "crm";
  }
  if (
    type.startsWith("task") ||
    type.startsWith("flash_task") ||
    type === "weekly_target" ||
    type === "report" ||
    type === "cannot_complete_usage" ||
    type === "cannot_complete_review"
  ) {
    return "tasks";
  }
  if (
    type.startsWith("strike") ||
    type.startsWith("fine") ||
    type.startsWith("attendance") ||
    type === "performance_override"
  ) {
    return "attendance";
  }
  if (
    type === "messages" ||
    type === "direct" ||
    type === "announcement" ||
    type.startsWith("leave_request") ||
    type === "task_clarification" ||
    type === "emergency_checkout"
  ) {
    return "messages";
  }
  return "other";
}
