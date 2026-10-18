// Agency OS service worker: shows push notifications, confirms delivery,
// handles Snooze buttons and keeps the device subscription alive.

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", function (event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { message: event.data ? event.data.text() : "" };
  }

  const urgent = data.priority === "urgent";
  const silent = !!data.silent;
  const title = (urgent ? "\uD83D\uDD34 " : "") + (data.title || "Agency OS");

  const options = {
    body: data.message || "",
    icon: "/N.png",
    badge: "/N.png",
    timestamp: Date.now(),
    requireInteraction: urgent && !silent,
    data: { link: data.link || "/", id: data.id || null, leadId: data.leadId || null },
  };

  if (data.tag) {
    options.tag = data.tag;
    // Same tag replaces the old notification. Only buzz again when this is a
    // real new alert, not a quiet count update.
    options.renotify = !silent;
  }
  if (silent) {
    options.silent = true;
  } else {
    // Urgent: long, distinct pattern. Normal: one short tap.
    options.vibrate = urgent ? [400, 150, 400, 150, 600] : [120];
  }
  if (Array.isArray(data.actions) && data.actions.length) {
    options.actions = data.actions;
  }

  const tasks = [self.registration.showNotification(title, options)];

  // Tell the server this device really received it. If an urgent one is never
  // confirmed, the server falls back to email.
  if (data.id) {
    tasks.push(
      fetch("/api/push/ack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: data.id }),
        keepalive: true,
      }).catch(function () {})
    );
  }

  event.waitUntil(Promise.all(tasks));
});

self.addEventListener("notificationclick", function (event) {
  const notification = event.notification;
  const info = notification.data || {};
  notification.close();

  // Snooze buttons on the notification itself.
  if ((event.action === "snooze1h" || event.action === "snoozeTomorrow") && info.leadId) {
    event.waitUntil(
      fetch("/api/notifications/snooze", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: info.leadId,
          mode: event.action === "snooze1h" ? "1h" : "tomorrow",
        }),
      }).catch(function () {})
    );
    return;
  }

  const link = info.link || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (const client of list) {
        if ("focus" in client && "navigate" in client) {
          return client.focus().then(function () {
            return client.navigate(link);
          });
        }
      }
      return clients.openWindow(link);
    })
  );
});

// The browser rotated or expired our subscription: create a new one and give
// it to the server so this device keeps receiving notifications.
self.addEventListener("pushsubscriptionchange", function (event) {
  event.waitUntil(
    (async function () {
      const oldSub = event.oldSubscription;
      const key = oldSub && oldSub.options && oldSub.options.applicationServerKey;
      if (!key) return;
      const sub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub }),
      });
    })().catch(function () {})
  );
});
