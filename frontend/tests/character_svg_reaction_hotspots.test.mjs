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

test("every character tap restarts animation and keeps dialogue visible",()=>{
  assert.match(hotspot,/setReactionReplay\(value=>value\+1\)/);
  assert.match(hotspot,/key=\{reactionReplay\}/);
  assert.match(hotspot,/setVisibleReaction\(true\)/);
  assert.doesNotMatch(hotspot,/setVisibleReaction\(value=>!value\)/);
});

test("new classic chapter reactions are available in all supported languages",()=>{
 for(const key of ["snow-white:1","snow-white:4","snow-white:8","red-hood:2","cinderella:1","rapunzel:1"]){
   const source=hotspot.slice(hotspot.indexOf('"'+key+'"'));
   assert.ok(source.startsWith('"'+key+'": {'),key+" is present");
   assert.match(source.slice(0,350),/label:words\(/,key+" has three localized labels");
   assert.match(source.slice(0,620),/message:words\(/,key+" has three localized messages");
 }
});

test("six additional fairy tales include a localized chapter-one reaction",()=>{
 const catalog=readFileSync(new URL("../src/classics.ts",import.meta.url),"utf8");
 for(const id of ["kolobok","turnip","pinocchio","thumbelina","jack-beanstalk","goldilocks"]){
   assert.ok(catalog.includes('"'+id+'"'),id+" exists in the classic catalog");
   const marker='"'+id+':1": {';
   const start=hotspot.indexOf(marker);
   assert.ok(start>=0,id+" has an interactive first chapter");
   const entry=hotspot.slice(start,hotspot.indexOf("\\n  },",start));
   assert.match(entry,/motion:"(?:wave|music|flutter|bow|dance|shine|bloom|cheer)"/);
   assert.match(entry,/position:\\{x:\\.\\d+,y:\\.\\d+\\}/);
   assert.match(entry,/label:words\\("[^"]+","[^"]+","[^"]+"\\)/);
   assert.match(entry,/message:words\\("[^"]+","[^"]+","[^"]+"\\)/);
 }
});
