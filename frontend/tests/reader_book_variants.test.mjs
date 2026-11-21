import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/reader-book-variants.css",import.meta.url),"utf8");

test("reader offers selectable open, classic, modern and minimal appearances",()=>{
 assert.match(app,/import "\.\/reader-book-variants\.css"/);
 assert.match(app,/\["spread","classic","storybook","simple"\] as const/);
 assert.match(app,/className="reader-book-variant"/);
 assert.match(app,/aria-pressed=\{readerBookStyle===variant\}/);
 assert.match(app,/onClick=\{\(\)=>setReaderBookStyle\(variant\)\}/);
 assert.match(app,/book-style-"\+readerBookStyle/);
});

test("reader appearance persists, including compatibility with prior saved choices",()=>{
 assert.match(app,/localStorage\.getItem\("wondertale_reader_book_style"\)/);
 assert.match(app,/saved==="simple"\|\|saved==="classic"\|\|saved==="spread"/);
 assert.match(app,/localStorage\.setItem\("wondertale_reader_book_style",readerBookStyle\)/);
 assert.match(app,/\[readerBookStyle\]/);
});

test("all four page designs are responsive and night/warm mode is retained",()=>{
 for(const variant of ["spread","classic","storybook","simple"]){
   assert.ok(css.includes(".story-page.book-style-"+variant));
 }
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/\.story-page\.book-style-spread\{\s*display:block!important/);
 assert.match(css,/\.story-page\.reader-night\{/);
 assert.match(css,/\.story-page\.reader-warm\{/);
 assert.match(css,/@media print/);
});

test("reader format selector does not replace book content, paging or audio controls",()=>{
 assert.match(app,/className="reader-book-variants"/);
 assert.match(app,/className="reader-audio-toolbar"/);
 assert.match(app,/className=\{"story-page reader-font-"\+readerFontScale/);
 assert.match(app,/active\.pages\[page\]\.image_url/);
 assert.match(app,/active\.pages\[page\]\.text/);
});
