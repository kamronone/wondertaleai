import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const scene=readFileSync(new URL("../src/BrickPassInteraction.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/brick-pass-interaction.css",import.meta.url),"utf8");
const brick=readFileSync(new URL("../public/images/story-brick.svg",import.meta.url),"utf8");

test("brick uses a unique textured SVG asset instead of emoji",()=>{
 assert.match(brick,/<svg /);
 assert.match(brick,/linearGradient/);
 assert.match(brick,/feTurbulence/);
 assert.match(scene,/const brickImage="\/images\/story-brick\.svg"/);
 assert.match(scene,/<img src=\{brickImage\}/);
 assert.doesNotMatch(scene,/\<span aria-hidden="true">🧱/);
 assert.match(css,/\.wt-brick-image\s*\{/);
});
test("handing brick shows persistent speech bubble without navigating",()=>{
 assert.match(scene,/className="wt-brick-speech" role="status" aria-live="polite"/);
 assert.match(scene,/Rahmat! Endi uyimiz yanada mustahkam bo‘ladi!/);
 assert.match(scene,/setDelivered\(true\)/);
 assert.doesNotMatch(scene,/setPage\(|onNextPage|setTimeout\(/);
 assert.match(app,/key=\{active\.id\+"\:"\+page\}/);
 assert.match(css,/\.wt-brick-speech\s*\{/);
});
test("brick gestures never trigger page swipe or narration auto-next",()=>{
 assert.match(scene,/onTouchStartCapture=\{onTouchCapture\}/);
 assert.match(scene,/onTouchMoveCapture=\{onTouchCapture\}/);
 assert.match(scene,/onTouchEndCapture=\{onTouchCapture\}/);
 assert.match(scene,/event\.stopPropagation\(\)/);
 assert.match(app,/event\.target\.closest\("\.wt-brick-item, \.wt-gift-item"\)/);
 assert.match(app,/readerAutoNext&&tab==="reader"&&page<active\.pages\.length-1&&!\(isDemoBook\(active\)/);
});
