// Service worker: rende l'app utilizzabile offline.
const CACHE = 'classe-v2';
const FILES = ['./', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest', 'icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

// Rete prima, cache come riserva: gli aggiornamenti arrivano subito quando si è online.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // I dati della classe e le pagine PHP non vanno mai messi in cache.
  if (new URL(e.request.url).pathname.endsWith('.php')) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copia = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
