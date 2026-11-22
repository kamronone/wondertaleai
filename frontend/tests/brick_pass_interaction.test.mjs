import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const scene=readFileSync(new URL("../src/BrickPassInteraction.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/brick-pass-interaction.css",import.meta.url),"utf8");

test("pig building scene allows dragging a brick directly on the illustration",()=>{
 assert.match(app,/import \{BrickPassInteraction\} from "\.\/BrickPassInteraction";/);
 assert.match(app,/import "\.\/brick-pass-interaction\.css";/);
 assert.match(app,/\(active as DemoBook\)\.classicId==="three-pigs"&&page===3/);
 assert.match(app,/<BrickPassInteraction lang=\{lang\} \/>/);
 assert.match(scene,/onPointerDown=\{onDown\}/);
 assert.match(scene,/onPointerMove=\{onMove\}/);
 assert.match(scene,/onPointerUp=\{onUp\}/);
 assert.match(scene,/setPointerCapture\(event\.pointerId\)/);
 assert.match(scene,/const distance=Math\.hypot/);
 assert.match(scene,/role="status" aria-live="polite"/);
 assert.match(css,/touch-action:none!important/);
 assert.match(css,/pointer-events:none!important/);
});

test("remove separate moving characters button from picture while preserving settings",()=>{
 assert.doesNotMatch(app,/className="wt-motion-inline-row"/);
 assert.doesNotMatch(app,/Qahramonlarni to'xtatish/);
 assert.match(app,/className="wt-art-motion-toggle"/);
 assert.match(app,/setReaderArtMotion\(motion\)/);
});

test("do not duplicate pig brick as button choices beneath the page text",()=>{
 assert.match(app,/!\(\(active as DemoBook\)\.classicId==="three-pigs"&&page===3\)&&<StorySceneInteraction/);
 assert.match(scene,/event\.key==="Enter"\|\|event\.key===" "/);
 assert.match(scene,/G‘ishtni cho‘chqachaga olib boring/);
});
