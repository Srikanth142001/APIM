// NexGen APIM — Service Worker for Push Notifications

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener("push", (e) => {
  if (!e.data) return;

  let data;
  try {
    data = e.data.json();
  } catch {
    data = { title: "NexGen APIM Alert", body: e.data.text() };
  }

  const options = {
    body: data.body || data.message || "",
    icon: data.icon || "/logo192.png",
    badge: data.badge || "/logo192.png",
    tag: data.tag || "apim-alert",
    data: data.data || {},
    actions: data.actions || [
      { action: "view", title: "View Dashboard" },
      { action: "dismiss", title: "Dismiss" },
    ],
    requireInteraction: data.data?.severity === "critical",
    vibrate: data.data?.severity === "critical" ? [200, 100, 200] : [100],
    timestamp: Date.now(),
  };

  e.waitUntil(
    self.registration.showNotification(data.title || "NexGen APIM Alert", options)
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();

  if (e.action === "dismiss") return;

  const url = e.notification.data?.url || "/dashboard?tab=alerts";

  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
