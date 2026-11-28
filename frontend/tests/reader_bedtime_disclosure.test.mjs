import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const style=readFileSync(new URL("../src/reader-book-variants.css",import.meta.url),"utf8");

test("optional bedtime controls are collapsed by default above the story title",()=>{
 const mode=app.indexOf('className="reader-mode-controls"');
 const bedtime=app.indexOf('<details className="reader-bedtime-disclosure">',mode);
 const controls=app.indexOf('className="bedtime-controls"',bedtime);
 const title=app.indexOf('className="reader-title"',controls);
 assert.ok(mode>=0&&bedtime>mode&&controls>bedtime&&title>controls);
 assert.doesNotMatch(app,/<details className="reader-bedtime-disclosure" open/);
 assert.match(app,/\{!readerFocusMode&&<details className="reader-bedtime-disclosure">/);
});

test("bedtime timer keeps 10/20 minute choices, cancel and night mode",()=>{
 assert.match(app,/\(\[10,20\] as const\)\.map\(minutes/);
 assert.match(app,/setBedtimeUntil\(Date\.now\(\)\+minutes\*60000\)/);
 assert.match(app,/setReaderNightMode\(true\)/);
 assert.match(app,/onClick=\{\(\)=>setBedtimeUntil\(null\)\}/);
 assert.match(app,/aria-pressed=\{bedtimeUntil!==null/);
});

test("expanded bedtime UI respects phone width and remains keyboard accessible",()=>{
 assert.match(style,/\.reader-page \.reader-bedtime-disclosure>summary\{/);
 assert.match(style,/\.reader-page \.reader-bedtime-disclosure \.bedtime-controls\{/);
 assert.match(style,/display:flex!important/);
 assert.match(style,/@media\(max-width:620px\)/);
 assert.match(style,/summary:focus-visible/);
});
