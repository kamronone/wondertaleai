import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const css=readFileSync(new URL("../src/create-mobile-final-audit.css",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const step2=app.slice(app.indexOf("{createStep===2&&"),app.indexOf("{createStep===3&&"));
const step3=app.slice(app.indexOf("{createStep===3&&"),app.indexOf("{error&&createStep!==3"));

test("step two restores the compact scrollable classic story row",()=>{
  assert.match(css,/\.wizard-step-two-v4 \.classic-choice\s*\{[\s\S]*?display:flex!important/);
  assert.match(css,/\.wizard-step-two-v4 \.classic-choice\s*\{[\s\S]*?overflow-x:auto!important/);
  assert.match(css,/\.wizard-step-two-v4 \.classic-choice>button\s*\{[\s\S]*?flex:0 0 auto!important/);
  assert.match(step2,/className="classic-choice"/);
  assert.match(step2,/setClassicId\(item.id\)/);
  assert.match(step2,/aria-pressed=\{classicId===item.id\}/);
});

test("selection of ready-made books still hides custom world and idea sections",()=>{
  assert.match(step2,/\{!activeClassic&&<>[\s\S]*?className="wizard-step-two-worlds"[\s\S]*?className="story-preset-actions"/);
  assert.match(step2,/className="world-scene-icon"/);
  assert.match(step2,/src=\{worldArt\[i\]\}/);
});

test("step two has equal and readable previous / next buttons at iPhone width",()=>{
  assert.match(css,/\.wizard-step-two-v4>\.wizard-step-actions\s*\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
  assert.match(css,/\.wizard-step-two-v4>\.wizard-step-actions>button\s*\{[\s\S]*?min-height:48px!important/);
  assert.match(step2,/onClick=\{\(\)=>setCreateStep\(1\)\}/);
  assert.match(step2,/setCreateStep\(3\)/);
});

test("step three preserves consent gating and readable primary action",()=>{
  assert.match(css,/\.wizard-step-three-v1>\.wizard-step-three-actions>button\s*\{[\s\S]*?min-height:52px!important/);
  assert.match(css,/font-size:clamp\(11px,3vw,14px\)!important/);
  assert.match(step3,/disabled=\{busy\|\|!consent\|\|!acceptedLegal\}/);
  assert.match(step3,/type="submit"/);
});
