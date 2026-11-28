import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const panel=readFileSync(new URL("../src/AiJobsPanel.tsx",import.meta.url),"utf8");
const transport=readFileSync(new URL("../src/ai_jobs.ts",import.meta.url),"utf8");
const styles=readFileSync(new URL("../src/ai-jobs.css",import.meta.url),"utf8");

test("active AI jobs refresh status without creating another paid generation",()=>{
 assert.match(panel,/job\.status==="queued"\|\|job\.status==="processing"/);
 assert.match(panel,/window\.setInterval\(\(\)=>\{/);
 assert.match(panel,/\},15000\)/);
 assert.match(panel,/setRevision\(value=>value\+1\)/);
 assert.match(panel,/document\.visibilityState==="visible"&&navigator\.onLine/);
 assert.match(panel,/document\.addEventListener\("visibilitychange",onVisible\)/);
 assert.match(panel,/window\.addEventListener\("online",onVisible\)/);
 assert.match(panel,/window\.clearInterval\(timer\)/);
 assert.doesNotMatch(panel,/enqueueAiJob|\/api\/books\/generate/);
 assert.match(transport,/api\+"\/api\/ai\/jobs"/);
});

test("background updates preserve visible queue cards; session switch resets ownership",()=>{
 assert.match(panel,/loadedIdentity=useRef\(""/);
 assert.match(panel,/if\(loadedIdentity\.current!==identity\)\{/);
 assert.match(panel,/setJobs\(\[\]\)/);
 assert.match(panel,/setError\("".*\);/);
 assert.match(panel,/setLoading\(true\)/);
 assert.match(panel,/\[api,session,reload,revision,refreshVersion\]/);
 assert.match(panel,/return \(\)=>\{\+\+epoch\.current;controller\.abort\(\);\}/);
});

test("polling is stopped on completion, failure and background operation",()=>{
 assert.match(panel,/if\(!pending\|\|loading\|\|error\)return/);
 assert.match(panel,/document\.removeEventListener\("visibilitychange",onVisible\)/);
 assert.match(panel,/window\.removeEventListener\("online",onVisible\)/);
 assert.match(panel,/ai-jobs-auto-refresh/);
 assert.match(styles,/\.ai-jobs-auto-refresh/);
});
