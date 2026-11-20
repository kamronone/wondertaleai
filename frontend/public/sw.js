// Public application shell only. Never cache accounts, generated stories or API data.
const CACHE = "wondertale-public-v6";
const CORE = ["/", "/index.html", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];
const OPTIONAL_ART = ["/images/wondertale-hero.webp", "/images/wondertale-welcome.png"];
const PUBLIC_ASSET = /^\/(?:assets\/|icons\/|images\/classics\/|images\/features\/|images\/wondertale-(?:hero\.webp|welcome\.(?:png|svg))$)/;
const PRIVATE_PATH = /^\/(?:api\/|auth\/|account\/)/;

/** Find only Vite-generated, same-origin JS/CSS from the actual app shell. */
const shellAssets = html => {
  const links = [];
  const pattern = /<(?:script|link)\b[^>]*\b(?:src|href)=["'](\/assets\/[a-zA-Z0-9._/-]+\.(?:js|css))["'][^>]*>/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) links.push(match[1]);
  return [...new Set(links)];
};

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(async cache => {
        await cache.addAll(CORE);
        // Cache the Vite entry JS and CSS on the first install, not only after
        // a second online visit. The shell itself stays available on failure.
        try {
          const shell = await cache.match("/index.html");
          if (shell) {
            const html = await shell.text();
            await Promise.allSettled(shellAssets(html).map(path => cache.add(path)));
          }
        } catch { /* A partial shell still installs; never cache private data. */ }
        await Promise.allSettled(OPTIONAL_ART.map(path => cache.add(path)));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("wondertale-") && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || request.headers.has("Authorization")) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || PRIVATE_PATH.test(url.pathname)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE);
        return (await cache.match("/index.html")) || Response.error();
      })
    );
    return;
  }

  // Only immutable build assets and public story illustrations are cached.
  // Dynamic responses and personalized book content always bypass the cache.
  if (PUBLIC_ASSET.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE).then(async cache => {
        // Never use caches.match(): that may read another service worker's
        // cache, including content not approved for this public shell.
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok && response.type === "basic") {
          await cache.put(request, response.clone());
        }
        return response;
      })
    );
  }
});
