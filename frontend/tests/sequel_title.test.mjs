import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";

const built=await build({
  entryPoints:[new URL("../src/sequel_title.ts",import.meta.url).pathname],
  bundle:true,platform:"node",format:"esm",write:false
});
const { fitSequelTitle }=await import(
  "data:text/javascript;base64,"+
  Buffer.from(built.outputFiles[0].contents).toString("base64")
);

const suffixes=[" — новое приключение"," — yangi sarguzaşt"," — a New Adventure"];

test("Short sequel titles retain the full parent story title",()=>{
  for(const suffix of suffixes){
    assert.equal(fitSequelTitle("The Magic Star",suffix),"The Magic Star"+suffix);
  }
});

test("Long sequel titles fit the library limit in all supported languages",()=>{
  for(const suffix of suffixes){
    const result=fitSequelTitle("A".repeat(260),suffix);
    assert.equal(result.length,260);
    assert.ok(result.endsWith(suffix));
    assert.ok(result.includes("…"));
  }
});

test("Boundary-length sequel titles are not truncated",()=>{
  for(const suffix of suffixes){
    const title="B".repeat(260-suffix.length);
    assert.equal(fitSequelTitle(title,suffix),title+suffix);
  }
});

test("Truncation removes trailing spaces before ellipsis",()=>{
  const title="T".repeat(235)+" ".repeat(25);
  const result=fitSequelTitle(title,suffixes[2]);
  assert.equal(result.length<=260,true);
  assert.equal(result.endsWith(suffixes[2]),true);
  assert.ok(!result.includes(" …"));
});


test("Truncation never leaves a broken emoji surrogate pair",()=>{
  const suffix=" — a New Adventure";
  const available=260-suffix.length-1;
  const title="A".repeat(available-1)+"😀"+"Z".repeat(30);
  const result=fitSequelTitle(title,suffix);
  assert.ok(result.endsWith(suffix));
  assert.ok(result.length<=260);
  const hasBrokenSurrogate = text => /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(text);
  assert.equal(hasBrokenSurrogate(result),false);
  assert.equal(hasBrokenSurrogate("Broken: "+String.fromCharCode(0xD83D)),true);
  assert.equal(hasBrokenSurrogate("Broken: "+String.fromCharCode(0xDE00)),true);
  assert.ok(!result.includes("�"));
});
