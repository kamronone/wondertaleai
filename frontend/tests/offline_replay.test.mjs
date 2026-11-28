import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {test} from "node:test";
import {transform} from "esbuild";

const source=await readFile(new URL("../src/offline_replay.ts",import.meta.url),"utf8");
const {code}=await transform(source,{loader:"ts",format:"esm",target:"es2022"});
const {replayPendingChanges}=await import(
  "data:text/javascript;base64,"+Buffer.from(code).toString("base64")
);
class MissingBook extends Error {}
const makeOptions=(overrides={})=>{
 const progress=new Map([["missing",2],["good",4]]);
 const favorites=new Map([["missing",true],["good",false]]);
 const sent=[];
 let persisted=0;
 const options={
  progress,favorites,
  isActive:()=>true,
  isMissingBook:error=>error instanceof MissingBook,
  waitForProgress:async()=>{},
  sendProgress:async(id,page)=>{sent.push(["progress",id,page]);if(id==="missing")throw new MissingBook();},
  sendFavorite:async(id,value)=>{sent.push(["favorite",id,value]);if(id==="missing")throw new MissingBook();},
  persist:()=>{persisted++},
  ...overrides
 };
 return {options,progress,favorites,sent,get persisted(){return persisted}};
};

test("A missing book stays pending while later progress and favorites are synced",async()=>{
 const harness=makeOptions();
 await replayPendingChanges(harness.options);
 assert.deepEqual([...harness.progress],[["missing",2]]);
 assert.deepEqual([...harness.favorites],[["missing",true]]);
 assert.deepEqual(harness.sent,[
  ["progress","missing",2],["progress","good",4],
  ["favorite","missing",true],["favorite","good",false]
 ]);
 assert.equal(harness.persisted,2);
});

test("A network failure stops the entire replay, preserving progress and favorites",async()=>{
 let favoriteRequests=0;
 const harness=makeOptions({
  sendProgress:async(id)=>{if(id==="missing")throw Error("network down");throw Error("must not be called");},
  sendFavorite:async()=>{favoriteRequests++;}
 });
 await replayPendingChanges(harness.options);
 assert.equal(harness.progress.size,2);
 assert.equal(harness.favorites.size,2);
 assert.equal(harness.persisted,0);
 assert.equal(favoriteRequests,0);
});

test("Newer progress survives completion of a request that actually started",async()=>{
 const progress=new Map([["book",2]]);
 let release;
 let signalStart;
 const gate=new Promise(resolve=>{release=resolve;});
 const started=new Promise(resolve=>{signalStart=resolve;});
 const options=makeOptions({
  progress,favorites:new Map(),
  sendProgress:async()=>{signalStart();await gate;}
 });
 const attempt=replayPendingChanges(options.options);
 await started;
 // The old request is now in flight, not merely queued.
 progress.set("book",7);
 release();
 await attempt;
 assert.deepEqual([...progress],[["book",7]]);
 assert.equal(options.persisted,0);
});

test("Session switch during a pending request leaves the old account queue untouched",async()=>{
 let active=true;
 let release;
 const gate=new Promise(resolve=>{release=resolve;});
 const harness=makeOptions({
  isActive:()=>active,
  sendProgress:async()=>{await gate;}
 });
 const running=replayPendingChanges(harness.options);
 active=false;
 release();
 await running;
 assert.equal(harness.progress.size,2);
 assert.equal(harness.favorites.size,2);
 assert.equal(harness.persisted,0);
});

test("In-flight progress writes complete before any replay starts",async()=>{
 let release;
 const gate=new Promise(resolve=>{release=resolve;});
 const sent=[];
 const harness=makeOptions({
  progress:new Map([["book",3]]),
  favorites:new Map(),
  waitForProgress:async()=>{await gate;sent.push("previous-finished");},
  sendProgress:async()=>{sent.push("replayed");}
 });
 const attempt=replayPendingChanges(harness.options);
 assert.deepEqual(sent,[]);
 release();
 await attempt;
 assert.deepEqual(sent,["previous-finished","replayed"]);
});

test("A failed favorite request stops the replay without clearing pending favorites",async()=>{
 const sent=[];
 const harness=makeOptions({
  progress:new Map(),
  sendFavorite:async(id)=>{sent.push(id);throw Error("timeout");}
 });
 await replayPendingChanges(harness.options);
 assert.deepEqual(sent,["missing"]);
 assert.equal(harness.favorites.size,2);
 assert.equal(harness.persisted,0);
});
