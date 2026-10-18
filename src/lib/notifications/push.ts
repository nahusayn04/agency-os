import "server-only";

import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { isQuietHours } from "@/lib/notifications/time";
import type { NotificationPriority } from "@/lib/notifications/types";

let vapidReady = false;

function ensureVapid(): boolean {
  if (vapidReady) return true;

  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    // Push isn't configured in this environment (e.g. local dev without
    // VAPID keys set) — fail silently rather than crashing every action
    // that tries to send a push. In-app notifications still work fine.
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidReady = true;
  return true;
}

export type PushAction = { action: string; title: string };

export type PushPayload = {
  title: string;
  message: string;
  link?: string;
  /** notifications.id — lets the device confirm delivery (see /api/push/ack). */
  id?: string;
  priority?: NotificationPriority;
  /** Same tag = the new push replaces the old one on the device. */
  tag?: string;
  /** Update an existing notification without sound or vibration. */
  silent?: boolean;
  actions?: PushAction[];
  leadId?: string;
};

export type PushResult = {
  /** Devices we tried to reach. */
  attempted: number;
  /** Devices whose push service accepted the message. */
  accepted: number;
  /** True when the send was skipped because of quiet hours. */
  quiet?: boolean;
};

/**
 * Sends a system-level (outside-the-app) push notification to every device
 * a user has subscribed on. Safe to call unconditionally — no-ops quietly
 * if VAPID isn't configured or the user has no subscription.
 * Automatically removes subscriptions the browser has revoked (410/404).
 *
 * Nothing is pushed between 10 PM and 8 AM IST unless `force` is set (used
 * by the "send test notification" button).
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  options: { force?: boolean } = {}
): Promise<PushResult> {
  if (!options.force && isQuietHours()) {
    return { attempted: 0, accepted: 0, quiet: true };
  }
  if (!ensureVapid()) return { attempted: 0, accepted: 0 };

  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, subscription")
    .eq("user_id", userId);

  if (!subs || subs.length === 0) return { attempted: 0, accepted: 0 };

  const urgent = payload.priority === "urgent";

  const body = JSON.stringify({
    title: payload.title,
    message: payload.message,
    link: payload.link ?? "/",
    id: payload.id,
    priority: payload.priority ?? "normal",
    tag: payload.tag,
    silent: payload.silent ?? false,
    actions: payload.actions,
    leadId: payload.leadId,
  });

  let accepted = 0;

  await Promise.all(
    subs.map(async (row) => {
      try {
        const subscription =
          typeof row.subscription === "string" ? JSON.parse(row.subscription) : row.subscription;
        await webpush.sendNotification(subscription, body, {
          TTL: urgent ? 6 * 60 * 60 : 12 * 60 * 60,
          urgency: urgent ? "high" : "normal",
        });
        accepted += 1;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription no longer valid on the browser's end — clean it up.
          await admin.from("push_subscriptions").delete().eq("id", row.id);
        } else {
          console.error(`Push send failed for user ${userId}:`, err);
        }
      }
    })
  );

  return { attempted: subs.length, accepted };
}

/** Convenience helper for fan-out notifications (e.g. "notify all admins"). */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  const unique = Array.from(new Set(userIds));
  await Promise.all(unique.map((id) => sendPushToUser(id, payload)));
}
