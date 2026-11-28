import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const css=readFileSync(new URL("../src/reader-concept-four.css",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const cleanup=css.split("/* Reader-only footer / safe-area cleanup.")[1];

test("reader does not stack bottom spacers from shell and main",()=>{
  assert.ok(cleanup);
  assert.match(cleanup,/\.shell:has\(>main>\.reader-page\)\s*\{[\s\S]*?padding-bottom:0!important/);
  assert.match(cleanup,/\.shell:has\(>main>\.reader-page\) > main\s*\{[\s\S]*?padding-bottom:0!important/);
  assert.match(cleanup,/\.shell > main > \.reader-page\s*\{[\s\S]*?padding-bottom:calc\(86px \+ env\(safe-area-inset-bottom, 0px\)\)!important/);
});

test("reader hides only global legal footer, not other screens",()=>{
  assert.match(cleanup,/\.shell:has\(>main>\.reader-page\) > \.site-legal-footer\s*\{\s*display:none!important/);
  assert.match(app,/className="site-legal-footer"/);
  assert.doesNotMatch(cleanup,/\.shell > \.site-legal-footer\s*\{\s*display:none/);
});

test("pager remains accessible while reader content may scroll beneath it",()=>{
  assert.match(cleanup,/scroll-padding-bottom:calc\(86px \+ env\(safe-area-inset-bottom, 0px\)\)!important/);
  assert.match(css,/grid-template-columns:minmax\(0,1fr\) 48px minmax\(0,1fr\)!important/);
});
