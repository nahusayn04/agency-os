// Client-side helpers for the "post-call popup" feature.
// When the user taps Call on a lead we remember which lead it was
// (localStorage). When they come back to the app, the popup opens for it.

export const PENDING_CALL_KEY = "agencyos.pendingCall";
const MAX_AGE_MS = 12 * 60 * 60 * 1000; // forget calls older than 12h

export interface PendingCall {
  leadId: string;
  name: string;
  phone: string | null;
  startedAt: number;
  /** true once the app went to the background after the call tap */
  left: boolean;
}

export function savePendingCall(call: PendingCall) {
  try {
    localStorage.setItem(PENDING_CALL_KEY, JSON.stringify(call));
  } catch {
    /* storage blocked — feature just won't remember */
  }
}

export function readPendingCall(): PendingCall | null {
  try {
    const raw = localStorage.getItem(PENDING_CALL_KEY);
    if (!raw) return null;
    const call = JSON.parse(raw) as PendingCall;
    if (!call?.leadId || Date.now() - call.startedAt > MAX_AGE_MS) {
      localStorage.removeItem(PENDING_CALL_KEY);
      return null;
    }
    return call;
  } catch {
    return null;
  }
}

export function clearPendingCall() {
  try {
    localStorage.removeItem(PENDING_CALL_KEY);
  } catch {
    /* ignore */
  }
}

export function markPendingCallLeft() {
  const call = readPendingCall();
  if (call && !call.left) savePendingCall({ ...call, left: true });
}

export function toWhatsappNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return "91" + digits;
  if (digits.length === 11 && digits.startsWith("0")) return "91" + digits.slice(1);
  return digits;
}

/** Shows "Call ho gayi? Stage update karo" — tapping it opens the popup. */
export async function showPostCallNotification(call: PendingCall) {
  try {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    ) {
      return;
    }
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    await reg.showNotification("Call ho gayi? Stage update karo", {
      body: call.name,
      icon: "/N.png",
      badge: "/N.png",
      tag: "postcall-" + call.leadId,
      data: { link: "/crm?postcall=" + call.leadId },
    });
  } catch {
    /* notification is a nice-to-have */
  }
}

export async function closePostCallNotifications() {
  try {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    const list = await reg.getNotifications();
    list
      .filter((n) => n.tag && n.tag.startsWith("postcall-"))
      .forEach((n) => n.close());
  } catch {
    /* ignore */
  }
}
