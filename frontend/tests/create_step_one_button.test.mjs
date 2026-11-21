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
