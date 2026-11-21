import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {transform} from "esbuild";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const source=read("../src/reader_ambience.ts");
const app=read("../src/main.tsx");
const css=read("../src/reader-mobile-v1.css");
const {code}=await transform(source,{loader:"ts",format:"esm",target:"es2022"});
const {readerAmbienceForClassic,startReaderAmbience}=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));

test("ambient scenes use predictable non-personal category choices",()=>{
 assert.equal(readerAmbienceForClassic("three-pigs"),"wind");
 assert.equal(readerAmbienceForClassic("red-hood"),"forest");
 assert.equal(readerAmbienceForClassic("cinderella"),"magic");
 assert.equal(readerAmbienceForClassic(undefined),"forest");
});
test("ambient sounds require explicit input and never auto-play on page render",()=>{
 assert.match(app,/onClick=\{toggleAmbience\}/);
 assert.match(app,/startReaderAmbience\(readerAmbienceForClassic/);
 assert.match(app,/aria-pressed=\{ambienceOn\}/);
 assert.match(source,/context\.createBufferSource\(\)/);
 assert.match(source,/if\(context\.state==="suspended"\)/);
 assert.doesNotMatch(source,/setInterval\(/);
 assert.doesNotMatch(source,/fetch\(/);
});
test("bedtime, night mode, background and navigation stop ambient playback",()=>{
 assert.match(app,/\[active\?\.id,tab,readerNightMode,bedtimeUntil\]/);
 assert.match(app,/visibilitychange/);
 assert.match(app,/document\.visibilityState!=="visible"/);
 assert.match(app,/ambiencePlayback\.current\?\.stop\(\)/);
 assert.match(app,/!readerNightMode&&bedtimeUntil===null/);
});
test("mobile reader remains compact and keeps sufficiently sized touch targets",()=>{
 assert.match(css,/\.reader-page \.reader-mode-controls>button/);
 assert.match(css,/min-height:44px!important/);
 assert.match(css,/\.reader-page \.reader-audio-toolbar>button/);
 assert.match(css,/\.reader-page \.reader-ambience-button/);
 // A separate shell reserves the bottom fixed nav. Duplicating 102px here
 // created a huge blank area on narrow iPhones.
 assert.match(css,/\.reader-page\{[\s\S]*?padding-bottom:8px/);
 assert.doesNotMatch(css,/padding-bottom:calc\(102px/);
});
test("SSR-safe unsupported WebAudio returns no playback",()=>{
 assert.equal(startReaderAmbience("forest"),null);
});
