const CACHE = "uvu-v2";
const SHELL = ["/", "/manifest.json", "/icon.svg"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icon")) {
    e.respondWith(caches.open(CACHE).then(async (c) => (await c.match(e.request)) || fetch(e.request).then((r) => { c.put(e.request, r.clone()); return r; })));
    return;
  }
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request).then((r) => r || caches.match("/"))));
});
self.addEventListener("push", (e) => {
  const d = e.data ? e.data.json() : { title: "uvu", body: "You vs. you." };
  e.waitUntil(self.registration.showNotification(d.title, { body: d.body, icon: "/icon-192.png", badge: "/icon-192.png", data: d.url || "/" }));
});
self.addEventListener("notificationclick", (e) => { e.notification.close(); e.waitUntil(clients.openWindow(e.notification.data || "/")); });
