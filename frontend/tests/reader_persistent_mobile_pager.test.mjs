import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const mobile=readFileSync(new URL("../src/reader-mobile-v1.css",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const art=readFileSync(new URL("../src/reader-image-fullwidth.css",import.meta.url),"utf8");

test("mobile reader paging is always available above the app navigation",()=>{
  assert.match(mobile,/\.reader-page \.pager\{\s*position:fixed!important;/);
  assert.match(mobile,/bottom:calc\(70px \+ env\(safe-area-inset-bottom, 0px\)\)!important/);
  assert.match(mobile,/z-index:75!important/);
  assert.match(mobile,/\.shell > main > \.reader-page\{\s*padding-bottom:78px!important;/);
  assert.match(app,/<div className="pager"><button disabled=\{page===0\}/);
});

test("mobile page actions remain accessible and do not hide the counter",()=>{
  assert.match(mobile,/\.reader-page \.pager>button\{\s*min-height:44px!important;/);
  assert.match(mobile,/\.reader-page \.pager-indicators \.pager-current\{\s*display:none!important;/);
  assert.match(app,/className="pager-mobile-current" aria-live="polite"/);
});

test("mobile artwork is shorter but always contained instead of cropped",()=>{
  assert.match(mobile,/height:clamp\(180px,30svh,270px\)!important/);
  assert.match(art,/object-fit:contain!important/);
  assert.match(mobile,/@media print\{\s*\.reader-page \.pager\{\s*position:static!important;/);
});
