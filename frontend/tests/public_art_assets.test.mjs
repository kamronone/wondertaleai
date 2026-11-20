import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { test } from "node:test";

const worker=await readFile(new URL("../public/sw.js",import.meta.url),"utf8");
const manifest=JSON.parse(await readFile(new URL("../public/manifest.webmanifest",import.meta.url),"utf8"));
const optional=worker.match(/const OPTIONAL_ART = \[([\s\S]*?)\];/)?.[1];
assert.ok(optional,"Public PWA artwork list exists");
const assets=[...optional.matchAll(/"([^"]+)"/g)].map(match=>match[1]);

test("Every offline PWA illustration exists as a bundled public file",async()=>{
  assert.ok(assets.length>=5);
  for(const path of assets){
    assert.match(path,/^\/images\/(?:features\/|classics\/|wondertale-)/);
    await assert.doesNotReject(access(new URL("../public"+path,import.meta.url)),path);
  }
});

test("PWA icons exist and include an installable maskable icon",async()=>{
  assert.ok(manifest.icons.some(icon=>icon.purpose==="maskable"));
  for(const icon of manifest.icons){
    assert.match(icon.src,/^\/icons\//);
    await assert.doesNotReject(access(new URL("../public"+icon.src,import.meta.url)),icon.src);
  }
});

test("Offline precache contains no account photos or private story API references",()=>{
  assert.ok(assets.every(path=>!path.includes("/api/")&&!path.includes("/media/")&&!path.includes("/account/")));
  assert.match(worker,/const PRIVATE_PATH =/);
});
