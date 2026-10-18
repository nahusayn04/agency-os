"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/session";
import { snoozeLeadReminder, type SnoozeMode } from "@/lib/notifications/snooze";

export interface NotificationRow {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
  updated_at: string;
  type: string | null;
  reference_id: string | null;
  priority: "normal" | "urgent";
  item_count: number;
  needs_action: boolean;
}

const COLUMNS =
  "id, title, message, is_read, link, created_at, updated_at, type, reference_id, priority, item_count, needs_action";

/** Everything for the Notifications page: pinned "needs action" rows + recent history. */
export async function getNotificationsPageData(): Promise<{
  pending: NotificationRow[];
  recent: NotificationRow[];
}> {
  const profile = await requireUserProfile();
  const supabase = createClient();

  const [pending, recent] = await Promise.all([
    supabase
      .from("notifications")
      .select(COLUMNS)
      .eq("user_id", profile.id)
      .eq("needs_action", true)
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("notifications")
      .select(COLUMNS)
      .eq("user_id", profile.id)
      .eq("needs_action", false)
      .order("updated_at", { ascending: false })
      .limit(80),
  ]);

  if (pending.error) console.error("Failed to load pending notifications:", pending.error.message);
  if (recent.error) console.error("Failed to load notifications:", recent.error.message);

  return {
    pending: (pending.data ?? []) as NotificationRow[],
    recent: (recent.data ?? []) as NotificationRow[],
  };
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) {
    console.error("Failed to count unread notifications:", error.message);
    return 0;
  }
  return count ?? 0;
}

/** Removes read notifications that are not waiting for action. */
export async function clearReadNotificationsAction() {
  const profile = await requireUserProfile();
  const supabase = createClient();

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("user_id", profile.id)
    .eq("is_read", true)
    .eq("needs_action", false);

  if (error) return { error: error.message };
  return { success: true };
}

export async function snoozeLeadAction(leadId: string, mode: SnoozeMode) {
  const profile = await requireUserProfile();
  const result = await snoozeLeadReminder({
    leadId,
    mode,
    userId: profile.id,
    role: profile.role,
  });
  if (!result.ok) return { error: result.error ?? "Could not snooze" };
  return { success: true, until: result.until };
}
