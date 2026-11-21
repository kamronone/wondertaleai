import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {transform} from "esbuild";

const load=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const source=load("../src/reader_voice_choices.ts");
const app=load("../src/main.tsx");
const css=load("../src/reader-mobile-v1.css");
const {code}=await transform(source,{loader:"ts",format:"esm",target:"es2022"});
const {voicesForStoryLanguage,preferredStoryVoice,parseStoredVoiceChoices}=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));
const voices=[
 {name:"English voice",lang:"en-US",voiceURI:"english"},
 {name:"Russian voice",lang:"ru-RU",voiceURI:"russian"},
 {name:"Uzbek voice",lang:"uz-UZ",voiceURI:"uzbek"},
 {name:"Russian alternative",lang:"ru",voiceURI:"russian-two"},
 {name:"German voice",lang:"de-DE",voiceURI:"german"}
];
test("voice selection never chooses an unrelated language",()=>{
 assert.deepEqual(voicesForStoryLanguage(voices,"uz").map(v=>v.voiceURI),["uzbek"]);
 assert.deepEqual(voicesForStoryLanguage(voices,"ru").map(v=>v.voiceURI),["russian","russian-two"]);
 assert.deepEqual(voicesForStoryLanguage(voices,"en").map(v=>v.voiceURI),["english"]);
 assert.equal(preferredStoryVoice(voices,"uz","english")?.voiceURI,"uzbek");
 assert.equal(preferredStoryVoice(voices,"ru","russian-two")?.voiceURI,"russian-two");
 assert.equal(preferredStoryVoice(voices.filter(v=>v.lang!=="uz-UZ"),"uz",null),null);
});
test("saved voice selection contains only expected string fields",()=>{
 assert.deepEqual(parseStoredVoiceChoices(null),{ru:"",uz:"",en:""});
 assert.deepEqual(parseStoredVoiceChoices("[]"),{ru:"",uz:"",en:""});
 assert.deepEqual(parseStoredVoiceChoices('{"ru":"russian-two","en":42,"uz":"uzbek"}'),{ru:"russian-two",uz:"uzbek",en:""});
 assert.equal(parseStoredVoiceChoices("invalid").ru,"");
});
test("iOS voice availability changes refresh the selector",()=>{
 assert.match(app,/engine\.addEventListener\?\.\("voiceschanged",refresh\)/);
 assert.match(app,/engine\.removeEventListener\?\.\("voiceschanged",refresh\)/);
 assert.match(app,/document\.addEventListener\("visibilitychange",onVisible\)/);
 assert.match(app,/getVoices\(\)/);
});
test("voice selector is native and does not change story language",()=>{
 assert.match(app,/id="reader-voice-select"/);
 assert.match(app,/voicesForStoryLanguage\(deviceVoices,narrationLanguage\)/);
 assert.match(app,/preferredStoryVoice\(availableVoices,narrationLanguage,voiceChoices\[narrationLanguage\]\)/);
 assert.match(app,/if\(!voice\)\{\s*setError\(t\.noVoice\);\s*return;/);
 assert.match(css,/\.reader-voice-choice select\{/);
 assert.match(css,/min-height:44px/);
 assert.doesNotMatch(source,/fetch\(|Authorization|privateToken/);
});
