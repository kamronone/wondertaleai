import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const css=readFileSync(new URL("../src/reader-concept-four.css",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const finalRules=css.split("/* User-approved reader header and balanced iPhone page controls.")[1];

test("WonderTale header is visible again in the phone reader",()=>{
  assert.ok(finalRules);
  assert.match(finalRules,/\.shell:has\(>main>\.reader-page\) > \.topbar\s*\{\s*display:flex!important/);
  assert.match(app,/className="topbar"/);
});

test("pager has equal-width buttons and a centered compact count",()=>{
  assert.match(finalRules,/grid-template-columns:minmax\(0,1fr\) 48px minmax\(0,1fr\)!important/);
  assert.match(finalRules,/\.reader-page \.pager > button\s*\{[\s\S]*?width:100%!important;/);
  assert.match(finalRules,/\.reader-page \.pager-indicators\s*\{[\s\S]*?width:48px!important/);
  assert.match(finalRules,/\.reader-page \.pager-mobile-current\s*\{[\s\S]*?text-align:center!important/);
  assert.match(app,/className="pager-mobile-current" aria-live="polite"/);
});

test("buttons stay large enough for touch without covering the page count",()=>{
  assert.match(finalRules,/min-height:48px!important/);
  assert.match(finalRules,/bottom:calc\(10px \+ env\(safe-area-inset-bottom, 0px\)\)!important/);
  assert.match(finalRules,/font-size:clamp\(12px,3\.5vw,14px\)!important/);
});
