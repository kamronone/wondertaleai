import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {build} from "esbuild";
const {outputFiles}=await build({
 entryPoints:[fileURLToPath(new URL("../src/cartoon_storyboard.ts",import.meta.url))],
 bundle:true,write:false,format:"esm",platform:"node",target:"es2022",
 define:{__RAPUNZEL_PNG_READY__:"false",__SNOW_WHITE_PNG_READY__:"false"}
});
const {buildClassicCartoon,sceneDuration,nextCartoonScene}=await import("data:text/javascript;base64,"+Buffer.from(outputFiles[0].text).toString("base64"));
const read=file=>readFileSync(new URL(file,import.meta.url),"utf8");

test("classic cartoon produces eight ordered scenes with local art in three languages",()=>{
 for(const lang of ["ru","uz","en"]){
  for(const id of ["three-pigs","red-hood","cinderella","snow-white","rapunzel"]){
   const scenes=buildClassicCartoon(id,lang);
   assert.equal(scenes.length,8);
   for(const [i,scene] of scenes.entries()){
    assert.equal(scene.number,i+1);
    assert.ok(scene.text.trim().length>10);
    assert.ok(scene.image.startsWith("/images/classics/")||scene.image.startsWith("data:image/svg+xml"));
    assert.ok(scene.seconds>=8&&scene.seconds<=120);
   }
  }
 }
 assert.deepEqual(buildClassicCartoon("unknown","ru"),[]);
 assert.ok(buildClassicCartoon("three-pigs","ru").some(s=>s.animation?.endsWith(".gif")));
 assert.notEqual(buildClassicCartoon("three-pigs","ru")[0].text,buildClassicCartoon("three-pigs","en")[0].text);
});
test("scene navigation and timing are bounded",()=>{
 assert.equal(nextCartoonScene(0,8),1);
 assert.equal(nextCartoonScene(7,8),null);
 assert.equal(nextCartoonScene(-1,8),null);
 assert.equal(nextCartoonScene(1.5,8),null);
 assert.equal(sceneDuration(""),8);
 assert.equal(sceneDuration("word ".repeat(10000)),120);
});
test("studio is lazy-loaded and local-only; narration stops when leaving or hiding page",()=>{
 const app=read("../src/main.tsx"),studio=read("../src/CartoonStudio.tsx"),storyboard=read("../src/cartoon_storyboard.ts");
 assert.match(app,/React\.lazy\(\(\)=>import\("\.\/CartoonStudio"\)\)/);
 assert.match(app,/setTab\("cartoons"\)/);
 assert.match(app,/<CartoonStudio lang=\{lang\}/);
 assert.match(studio,/localService===true/);
 assert.match(studio,/visibilitychange/);
 assert.match(studio,/clearInterval/);
 assert.match(studio,/speechSynthesis\.cancel/);
 assert.match(studio,/on-device narration/);
 assert.doesNotMatch(studio,/fetch\(|localStorage|sessionStorage|Authorization|privateToken/);
 assert.doesNotMatch(storyboard,/createDemoBook\(|saveDemoBooks\(|fetch\(/);
});

for(const story of ["three-pigs","red-hood"]){
 test(story+" ships MP4 variants with narrated audio and complete localized captions",()=>{
  const mediaDirectory="../public/cartoons/"+story+"/";
  const timestamp=seconds=>`${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}.000`;
  for(const lang of ["ru","uz","en"]){
   const narrated=readFileSync(new URL(mediaDirectory+"film-"+lang+".mp4",import.meta.url));
   const mediaStart=narrated.indexOf("mdat");
   assert.equal(narrated.toString("ascii",4,8),"ftyp");
   assert.ok(narrated.indexOf("moov")>0&&narrated.indexOf("moov")<mediaStart);
   const metadata=narrated.subarray(0,mediaStart);
   assert.ok(metadata.includes("avc1")&&metadata.includes("mp4a"));
   const [header,...cues]=read(mediaDirectory+lang+".vtt").trim().split("\n\n");
   assert.equal(header,"WEBVTT");
   assert.equal(cues.length,16);
   for(const [i,cue] of cues.entries()){
    const [timing,...lines]=cue.split("\n");
    assert.equal(timing,`${timestamp(i*5)} --> ${timestamp((i+1)*5)}`);
    assert.ok(lines.length>0&&lines.length<=2&&lines.every(line=>line.trim().length>0));
   }
  }
 });
}
