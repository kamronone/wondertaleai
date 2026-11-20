import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { transform } from "esbuild";

const source = await readFile(new URL("../src/reader_navigation.ts", import.meta.url), "utf8");
const { code } = await transform(source, { loader: "ts", format: "esm", target: "es2022" });
const { nextReaderPage, swipeDirection } = await import(
  "data:text/javascript;base64," + Buffer.from(code).toString("base64")
);

test("Page turns stay inside the book boundaries", () => {
  assert.equal(nextReaderPage(0, 8, -1), 0);
  assert.equal(nextReaderPage(0, 8, 1), 1);
  assert.equal(nextReaderPage(7, 8, 1), 7);
  assert.equal(nextReaderPage(7, 8, -1), 6);
  assert.equal(nextReaderPage(0, 0, 1), 0);
  assert.equal(nextReaderPage(Number.NaN, 8, 1), 1);
});

test("Swipe navigation ignores vertical scrolls, small drags and invalid movement", () => {
  assert.equal(swipeDirection(-110, 12), 1);
  assert.equal(swipeDirection(110, 12), -1);
  assert.equal(swipeDirection(20, 0), null);
  assert.equal(swipeDirection(100, 160), null);
  assert.equal(swipeDirection(65, 65), null);
  assert.equal(swipeDirection(Number.NaN, 0), null);
});

test("Reader navigation disables arrow keys when editing a story page", async () => {
  const app = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");
  assert.match(app, /if\(tab!==["']reader["']\|\|!active\|\|editingPage\)return;/);
  assert.match(app, /\[tab,active\?\.id,active\?\.pages\.length,editingPage\]/);
  assert.match(app, /window\.getSelection\(\)\?\.toString\(\)\.trim\(\)/);
});


test("Pinch zoom and cancelled iPhone touches never become reader page turns", async () => {
  const app = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");
  assert.match(app, /if\(event\.touches\.length!==1\)\{readerTouchStart\.current=null;return;\}/);
  assert.match(app, /identifier:touch\.identifier/);
  assert.match(app, /event\.touches\.length>0\|\|!active\|\|editingPage/);
  assert.match(app, /item\.identifier===start\.identifier/);
  assert.match(app, /onTouchCancel=\{onReaderTouchCancel\}/);
  assert.match(app, /const onReaderTouchCancel=\(\)=>\{readerTouchStart\.current=null;\}/);
});
