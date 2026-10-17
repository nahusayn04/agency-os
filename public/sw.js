self.addEventListener("push", function (event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Agency OS";
  const options = {
    body: data.message || "",
    icon: "/N.png",
    badge: "/N.png",
    data: { link: data.link || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const link = event.notification.data?.link || "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (list) {
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
