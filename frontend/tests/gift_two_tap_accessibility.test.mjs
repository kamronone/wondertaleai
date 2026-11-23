import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const scene=readFileSync(new URL("../src/StoryGiftInteraction.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/story-gift-interaction.css",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");

test("child can tap an original illustrated gift, then tap the highlighted target",()=>{
 assert.match(scene,/const \[selected,setSelected\]=useState\(false\)/);
 assert.match(scene,/setSelected\(value=>!value\)/);
 assert.match(scene,/className=\{"wt-gift-target"\+\(selected\?" is-selected":""\)\}/);
 assert.match(scene,/role=\{selected&&!delivered\?"button":undefined\}/);
 assert.match(scene,/onClick=\{event=>\{if\(!selected\|\|delivered\)return;event\.preventDefault\(\);event\.stopPropagation\(\);finish\(\);\}\}/);
 assert.match(scene,/Tap the glowing target/);
});

test("tapping a target is keyboard accessible and resets after delivery or page change",()=>{
 assert.match(scene,/tabIndex=\{selected&&!delivered\?0:undefined\}/);
 assert.match(scene,/aria-pressed=\{selected\}/);
 assert.match(scene,/event\.key==="Enter"\|\|event\.key===" "/);
 assert.match(scene,/setSelected\(false\)/);
 assert.match(scene,/\},\[classicId,page\]\)/);
 assert.match(scene,/role="status" aria-live="polite"/);
});

test("drag stays supported and a dragged item does not accidentally activate tap mode",()=>{
 assert.match(scene,/movedDuringDrag=useRef\(false\)/);
 assert.match(scene,/Math\.hypot\(event\.clientX-origin\.current\.x,event\.clientY-origin\.current\.y\)>10/);
 assert.match(scene,/if\(delivered\|\|movedDuringDrag\.current\)\{movedDuringDrag\.current=false;return;\}/);
 assert.match(scene,/setPointerCapture\(event\.pointerId\)/);
 assert.match(scene,/Math\.hypot\(releasePoint\.x-scene\.target\.x,releasePoint\.y-scene\.target\.y\)<\.18/);
 assert.match(scene,/\.wt-gift-item, \.wt-gift-target\.is-selected/);
 assert.match(app,/\.wt-brick-item, \.wt-gift-item/);
});

test("target can receive touch on iPhone without enlarging surrounding controls",()=>{
 assert.match(css,/\.wt-gift-target\.is-selected\{/);
 assert.match(css,/pointer-events:auto!important/);
 assert.match(css,/\.wt-gift-target\.is-selected:focus-visible/);
 assert.match(css,/\.wt-gift-item\.is-selected/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.doesNotMatch(scene,/fetch\(|setPage\(|onNextPage|setTimeout\(/);
});
