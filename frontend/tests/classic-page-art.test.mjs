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
 {id:"snow-white",title:{ru:"Белоснежка"}},
 {id:"ugly-duckling",title:{ru:"Гадкий утёнок"}},
 {id:"bremen",title:{ru:"Бременские музыканты"}},
 {id:"hansel-gretel",title:{ru:"Гензель и Гретель"}},
 {id:"rapunzel",title:{ru:"Рапунцель"}},
 {id:"sleeping-beauty",title:{ru:"Спящая красавица"}},
 {id:"puss-boots",title:{ru:"Кот в сапогах"}}
];
vm.runInNewContext(javascript,{
 exports,
 require(name){
   if(name==="./classics")return {classics:fakeClassics};
   if(name==="./red_hood_page_art")return {redHoodPageArtwork:()=>"data:image/svg+xml;charset=utf-8,test"};
   if(name==="./three_pigs_page_art")return {threePigsPageArtwork:(page)=>"data:image/svg+xml;charset=utf-8,pig-scene-"+page};
   if(name==="./cinderella_page_art")return {cinderellaPageArtwork:(page)=>"data:image/svg+xml;charset=utf-8,cinderella-scene-"+page};
   if(name==="./snow_white_page_art")return {snowWhitePageArtwork:(page)=>"data:image/svg+xml;charset=utf-8,snowwhite-scene-"+page};
   if(name==="./ugly_duckling_page_art")return {uglyDucklingPageArtwork:(page)=>"data:image/svg+xml;charset=utf-8,uglyduckling-scene-"+page};
   if(name==="./bremen_page_art")return {bremenPageArtwork:(page)=>"data:image/svg+xml;charset=utf-8,bremen-scene-"+page};
   if(name==="./hansel_gretel_page_art")return {hanselGretelPageArtwork:(page)=>"data:image/svg+xml;charset=utf-8,hansel-scene-"+page};
   if(name==="./rapunzel_page_art")return {rapunzelPageArtwork:(page)=>"data:image/svg+xml;charset=utf-8,rapunzel-scene-"+page};
   if(name==="./sleeping_beauty_page_art")return {sleepingBeautyPageArtwork:(page)=>"data:image/svg+xml;charset=utf-8,sleeping-scene-"+page};
   if(name==="./puss_boots_page_art")return {pussBootsPageArtwork:(page)=>"data:image/svg+xml;charset=utf-8,puss-scene-"+page};
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
 assert.equal(art,"data:image/svg+xml;charset=utf-8,cinderella-scene-2");
 assert.equal(exports.classicPngFallback("/images/classics/cinderella/pages/page-9.png"),null);
 assert.equal(exports.classicPngFallback("/images/classics/three-pigs/pages/page-5.png"),"data:image/svg+xml;charset=utf-8,pig-scene-4");
 assert.equal(exports.classicPngFallback("/images/classics/snow-white/pages/page-8.png"),"data:image/svg+xml;charset=utf-8,snowwhite-scene-7");
 assert.equal(exports.classicPngFallback("/images/classics/ugly-duckling/pages/page-4.png"),"data:image/svg+xml;charset=utf-8,uglyduckling-scene-3");
 assert.equal(exports.classicPngFallback("/images/classics/bremen/pages/page-6.png"),"data:image/svg+xml;charset=utf-8,bremen-scene-5");
 assert.equal(exports.classicPngFallback("/images/classics/hansel-gretel/pages/page-3.png"),"data:image/svg+xml;charset=utf-8,hansel-scene-2");
 assert.equal(exports.classicPngFallback("/images/classics/rapunzel/pages/page-8.png"),"data:image/svg+xml;charset=utf-8,rapunzel-scene-7");
 assert.equal(exports.classicPngFallback("/images/classics/sleeping-beauty/pages/page-1.png"),"data:image/svg+xml;charset=utf-8,sleeping-scene-0");
 assert.equal(exports.classicPngFallback("/images/classics/sleeping-beauty/pages/page-8.png"),"data:image/svg+xml;charset=utf-8,sleeping-scene-7");
 assert.equal(exports.classicPngFallback("/images/classics/puss-boots/pages/page-1.png"),"data:image/svg+xml;charset=utf-8,puss-scene-0");
 assert.equal(exports.classicPngFallback("/images/classics/puss-boots/pages/page-8.png"),"data:image/svg+xml;charset=utf-8,puss-scene-7");
 assert.equal(exports.classicPngFallback("https://evil.example/page-3.png"),null);
});
test("never replace custom or private images",()=>{
 const custom="/media/private-user-image.png";
 const data="data:image/svg+xml;charset=utf-8,%3Csvg%3Ecustom%3C%2Fsvg%3E";
 assert.equal(exports.classicReaderImage("cinderella",custom,0),custom);
 assert.equal(exports.classicReaderImage("cinderella",data,3),data);
 const legacy="data:image/svg+xml;charset=utf-8,%3Csvg%20aria-label%3D%22Fairy-tale%20illustration%22%3E%3C%2Fsvg%3E";
 assert.equal(exports.classicReaderImage("three-pigs",legacy,0),"/images/classics/three-pigs/pages/page-1.png");
 assert.equal(exports.classicReaderImage(undefined,custom,0),custom);
 assert.equal(exports.classicReaderImage("unknown",custom,0),custom);
});

test("animated GIFs are selected for exactly four supported built-in pages",()=>{
 assert.equal(exports.classicAnimatedPage("red-hood","/images/classics/red-hood/pages/page-1.png",0),"/images/classics/red-hood/animations/red-hood-walk-wave.gif");
 assert.equal(exports.classicAnimatedPage("three-pigs","/images/classics/three-pigs/pages/page-4.png",3),"/images/classics/three-pigs/animations/three-pigs-building.gif");
 assert.equal(exports.classicAnimatedPage("three-pigs","/images/classics/three-pigs/pages/page-5.png",4),"/images/classics/three-pigs/animations/three-pigs-wolf.gif");
 assert.equal(exports.classicAnimatedPage("cinderella","/images/classics/cinderella/pages/page-5.png",4),"/images/classics/cinderella/animations/cinderella-walking.gif");
 assert.equal(exports.classicAnimatedPage("three-pigs","/images/classics/three-pigs/pages/page-2.png",1),null);
 assert.equal(exports.classicAnimatedPage("three-pigs","/media/personal-photo.png",3),null);
 assert.equal(exports.classicAnimatedPage("three-pigs","data:image/png;base64,custom",3),null);
 assert.equal(exports.classicAnimatedPage("unknown","/images/classics/unknown/pages/page-1.png",0),null);
});
