import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transform } from "esbuild";

const source=readFileSync(new URL("../src/private_library.ts",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const {code}=await transform(source,{loader:"ts",format:"esm",target:"es2022"});
const {transferLocalBooks}=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));

const book=id=>({
  id,savedOnDevice:true,title:"A story",name:"Alex",age:7,
  prompt:"A friendly adventure",theme:"forest",style:"gentle",language:"en",
  pages:[{number:1,text:"Once upon a time",image_url:"/images/wondertale-hero.webp"}]
});
const json=body=>({ok:true,status:200,json:async()=>body});

test("abort on logout prevents the next private-book upload",async()=>{
  const controller=new AbortController();
  const previous=globalThis.fetch;
  let posts=0;
  globalThis.fetch=async(url,options)=>{
    if(url.endsWith("/api/books")&&options?.method==="POST"){
      posts++;
      controller.abort();
      return json({id:"remote-first"});
    }
    if(url.endsWith("/api/books"))return json([]);
    throw Error("Unexpected endpoint "+url);
  };
  try{
    await assert.rejects(
      transferLocalBooks("https://api.example","token",[book("local-first"),book("local-second")],controller.signal),
      error=>error?.name==="AbortError"
    );
    assert.equal(posts,1,"An account switch must not upload the second book");
  }finally{globalThis.fetch=previous;}
});

test("already cancelled transfer sends no requests",async()=>{
  const controller=new AbortController();
  controller.abort();
  const previous=globalThis.fetch;
  let calls=0;
  globalThis.fetch=async()=>{calls++;throw Error("No request expected");};
  try{
    await assert.rejects(
      transferLocalBooks("https://api.example","token",[book("local-first")],controller.signal),
      error=>error?.name==="AbortError"
    );
    assert.equal(calls,0);
  }finally{globalThis.fetch=previous;}
});

test("account lifecycle cancels transfers and ignores late completions",()=>{
  assert.match(app,/transferAbort\.current\?\.abort\(\)/);
  assert.match(app,/transferLocalBooks\(API,privateToken,getDemoBooks\(\),controller\.signal\)/);
  assert.match(app,/if\(transferAbort\.current===controller\)/);
});

test("logout aborts an in-flight favorite update before reading progress is sent",async()=>{
  const controller=new AbortController();
  const previous=globalThis.fetch;
  const local={...book("local-marked"),favorite:true,lastPage:1,pages:[
    {number:1,text:"First page"},
    {number:2,text:"Second page"}
  ]};
  let imported=false;
  let favoriteCalls=0;
  let progressCalls=0;
  const storedRow={
    id:"remote-marked",title:"A story",child_name:"Alex",age:7,created_at:"2026-11-21T00:00:00Z",
    story:JSON.stringify({version:1,source_id:local.id,pages:[
      {number:1,text:"First page"},
      {number:2,text:"Second page"}
    ]})
  };
  globalThis.fetch=async(url,options)=>{
    if(url.endsWith("/api/books")&&options?.method==="POST"){
      imported=true;
      return json({id:"remote-marked"});
    }
    if(url.endsWith("/api/books"))return json(imported?[storedRow]:[]);
    if(url.endsWith("/api/books/favorites"))return json({ids:[]});
    if(url.endsWith("/api/books/progress"))return json([]);
    if(url.endsWith("/api/books/remote-marked/favorite")){
      favoriteCalls++;
      assert.equal(options.method,"PUT");
      assert.ok(options.signal,"Favorite update must receive an AbortSignal");
      controller.abort();
      return json({favorite:true});
    }
    if(url.endsWith("/api/books/remote-marked/progress")){
      progressCalls++;
      return json({});
    }
    throw Error("Unexpected endpoint "+url);
  };
  try{
    await assert.rejects(
      transferLocalBooks("https://api.example","token",[local],controller.signal),
      error=>error?.name==="AbortError"
    );
    assert.equal(favoriteCalls,1);
    assert.equal(progressCalls,0,"No progress write after logout");
  }finally{globalThis.fetch=previous;}
});

test("private-library sync passes cancellation to every metadata request",()=>{
  assert.match(source,/loadPrivateBooks\(api,token,signal\)/);
  assert.match(source,/setPrivateFavorite\(api,token,id!,true,signal\)/);
  assert.match(source,/updatePrivateReadingProgress\(api,token,id!,position,signal\)/);
});
