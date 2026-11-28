import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const app = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../src/reader-polish.css", import.meta.url), "utf8");

test("The hero name limit is checked before leaving wizard step one", () => {
  assert.match(app, /const combinedHeroName=secondHero\.trim\(\)\?/);
  assert.match(app, /const heroNameTooLong=combinedHeroName\.length>60/);
  assert.match(app, /if\(heroNameTooLong\)\{setError\(heroNameLengthError\);return;\}/);
});

test("The wizard shows an accessible message by the second hero field", () => {
  assert.match(app, /aria-invalid=\{heroNameTooLong\}/);
  assert.match(app, /aria-describedby=\{heroNameTooLong\?"hero-name-limit":undefined\}/);
  assert.match(app, /id="hero-name-limit" role="status"/);
  assert.match(css, /\.create-page \.wizard-inline-error\{/);
  assert.match(css, /input\[aria-invalid="true"\]/);
});

test("Final validation remains in place for changing values after step one", () => {
  assert.match(app, /if\(!usePersonalAi&&heroNameTooLong\)\{/);
  assert.match(app, /setCreateStep\(1\);\s*setError\(heroNameLengthError\)/);
  assert.match(app, /const heroes=combinedHeroName/);
});
