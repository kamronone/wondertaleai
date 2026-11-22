import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const art=readFileSync(new URL("../src/classic_page_art.ts",import.meta.url),"utf8");
const remain=readFileSync(new URL("../src/classic_remaining_motifs.ts",import.meta.url),"utf8");
const first=readFileSync(new URL("../src/classic_story_motifs.ts",import.meta.url),"utf8");
const catalog=readFileSync(new URL("../src/classics.ts",import.meta.url),"utf8");
const covered=["thumbelina","princess-pea","emperor-clothes","elves-shoemaker","ali-baba","turnip","teremok","ryaba","masha-bears","twelve-months"];

test("ten previously generic stories have their own book-specific original SVG protagonist",()=>{
 for(const id of covered){
  assert.ok(catalog.includes('id:"'+id+'"')||catalog.includes('"id":"'+id+'"'),"missing classic "+id);
  assert.ok(remain.includes('"'+id+'":page=>'),"missing motif for "+id);
  assert.ok(!first.includes('"'+id+'":page=>'),"unexpected duplicate motif "+id);
 }
 assert.match(remain,/export function remainingClassicMotif/);
 assert.match(art,/import \{ remainingClassicMotif \} from "\.\/classic_remaining_motifs";/);
 assert.match(art,/classicStoryMotif\(id,page\)\|\|remainingClassicMotif\(id,page\)/);
});

test("remaining story pictures vary by page without requesting network or user data",()=>{
 assert.match(remain,/const bob=\(page:number\)/);
 assert.match(remain,/const stars=\(page:number\)/);
 assert.match(remain,/data-story-motif/);
 assert.doesNotMatch(remain,/fetch\(|https?:\/\/|localStorage|access_token|document\.|window\./);
 assert.match(art,/User-authored SVG data URLs, uploads and private media must remain unchanged/);
});

test("all original detailed art and png collections keep priority",()=>{
 for(const dedicated of ["redHoodPageArtwork","threePigsPageArtwork","cinderellaPageArtwork","snowWhitePageArtwork","uglyDucklingPageArtwork","bremenPageArtwork","hanselGretelPageArtwork","rapunzelPageArtwork","sleepingBeautyPageArtwork","pussBootsPageArtwork"]){
  assert.ok(art.includes(dedicated),"dedicated art missing "+dedicated);
 }
 assert.match(art,/const bundledPngIds = new Set\(\["red-hood","cinderella","three-pigs",\.\.\.\(rapunzelPngReady\?/);
});
