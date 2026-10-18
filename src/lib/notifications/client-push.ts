// Browser-side helpers for web push. Client-only (no server imports).

export type PushStatus =
  | "unsupported" // browser has no push at all
  | "needs-install" // iPhone/iPad: must be added to the Home Screen first
  | "not-configured" // VAPID key missing in this environment
  | "default" // not asked yet
  | "denied" // user blocked notifications in the browser
  | "granted"; // allowed (a subscription may or may not exist yet)

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

function isIosNotInstalled(): boolean {
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
  if (!isIos) return false;
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return !standalone;
}

export function getPushStatus(): PushStatus {
  if (typeof window === "undefined") return "unsupported";
  if (isIosNotInstalled()) return "needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return "not-configured";
  return Notification.permission as PushStatus;
}

async function saveSubscription(subscription: PushSubscription): Promise<boolean> {
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription }),
  });
  return res.ok;
}

async function getOrCreateSubscription(): Promise<PushSubscription> {
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
  });
}

/**
 * Silent sync, never prompts. Registers the service worker and, if the user
 * has already allowed notifications on this device, makes sure the server
 * knows about this device's subscription.
 */
export async function syncExistingSubscription(): Promise<void> {
  const status = getPushStatus();
  if (status === "unsupported" || status === "needs-install") return;
  try {
    await navigator.serviceWorker.register("/sw.js");
    if (status !== "granted") return;
    const sub = await getOrCreateSubscription();
    await saveSubscription(sub);
  } catch (err) {
    console.error("Push sync failed:", err);
  }
}

/** Must be called from a click handler (browsers require a user gesture). */
export async function enablePush(): Promise<{ ok: boolean; status: PushStatus; error?: string }> {
  const status = getPushStatus();
  if (status === "unsupported" || status === "needs-install" || status === "not-configured") {
    return { ok: false, status };
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { ok: false, status: permission as PushStatus };
    }
    const sub = await getOrCreateSubscription();
    const saved = await saveSubscription(sub);
    return saved
      ? { ok: true, status: "granted" }
      : { ok: false, status: "granted", error: "Could not save this device. Please try again." };
  } catch (err) {
    return {
      ok: false,
      status: getPushStatus(),
      error: err instanceof Error ? err.message : "Could not turn on notifications.",
    };
  }
}
