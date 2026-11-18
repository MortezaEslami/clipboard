// Offline cache for the app shell + lesson data. Videos live in OPFS, not here.
const VERSION = 'clipboard-v20';
const CORE = ['./', 'index.html', 'css/app.css', 'css/polish.css', 'css/fx.css', 'js/fx.js', 'js/i18n.js', 'js/subs.js', 'js/addclip.js', 'js/occur.js','js/dictation.js','js/game.js', 'js/stats.js', 'js/sync.js', 'js/stories.js', 'data/stories.json', 'manifest.webmanifest', 'fonts/vazirmatn.woff2', 'fonts/inter-latin.woff2',
  'js/main.js', 'js/state.js', 'js/db.js', 'js/util.js', 'js/fsrs.js', 'js/videos.js', 'js/home.js', 'js/player.js', 'js/review.js', 'js/vocab.js', 'js/marks.js', 'js/settings.js',
  'data/index.json', 'data/glossary.json', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    return hit || (await net) || new Response('offline', { status: 503 });
  }));
});
