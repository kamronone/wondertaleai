import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/reader-polish.css",import.meta.url),"utf8");

test("library achievements are optional rather than dominating the library viewport",()=>{
 assert.match(app,/<details className="library-achievements-disclosure">/);
 assert.match(app,/<section className="reading-achievements"/);
 assert.doesNotMatch(app,/<details className="library-achievements-disclosure" open/);
 assert.match(css,/\.library-page \.library-achievements-disclosure>summary/);
});

test("continue reading reuses the current account library and existing openBook path",()=>{
 assert.match(app,/books\.some\(book=>typeof book\.lastPage==="number"&&book\.lastPage>0&&book\.lastPage<book\.pages\.length-1\)/);
 assert.match(app,/className="library-resume"/);
 assert.match(app,/onClick=\{\(\)=>openBook\(book\)\}/);
 assert.doesNotMatch(app,/wondertale_global_resume/);
});

test("character builder is collapsed but preserved with all validation",()=>{
 assert.match(app,/<details className="wizard-optional-character">/);
 assert.match(app,/<CharacterBuilder key=\{privateToken\?"private":"demo"\}/);
 assert.match(css,/\.create-page \.wizard-optional-character>summary/);
});

test("account plans are optional, without changing authentication or payments",()=>{
 assert.match(app,/<details className="account-plans-disclosure">/);
 assert.match(app,/<PricingPlans lang=\{lang\} api=\{API\} session=\{privateToken\}\/>/);
 assert.match(css,/\.account-plans-disclosure>summary/);
});

test("reader's focused mode hides secondary bedtime controls on phones",()=>{
 assert.match(css,/\.reader-page\.reader-focused \.bedtime-controls,/);
 assert.match(css,/\.reader-page\.reader-focused \.reader-display-settings\s*\{\s*display:none!important/s);
});
