import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/create-step-two.css",import.meta.url),"utf8");

test("second story wizard uses its own compact layout without affecting step one",()=>{
 assert.match(app,/import "\.\/create-step-two\.css"/);
 assert.match(app,/\{createStep===2&&<div className="wizard-step-two">/);
 assert.match(app,/className="wizard-step-two-section-label"/);
 assert.match(app,/className="wizard-step-two-prompt"/);
 assert.match(css,/\.wizard-step-two \.classic-choice/);
 assert.match(css,/@media\(max-width:620px\)/);
});

test("existing story selection, presets and custom plot interactions remain wired",()=>{
 assert.match(app,/setClassicId\(item\.id\);setThemeIndex\(item\.themeIndex\);setPrompt\(item\.prompt\[storyLang\]\)/);
 assert.match(app,/setThemeIndex\(i\)/);
 assert.match(app,/setPrompt\(preset\.idea\)/);
 assert.match(app,/setPrompt\(next\)/);
 assert.match(app,/minLength=\{8\} maxLength=\{1200\} rows=\{3\}/);
 assert.match(app,/if\(prompt\.trim\(\)\.length<8\)/);
 assert.match(app,/setCreateStep\(3\)/);
});

test("language and illustration style remain accessible in expanded options",()=>{
 assert.match(app,/className="wizard-step-two-options"/);
 assert.match(app,/className="wizard-step-two-options-content"/);
 assert.match(app,/setStyleIndex\(Number\(e\.target\.value\)\)/);
 assert.match(app,/changeStoryLanguage\(l\.id\)/);
 assert.match(css,/\.wizard-step-two-options>summary/);
});

test("mobile topic choices fit without clipping and action buttons have equal heights",()=>{
 assert.match(css,/\.wizard-step-two \.classic-choice\{[^}]*overflow-x:auto/s);
 assert.match(css,/\.wizard-step-two \.chips\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/s);
 assert.match(css,/\.wizard-step-two \.chips\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/s);
 assert.match(css,/\.wizard-step-two>\.wizard-step-actions>button\{[^}]*min-height:45px/s);
 assert.match(css,/@media\(max-width:360px\)/);
});

test("step two Orqaga and Keyingi always fit side by side on an iPhone",()=>{
 const scoped=css.slice(css.lastIndexOf("/* iPhone overflow correction:"));
 assert.match(scoped,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
 assert.match(scoped,/\.wizard-step-actions > \.primary-button/);
 assert.match(scoped,/\.wizard-step-actions > \.secondary-button/);
 assert.match(scoped,/min-width:0!important/);
 assert.match(scoped,/max-width:100%!important/);
 assert.match(scoped,/height:44px!important/);
 assert.match(scoped,/@media\(max-width:360px\)/);
 assert.match(app,/onClick=\{\(\)=>setCreateStep\(1\)\}/);
 assert.match(app,/setCreateStep\(3\)/);
});
