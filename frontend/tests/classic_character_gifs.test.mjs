import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";

const assetRoot=new URL("../public/images/classics/",import.meta.url);
const mapping=[
  ["red-hood","red-hood-walk-wave"],
  ["three-pigs","three-pigs-building"],
  ["three-pigs","three-pigs-wolf"],
  ["cinderella","cinderella-walking"],
];
const pageArt=readFileSync(new URL("../src/classic_page_art.ts",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");

test("all four animated story files are genuine distinct GIF images",()=>{
  const hashes=new Set();
  for(const [story,name] of mapping){
    const bytes=readFileSync(new URL(story+"/animations/"+name+".gif",assetRoot));
    assert.equal(bytes.toString("ascii",0,6),"GIF89a",name);
    assert.ok(bytes.length>100_000 && bytes.length<1_500_000,name+" has unexpected file size");
    const w=bytes.readUInt16LE(6),h=bytes.readUInt16LE(8);
    assert.ok(w>=280 && h>=280 && w<=1300 && h<=1300,name+" has invalid dimensions");
    hashes.add(createHash("sha256").update(bytes).digest("hex"));
  }
  assert.equal(hashes.size,mapping.length);
});

test("only known classic pages may resolve to animated character files",()=>{
  assert.match(pageArt,/classicAnimatedPage/);
  for(const [story,name] of mapping){
    assert.ok(pageArt.includes('"'+story+'"'),story+" missing");
    assert.ok(pageArt.includes('"'+name+'"'),name+" missing");
  }
  assert.match(pageArt,/if\(imageUrl!==expected\)return null/);
});

test("reader plays original GIF only in magic mode, with static PNG fallback",()=>{
  assert.match(app,/readerArtMotion==="magic"/);
  assert.match(app,/classicAnimatedPage/);
  assert.match(app,/animatedUrl&&failed===0\?animatedUrl/);
  assert.match(app,/readerFullWidth animatedUrl=/);
  assert.match(app,/reduceArtMotion/);
});

test("animated wolf appears only at the brick-house chapter",()=>{
 assert.match(pageArt,/"three-pigs":\{4:"three-pigs-building",7:"three-pigs-wolf"\}/);
 assert.doesNotMatch(pageArt,/"three-pigs":\{4:"three-pigs-building",5:"three-pigs-wolf"\}/);
});
