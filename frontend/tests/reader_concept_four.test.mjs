import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/reader-concept-four.css",import.meta.url),"utf8");
const previous=readFileSync(new URL("../src/reader-mobile-v1.css",import.meta.url),"utf8");

test("selected reader style is loaded after existing mobile reader rules",()=>{
  assert.match(app,/import "\.\/reader-mobile-v1\.css";\s*import "\.\/reader-concept-four\.css";/);
  assert.match(css,/@media screen and \(max-width:700px\)/);
  assert.match(css,/\.reader-page \.reader-title h2/);
  assert.match(css,/\.reader-page \.story-page\.book-style-classic \.story-text/);
});
test("illustration is compact and story text has a separate reading card",()=>{
  assert.match(css,/height:clamp\(174px,28svh,255px\)!important/);
  assert.match(css,/object-fit:cover!important/);
  assert.match(css,/font-size:clamp\(16px,4\.2vw,19px\)!important/);
  assert.match(css,/background:rgba\(255,252,246,\.96\)!important/);
});
test("reader has persistent page controls and existing interactive behavior",()=>{
  assert.match(previous,/\.reader-page \.pager\{\s*position:fixed!important/);
  assert.match(css,/\.reader-page \.pager>button:last-child/);
  assert.match(app,/onTouchEnd=\{onReaderTouchEnd\}/);
  assert.match(app,/onClick=\{speakPage\}/);
  assert.match(app,/className="pager-mobile-current" aria-live="polite"/);
});
