import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";
import ts from "typescript";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const source=fs.readFileSync(path.join(root,"src/classic_page_art.ts"),"utf8");
const javascript=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const exports={};
const fakeClassics=[
 {id:"red-hood",title:{ru:"Красная Шапочка"}},
 {id:"cinderella",title:{ru:"Золушка"}},
 {id:"three-pigs",title:{ru:"Три поросёнка"}},
 {id:"snow-white",title:{ru:"Белоснежка"}}
];
vm.runInNewContext(javascript,{
 exports,
 require(name){
   if(name==="./classics")return {classics:fakeClassics};
   if(name==="./red_hood_page_art")return {redHoodPageArtwork:()=>"data:image/svg+xml;charset=utf-8,test"};
   throw Error("Unexpected dependency: "+name);
 },
 encodeURIComponent, Number, Object, Math, String, Set, RegExp
},{timeout:1000});

test("classic reader selects exact PNG per page",()=>{
 assert.equal(exports.classicReaderImage("cinderella","/images/classics/cinderella.svg",0),"/images/classics/cinderella/pages/page-1.png");
 assert.equal(exports.classicReaderImage("three-pigs","/images/classics/three-pigs.webp",7),"/images/classics/three-pigs/pages/page-8.png");
 assert.equal(exports.classicReaderImage("cinderella","",2),"/images/classics/cinderella/pages/page-3.png");
});
test("missing page PNG falls back to embedded offline illustration",()=>{
 const art=exports.classicPngFallback("/images/classics/cinderella/pages/page-3.png");
 assert.equal(typeof art,"string");
 assert.ok(art.startsWith("data:image/svg+xml;charset=utf-8,"));
 assert.equal(exports.classicPngFallback("/images/classics/cinderella/pages/page-9.png"),null);
 assert.equal(exports.classicPngFallback("https://evil.example/page-3.png"),null);
});
test("never replace custom or private images",()=>{
 const custom="/media/private-user-image.png";
 const data="data:image/svg+xml;charset=utf-8,%3Csvg%3Ecustom%3C%2Fsvg%3E";
 assert.equal(exports.classicReaderImage("cinderella",custom,0),custom);
 assert.equal(exports.classicReaderImage("cinderella",data,3),data);
 assert.equal(exports.classicReaderImage(undefined,custom,0),custom);
 assert.equal(exports.classicReaderImage("unknown",custom,0),custom);
});
