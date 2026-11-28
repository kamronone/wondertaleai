import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");

test("AI story creation supplies a per-request idempotency key",()=>{
  assert.match(app,/crypto\.randomUUID\(\)\.replaceAll\("-",\s*""\)/);
  assert.match(app,/"Idempotency-Key":key/);
  assert.match(app,/aiRetry\.current=\{token:privateToken,payload,key\}/);
});

test("AI retry key is reused only for the same parent session and identical payload",()=>{
  assert.match(app,/aiRetry\.current\?\.token===privateToken&&aiRetry\.current\.payload===payload/);
  assert.match(app,/const aiAccess=safeRetry\?"ready":await checkAiStoryAccess\(API,privateToken\)/);
  assert.match(app,/retry\?\.token===privateToken&&retry\.payload===payload/);
});

test("logout and account changes clear retry tokens",()=>{
  const reset=(app.match(/aiRetry\.current=null;/g)||[]).length;
  assert.ok(reset>=3,"account login, logout and successful generation must clear retry state");
});
