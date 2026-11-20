import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { transform } from "esbuild";

const source = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");
const begin = source.indexOf("  const printFullBook=async()=>{");
const end = source.indexOf("  const stopSpeech=()=>{", begin);
assert.ok(begin !== -1 && end > begin, "Reader export implementation exists");
const fragment = source.slice(begin, end).replace("const printFullBook=", "export const printFullBook=");
const { code } = await transform(fragment, { loader: "ts", format: "esm", target: "es2022" });
const { printFullBook } = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));

function withPrintBrowser(images) {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const state = { printed: 0, triggerTimeout: null };
  globalThis.document = { querySelectorAll: () => images };
  globalThis.window = {
    print: () => { state.printed++; },
    setTimeout: (callback) => { state.triggerTimeout = callback; return 17; },
    clearTimeout: () => {}
  };
  return {
    state,
    restore() { globalThis.document = previousDocument; globalThis.window = previousWindow; }
  };
}

function pendingImage() {
  const listeners = new Map();
  return {
    complete: false,
    addEventListener(type, callback) { listeners.set(type, callback); },
    removeEventListener(type) { listeners.delete(type); },
    fire(type) { const callback = listeners.get(type); if (callback) callback(); },
    listenerCount() { return listeners.size; }
  };
}

test("PDF print waits for pending book illustrations", async () => {
  const image = pendingImage();
  const browser = withPrintBrowser([image]);
  try {
    const printing = printFullBook();
    assert.equal(browser.state.printed, 0);
    image.complete = true;
    image.fire("load");
    await printing;
    assert.equal(browser.state.printed, 1);
    assert.equal(image.listenerCount(), 0);
  } finally { browser.restore(); }
});

test("PDF print proceeds after bounded wait when an image never loads", async () => {
  const image = pendingImage();
  const browser = withPrintBrowser([image]);
  try {
    const printing = printFullBook();
    assert.equal(browser.state.printed, 0);
    assert.equal(typeof browser.state.triggerTimeout, "function");
    browser.state.triggerTimeout();
    await printing;
    assert.equal(browser.state.printed, 1);
    assert.equal(image.listenerCount(), 0);
  } finally { browser.restore(); }
});

test("PDF print opens immediately when there are no pending images", async () => {
  const browser = withPrintBrowser([{ complete: true }]);
  try {
    await printFullBook();
    assert.equal(browser.state.printed, 1);
  } finally { browser.restore(); }
});
