import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";

const compiled=await build({
  entryPoints:[new URL("../src/ending_length.ts",import.meta.url).pathname],
  bundle:true,platform:"node",format:"esm",write:false
});
const {canAppendStoryEnding}=await import(
  "data:text/javascript;base64,"+
  Buffer.from(compiled.outputFiles[0].contents).toString("base64")
);
const app=await readFile(new URL("../src/main.tsx",import.meta.url),"utf8");

test("An alternate ending fits in the maximum 2200-character local-book page",()=>{
  assert.equal(canAppendStoryEnding("A".repeat(2100),"B".repeat(99)),true);
  assert.equal(canAppendStoryEnding("A".repeat(2100),"B".repeat(100)),false);
});

test("A long original page is not truncated or silently overwritten",()=>{
  assert.equal(canAppendStoryEnding("A".repeat(2200),"Friendship"),false);
  assert.equal(canAppendStoryEnding("Story","Friendship"),true);
});

test("Creator shows a localized error before writing an oversized ending",()=>{
  assert.match(app,/if\(!canAppendStoryEnding\(originalEnding,addition\)\)\{/);
  assert.match(app,/setError\(\(\{ru:"Последняя страница слишком длинная/);
  assert.match(app,/applyLocalBookChange\(\{\.\.\.active,originalEnding,endingChoice:choice/);
});
