import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const css=readFileSync(new URL("../src/reader-concept-four.css",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");

test("reader restores global header while preserving in-reader library navigation",()=>{
  assert.match(css,/\.shell:has\(>main>\.reader-page\) > \.topbar\s*\{\s*display:flex!important/);
  assert.match(css,/\.shell > main > \.reader-page\s*\{\s*padding-bottom:calc\(165px \+ env\(safe-area-inset-bottom, 0px\)\)!important/);
  assert.match(app,/className="reader-toolbar"/);
  assert.match(app,/className="back-button" onClick=\{\(\)=>setTab\("library"\)\}/);
});

test("saved reader font sizes still work in every book appearance",()=>{
  for (const size of ["small","normal","large"]) {
    for (const style of ["spread","classic","storybook","simple"]) {
      assert.ok(css.includes(".reader-page .story-page.reader-font-"+size+".book-style-"+style+" .story-text"),size+" "+style);
    }
  }
});

test("reader still has readable night and warm text cards",()=>{
  assert.match(css,/\.reader-page \.story-page\.reader-night \.story-text\s*\{\s*background:#242132!important;\s*color:#f5ebdc!important/);
  assert.match(css,/\.reader-page \.story-page\.reader-warm \.story-text\s*\{\s*background:#faefd9!important;\s*color:#493321!important/);
});

test("navigation clears text content and respects iPhone home indicator",()=>{
  assert.match(css,/scroll-padding-bottom:calc\(172px \+ env\(safe-area-inset-bottom, 0px\)\)/);
  assert.match(css,/bottom:calc\(74px \+ env\(safe-area-inset-bottom, 0px\)\)!important/);
  assert.match(app,/className="pager-mobile-current" aria-live="polite"/);
});
