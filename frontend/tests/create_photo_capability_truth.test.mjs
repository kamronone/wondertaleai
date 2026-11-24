import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const main=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/create-photo-unavailable.css",import.meta.url),"utf8");

test("creator cannot pretend to accept a child's photo without image generation",()=>{
 const start=main.indexOf('{createStep===1&&');
 const end=main.indexOf('{createStep===2&&',start);
 assert.ok(start>=0&&end>start);
 const first=main.slice(start,end);
 assert.match(first,/className="create-photo-unavailable"/);
 assert.doesNotMatch(first,/type="file"|onChange=\{e=>setPhoto|accept="image\/jpeg/);
 assert.ok(first.includes("Загрузка фото отключена"));
 assert.ok(first.includes("Surat yuklash"));
 assert.ok(first.includes("Photo upload is disabled"));
});

test("Demo and AI generation do not receive a photo or save local child images",()=>{
 assert.doesNotMatch(main,/const \[photo,setPhoto\]|setPhoto\(|if\(photo\)|usePersonalAi&&photo/);
 assert.match(main,/createDemoBook\(heroes,Number\(age\),theme,style,storyIdeaWithHero,storyLang,classicId\|\|undefined,saveOnDevice\)/);
 assert.match(main,/const data=\{\s*name:name\.trim\(\),age:Number\(age\),language:storyLang/);
});

test("photo notice stays readable on narrow phones",()=>{
 assert.ok(main.includes('import "./create-photo-unavailable.css";'));
 assert.match(css,/\.create-page \.create-photo-unavailable\{/);
 assert.match(css,/overflow-wrap:anywhere/);
 assert.match(css,/@media\(max-width:360px\)/);
});
