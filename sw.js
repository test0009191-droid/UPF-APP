// UPF offline support. Bump VERSION whenever you publish a new index.html.
const VERSION = 'upf-v3';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];
// Libraries the page loads online. Saved so PDF reading, PDF/Excel export work with no signal.
const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(SHELL);
    // Best effort: one failed library must not block the install.
    await Promise.all(LIBS.map(u => fetch(u, { mode: 'cors' }).then(r => r.ok && c.put(u, r)).catch(() => {})));
    self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // The page itself: try the network first so updates arrive, fall back to the saved copy offline.
  if (url.origin === location.origin) {
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      try {
        const r = await fetch(req, { cache: 'no-store' });
        if (r.ok) c.put(req, r.clone());
        return r;
      } catch (err) {
        return (await c.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? await c.match('./index.html') : Response.error());
      }
    })());
    return;
  }
  // Libraries from the CDN: saved copy first, then network (and save it).
  if (LIBS.includes(req.url) || /cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/.test(url.host)) {
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      const hit = await c.match(req.url);
      if (hit) return hit;
      try {
        const r = await fetch(req);
        if (r.ok) c.put(req.url, r.clone());
        return r;
      } catch (err) { return Response.error(); }
    })());
  }
});
