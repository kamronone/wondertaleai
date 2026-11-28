import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {transform} from "esbuild";

const source=readFileSync(new URL("../src/private_illustration.ts",import.meta.url),"utf8");
const compiled=await transform(source,{loader:"ts",format:"esm",target:"es2022"});
const {loadPrivatePageIllustration}=await import("data:text/javascript;base64,"+Buffer.from(compiled.code).toString("base64"));

const book="123e4567-e89b-42d3-a456-426614174000";
const job="123e4567-e89b-42d3-a456-426614174001";
const api="https://private.example.test";
function png(width=96,height=96,good=true){
 const bytes=new Uint8Array(64);
 bytes.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82],0);
 new DataView(bytes.buffer).setUint32(16,width,false);
 new DataView(bytes.buffer).setUint32(20,height,false);
 if(!good)bytes[0]=60;
 return new Blob([bytes],{type:"image/png"});
}
function mockFetch(file,history){
 return async(url,opts)=>{
   history.push({url,opts});
   if(url.endsWith("/pages/2"))return {ok:true,status:200,json:async()=>({job_id:job})};
   if(url.endsWith("/media/"+job))return {ok:true,status:200,headers:new Headers({"content-type":"image/png"}),blob:async()=>file};
   throw Error("Unrecognized authenticated path: "+url);
 };
}
async function run(file){
 const history=[];
 const oldCreate=URL.createObjectURL;
 const oldRevoke=URL.revokeObjectURL;
 const created=[],revoked=[];
 URL.createObjectURL=(blob)=>{created.push(blob);return "blob:temporary-private-asset"};
 URL.revokeObjectURL=(url)=>{revoked.push(url)};
 try{
  const value=await loadPrivatePageIllustration(api,"private-token",book,2,new AbortController().signal,mockFetch(file,history));
  return {value,history,created,revoked};
 }finally{URL.createObjectURL=oldCreate;URL.revokeObjectURL=oldRevoke}
}
test("valid authenticated PNG uses private no-store requests and short-lived object URL",async()=>{
 const {value,history,created}=await run(png());
 assert.equal(value.blobUrl,"blob:temporary-private-asset");
 assert.equal(created.length,1);
 assert.equal(history.length,2);
 assert.equal(history[0].opts.headers.Authorization,"Bearer private-token");
 assert.equal(history[1].opts.cache,"no-store");
 assert.ok(history.every(call=>call.opts.redirect==="error"&&call.opts.credentials==="omit"));
 assert.ok(history.every(call=>!call.url.includes("private-token")));
});
test("fake PNG with valid MIME type never produces an object URL",async()=>{
 await assert.rejects(run(png(96,96,false)),/Invalid PNG signature/);
});
test("out of range dimensions are rejected before painting a private image",async()=>{
 await assert.rejects(run(png(0,96)),/Invalid illustration dimensions/);
 await assert.rejects(run(png(2049,96)),/Invalid illustration dimensions/);
});
test("missing private image falls back without leaking access status",async()=>{
 const result=await loadPrivatePageIllustration(api,"private-token",book,2,new AbortController().signal,
  async()=>({status:404,ok:false}));
 assert.equal(result,null);
});
test("aborted navigation never creates a private blob URL",async()=>{
 const controller=new AbortController();
 controller.abort();
 const history=[];
 await assert.rejects(loadPrivatePageIllustration(api,"private-token",book,2,controller.signal,mockFetch(png(),history)),
  error=>error.name==="AbortError");
});
test("book identifiers and API origin are validated before network requests",async()=>{
 const never=()=>{throw Error("Should not send request")};
 await assert.rejects(loadPrivatePageIllustration("http://insecure.example","x",book,2,new AbortController().signal,never),/origin/);
 await assert.rejects(loadPrivatePageIllustration(api,"x","../../private",2,new AbortController().signal,never),/request/);
 await assert.rejects(loadPrivatePageIllustration(api,"x",book,21,new AbortController().signal,never),/request/);
});

test("private illustration origin cannot contain credentials, paths or query fragments",async()=>{
 const never=()=>{throw Error("Should not send request")};
 for(const invalid of ["https://user:pass@private.example.test","https://private.example.test/api","https://private.example.test?token=x","https://private.example.test#private","http://localhost.example.test:5173","https://private.example.test/"]){
  await assert.rejects(loadPrivatePageIllustration(invalid,"x",book,2,new AbortController().signal,never),/origin/);
 }
});
test("metadata redirect failure never requests image bytes",async()=>{
 let calls=0;
 await assert.rejects(loadPrivatePageIllustration(api,"private-token",book,2,new AbortController().signal,async(_url,opts)=>{
  calls++;
  assert.equal(opts.redirect,"error");
  throw new TypeError("Redirect blocked");
 }),/Redirect blocked/);
 assert.equal(calls,1);
});
