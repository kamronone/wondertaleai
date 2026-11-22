import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const brick=readFileSync(new URL("../src/BrickPassInteraction.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/brick-pass-interaction.css",import.meta.url),"utf8");

test("pig scene uses a movable brick on the image rather than a motion-toggle row",()=>{
 const picture=app.indexOf('className={"story-page-image reader-turn-image');
 const brickAt=app.indexOf('<BrickPassInteraction lang={lang} />',picture);
 const imageEnd=app.indexOf('<div key={active.id+":"+page+":text"}',picture);
 assert.ok(picture>=0 && brickAt>picture && imageEnd>brickAt);
 assert.doesNotMatch(app,/className="wt-motion-inline-row"/);
 assert.match(app,/className="wt-art-motion-toggle"/);
 assert.match(brick,/onPointerDown=\{onDown\}/);
 assert.match(brick,/onPointerUp=\{onUp\}/);
 assert.match(css,/touch-action:none!important/);
});
test("drag interaction is only shown on Three Little Pigs scene four",()=>{
 assert.match(app,/\(active as DemoBook\)\.classicId==="three-pigs"&&page===3/);
 assert.match(app,/!readerFocusMode&&!readerNightMode&&bedtimeUntil===null/);
 assert.match(brick,/if\(distance<\.17\)/);
});
test("in-reader art remains inline and never reopens the removed zoom modal",()=>{
 assert.doesNotMatch(app,/createPortal|wt-reader-image-open|setZoomOpen/);
 assert.match(app,/wt-reader-picture/);
 assert.match(app,/wt-character-gif/);
});
