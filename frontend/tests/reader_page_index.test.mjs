import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const component=readFileSync(new URL("../src/ReaderPageIndex.tsx",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const styles=readFileSync(new URL("../src/bedtime-games.css",import.meta.url),"utf8");

test("page index is collapsed by default and keeps reader page changes in one place",()=>{
  assert.match(component,/useState\(false\)/);
  assert.match(component,/aria-expanded=\{expanded\}/);
  assert.match(component,/onChange\(i\);setExpanded\(false\)/);
  assert.match(app,/onChange=\{setPage\}/);
  assert.match(app,/ReaderPageIndex key=\{active\.id\}/);
});
test("page index never persists private story contents or changes auth",()=>{
  assert.doesNotMatch(component,/fetch\s*\(/);
  assert.doesNotMatch(component,/localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(component,/\.text|image_url/);
  assert.match(component,/Math\.min\(100,Math\.floor\(total\)\)/);
});
test("compact page buttons remain keyboard accessible and hidden in print",()=>{
  assert.match(component,/aria-current=\{i===page\?"page":undefined\}/);
  assert.match(component,/type="button"/);
  assert.match(styles,/reader-index-grid button/);
  assert.match(styles,/@media print\{\.reader-page \.reader-page-index\{display:none!important\}\}/);
});
