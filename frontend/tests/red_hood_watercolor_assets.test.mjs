import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";

const code=readFileSync(new URL("../src/red_hood_page_art.ts",import.meta.url),"utf8");
const reader=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const demo=readFileSync(new URL("../src/demo.ts",import.meta.url),"utf8");

test("eight original PNG artworks exist and are distinct, valid, mobile-sized",()=>{
  const digests=new Set();
  for(let page=1;page<=8;page++){
    const bytes=readFileSync(new URL("../public/images/classics/red-hood/watercolor/page-"+page+".png",import.meta.url));
    assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
    assert.ok(bytes.length>50_000&&bytes.length<1_000_000,"Unexpected artwork size at page "+page);
    const width=bytes.readUInt32BE(16);
    const height=bytes.readUInt32BE(20);
    assert.ok(width>=400&&height>=450&&width<=1300&&height<=1500,"Artwork dimensions invalid at page "+page);
    digests.add(createHash("sha256").update(bytes).digest("hex"));
  }
  assert.equal(digests.size,8,"Every page must have a different watercolor illustration");
});
test("reader uses a versioned built-in path and preserves user-provided images",()=>{
  assert.match(code,/\/images\/classics\/red-hood\/watercolor\/page-/);
  assert.match(code,/classicId!=="red-hood"/);
  assert.match(code,/oldCover\|\|localVector\|\|builtinPage \? redHoodPagePng\(pageIndex\) : imageUrl/);
  assert.match(code,/\(\?:pages\|watercolor\)/);
  assert.match(demo,/classicId\?classicReaderImage\(classicId,art\|\|"",index,text\)/);
  assert.match(reader,/classicReaderImage\(isDemoBook\(active as DemoBook\)/);
});
test("print version uses correct page-specific illustration too",()=>{
  assert.match(reader,/print-book-cover[^\n]*classicReaderImage/);
  assert.match(reader,/classicReaderImage\(isDemoBook\(active as DemoBook\)\?\(active as DemoBook\)\.classicId:undefined,item\.image_url,index\)/);
});
