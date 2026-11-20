import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { transform } from "esbuild";

const source = await readFile(new URL("../src/demo.ts", import.meta.url), "utf8");
const start = source.indexOf("export const saveDemoBooks=");
const end = source.indexOf("export const isDemoBook=", start);
assert.ok(start >= 0 && end > start, "Local storage writer exists");
const isolated = 'const deviceKey="wondertale-opt-in-books-v1"; const sessionKey="wondertale-preview-books-v1";\n' +
  source.slice(start, end);
const { code } = await transform(isolated, { loader: "ts", format: "esm", target: "es2022" });
const { saveDemoBooks } = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));

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
    id: "local-" + i, savedOnDevice, name: "Hero " + i
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
  saveDemoBooks([...makeBooks(2), ...makeBooks(20, false).map((book, i) => ({ ...book, id: "session-" + i }))]);
  const beforeDevice = local.getItem("wondertale-opt-in-books-v1");
  const beforeSession = session.getItem("wondertale-preview-books-v1");
  assert.throws(() => saveDemoBooks([
    ...makeBooks(2),
    ...makeBooks(21, false).map((book, i) => ({ ...book, id: "session-" + i }))
  ]), /LOCAL_LIBRARY_FULL/);
  assert.equal(local.getItem("wondertale-opt-in-books-v1"), beforeDevice);
  assert.equal(session.getItem("wondertale-preview-books-v1"), beforeSession);
}));
