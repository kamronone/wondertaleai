import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url));
const app=read("../src/CharacterHotspot.tsx").toString("utf8");
const installer=read("../scripts/install-reaction-gifs.mjs").toString("utf8");
const pkg=JSON.parse(read("../package.json").toString("utf8"));
const assets=["snow-white-wave","duckling-flutter","bremen-music"];

test("three independent real GIFs are generated from versioned binary data",()=>{
 for(const name of assets){
  const output=read("../public/images/interactions/reactions/"+name+".gif");
  const text=read("../artwork/reaction-gifs/"+name+".gif.b64").toString("utf8").trim();
  const original=Buffer.from(text,"base64");
  assert.equal(output.subarray(0,6).toString("ascii"),"GIF89a");
  assert.equal(output.readUInt16LE(6),80);
  assert.equal(output.readUInt16LE(8),80);
  assert.equal(output.at(-1),0x3b);
  assert.deepEqual(output,original);
  assert.ok(output.length>10000);
  assert.ok(app.includes('"/images/interactions/reactions/'+name+'.gif"'));
 }
});
test("GIF decoding runs before dev, tests and production build",()=>{
 for(const command of ["predev","pretest","prebuild"])assert.equal(pkg.scripts[command],"npm run reaction:gif:install");
 assert.equal(pkg.scripts["reaction:gif:install"],"node scripts/install-reaction-gifs.mjs");
 assert.match(installer,/if\(frames!==8\|\|at!==data.length\)/);
 assert.match(installer,/writeFileSync\(dest,bytes\)/);
 assert.doesNotMatch(installer,/fetch\(|exec\(|https?:\/\/|Authorization|privateToken/);
});
test("the reaction remains visible until manually dismissed, with accessible reduced-motion behavior",()=>{
 const css=read("../src/character-reaction-motion.css").toString("utf8");
 assert.match(app,/visibleReaction&&point&&<div className="wt-character-reaction"/);
 assert.match(app,/className="wt-character-reaction-gif"/);
 assert.match(app,/gifAsset&&!gifFailed/);
 assert.match(app,/onError=\{\(\)=>setGifFailed\(true\)\}/);
 assert.match(app,/setGifFailed\(false\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/\.wt-character-reaction-gif\{display:none!important\}/);
 assert.match(css,/pointer-events:none/);
});
