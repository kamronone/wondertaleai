import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {transform} from "esbuild";
const read=name=>readFileSync(new URL("../src/"+name,import.meta.url),"utf8");
const {code}=await transform(read("private_illustration.ts"),{loader:"ts",format:"esm",target:"es2022"});
const {loadBookIllustrationStatuses}=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));
const api="https://preview.example",book="123e4567-e89b-42d3-a456-426614174000",job="123e4567-e89b-42d3-a456-426614174001";
test("overview reads only authenticated page metadata, with bounded concurrency",async()=>{
 let active=0,peak=0;
 const calls=[];
 const fetcher=async(url,opts)=>{
  calls.push(url);active++;peak=Math.max(peak,active);
  assert.equal(opts.headers.Authorization,"Bearer test-token");
  assert.equal(opts.redirect,"error");assert.equal(opts.cache,"no-store");
  await Promise.resolve();active--;
  const n=Number(url.split("/").at(-1));
  assert.ok(url.includes("/api/illustrations/books/"));
  if(n===1)return new Response(JSON.stringify({job_id:job}),{status:200});
  if(n===2)return new Response(JSON.stringify({status:"pending_review"}),{status:200});
  if(n===3)return new Response(JSON.stringify({status:"needs_review"}),{status:200});
  if(n===4)return new Response(null,{status:503});
  return new Response(null,{status:404});
 };
 assert.deepEqual(await loadBookIllustrationStatuses(api,"test-token",book,8,new AbortController().signal,fetcher),["available","pending_review","needs_review","error","missing","missing","missing","missing"]);
 assert.equal(calls.length,8);assert.ok(peak<=3);
});
test("abort prevents later batches and invalid counts send no requests",async()=>{
 const controller=new AbortController();
 let calls=0;
 const fetcher=async()=>{calls++;controller.abort();return new Response(null,{status:404});};
 await assert.rejects(loadBookIllustrationStatuses(api,"test-token",book,20,controller.signal,fetcher),e=>e.name==="AbortError");
 assert.ok(calls<=3);
 await assert.rejects(loadBookIllustrationStatuses(api,"test-token",book,21,new AbortController().signal,()=>{throw Error("Unexpected fetch")}),/Invalid page count/);
});
test("overview is collapsed initially and excluded from classics and focus reading",()=>{
 const app=read("main.tsx"),view=read("BookIllustrationOverview.tsx"),css=read("private-reader-illustration-status.css");
 assert.ok(app.includes('active.mode==="private-account"&&privateToken&&API&&!readerFocusMode&&active.pages.length<=20&&<BookIllustrationOverview'));
 assert.ok(view.includes("useState(false)"));
 assert.ok(view.includes("if(!open)return"));
 assert.ok(view.includes("controller.abort()"));
 assert.ok(view.includes("onPage(i+1)"));
 assert.ok(css.includes("@media print{.book-illustration-overview{display:none!important}}"));
 assert.ok(!view.includes("localStorage"));
});
