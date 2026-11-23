import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/create-mobile-final-audit.css",import.meta.url),"utf8");

test("final stylesheet overrides narrow five-column hero layout",()=>{
 const final=app.indexOf('import "./create-mobile-final-audit.css";');
 assert.ok(final>app.indexOf('import "./create-concept-four.css";'));
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
 assert.match(css,/\.create-hero-option>span\s*\{[\s\S]*?font-size:clamp\(11px,3vw,13px\)!important/);
 assert.match(css,/white-space:normal!important/);
});
test("all six actual PNG heroes remain selectable without overflow",()=>{
 const first=app.slice(app.indexOf('{createStep===1&&'),app.indexOf('{createStep===2&&'));
 assert.match(first,/\["boy","girl","animal","robot","magical","superhero"\] as const/);
 assert.match(first,/aria-pressed=\{heroKind===kind\}/);
 assert.match(first,/onClick=\{\(\)=>setHeroKind\(kind\)\}/);
 assert.match(css,/\.create-hero-options\s*\{[\s\S]*?overflow:visible!important/);
 assert.match(css,/@media screen and \(max-width:360px\)/);
});
