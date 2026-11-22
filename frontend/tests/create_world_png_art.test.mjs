import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {transform} from "esbuild";

const src=readFileSync(new URL("../src/world_art.ts",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/create-step-two-concept-four.css",import.meta.url),"utf8");
const {code}=await transform(src,{loader:"ts",format:"esm",target:"es2022"});
const {worldArt}=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));

test("all six story world illustrations are valid bundled PNGs, not emoji",()=>{
 assert.equal(worldArt.length,6);
 const signature=Buffer.from([137,80,78,71,13,10,26,10]);
 for(let i=0;i<worldArt.length;i++){
   assert.match(worldArt[i],/^data:image\/png;base64,/);
   const png=Buffer.from(worldArt[i].split(",")[1],"base64");
   assert.ok(png.length>650,"missing scene "+i);
   assert.deepEqual(png.subarray(0,8),signature,"invalid PNG "+i);
   assert.equal(png.readUInt32BE(16),48);
   assert.equal(png.readUInt32BE(20),48);
 }
});

test("world cards show PNG while keeping selections and a11y labels",()=>{
 assert.match(app,/import \{ worldArt \} from "\.\/world_art"/);
 assert.match(app,/<img src=\{worldArt\[i\]\} alt="" width=\{48\} height=\{48\}/);
 assert.doesNotMatch(app,/\(\["🏰","🪐","🦕","🐠","🤝","🌙"\] as const\)/);
 assert.match(app,/aria-pressed=\{themeIndex===i\}/);
 assert.match(css,/\.world-scene-icon img\s*\{/);
 assert.match(css,/object-fit:cover/);
});
