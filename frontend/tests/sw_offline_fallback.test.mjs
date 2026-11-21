import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const sw=readFileSync(new URL("../public/sw.js",import.meta.url),"utf8");

async function simulate(path,{network="offline",shellCached=false,downloaded=true}={}){
 const listeners={};
 const fromOffline={source:"saved-story-art",path};
 const cache={
   match:async()=>shellCached?{source:"shell-cache",path}:undefined,
   put:async()=>{}
 };
 const offline={
   match:async()=>downloaded?fromOffline:undefined,
   put:async()=>{}
 };
 const caches={
   open:async(name)=>name==="wondertale-offline-stories-v1"?offline:cache
 };
 const networkResponse={source:"network-error",ok:false,type:"basic",headers:{get:()=>"text/html"}};
 const context={
   self:{location:{origin:"https://ertakcha.netlify.app"},addEventListener:(event,callback)=>{listeners[event]=callback;}},
   caches,
   URL,
   Response:{error:()=>({source:"response-error"})},
   fetch:async()=>{
     if(network==="offline")throw new Error("Network unavailable");
     return networkResponse;
   }
 };
 vm.runInNewContext(sw,context,{filename:"sw.js"});
 let result;
 const request={
   method:"GET",
   mode:"no-cors",
   url:"https://ertakcha.netlify.app"+path,
   headers:{has:()=>false}
 };
 listeners.fetch({request,respondWith:promise=>{result=promise;}});
 assert.ok(result&&typeof result.then==="function","Service Worker must respond to public illustration fetch");
 return await result;
}

test("downloaded GIF is returned when offline instead of an unresolved Promise",async()=>{
 const result=await simulate("/images/classics/three-pigs/animations/three-pigs-building.gif");
 assert.equal(result.source,"saved-story-art");
});
test("downloaded PNG is returned when offline",async()=>{
 const result=await simulate("/images/classics/three-pigs/pages/page-4.png");
 assert.equal(result.source,"saved-story-art");
});
test("cached PNG is returned when network returns a SPA HTML fallback",async()=>{
 const result=await simulate("/images/classics/cinderella/pages/page-2.png",{network:"html"});
 assert.equal(result.source,"saved-story-art");
});
test("missing illustration fails cleanly when neither cache has it",async()=>{
 const result=await simulate("/images/classics/red-hood/pages/page-1.png",{downloaded:false});
 assert.equal(result.source,"response-error");
});
test("private media is never intercepted by the public service worker",()=>{
 assert.match(sw,/const PRIVATE_PATH =/);
 assert.match(sw,/request\.headers\.has\("Authorization"\)/);
 assert.match(sw,/PRIVATE_PATH\.test\(url\.pathname\)/);
});
