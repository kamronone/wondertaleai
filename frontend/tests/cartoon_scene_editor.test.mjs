import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {transform} from "esbuild";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const {code}=await transform(read("../src/cartoon_scene_editor.ts"),{loader:"ts",format:"esm",target:"es2022"});
const {initialSceneEdits,moveScene,setSceneDuration,applySceneEdits,editedSceneSeconds}=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));
const scenes=[1,2,3].map(number=>({number,text:"Scene "+number,image:"/images/example.png",animation:null,fallback:null,seconds:12+number}));
test("scene reorder is immutable and retains the original scene content",()=>{
 const before=initialSceneEdits(scenes);
 const after=moveScene(before,2,-1);
 assert.deepEqual(before.map(x=>x.number),[1,2,3]);
 assert.deepEqual(applySceneEdits(scenes,after).map(x=>x.text),["Scene 1","Scene 3","Scene 2"]);
 assert.deepEqual(moveScene(after,0,-1),after);
 assert.deepEqual(moveScene(after,2,1),after);
});
test("individual duration follows the scene when reordered",()=>{
 let edits=setSceneDuration(initialSceneEdits(scenes),2,10);
 edits=moveScene(edits,1,-1);
 assert.deepEqual(applySceneEdits(scenes,edits).map(s=>editedSceneSeconds(s,6)),[10,6,6]);
 edits=setSceneDuration(edits,2,null);
 assert.deepEqual(applySceneEdits(scenes,edits).map(s=>editedSceneSeconds(s,6)),[6,6,6]);
});
test("invalid ordering cannot duplicate or remove scenes",()=>{
 const wrong=[{number:1,duration:3},{number:1,duration:6},{number:3,duration:10}];
 assert.deepEqual(applySceneEdits(scenes,wrong).map(s=>s.number),[1,2,3]);
 assert.deepEqual(applySceneEdits(scenes,[]).map(s=>s.number),[1,2,3]);
});
test("automatic duration stays within eight to thirty seconds",()=>{
 assert.equal(editedSceneSeconds({...scenes[0],seconds:2},"auto"),8);
 assert.equal(editedSceneSeconds({...scenes[0],seconds:90},"auto"),30);
 assert.equal(editedSceneSeconds({...scenes[0],seconds:NaN},"auto"),8);
});
test("studio passes the edited scenes to export and keeps original playback",()=>{
 const studio=read("../src/CartoonStudio.tsx");
 assert.ok(studio.includes("recordLocalMontage(edited,duration"));
 assert.ok(studio.includes("const total=edited.reduce"));
 assert.ok(studio.includes("const current=scenes[index]"));
 assert.ok(studio.includes("setEdits(initialSceneEdits(scenes))"));
});
