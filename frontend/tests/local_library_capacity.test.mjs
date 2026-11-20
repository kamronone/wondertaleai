import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { transform } from "esbuild";

const source = await readFile(new URL("../src/demo.ts", import.meta.url), "utf8");
const start = source.indexOf("export const isValidLocalBook=");
const end = source.indexOf("export const isDemoBook=", start);
assert.ok(start >= 0 && end > start, "Local storage validator and writer exist");
const isolated = 'const deviceKey="wondertale-opt-in-books-v1"; const sessionKey="wondertale-preview-books-v1";\n' +
  source.slice(start, end);
const { code } = await transform(isolated, { loader: "ts", format: "esm", target: "es2022" });
const { isValidLocalBook, saveDemoBooks } = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));

function fakeStore() {
  const data = new Map();
  return {
    data,
    setItem(key, value) { data.set(key, value); },
    removeItem(key) { data.delete(key); },
    getItem(key) { return data.get(key) ?? null; }
  };
}
function withStores(run) {
  const previousLocal = globalThis.localStorage;
  const previousSession = globalThis.sessionStorage;
  const local = fakeStore(), session = fakeStore();
  globalThis.localStorage = local;
  globalThis.sessionStorage = session;
  try { run(local, session); }
  finally { globalThis.localStorage = previousLocal; globalThis.sessionStorage = previousSession; }
}
function makeBooks(count, savedOnDevice = true) {
  return Array.from({ length: count }, (_, i) => ({
    id: "local-" + i, savedOnDevice, name: "Hero " + i,
    title: "Story " + i, age: 7, theme: "forest", prompt: "Find the key",
    style: "dreamy", mode: "browser-demo",
    created_at: new Date(Date.UTC(2026, 10, 20, 0, 0, i)).toISOString(),
    pages: [{ number: 1, text: "Once upon a time", image_url: "/images/cover.webp" }]
  }));
}

test("20 saved books are preserved without truncation", () => withStores(local => {
  saveDemoBooks(makeBooks(20));
  assert.equal(JSON.parse(local.getItem("wondertale-opt-in-books-v1")).length, 20);
}));

test("21st saved book is rejected without deleting previously saved stories", () => withStores(local => {
  saveDemoBooks(makeBooks(20));
  const before = local.getItem("wondertale-opt-in-books-v1");
  assert.throws(() => saveDemoBooks(makeBooks(21)), /LOCAL_LIBRARY_FULL/);
  assert.equal(local.getItem("wondertale-opt-in-books-v1"), before);
}));

test("Session-only overflow does not mutate the saved device library", () => withStores((local, session) => {
  saveDemoBooks(makeBooks(2));
  saveDemoBooks([...makeBooks(2), ...makeBooks(20, false).map((book, i) => ({ ...book, id: "local-session-" + i }))]);
  const beforeDevice = local.getItem("wondertale-opt-in-books-v1");
  const beforeSession = session.getItem("wondertale-preview-books-v1");
  assert.throws(() => saveDemoBooks([
    ...makeBooks(2),
    ...makeBooks(21, false).map((book, i) => ({ ...book, id: "local-session-" + i }))
  ]), /LOCAL_LIBRARY_FULL/);
  assert.equal(local.getItem("wondertale-opt-in-books-v1"), beforeDevice);
  assert.equal(session.getItem("wondertale-preview-books-v1"), beforeSession);
}));

test("Session quota error restores both previous book collections", () => withStores((local, session) => {
  saveDemoBooks([...makeBooks(3), ...makeBooks(2, false).map((b, i) => ({ ...b, id: "local-session-" + i }))]);
  const beforeDevice = local.getItem("wondertale-opt-in-books-v1");
  const beforeSession = session.getItem("wondertale-preview-books-v1");
  const originalSetItem = session.setItem;
  let failOnce = true;
  session.setItem = (key, value) => {
    if (failOnce) { failOnce = false; throw new Error("QuotaExceededError"); }
    return originalSetItem(key, value);
  };
  assert.throws(() => saveDemoBooks([
    ...makeBooks(4), ...makeBooks(3, false).map((b, i) => ({ ...b, id: "local-session-" + i }))
  ]), /LOCAL_LIBRARY_SAVE_FAILED/);
  assert.equal(local.getItem("wondertale-opt-in-books-v1"), beforeDevice);
  assert.equal(session.getItem("wondertale-preview-books-v1"), beforeSession);
}));

test("Device quota error leaves the existing saved books intact", () => withStores(local => {
  saveDemoBooks(makeBooks(3));
  const previous = local.getItem("wondertale-opt-in-books-v1");
  const originalSetItem = local.setItem;
  let failOnce = true;
  local.setItem = (key, value) => {
    if (failOnce) { failOnce = false; throw new Error("QuotaExceededError"); }
    return originalSetItem(key, value);
  };
  assert.throws(() => saveDemoBooks(makeBooks(4)), /LOCAL_LIBRARY_SAVE_FAILED/);
  assert.equal(local.getItem("wondertale-opt-in-books-v1"), previous);
}));


test("Corrupted saved JSON blocks updates without deleting either storage collection", () => withStores((local, session) => {
  const damaged = '{"books":';
  local.setItem("wondertale-opt-in-books-v1", damaged);
  session.setItem("wondertale-preview-books-v1", JSON.stringify(makeBooks(2, false)));
  const beforeSession = session.getItem("wondertale-preview-books-v1");
  assert.throws(() => saveDemoBooks(makeBooks(2, false)), /LOCAL_LIBRARY_SAVE_FAILED/);
  assert.equal(local.getItem("wondertale-opt-in-books-v1"), damaged);
  assert.equal(session.getItem("wondertale-preview-books-v1"), beforeSession);
}));

test("Unexpected top-level JSON objects are preserved instead of replaced", () => withStores((local, session) => {
  saveDemoBooks(makeBooks(2));
  session.setItem("wondertale-preview-books-v1", '{"unexpected":"value"}');
  const previousDevice = local.getItem("wondertale-opt-in-books-v1");
  const previousSession = session.getItem("wondertale-preview-books-v1");
  assert.throws(() => saveDemoBooks(makeBooks(1)), /LOCAL_LIBRARY_SAVE_FAILED/);
  assert.equal(local.getItem("wondertale-opt-in-books-v1"), previousDevice);
  assert.equal(session.getItem("wondertale-preview-books-v1"), previousSession);
}));

test("Empty storage keys still allow new stories to be saved", () => withStores((local, session) => {
  saveDemoBooks([...makeBooks(1), ...makeBooks(1, false).map(book=>({...book,id:"local-session-0"}))]);
  assert.equal(JSON.parse(local.getItem("wondertale-opt-in-books-v1")).length, 1);
  assert.equal(JSON.parse(session.getItem("wondertale-preview-books-v1")).length, 1);
}));


test("A malformed book inside valid JSON blocks overwriting the entire library", () => withStores((local, session) => {
  const damaged = [...makeBooks(2), { id: "local-broken", title: "Missing pages" }];
  local.setItem("wondertale-opt-in-books-v1", JSON.stringify(damaged));
  session.setItem("wondertale-preview-books-v1", JSON.stringify(makeBooks(2, false)));
  const beforeDevice = local.getItem("wondertale-opt-in-books-v1");
  const beforeSession = session.getItem("wondertale-preview-books-v1");
  assert.throws(() => saveDemoBooks(makeBooks(1)), /LOCAL_LIBRARY_SAVE_FAILED/);
  assert.equal(local.getItem("wondertale-opt-in-books-v1"), beforeDevice);
  assert.equal(session.getItem("wondertale-preview-books-v1"), beforeSession);
}));

test("An older over-capacity book array remains untouched for recovery", () => withStores((local, session) => {
  local.setItem("wondertale-opt-in-books-v1", JSON.stringify(makeBooks(21)));
  session.setItem("wondertale-preview-books-v1", JSON.stringify(makeBooks(2, false)));
  const beforeDevice = local.getItem("wondertale-opt-in-books-v1");
  const beforeSession = session.getItem("wondertale-preview-books-v1");
  assert.throws(() => saveDemoBooks(makeBooks(1)), /LOCAL_LIBRARY_SAVE_FAILED/);
  assert.equal(local.getItem("wondertale-opt-in-books-v1"), beforeDevice);
  assert.equal(session.getItem("wondertale-preview-books-v1"), beforeSession);
}));

test("Duplicate IDs supplied for both stores are rejected without changing saved books", () => withStores((local, session) => {
  saveDemoBooks([...makeBooks(1), {...makeBooks(1, false)[0], id:"local-session-a"}]);
  const beforeDevice=local.getItem("wondertale-opt-in-books-v1");
  const beforeSession=session.getItem("wondertale-preview-books-v1");
  assert.throws(() => saveDemoBooks([...makeBooks(1), makeBooks(1, false)[0]]), /LOCAL_LIBRARY_SAVE_FAILED/);
  assert.equal(local.getItem("wondertale-opt-in-books-v1"), beforeDevice);
  assert.equal(session.getItem("wondertale-preview-books-v1"), beforeSession);
}));

test("Existing duplicate book IDs in different stores prevent destructive rewrites", () => withStores((local, session) => {
  local.setItem("wondertale-opt-in-books-v1", JSON.stringify(makeBooks(1)));
  session.setItem("wondertale-preview-books-v1", JSON.stringify(makeBooks(1, false)));
  const beforeDevice=local.getItem("wondertale-opt-in-books-v1");
  const beforeSession=session.getItem("wondertale-preview-books-v1");
  assert.throws(() => saveDemoBooks(makeBooks(1)), /LOCAL_LIBRARY_SAVE_FAILED/);
  assert.equal(local.getItem("wondertale-opt-in-books-v1"), beforeDevice);
  assert.equal(session.getItem("wondertale-preview-books-v1"), beforeSession);
});

test("Existing duplicate book IDs within one store are not silently dropped", () => withStores((local, session) => {
  local.setItem("wondertale-opt-in-books-v1", JSON.stringify([makeBooks(1)[0],makeBooks(1)[0]]));
  const before=local.getItem("wondertale-opt-in-books-v1");
  assert.throws(() => saveDemoBooks(makeBooks(1)), /LOCAL_LIBRARY_SAVE_FAILED/);
  assert.equal(local.getItem("wondertale-opt-in-books-v1"), before);
  assert.equal(session.getItem("wondertale-preview-books-v1"), null);
}));

test("All normal test fixtures have valid local-book IDs and structure", () => {
  assert.ok(makeBooks(20).every(isValidLocalBook));
  assert.ok(makeBooks(20, false).map((book, i)=>({...book,id:"local-session-"+i})).every(isValidLocalBook));
  assert.equal(isValidLocalBook({...makeBooks(1)[0],id:"session-0"}), false);
});
