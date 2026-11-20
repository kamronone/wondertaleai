import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";

const bundled=await build({
  entryPoints:[new URL("../src/library_discovery.ts",import.meta.url).pathname],
  platform:"node",format:"esm",bundle:true,write:false
});
const { discoverBooks }=await import(
  "data:text/javascript;base64,"+Buffer.from(bundled.outputFiles[0].contents).toString("base64")
);

const entries=[
  {id:"a",title:"Звёздный сад",name:"Амир",theme:"космос",created_at:"2026-11-20T10:00:00Z",favorite:true,lastPage:0,pages:[1,2]},
  {id:"b",title:"Forest Friends",name:"Lina",theme:"forest",created_at:"2026-11-19T10:00:00Z",favorite:false,lastPage:3,pages:[1,2,3,4,5]},
  {id:"c",title:"Moonlight",name:"Mira",theme:"magic",created_at:"2026-11-18T10:00:00Z",favorite:true,lastPage:1,pages:[1,2]}
];

test("Search matches title, child and theme without changing the source array",()=>{
  const original=entries.map(x=>x.id).join(",");
  assert.deepEqual(discoverBooks(entries," амИр ",false,"newest").map(x=>x.id),["a"]);
  assert.deepEqual(discoverBooks(entries,"FOREST",false,"newest").map(x=>x.id),["b"]);
  assert.deepEqual(discoverBooks(entries,"magic",false,"newest").map(x=>x.id),["c"]);
  assert.equal(entries.map(x=>x.id).join(","),original);
});

test("Favorites and sorting operate on the caller-provided library only",()=>{
  assert.deepEqual(discoverBooks(entries,"",true,"newest").map(x=>x.id),["a","c"]);
  assert.deepEqual(discoverBooks(entries,"",false,"continue").map(x=>x.id),["b","c","a"]);
  assert.deepEqual(discoverBooks(entries,"",false,"title").map(x=>x.id),["b","c","a"]);
  assert.deepEqual(discoverBooks(entries.slice(0,1),"",false,"newest").map(x=>x.id),["a"]);
});

test("Empty results and whitespace query are safe",()=>{
  assert.deepEqual(discoverBooks(entries,"nonexistent",false,"newest"),[]);
  assert.equal(discoverBooks(entries,"  ",false,"newest").length,3);
});
