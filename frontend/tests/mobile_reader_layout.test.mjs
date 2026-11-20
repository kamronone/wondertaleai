import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const css = await readFile(new URL("../src/reader-polish.css", import.meta.url), "utf8");
const app = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");

test("Narrow iPhones receive a two-row reader toolbar before actions can overflow", () => {
  assert.match(css, /@media\(max-width:350px\)\s*\{[\s\S]*?\.reader-page \.reader-toolbar\s*\{grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /\.reader-page \.reader-actions \.icon-button\s*\{flex-basis:40px;width:40px;height:44px/);
});

test("Reader page actions and pager have accessible mobile touch targets", () => {
  assert.match(css, /\.reader-page \.reader-actions \.icon-button\s*\{flex:0 0 44px;width:44px;height:44px/);
  assert.match(css, /\.reader-page \.pager>button\s*\{width:100%;min-width:0;min-height:44px/);
  assert.match(app, /<div className="reader-toolbar">/);
  assert.match(app, /<div className="pager">/);
});

test("Long book titles wrap without breaking layout", () => {
  assert.match(css, /\.reader-page \.reader-title h2,[\s\S]*?overflow-wrap:anywhere/);
  assert.match(css, /\.reader-page \.reader-title h2\s*\{font-size:clamp\(20px,5\.6vw,25px\)/);
});
