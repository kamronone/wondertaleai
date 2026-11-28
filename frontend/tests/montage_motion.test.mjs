import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {transform} from "esbuild";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const {code}=await transform(read("../src/montage_motion.ts"),{loader:"ts",format:"esm",target:"es2022"});
const {montageFrame}=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));
test("still mode preserves full frame without transitions",()=>{
 for(const p of [0,.5,1,NaN])assert.deepEqual(montageFrame(p,2,"still"),{x:0,y:0,width:640,height:480,previousOpacity:0});
});
test("cinematic framing always covers the canvas and uses a bounded zoom",()=>{
 for(const index of [0,1,2])for(let n=0;n<=100;n++){
  const f=montageFrame(n/100,index,"cinematic");
  assert.ok(f.x<=0&&f.y<=0&&f.x+f.width>=640&&f.y+f.height>=480);
  assert.ok(f.width<=640*1.046&&f.height<=480*1.046);
 }
});
test("crossfade is limited to the beginning of subsequent scenes",()=>{
 assert.equal(montageFrame(0,0,"cinematic").previousOpacity,0);
 assert.equal(montageFrame(0,1,"cinematic").previousOpacity,1);
 assert.equal(montageFrame(.06,1,"cinematic").previousOpacity,.5);
 assert.equal(montageFrame(.12,1,"cinematic").previousOpacity,0);
 assert.equal(montageFrame(1,2,"cinematic").previousOpacity,0);
});
test("export restores opacity before drawing captions and keeps effects optional",()=>{
 const source=read("../src/CartoonStudio.tsx");
 assert.ok(source.includes('useState<MontageMotion>("still")'));
 assert.ok(source.includes("montageFrame(fraction,i,motion)"));
 assert.match(source,/ctx\.globalAlpha=1;\s*\}\s*if\(pages.length\)/);
 assert.ok(source.includes('motion==="cinematic"?42:100'));
});
