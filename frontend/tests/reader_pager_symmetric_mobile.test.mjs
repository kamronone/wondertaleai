import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/reader-library-responsive-audit.css",import.meta.url),"utf8");
const mobile=css.slice(css.indexOf("/* Symmetric iPhone pager:"));

test("phone reader pager gives previous and next identical sizes and alignment",()=>{
 assert.ok(mobile.length>500,"pager fix loaded");
 assert.match(mobile,/\.pager>button:first-child,\s*\.shell:has\(>main>\.reader-page\) \.reader-page \.pager>button:last-child\s*\{/);
 for(const rule of ["align-items:center!important","justify-content:center!important","align-self:stretch!important","justify-self:stretch!important","height:50px!important","min-height:50px!important","max-height:50px!important","border-radius:15px!important","transform:none!important"]){
   assert.ok(mobile.includes(rule),rule);
 }
 assert.match(mobile,/\.pager>button:disabled\s*\{\s*opacity:\.58!important/);
 assert.match(mobile,/grid-template-columns:minmax\(0,1fr\) 48px minmax\(0,1fr\)!important/);
});

test("reader navigation actions and page number remain unchanged",()=>{
 const a=app.slice(app.indexOf('<div className="pager"><button'),app.indexOf('{tab==="home"&&<section className="install-panel'));
 assert.match(a,/disabled=\{page===0\}/);
 assert.match(a,/onClick=\{\(\)=>setPage\(p=>Math\.max\(0,p-1\)\)\}/);
 assert.match(a,/className="pager-mobile-current"/);
 assert.match(a,/disabled=\{page===active\.pages\.length-1\}/);
 assert.match(a,/onClick=\{\(\)=>setPage\(p=>Math\.min\(active\.pages\.length-1,p\+1\)\)\}/);
});
