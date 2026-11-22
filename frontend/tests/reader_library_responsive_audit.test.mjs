import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/reader-library-responsive-audit.css",import.meta.url),"utf8");
const lib=app.slice(app.indexOf('{tab==="library"&&'),app.indexOf('{tab==="reader"&&'));
const reader=app.slice(app.indexOf('{tab==="reader"&&'),app.indexOf('{tab==="home"&&<section className="install-panel'));

test("reader pager shows only page number on phones while retaining desktop page jumps",()=>{
 assert.match(app,/import "\.\/reader-library-responsive-audit\.css";/);
 assert.match(reader,/className="pager-mobile-current"/);
 assert.match(reader,/className="pager-jump"/);
 assert.match(reader,/className=\{"dot "\+\(i===page/);
 assert.match(css,/\.reader-page \.pager \.pager-indicators>\.dot/);
 assert.match(css,/\.reader-page \.pager \.pager-indicators>\.pager-jump/);
 assert.match(css,/display:none!important/);
 assert.match(css,/bottom:calc\(78px \+ env\(safe-area-inset-bottom, 0px\)\)!important/);
});

test("library book cards stay in two equal columns and contain long titles",()=>{
 assert.match(lib,/shownBooks\.map\(book=><BookTile/);
 assert.match(css,/\.library-page\.library-concept-two \.book-grid\s*\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
 assert.match(css,/\.book-caption>strong\s*\{[\s\S]*?-webkit-line-clamp:3/);
 assert.match(css,/\.book-progress-track\s*\{[\s\S]*?width:100%/);
});

test("empty filter results retain a real reset action and touch-size button",()=>{
 assert.match(lib,/className="library-empty-results"/);
 assert.match(lib,/setLibraryQuery\(" "\)/.source ? /setLibraryQuery\(""\)/ : /setLibraryQuery\(""\)/);
 assert.match(lib,/changeLibraryShelf\("all"\)/);
 assert.match(css,/\.library-empty-results button\s*\{[\s\S]*?min-height:44px!important/);
});
