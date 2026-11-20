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

test("Maximum valid metadata queue survives an iPhone PWA restart",()=>{
 withStorage(storage=>{
  const ids=Array.from({length:100},(_,i)=>
   ("book_"+String(i).padStart(3,"0")).padEnd(128,"x")
  );
  const progress=Object.fromEntries(ids.map((id,i)=>[id,i%100]));
  const favorites=Object.fromEntries(ids.map((id,i)=>[id,i%2===0]));
  writePendingMetadata("parent-large-library",{progress,favorites});
  const raw=storage.get("wondertale:pending-metadata:v1:parent-large-library");
  assert.ok(raw.length>16000,"A full queue must exercise the former 16 KB limit");
  assert.ok(raw.length<=32768,"Metadata remains bounded");
  assert.deepEqual(readPendingMetadata("parent-large-library"),{progress,favorites});
  assert.deepEqual(readPendingMetadata("other-parent"),{progress:{},favorites:{}});
 });
});

test("Oversized or malformed local metadata is rejected safely",()=>{
 withStorage(storage=>{
  const key="wondertale:pending-metadata:v1:parent";
  storage.set(key,"x".repeat(32769));
  assert.deepEqual(readPendingMetadata("parent"),{progress:{},favorites:{}});
  storage.set(key,"{invalid-json");
  assert.deepEqual(readPendingMetadata("parent"),{progress:{},favorites:{}});
 });
});

test("Queue writer keeps the most recent hundred valid positions and favorites",()=>{
 withStorage(()=>{
  const ids=Array.from({length:120},(_,i)=>"book_"+String(i).padStart(3,"0"));
  const progress=Object.fromEntries(ids.map((id,i)=>[id,i%100]));
  const favorites=Object.fromEntries(ids.map((id,i)=>[id,i%2===0]));
  writePendingMetadata("parent",{progress,favorites});
  const recovered=readPendingMetadata("parent");
  assert.equal(Object.keys(recovered.progress).length,100);
  assert.equal(Object.keys(recovered.favorites).length,100);
  assert.equal(recovered.progress[ids[0]],undefined);
  assert.equal(recovered.progress[ids[119]],19);
  assert.equal(recovered.favorites[ids[119]],false);
 });
});
