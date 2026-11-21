import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/reader-book-variants.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");

test("all four book themes honor the selected reader font size", () => {
  const selector = ".reader-page .story-page:is(.book-style-spread,.book-style-classic,.book-style-storybook,.book-style-simple)";
  const sizes = {small:14,normal:16,large:20};
  for (const [name,size] of Object.entries(sizes)) {
    const rule = css.slice(css.indexOf(selector + ".reader-font-" + name + " .story-text"));
    assert.ok(rule.startsWith(selector + ".reader-font-" + name + " .story-text"), "Missing explicit theme font override for " + name);
    assert.match(rule.split("}")[0], new RegExp("font-size:" + size + "px!important"));
  }
});

test("reader keeps its existing font scale and book appearance controls", () => {
  assert.match(app, /reader-font-["']\+readerFontScale/);
  assert.match(app, /book-style-["']\+readerBookStyle/);
});
