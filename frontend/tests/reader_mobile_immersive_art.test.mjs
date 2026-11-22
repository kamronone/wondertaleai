import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const css=readFileSync(new URL("../src/reader-concept-four.css",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");

test("reader uses bottom library navigation instead of a duplicate top button",()=>{
  assert.match(css,/\.shell:has\(>main>\.reader-page\) \.mobile-tabbar\s*\{\s*display:flex!important/);
  assert.match(css,/bottom:calc\(78px \+ env\(safe-area-inset-bottom, 0px\)\)!important/);
  assert.doesNotMatch(app,/className="back-button" onClick=\{\(\)=>setTab\("library"\)\}/);
  assert.match(app,/className="mobile-tabbar"[\s\S]*?onClick=\{\(\)=>setTab\("library"\)\}/);
});
test("portrait illustrations can expand to an uncropped view",()=>{
  assert.match(app,/const \[readerImageExpanded,setReaderImageExpanded\]=useState\(false\)/);
  assert.match(app,/useEffect\(\(\)=>setReaderImageExpanded\(false\),\[active\?\.id,page\]\)/);
  assert.match(app,/className="reader-art-zoom" aria-pressed=\{readerImageExpanded\}/);
  assert.match(css,/\.story-page-image\.reader-image-expanded img/);
  assert.match(css,/object-fit:contain!important/);
});
test("picture zoom control is accessible and not printed",()=>{
  assert.match(css,/\.reader-art-zoom\s*\{[\s\S]*?width:44px;\s*height:44px/);
  assert.match(css,/@media print\s*\{\s*\.reader-page \.reader-art-zoom \{display:none!important\}/);
});
