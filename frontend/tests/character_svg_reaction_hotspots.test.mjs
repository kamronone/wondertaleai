import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const hotspot=readFileSync(new URL("../src/CharacterHotspot.tsx",import.meta.url),"utf8");

test("hotspots position on an inline SVG when story PNG is unavailable",()=>{
  assert.match(hotspot,/svg\.story-image-fallback/);
  assert.match(hotspot,/if\(!media\)return null/);
  assert.match(hotspot,/media\.getBoundingClientRect\(\)/);
});

test("cover-cropped classic artwork uses visible rectangle for hotspots",()=>{
  assert.match(hotspot,/getComputedStyle\(media\)\.objectFit/);
  assert.match(hotspot,/fit!=="cover"/);
  assert.match(hotspot,/media instanceof HTMLImageElement/);
});

test("hotspots update if the primary image is replaced with SVG fallback",()=>{
  assert.match(hotspot,/new MutationObserver\(update\)/);
  assert.match(hotspot,/mediaObserver\?\.observe\(stage,\{childList:true,subtree:true\}\)/);
  assert.match(hotspot,/mediaObserver\?\.disconnect\(\)/);
});

test("hotspot interactions do not navigate between story pages",()=>{
  assert.match(hotspot,/onClick=\{event=>\{event\.stopPropagation\(\);setVisibleReaction/);
  assert.doesNotMatch(hotspot,/setPage\(|nextReaderPage\(/);
});
