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

test("page picker does not trigger iOS Safari focus autozoom", () => {
  const selector = ".reader-page .reader-page-jump>select";
  const base = rule(selector);
  const mobile = rule(selector, css.indexOf("@media(max-width:620px)"));
  for (const entry of [base, mobile]) {
    assert.match(entry, /font-size:16px;/);
    assert.match(entry, /min-height:44px;/);
  }
  assert.match(app, /<label htmlFor="reader-page-jump-select">/);
  assert.match(app, /<select id="reader-page-jump-select"/);
});

test("bedtime summary and action buttons are comfortable touch targets", () => {
  assert.match(rule(".reader-page .reader-bedtime-disclosure>summary"), /min-height:44px;/);
  assert.match(rule(".reader-page .reader-bedtime-disclosure .bedtime-controls>button"), /min-height:44px;/);
  assert.match(rule(".reader-page .reader-bedtime-disclosure>summary", css.indexOf("@media(max-width:620px)", css.indexOf("/* Optional bedtime tools"))), /min-height:44px;/);
});
