import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {transform} from "esbuild";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const source=read("../src/scene_gift_data.ts");
const app=read("../src/main.tsx");
const gift=read("../src/StoryGiftInteraction.tsx");
const scenes=[
  ["snow-white",4,"flower-basket.svg"],
  ["ugly-duckling",5,"pond-lily.svg"],
  ["bremen",4,"music-bell.svg"],
  ["rapunzel",3,"tower-flower.svg"],
  ["hansel-gretel",2,"breadcrumb-bag.svg"],
  ["puss-boots",2,"cat-ribbon.svg"],
  ["sleeping-beauty",2,"fairy-star.svg"]
];
test("seven fairy tales offer illustrated page-specific gifts in three languages",async()=>{
 const transpiled=await transform(source,{loader:"ts",format:"esm",target:"es2022"});
 const {storyGiftForPage}=await import("data:text/javascript;base64,"+Buffer.from(transpiled.code).toString("base64"));
 for(const [id,page,filename] of scenes){
  const entry=storyGiftForPage(id,page);
  assert.ok(entry,id+":"+page);
  assert.equal(entry.asset,"/images/interactions/"+filename);
  assert.ok(existsSync(new URL("../public/images/interactions/"+filename,import.meta.url)));
  const svg=read("../public/images/interactions/"+filename);
  assert.match(svg,/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/<title/);
  for(const language of ["ru","uz","en"]){
    assert.ok(entry.instruction[language].length>10,id+":"+language);
    assert.ok(entry.reply[language].length>10,id+":"+language);
  }
  for(const position of [entry.start,entry.target]){
    assert.ok(position.x>=0 && position.x<=1);
    assert.ok(position.y>=0 && position.y<=1);
  }
  assert.equal(storyGiftForPage(id,9),null);
 }
 assert.equal(storyGiftForPage("private-book",4),null);
});
test("new scenes do not automatically turn pages and obey family preferences",()=>{
 assert.match(gift,/setDelivered\(true\)/);
 assert.match(gift,/role="status" aria-live="polite"/);
 assert.doesNotMatch(gift,/setTimeout\(|setPage\(|nextPage\(/);
 assert.match(app,/isDemoBook\(active\)&&familyReadingPreferences\.extraActivities&&!readerFocusMode&&!readerNightMode&&bedtimeUntil===null&&storyGiftForPage/);
});

test("iPhone pointer release uses final drop position even without the last pointermove",()=>{
 assert.match(gift,/const releasePoint=origin\.current&&width>0&&height>0/);
 assert.match(gift,/event\.clientX-origin\.current\.x/);
 assert.match(gift,/event\.clientY-origin\.current\.y/);
 assert.match(gift,/Math\.hypot\(releasePoint\.x-scene\.target\.x,releasePoint\.y-scene\.target\.y\)/);
 assert.match(gift,/setDelivered\(true\)/);
});
test("gift arrival and hero response honor reduced-motion preference",()=>{
 const css=read("../src/story-gift-interaction.css");
 assert.match(css,/@keyframes wt-gift-land/);
 assert.match(css,/@keyframes wt-gift-reply/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/\.wt-gift-play\.is-delivered \.wt-gift-speech\{[\s\S]*?animation:wt-gift-reply/);
 assert.match(css,/animation:none!important/);
});

test("gift positions follow the visible artwork, excluding object-fit letterboxing",()=>{
 assert.match(gift,/function visibleArtFrame\(stage:HTMLElement\)/);
 assert.match(gift,/querySelector<HTMLImageElement>\("img\.wt-reader-picture"\)/);
 assert.match(gift,/Math\.min\(rect\.width\/img\.naturalWidth,rect\.height\/img\.naturalHeight\)/);
 assert.match(gift,/\(rect\.width-width\)\/2/);
 assert.match(gift,/\(rect\.height-height\)\/2/);
 assert.match(gift,/style=\{locate\(scene\.target\)\}/);
 assert.match(gift,/style=\{locate\(point\)\}/);
 assert.match(gift,/new ResizeObserver\(refresh\)/);
 assert.match(gift,/image\?\.addEventListener\("load",refresh\)/);
 assert.match(gift,/observer\?\.disconnect\(\)/);
});

test("Rapunzel flower lands beside her window in the illustrated PNG scene",async()=>{
 const transpiled=await transform(source,{loader:"ts",format:"esm",target:"es2022"});
 const {storyGiftForPage}=await import("data:text/javascript;base64,"+Buffer.from(transpiled.code).toString("base64"));
 const scene=storyGiftForPage("rapunzel",3);
 assert.ok(scene);
 assert.equal(scene.target.x,.74);
 assert.equal(scene.target.y,.33);
 assert.notEqual(scene.start.x,scene.target.x);
 assert.notEqual(scene.start.y,scene.target.y);
});
