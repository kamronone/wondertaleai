import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {transform} from "esbuild";

const source=readFileSync(new URL("../src/reader_story_parts.ts",import.meta.url),"utf8");
const compiled=await transform(source,{loader:"ts",format:"esm",target:"es2022"});
const {readerStoryParts,readerStoryPartForPage}=await import(
 "data:text/javascript;base64,"+Buffer.from(compiled.code).toString("base64")
);

test("12 and 20 page stories have four contiguous, nonoverlapping sections",()=>{
 for(const count of [12,20]){
  for(const lang of ["ru","uz","en"]){
   const sections=readerStoryParts(count,lang);
   assert.equal(sections.length,4);
   assert.equal(sections[0].start,0);
   assert.equal(sections.at(-1).end,count-1);
   const covered=sections.flatMap(part=>Array.from({length:part.end-part.start+1},(_,i)=>part.start+i));
   assert.deepEqual(covered,Array.from({length:count},(_,i)=>i));
   assert.equal(new Set(sections.map(part=>part.id)).size,4);
   assert.ok(sections.every(part=>part.label.trim().length>=4));
   for(let i=0;i<count;i++){
    const selected=readerStoryPartForPage(i,count,lang);
    assert.ok(selected);
    assert.ok(selected.start<=i&&selected.end>=i);
   }
  }
 }
});

test("the reading map does not invent stages for 8 page classic picture books",()=>{
 assert.deepEqual(readerStoryParts(8,"ru"),[]);
 assert.equal(readerStoryPartForPage(0,8,"ru"),null);
 assert.equal(readerStoryPartForPage(-1,20,"ru"),null);
 assert.equal(readerStoryPartForPage(20,20,"ru"),null);
 assert.equal(readerStoryPartForPage(1.5,20,"ru"),null);
});

test("long story navigation never modifies original chapter text or sends it elsewhere",()=>{
 assert.doesNotMatch(source,/fetch\(|localStorage|sessionStorage|setItem|\.text|\.image_url/);
 assert.equal(readerStoryPartForPage(19,20,"en").id,"ending");
 assert.equal(readerStoryPartForPage(0,12,"ru").label,"Начало");
 assert.equal(readerStoryPartForPage(18,20,"uz").label,"Yakun");
});

test("the native iPhone chooser shows stage headers without adding multiple large buttons",()=>{
 const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
 const css=readFileSync(new URL("../src/reader-chapter-navigation.css",import.meta.url),"utf8");
 assert.match(app,/readerStoryParts\(active\.pages\.length,lang\)\.map\(part=><optgroup/);
 assert.match(app,/readerStoryPartForPage\(page,active\.pages\.length,lang\)\?\.label/);
 assert.match(css,/\.wt-chapter-navigator \.wt-story-part-label/);
 assert.match(css,/font-size:12px/);
 assert.doesNotMatch(css,/position:fixed/);
});
