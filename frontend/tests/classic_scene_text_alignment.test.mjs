import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const sceneSource=readFileSync(new URL("../src/classic_page_scene_details.ts",import.meta.url),"utf8");
const artSource=readFileSync(new URL("../src/classic_page_art.ts",import.meta.url),"utf8");
const demoSource=readFileSync(new URL("../src/demo.ts",import.meta.url),"utf8");
const script=ts.transpileModule(sceneSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const moduleExports={};
vm.runInNewContext(script,{exports:moduleExports,Number,Math,Object,String,RegExp}, {timeout:1000});
const illustration=moduleExports.classicPageSceneDetail;

test("intro and ending show a book when the original text mentions one",()=>{
 const chapterOne=illustration("thumbelina",0,"Однажды Маша открыла волшебную книгу.");
 const chapterEight=illustration("thumbelina",7,"Волшебная книга закрылась.");
 const withoutText=illustration("thumbelina",0);
 assert.match(chapterOne,/data-story-page="thumbelina-1"/);
 assert.match(chapterEight,/data-story-page="thumbelina-8"/);
 assert.match(chapterOne,/stroke="#936a7b"/); // Actual book drawing
 assert.match(chapterEight,/stroke="#936a7b"/);
 assert.notEqual(chapterOne,withoutText);
});

test("recognizes direct story objects in Russian, Uzbek and English",()=>{
 const apple=illustration("kolobok",3,"The little apple rolled toward the tree.");
 const egg=illustration("ryaba",3,"Ola tovuq oltin tuxum topdi.");
 const fish=illustration("fisherman-fish",4,"Рыбка вернулась к берегу.");
 assert.match(apple,/stroke="#a96871"/);
 assert.match(egg,/stroke="#c3a163"/);
 assert.match(fish,/stroke="#b18b5b"/);
});

test("unmatched prose uses a neutral illustration rather than a made-up plot event",()=>{
 const neutral=illustration("ali-baba",3,"They wondered what to do next.");
 assert.match(neutral,/stroke="#936a7b"/);
 assert.doesNotMatch(neutral,/stroke="#ae8651"/); // Unmentioned gold coins
});

test("the text source is connected only to built-in classic demo artwork",()=>{
 assert.match(artSource,/classicPageSceneDetail\(classicId,page,pageText\)/);
 assert.match(artSource,/classicPageArtwork\(classicId,pageIndex,pageText\)/);
 assert.match(demoSource,/classicReaderImage\(classicId,art\|\|"",index,text\)/);
 assert.match(demoSource,/classicReaderImage\(book\.classicId,page\.image_url,index,story\.pages\[index\]\)/);
 assert.match(artSource,/User-authored SVG data URLs, uploads and private media must remain unchanged/);
});
