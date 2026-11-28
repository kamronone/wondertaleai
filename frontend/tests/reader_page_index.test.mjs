import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");

test("reader no longer displays redundant all-pages picker",()=>{
  assert.doesNotMatch(app,/import\s*\{\s*ReaderPageIndex\s*\}/);
  assert.doesNotMatch(app,/<ReaderPageIndex\b/);
});

test("reader keeps primary back/next controls and current-page indicator",()=>{
  assert.match(app,/className="pager"/);
  assert.match(app,/className="pager-mobile-current"/);
  assert.match(app,/nextReaderPage\(/);
});
