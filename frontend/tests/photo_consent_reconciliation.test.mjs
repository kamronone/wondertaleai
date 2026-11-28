import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {transform} from "esbuild";
const read=name=>readFileSync(new URL("../src/"+name,import.meta.url),"utf8");
const load=async name=>{
 const {code}=await transform(read(name),{loader:"ts",format:"esm",target:"es2022"});
 return import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));
};
const photo=await load("photo_consents.ts"),illustration=await load("illustration_consent.ts");
test("both photo permission endpoints and generic illustration consent refuse redirects and cookies",async()=>{
 const original=globalThis.fetch;
 const calls=[];
 globalThis.fetch=async(url,options)=>{
  calls.push({url,options});
  throw new TypeError("Redirect blocked");
 };
 try{
  for(const action of [
   ()=>photo.getPhotoConsent("https://preview.example","test-token","local"),
   ()=>photo.getPhotoConsent("https://preview.example","test-token","external"),
   ()=>photo.setPhotoConsent("https://preview.example","test-token","local",false),
   ()=>photo.setPhotoConsent("https://preview.example","test-token","external",false),
   ()=>illustration.fetchIllustrationConsent("https://preview.example","test-token"),
   ()=>illustration.updateIllustrationConsent("https://preview.example","test-token",false)
  ])await assert.rejects(action(),/Redirect blocked/);
  assert.equal(calls.length,6);
  for(const {options} of calls){
   assert.equal(options.cache,"no-store");
   assert.equal(options.redirect,"error");
   assert.equal(options.credentials,"omit");
   assert.equal(options.headers.Authorization,"Bearer test-token");
  }
 }finally{globalThis.fetch=original;}
});
test("uncertain consent write clears visible decisions and reloads both scopes",()=>{
 const source=read("PhotoPermissionsPanel.tsx");
 const update=source.slice(source.indexOf("const update=async"),source.indexOf("return <details"));
 assert.ok(update.includes("mutation.current||"));
 assert.ok(update.includes("setLocal(null);setExternal(null);"));
 assert.ok(update.includes("setVersion(v=>v+1);"));
 assert.ok(update.includes("if(mutation.current===controller)"));
 assert.ok(!update.includes("setLocal(response)"));
 assert.ok(!update.includes("setExternal(response)"));
 assert.ok(source.includes('getPhotoConsent(api,session,"local",controller.signal)'));
 assert.ok(source.includes('getPhotoConsent(api,session,"external",controller.signal)'));
 assert.ok(source.includes("if(!open||busy)return"));
 assert.ok(source.includes("mutation.current?.abort()"));
});
