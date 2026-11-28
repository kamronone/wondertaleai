import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { transform } from "esbuild";

const source = await readFile(new URL("../src/print_book.ts", import.meta.url), "utf8");
const { code } = await transform(source, { loader: "ts", format: "esm", target: "es2022" });
const { printFullBook } = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));

function withPrintBrowser(sources, { cached = false } = {}) {
  const oldDocument = globalThis.document, oldWindow = globalThis.window, oldImage = globalThis.Image;
  const preloads = [];
  const state = { printed: 0, timeout: null, cleared: 0 };
  class MockImage {
    constructor() { this.complete = false; this.onload = null; this.onerror = null; preloads.push(this); }
    set src(value) { this._src = value; if (cached) this.complete = true; }
    get src() { return this._src; }
    load() { this.complete = true; this.onload?.(); }
    fail() { this.complete = true; this.onerror?.(); }
  }
  globalThis.Image = MockImage;
  globalThis.document = { querySelectorAll: () => sources.map(src => ({ src, currentSrc: "" })) };
  globalThis.window = {
    print: () => { state.printed++; },
    setTimeout: callback => { state.timeout = callback; return 11; },
    clearTimeout: () => { state.cleared++; }
  };
  return {
    preloads, state,
    restore() {
      globalThis.document = oldDocument;
      globalThis.window = oldWindow;
      globalThis.Image = oldImage;
    }
  };
}

test("PDF waits for hidden artwork to load independently of display:none", async () => {
  const browser = withPrintBrowser(["/images/page-1.webp", "/images/page-2.webp"]);
  try {
    const result = printFullBook();
    assert.equal(browser.state.printed, 0);
    assert.deepEqual(browser.preloads.map(x => x.src), ["/images/page-1.webp", "/images/page-2.webp"]);
    browser.preloads[0].load();
    assert.equal(browser.state.printed, 0);
    browser.preloads[1].load();
    await result;
    assert.equal(browser.state.printed, 1);
    assert.equal(browser.state.cleared, 1);
  } finally { browser.restore(); }
});

test("PDF loads repeated artwork only once", async () => {
  const browser = withPrintBrowser(["/images/cover.webp", "/images/cover.webp"], { cached: true });
  try {
    await printFullBook();
    assert.equal(browser.preloads.length, 1);
    assert.equal(browser.state.printed, 1);
  } finally { browser.restore(); }
});

test("PDF still opens after an image load error", async () => {
  const browser = withPrintBrowser(["/images/missing.webp"]);
  try {
    const result = printFullBook();
    browser.preloads[0].fail();
    await result;
    assert.equal(browser.state.printed, 1);
  } finally { browser.restore(); }
});

test("PDF opens after bounded timeout on poor mobile connectivity", async () => {
  const browser = withPrintBrowser(["/images/slow.webp"]);
  try {
    const result = printFullBook();
    assert.equal(browser.state.printed, 0);
    assert.equal(typeof browser.state.timeout, "function");
    browser.state.timeout();
    await result;
    assert.equal(browser.state.printed, 1);
    assert.equal(browser.preloads[0].onload, null);
    browser.preloads[0].load();
    assert.equal(browser.state.printed, 1);
  } finally { browser.restore(); }
});

test("PDF opens immediately with no printable artwork", async () => {
  const browser = withPrintBrowser([]);
  try {
    await printFullBook();
    assert.equal(browser.state.printed, 1);
    assert.equal(browser.preloads.length, 0);
  } finally { browser.restore(); }
});
