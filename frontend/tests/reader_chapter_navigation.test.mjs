import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const reader=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/reader-chapter-navigation.css",import.meta.url),"utf8");

test("long books get a native chapter chooser, short illustrated classics stay unchanged",()=>{
 assert.match(reader,/active\.pages\.length>=12&&<div className="wt-chapter-navigator"/);
 assert.match(reader,/id="wt-story-chapter-select"/);
 assert.match(reader,/value=\{page\}/);
 assert.match(reader,/readerStoryParts\(active\.pages\.length,lang\)\.map\(part=><optgroup/);
 assert.match(reader,/active\.pages\.slice\(part\.start,part\.end\+1\)\.map/);
 assert.match(reader,/value=\{part\.start\+index\}/);
 assert.match(reader,/\{part\.start\+index\+1\}/);
 assert.match(reader,/ru:"Перейти к главе"/);
 assert.match(reader,/uz:"Bobga ötiş"/);
 assert.match(reader,/en:"Go to chapter"/);
});

test("chapter selection stops audio, cancels page editing and guards page boundaries",()=>{
 assert.match(reader,/const target=Number\(event\.target\.value\)/);
 assert.match(reader,/!Number\.isInteger\(target\)\|\|target<0\|\|target>=active\.pages\.length/);
 assert.match(reader,/stopSpeech\(\);setEditingPage\(false\);setPage\(target\)/);
 assert.doesNotMatch(reader,/chapter\.text\.slice\(/);
});

test("chapter chooser is accessible and small enough for iPhone",()=>{
 assert.match(reader,/label htmlFor="wt-story-chapter-select"/);
 assert.match(reader,/aria-label=\{\(\{ru:"Выберите главу"/);
 assert.match(reader,/import "\.\/reader-chapter-navigation\.css"/);
 assert.match(css,/min-height:38px/);
 assert.match(css,/:focus-visible/);
 assert.match(css,/@media\(max-width:480px\)/);
 assert.doesNotMatch(css,/position:fixed/);
});
