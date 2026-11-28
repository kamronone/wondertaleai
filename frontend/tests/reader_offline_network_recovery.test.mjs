import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {transform} from "esbuild";

const source=readFileSync(new URL("../src/reader_offline_art.ts",import.meta.url),"utf8");
const {code}=await transform(source,{loader:"ts",format:"esm",target:"es2022"});
const mod=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));

async function withBrowser({online,cacheMap,fetchImpl},fn){
  const oldWindow=globalThis.window;
  const oldCaches=globalThis.caches;
  const oldNavigator=globalThis.navigator;
  const oldFetch=globalThis.fetch;
  const cache={
    match:async url=>cacheMap.get(url),
    put:async(url,response)=>cacheMap.set(url,response),
    delete:async url=>cacheMap.delete(url)
  };
  try{
    globalThis.window={caches:true};
    globalThis.caches={open:async()=>cache};
    Object.defineProperty(globalThis,"navigator",{configurable:true,value:{onLine:online}});
    globalThis.fetch=fetchImpl;
    return await fn();
  }finally{
    globalThis.window=oldWindow;
    globalThis.caches=oldCaches;
    globalThis.fetch=oldFetch;
    if(oldNavigator===undefined)delete globalThis.navigator;
    else Object.defineProperty(globalThis,"navigator",{configurable:true,value:oldNavigator});
  }
}
function validPng(){return new Response("image",{status:200,headers:{"content-type":"image/png"}})}
test("download succeeds offline using all eight previously downloaded PNGs",async()=>{
  const map=new Map(mod.classicOfflineArtUrls("red-hood").filter(x=>x.endsWith(".png")).map(x=>[x,validPng()]));
  let networkCalls=0;
  const result=await withBrowser({online:false,cacheMap:map,fetchImpl:async()=>{networkCalls++;throw Error("offline")}},()=>mod.downloadClassicOfflineArt("red-hood"));
  assert.equal(result.saved,8);
  assert.equal(networkCalls,1); // Optional GIF is not cached.
  assert.equal(map.size,8);
});
test("network failure cannot claim missing PNG pack is downloaded",async()=>{
  const map=new Map();
  await assert.rejects(withBrowser({online:false,cacheMap:map,fetchImpl:async()=>{throw Error("offline")}},()=>mod.downloadClassicOfflineArt("three-pigs")),/OFFLINE_IMAGE_FAILED/);
  assert.equal(map.size,0);
});
test("invalid HTML response in cache is never treated as a downloaded PNG",async()=>{
  const map=new Map([[mod.classicOfflineArtUrls("cinderella")[0],new Response("<html/>",{headers:{"content-type":"text/html"}})]]);
  await assert.rejects(withBrowser({online:false,cacheMap:map,fetchImpl:async()=>{throw Error("offline")}},()=>mod.downloadClassicOfflineArt("cinderella")),/OFFLINE_IMAGE_FAILED/);
});
