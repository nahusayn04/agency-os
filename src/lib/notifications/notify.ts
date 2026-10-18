import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser, type PushAction } from "@/lib/notifications/push";
import { sendNotificationFallbackEmail } from "@/lib/services/email-service";
import { isQuietHours } from "@/lib/notifications/time";
import {
  LEAD_REMINDER_TYPES,
  defaultPriority,
  type NotificationPriority,
} from "@/lib/notifications/types";

/**
 * How several similar notifications are folded into one:
 *  - "count":   one row, the count keeps going up ("5 leads assigned" -> "12")
 *  - "append":  one row, each event adds a line (capped), count in the title
 *  - "once":    create it once for this key, ignore repeats
 *  - "refresh": one row per key that is re-sent when `slot` changes (nag reminders)
 */
export type NotifyGroup = {
  key: string;
  mode?: "count" | "append" | "once" | "refresh";
  /** count/append only: how long a group keeps absorbing new events. Default 30. */
  windowMin?: number;
  /** refresh only: identifies this reminder round; same slot = skipped. */
  slot?: string;
  /** Title once the group holds more than one event. */
  title?: (count: number) => string;
  /** count mode: message once the group holds more than one event. */
  message?: (count: number) => string;
  /** append mode: max number of lines kept in the message. Default 4. */
  cap?: number;
};

export type NotifyInput = {
  userId: string;
  title: string;
  message: string;
  link?: string;
  type?: string;
  referenceId?: string;
  /** Defaults from the type (strikes, fines, callbacks... are urgent). */
  priority?: NotificationPriority;
  /** Keeps it pinned in "Needs action" until the lead is actioned. */
  needsAction?: boolean;
  /** Create the in-app row but do not push (used for silent list entries). */
  skipPush?: boolean;
  group?: NotifyGroup;
};

const SNOOZE_ACTIONS: PushAction[] = [
  { action: "snooze1h", title: "Snooze 1 hr" },
  { action: "snoozeTomorrow", title: "Tomorrow" },
];

/**
 * Single entry point for creating a notification: writes the row (so it
 * shows up in the bell / notifications page / realtime feed) AND fires the
 * outside-the-app push notification, together, every time. Adding a new
 * notification anywhere in the app should mean one call to this function —
 * never a bare `.from("notifications").insert(...)`.
 *
 * Uses the admin (service role) client because notifications are almost
 * always written for a DIFFERENT user than the one performing the action.
 *
 * Quiet hours (10 PM – 8 AM IST): the row is still written, but no push and
 * no email go out. The 8 AM sweep sends one summary of what was missed.
 */
export async function notifyUser(input: NotifyInput): Promise<void> {
  const admin = createAdminClient();
  const priority = input.priority ?? defaultPriority(input.type);
  const needsAction = input.needsAction ?? false;

  let id: string;
  let title = input.title;
  let message = input.message;
  let isNew = true;
  let silentUpdate = false;
  let tag: string | undefined;

  if (input.group) {
    const g = input.group;
    const mode = g.mode ?? "count";
    const merging = mode === "count" || mode === "append";
    const windowMs = (g.windowMin ?? 30) * 60 * 1000;
    const groupKey = merging ? `${g.key}:${Math.floor(Date.now() / windowMs)}` : g.key;

    const { data, error } = await admin.rpc("notify_upsert", {
      p_user: input.userId,
      p_title: input.title,
      p_message: input.message,
      p_link: input.link ?? "/",
      p_type: input.type ?? null,
      p_ref: input.referenceId ?? null,
      p_priority: priority,
      p_group_key: groupKey,
      p_mode: mode,
      p_slot: g.slot ?? null,
      p_needs_action: needsAction,
      p_cap: g.cap ?? 4,
    });

    if (error) {
      console.error("Failed to create grouped notification:", error.message);
      return;
    }

    const row = (Array.isArray(data) ? data[0] : data) as
      | { id: string; item_count: number; inserted: boolean }
      | undefined;
    // No row back = duplicate for a "once" key, or the same "refresh" slot.
    if (!row) return;

    id = row.id;
    isNew = row.inserted;
    tag = groupKey;

    if (merging && !isNew) {
      silentUpdate = true;
      const patch: { title: string; message?: string } = {
        title: g.title ? g.title(row.item_count) : `${input.title} (${row.item_count})`,
      };
      if (mode === "count" && g.message) patch.message = g.message(row.item_count);
      await admin.from("notifications").update(patch).eq("id", id);

      // Read back the merged text so the device shows the up-to-date version.
      const { data: merged } = await admin
        .from("notifications")
        .select("title, message")
        .eq("id", id)
        .single();
      if (merged) {
        title = merged.title;
        message = merged.message;
      }
    }
  } else {
    const { data, error } = await admin
      .from("notifications")
      .insert({
        user_id: input.userId,
        title: input.title,
        message: input.message,
        link: input.link ?? "/",
        type: input.type ?? null,
        reference_id: input.referenceId ?? null,
        priority,
        needs_action: needsAction,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("Failed to create notification:", error?.message);
      return;
    }
    id = data.id;
    tag = id;
  }

  if (input.skipPush || isQuietHours()) return;

  const isLeadReminder = !!input.type && LEAD_REMINDER_TYPES.has(input.type);

  const result = await sendPushToUser(input.userId, {
    id,
    title,
    message,
    link: input.link,
    priority,
    tag,
    silent: silentUpdate,
    actions: isLeadReminder ? SNOOZE_ACTIONS : undefined,
    leadId: isLeadReminder ? input.referenceId : undefined,
  });

  if (!silentUpdate && result.accepted > 0) {
    await admin.from("notifications").update({ push_sent_at: new Date().toISOString() }).eq("id", id);
  }

  // Urgent and no device took it (no subscription / permission off / push
  // service refused): email right away instead of waiting for the health check.
  if (priority === "urgent" && !silentUpdate && result.accepted === 0) {
    await emailFallback(input.userId, [{ id, title, message, link: input.link ?? "/" }]);
  }
}

/** Emails the user the given notifications and marks them as emailed. */
export async function emailFallback(
  userId: string,
  items: { id: string; title: string; message: string; link: string | null }[]
): Promise<boolean> {
  if (items.length === 0) return false;
  const admin = createAdminClient();

  const { data: user } = await admin.from("users").select("email, name").eq("id", userId).single();
  if (!user?.email) return false;

  const sent = await sendNotificationFallbackEmail({
    to: user.email,
    name: user.name,
    items: items.map((i) => ({ title: i.title, message: i.message, link: i.link })),
  });

  if (sent) {
    await admin
      .from("notifications")
      .update({ email_fallback_sent: true })
      .in(
        "id",
        items.map((i) => i.id)
      );
  }
  return sent;
}

/** Same notification content fanned out to multiple users (e.g. all admins). */
export async function notifyUsers(userIds: string[], payload: Omit<NotifyInput, "userId">): Promise<void> {
  const unique = Array.from(new Set(userIds));
  await Promise.all(unique.map((userId) => notifyUser({ ...payload, userId })));
}

/**
 * Notifies every active super_admin/admin. Single place for the
 * "fetch admins, then notify" pattern.
 */
export async function notifyAdmins(payload: Omit<NotifyInput, "userId">): Promise<void> {
  const admin = createAdminClient();
  const { data: admins } = await admin
    .from("users")
    .select("id")
    .in("role", ["super_admin", "admin"])
    .eq("is_active", true);

  if (admins?.length) {
    await notifyUsers(
      admins.map((a) => a.id),
      payload
    );
  }
}
