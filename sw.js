// Amar Lifestyle — offline support: app files are cached, data always comes fresh from the server.
const CACHE = "amarlifestyle-v18";
const FILES = [
  "./", "index.html", "manifest.json", "css/app.css",
  "js/main.js", "js/app.js", "js/api.js", "js/ui.js", "js/auth.js", "js/today.js", "js/week.js", "js/money.js", "js/me.js", "js/more.js", "js/voice.js", "js/aicoach.js",
  "assets/icon-64.png", "assets/icon-180.png", "assets/icon-192.png", "assets/icon-512.png", "assets/logo-dark.png", "assets/logo-light.png", "assets/founder.jpg",
];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" })))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // API calls go straight to the network
  // network first so updates show up quickly; cache when offline
  e.respondWith(fetch(url.href, { cache: "no-cache" }).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r;
  }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});

// phone notifications
self.addEventListener("push", e => {
  let d = {}; try { d = e.data.json(); } catch { d = { title: "Amar Lifestyle", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Amar Lifestyle", {
    body: d.body || "", icon: "assets/icon-192.png", badge: "assets/icon-64.png", tag: d.title, data: { url: d.url || "#/today" }, vibrate: [120, 60, 120],
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL("./" + (e.notification.data?.url || "#/today"), self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if (c.url.startsWith(self.registration.scope)) { c.navigate(url); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
