import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const source=read("../src/CharacterHotspot.tsx");
const app=read("../src/main.tsx");
const css=read("../src/reader-mobile-v1.css");

test("expanded safe classic scenes define unique visible character hotspots",()=>{
 const keys=[...source.matchAll(/^  "([a-z-]+):([1-8])": \{/gm)].map(m=>m[1]+":"+m[2]).sort();
 assert.equal(keys.length,29);
 assert.equal(new Set(keys).size,keys.length);
 for(const original of ["bremen:2","cinderella:5","hansel-gretel:3","puss-boots:4","rapunzel:7","red-hood:1","sleeping-beauty:5","snow-white:2","three-pigs:4","three-pigs:7","ugly-duckling:3"])assert.ok(keys.includes(original),"missing legacy reaction "+original);
 for(const key of keys)assert.ok(source.includes('"'+key+'"'));
 assert.match(source,/if\(!classicId\|\|!Number\.isInteger\(page\)\|\|page<1\|\|page>8\)return null/);
});

test("hotspot position follows the image content with object-fit contain",()=>{
 assert.match(source,/Math\.min\(rect\.width\/media\.naturalWidth,rect\.height\/media\.naturalHeight\)/);
 assert.match(source,/offsetX\+drawnW\*position\.x/);
 assert.match(source,/Math\.max\(edge,Math\.min\(containerRect\.width-edge,left\)\)/);
 assert.match(source,/offsetY\+drawnH\*position\.y/);
 assert.match(source,/Math\.max\(edge,Math\.min\(containerRect\.height-edge,top\)\)/);
 assert.match(source,/new ResizeObserver\(update\)/);
 assert.match(source,/querySelector<HTMLImageElement>\("img\.wt-reader-picture, \.story-page-image > img"\)/);
 assert.match(source,/addEventListener\("load",update\)/);
 assert.match(source,/observer\?\.disconnect\(\)/);
});

test("hotspots preserve ordinary inline images and story navigation",()=>{
 assert.match(app,/import \{CharacterHotspot,characterHotspotForPage\} from "\.\/CharacterHotspot"/);
 assert.match(app,/<CharacterHotspot key=\{active\.id\+"\:"\+page\} classicId=/);
 assert.match(app,/!readerFocusMode&&!readerNightMode&&bedtimeUntil===null/);
 assert.match(app,/classicAnimatedPage\(\(active as DemoBook\)\.classicId/);
 assert.match(source,/onTouchStart=\{event=>event\.stopPropagation\(\)\}/);
 assert.doesNotMatch(source,/wt-reader-image-open|zoomOpen|createPortal/);
 assert.match(source,/onTouchEnd=\{event=>event\.stopPropagation\(\)\}/);
 assert.match(source,/onClick=\{event=>\{event\.stopPropagation\(\);setVisibleReaction/);
 assert.match(source,/role="status" aria-live="polite"/);
 assert.match(css,/\.wt-character-hotspot-layer\{[^}]*pointer-events:none/s);
 assert.match(css,/\.wt-character-hotspot\{[^}]*pointer-events:auto/s);
 assert.match(css,/width:44px/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test("reactions do not collect data, store child details or change book content",()=>{
 assert.doesNotMatch(source,/fetch\(|localStorage|sessionStorage|Authorization|privateToken|setActive|saveDemoBooks/);
 assert.match(source,/setVisibleReaction\(false\)/);
 for(const l of ["ru","uz","en"])assert.ok(source.includes(l));
});

test("a character tap has visible feedback but respects reduced motion",()=>{
 assert.match(source,/visibleReaction\?" is-reacting":""/);
 assert.match(css,/\.wt-character-hotspot\.is-reacting/);
 assert.match(css,/@keyframes wt-character-tapped/);
 assert.match(css,/\.wt-character-hotspot\.is-reacting\{\s*animation:none!important/);
});

test("seven additional story hotspots never overlap gifts or require GIF playback",()=>{
 const giftScenes=read("../src/scene_gift_data.ts");
 const additional=["rapunzel:7","snow-white:2","ugly-duckling:3","bremen:2","hansel-gretel:3","puss-boots:4","sleeping-beauty:5"];
 for(const key of additional){
  assert.ok(source.includes('"'+key+'": {'),"missing reaction "+key);
  assert.ok(!giftScenes.includes('"'+key+'":{'),"overlapping gift "+key);
 }
 assert.match(app,/characterHotspotForPage\(\(active as DemoBook\)\.classicId,page\+1\)&&/);
 assert.match(app,/!storyGiftForPage\(\(active as DemoBook\)\.classicId,page\+1\)&&/);
 assert.match(app,/familyReadingPreferences\.extraActivities/);
 assert.doesNotMatch(source,/setTimeout\(|setInterval\(|nextPage\(|setPage\(/);
});

test("character markers stay tappable on iPhone and expose pressed state",()=>{
 assert.match(source,/const edge=24/);
 assert.match(source,/onPointerDown=\{event=>event\.stopPropagation\(\)\}/);
 assert.match(source,/aria-pressed=\{visibleReaction\}/);
 assert.match(css,/width:44px/);
 assert.match(css,/height:44px/);
});
