import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const polish=readFileSync(new URL("../src/reader-polish.css",import.meta.url),"utf8");
const base=readFileSync(new URL("../src/style.css",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");

test("mobile shell no longer stretches main and keeps only a single bottom-nav reservation",()=>{
  assert.match(base,/main\{[^}]*flex:1/);
  assert.match(polish,/\.shell\s*>\s*main\s*\{[^}]*flex:0 0 auto!important/s);
  assert.match(polish,/\.shell\s*\{[^}]*min-height:0!important/s);
  assert.match(polish,/padding-bottom:calc\(76px \+ env\(safe-area-inset-bottom, 0px\)\)!important/);
  assert.match(polish,/\.shell\s*>\s*main\s*\{[^}]*padding-bottom:12px!important/s);
  assert.match(polish,/\.shell\s*>\s*footer\s*\{[^}]*margin:0!important/s);
});

test("mobile footer follows content while the navigation stays fixed",()=>{
  assert.match(app,/return <div className="shell">/);
  assert.match(app,/<main>/);
  assert.match(app,/<footer>© WonderTale AI<\/footer>/);
  assert.match(polish,/\.shell \.mobile-tabbar\{[^}]*position:fixed!important/s);
  assert.match(polish,/\.reader-page \.pager\{margin-bottom:4px!important\}/);
});

test("print layout does not inherit mobile reserved space",()=>{
  assert.match(polish,/@media print\{\s*\.shell\{min-height:0!important;padding-bottom:0!important\}/);
});
