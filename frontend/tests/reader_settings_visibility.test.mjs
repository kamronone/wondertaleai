import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/reader-polish.css",import.meta.url),"utf8");

test("settings button toggles an accessible panel directly after mode controls",()=>{
  const mode=app.indexOf('className="reader-mode-controls"');
  const settings=app.indexOf('readerSettingsOpen&&!readerFocusMode&&<div id="reader-display-options"');
  const bedtime=app.indexOf('className="bedtime-controls"',mode);
  const title=app.indexOf('className="reader-title"',mode);
  assert.ok(mode>=0&&settings>mode&&bedtime>settings&&title>settings);
  assert.match(app,/aria-expanded=\{readerSettingsOpen\} aria-controls="reader-display-options"/);
  assert.match(app,/onClick=\{\(\)=>setReaderSettingsOpen\(v=>!v\)\}/);
});

test("mobile styles keep the expanded panel visible",()=>{
  assert.match(css,/\.reader-page \.reader-mode-controls \+ \.reader-display-settings\{/);
  assert.match(css,/display:flex!important/);
  assert.match(css,/button\[aria-expanded="true"\]/);
});

test("font size, book appearance and night modes are still real controls",()=>{
  assert.match(app,/onClick=\{\(\)=>setReaderFontScale\(size\)\}/);
  assert.match(app,/onClick=\{\(\)=>setReaderBookStyle\(variant\)\}/);
  assert.match(app,/\["spread","classic","storybook","simple"\] as const/);
  assert.match(app,/onClick=\{\(\)=>\{setReaderNightMode\(v=>!v\)/);
});
