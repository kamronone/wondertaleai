import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/reader-book-variants.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");

const rule = (selector, from = 0) => {
  const start = css.indexOf(selector + "{", from);
  assert.notEqual(start, -1, "Missing CSS rule: " + selector);
  return css.slice(start, css.indexOf("}", start) + 1);
};

test("reader uses compact page navigation without the redundant dropdown", () => {
  assert.doesNotMatch(app, /reader-page-jump-select|className="reader-page-jump"/);
  assert.doesNotMatch(css, /\.reader-page-jump/);
  assert.match(app, /className="pager"/);
  assert.match(app, /className="pager-mobile-current"/);
});

test("bedtime summary and action buttons are comfortable touch targets", () => {
  assert.match(rule(".reader-page .reader-bedtime-disclosure>summary"), /min-height:44px;/);
  assert.match(rule(".reader-page .reader-bedtime-disclosure .bedtime-controls>button"), /min-height:44px;/);
  assert.match(rule(".reader-page .reader-bedtime-disclosure>summary", css.indexOf("@media(max-width:620px)", css.indexOf("/* Optional bedtime tools"))), /min-height:44px;/);
});
