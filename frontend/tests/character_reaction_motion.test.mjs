import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const component=read("../src/CharacterHotspot.tsx");
const animation=read("../src/character-reaction-motion.css");
const main=read("../src/main.tsx");

test("all eleven public classic character reactions have specific visual motions",()=>{
 const motions=[...component.matchAll(/^  "([a-z-]+):([1-8])": \{\s*motion:"([a-z]+)",/gm)];
 assert.equal(motions.length,11);
 const types=new Set(motions.map(match=>match[3]));
 assert.deepEqual([...types].sort(),["bloom","bow","cheer","dance","flutter","music","shine","wave"]);
 for(const effect of types)assert.ok(animation.includes(".wt-reaction-"+effect+" svg"),"Missing "+effect+" animation");
 assert.match(component,/MotionIcon size=\{26\}/);
 assert.match(component,/aria-hidden="true"/);
 assert.match(main,/import "\.\/character-reaction-motion.css"/);
});

test("feedback stays visible after the motion ends and never advances the book",()=>{
 assert.match(component,/visibleReaction&&point&&<div className="wt-character-reaction"/);
 assert.match(component,/setVisibleReaction\(value=>!value\)/);
 assert.match(component,/setVisibleReaction\(false\)/);
 assert.match(component,/role="status" aria-live="polite"/);
 assert.doesNotMatch(component,/nextPage|setPage|setActive|fetch\(|setTimeout|setInterval/);
 assert.match(animation,/pointer-events:none/);
 assert.match(animation,/animation:wt-reaction-halo 1700ms ease-out both/);
});

test("motion is decorative, respects reduced motion, and does not distort PNG or GIF",()=>{
 assert.match(animation,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(animation,/animation:none!important;opacity:0!important/);
 assert.match(animation,/@media print\{\.reader-page \.wt-character-reaction-fx\{display:none!important\}\}/);
 assert.doesNotMatch(animation,/\.wt-reader-picture\s*\{|object-fit|background-image:url|filter:invert/);
});
