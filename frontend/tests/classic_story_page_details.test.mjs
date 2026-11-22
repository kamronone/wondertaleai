import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const src=readFileSync(new URL("../src/classic_page_scene_details.ts",import.meta.url),"utf8");
const art=readFileSync(new URL("../src/classic_page_art.ts",import.meta.url),"utf8");
const first=readFileSync(new URL("../src/classic_story_motifs.ts",import.meta.url),"utf8");
const remainder=readFileSync(new URL("../src/classic_remaining_motifs.ts",import.meta.url),"utf8");
const script=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const exports={};
vm.runInNewContext(script,{exports,require(){throw Error("No dependencies allowed")},Number,Math,Object,String}, {timeout:1000});

const ids=[
 "goldilocks","little-mermaid","frog-prince","fisherman-fish","jack-beanstalk",
 "aladdin","nutcracker","kolobok","snow-queen","pinocchio","thumbelina",
 "princess-pea","emperor-clothes","elves-shoemaker","ali-baba","turnip",
 "teremok","ryaba","masha-bears","twelve-months"
];

test("all twenty generic SVG storybooks receive eight distinct chapter-specific visual accents",()=>{
 for(const id of ids){
   const chapters=Array.from({length:8},(_,i)=>exports.classicPageSceneDetail(id,i));
   assert.equal(chapters.length,8);
   assert.equal(new Set(chapters).size,8, id+" has repeated SVG");
   chapters.forEach((svg,i)=>{
     assert.ok(svg.includes('data-story-page="'+id+'-'+(i+1)+'"'),id+" chapter "+(i+1));
     assert.ok(svg.includes("<g"),id+" chapter "+(i+1));
     assert.ok(svg.length>100,id+" chapter "+(i+1)+" is empty");
   });
 }
});
test("new scenes compose on top of previous story-specific SVGs",()=>{
 assert.match(art,/classicPageSceneDetail\(classicId,page,pageText\)/);
 assert.match(art,/import \{ classicPageSceneDetail \} from "\.\/classic_page_scene_details"/);
 for(const id of ids){
   assert.ok(first.includes('"'+id+'":page=>')||remainder.includes('"'+id+'":page=>'),"missing primary motif "+id);
 }
});
test("unknown books get no invented art and author photos stay unchanged",()=>{
 assert.equal(exports.classicPageSceneDetail("unknown",0),"");
 assert.equal(exports.classicPageSceneDetail("red-hood",3),"");
 assert.equal(exports.classicPageSceneDetail("three-pigs",7),"");
 assert.doesNotMatch(src,/fetch\(|https?:\/\/|localStorage|access_token|window\.|document\./);
 assert.match(art,/User-authored SVG data URLs, uploads and private media must remain unchanged/);
});
