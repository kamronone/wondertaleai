import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {transform} from "esbuild";

const source=readFileSync(new URL("../src/private_library.ts",import.meta.url),"utf8");
const compiled=await transform(source,{loader:"ts",format:"esm",target:"es2022"});
const {loadPrivateBooks}=await import("data:text/javascript;base64,"+Buffer.from(compiled.code).toString("base64"));
const page=(number,image_url)=>({number,text:"A safe fairy-tale page",image_url});
const wrap=data=>({ok:true,status:200,json:async()=>data});
test("parent library keeps the exact bundled Rapunzel PNG and rejects private URL injection",async()=>{
 const story=JSON.stringify({version:1,pages:[
  page(1,"/images/classics/rapunzel/pages/page-1.png"),
  page(2,"https://example.com/private-child-photo.png"),
  page(3,"data:image/png;base64,AAAA"),
  page(4,"/images/classics/not-a-bundled-book/pages/page-1.png"),
  page(5,"/images/classics/rapunzel/pages/page-8.png")
 ]});
 const row={id:"book-1",title:"Rapunzel",child_name:"Child",age:7,created_at:"2026-11-22",story};
 const previous=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  assert.equal(options.headers.Authorization,"Bearer parent-token");
  assert.equal(options.cache,"no-store");
  if(url.endsWith("/api/books"))return wrap([row]);
  if(url.endsWith("/api/books/favorites"))return wrap({ids:[]});
  if(url.endsWith("/api/books/progress"))return wrap([]);
  throw Error("Unexpected route");
 };
 try{
  const [result]=await loadPrivateBooks("https://api.test","parent-token");
  assert.equal(result.pages.length,5);
  assert.equal(result.pages[0].image_url,"/images/classics/rapunzel/pages/page-1.png");
  assert.equal(result.pages[4].image_url,"/images/classics/rapunzel/pages/page-8.png");
  for(const index of [1,2,3])assert.equal(result.pages[index].image_url,"/images/wondertale-hero.webp");
 }finally{globalThis.fetch=previous;}
});
test("only bundled pages and canonical page numbers are allowed",()=>{
 assert.match(source,/const publicPageArt=new Set\(\["red-hood","cinderella","three-pigs","rapunzel"\]\)/);
 assert.match(source,/page-\[1-8\]\\.png/);
 assert.match(source,/!classicId\|\|classicId===page\[1\]/);
 assert.doesNotMatch(source,/fetch\(source/);
});
