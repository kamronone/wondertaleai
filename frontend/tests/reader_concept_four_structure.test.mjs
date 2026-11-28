import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const css=readFileSync(new URL("../src/reader-concept-four.css",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");

test("story appears before secondary controls in mobile reader",()=>{
  assert.match(css,/display:flex!important;\s*flex-direction:column!important/);
  assert.match(css,/\.reader-page \.reader-title\s*\{\s*order:1;/);
  assert.match(css,/\.reader-page \.story-page\s*\{\s*order:2;/);
  assert.match(css,/\.reader-page \.reader-audio-toolbar\s*\{\s*order:3;/);
  assert.match(css,/\.reader-page \.reader-mode-controls\s*\{\s*order:4;/);
  assert.match(css,/\.reader-page \.reader-bedtime-disclosure\s*\{order:7;/);
});
test("narration and page turning remain available",()=>{
  assert.match(app,/onClick=\{speakPage\}/);
  assert.match(app,/className="pager-mobile-current"/);
  assert.match(css,/\.reader-page \.pager \{/);
});
