import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/reader-polish.css",import.meta.url),"utf8");

test("final story page presents one set of optional activities",()=>{
  assert.match(app,/className="reader-finale"/);
  assert.match(app,/readerEndActivity,setReaderEndActivity/);
  assert.match(app,/readerEndActivity==="ending"/);
  assert.match(app,/readerEndActivity==="adventure"/);
  assert.match(app,/readerEndActivity==="game"/);
  assert.match(app,/setReaderEndActivity\(null\)/);
  assert.match(app,/aria-pressed=\{readerEndActivity==="game"\}/);
});

test("only the selected story activity shows its detailed panel",()=>{
  assert.match(app,/readerEndActivity==="ending"&&<div className="interactive-endings"/);
  assert.match(app,/readerEndActivity==="adventure"&&<StoryBranchQuest/);
  assert.match(app,/readerEndActivity==="game"&&<section className="reading-word-game"/);
  assert.match(app,/page===active\.pages\.length-1&&<section className="reader-finale"/);
});

test("mobile game answers and ending choices have equal height and safe text wrapping",()=>{
  assert.match(css,/\.reader-page \.reader-finale \.reading-word-choices\s*\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/s);
  assert.match(css,/\.reader-page \.reader-finale \.interactive-endings button,[\s\S]*?min-height:48px/);
  assert.match(css,/\.reader-page \.reader-finale \.reading-word-choices button[\s\S]*?overflow-wrap:anywhere/);
  assert.match(css,/@media screen and \(max-width:360px\)/);
});

test("sequel creation remains accessible to local demo books only",()=>{
  assert.match(app,/isDemoBook\(active\)&&<button type="button" className="sequel-action" onClick=\{continueAdventure\}/);
});
