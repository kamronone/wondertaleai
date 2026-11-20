// Public application shell only. Never cache accounts, generated stories or API data.
const CACHE = "wondertale-public-v4";
const CORE = ["/", "/index.html", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/images/wondertale-hero.webp", "/images/wondertale-welcome.png"];
const PUBLIC_ASSET = /^\/(?:assets\/|icons\/|images\/classics\/|images\/features\/|images\/wondertale-(?:hero\.webp|welcome\.(?:png|svg))$)/;
const PRIVATE_PATH = /^\/(?:api\/|auth\/|account\/)/;

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE))
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
      caches.match(request).then(async cached => {
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok && response.type === "basic") {
          const cache = await caches.open(CACHE);
          await cache.put(request, response.clone());
        }
        return response;
      })
    );
  }
});
