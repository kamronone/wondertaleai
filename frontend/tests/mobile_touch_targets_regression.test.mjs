import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const load = name => readFileSync(new URL("../src/" + name, import.meta.url), "utf8");
const creator = load("create-step-two.css");
const stepOne = load("create-step-one-button.css");
const library = load("library-mobile-fixes.css");
const libraryPolish = load("library-final-polish.css");

test("advanced story settings use Safari-safe font size", () => {
  const selector = ".create-reference-page .wizard-step-two-options-content>label select";
  const index = creator.indexOf(selector + "{");
  assert.ok(index >= 0);
  const rule = creator.slice(index, creator.indexOf("}", index));
  assert.match(rule, /font-size:16px;/);
  assert.match(rule, /min-height:44px;/);
});

test("story wizard buttons keep at least 44px touch targets on iPhones", () => {
  for (const selector of [
    ".create-reference-page .wizard-step-two .classic-choice>button",
    ".create-reference-page .wizard-step-two .chips>.chip",
    ".create-reference-page .wizard-step-two .story-preset-actions>button",
    ".create-reference-page .wizard-step-two-options>summary"
  ]) {
    const i = creator.lastIndexOf(selector + "{");
    assert.ok(i >= 0, "Missing rule " + selector);
    const rule = creator.slice(i, creator.indexOf("}", i));
    assert.match(rule, /min-height:44px;/);
  }
  assert.match(stepOne, /@media\(max-width:620px\)[\s\S]*?\.wizard-step-one-next\{[\s\S]*?min-height:44px!important;/);
});

test("library filter chips remain tappable on narrow phones", () => {
  assert.match(library, /\.library-concept-chips > button\{[\s\S]*?min-height:44px!important;/);
  assert.match(library, /@media\(max-width:350px\)[\s\S]*?\.library-concept-chips > button\{[\s\S]*?min-height:44px!important;/);
  assert.match(libraryPolish, /\.library-concept-chips>button\{[\s\S]*?min-height:44px!important;/);
});
