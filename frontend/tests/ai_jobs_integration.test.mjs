import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const main=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const panel=readFileSync(new URL("../src/AiJobsPanel.tsx",import.meta.url),"utf8");
const api=readFileSync(new URL("../src/ai_jobs.ts",import.meta.url),"utf8");

test("queue is explicitly off by default and does not replace existing AI generation",()=>{
  assert.match(main,/VITE_ENABLE_AI_JOB_QUEUE==="true"/);
  assert.match(main,/if\(AI_JOBS_ENABLED\)\{/);
  assert.match(main,/const response=await fetch\(API\+"\/api\/books\/generate"/);
});
test("queue is only shown to signed-in parents and scoped to their session",()=>{
  assert.match(main,/AI_JOBS_ENABLED&&privateToken&&API&&<AiJobsPanel key=\{privateToken\}/);
  assert.match(panel,/\[api,session,t\.error\]/);
  assert.match(panel,/controller\.abort\(\)/);
  assert.match(panel,/epoch\.current===expected/);
});
test("queue transport requires a bearer session and avoids caching",()=>{
  assert.match(api,/Authorization:"Bearer "\+token/g);
  assert.match(api,/cache:"no-store"/g);
  assert.match(api,/Idempotency-Key":key/);
  assert.match(api,/\/api\/ai\/jobs/);
});
test("only queued jobs can be canceled and completed jobs open the library",()=>{
  assert.match(panel,/job\.status==="queued"/);
  assert.match(panel,/job\.status==="completed"/);
  assert.match(panel,/cancelAiJob\(api,session,job\.id/);
  assert.match(main,/setAiJobsRefresh\(v=>v\+1\)/);
});
