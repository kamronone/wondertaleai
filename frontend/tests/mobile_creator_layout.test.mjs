import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const css = await readFile(new URL("../src/reader-polish.css", import.meta.url), "utf8");
const theme = await readFile(new URL("../src/storybook-theme.css", import.meta.url), "utf8");
const app = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");

test("Mobile wizard explicitly resets checkbox sizes after full-width input rules", () => {
  assert.match(theme, /\.create-page \.form-card input:not\(\[type=file\]\)/);
  assert.match(css, /\.create-page \.form-card input\[type="checkbox"\]\s*\{/);
  assert.match(css, /flex:0 0 20px/);
  assert.match(css, /width:20px;/);
  assert.match(css, /min-height:20px;/);
});

test("Consent and device-save copy may wrap without expanding the checkbox", () => {
  assert.match(css, /\.create-page \.form-card \.consent>span,[\s\S]*?overflow-wrap:anywhere/);
  assert.match(app, /className="device-save-option"/);
  assert.match(app, /className="consent"/);
});

test("Wizard buttons remain equal-height and readable at narrow widths", () => {
  assert.match(css, /\.create-page \.wizard-step-actions\s*\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.create-page \.wizard-step-actions>button\s*\{width:100%;min-width:0;min-height:44px/);
  assert.match(css, /\.create-page \.wizard-step-actions>button:only-child\{grid-column:2\}/);
});

test("Story choice stays horizontally scrollable and language buttons fit three columns", () => {
  assert.match(css, /\.create-page \.classic-choice,[\s\S]*?flex-wrap:nowrap;/);
  assert.match(css, /overflow-x:auto;/);
  assert.match(css, /\.create-page \.story-lang-options\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});
