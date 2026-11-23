// Public application shell only. Never cache accounts, generated stories or API data.
const CACHE = "wondertale-public-v16";
const STORY_OFFLINE_CACHE = "wondertale-offline-stories-v1";
const CORE = ["/", "/index.html", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];
// Public, bundled artwork only. Each asset is optional so offline installation
// still succeeds when an image is missing or a connection is unreliable.
const OPTIONAL_ART = [
  // First-visit artwork only; feature panels and story covers cache on demand.
  "/images/wondertale-hero.webp",
  "/images/wondertale-welcome.png"
];
const PUBLIC_ASSET = /^\/(?:assets\/|icons\/|images\/classics\/|images\/story-brick\.svg$|images\/interactions\/(?:wooden-latch|story-clock|forest-map)\.svg$|images\/features\/|images\/create-(?:boy|girl|fox|dragon|robot|hero-story|read-story-banner)\.png$|images\/(?:library-(?:magic-castle|story-castle-premium)|profile-(?:castle|story-hero))\.png$|images\/wondertale-(?:hero\.webp|welcome\.(?:png|svg))$)/;
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
        // Do not activate a new offline shell without its entry JS/CSS:
        // a half-installed update would replace the last working application.
        const shell = await cache.match("/index.html");
        if (!shell) throw new Error("Missing cached application shell");
        const assets = shellAssets(await shell.text());
        if (!assets.some(path => path.endsWith(".js"))) {
          throw new Error("Missing Vite application entry");
        }
        await cache.addAll(assets);
        // Decorative art is optional and cannot block installation.
        await Promise.allSettled(OPTIONAL_ART.map(path => cache.add(path)));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("wondertale-") && key !== CACHE && key !== STORY_OFFLINE_CACHE).map(key => caches.delete(key))))
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

  // Animated character GIFs are public book art, cached only on first use.
  // Fetch the latest version; allow offline playback only from a valid cached GIF.
  if (/^\/(?:images\/classics\/[a-z0-9-]+\/animations|images\/interactions\/reactions)\/[a-z0-9-]+\.gif$/.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        const type = response.headers.get("content-type") || "";
        if (response.ok && response.type === "basic" && /image\/gif/i.test(type)) {
          await cache.put(request, response.clone()).catch(() => {});
          return response;
        }
        return (await cache.match(request)) || (await (await caches.open(STORY_OFFLINE_CACHE)).match(request)) || response;
      } catch {
        return (await cache.match(request)) || (await (await caches.open(STORY_OFFLINE_CACHE)).match(request)) || Response.error();
      }
    })());
    return;
  }

  // Classic reader images can be updated after an initial deployment.
  // Prefer current server bytes. Keep only successful PNGs offline and never
  // cache missing-image responses (404/HTML SPA rewrites) as illustrations.
  if (/^\/images\/classics\/[a-z0-9-]+\/pages\/page-[1-8]\.png$/.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        const type = response.headers.get("content-type") || "";
        if (response.ok && response.type === "basic" && /image\/png/i.test(type)) {
          await cache.put(request, response.clone()).catch(() => {});
          return response;
        }
        // HTML SPA rewrites or failed requests must not replace a saved PNG.
        return (await cache.match(request)) || (await (await caches.open(STORY_OFFLINE_CACHE)).match(request)) || response;
      } catch {
        return (await cache.match(request)) || (await (await caches.open(STORY_OFFLINE_CACHE)).match(request)) || Response.error();
      }
    })());
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
