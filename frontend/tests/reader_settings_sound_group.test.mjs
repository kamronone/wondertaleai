import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/reader-concept-four.css",import.meta.url),"utf8");

test("bedtime and ambience are inside the opened reading settings",()=>{
 const start=app.indexOf('id="reader-display-options"');
 const advanced=app.indexOf('className="reader-advanced-sound"',start);
 const close=app.indexOf('        </div>}\n        <div className="reader-title"',start);
 assert.ok(start>=0&&advanced>start&&close>advanced,"advanced controls must be within settings section");
 const section=app.slice(advanced,close);
 assert.match(section,/className=\{"reader-ambience-button"/);
 assert.match(section,/className="reader-bedtime-disclosure"/);
 assert.equal(app.match(/className="reader-bedtime-disclosure"/g)?.length,1);
 assert.equal(app.match(/className=\{"reader-ambience-button"/g)?.length,1);
});

test("story playback remains outside settings",()=>{
 const displayEnd=app.indexOf('        </div>}\n        <div className="reader-title"',app.indexOf('id="reader-display-options"'));
 const speech=app.indexOf('className="reader-audio-toolbar"',displayEnd);
 assert.ok(speech>displayEnd);
 assert.match(app.slice(speech,speech+320),/onClick=\{speakPage\}/);
});

test("sound panel stays compact and mobile accessible",()=>{
 assert.match(css,/\.reader-display-settings \.reader-advanced-sound\s*\{/);
 assert.match(css,/\.reader-advanced-sound > \.reader-ambience-button\s*\{[\s\S]*?min-height:44px!important/);
});
