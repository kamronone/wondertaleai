import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { transform } from "esbuild";

const source = await readFile(new URL("../src/reader_navigation.ts", import.meta.url), "utf8");
const { code } = await transform(source, { loader: "ts", format: "esm", target: "es2022" });
const { nextReaderPage, resumeReaderPage, swipeDirection } = await import(
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
  assert.match(app, /event\.touches\.length!==0\|\|event\.changedTouches\.length!==1\|\|!active\|\|editingPage/);
  assert.match(app, /item\.identifier===start\.identifier/);
  assert.match(app, /onTouchMove=\{onReaderTouchMove\}/);
  assert.match(app, /if\(event\.touches\.length!==1\)readerTouchStart\.current=null;/);
  assert.match(app, /onTouchCancel=\{onReaderTouchCancel\}/);
  assert.match(app, /const onReaderTouchCancel=\(\)=>\{readerTouchStart\.current=null;\}/);
});


test("Resume clamps stale, fractional and invalid saved page positions",()=>{
  assert.equal(resumeReaderPage(3,8),3);
  assert.equal(resumeReaderPage(3.9,8),3);
  assert.equal(resumeReaderPage(999,8),7);
  assert.equal(resumeReaderPage(-12,8),0);
  assert.equal(resumeReaderPage(Number.NaN,8),0);
  assert.equal(resumeReaderPage(Number.POSITIVE_INFINITY,8),0);
  assert.equal(resumeReaderPage(undefined,8),0);
  assert.equal(resumeReaderPage(null,8),0);
  assert.equal(resumeReaderPage(2,0),0);
  assert.equal(resumeReaderPage(2,Number.NaN),0);
});

test("Reader opens stored books only after restoring a safe page index",async()=>{
  const app=await readFile(new URL("../src/main.tsx",import.meta.url),"utf8");
  assert.match(app,/setPage\(resumeReaderPage\(book\.lastPage,book\.pages\.length\)\)/);
});
