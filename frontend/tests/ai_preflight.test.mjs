import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transform } from "esbuild";

const source=readFileSync(new URL("../src/ai_preflight.ts",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const {code}=await transform(source,{loader:"ts",format:"esm",target:"es2022"});
const {checkAiStoryAccess}=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));

const mocked=(status,body)=>async (url,options)=>{
  assert.equal(url,"https://api.example.com/api/billing/status");
  assert.equal(options.method,"GET");
  assert.equal(options.cache,"no-store");
  assert.equal(options.headers.Authorization,"Bearer test-token");
  assert.equal(options.body,undefined,"Preflight must not send personal details");
  return {status,ok:status>=200&&status<300,json:async()=>body};
};

test("preflight requires a validated parent session",async()=>{
  assert.equal(await checkAiStoryAccess("","test-token"),"login");
  assert.equal(await checkAiStoryAccess("https://api.example.com",""),"login");
  assert.equal(await checkAiStoryAccess("https://api.example.com","test-token",mocked(401,{})),"login");
  assert.equal(await checkAiStoryAccess("https://api.example.com","test-token",mocked(403,{})),"not-allowed");
});

test("pilot eligibility is checked before spending any AI quota",async()=>{
  const api="https://api.example.com",token="test-token";
  assert.equal(await checkAiStoryAccess(api,token,mocked(200,{ai_pilot_access:false,ai_remaining_today:2})),"not-allowed");
  assert.equal(await checkAiStoryAccess(api,token,mocked(200,{ai_pilot_access:true,ai_remaining_today:0})),"limit");
  assert.equal(await checkAiStoryAccess(api,token,mocked(200,{ai_pilot_access:true,ai_remaining_today:2})),"ready");
});

test("malformed, missing or unreachable billing status fails closed",async()=>{
  const api="https://api.example.com",token="test-token";
  for(const body of [null,{}, {ai_pilot_access:true},{ai_pilot_access:true,ai_remaining_today:-1}]){
    assert.equal(await checkAiStoryAccess(api,token,mocked(200,body)),"unavailable");
  }
  assert.equal(await checkAiStoryAccess(api,token,mocked(503,{})),"unavailable");
  assert.equal(await checkAiStoryAccess(api,token,async()=>{throw Error("offline");}),"unavailable");
});

test("creator performs entitlement check before posting a child's story",()=>{
  assert.match(app,/import \{ checkAiStoryAccess \} from "\.\/ai_preflight"/);
  const check=app.indexOf("await checkAiStoryAccess(API,privateToken)");
  const submit=app.indexOf('await fetch(API+"/api/books/generate"');
  assert.ok(check>=0&&submit>check);
  assert.match(app,/if\(sessionEpoch\.current!==epoch\)return;/);
});
