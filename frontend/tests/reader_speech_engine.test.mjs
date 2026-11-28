import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {transform} from "esbuild";

const source=readFileSync(new URL("../src/reader_speech_engine.ts",import.meta.url),"utf8");
const compiled=await transform(source,{loader:"ts",format:"esm",target:"es2022"});
const {pausedSpeechAction}=await import("data:text/javascript;base64,"+Buffer.from(compiled.code).toString("base64"));
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");

test("Safari resume only operates on a still-present paused utterance",()=>{
 assert.equal(pausedSpeechAction({speaking:true,paused:true,pending:false}),"resume");
 assert.equal(pausedSpeechAction({speaking:false,paused:false,pending:false}),"restart");
 assert.equal(pausedSpeechAction({speaking:false,paused:true,pending:false}),"restart");
 assert.equal(pausedSpeechAction({speaking:false,paused:false,pending:true}),"restart");
});

test("lost paused speech is cancelled before a fresh utterance starts from the checkpoint",()=>{
 assert.match(app,/const action=speechPaused\?pausedSpeechAction\(engine\):"pause"/);
 assert.match(app,/if\(action==="restart"\)\{\s*speechRun\.current\+\+;/);
 assert.match(app,/speechAdvanceArmed\.current=false;\s*try\{engine\.cancel\(\)/);
 assert.match(app,/setSpeaking\(false\);setSpeechPaused\(false\);\s*\}else\{/);
 assert.match(app,/const run=\+\+speechRun\.current/);
 assert.match(app,/speechStartOffset\(active\.id,page,fullText,speechBookmark\.current\)/);
});

test("valid pause and resume retain their normal native iPhone behavior",()=>{
 assert.match(app,/if\(action==="resume"\)\{engine\.resume\(\);setSpeechPaused\(false\);\}/);
 assert.match(app,/else\{engine\.pause\(\);setSpeechPaused\(true\);\}/);
 assert.match(app,/if\(run!==speechRun\.current\)return/);
 assert.match(app,/speechBookmark\.current=null;\s*setSpeechResumeAvailable\(false\)/);
});

test("audio recovery requires no new network, browser storage or additional permissions",()=>{
 assert.doesNotMatch(source,/fetch\(|localStorage|sessionStorage|Authorization|privateToken/);
 assert.doesNotMatch(source,/setTimeout|setInterval/);
});
