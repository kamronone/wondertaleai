import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {transform} from "esbuild";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const source=read("../src/reader_speech_highlight.ts");
const app=read("../src/main.tsx");
const css=read("../src/reader-mobile-v1.css");
const {code}=await transform(source,{loader:"ts",format:"esm",target:"es2022"});
const {spokenWordRange,spokenTextParts}=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));

test("narration word boundaries retain exact original text in RU, UZ and English",()=>{
 for(const [text,start,expected] of [
  ["Однажды Красная Шапочка пошла домой.",8,"Красная"],
  ["Cho'chqacha g'isht qo'ydi.",12,"g'isht"],
  ["Three little pigs built a house.",6,"little"]
 ]){
  const index=text.indexOf(expected);
  assert.equal(index,start);
  const range=spokenWordRange(text,start);
  assert.ok(range);
  const parts=spokenTextParts(text,range);
  assert.equal(parts.active,expected);
  assert.equal(parts.before+parts.active+parts.after,text);
 }
});

test("empty, missing, invalid or punctuation-only boundary never claims a spoken word",()=>{
 assert.equal(spokenWordRange("",0),null);
 assert.equal(spokenWordRange("Hi",2),null);
 assert.equal(spokenWordRange("Hi",-1),null);
 assert.equal(spokenWordRange("Hi",NaN),null);
 assert.equal(spokenWordRange("Hi",0,-1),null);
 assert.equal(spokenWordRange("!!! hi",0,3),null);
 assert.deepEqual(spokenTextParts("A story",null),{before:"A story",active:"",after:""});
});

test("SpeechSynthesis boundary event only highlights while active, and always resets",()=>{
 assert.match(app,/utterance\.onboundary=event=>/);
 assert.match(app,/event\.name==="sentence"/);
 assert.match(app,/setSpokenRange\(spokenWordRange\(utterance\.text,event\.charIndex,event\.charLength\)\)/);
 assert.match(app,/setSpokenRange\(null\)/);
 assert.match(app,/className="wt-spoken-word"/);
 assert.match(css,/\.wt-spoken-word\{/);
 assert.match(css,/\.reader-night \.story-text \.wt-spoken-word/);
 assert.match(app,/speechAdvanceArmed\.current&&readerAutoNext/);
});
