import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const main=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/create-round-progress.css",import.meta.url),"utf8");

test("circular navigation is rendered on all wizard steps",()=>{
 assert.match(main,/import "\.\/create-round-progress\.css";/);
 assert.match(main,/<nav className="wizard-progress wizard-progress-round"/);
 assert.match(main,/\(\[1,2,3\] as const\)\.map/);
 assert.match(main,/className="wizard-progress-circle"/);
 assert.match(main,/className="wizard-progress-label"/);
 assert.match(main,/aria-current=\{createStep===step\?"step":undefined\}/);
});

test("navigation only allows returning to previously completed steps",()=>{
 assert.match(main,/disabled=\{step>=createStep\}/);
 assert.ok(main.includes('onClick={()=>{setError("");setCreateStep(step);}}'));
 assert.match(main,/if\(!name\.trim\(\)\)/);
 assert.match(main,/if\(prompt\.trim\(\)\.length<8\)/);
});

test("wizard indicator is constrained to phone width with proper circles",()=>{
 assert.match(css,/\.wizard-progress\.wizard-progress-round\{/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) 28px minmax\(0,1fr\) 28px minmax\(0,1fr\)/);
 assert.match(css,/\.wizard-progress-circle\{/);
 assert.match(css,/border-radius:50%/);
 assert.match(css,/@media\(max-width:620px\)/);
 assert.match(css,/font-size:clamp\(9px,2\.55vw,11px\)/);
});
