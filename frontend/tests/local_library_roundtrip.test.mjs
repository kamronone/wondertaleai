import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { transform } from "esbuild";

// Compile and execute the same library functions used by React, without
// importing unrelated illustration data or requiring a browser.
const source = await readFile(new URL("../src/demo.ts", import.meta.url), "utf8");
const start = source.indexOf("export const isValidLocalBook=");
const end = source.indexOf("const illustration=", start);
assert.ok(start >= 0 && end > start, "Browser library module exists");
const fragment = [
  'const sessionKey="wondertale-preview-books-v1";',
  'const deviceKey="wondertale-opt-in-books-v1";',
  source.slice(start, end)
].join("\n");
const { code } = await transform(fragment, { loader: "ts", format: "esm", target: "es2022" });
const { getDemoBooks, saveDemoBooks } = await import(
  "data:text/javascript;base64," + Buffer.from(code).toString("base64")
);

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
}

function withStorage(run) {
  const previousLocal = globalThis.localStorage;
  const previousSession = globalThis.sessionStorage;
  const device = memoryStorage(), session = memoryStorage();
  globalThis.localStorage = device;
  globalThis.sessionStorage = session;
  try { run({ device, session }); }
  finally {
    globalThis.localStorage = previousLocal;
    globalThis.sessionStorage = previousSession;
  }
}

function story(index, savedOnDevice) {
  return {
    id: "local-book-" + index,
    created_at: new Date(Date.UTC(2026, 10, 20, 0, 0, index)).toISOString(),
    name: "Hero", age: 7, theme: "forest", prompt: "Find the key",
    style: "dreamy", title: "Story " + index, mode: "browser-demo",
    savedOnDevice, lastPage: 0,
    pages: [
      { number: 1, text: "First page", image_url: "/images/wondertale-hero.webp" },
      { number: 2, text: "Second page", image_url: "/images/wondertale-hero.webp" }
    ]
  };
}

test("All 40 stories remain visible across two browser storage modes", () => withStorage(() => {
  const books = Array.from({ length: 40 }, (_, i) => story(i, i < 20));
  saveDemoBooks(books);
  const found = getDemoBooks();
  assert.equal(found.length, 40);
  assert.equal(new Set(found.map(book => book.id)).size, 40);
  assert.equal(found.filter(book => book.savedOnDevice).length, 20);
}));

test("Updating reading progress does not remove the oldest ten books", () => withStorage(() => {
  saveDemoBooks(Array.from({ length: 40 }, (_, i) => story(i, i < 20)));
  const updated = getDemoBooks().map(book =>
    book.id === "local-book-35" ? { ...book, lastPage: 1 } : book
  );
  saveDemoBooks(updated);
  const found = getDemoBooks();
  assert.equal(found.length, 40);
  assert.equal(found.find(book => book.id === "local-book-35")?.lastPage, 1);
  assert.ok(found.some(book => book.id === "local-book-0"));
}));

test("Deleting one book keeps all other 39 stories intact", () => withStorage(() => {
  saveDemoBooks(Array.from({ length: 40 }, (_, i) => story(i, i < 20)));
  saveDemoBooks(getDemoBooks().filter(book => book.id !== "local-book-30"));
  const found = getDemoBooks();
  assert.equal(found.length, 39);
  assert.ok(!found.some(book => book.id === "local-book-30"));
  assert.ok(found.some(book => book.id === "local-book-0"));
  assert.ok(found.some(book => book.id === "local-book-39"));
}));
