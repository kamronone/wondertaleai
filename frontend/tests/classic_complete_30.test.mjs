import test from "node:test";
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import {readFileSync} from "node:fs";
import {build} from "esbuild";
async function compiled(path){
 const result=await build({
  entryPoints:[fileURLToPath(new URL(path,import.meta.url))],
  bundle:true,write:false,format:"esm",platform:"neutral",target:"es2022",logLevel:"silent"
 });
 return import("data:text/javascript;base64,"+Buffer.from(result.outputFiles[0].contents).toString("base64"));
}
const {extendedClassicIds,extendIllustratedClassic}=await compiled("../src/classic_story_extra.ts");
const {fullPlotIds,fullClassicChapters}=await compiled("../src/classic_full_plots.ts");
const file=readFileSync(new URL("../src/demo.ts",import.meta.url),"utf8");

test("all thirty public classics have story-specific complete arcs on eight illustrated pages",()=>{
 const combined=[...extendedClassicIds,...fullPlotIds];
 assert.equal(new Set(combined).size,30);
 assert.equal(combined.length,30);
 for(const lang of ["ru","uz","en"]){
  for(const id of extendedClassicIds){
   const original=Array.from({length:8},(_,i)=>"Original illustrated chapter "+(i+1)+".");
   const pages=extendIllustratedClassic(id,lang,original);
   assert.equal(pages.length,8,id+":"+lang);
   for(let i=0;i<8;i++){
    assert.ok(pages[i].startsWith(original[i]),"original order "+id+":"+i);
    assert.ok(pages[i].length>90,"expanded story content "+id+":"+lang+":"+i);
    assert.ok(pages[i].includes("\n\n"),"real chapter paragraphs "+id);
   }
  }
  for(const id of fullPlotIds){
   const pages=fullClassicChapters(id,"Young Reader",lang);
   assert.ok(pages&&pages.length===8,id+":"+lang);
   assert.ok(pages[7].length>80,"conclusion "+id+":"+lang);
  }
 }
});

test("expansion never rewrites arbitrary private or saved user books",()=>{
 const original=Array.from({length:8},(_,i)=>"Private page "+i);
 assert.deepEqual(extendIllustratedClassic("private-book","ru",original),original);
 assert.deepEqual(extendIllustratedClassic("cinderella","ru",original.slice(0,2)),original.slice(0,2));
 assert.match(file,/const story=makeClassicStoryBase\(id,name,language\)/);
 assert.match(file,/extendIllustratedClassic\(id,language,story.pages\)/);
 assert.match(file,/refreshClassicDemoStory\(book:DemoBook\)/);
 assert.match(file,/if\(!canRefreshClassicDemoStory\(book\)\)return book/);
});

test("original images, effects and eight-page interactions keep their existing indexes",()=>{
 assert.match(file,/pages:story.pages.map\(\(text,index\)=>\(\{number:index\+1,text,image_url:/);
 assert.match(file,/classicReaderImage\(classicId,art\|\|"",index,text\)/);
 assert.equal(extendIllustratedClassic("rapunzel","en",Array(8).fill("Chapter")).length,8);
});
