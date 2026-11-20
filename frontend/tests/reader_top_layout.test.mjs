import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/reader-polish.css",import.meta.url),"utf8");

test("book owner and saved marker share one compact row",()=>{
  assert.match(app,/className="reader-title"><div className="reader-book-meta"/);
  assert.match(app,/className="reader-child-label"/);
  assert.match(css,/\.reader-page \.reader-book-meta\{/);
  assert.match(css,/\.reader-page \.reader-book-meta \.reader-saved-tag\{/);
});

test("reader actions form two balanced buttons on iPhone",()=>{
  assert.match(css,/\.reader-page \.reader-mode-controls\s*\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/s);
  assert.match(css,/\.reader-page \.reader-mode-controls > button\s*\{[^}]*min-height:44px/s);
  assert.match(app,/aria-expanded=\{readerSettingsOpen\} aria-controls="reader-display-options"/);
});

test("bedtime choices remain available without an oversized separate card",()=>{
  assert.match(css,/\.reader-page \.bedtime-controls\s*\{[^}]*grid-template-columns:minmax\(0,1fr\) auto auto/s);
  assert.match(css,/\.reader-page \.bedtime-controls > button\s*\{[^}]*min-height:44px/s);
  assert.match(app,/className="bedtime-controls"/);
  assert.match(app,/setBedtimeUntil\(Date\.now\(\)\+minutes\*60000\)/);
});

test("reader title spacing is independent from scroll-safe bottom navigation",()=>{
  assert.match(css,/\.reader-page \.reader-title\s*\{[^}]*margin:5px 0 12px/s);
  assert.match(css,/\.shell > main > \.reader-page\s*\{[^}]*padding-bottom:8px!important/s);
});
