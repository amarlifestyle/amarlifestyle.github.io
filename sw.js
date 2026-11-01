// Amar Lifestyle — offline support: app files are cached, data always comes fresh from the server.
const CACHE = "amarlifestyle-v6";
const FILES = [
  "./", "index.html", "manifest.json", "css/app.css",
  "js/main.js", "js/app.js", "js/api.js", "js/ui.js", "js/auth.js", "js/today.js", "js/week.js", "js/money.js", "js/me.js", "js/more.js", "js/voice.js",
  "assets/icon-64.png", "assets/icon-180.png", "assets/icon-192.png", "assets/icon-512.png", "assets/logo-dark.png", "assets/logo-light.png", "assets/founder.jpg",
];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // API calls go straight to the network
  // network first so updates show up quickly; cache when offline
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});
