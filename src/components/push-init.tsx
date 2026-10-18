"use client";

import { useEffect } from "react";
import { syncExistingSubscription } from "@/lib/notifications/client-push";

/**
 * Runs on every page (mounted in the shared Header). It never shows a
 * permission prompt on its own — browsers and iPhones block prompts that
 * are not triggered by a tap. It only registers the service worker and keeps
 * this device's subscription in sync once the user has allowed notifications
 * (see NotificationPermission / PushPrompt for the button).
 */
export function PushInit({ userId }: { userId: string }) {
  useEffect(() => {
    syncExistingSubscription();
  }, [userId]);

  return null;
}
