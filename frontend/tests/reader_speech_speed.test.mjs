import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/reader-mobile-v1.css",import.meta.url),"utf8");

test("speech speeds persist locally and are applied to the current page narration",()=>{
 assert.match(app,/useState<"slow"\|"normal"\|"fast">/);
 assert.match(app,/localStorage\.getItem\("wondertale_reader_speech_speed"\)/);
 assert.match(app,/localStorage\.setItem\("wondertale_reader_speech_speed",readerSpeechSpeed\)/);
 assert.match(app,/utterance\.rate=\(\{slow:\.75,normal:\.9,fast:1\.1\} as const\)\[readerSpeechSpeed\]/);
});
test("reader shows three accessible speeds in the existing settings and stops speech before changes",()=>{
 assert.match(app,/className="reader-speech-speed"/);
 assert.match(app,/\["slow","normal","fast"\] as const/);
 assert.match(app,/aria-pressed=\{readerSpeechSpeed===speed\}/);
 assert.match(app,/speechRun\.current\+\+;speechAdvanceArmed\.current=false;window\.speechSynthesis\.cancel\(\);setSpeaking\(false\);setSpeechPaused\(false\);\}setReaderSpeechSpeed\(speed\)/);
 assert.match(app,/Текущую озвучку|Изменение скорости остановит текущую озвучку/);
});
test("mobile speed options remain compact, non-overflowing and iPhone tap-sized",()=>{
 assert.match(css,/\.reader-speech-speed>div\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/s);
 assert.match(css,/\.reader-speech-speed button\{[^}]*min-height:44px/s);
 assert.match(css,/\.reader-speech-speed button:focus-visible/);
});

test("automatic page turning is explicit, bounded, and disabled by default",()=>{
 assert.match(app,/localStorage\.getItem\("wondertale_reader_auto_next"\)==="true"/);
 assert.match(app,/localStorage\.setItem\("wondertale_reader_auto_next",String\(readerAutoNext\)\)/);
 assert.match(app,/checked=\{readerAutoNext\}/);
 assert.match(app,/speechAdvanceArmed\.current&&readerAutoNext&&tab==="reader"&&page<active\.pages\.length-1/);
 assert.match(app,/setPage\(previous=>Math\.min\(active\.pages\.length-1,previous\+1\)\)/);
 assert.match(app,/speechAdvanceArmed\.current=false/);
 assert.match(css,/\.reader-auto-next\{/);
});
