import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
test("Safari speech pause/resume errors reset state rather than leaving playback stuck",()=>{
  assert.match(app,/if\(speaking\)\{\s*try\{\s*if\(speechPaused\)\{engine\.resume\(\);setSpeechPaused\(false\);\}/);
  assert.match(app,/else\{engine\.pause\(\);setSpeechPaused\(true\);\}/);
  assert.match(app,/speechRun\.current\+\+;\s*speechAdvanceArmed\.current=false;\s*try\{engine\.cancel\(\);\}catch/);
  assert.match(app,/setSpokenRange\(null\);setSpeaking\(false\);setSpeechPaused\(false\);\s*setError\(t\.noVoice\)/);
});
