import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {build} from "esbuild";
const built=await build({
 entryPoints:[fileURLToPath(new URL("../src/classic_full_plots.ts",import.meta.url))],
 bundle:true,write:false,format:"esm",platform:"neutral",target:"es2022",logLevel:"silent"
});
const {fullClassicChapters,fullPlotIds}=await import("data:text/javascript;base64,"+Buffer.from(built.outputFiles[0].contents).toString("base64"));
const expected=["frog-prince","goldilocks","jack-beanstalk","pinocchio","thumbelina","princess-pea","emperor-clothes","elves-shoemaker","little-mermaid","snow-queen","nutcracker","aladdin","ali-baba","kolobok","turnip","teremok","ryaba","masha-bears","twelve-months","fisherman-fish"];
test("twenty previously generic tales now have a distinct beginning, events and ending",()=>{
 assert.deepEqual([...fullPlotIds].sort(),expected.sort());
 for(const id of expected){
  for(const lang of ["ru","uz","en"]){
   const pages=fullClassicChapters(id,"Kamron",lang);
   assert.ok(pages,id+":"+lang);
   assert.equal(pages.length,8,id+":"+lang);
   for(const [index,page] of pages.entries()){
    assert.ok(page.length>=75,id+":"+lang+" page "+(index+1));
    assert.ok(!page.includes("__HERO__"),"placeholder escaped in "+id);
    assert.ok(!page.includes("<script"),"markup not used in "+id);
   }
   assert.ok(new Set(pages).size===8,id+" distinct chapters");
   assert.notEqual(pages[0],pages[7],id+" starts and ends differently");
  }
 }
});
test("complete story remains compatible with eight-page PNG/GIF and interactive positions",()=>{
 const source=readFileSync(new URL("../src/demo.ts",import.meta.url),"utf8");
 assert.match(source,/const complete=fullClassicChapters\(id,name,language\)/);
 assert.match(source,/return \{title,pages:complete\}/);
 assert.match(source,/pages:story.pages.map\(\(text,index\)=>\(\{number:index\+1,text,image_url:/);
 assert.equal(fullClassicChapters("user-private-book","Child","ru"),null);
 assert.equal(fullClassicChapters("cinderella","Child","ru"),null);
 assert.equal(fullClassicChapters("frog-prince","Child","unknown"),null);
});
