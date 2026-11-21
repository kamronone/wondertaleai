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
 assert.match(app,/<div className="library-filters library-concept-chips"/);
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
 assert.match(app,/className="primary-button library-concept-create"/);
 assert.doesNotMatch(app,/\{books\.length===0&&<div className="library-empty-quickbar"/);
 assert.match(app,/<div className="library-concept-metrics"/);
 assert.match(app,/\{books\.length>0&&<button className="primary-button add-book"/);
 assert.deepEqual([...illustration.subarray(0,8)],[137,80,78,71,13,10,26,10]);
 assert.ok(illustration.length>12000);
 assert.match(app,/import "\.\/library-final-polish\.css"/);
 assert.match(app,/import "\.\/library-exact-reference\.css"/);
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

test("approved reference: filters and three metrics stay visible even with zero books",()=>{
 const start=app.indexOf('<div className="library-concept-toolbar">');
 const end=app.indexOf('{books.some(book=>typeof book.lastPage',start);
 const section=app.slice(start,end);
 assert.ok(start>=0&&end>start);
 assert.match(section,/<div className="library-filters library-concept-chips"/);
 assert.match(section,/<div className="library-concept-metrics"/);
 assert.doesNotMatch(section,/\{books\.length>0&&<div className="library-concept-metrics"/);
 assert.match(app,/className="primary-button library-concept-create"/);
 assert.doesNotMatch(app,/library-concept-fox-art/);
});

test("reference CSS places four filter pills in a row on iPhone",()=>{
 const exact=readFileSync(new URL("../src/library-exact-reference.css",import.meta.url),"utf8");
 assert.match(exact,/\.library-concept-chips[\s\S]*?grid-template-columns:repeat\(4,minmax\(0,1fr\)\)!important/);
 assert.match(exact,/\.library-concept-art[\s\S]*?aspect-ratio:480\/285!important/);
});

test("iPhone screenshot fixes keep filters readable and the create action above navigation",()=>{
 const fixes=readFileSync(new URL("../src/library-screenshot-fixes.css",import.meta.url),"utf8");
 assert.match(app,/import "\.\/library-screenshot-fixes\.css"/);
 assert.match(app,/uz:"Sevimlilar"/);
 assert.match(fixes,/\.library-concept-chips>button\{[\s\S]*?overflow:visible!important/);
 assert.match(fixes,/@media\(max-width:620px\)/);
 assert.match(fixes,/\.library-concept-art\{[\s\S]*?width:min\(245px,100%\)!important/);
 assert.match(fixes,/\.library-concept-create\{[\s\S]*?min-height:43px!important/);
 assert.match(fixes,/mask-image:linear-gradient/);
});

test("expanded achievements render below the statistics row instead of breaking its grid",()=>{
 const layout=readFileSync(new URL("../src/shared-rounded-pages.css",import.meta.url),"utf8");
 const segment=app.slice(app.indexOf('className="library-concept-metrics"'),app.indexOf('className="library-resume"'));
 assert.match(segment,/className="library-achievements-toggle"/);
 assert.match(segment,/aria-expanded=\{showLibraryAchievements\}/);
 assert.match(segment,/onClick=\{\(\)=>setShowLibraryAchievements\(value=>!value\)\}/);
 assert.match(segment,/\{showLibraryAchievements&&<div className="library-achievements-panel"/);
 assert.ok(segment.indexOf('className="library-achievements-panel"')>segment.indexOf('className="library-concept-metric"'));
 assert.doesNotMatch(segment,/<details className="library-achievements-disclosure">/);
 assert.match(layout,/\.library-page\.library-concept-two>\.library-achievements-panel\{/);
 assert.match(layout,/\.library-concept-metrics>\.library-achievements-toggle\{/);
});
