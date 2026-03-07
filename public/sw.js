self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const title = data.title || "ramadanly";
  const options = {
    body: data.body || "new notification",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: data.tag || "ramadanly-push",
    data: {
      url: data.url || "/workspace",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification?.data?.url || "/workspace";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }

      if (clients.openWindow) return clients.openWindow(url);
      return undefined;
    }),
  );
});
