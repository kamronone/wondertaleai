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


test("Reader arrow shortcuts leave focused buttons, links and form inputs alone",async()=>{
  const app=await readFile(new URL("../src/main.tsx",import.meta.url),"utf8");
  assert.match(app,/target\.closest\("button, a, input, textarea, select, \[role='button'\], \[role='dialog'\], \[contenteditable='true'\]"\)/);
  assert.match(app,/event\.defaultPrevented\|\|event\.altKey\|\|event\.ctrlKey\|\|event\.metaKey\|\|event\.shiftKey/);
  assert.match(app,/className="icon-button dangerous" type="button" onClick=\{\(\)=>deleteBook\(active\)\} title=\{t\.delete\} aria-label=\{t\.delete\}/);
});

test("Long story titles and action labels wrap without reader toolbar overflow on small iPhones",async()=>{
  const css=await readFile(new URL("../src/reader-polish.css",import.meta.url),"utf8");
  assert.match(css,/\.reader-page \.reader-title h2,[\s\S]*?\.reader-page \.reader-toolbar \.back-button\{\s*overflow-wrap:anywhere/);
  assert.match(css,/@media\(max-width:360px\)\{[\s\S]*?\.reader-page \.reader-toolbar\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(css,/\.reader-page \.reader-title h2\{hyphens:auto\}/);
});


test("Reader remembers warm paper mode across sessions and excludes the night theme",async()=>{
  const app=await readFile(new URL("../src/main.tsx",import.meta.url),"utf8");
  assert.match(app,/localStorage\.getItem\("wondertale_reader_warm_mode"\)==="true"/);
  assert.match(app,/localStorage\.setItem\("wondertale_reader_warm_mode",String\(readerWarmMode\)\)/);
  assert.match(app,/readerNightMode\?" reader-night":readerWarmMode\?" reader-warm":""/);
  assert.match(app,/aria-pressed=\{readerWarmMode&&!readerNightMode\}/);
  assert.match(app,/setReaderWarmMode\(value=>!value\);setReaderNightMode\(false\)/);
  assert.match(app,/setReaderNightMode\(v=>!v\);setReaderWarmMode\(false\)/);
});

test("Warm reader theme supports readable mobile contrast and accessible settings",async()=>{
  const css=await readFile(new URL("../src/reader-polish.css",import.meta.url),"utf8");
  assert.match(css,/\.reader-page \.story-page\.reader-warm\{/);
  assert.match(css,/\.reader-page \.story-page\.reader-warm \.story-text\{/);
  assert.match(css,/\.reader-page \.reader-warm-toggle\.active\{/);
  assert.match(css,/\.reader-page \.reader-font-controls button\{min-height:44px;height:44px/);
  assert.match(css,/\.reader-page \.reader-night-toggle\{min-height:44px\}/);
});


test("Pager, swipe and arrow navigation bring the new story page into view without jumping on initial open",async()=>{
  const [app,css]=await Promise.all([
    readFile(new URL("../src/main.tsx",import.meta.url),"utf8"),
    readFile(new URL("../src/reader-polish.css",import.meta.url),"utf8")
  ]);
  assert.match(app,/const storyPageRef=useRef<HTMLDivElement\|null>\(null\)/);
  assert.match(app,/previousReaderPageRef\.current=\{id:active\.id,page\}/);
  assert.match(app,/previous\?\.id===active\.id&&previous\.page!==page/);
  assert.match(app,/storyPageRef\.current\?\.scrollIntoView\(\{behavior:"auto",block:"start"\}\)/);
  assert.match(app,/ref=\{storyPageRef\} onTouchStart=\{onReaderTouchStart\}/);
  assert.match(css,/\.reader-page \.story-page\{scroll-margin-top:14px\}/);
});

test("long books expose page chooser and reading percentage without replacing paging", async()=>{
  const app=await readFile(new URL("../src/main.tsx",import.meta.url),"utf8");
  const layout=await readFile(new URL("../src/reader-book-variants.css",import.meta.url),"utf8");
  assert.match(app,/Math\.round\(\(\(page\+1\)\/Math\.max\(1,active\.pages\.length\)\)\*100\)/);
  assert.match(app,/active\.pages\.length>=8&&<div className="reader-page-jump"/);
  assert.match(app,/id="reader-page-jump-select" value=\{page\}/);
  assert.match(app,/onChange=\{event=>setPage\(Number\(event\.target\.value\)\)\}/);
  assert.match(app,/active\.pages\.map\(\(_,index\)=><option key=\{index\} value=\{index\}/);
  assert.match(app,/onClick=\{\(\)=>setPage\(p=>Math\.min\(active\.pages\.length-1,p\+1\)\)\}/);
  assert.match(layout,/\.reader-page \.reader-page-jump\{/);
  assert.match(layout,/@media\(max-width:620px\)/);
});
