import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const load=file=>readFileSync(new URL(file,import.meta.url),"utf8");
const brick=load("../src/BrickPassInteraction.tsx");
const gift=load("../src/StoryGiftInteraction.tsx");
const reply=load("../src/SceneReplyAudio.tsx");
const css=load("../src/scene-reply-audio.css");

test("iPhone brick drop uses final pointerup coordinates, not stale pointermove",()=>{
 assert.match(brick,/const rect=layer\.current\?\.getBoundingClientRect\(\)/);
 assert.match(brick,/const release=initial\.current&&rect&&rect\.width>0&&rect\.height>0/);
 assert.match(brick,/event\.clientX-initial\.current\.screenX/);
 assert.match(brick,/event\.clientY-initial\.current\.screenY/);
 assert.match(brick,/Math\.hypot\(release\.x-target\.x,release\.y-target\.y\)/);
 assert.match(brick,/if\(distance<\.17\)\{complete\(\);\}else\{move\(start\);\}/);
 assert.match(gift,/const releasePoint=origin\.current&&width>0&&height>0/);
});

test("audio reply touches do not turn a story page or interrupt a drag",()=>{
 assert.match(reply,/onPointerDown=\{event=>event\.stopPropagation\(\)\}/);
 assert.match(reply,/onPointerMove=\{event=>event\.stopPropagation\(\)\}/);
 assert.match(reply,/onPointerUp=\{event=>event\.stopPropagation\(\)\}/);
 for(const event of ["Start","Move","End","Cancel"])
  assert.match(reply,new RegExp("onTouch"+event+"=\\{event=>event\\.stopPropagation\\(\\)\\}"));
 assert.match(reply,/onClick=\{event=>\{event\.stopPropagation\(\);toggle\(\);\}\}/);
});

test("reply control remains inside small illustration, without hiding the answer",()=>{
 assert.match(css,/max-width:calc\(100% - 20px\)/);
 assert.match(css,/min-height:44px/);
 assert.match(css,/white-space:normal/);
 assert.match(css,/@media\(max-width:420px\)/);
 assert.match(css,/pointer-events:auto!important/);
 assert.match(brick,/className="wt-brick-speech" role="status" aria-live="polite"/);
 assert.match(gift,/className="wt-gift-speech" role="status" aria-live="polite"/);
});
