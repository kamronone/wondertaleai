import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const app = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../src/reader-polish.css", import.meta.url), "utf8");

test("Story language buttons announce selection to assistive technology", () => {
  assert.match(app, /className="story-lang-options" role="group" aria-label=\{t\.storyLanguage\}/);
  assert.match(app, /aria-pressed=\{storyLang===l\.id\}/);
});

test("Demo and AI mode are accessible two-choice controls", () => {
  assert.match(app, /className="story-lang-options creator-mode-options"/);
  assert.match(app, /aria-pressed=\{!usePersonalAi\}/);
  assert.match(app, /aria-pressed=\{usePersonalAi\}/);
  assert.match(css, /\.create-page \.creator-mode-options\s*\{\s*display:grid;\s*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test("Classic story selection is announced instead of conveyed only by color", () => {
  assert.match(app, /className="classic-choice" role="group"/);
  assert.match(app, /aria-pressed=\{!classicId\}/);
  assert.match(app, /aria-pressed=\{classicId===item\.id\}/);
});
