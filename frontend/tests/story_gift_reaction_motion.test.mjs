import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const source=read("../src/StoryGiftInteraction.tsx");
const css=read("../src/story-gift-interaction.css");
const data=read("../src/scene_gift_data.ts");

test("gift receipt animates a visual reaction specific to the story",()=>{
 assert.match(source,/const GiftEffect=classicId==="bremen"\?Music2/);
 assert.match(source,/classicId==="rapunzel"\|\|classicId==="snow-white"\?Flower2/);
 assert.match(source,/classicId==="ugly-duckling"\?Feather/);
 assert.match(source,/delivered&&<div className="wt-gift-reaction-fx"/);
 assert.match(source,/style=\{locate\(scene.target\)\}/);
 assert.match(source,/aria-hidden="true"/);
 assert.match(css,/@keyframes wt-gift-character-response/);
 assert.match(css,/@keyframes wt-gift-character-halo/);
});
test("gift response stays until manual page navigation and protects child data",()=>{
 assert.match(source,/delivered&&<div className="wt-gift-speech" role="status" aria-live="polite"/);
 assert.match(source,/setDelivered\(true\)/);
 assert.match(source,/setDelivered\(false\)/);
 assert.doesNotMatch(source,/setTimeout|setInterval|setPage|nextPage|fetch\(|localStorage|sessionStorage/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/\.reader-page \.wt-gift-reaction-fx\{display:none!important\}/);
 assert.match(css,/pointer-events:none/);
 assert.match(data,/"rapunzel:3":\{/);
});
