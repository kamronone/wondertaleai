import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");

test("all five hero types retain dedicated PNG paths and readable labels",()=>{
 const app=read("../src/main.tsx");
 assert.match(app,/\["boy","girl","animal","robot","magical"\]/);
 assert.match(app,/\{boy:"boy",girl:"girl",animal:"fox",robot:"robot",magical:"dragon"\}/);
 assert.match(app,/create-hero-option/);
 assert.match(app,/className=\{"create-hero-option"\+/);
});

test("hero portrait styles are imported after earlier mobile overrides",()=>{
 const app=read("../src/main.tsx");
 const mobile=app.indexOf('import "./create-mobile-final-audit.css";');
 const portrait=app.indexOf('import "./create-hero-art-final.css";');
 assert.ok(mobile>=0&&portrait>mobile);
 const css=read("../src/create-hero-art-final.css");
 assert.match(css,/\.create-hero-option img\{/);
 assert.match(css,/object-fit:contain!important/);
 assert.match(css,/object-position:center bottom!important/);
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
 assert.match(css,/@media screen and \(max-width:360px\)/);
});
