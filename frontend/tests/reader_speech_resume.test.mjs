import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {transform} from "esbuild";

const source=readFileSync(new URL("../src/reader_speech_resume.ts",import.meta.url),"utf8");
const {code}=await transform(source,{loader:"ts",format:"esm",target:"es2022"});
const {speechStartOffset,speechBoundaryBookmark}=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));
const reader=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");

test("speech resumes at the start of last confirmed word without dropping characters",()=>{
 const text="The storyteller described the beautiful forest and the little river.";
 const offset=text.indexOf("beautiful")+4;
 const mark=speechBoundaryBookmark("book-a",4,text,offset);
 assert.ok(mark);
 const start=speechStartOffset("book-a",4,text,mark);
 assert.equal(start,text.indexOf("beautiful"));
 assert.ok(text.slice(start).startsWith("beautiful forest"));
});

test("speech position is owner and chapter scoped and never survives a wrong page",()=>{
 const text="The next adventure starts in the quiet woods.";
 const checkpoint=speechBoundaryBookmark("private-book-a",3,text,15);
 assert.ok(checkpoint);
 assert.equal(speechStartOffset("private-book-b",3,text,checkpoint),0);
 assert.equal(speechStartOffset("private-book-a",4,text,checkpoint),0);
 assert.equal(speechStartOffset("private-book-a",3,text,null),0);
});

test("missing Safari boundary safely restarts the current page",()=>{
 const text="A gentle long story read aloud with native device voices.";
 assert.equal(speechBoundaryBookmark("book",0,text,0),null);
 assert.equal(speechBoundaryBookmark("book",0,text,text.length),null);
 assert.equal(speechBoundaryBookmark("book",0,text,NaN),null);
 assert.equal(speechBoundaryBookmark("book",-1,text,12),null);
 assert.equal(speechStartOffset("book",0,text,{bookId:"book",page:0,offset:-2}),0);
 assert.equal(speechStartOffset("book",0,text,{bookId:"book",page:0,offset:999}),0);
});

test("resume is bounded to current voice run and keeps absolute highlight positions",()=>{
 assert.match(reader,/const resumeOffset=speechStartOffset\(active\.id,page,fullText,speechBookmark\.current\)/);
 assert.match(reader,/new SpeechSynthesisUtterance\(fullText\.slice\(resumeOffset\)\)/);
 assert.match(reader,/const absoluteIndex=resumeOffset\+event\.charIndex/);
 assert.match(reader,/spokenWordRange\(fullText,absoluteIndex,event\.charLength\)/);
 assert.match(reader,/if\(run!==speechRun\.current\|\|!speechAdvanceArmed\.current\|\|event\.name==="sentence"\)return/);
 assert.match(reader,/speechBookmark\.current=null/);
 assert.match(reader,/speechResumeAvailable\?\(\{ru:"Продолжить слушать"/);
});

test("no speech checkpoint is written to persistent storage or sent to API",()=>{
 assert.doesNotMatch(source,/localStorage|sessionStorage|fetch\(|Authorization|privateToken/);
 assert.match(reader,/setSpeechResumeAvailable\(speechBookmark\.current!==null\)/);
 assert.match(reader,/speechBookmark\.current=null;\s*setSpeechResumeAvailable\(false\)/);
});
