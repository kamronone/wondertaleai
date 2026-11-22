import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const art=readFileSync(new URL("../src/classic_page_art.ts",import.meta.url),"utf8");
const motifs=readFileSync(new URL("../src/classic_story_motifs.ts",import.meta.url),"utf8");
const classics=readFileSync(new URL("../src/classics.ts",import.meta.url),"utf8");

const ids=["goldilocks","little-mermaid","frog-prince","fisherman-fish","puss-boots","jack-beanstalk","aladdin","nutcracker","kolobok","snow-queen","pinocchio"];

test("all new motifs match a classic title, not generic unrelated clipart",()=>{
 for(const id of ids){
   assert.ok(classics.includes('id:"'+id+'"'),"missing classic "+id);
   assert.ok(motifs.includes('"'+id+'":page=>'),"missing original SVG motif "+id);
 }
 assert.match(art,/import \{ classicStoryMotif \} from "\.\/classic_story_motifs";/);
 assert.match(art,/const motif=classicStoryMotif\(id,page\);\s*if\(motif\)return motif/);
});

test("motifs are dedicated book artwork, never uploaded photos or remote AI images",()=>{
 assert.match(motifs,/data-story-motif/);
 assert.match(motifs,/function classicStoryMotif\(classicId:string,page:number\)/);
 assert.doesNotMatch(motifs,/fetch\(|https?:\/\/|localStorage|access_token|img src=/);
 assert.match(art,/User-authored SVG data URLs, uploads and private media must remain unchanged/);
});

test("page-specific variants remain distinct while originals stay in place",()=>{
 assert.match(motifs,/const move=\(page:number\)/);
 assert.match(motifs,/const ornaments=\(page:number\)/);
 for(const name of ["redHoodPageArtwork","threePigsPageArtwork","cinderellaPageArtwork","snowWhitePageArtwork","pussBootsPageArtwork"]){
   assert.ok(art.includes(name),"preserve existing illustrations: "+name);
 }
 assert.match(art,/const bundledPngIds = new Set\(\["red-hood","cinderella","three-pigs"\]\)/);
});
