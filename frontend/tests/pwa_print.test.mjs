import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

const workerSource = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
const mainSource = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");
const printCss = await readFile(new URL("../src/reader-polish.css", import.meta.url), "utf8");

function serviceWorkerHarness({ optionalFailure = false } = {}) {
  const listeners = new Map();
  const cached = [];
  const written = [];
  const publicResponse = { ok: true, type: "basic", clone() { return this; } };
  const store = {
    addAll: async paths => { cached.push(...paths); },
    add: async path => {
      if (optionalFailure) throw Error("Optional art unavailable");
      cached.push(path);
    },
    match: async () => null,
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
    match: async () => null,
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

test("PWA never intercepts account APIs, authenticated requests, or other origins", () => {
  const { listeners } = serviceWorkerHarness();
  assert.equal(dispatchFetch(listeners, "/api/books"), undefined);
  assert.equal(dispatchFetch(listeners, "/auth/login"), undefined);
  assert.equal(dispatchFetch(listeners, "/images/classics/ryaba.webp", { authorization: true }), undefined);
  assert.equal(dispatchFetch(listeners, "/images/classics/ryaba.webp", { origin: "https://another.example" }), undefined);
});

test("PWA serves original public book artwork and app assets through its cache policy", async () => {
  const { listeners, written } = serviceWorkerHarness();
  const scene = dispatchFetch(listeners, "/images/features/real-book.png");
  assert.ok(scene);
  await scene;
  assert.deepEqual(written, ["https://wondertale.example/images/features/real-book.png"]);
  assert.ok(dispatchFetch(listeners, "/assets/index-abc123.js"));
});

test("Printable books include all pages and preserve locally generated SVG data images", () => {
  assert.match(mainSource, /active\.pages\.map\(\(item,index\)=>\s*<section className="print-book-page"/);
  assert.ok(mainSource.includes('url.startsWith("data:image/svg+xml;charset=utf-8,")'));
  assert.match(printCss, /@media print/);
  assert.match(printCss, /overflow:visible;/);
  assert.doesNotMatch(printCss, /height:265mm;\s*overflow:hidden/);
});
