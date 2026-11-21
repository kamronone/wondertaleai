import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {transform} from "esbuild";

const source=readFileSync(new URL("../src/reader_zoom_gestures.ts",import.meta.url),"utf8");
const {code}=await transform(source,{loader:"ts",format:"esm",target:"es2022"});
const {readerFingerDistance,clampReaderZoom}=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));

test("two-finger pinch measures Euclidean distance",()=>{
 assert.equal(readerFingerDistance({clientX:0,clientY:0},{clientX:30,clientY:40}),50);
 assert.equal(readerFingerDistance({clientX:10,clientY:20},{clientX:10,clientY:20}),0);
});
test("pinch zoom is always bounded between one and three times",()=>{
 assert.equal(clampReaderZoom(.01),1);
 assert.equal(clampReaderZoom(1.125),1.13);
 assert.equal(clampReaderZoom(2.5),2.5);
 assert.equal(clampReaderZoom(200),3);
 assert.equal(clampReaderZoom(NaN),1);
 assert.equal(clampReaderZoom(Infinity),1);
});
