import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const app = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");

test("Alternate endings have a localized accessible group label", () => {
  assert.match(app, /className="interactive-endings"><strong>\{t\.interactiveEnding\}<\/strong>/);
  assert.match(app, /role="group" aria-label=\{t\.interactiveEnding\}/);
});

test("The chosen ending is announced as a pressed button", () => {
  assert.match(app, /aria-pressed=\{active\.endingChoice===id\}/);
  assert.match(app, /onClick=\{\(\)=>selectEnding\(id\)\}/);
});

test("Ending selection remains limited to the final page of local books", () => {
  assert.match(app, /isDemoBook\(active\)&&page===active\.pages\.length-1&&<div className="interactive-endings"/);
});
