import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {transform} from "esbuild";

const source=readFileSync(new URL("../src/ai_jobs.ts",import.meta.url),"utf8");
const main=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const {code}=await transform(source,{loader:"ts",format:"esm",target:"es2022"});
const {AiQueueError,enqueueAiJob}=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));
const api="https://api.example.com";
const token="parent-token";
const key="abcdefabcdefabcdefabcdefabcdef12";
const job={id:"11111111-2222-4333-8444-555555555555",status:"queued",book_id:null};

async function mockQueue(response,run){
 const old=globalThis.fetch;
 const calls=[];
 globalThis.fetch=async(url,options)=>{
  calls.push({url,options});
  return response;
 };
 try{
  const result=await run();
  return {result,calls};
 }finally{
  globalThis.fetch=old;
 }
}
test("successful enqueue uses parent-only auth, no-store and stable idempotency key",async()=>{
 const {result,calls}=await mockQueue({status:202,json:async()=>job},()=>enqueueAiJob(api,token,{name:"child"},key));
 assert.deepEqual(result,job);
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,api+"/api/books/jobs");
 assert.equal(calls[0].options.headers["Idempotency-Key"],key);
 assert.equal(calls[0].options.headers.Authorization,"Bearer "+token);
 assert.equal(calls[0].options.cache,"no-store");
 assert.equal(calls[0].options.method,"POST");
 assert.equal(calls[0].options.body,JSON.stringify({name:"child"}));
});

test("known HTTP failure statuses become specific typed errors",async()=>{
 const cases=[[401,"login"],[403,"not-allowed"],[429,"limit"],[409,"library-full"],[503,"unavailable"],[502,"unavailable"],[422,"invalid-response"]];
 for(const [status,reason] of cases){
  await mockQueue({status,json:async()=>({detail:"server"})},async()=>{
   await assert.rejects(enqueueAiJob(api,token,{idea:"story"},key),e=>e instanceof AiQueueError&&e.reason===reason);
  });
 }
});

test("malformed successful response is treated as ambiguous, never as permission to regenerate",async()=>{
 await mockQueue({status:202,json:async()=>({status:"queued"})},async()=>{
  await assert.rejects(enqueueAiJob(api,token,{},key),e=>e instanceof AiQueueError&&e.reason==="invalid-response");
 });
 assert.match(main,/aiRetry\.current=\{token:privateToken,payload,key\}/);
 assert.match(main,/const key=retry\?\.token===privateToken&&retry\.payload===payload/);
 assert.match(main,/error instanceof AiQueueError/);
 assert.match(main,/Проверьте очередь в профиле перед повтором/);
});

test("network timeouts are not silently retried as a new charge",async()=>{
 await mockQueue(Promise.reject(new Error("network offline")),async()=>{
  await assert.rejects(enqueueAiJob(api,token,{},key),/network offline/);
 });
 assert.match(main,/Повтор использует тот же запрос/);
 assert.match(main,/aiRetry\.current=null;/);
});
