// Public application shell only. Never cache accounts, generated stories or API data.
const CACHE = "wondertale-public-v19";
const STORY_OFFLINE_CACHE = "wondertale-offline-stories-v1";
const FILM_OFFLINE_CACHE = "wondertale-offline-films-v1";
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
        const scripts = await Promise.all(assets.filter(path => path.endsWith(".js")).map(async path => {
          const entry = await cache.match(path);
          return entry ? entry.text() : "";
        }));
        const studio = scripts.join("").match(/CartoonStudio-[a-zA-Z0-9_-]+\.js/);
        if (studio) await cache.add("/assets/" + studio[0]);
        // Decorative art is optional and cannot block installation.
        await Promise.allSettled(OPTIONAL_ART.map(path => cache.add(path)));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("wondertale-") && key !== CACHE && key !== STORY_OFFLINE_CACHE && key !== FILM_OFFLINE_CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function serveSavedFilm(request) {
  const cache = await caches.open(FILM_OFFLINE_CACHE);
  const saved = await cache.match(request, {ignoreVary: true});
  if (!saved) return fetch(request);

  const range = request.headers.get("Range");
  if (!range) return saved;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  const body = await saved.blob();
  const size = body.size;
  const start = match?.[1] ? Number(match[1]) : Math.max(0, size - Number(match?.[2]));
  const end = match?.[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  if (!match || (!match[1] && !match[2]) || !(start <= end && start < size)) {
    return new Response(null, {status: 416, headers: {"Content-Range": `bytes */${size}`}});
  }
  return new Response(body.slice(start, end + 1), {
    status: 206,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes"
    }
  });
}

async function serveClassicPage(request, pathname) {
  const cache = await caches.open(CACHE);
  const response = await fetch(request).catch(() => Response.error());
  const type = response.headers?.get("content-type") || "";
  if (response.ok && response.type === "basic" && /image\/png/i.test(type)) {
    await cache.put(request, response.clone()).catch(() => {});
    return response;
  }
  // Keep saved illustrations when the server is offline or returns an HTML rewrite.
  const saved = await cache.match(request) || await (await caches.open(STORY_OFFLINE_CACHE)).match(request);
  if (saved) return saved;
  if (/^\/images\/classics\/(three-pigs|red-hood)\/pages\/page-1\.png$/.test(pathname)) {
    const cover = await (await caches.open(FILM_OFFLINE_CACHE)).match(request, {ignoreVary: true});
    if (cover) return cover;
  }
  return response;
}

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

  if (/^\/cartoons\/(three-pigs|red-hood)\/(film-(ru|uz|en)\.mp4|(ru|uz|en)\.vtt)$/.test(url.pathname)) {
    event.respondWith(serveSavedFilm(request));
    return;
  }

  // Animated character GIFs are public book art, cached only on first use.
  // Fetch the latest version; allow offline playback only from a valid cached GIF.
  if (/^\/(?:images\/classics\/[a-z0-9-]+\/animations|images\/interactions\/reactions)\/[a-z0-9-]+\.gif$/.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        const type = response.headers?.get("content-type") || "";
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
    event.respondWith(serveClassicPage(request, url.pathname));
    return;
  }

  // Only immutable build assets and public story illustrations are cached.
  // Dynamic responses and personalized book content always bypass the cache.
  if (PUBLIC_ASSET.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE).then(async cache => {
        // Never use caches.match(): that may read another service worker's
        // cache, including content not approved for this public shell.
        const cached = await cache.match(request, {ignoreVary: url.pathname.startsWith("/assets/")});
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
