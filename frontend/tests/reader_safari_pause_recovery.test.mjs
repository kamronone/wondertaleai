import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");

test("Safari pauses and resumes live speech without creating a second utterance",()=>{
 assert.match(app,/const action=speechPaused\?pausedSpeechAction\(engine\):"pause"/);
 assert.match(app,/if\(action==="resume"\)\{engine\.resume\(\);setSpeechPaused\(false\);\}/);
 assert.match(app,/else\{engine\.pause\(\);setSpeechPaused\(true\);\}/);
});

test("Safari discarded utterance restarts at the last safe speech checkpoint",()=>{
 assert.match(app,/if\(action==="restart"\)\{\s*speechRun\.current\+\+;/);
 assert.match(app,/speechAdvanceArmed\.current=false;\s*try\{engine\.cancel\(\);\}catch/);
 assert.match(app,/const resumeOffset=speechStartOffset\(active\.id,page,fullText,speechBookmark\.current\)/);
 assert.match(app,/new SpeechSynthesisUtterance\(fullText\.slice\(resumeOffset\)\)/);
});

test("native pause/resume exceptions reset visible audio state",()=>{
 assert.match(app,/setSpeechResumeAvailable\(speechBookmark\.current!==null\);\s*setSpokenRange\(null\);setSpeaking\(false\);setSpeechPaused\(false\);\s*setError\(t\.noVoice\)/);
});
