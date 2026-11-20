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


test("Private reading progress skips superseded queued pages before a network write",async()=>{
  const app=await readFile(new URL("../src/main.tsx",import.meta.url),"utf8");
  assert.match(app,/pendingProgress\.current\.set\(bookId,page\);\s*persistPending\(\);/);
  assert.match(app,/const write=next\.catch\(\(\)=>\{\}\)\.then\(async\(\)=>\{/);
  assert.match(app,/if\(sessionEpoch\.current!==epoch\|\|pendingProgress\.current\.get\(bookId\)!==page\)return;\s*\/\/ Safari PWA[\s\S]*?if\(!navigator\.onLine\)return;\s*try\{\s*await updatePrivateReadingProgress/);
  assert.match(app,/progressWrites\.current\.set\(bookId,write\)/);
});

test("Offline page turns remain queued without attempting a network write",async()=>{
  const app=await readFile(new URL("../src/main.tsx",import.meta.url),"utf8");
  assert.match(app,/pendingProgress\.current\.set\(bookId,page\);\s*persistPending\(\);/);
  assert.match(app,/if\(!navigator\.onLine\)return;\s*try\{\s*await updatePrivateReadingProgress/);
  assert.match(app,/const onOnline=\(\)=>\{void flush\(\);\}/);
  assert.match(app,/await replayPendingChanges\(\{/);
  assert.match(app,/progress:pendingProgress\.current/);
});


test("Mobile reader replaces tiny page dots with a readable current-page indicator",async()=>{
  const [app,css]=await Promise.all([
    readFile(new URL("../src/main.tsx",import.meta.url),"utf8"),
    readFile(new URL("../src/reader-polish.css",import.meta.url),"utf8")
  ]);
  assert.match(app,/className="pager-mobile-current" aria-live="polite">\{page\+1\} \/ \{active\.pages\.length\}/);
  assert.match(css,/\.reader-page \.pager-mobile-current\{display:none\}/);
  assert.match(css,/@media\(max-width:620px\)\{[\s\S]*?\.reader-page \.pager-mobile-current\{[\s\S]*?display:block/);
  assert.match(css,/\.reader-page \.pager-indicators>\.dot,[\s\S]*?\.pager-indicators>\.pager-current\{display:none\}/);
  assert.match(css,/\.reader-page \.pager>button\{min-height:44px\}/);
  assert.match(css,/\.reader-page \.reader-actions \.icon-button\{[\s\S]*?min-width:44px/);
});
