"use client";

import { useEffect, useState } from "react";
import { BellRing, BellOff, CheckCircle2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enablePush, getPushStatus, syncExistingSubscription, type PushStatus } from "@/lib/notifications/client-push";

/** Status of notifications on THIS device, with Turn on and Send test buttons. */
export function NotificationPermission() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setStatus(getPushStatus());
    syncExistingSubscription();
  }, []);

  if (!status) return null;

  async function turnOn() {
    setBusy(true);
    setNote(null);
    const result = await enablePush();
    setStatus(result.status);
    if (result.error) setNote(result.error);
    setBusy(false);
  }

  async function sendTest() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/push/send", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      setNote(res.ok ? "Test sent. It should appear on this device in a few seconds." : json.error ?? "Test failed.");
    } catch {
      setNote("Test failed. Check your connection.");
    }
    setBusy(false);
  }

  let icon = <BellRing size={18} className="text-primary" />;
  let title = "Notifications are off on this device";
  let body = "Turn them on to get reminders even when the app is closed.";
  let action: React.ReactNode = (
    <Button size="sm" onClick={turnOn} disabled={busy}>
      Turn on
    </Button>
  );

  if (status === "granted") {
    icon = <CheckCircle2 size={18} className="text-emerald-600" />;
    title = "Notifications are on for this device";
    body = "Reminders will reach you even when the app is closed. Quiet hours: 10 PM to 8 AM.";
    action = (
      <Button size="sm" variant="outline" onClick={sendTest} disabled={busy}>
        Send test
      </Button>
    );
  } else if (status === "denied") {
    icon = <BellOff size={18} className="text-red-600" />;
    title = "Notifications are blocked";
    body = "Allow notifications for this site in your browser or phone settings, then reload the page.";
    action = null;
  } else if (status === "needs-install") {
    icon = <Smartphone size={18} className="text-primary" />;
    title = "Add Agency OS to your Home Screen";
    body = "On iPhone, notifications work only after you tap Share, then Add to Home Screen, and open the app from there.";
    action = null;
  } else if (status === "unsupported" || status === "not-configured") {
    icon = <BellOff size={18} className="text-muted-foreground" />;
    title = "Notifications are not available here";
    body =
      status === "not-configured"
        ? "Push keys are not set up on this server yet."
        : "This browser does not support push notifications.";
    action = null;
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
        {note && <p className="mt-1.5 text-sm font-medium text-primary">{note}</p>}
      </div>
      {action}
    </div>
  );
}
