import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const scene = read("../src/StorySceneInteraction.tsx");
const brick = read("../src/BrickPassInteraction.tsx");

test("scene actions do not bubble touch gestures or taps into reader navigation", () => {
  assert.match(scene, /onTouchStart=\{event=>event\.stopPropagation\(\)\}/);
  assert.match(scene, /onTouchMove=\{event=>event\.stopPropagation\(\)\}/);
  assert.match(scene, /onTouchEnd=\{event=>event\.stopPropagation\(\)\}/);
  assert.match(scene, /onClick=\{event=>\{event\.stopPropagation\(\);setChoice\(index\);\}\}/);
  assert.match(scene, /role="status" aria-live="polite"/);
});

test("delivering the brick keeps the pig's response visible until the reader navigates manually", () => {
  assert.match(brick, /setDelivered\(true\)/);
  assert.match(brick, /\{delivered&&<div className="wt-brick-speech" role="status" aria-live="polite">/);
  assert.match(brick, /onTouchStartCapture=\{onTouchCapture\}/);
  assert.match(brick, /onTouchEndCapture=\{onTouchCapture\}/);
  assert.doesNotMatch(brick, /setTimeout\(|setInterval\(|setPage\(|nextPage\(|window\.location|navigate\(/);
});
