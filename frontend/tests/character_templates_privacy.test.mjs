import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const characters=readFileSync(new URL("../src/CharacterBuilder.tsx",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");

test("character templates are opt-in and limited to a single browser tab",()=>{
  assert.match(characters,/sessionStorage\.getItem\(KEY\)/);
  assert.match(characters,/sessionStorage\.setItem\(KEY/);
  assert.doesNotMatch(characters,/localStorage/);
  assert.doesNotMatch(characters,/fetch\s*\(/);
  assert.match(characters,/const MAX = 6/);
});

test("private family sessions cannot view or store anonymous character templates",()=>{
  assert.match(app,/allowSave=\{!privateToken\}/);
  assert.match(app,/key=\{privateToken\?"private":"demo"\}/);
  assert.match(characters,/allowSave=false/);
  assert.match(characters,/allowSave\?readHeroes\(\):\[\]/);
  assert.match(characters,/if\(!allowSave\|\|!safeName/);
});

test("character template name is validated before storing and storage failures are visible",()=>{
  assert.match(characters,/item\.name\.length<=45/);
  assert.match(characters,/safeName\.length>45/);
  assert.match(characters,/catch\{setMessage\(t\.error\);\}/);
  assert.match(characters,/role==="explorer"/);
  assert.match(characters,/role==="guardian"/);
  assert.match(characters,/role==="inventor"/);
});
