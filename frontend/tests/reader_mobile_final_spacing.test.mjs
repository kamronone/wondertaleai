import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const mobile=readFileSync(new URL("../src/reader-mobile-v1.css",import.meta.url),"utf8");
const polish=readFileSync(new URL("../src/reader-polish.css",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");

test("only the shell reserves the bottom tabbar safe area",()=>{
 assert.match(polish,/\.shell\s*\{[^}]*padding-bottom:calc\(76px \+ env\(safe-area-inset-bottom, 0px\)\)!important/s);
 assert.match(mobile,/\.reader-page\{[^}]*padding-bottom:8px/s);
 assert.doesNotMatch(mobile,/padding-bottom:calc\(102px/);
 assert.match(polish,/\.shell > main > \.reader-page\{[^}]*padding-bottom:8px!important/s);
});
test("two mobile page-turn buttons balance around one nonwrapping counter",()=>{
 assert.match(app,/<div className="pager"><button disabled=\{page===0\}/);
 assert.match(app,/className="pager-mobile-current"/);
 assert.match(mobile,/\.reader-page \.pager\{[^}]*grid-template-columns:minmax\(0,1fr\) auto minmax\(0,1fr\)!important/s);
 assert.match(mobile,/\.reader-page \.pager>button\{[^}]*min-height:44px!important/s);
 assert.match(mobile,/\.reader-page \.pager>button\{[^}]*overflow-wrap:anywhere/s);
 assert.match(mobile,/\.reader-page \.pager-mobile-current\{[^}]*white-space:nowrap/s);
});
test("short iPhone widths remain readable without another row of oversized controls",()=>{
 assert.match(mobile,/@media screen and \(max-width:350px\)\{/);
 assert.match(mobile,/\.reader-page \.pager>button\{padding:8px 4px!important;font-size:11px!important\}/);
 assert.match(mobile,/\.reader-page \.reader-mode-controls>button/);
 assert.doesNotMatch(app,/wt-reader-image-open|createPortal|setZoomOpen/);
});
