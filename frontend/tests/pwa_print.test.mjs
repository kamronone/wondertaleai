import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import { transform } from "esbuild";

const workerSource = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
const mainSource = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");
const printCss = await readFile(new URL("../src/reader-polish.css", import.meta.url), "utf8");
const imagesSource = await readFile(new URL("../src/book_images.ts", import.meta.url), "utf8");
const { code: imagesCode } = await transform(imagesSource, { loader: "ts", format: "esm", target: "es2022" });
const { resolveBookImage } = await import("data:text/javascript;base64," + Buffer.from(imagesCode).toString("base64"));

function serviceWorkerHarness({ optionalFailure = false, requiredFailure = false, shellHtml = '<script type="module" src="/assets/index-1.js"></script>' } = {}) {
  const listeners = new Map();
  const cached = [];
  const written = [];
  const publicResponse = { ok: true, type: "basic", clone() { return this; } };
  const store = {
    addAll: async paths => { if (requiredFailure && paths.some(path => path.startsWith("/assets/"))) throw Error("Bundled app asset failed"); cached.push(...paths); },
    add: async path => {
      if (optionalFailure) throw Error("Optional art unavailable");
      cached.push(path);
    },
    match: async request => request === "/index.html" ? { text: async () => shellHtml } : null,
    put: async (request) => { written.push(request.url); }
  };
  const self = {
    location: { origin: "https://wondertale.example" },
    addEventListener: (name, handler) => listeners.set(name, handler),
    skipWaiting: async () => {},
    clients: { claim: async () => {} }
  };
  const caches = {
    open: async () => store,
    match: async () => { throw Error("Cross-cache lookup is forbidden"); },
    keys: async () => [],
    delete: async () => true
  };
  vm.runInNewContext(workerSource, {
    self, caches, URL, Response, Promise,
    fetch: async () => publicResponse
  });
  return { listeners, cached, written };
}

function dispatchFetch(listeners, path, { authorization = false, origin = "https://wondertale.example" } = {}) {
  let response;
  const request = {
    method: "GET", mode: "cors", url: origin + path,
    headers: { has: name => authorization && name === "Authorization" }
  };
  listeners.get("fetch")({
    request,
    respondWith(promise) { response = promise; }
  });
  return response;
}

test("PWA installation does not fail when optional artwork is unavailable", async () => {
  const { listeners, cached } = serviceWorkerHarness({ optionalFailure: true });
  let installation;
  listeners.get("install")({ waitUntil(promise) { installation = promise; } });
  await assert.doesNotReject(installation);
  assert.ok(cached.includes("/index.html"));
  assert.ok(cached.includes("/manifest.webmanifest"));
});

test("PWA precaches same-origin Vite JS/CSS on first install", async () => {
  const shellHtml = '<!doctype html><script type="module" src="/assets/index-A12.js"></script>' +
    '<link rel="stylesheet" href="/assets/index-BC3.css">' +
    '<script src="https://other.example/secret.js"></script>' +
    '<script src="/api/private-token.js"></script>';
  const { listeners, cached } = serviceWorkerHarness({ shellHtml });
  let installation;
  listeners.get("install")({ waitUntil(promise) { installation = promise; } });
  await installation;
  assert.ok(cached.includes("/assets/index-A12.js"));
  assert.ok(cached.includes("/assets/index-BC3.css"));
  assert.ok(!cached.some(url => url.includes("secret.js") || url.includes("private-token.js")));
});

test("PWA update refuses activation when required app JS cannot be cached", async () => {
  const { listeners, cached } = serviceWorkerHarness({ requiredFailure: true });
  let installation;
  listeners.get("install")({ waitUntil(promise) { installation = promise; } });
  await assert.rejects(installation, /Bundled app asset failed/);
  assert.ok(cached.includes("/index.html"));
});

test("PWA update refuses an HTML shell missing the application entry", async () => {
  const { listeners } = serviceWorkerHarness({ shellHtml: "<!doctype html><title>Missing build</title>" });
  let installation;
  listeners.get("install")({ waitUntil(promise) { installation = promise; } });
  await assert.rejects(installation, /Missing Vite application entry/);
});

test("PWA never intercepts account APIs, authenticated requests, or other origins", () => {
  const { listeners } = serviceWorkerHarness();
  assert.equal(dispatchFetch(listeners, "/api/books"), undefined);
  assert.equal(dispatchFetch(listeners, "/auth/login"), undefined);
  assert.equal(dispatchFetch(listeners, "/images/classics/ryaba.webp", { authorization: true }), undefined);
  assert.equal(dispatchFetch(listeners, "/images/classics/ryaba.webp", { origin: "https://another.example" }), undefined);
});

test("PWA public cache stays isolated from every other cache", async () => {
  const { listeners, written } = serviceWorkerHarness();
  const imageResponse = dispatchFetch(listeners, "/images/classics/ryaba.webp");
  assert.ok(imageResponse);
  await assert.doesNotReject(imageResponse);
  assert.deepEqual(written, ["https://wondertale.example/images/classics/ryaba.webp"]);
});

test("PWA serves original public book artwork and app assets through its cache policy", async () => {
  const { listeners, written } = serviceWorkerHarness();
  const scene = dispatchFetch(listeners, "/images/features/real-book.png");
  assert.ok(scene);
  await scene;
  assert.deepEqual(written, ["https://wondertale.example/images/features/real-book.png"]);
  assert.ok(dispatchFetch(listeners, "/assets/index-abc123.js"));
});

test("Printable books include all pages with illustration fallback", () => {
  assert.match(mainSource, /active\.pages\.map\(\(item,index\)=>\s*<section className="print-book-page"/);
  assert.match(mainSource, /<StoryIllustration url=\{classicReaderImage\(isDemoBook\(active as DemoBook\)\?\(active as DemoBook\)\.classicId:undefined,item\.image_url,index\)\}/);
  assert.match(printCss, /@media print/);
  assert.match(printCss, /overflow:visible;/);
  assert.doesNotMatch(printCss, /height:265mm;\s*overflow:hidden/);
});

test("Local SVG artwork survives optional API configuration without unsafe URLs", () => {
  const svg = "data:image/svg+xml;charset=utf-8,%3Csvg%20viewBox%3D%220%200%2010%2010%22%3E%3C%2Fsvg%3E";
  const api = "https://api.wondertale.example";
  assert.equal(resolveBookImage(svg, api), svg);
  assert.equal(resolveBookImage("/images/classics/ryaba.webp", api), "/images/classics/ryaba.webp");
  assert.equal(resolveBookImage("/media/page-1.webp", api), api + "/media/page-1.webp");
  assert.equal(resolveBookImage("javascript:alert(1)", api), "/images/wondertale-hero.webp");
  assert.equal(resolveBookImage("https://untrusted.example/child.png", api), "/images/wondertale-hero.webp");
  assert.equal(resolveBookImage("data:image/svg+xml;charset=utf-8," + "a".repeat(41000), api), "/images/wondertale-hero.webp");
  assert.equal(resolveBookImage("/media/page-1.webp", "http://localhost:8000"), "/images/wondertale-hero.webp");
});
