import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {transform} from "esbuild";

const source=readFileSync(new URL("../src/reader_audio_sequence.ts",import.meta.url),"utf8");
const {code}=await transform(source,{loader:"ts",format:"esm",target:"es2022"});
const {canAutoAdvanceAudio,consumeAudioAdvanceTarget}=await import(
 "data:text/javascript;base64,"+Buffer.from(code).toString("base64")
);
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const base={page:0,pageCount:20,classicId:undefined,giftsEnabled:false,focusMode:false,nightMode:false,bedtimeActive:false,hasGift:false};

test("twenty chapter story may progress one page at a time but never past its ending",()=>{
 for(let p=0;p<19;p++)assert.equal(canAutoAdvanceAudio({...base,page:p}),true);
 assert.equal(canAutoAdvanceAudio({...base,page:19}),false);
 assert.equal(canAutoAdvanceAudio({...base,page:20}),false);
 assert.equal(canAutoAdvanceAudio({...base,page:-1}),false);
 assert.equal(canAutoAdvanceAudio({...base,page:1.5}),false);
 assert.equal(canAutoAdvanceAudio({...base,pageCount:0}),false);
});

test("a visible brick or gift scene interrupts automatic narration so the child can interact",()=>{
 assert.equal(canAutoAdvanceAudio({...base,page:3,pageCount:8,classicId:"three-pigs"}),false);
 assert.equal(canAutoAdvanceAudio({...base,page:1,pageCount:8,classicId:"hansel-gretel",hasGift:true,giftsEnabled:true}),false);
 assert.equal(canAutoAdvanceAudio({...base,page:1,pageCount:8,classicId:"hansel-gretel",hasGift:true,giftsEnabled:false}),true);
 assert.equal(canAutoAdvanceAudio({...base,page:3,pageCount:8,classicId:"three-pigs",focusMode:true}),true);
 assert.equal(canAutoAdvanceAudio({...base,page:3,pageCount:8,classicId:"three-pigs",nightMode:true}),true);
 assert.equal(canAutoAdvanceAudio({...base,page:3,pageCount:8,classicId:"three-pigs",bedtimeActive:true}),true);
});

test("only the right book and chapter can consume a pending audio transition",()=>{
 const target={bookId:"book-a",page:6};
 assert.equal(consumeAudioAdvanceTarget(target,"book-a",6),true);
 assert.equal(consumeAudioAdvanceTarget(target,"book-b",6),false);
 assert.equal(consumeAudioAdvanceTarget(target,"book-a",7),false);
 assert.equal(consumeAudioAdvanceTarget(null,"book-a",6),false);
});

test("auto-play triggers after cleanup, not within the obsolete speech callback",()=>{
 const cleanup=app.indexOf("if(!autoAudioTarget.current||autoAudioTarget.current.bookId");
 const replay=app.indexOf("const target=autoAudioTarget.current;");
 assert.ok(cleanup>0&&replay>cleanup);
 assert.match(app,/autoAudioTarget\.current=\{bookId:active\.id,page:page\+1\}/);
 assert.match(app,/if\(tab!=="reader"\|\|!readerAutoNext\|\|!active\|\|!consumeAudioAdvanceTarget\(target,active\.id,page\)\|\|document\.visibilityState==="hidden"\)return/);
 assert.match(app,/\},\[tab,page,active\?\.id,readerAutoNext\]\)/);
 assert.match(app,/const run=\+\+speechRun\.current/);
 assert.match(app,/autoAudioTarget\.current=null;\s*speechRun\.current\+\+/);
});

test("continuous playback does not touch private stories or consume paid AI capacity",()=>{
 assert.doesNotMatch(source,/fetch\(|localStorage|sessionStorage|Authorization|privateToken/);
 assert.doesNotMatch(source,/setInterval|setTimeout/);
});
