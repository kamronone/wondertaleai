import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {transform} from "esbuild";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const component=read("../src/StorySceneInteraction.tsx");
const app=read("../src/main.tsx");
const css=read("../src/reader-mobile-v1.css");

test("only the four illustrated classic scenes receive actions", async()=>{
 const t=component.replace(/^import.*$/gm,"").replace(/export function StorySceneInteraction\([\s\S]*$/,"");
 const transformed=await transform(t,{loader:"ts",format:"esm",target:"es2022"});
 const {classicInteractionForPage}=await import("data:text/javascript;base64,"+Buffer.from(transformed.code).toString("base64"));
 const scenes=[["three-pigs",4],["three-pigs",7],["cinderella",5],["red-hood",1]];
 for(const [id,page] of scenes){
   const scene=classicInteractionForPage(id,page);
   assert.ok(scene,id+":"+page);
   assert.equal(scene.choices.length,2);
   for(const lang of ["ru","uz","en"]){
     assert.ok(scene.prompt[lang].length>12);
     for(const choice of scene.choices){
       assert.ok(choice.label[lang].length>3);
       assert.ok(choice.answer[lang].length>8);
     }
   }
 }
 for(const [id,page] of [["three-pigs",5],["red-hood",8],["cinderella",2],["private-book",1],["three-pigs",0],["three-pigs",9]]){
   assert.equal(classicInteractionForPage(id,page),null);
 }
});

test("choices are page-local and never write personal data or alter the story",()=>{
 assert.match(component,/setChoice\(null\)/);
 assert.match(component,/\[classicId,page\]/);
 assert.match(component,/onClick=\{\(\)=>setChoice\(index\)\}/);
 assert.match(component,/role="status" aria-live="polite"/);
 assert.doesNotMatch(component,/localStorage|sessionStorage|fetch\(|Authorization|privateToken/);
 assert.match(component,/if\(!scene\|\|disabled\)return null/);
});

test("character interactions are separate from clickable illustration",()=>{
 assert.match(app,/<StorySceneInteraction classicId=/);
 assert.match(app,/disabled=\{readerFocusMode\}/);
 const picture=app.indexOf('className={"story-page reader-font-');
 const interaction=app.indexOf('<StorySceneInteraction');
 assert.ok(picture>=0&&interaction>picture);
 assert.match(css,/\.wt-scene-play-actions>button/);
 assert.match(css,/min-height:44px/);
 assert.match(css,/@media print/);
});
