import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const css=readFileSync(new URL("../src/reader-pager-no-overlap.css",import.meta.url),"utf8");
const main=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");

test("mobile reader page controls follow text instead of floating over it",()=>{
 assert.match(main,/import "\.\/reader-pager-no-overlap\.css";/);
 assert.match(css,/\.reader-page \.pager[\s\S]*?position:relative!important/);
 assert.match(css,/bottom:auto!important/);
 assert.match(css,/transform:none!important/);
 assert.match(css,/\.story-page \.story-text\{[\s\S]*?overflow:visible!important/);
 assert.match(css,/env\(safe-area-inset-bottom,0px\)/);
 assert.doesNotMatch(css,/position:fixed!important/);
});

test("print hides navigation controls",()=>{
 assert.match(css,/@media print\{[\s\S]*?\.reader-page \.pager\{display:none!important/);
});
