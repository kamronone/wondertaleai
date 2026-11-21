import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { transform } from "esbuild";

const source = await readFile(new URL("../src/demo.ts", import.meta.url), "utf8");
const start = source.indexOf("export const isValidLocalBook=");
const end = source.indexOf("const readBooks=", start);
assert.ok(start >= 0 && end > start, "Local-book validator exists");
const isolated = source.slice(start, end);
const { code } = await transform(isolated, { loader: "ts", format: "esm", target: "es2022" });
const { isValidLocalBook } = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));

const sample = () => ({
  id: "local-123", created_at: "2026-11-20T10:00:00.000Z", title: "Forest",
  name: "Mira", age: 7, theme: "forest", style: "gentle", prompt: "Find the key",
  pages: [{ number: 1, text: "A magical story", image_url: "/images/wondertale-hero.webp" }]
});

test("Well-formed offline book remains readable", () => {
  assert.equal(isValidLocalBook(sample()), true);
  assert.equal(isValidLocalBook({ ...sample(), pages: [
    { number: 1, text: "Opening", image_url: "data:image/svg+xml;charset=utf-8,%3Csvg%3E" },
    { number: 2, text: "Ending", image_url: "/images/wondertale-hero.webp" }
  ] }), true);
});

test("Corrupted local book records cannot crash the library sorter", () => {
  assert.equal(isValidLocalBook(null), false);
  assert.equal(isValidLocalBook({ ...sample(), created_at: null }), false);
  assert.equal(isValidLocalBook({ ...sample(), created_at: "not-a-date" }), false);
  assert.equal(isValidLocalBook({ ...sample(), pages: [] }), false);
  assert.equal(isValidLocalBook({ ...sample(), pages: [{ number: 1, text: "", image_url: "" }] }), false);
  assert.equal(isValidLocalBook({ ...sample(), pages: [{ number: 7, text: "Bad ordering", image_url: "" }] }), false);
  assert.equal(isValidLocalBook({ ...sample(), age: 99 }), false);
  assert.equal(isValidLocalBook({ ...sample(), id: "remote-user-private" }), false);
});

test("Large corrupted artwork and excessive page counts are rejected", () => {
  assert.equal(isValidLocalBook({ ...sample(), pages: [
    { number: 1, text: "Hello", image_url: "x".repeat(40001) }
  ] }), false);
  assert.equal(isValidLocalBook({ ...sample(), pages: Array.from({ length: 31 }, (_, i) => ({
    number: i + 1, text: "Hello", image_url: ""
  })) }), false);
});

test("Legacy two-hero books and longer interactive endings are not lost", () => {
  const longName = "A".repeat(60) + " and " + "B".repeat(45);
  const chapter = "A".repeat(1750);
  assert.equal(isValidLocalBook({ ...sample(), name: longName, title: longName + " and the Enchanted Garden",
    pages: [{ number: 1, text: chapter, image_url: "/images/wondertale-hero.webp" }]
  }), true);
  assert.equal(isValidLocalBook({ ...sample(), name: "A".repeat(121) }), false);
  assert.equal(isValidLocalBook({ ...sample(), pages: [
    { number: 1, text: "A".repeat(2201), image_url: "" }
  ] }), false);
});

