import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const css=readFileSync(new URL("../src/create-mobile-final-audit.css",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");

test("all six hero cards use a uniform image region and bottom caption",()=>{
  assert.match(app,/\["boy","girl","animal","robot","magical","superhero"\]/);
  assert.match(css,/Hero artwork alignment:/);
  assert.match(css,/grid-auto-rows:1fr/);
  assert.match(css,/grid-template-rows:minmax\(0,1fr\) minmax\(34px,auto\)/);
  assert.match(css,/object-fit:contain!important/);
  assert.match(css,/object-position:center center!important/);
  assert.match(css,/min-height:34px!important/);
  assert.match(css,/align-self:end!important/);
});

test("narrow iPhone hero cards retain matching artwork sizes",()=>{
  assert.match(css,/@media screen and \(max-width:360px\)/);
  assert.match(css,/max-width:100px!important/);
  assert.match(css,/height:82px!important/);
  assert.match(css,/min-height:82px!important/);
});
