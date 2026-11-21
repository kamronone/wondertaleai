import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const css=readFileSync(new URL("../src/reader-image-fullwidth.css",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const living=readFileSync(new URL("../src/reader-living-art.css",import.meta.url),"utf8");

test("unified art layout imports after old book themes",()=>{
 const book=app.indexOf('import "./reader-book-variants.css";');
 const full=app.indexOf('import "./reader-image-fullwidth.css";');
 const animated=app.indexOf('import "./reader-living-art.css";');
 assert.ok(book>=0 && full>book && animated>full);
});

test("mobile book pictures use one viewport-bounded stage regardless of source dimensions",()=>{
 assert.match(css,/@media screen and \(max-width:700px\)/);
 assert.match(css,/height:clamp\(230px,38svh,345px\)!important/);
 assert.match(css,/max-height:345px!important/);
 assert.match(css,/height:100%!important/);
 assert.match(css,/max-height:100%!important/);
 assert.match(css,/object-fit:contain!important/);
 assert.doesNotMatch(css,/object-fit:cover!important/);
 assert.doesNotMatch(css,/max-height:none!important/);
});

test("all four book modes and private illustrations fit the same mobile frame",()=>{
 for(const mode of ["spread","classic","storybook","simple"])
  assert.ok(css.includes(".story-page.book-style-"+mode+" .story-page-image"));
 assert.ok(css.includes(".story-page-image > div > img"));
 assert.ok(css.includes(".story-image-fallback"));
 assert.ok(css.includes("@media screen and (max-width:700px) and (max-height:650px)"));
});

test("sizing is responsive CSS only, never a global inline override",()=>{
 assert.match(app,/readerFullWidth=false/);
 assert.match(app,/wt-reader-picture/);
 assert.doesNotMatch(app,/node\.style\.setProperty\("height"/);
 assert.doesNotMatch(app,/node\.style\.setProperty\("max-height"/);
 const instances=app.match(/alt=\{t\.illustration\+" "\+\(page\+1\)\} readerFullWidth/g)||[];
 assert.equal(instances.length,2);
});

test("animated characters are never cropped by an additional image-zoom effect",()=>{
 assert.match(app,/animatedUrl&&failed===0\?"wt-character-gif":""/);
 assert.match(living,/> img\.wt-character-gif/);
 assert.match(living,/animation:none!important/);
 assert.match(living,/transform:none!important/);
});
