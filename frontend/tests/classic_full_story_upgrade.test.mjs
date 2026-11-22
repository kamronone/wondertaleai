import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const demo=readFileSync(new URL("../src/demo.ts",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");

test("older locally saved tales offer a confirmed full-story upgrade, never silent replacement",()=>{
 assert.match(demo,/export function canRefreshClassicDemoStory\(book:DemoBook\)/);
 assert.match(demo,/book.mode!=="browser-demo"/);
 assert.match(demo,/book.pages.length!==8/);
 assert.match(demo,/book.pages.some\(\(page,index\)=>page.text!==refreshed.pages\[index\]\)/);
 assert.match(demo,/if\(!canRefreshClassicDemoStory\(book\)\)return book/);
 assert.match(app,/if\(!window.confirm\(notice\)\)return/);
 assert.match(app,/ru:"Получить полную версию сказки"/);
 assert.match(app,/uz:"Ertakning to‘liq versiyasini olish"/);
 assert.match(app,/en:"Get the full fairy tale"/);
});
test("explicit upgrade keeps the original image URLs, last page and account metadata",()=>{
 assert.match(demo,/return \{\.\.\.book,title:story.title,pages:book.pages.map\(\(page,index\)=>\(\{/);
 assert.match(demo,/\.\.\.page,\s*text:story.pages\[index\]/);
 assert.match(demo,/classicReaderImage\(book.classicId,page.image_url,index,story.pages\[index\]\)/);
 assert.doesNotMatch(demo,/localStorage.clear\(\)|sessionStorage.clear\(\)/);
 assert.match(app,/const next=refreshClassicDemoStory\(active as DemoBook\)/);
 assert.match(app,/applyLocalBookChange\(next\)/);
});
