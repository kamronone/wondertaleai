import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const css=readFileSync(new URL("../src/reader-pager-no-overlap.css",import.meta.url),"utf8");
const main=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");

test("mobile reader pager is fixed above navigation without covering story end",()=>{
 assert.match(main,/import "\.\/reader-pager-no-overlap\.css";/);
 assert.match(css,/\.reader-page \.pager[\s\S]*?position:fixed!important/);
 assert.match(css,/bottom:calc\(78px \+ env\(safe-area-inset-bottom,0px\)\)!important/);
 assert.match(css,/transform:translateX\(-50%\)!important/);
 assert.match(css,/\.story-page \.story-text\{[\s\S]*?overflow:visible!important/);
 assert.match(css,/env\(safe-area-inset-bottom,0px\)/);
 assert.match(css,/position:fixed!important/);
 assert.match(css,/padding-bottom:calc\(190px \+ env\(safe-area-inset-bottom,0px\)\)!important/);
});

test("print hides navigation controls",()=>{
 assert.match(css,/@media print\{[\s\S]*?\.reader-page \.pager\{display:none!important/);
});

test("reader toolbar actions stay compact and keep accessible touch targets",()=>{
 assert.match(css,/\.reader-page \.reader-toolbar\{[\s\S]*?min-height:48px!important/);
 assert.match(css,/\.reader-actions>\.icon-button\{[\s\S]*?flex:0 0 44px!important/);
 assert.match(css,/\.reader-actions>\.icon-button\{[\s\S]*?max-width:44px!important/);
 assert.match(css,/\.reader-actions>\.icon-button svg\{[\s\S]*?width:19px!important/);
});

test("the reader pager correction is the last stylesheet import",()=>{
 const styles=[...main.matchAll(/^import "\.\/[^"]+\.css";$/gm)].map(match=>match[0]);
 assert.ok(styles.length>0);
 assert.equal(styles.at(-1),'import "./reader-pager-no-overlap.css";');
});

test("final fixed pager rules override older mobile styles",()=>{
 const legacy=readFileSync(new URL("../src/reader-mobile-v1.css",import.meta.url),"utf8");
 assert.match(legacy,/position:fixed!important/);
 assert.match(css,/\.shell:has\(>main>\.reader-page\) \.reader-page \.pager,[\s\S]*?position:fixed!important/);
 assert.match(css,/z-index:85!important/);
 assert.match(css,/bottom:calc\(78px \+ env\(safe-area-inset-bottom,0px\)\)!important/);
});

test("previous and next stay after story in the DOM and follow the viewport",()=>{
 const concept=readFileSync(new URL("../src/reader-concept-four.css",import.meta.url),"utf8");
 assert.match(concept,/\.reader-page \.story-page\s*\{\s*order:2;/);
 assert.match(concept,/\.reader-page \.print-book \{order:9\}/);
 assert.match(css,/\.reader-page \.pager,[\s\S]*?order:10!important/);
 const storyEnd=main.indexOf('        </article>}');
 const pager=main.indexOf('        <div className="pager">');
 assert.ok(storyEnd>=0&&pager>storyEnd,"pager stays after the story in DOM");
 assert.match(css,/\.reader-page \.pager[\s\S]*?position:fixed!important/);
 assert.match(css,/\.reader-page \.pager[\s\S]*?bottom:calc\(78px \+ env\(safe-area-inset-bottom,0px\)\)!important/);
});

test("compact fixed pager has equal 40px buttons inside a 48px bar and centered counter",()=>{
 const readerCss=css.slice(css.indexOf("@media screen and (max-width:700px){"));
 assert.match(readerCss,/height:48px!important/);
 assert.match(readerCss,/grid-template-columns:minmax\(0,1fr\) 48px minmax\(0,1fr\)!important/);
 assert.match(readerCss,/\.pager>button\{[\s\S]*?height:40px!important/);
 assert.match(readerCss,/\.pager>button\{[\s\S]*?justify-content:center!important/);
 assert.match(readerCss,/\.pager>\.pager-indicators\{[\s\S]*?justify-self:center!important/);
 assert.match(readerCss,/\.pager \.pager-mobile-current\{[\s\S]*?text-align:center!important/);
 assert.match(readerCss,/\.pager>button svg\{[\s\S]*?width:17px!important/);
 assert.match(readerCss,/width:calc\(100vw - 32px\)!important/);
});

test("previous and next override old higher-specificity 50px buttons and cannot overflow frame",()=>{
 assert.match(css,/\.pager>button:first-child,[\s\S]*?\.pager>button:last-child/);
 assert.match(css,/\.pager>button:last-child\{[\s\S]*?height:40px!important/);
 assert.match(css,/\.pager>button:last-child\{[\s\S]*?max-height:40px!important/);
 assert.match(css,/\.pager>button:last-child\{[\s\S]*?align-self:center!important/);
 assert.match(css,/\.pager>button:last-child\{[\s\S]*?overflow:hidden!important/);
 assert.match(css,/\.pager,[\s\S]*?overflow:hidden!important/);
 const legacy=readFileSync(new URL("../src/reader-library-responsive-audit.css",import.meta.url),"utf8");
 assert.match(legacy,/\.pager>button:first-child,[\s\S]*?\.pager>button:last-child\{[\s\S]*?height:50px!important/);
});
