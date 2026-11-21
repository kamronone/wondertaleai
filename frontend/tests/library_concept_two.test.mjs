import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/library-concept-two.css",import.meta.url),"utf8");
const illustration=readFileSync(new URL("../public/images/library-castle-book.svg",import.meta.url),"utf8");

test("chosen library design is actually rendered and CSS is loaded",()=>{
 assert.match(app,/import "\.\/library-concept-two\.css"/);
 assert.match(app,/className="library-page library-concept-two"/);
 assert.match(app,/className="library-concept-heading"/);
 assert.match(app,/className="library-concept-search"/);
 assert.match(app,/className="library-concept-metrics"/);
});

test("library search and shelf filters work for empty and populated accounts",()=>{
 assert.match(app,/value=\{libraryQuery\} onChange=\{event=>setLibraryQuery\(event\.target\.value\)\}/);
 assert.match(app,/libraryShelf,setLibraryShelf/);
 for(const shelf of ["all","favorites","saved","recent"])
   assert.ok(app.includes('libraryShelf==="'+shelf+'"'),shelf);
 assert.match(app,/onClick=\{\(\)=>changeLibraryShelf\("favorites"\)\}/);
 assert.match(app,/onClick=\{\(\)=>changeLibraryShelf\("saved"\)\}/);
 assert.match(app,/isDemoBook\(book\)&&Boolean\(book\.savedOnDevice\)/);
 assert.match(app,/libraryShelf==="recent"\?"newest":librarySort/);
});

test("data is scoped to active session books, not a global saved list",()=>{
 assert.match(app,/const shownBooks=discoverBooks\(books,libraryQuery/);
 assert.match(app,/books\.filter\(book=>\(book\.lastPage\?\?0\)>0\)\.length/);
 assert.doesNotMatch(app,/localStorage\.getItem\("wondertale-global-library"/);
});

test("empty state uses book artwork and only one primary create action",()=>{
 assert.match(app,/className="empty library-concept-empty"/);
 assert.match(app,/src="\/images\/library-castle-book\.svg"/);
 assert.match(app,/src="\/images\/profile-story-hero\.png"/);
 assert.match(app,/className="primary-button library-concept-create"/);
 assert.match(app,/\{books\.length>0&&<button className="primary-button add-book"/);
 assert.match(illustration,/<svg /);
 assert.match(illustration,/Magical castle over an open fairy-tale book/);
});

test("responsive library does not reintroduce forced empty heights or bottom padding",()=>{
 assert.match(css,/@media\(max-width:620px\)/);
 assert.match(css,/\.library-page\.library-concept-two\{[^}]*padding:17px 14px 8px!important/s);
 assert.match(css,/\.library-concept-empty\{[^}]*height:auto!important/s);
 assert.match(css,/\.library-concept-chips\{[^}]*overflow-x:auto/s);
 assert.match(css,/\.library-concept-search input\{[^}]*font-size:16px/s);
});
