import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {transform} from "esbuild";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const source=read("../src/reader_offline_art.ts");
test("eight Rapunzel PNGs are selectable for local offline reading",async()=>{
 const built=await transform(source,{loader:"ts",format:"esm",target:"es2022"});
 const {canDownloadClassicArt,classicOfflineArtUrls}=await import("data:text/javascript;base64,"+Buffer.from(built.code).toString("base64"));
 assert.equal(canDownloadClassicArt("rapunzel"),true);
 const urls=classicOfflineArtUrls("rapunzel");
 assert.equal(urls.length,8);
 assert.deepEqual(urls,Array.from({length:8},(_,i)=>"/images/classics/rapunzel/pages/page-"+(i+1)+".png"));
 assert.equal(canDownloadClassicArt("user-private-book"),false);
 assert.deepEqual(classicOfflineArtUrls("user-private-book"),[]);
});
test("offline downloader rejects non-PNG or missing pages without caching private content",()=>{
 assert.match(source,/response\.ok\|\|!type\.toLowerCase\(\)\.includes\(expected\)/);
 assert.match(source,/!response\?\.ok\|\|!\(response\.headers\.get\("content-type"\)\|\|""\)\.toLowerCase\(\)\.includes\("image\/png"\)/);
 assert.match(source,/credentials:"omit",cache:"no-cache"/);
 assert.match(source,/if\(url\.endsWith\("\.png"\)\)/);
 assert.match(source,/added\.map\(path=>cache\.delete\(path\)\)/);
 assert.doesNotMatch(source,/localStorage|Authorization|\bchild_name\b/);
});
