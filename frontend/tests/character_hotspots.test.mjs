import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const source=read("../src/CharacterHotspot.tsx");
const app=read("../src/main.tsx");
const css=read("../src/reader-mobile-v1.css");

test("exactly four safe classic scenes define a visible character hotspot",()=>{
 const keys=[...source.matchAll(/^  "(red-hood|cinderella|three-pigs):([1-8])": \{/gm)].map(m=>m[1]+":"+m[2]).sort();
 assert.deepEqual(keys,["cinderella:5","red-hood:1","three-pigs:4","three-pigs:7"]);
 for(const key of keys)assert.ok(source.includes('"'+key+'"'));
 assert.match(source,/if\(!classicId\|\|!Number\.isInteger\(page\)\|\|page<1\|\|page>8\)return null/);
});

test("hotspot position follows the image content with object-fit contain",()=>{
 assert.match(source,/Math\.min\(width\/image\.naturalWidth,height\/image\.naturalHeight\)/);
 assert.match(source,/\(width-drawnW\)\/2\+drawnW\*position\.x/);
 assert.match(source,/\(height-drawnH\)\/2\+drawnH\*position\.y/);
 assert.match(source,/new ResizeObserver\(update\)/);
 assert.match(source,/addEventListener\("load",update\)/);
 assert.match(source,/observer\?\.disconnect\(\)/);
});

test("hotspots preserve accessible image zoom and story navigation",()=>{
 assert.match(app,/import \{CharacterHotspot\} from "\.\/CharacterHotspot"/);
 assert.match(app,/<CharacterHotspot classicId=/);
 assert.match(app,/!readerFocusMode&&!readerNightMode&&bedtimeUntil===null/);
 assert.match(app,/classicAnimatedPage\(\(active as DemoBook\)\.classicId/);
 assert.match(source,/onTouchStart=\{event=>event\.stopPropagation\(\)\}/);
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
