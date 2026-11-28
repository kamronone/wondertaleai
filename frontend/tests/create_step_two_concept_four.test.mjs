import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const main=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/create-step-two-concept-four.css",import.meta.url),"utf8");
const block=main.slice(main.indexOf('{createStep===2&&'),main.indexOf('{createStep===3&&'));

test("approved concept-four second-step styles load after previous wizard styles",()=>{
 const earlier=main.indexOf('import "./create-step-two.css";');
 const later=main.indexOf('import "./create-step-two-concept-four.css";');
 assert.ok(earlier>=0&&later>earlier);
 assert.match(block,/className="wizard-step-two wizard-step-two-v4"/);
});
test("world selections have illustrated labels, accessible selected state and unchanged theme choice",()=>{
 assert.match(block,/className="wizard-step-two-worlds"/);
 assert.match(block,/role="group" aria-label=\{t.world\}/);
 assert.match(block,/aria-pressed=\{themeIndex===i\}/);
 assert.match(block,/onClick=\{\(\)=>setThemeIndex\(i\)\}/);
 assert.match(block,/className="world-scene-icon" aria-hidden="true"/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
});
test("story choice, prompt and next step remain functional",()=>{
 assert.match(block,/setClassicId\(item.id\);setThemeIndex\(item.themeIndex\);setPrompt\(item.prompt\[storyLang\]\)/);
 assert.match(block,/onClick=\{\(\)=>\{setClassicId\(null\);setPrompt\(preset.idea\)/);
 assert.match(block,/value=\{prompt\}/);
 assert.match(block,/maxLength=\{1200\}/);
 assert.match(block,/prompt.trim\(\).length<8/);
 assert.match(block,/setCreateStep\(3\)/);
 assert.match(block,/className="wizard-step-two-options"/);
});
test("bottom actions retain compact comfortable iPhone dimensions",()=>{
 assert.match(css,/\.wizard-step-two-v4>\.wizard-step-actions>button\s*\{/);
 assert.match(css,/min-height:46px!important/);
});
