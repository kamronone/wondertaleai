import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const src=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");

test("each narration has a generation token so old end events cannot turn pages",()=>{
 assert.match(src,/const speechRun=useRef\(0\)/);
 assert.match(src,/const run=\+\+speechRun\.current/);
 assert.match(src,/utterance\.onend=\(\)=>\{\s*if\(run!==speechRun\.current\)return;/);
 assert.match(src,/utterance\.onerror=event=>\{\s*if\(run!==speechRun\.current\)return;/);
 assert.match(src,/if\(run!==speechRun\.current\|\|!speechAdvanceArmed\.current\|\|event\.name==="sentence"\)return;/);
 assert.match(src,/if\(mayAdvance\)setPage/);
});
test("Safari backgrounding and pagehide safely reset speech without autoskip",()=>{
 assert.match(src,/document\.addEventListener\("visibilitychange",stopOnBackground\)/);
 assert.match(src,/window\.addEventListener\("pagehide",onPageHide\)/);
 assert.match(src,/onPageHide=\(\)=>stopOnBackground\(true\)/);
 assert.match(src,/if\(!force&&document\.visibilityState!=="hidden"\)return/);
 assert.match(src,/speechRun\.current\+\+;[\s\S]{0,120}speechAdvanceArmed\.current=false/);
 assert.match(src,/document\.removeEventListener\("visibilitychange",stopOnBackground\)/);
 assert.match(src,/window\.removeEventListener\("pagehide",onPageHide\)/);
});
test("narration start exceptions restore buttons and show existing voice failure",()=>{
 assert.match(src,/try\{\s*engine\.speak\(utterance\)/);
 assert.match(src,/catch\{\s*if\(run===speechRun\.current\)/);
 assert.match(src,/setError\(t\.noVoice\)/);
 assert.match(src,/const stopSpeech=\(\)=>\{\s*speechRun\.current\+\+/);
});
