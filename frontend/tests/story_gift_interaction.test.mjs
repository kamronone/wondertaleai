import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const scene=readFileSync(new URL("../src/StoryGiftInteraction.tsx",import.meta.url),"utf8");
const data=readFileSync(new URL("../src/scene_gift_data.ts",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/story-gift-interaction.css",import.meta.url),"utf8");

test("all three previously scripted scene interactions have unique story SVG objects",()=>{
 for(const key of ['"three-pigs:7"','"cinderella:5"','"red-hood:1"'])assert.ok(data.includes(key),key);
 for(const path of ["wooden-latch.svg","story-clock.svg","forest-map.svg"]){
   assert.ok(data.includes("/images/interactions/"+path),path);
   const asset=readFileSync(new URL("../public/images/interactions/"+path,import.meta.url),"utf8");
   assert.match(asset,/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
   assert.match(asset,/<title/);
 }
 assert.match(data,/storyGiftForPage\(classicId:string\|undefined,page:number\)/);
});

test("drag and keyboard delivery provide feedback and never directly navigate",()=>{
 assert.match(scene,/onPointerDown=\{down\}/);
 assert.match(scene,/onPointerMove=\{drag\}/);
 assert.match(scene,/onPointerUp=\{end\}/);
 assert.match(scene,/setPointerCapture\(event\.pointerId\)/);
 assert.match(scene,/Math\.hypot\(/);
 assert.match(scene,/role="status" aria-live="polite"/);
 assert.match(scene,/event\.key==="Enter"\|\|event\.key===" "/);
 assert.doesNotMatch(scene,/setPage\(|setTimeout\(|onNextPage/);
 assert.match(css,/touch-action:none!important/);
});

test("all three scene overlays replace hotspot and choice buttons without turning the page",()=>{
 assert.match(app,/import \{StoryGiftInteraction\} from "\.\/StoryGiftInteraction";/);
 assert.match(app,/import "\.\/story-gift-interaction\.css";/);
 assert.match(app,/<StoryGiftInteraction key=\{active\.id\+"\:"\+page\}/);
 assert.match(app,/\.wt-brick-item, \.wt-gift-item/);
 assert.match(app,/!storyGiftForPage\(\(active as DemoBook\)\.classicId,page\+1\)&&<StorySceneInteraction/);
 assert.match(app,/storyGiftForPage\(\(active as DemoBook\)\.classicId,page\+1\)!==null/);
 assert.match(scene,/onTouchStartCapture=\{guardTouch\}/);
 assert.match(scene,/onTouchEndCapture=\{guardTouch\}/);
});
