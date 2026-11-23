// Release audit for all built-in story illustrations.
// PNG-only coverage is separate from the availability of page-specific SVG fallbacks.
import test from "node:test";
import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const src = (file) => readFileSync(resolve(root, "src", file), "utf8");
const catalog = src("classics.ts");
const artwork = src("classic_page_art.ts");
const vite = readFileSync(resolve(root, "vite.config.ts"), "utf8");
const allIds = [...catalog.matchAll(/(?:\bid:|"id":)\s*"([^"]+)"/g)].map((match) => match[1]);
const requiredPng = ["red-hood", "cinderella", "three-pigs", "rapunzel"];

test("all 30 built-in classic books are represented uniquely", () => {
  assert.equal(allIds.length, 30);
  assert.equal(new Set(allIds).size, allIds.length);
});

test("every built-in book has a deterministic, page-specific offline illustration fallback", () => {
  assert.match(artwork, /export function classicPageArtwork\(/);
  assert.match(artwork, /classicStoryMotif\(id,page\)\|\|remainingClassicMotif\(id,page\)/);
  assert.match(artwork, /classicPageSceneDetail\(classicId,page,pageText\)/);
  assert.match(artwork, /if\(!item\)return ""/);
  for (const id of requiredPng) assert.ok(allIds.includes(id));
});

test("the 32 committed PNG paths are not confused with complete coverage of 30 stories", () => {
  for (const id of requiredPng) {
    for (let page = 1; page <= 8; page++) {
      const path = resolve(root, "public/images/classics", id, "pages", `page-${page}.png`);
      assert.ok(existsSync(path), `missing original PNG: ${id}, page ${page}`);
    }
  }
  assert.match(artwork, /if\(!bundledPngIds\.has\(classicId\)\)return classicPageArtwork/);
  assert.match(artwork, /return match&&ids\.has\(match\[1\]\)\?classicPageArtwork/);
  assert.match(vite, /rapunzelPngComplete/);
});

test("custom and private images retain priority over bundled artwork", () => {
  assert.match(artwork, /if\(!classicId\|\|!ids\.has\(classicId\)\)return imageUrl/);
  assert.match(artwork, /imageUrl\.trim\(\)!==""\)return imageUrl/);
  assert.match(artwork, /if\(imageUrl!==expected\)return null/);
});
