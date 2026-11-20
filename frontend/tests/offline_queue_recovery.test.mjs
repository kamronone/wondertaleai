import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { transform } from "esbuild";

const source=await readFile(new URL("../src/offline_queue.ts",import.meta.url),"utf8");
const {code}=await transform(source,{loader:"ts",format:"esm",target:"es2022"});
const {normalizePendingProgress,readPendingMetadata,writePendingMetadata}=await import(
 "data:text/javascript;base64,"+Buffer.from(code).toString("base64")
);

function withStorage(run){
 const old=globalThis.localStorage;
 const data=new Map();
 globalThis.localStorage={
  getItem:key=>data.get(key)??null,
  setItem:(key,value)=>{data.set(key,String(value));},
  removeItem:key=>{data.delete(key);}
 };
 try{return run(data);}finally{globalThis.localStorage=old;}
}

test("An offline reading position beyond the current ending is repaired on login",()=>{
 const saved=new Map([["book-one",99],["book-two",3]]);
 const books=[{id:"book-one",pages:[1,2,3,4]},{id:"book-two",pages:[1,2,3,4,5]}];
 const result=normalizePendingProgress(saved,books);
 assert.equal(result.get("book-one"),3);
 assert.equal(result.get("book-two"),3);
 assert.equal(saved.get("book-one"),99);
});

test("Unknown books survive read-replica lag, and corrupt positions are discarded",()=>{
 const saved=new Map([["not-yet-visible",5],["corrupt",NaN],["negative",-1],["too-high",100]]);
 const result=normalizePendingProgress(saved,[]);
 assert.deepEqual([...result],[["not-yet-visible",5]]);
});

test("Repaired offline queue persists across PWA restart for the same parent only",()=>{
 withStorage(()=>{
  const owner="parent-a";
  writePendingMetadata(owner,{progress:{"book-one":99},favorites:{"book-one":true}});
  const recovered=readPendingMetadata(owner);
  const repaired=normalizePendingProgress(new Map(Object.entries(recovered.progress)),[
   {id:"book-one",pages:[1,2,3]}
  ]);
  writePendingMetadata(owner,{progress:Object.fromEntries(repaired),favorites:recovered.favorites});
  assert.deepEqual(readPendingMetadata(owner),{progress:{"book-one":2},favorites:{"book-one":true}});
  assert.deepEqual(readPendingMetadata("parent-b"),{progress:{},favorites:{}});
 });
});

test("Empty books safely restore to the first page",()=>{
 assert.equal(normalizePendingProgress(new Map([["empty",10]]),[
  {id:"empty",pages:[]}
 ]).get("empty"),0);
});


test("A later library refresh repairs the page of a book first missing at login",()=>{
 const offline=new Map([["delayed-book",28]]);
 const initial=normalizePendingProgress(offline,[]);
 assert.equal(initial.get("delayed-book"),28);
 const refreshed=normalizePendingProgress(initial,[{id:"delayed-book",pages:[1,2,3,4,5,6]}]);
 assert.equal(refreshed.get("delayed-book"),5);
});

test("Private-library refresh persists repaired pending pages before merge and replay",async()=>{
 const app=await readFile(new URL("../src/main.tsx",import.meta.url),"utf8");
 assert.match(app,/const repairedProgress=normalizePendingProgress\(pendingProgress\.current,remote\)/);
 assert.match(app,/pendingProgress\.current=repairedProgress;\s*persistPending\(\);/);
 assert.match(app,/const merged=remote\.map\(book=>\(\{/);
});

test("Reader calls the isolated replay engine for both progress and favorites",async()=>{
 const app=await readFile(new URL("../src/main.tsx",import.meta.url),"utf8");
 const flush=app.slice(app.indexOf("const flush=async()=>"),app.indexOf("const onOnline=()=>"));
 assert.match(flush,/await replayPendingChanges\(\{/);
 assert.match(flush,/progress:pendingProgress\.current/);
 assert.match(flush,/favorites:pendingFavorites\.current/);
 assert.match(flush,/isMissingBook:error=>error instanceof PrivateBookNotFoundError/);
 assert.match(flush,/sendProgress:\(id,page\)=>updatePrivateReadingProgress/);
 assert.match(flush,/sendFavorite:\(id,favorite\)=>setPrivateFavorite/);
 assert.match(flush,/isActive:\(\)=>!disposed&&sessionEpoch\.current===epoch&&navigator\.onLine/);
});
