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
  assert.match(hotspot,/new MutationObserver\(\(\)=>\{/);
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
   const end=hotspot.indexOf(String.fromCharCode(10)+"  },",start);
   assert.ok(end>start,id+" reaction entry is complete");
   const entry=hotspot.slice(start,end);
   assert.ok(entry.includes("motion:"),id+" defines animation type");
   assert.ok(entry.includes("position:{x:"),id+" defines a position");
   assert.ok(entry.includes("label:words("),id+" defines localized labels");
   assert.ok(entry.includes("message:words("),id+" defines localized dialogue");
 }
});

test("mutation reactions cannot retrigger endless coordinate updates",()=>{
 assert.match(hotspot,/setPoint\(previous=>previous\?\.left===next\?\.left&&previous\?\.top===next\?\.top\?previous:next\)/);
 assert.match(hotspot,/if\(next===picture\)return/);
 assert.match(hotspot,/picture\?\.removeEventListener\("load",update\)/);
 assert.match(hotspot,/picture\?\.addEventListener\("load",update\)/);
});

test("each story page owns a fresh character reaction lifecycle",()=>{
 const main=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
 assert.match(main,/<CharacterHotspot key=\{active\.id\+"\:"\+page\}/);
 assert.match(hotspot,/useEffect\(\(\)=>\{setVisibleReaction\(false\);setReactionReplay\(0\);setPoint\(null\);\},\[classicId,page\]\)/);
});

test("hotspot icon represents actual scene action instead of generic sparkles",()=>{
 assert.match(hotspot,/<MotionIcon size=\{20\} aria-hidden="true"\/>/);
 assert.doesNotMatch(hotspot,/<Sparkles size=\{18\} aria-hidden="true"\/>/);
});

test("reaction dialogue can be dismissed without changing the story page",()=>{
 assert.match(hotspot,/className="wt-character-reaction-close"/);
 assert.match(hotspot,/aria-label=\{words\("Закрыть реплику","Javobni yopish","Close reply"\)\[lang\]\}/);
 assert.match(hotspot,/onClick=\{event=>\{event\.stopPropagation\(\);setVisibleReaction\(false\);\}\}/);
 const css=readFileSync(new URL("../src/character-reaction-motion.css",import.meta.url),"utf8");
 assert.match(css,/\.wt-character-reaction-close\{/);
 assert.match(css,/min-height:44px/);
 assert.match(css,/max-height:min\(45%,180px\)/);
});

test("dialogue pointer and touch events never turn a reader page",()=>{
 assert.match(hotspot,/className="wt-character-reaction" onPointerDown=\{event=>event\.stopPropagation\(\)\}/);
 assert.match(hotspot,/onPointerMove=\{event=>event\.stopPropagation\(\)\}/);
 assert.match(hotspot,/onTouchMove=\{event=>event\.stopPropagation\(\)\}/);
 assert.match(hotspot,/<span role="status" aria-live="polite">\{reaction\.message\[lang\]\}<\/span>/);
 assert.match(hotspot,/event\.key==="Escape"/);
});

test("six more classics have chapter reactions with translated dialogue",()=>{
 const ids=["frog-prince","princess-pea","little-mermaid","snow-queen","nutcracker","aladdin"];
 const catalog=readFileSync(new URL("../src/classics.ts",import.meta.url),"utf8");
 for(const id of ids){
   assert.ok(catalog.includes('"'+id+'"'),"missing classic "+id);
   const start=hotspot.indexOf('"'+id+':1": {');
   assert.ok(start>=0,"missing reaction "+id);
   const end=hotspot.indexOf(String.fromCharCode(10)+"  },",start);
   assert.ok(end>start,"incomplete reaction "+id);
   const entry=hotspot.slice(start,end);
   assert.match(entry,/label:words\(/);
   assert.match(entry,/message:words\(/);
   assert.match(entry,/position:\{x:/);
 }
});

test("character reactions use embedded GIF89a assets rather than missing remote paths",()=>{
 const assets=readFileSync(new URL("../src/reaction_gif_assets.ts",import.meta.url),"utf8");
 assert.doesNotMatch(hotspot,/snow-white-wave\\.gif|duckling-flutter\\.gif|bremen-music\\.gif/);
 assert.match(hotspot,/reactionGifData\[\x60\$\{classicId\}:\$\{page\}\x60\]/);
 for(const id of ["snow-white:2","ugly-duckling:3","bremen:2"]){
   assert.ok(assets.includes('"'+id+'":"data:image/gif;base64,R0lGODlh'),id+" embeds GIF89a");
 }
 assert.match(hotspot,/className="wt-character-reaction-gif"/);
 assert.match(hotspot,/<MotionIcon size=\{26\} strokeWidth=\{2\.2\}\/>/);
});

test("embedded reaction GIFs contain six transparent 56px frames",()=>{
 const assets=readFileSync(new URL("../src/reaction_gif_assets.ts",import.meta.url),"utf8");
 for(const id of ["snow-white:2","ugly-duckling:3","bremen:2"]){
   const start=assets.indexOf('"'+id+'":"data:image/gif;base64,');
   assert.ok(start>=0,id+" has an embedded GIF");
   const base64Start=start+('"'+id+'":"data:image/gif;base64,').length;
   const base64End=assets.indexOf('"',base64Start);
   const gif=Buffer.from(assets.slice(base64Start,base64End),"base64");
   assert.equal(gif.toString("ascii",0,6),"GIF89a");
   assert.equal(gif.readUInt16LE(6),56);
   assert.equal(gif.readUInt16LE(8),56);
   assert.equal(gif[gif.length-1],0x3b);
   // Skip sub-blocks instead of searching raw pixels for image delimiters.
   let cursor=13+3*(1<<((gif[10]&7)+1)),frames=0;
   while(cursor<gif.length){
     const marker=gif[cursor++];
     if(marker===0x3b)break;
     if(marker===0x21){cursor++;while(true){const length=gif[cursor++];if(!length)break;cursor+=length;}continue;}
     assert.equal(marker,0x2c,id+" contains a valid image descriptor");
     cursor+=8;
     const packed=gif[cursor++];
     if(packed&0x80)cursor+=3*(1<<((packed&7)+1));
     cursor++; // LZW minimum code size.
     while(true){const length=gif[cursor++];if(!length)break;cursor+=length;}
     frames++;
   }
   assert.equal(frames,6,id+" has six animation frames");
 }
});
