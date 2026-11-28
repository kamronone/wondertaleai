import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {transform} from "esbuild";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const {code}=await transform(read("../src/cartoon_narration.ts"),{loader:"ts",format:"esm",target:"es2022"});
const {narrationPlaybackSeconds,stopNarrationTracks,prepareNarration,playNarration,MAX_NARRATION_BYTES,prepareSceneNarrations,MAX_DECODED_NARRATION_BYTES}=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));
test("voice duration is bounded by the video and recording limit",()=>{
 assert.equal(narrationPlaybackSeconds(30,10),10);
 assert.equal(narrationPlaybackSeconds(10,30),10);
 assert.equal(narrationPlaybackSeconds(150,150),120);
 for(const value of [NaN,Infinity,0,-1])assert.equal(narrationPlaybackSeconds(value,30),0);
});
test("all microphone tracks are stopped",()=>{
 let stopped=0;
 stopNarrationTracks({getTracks:()=>[{stop:()=>stopped++},{stop:()=>stopped++}]});
 stopNarrationTracks(null);
 assert.equal(stopped,2);
});
test("invalid narration is rejected before audio decoding",async()=>{
 const audio={decodeAudioData:()=>{throw Error("Unexpected decoder call");}};
 for(const blob of [new Blob([], {type:"audio/mp4"}),new Blob(["video"],{type:"video/mp4"}),new Blob([new Uint8Array(MAX_NARRATION_BYTES+1)],{type:"audio/mp4"})]){
  await assert.rejects(prepareNarration(audio,blob),/Invalid narration/);
 }
});
test("decoded narration is duration checked",async()=>{
 const blob=new Blob(["audio"],{type:"audio/mp4"});
 const buffer={duration:25};
 assert.equal(await prepareNarration({decodeAudioData:async()=>buffer},blob),buffer);
 await assert.rejects(prepareNarration({decodeAudioData:async()=>({duration:500})},blob),/Invalid narration duration/);
});
test("voice is routed only to the export destination",()=>{
 let start,connected;
 const gain={gain:{value:0},connect:target=>{connected=target;},disconnect:()=>{}};
 const source={connect:()=>gain,disconnect:()=>{},start:(...args)=>{start=args;}};
 const audio={currentTime:4,createBufferSource:()=>source,createGain:()=>gain};
 const destination={};
 playNarration(audio,destination,{duration:30},10);
 assert.equal(connected,destination);
 assert.deepEqual(start,[4,0,10]);
 assert.equal(gain.gain.value,.78);
});
test("recording is consent gated, local and cancelled on visibility change",()=>{
 const component=read("../src/CartoonNarration.tsx"),studio=read("../src/CartoonStudio.tsx");
 assert.match(component,/!consent\|\|disabled\|\|document.hidden/);
 assert.match(component,/getUserMedia\(\{audio:true,video:false\}\)/);
 assert.match(component,/if\(document.hidden\)stop\(true\)/);
 assert.match(component,/stopNarrationTracks\(job.stream\)/);
 assert.match(component,/URL.revokeObjectURL\(url\)/);
 assert.doesNotMatch(component,/fetch\(|localStorage|sessionStorage|indexedDB/);
 assert.match(studio,/playNarration\(audio,destination,narrationBuffer,totalSeconds\)/);
 assert.match(studio,/disabled=\{recording\}/);
});

test("separate voice clips follow original scene numbers after reordering",async()=>{
 const clips=new Map([[1,new Blob(["one"],{type:"audio/mp4"})],[3,new Blob(["three"],{type:"audio/mp4"})]]);
 const calls=[];
 const audio={decodeAudioData:async bytes=>{const text=new TextDecoder().decode(bytes);calls.push(text);return {duration:3,length:72000,numberOfChannels:1,text};}};
 const result=await prepareSceneNarrations(audio,clips,[3,2,1],new AbortController().signal);
 assert.deepEqual(calls,["three","one"]);
 assert.equal(result.get(3).text,"three");
 assert.equal(result.get(1).text,"one");
 assert.equal(result.has(2),false);
});
test("scene voice decoding rejects duplicates, excessive duration, memory and cancellation",async()=>{
 const clips=new Map([[1,new Blob(["one"],{type:"audio/mp4"})]]);
 const signal=new AbortController().signal;
 const audio={decodeAudioData:async()=>({duration:40,length:10,numberOfChannels:1})};
 await assert.rejects(prepareSceneNarrations(audio,clips,[1,1],signal),/Invalid narration scene list/);
 await assert.rejects(prepareSceneNarrations(audio,clips,[1],signal),/duration limit/);
 await assert.rejects(prepareSceneNarrations({decodeAudioData:async()=>({duration:3,length:MAX_DECODED_NARRATION_BYTES,numberOfChannels:1})},clips,[1],signal),/Decoded scene narration limit/);
 const cancelled=new AbortController();cancelled.abort();
 await assert.rejects(prepareSceneNarrations(audio,clips,[1],cancelled.signal),/Cancelled/);
});
test("each voice clip is played for its scene and the two modes are exclusive",()=>{
 const studio=read("../src/CartoonStudio.tsx");
 assert.ok(studio.includes("sceneBuffers.get(scene.number)"));
 assert.ok(studio.includes("playNarration(audio,destination,clip,seconds)"));
 assert.ok(studio.includes('if(narration&&sceneClips.size)throw Error'));
 assert.ok(studio.includes('narrationMode==="whole"?narration:null'));
 assert.ok(studio.includes("sceneText={selectedScene.text}"));
});
