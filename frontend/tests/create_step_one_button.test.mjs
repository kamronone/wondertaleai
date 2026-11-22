import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const main=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/create-step-one-button.css",import.meta.url),"utf8");

test("first-step next button has its own centered class and preserved validation",()=>{
 assert.match(main,/import "\.\/create-step-one-button\.css";/);
 assert.match(main,/className="wizard-step-actions wizard-step-one-actions"/);
 assert.match(main,/className="primary-button wizard-step-one-next" onClick=\{\(\)=>\{if\(!name\.trim\(\)\)/);
 assert.match(main,/setCreateStep\(2\)/);
});

test("first-step button cannot grow beyond phone form container",()=>{
 assert.match(css,/\.wizard-step-one-actions\{[^}]*width:100%!important/s);
 assert.match(css,/\.wizard-step-one-actions>\.wizard-step-one-next\{[^}]*flex:0 0 auto!important/s);
 assert.match(css,/\.wizard-step-one-actions>\.wizard-step-one-next\{[^}]*max-width:min\(225px,100%\)!important/s);
 assert.match(css,/@media\(max-width:620px\)/);
 assert.match(css,/width:min\(205px,100%\)!important/);
});

test("creation screen has rounded upper corners beneath the dark header on iPhone",()=>{
 const layout=readFileSync(new URL("../src/create-reference.css",import.meta.url),"utf8");
 assert.match(layout,/\.shell:has\(> main > \.create-page\.create-reference-page\) > main\{/);
 assert.match(layout,/\.shell > main > \.create-page\.create-reference-page\{[\s\S]*?border-radius:32px 32px 0 0/);
 assert.match(layout,/border-radius:29px 29px 0 0!important/);
 assert.doesNotMatch(main,/className="back-button" onClick=\{\(\)=>setTab\("home"\)\}/);
});

test("wizard does not stretch blank space below the Ertak oqish card",()=>{
 const layout=readFileSync(new URL("../src/create-reference.css",import.meta.url),"utf8");
 const compact=layout.slice(layout.lastIndexOf("/* Compact creation page:"));
 assert.match(compact,/main\{[\s\S]*?flex:0 0 auto!important/);
 assert.match(compact,/main\{[\s\S]*?min-height:0!important/);
 assert.match(compact,/padding-bottom:0!important/);
 assert.match(compact,/\.site-legal-footer\{/);
 assert.doesNotMatch(main,/className="create-reference-reading-link"/);
 assert.doesNotMatch(main,/className="create-v4-idea"/);
 assert.match(main,/className="create-hero-options"/);
});
