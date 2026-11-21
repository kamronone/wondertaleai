import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/reader-mobile-v1.css",import.meta.url),"utf8");

test("character GIF controls do not cover the picture",()=>{
 const image=app.indexOf('className={"story-page-image reader-turn-image');
 const effects=app.indexOf('<div className="wt-art-effects"',image);
 const imageEnd=app.indexOf('</div></div>',effects);
 const row=app.indexOf('<div className="wt-motion-inline-row">',image);
 const storyText=app.indexOf('className="story-text reader-turn-text"',row);
 assert.ok(image>=0&&effects>image&&imageEnd>effects&&row>imageEnd&&storyText>row);
 assert.match(css,/\.wt-motion-inline-row \.wt-character-motion-control\{[^}]*position:static!important/s);
 assert.match(css,/max-width:100%/);
});
test("no empty row appears on pages without a character GIF",()=>{
 assert.match(app,/classicAnimatedPage\(\(active as DemoBook\)\.classicId,[\s\S]{0,220}page\)&&!reduceArtMotion/);
 assert.match(app,/bedtimeUntil===null&&\s*<div className="wt-motion-inline-row">/);
});
test("in-reader art remains inline and never reopens the removed zoom modal",()=>{
 assert.doesNotMatch(app,/createPortal|wt-reader-image-open|setZoomOpen/);
 assert.match(app,/wt-reader-picture/);
 assert.match(app,/wt-character-gif/);
});
