import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/classic_page_art.ts", import.meta.url), "utf8");

test("only complete bundled story sets use PNGs", () => {
  assert.match(source, /const bundledPngIds = new Set\(\["red-hood","cinderella","three-pigs"\]\)/);
  assert.match(source, /if\(!bundledPngIds\.has\(classicId\)\)return classicPageArtwork\(classicId,pageIndex,pageText\)/);
});

test("old auto-generated page URLs can migrate to local SVGs", () => {
  assert.match(source, /const oldGeneratedPage=imageUrl===generatedPage/);
  assert.match(source, /!oldGeneratedPage&&imageUrl\.trim\(\)!==""/);
});

test("private uploads and custom illustrations keep precedence", () => {
  assert.match(source, /if\(!oldAsset&&!oldRedHood&&!oldDemoVector&&!oldGeneratedPage&&imageUrl\.trim\(\)!==""\)return imageUrl/);
  assert.match(source, /if\(!classicId\|\|!ids\.has\(classicId\)\)return imageUrl/);
});
