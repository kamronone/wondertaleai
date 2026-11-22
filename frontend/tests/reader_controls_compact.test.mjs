import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/reader-controls-compact.css",import.meta.url),"utf8");
const settingsStart=app.indexOf('id="reader-display-options"');
const settingsEnd=app.indexOf('        </div>}\n        <div className="reader-title"',settingsStart);
const storyStart=app.indexOf('className="reader-audio-toolbar"',settingsEnd);
const storyEnd=app.indexOf('className="reader-finale"',storyStart);

test("reading has one primary playback action and two aligned secondary controls",()=>{
 assert.match(app,/import "\.\/reader-controls-compact\.css";/);
 assert.match(css,/\.reader-page \.reader-audio-toolbar\s*\{/);
 assert.match(css,/\.reader-page \.reader-mode-controls\s*\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
 assert.match(css,/\.reader-page \.reader-mode-controls > button\s*\{[\s\S]*?min-height:44px!important/);
 assert.match(app,/className="reader-audio-toolbar"><button type="button" onClick=\{speakPage\}/);
 assert.match(app,/className="reader-mode-controls"/);
});

test("edit page and refresh story live in settings, not loose buttons below page",()=>{
 assert.ok(settingsStart>=0 && settingsEnd>settingsStart && storyStart>settingsEnd);
 const settings=app.slice(settingsStart,settingsEnd);
 const story=app.slice(storyStart,storyEnd);
 assert.match(settings,/className="reader-edit-settings"/);
 assert.match(settings,/onClick=\{beginPageEdit\}/);
 assert.match(settings,/onClick=\{savePageEdit\}/);
 assert.match(settings,/onClick=\{upgradeClassicStory\}/);
 assert.doesNotMatch(story,/onClick=\{beginPageEdit\}/);
 assert.doesNotMatch(story,/onClick=\{upgradeClassicStory\}/);
});
test("safe iPhone layout keeps fixed page pager and bottom navigation",()=>{
 const prior=readFileSync(new URL("../src/reader-concept-four.css",import.meta.url),"utf8");
 assert.match(prior,/bottom:calc\(78px \+ env\(safe-area-inset-bottom, 0px\)\)!important/);
 assert.match(prior,/\.mobile-tabbar\s*\{\s*display:flex!important/);
 assert.match(css,/\.reader-page \.reader-display-settings\s*\{[\s\S]*?order:5!important/);
});
