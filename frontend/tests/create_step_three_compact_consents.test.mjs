import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/create-step-three-concept-one.css",import.meta.url),"utf8");
const third=src.slice(src.indexOf('{createStep===3&&'),src.indexOf('{error&&createStep!==3'));
test("confirmation step has one compact review header and grouped parent decisions",()=>{
 assert.match(third,/className="wizard-step-three-review-header"/);
 assert.match(third,/className="wizard-step-three-consents"/);
 assert.match(third,/className="wizard-step-three-consent-header"/);
 const group=third.slice(third.indexOf('className="wizard-step-three-consents"'),third.indexOf('className="notice wizard-step-three-note"'));
 assert.match(group,/checked=\{saveOnDevice\}/);
 assert.match(group,/checked=\{consent\}/);
 assert.match(group,/checked=\{acceptedLegal\}/);
 assert.match(group,/className="legal-consent-links"/);
 assert.match(group,/openLegal\("terms"\)/);
 assert.match(group,/openLegal\("privacy"\)/);
 assert.match(group,/openLegal\("parents"\)/);
});
test("UI never prechecks consents or bypasses required generation conditions",()=>{
 assert.match(third,/input required type="checkbox" checked=\{consent\}/);
 assert.match(third,/input required type="checkbox" checked=\{acceptedLegal\}/);
 assert.match(third,/disabled=\{busy\|\|!consent\|\|!acceptedLegal\}/);
 assert.match(third,/type="submit"/);
});
test("mobile spacing wins over old large wizard blocks",()=>{
 assert.match(css,/Step 3 compact v2/);
 assert.match(css,/\.wizard-step-three-review-header\s*\{/);
 assert.match(css,/\.wizard-step-three-consents\s*\{/);
 assert.match(css,/\.wizard-step-three-consents>\.consent\s*\{/);
 assert.match(css,/min-height:59px!important/);
 assert.match(css,/\.wizard-step-three-v1>.step-title.next\s*\{/);
});
