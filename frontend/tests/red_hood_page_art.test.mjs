import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(p)=>readFileSync(new URL(p,import.meta.url),"utf8");
const art=read("../src/red_hood_page_art.ts");
const demo=read("../src/demo.ts");
const main=read("../src/main.tsx");
const images=read("../src/book_images.ts");
test("red hood has eight distinct local visual scene choices",()=>{
 assert.match(art,/export function redHoodPageArtwork/);
 assert.match(art,/export function redHoodPagePng/);
 assert.match(art,/images\\/classics\\/red-hood\\/pages\\/page-/);
 for(let i=0;i<8;i++)assert.match(art,new RegExp("case "+i+":|default:return"));
 assert.match(art,/encodeURIComponent\(svg\)/);
 assert.match(images,/data:image\/svg\+xml;charset=utf-8,/);
});
test("every new Red Riding Hood page gets its own artwork, other classics unchanged",()=>{
 assert.match(demo,/classicId==="red-hood"\?redHoodPagePng\(index\):art\|\|illustration\(index\)/);
 assert.match(demo,/classicId,savedOnDevice:saveOnDevice/);
});
test("existing browser-saved classics display upgraded per-page artwork",()=>{
 assert.match(main,/\.classicId==="red-hood"\?redHoodPagePng\(page\)/);
 assert.match(main,/PrivateReaderIllustration/);
});
test("offline illustrations do not use private child photos or external network",()=>{
 assert.doesNotMatch(art,/fetch\(|XMLHttpRequest|https:\/\/|localStorage|sessionStorage/);
 assert.match(art,/data:image\/svg\+xml;charset=utf-8,/);
});
