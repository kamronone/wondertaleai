import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const src=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/create-concept-four.css",import.meta.url),"utf8");
const render=src.slice(src.indexOf('{tab==="create"&&<section'),src.indexOf('{tab==="legal"&&<LegalCenter'));

test("selected concept four is imported after earlier wizard styles",()=>{
 const imports=src.slice(0,src.indexOf("type Page="));
 assert.match(imports,/import "\.\/create-concept-four\.css";/);
 assert.ok(imports.indexOf('create-concept-four.css')>imports.indexOf('create-reference.css'));
});

test("first step focuses on child profile and avatar without duplicated story controls",()=>{
 const first=render.slice(render.indexOf('{createStep===1&&'),render.indexOf('{createStep===2&&'));
 const second=render.slice(render.indexOf('{createStep===2&&'),render.indexOf('{createStep===3&&'));
 assert.match(first,/className="form-grid"/);
 assert.match(first,/className="create-hero-options"/);
 assert.match(first,/aria-pressed=\{heroKind===kind\}/);
 assert.doesNotMatch(first,/className="create-v4-idea"/);
 assert.doesNotMatch(first,/className="create-v4-worlds"/);
 assert.doesNotMatch(first,/className="create-v4-summary"/);
 assert.match(second,/className="wizard-step-two-worlds"/);
 assert.match(second,/className="wizard-step-two-prompt"/);
});

test("preserves guided generation and parental consents",()=>{
 assert.match(render,/setCreateStep\(2\)/);
 assert.match(render,/setCreateStep\(3\)/);
 assert.match(render,/onSubmit=\{generate\}/);
 assert.match(render,/checked=\{consent\}/);
 assert.match(render,/checked=\{acceptedLegal\}/);
 assert.doesNotMatch(render,/className="create-reference-reading-link"/);
});

test("mobile design matches compact concept four navigation and controls",()=>{
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)!important/);
 assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
 assert.match(css,/\.wizard-step-one-next\s*\{[\s\S]*?width:100%!important/);
 assert.match(css,/\.wt-build-debug\{display:none!important\}/);
 assert.match(css,/\.site-legal-footer\{display:none!important\}/);
});
