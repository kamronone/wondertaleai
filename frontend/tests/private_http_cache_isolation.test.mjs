import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {transform} from "esbuild";

const privateSrc=readFileSync(new URL("../src/private_library.ts",import.meta.url),"utf8");
const ownerSrc=readFileSync(new URL("../src/offline_queue.ts",import.meta.url),"utf8");
const transpile=async source=>{
  const {code}=await transform(source,{loader:"ts",format:"esm",target:"es2022"});
  return import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));
};
const {loadPrivateBooks,updatePrivateReadingProgress}=await transpile(privateSrc);
const {getAuthenticatedOwner}=await transpile(ownerSrc);
const data=value=>new Response(JSON.stringify(value),{status:200,headers:{"content-type":"application/json"}});

test("every authenticated library request bypasses browser HTTP cache",async()=>{
  const requests=[];
  const previous=globalThis.fetch;
  globalThis.fetch=async (url,init)=>{
    requests.push({url,init});
    if(url.endsWith("/api/books"))return data([]);
    if(url.endsWith("/api/books/favorites"))return data({ids:[]});
    if(url.endsWith("/api/books/progress"))return data([]);
    throw Error("Unexpected URL "+url);
  };
  try{
    assert.deepEqual(await loadPrivateBooks("https://preview.example","parent-secret"),[]);
    assert.equal(requests.length,3);
    for(const {init} of requests){
      assert.equal(init.cache,"no-store");
      assert.equal(init.redirect,"error");
      assert.equal(init.credentials,"omit");
      assert.equal(init.headers.Authorization,"Bearer parent-secret");
      assert.equal(init.headers["Cache-Control"],undefined);
    }
  }finally{globalThis.fetch=previous;}
});

test("account verification uses fresh response before loading owner queue",async()=>{
  const previous=globalThis.fetch;
  let options;
  globalThis.fetch=async (_url,init)=>{options=init;return data({id:"owner-123"});};
  try{
    assert.equal(await getAuthenticatedOwner("https://preview.example","parent-secret"),"owner-123");
    assert.equal(options.cache,"no-store");
    assert.equal(options.headers.Authorization,"Bearer parent-secret");
  }finally{globalThis.fetch=previous;}
});

test("private write refuses redirect and does not retry the mutation",async()=>{
 const previous=globalThis.fetch;
 let calls=0;
 globalThis.fetch=async (_url,init)=>{
  calls++;
  assert.equal(init.method,"POST");
  assert.equal(init.redirect,"error");
  assert.equal(init.credentials,"omit");
  throw new TypeError("Redirect blocked");
 };
 try{
  await assert.rejects(updatePrivateReadingProgress("https://preview.example","parent-secret","book-1",2),/Redirect blocked/);
  assert.equal(calls,1);
 }finally{globalThis.fetch=previous;}
});
