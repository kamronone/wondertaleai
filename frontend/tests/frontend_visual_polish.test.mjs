import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {test} from "node:test";

const [app,css]=await Promise.all([
 readFile(new URL("../src/main.tsx",import.meta.url),"utf8"),
 readFile(new URL("../src/reader-polish.css",import.meta.url),"utf8")
]);

test("Home keeps a concise create action, continue reading and a small story shelf",()=>{
 assert.match(app,/className="hero"/);
 assert.match(app,/className="continue-story-card" onClick=\{\(\)=>openBook\(continueBook\)\}/);
 assert.match(app,/books\.slice\(0,3\)\.map\(book=>/);
 assert.match(css,/\.shell \.hero-content\{padding:13px 16px 17px!important\}/);
 assert.match(css,/\.shell \.quick-actions\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/\.shell \.book-grid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test("Four mobile navigation destinations identify the current page and stay printable-safe",()=>{
 const nav=app.slice(app.indexOf('<nav className="mobile-tabbar"'),app.indexOf("</nav>",app.indexOf('<nav className="mobile-tabbar"')));
 assert.equal((nav.match(/aria-current=/g)||[]).length,4);
 assert.match(nav,/tab==="library"\|\|tab==="reader"\?"page":undefined/);
 assert.match(css,/\.shell \.mobile-tabbar\{[\s\S]*?grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(css,/@media print\{\s*\.shell \.mobile-tabbar,[\s\S]*?display:none!important/);
});

test("Reader focus mode is reversible and retains the page navigation controls",()=>{
 assert.match(app,/const \[readerFocusMode,setReaderFocusMode\]=useState\(false\)/);
 assert.match(app,/aria-pressed=\{readerFocusMode\}/);
 assert.match(app,/setReaderSettingsOpen\(false\);setEditingPage\(false\)/);
 assert.match(app,/readerFocusMode\?\(\{ru:"Обычное чтение"/);
 assert.match(app,/readerSettingsOpen&&!readerFocusMode&&<div id="reader-display-options"/);
 assert.match(css,/\.reader-page\.reader-focused \.reader-title,[\s\S]*?\.reader-page\.reader-focused \.sequel-action\{\s*display:none!important/);
 assert.doesNotMatch(css,/\.reader-page\.reader-focused \.pager\s*\{\s*display:none/);
});

test("Story-specific illustrations remain the source for polished covers",()=>{
 assert.match(app,/className="book-cover-art"><StoryIllustration url=\{book\.pages\[0\]\?\.image_url\|\|""\}/);
 assert.match(app,/className="book-cover-age" aria-hidden="true">\{book\.age\}\+/);
 assert.match(css,/\.shell \.book-tile \.book-cover-art>img,/);
 assert.match(css,/\.shell \.book-tile \.book-cover-art>\.story-image-fallback/);
 assert.match(css,/\.shell \.classic-cover \.classic-generated-image/);
});


test("Home resume card exposes real progress without another oversized section",()=>{
 assert.match(app,/className="continue-story-progress" role="progressbar"/);
 assert.match(app,/aria-valuemax=\{continueBook\.pages\.length\}/);
 assert.match(app,/aria-valuenow=\{\(continueBook\.lastPage\?\?0\)\+1\}/);
 assert.match(app,/continueBook\.pages\.length\)\*100/);
 assert.match(css,/\.continue-story-card \.continue-story-progress/);
 assert.match(css,/\.continue-story-card \.continue-story-progress>span/);
});

test("Started and finished story tiles render bounded reading progress",()=>{
 assert.match(app,/reading&&<><small className="read-progress">\{progress\}<\/small><span className="book-progress-track"/);
 assert.match(app,/aria-valuemax=\{book\.pages\.length\}/);
 assert.match(app,/Math\.min\(\(book\.lastPage\?\?0\)\+1,book\.pages\.length\)/);
 assert.match(css,/\.shell \.book-tile \.book-progress-track\{/);
 assert.match(css,/\.shell \.book-tile \.book-progress-track>span/);
});


test("Classic covers show the catalogue age guidance without replacing illustrations",()=>{
 assert.match(app,/className="classic-age-badge" aria-hidden="true">\{item\.minAge\?\?5\}\+/);
 assert.match(app,/aria-label=\{action\+": "\+item\.title\[lang\]\+" · "\+\(item\.minAge\?\?5\)\+"\+"\}/);
 assert.match(app,/src=\{"\/images\/classics\/"\+item\.id\+imageExtension\}/);
 assert.match(app,/onError=\{\(\)=>setCoverFailed\(true\)\}/);
 assert.match(css,/\.shell \.classic-card \.classic-age-badge\{/);
});

test("Classic tiles remain compact and readable on small phones",()=>{
 assert.match(css,/\.shell \.classic-card \.classic-info small\{[\s\S]*?-webkit-line-clamp:3/);
 assert.match(css,/@media\(max-width:620px\)\{\s*\.shell \.classic-grid/);
 assert.match(css,/\.shell \.classic-card \.classic-info strong\{font-size:12px;line-height:1\.3\}/);
 assert.match(css,/\.shell \.classic-card:focus-visible\{/);
});
