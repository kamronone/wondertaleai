import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/reader-living-art.css",import.meta.url),"utf8");

test("reader imports living art styles after full-width sizing",()=>{
 const full=app.indexOf('import "./reader-image-fullwidth.css";');
 const live=app.indexOf('import "./reader-living-art.css";');
 assert.ok(full>=0&&live>full);
});

test("three modes persist locally and expose pressed state",()=>{
 assert.match(app,/useState<"off"\|"gentle"\|"magic">/);
 assert.match(app,/getItem\("wondertale_reader_art_motion"\)/);
 assert.match(app,/setItem\("wondertale_reader_art_motion",readerArtMotion\)/);
 assert.match(app,/\(\["off","gentle","magic"\] as const\)\.map/);
 assert.match(app,/aria-pressed=\{readerArtMotion===motion\}/);
});

test("effects never cover text or intercept gestures",()=>{
 assert.match(css,/\.wt-art-effects\s*\{[^}]*pointer-events:none/s);
 assert.match(css,/z-index:3/);
 assert.match(app,/aria-hidden="true"\>\{readerArtMotion!=="off"/);
 assert.match(css,/overflow:hidden/);
});

test("night reading, bedtime and reduced-motion setting disable motion",()=>{
 assert.match(app,/readerNightMode\|\|bedtimeUntil!==null\?"off":readerArtMotion/);
 assert.match(css,/@media \(prefers-reduced-motion:reduce\)/);
 assert.match(css,/@media print/);
 assert.match(css,/animation:none!important/);
});

test("the original PNG remains intact without remote AI or video",()=>{
 assert.match(app,/wt-living-art wt-motion-/);
 assert.match(app,/readerFullWidth animatedUrl=/);
 assert.doesNotMatch(css,/url\(https?:\/\//);
 assert.doesNotMatch(app,/autoplay\s*=/);
});

test("first-time visitors see real character motion without opening settings",()=>{
 assert.match(app,/saved==="off"\|\|saved==="gentle"\|\|saved==="magic"\?saved:"magic"/);
 assert.match(app,/catch\{return "magic";\}/);
 assert.match(app,/wt-character-motion-control/);
 assert.match(app,/aria-pressed=\{readerArtMotion==="magic"\}/);
 assert.match(app,/setReaderArtMotion\(current=>current==="magic"\?"off":"magic"\)/);
 assert.match(css,/\.wt-character-motion-control\{/);
 assert.match(css,/min-height:44px/);
});
