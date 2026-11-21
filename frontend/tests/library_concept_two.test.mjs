import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/library-concept-two.css",import.meta.url),"utf8");
const illustration=readFileSync(new URL("../public/images/library-story-castle-premium.png",import.meta.url));
const polished=readFileSync(new URL("../src/library-final-polish.css",import.meta.url),"utf8");

test("chosen library design is actually rendered and CSS is loaded",()=>{
 assert.match(app,/import "\.\/library-concept-two\.css"/);
 assert.match(app,/className="library-page library-concept-two"/);
 assert.match(app,/className="library-concept-heading"/);
 assert.match(app,/className="library-concept-search"/);
 assert.match(app,/className="library-concept-metrics"/);
});

test("library search remains visible while shelf filters appear only when books exist",()=>{
 assert.match(app,/value=\{libraryQuery\} onChange=\{event=>setLibraryQuery\(event\.target\.value\)\}/);
 assert.match(app,/libraryShelf,setLibraryShelf/);
 for(const shelf of ["all","favorites","saved","recent"])
   assert.ok(app.includes('libraryShelf==="'+shelf+'"'),shelf);
 assert.match(app,/onClick=\{\(\)=>changeLibraryShelf\("favorites"\)\}/);
 assert.match(app,/onClick=\{\(\)=>changeLibraryShelf\("saved"\)\}/);
 assert.match(app,/\{books\.length>0&&<div className="library-filters library-concept-chips"/);
 assert.match(app,/isDemoBook\(book\)&&Boolean\(book\.savedOnDevice\)/);
 assert.match(app,/if\(next==="recent"\)setLibrarySort\("newest"\)/);
});

test("data is scoped to active session books, not a global saved list",()=>{
 assert.match(app,/const shownBooks=discoverBooks\(books,libraryQuery/);
 assert.match(app,/books\.filter\(book=>\(book\.lastPage\?\?0\)>0\)\.length/);
 assert.doesNotMatch(app,/localStorage\.getItem\("wondertale-global-library"/);
});

test("empty state uses book artwork and only one primary create action",()=>{
 assert.match(app,/className="empty library-concept-empty"/);
 assert.match(app,/src="\/images\/library-story-castle-premium\.png"/);
 assert.doesNotMatch(app,/className="library-concept-fox-art"/);
 assert.match(app,/className="primary-button library-empty-quick-create"/);
 assert.match(app,/\{books\.length===0&&<div className="library-empty-quickbar"/);
 assert.match(app,/\{books\.length>0&&<div className="library-concept-metrics"/);
 assert.match(app,/\{books\.length>0&&<button className="primary-button add-book"/);
 assert.deepEqual([...illustration.subarray(0,8)],[137,80,78,71,13,10,26,10]);
 assert.ok(illustration.length>12000);
 assert.match(app,/import "\.\/library-final-polish\.css"/);
 assert.match(polished,/\.library-empty-quickbar/);
 assert.match(polished,/\.library-empty-copy/);
});

test("screenshot layout fixes remove nested search borders and clipped mobile filters",()=>{
 const fixes=readFileSync(new URL("../src/library-mobile-fixes.css",import.meta.url),"utf8");
 assert.match(fixes,/input\[type="search"\]/);
 assert.match(fixes,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
 assert.match(fixes,/\.library-concept-art/);
 assert.match(fixes,/height:auto!important/);
});

test("responsive library does not reintroduce forced empty heights or bottom padding",()=>{
 assert.match(css,/@media\(max-width:620px\)/);
 assert.match(css,/\.library-page\.library-concept-two\{[^}]*padding:17px 14px 8px!important/s);
 assert.match(css,/\.library-concept-empty\{[^}]*height:auto!important/s);
 assert.match(css,/\.library-concept-chips\{[^}]*overflow-x:auto/s);
 assert.match(css,/\.library-concept-search input\{[^}]*font-size:16px/s);
});
