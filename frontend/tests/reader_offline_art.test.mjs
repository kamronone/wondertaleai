import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {transform} from "esbuild";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const source=read("../src/reader_offline_art.ts");
const app=read("../src/main.tsx");
const sw=read("../public/sw.js");
const {code}=await transform(source,{loader:"ts",format:"esm",target:"es2022"});
const lib=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));
const {canDownloadClassicArt,classicOfflineArtUrls}=lib;
test("only three installed public classics can be downloaded",()=>{
 for(const id of ["red-hood","cinderella","three-pigs"]){
  assert.equal(canDownloadClassicArt(id),true);
  const urls=classicOfflineArtUrls(id);
  assert.equal(urls.filter(x=>x.endsWith(".png")).length,8);
  assert.ok(urls.every(x=>x.startsWith("/images/classics/"+id+"/")));
  assert.ok(urls.every(x=>/\.(png|gif)$/.test(x)));
 }
 for(const id of ["private-book","../../api/books","hansel-gretel",undefined]){
  assert.equal(canDownloadClassicArt(id),false);
 }
 assert.deepEqual(classicOfflineArtUrls("../../api/books"),[]);
});
test("download validates public PNG or GIF responses before writing cache",()=>{
 assert.match(source,/credentials:"omit"/);
 assert.match(source,/response\.ok/);
 assert.match(source,/image\/gif/);
 assert.match(source,/image\/png/);
 assert.match(source,/cache\.put\(url,response\)/);
 assert.match(source,/throw new Error\("OFFLINE_IMAGE_FAILED"\)/);
});
test("PWA preserves opted-in offline art and serves it without network",()=>{
 assert.match(sw,/STORY_OFFLINE_CACHE/);
 assert.ok(sw.includes("key !== STORY_OFFLINE_CACHE"));
 assert.match(sw,/caches\.open\(STORY_OFFLINE_CACHE\)\)\.match\(request\)/);
});
test("download action is in reading settings only and has loading/error states",()=>{
 assert.match(app,/canDownloadClassicArt\(\(active as DemoBook\)\.classicId\)/);
 assert.match(app,/onClick=\{\(\)=>void saveReaderClassicOffline\(\)\}/);
 assert.match(app,/aria/);
 assert.match(app,/offlineArtBusy/);
 assert.match(app,/offlineArtError/);
 assert.doesNotMatch(source,/privateToken|Authorization|account\//);
});
