import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const css=readFileSync(new URL("../src/reader-image-fullwidth.css",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");

test("full-width reader artwork styles load after original book themes",()=>{
 const old=app.indexOf('import "./reader-book-variants.css";');
 const paging=app.indexOf('import "./reader-page-turn.css";');
 const responsive=app.indexOf('import "./reader-image-fullwidth.css";');
 assert.ok(old>=0&&paging>old&&responsive>paging);
});

test("mobile portrait PNG keeps natural aspect ratio and fills card width",()=>{
 assert.match(css,/@media screen and \(max-width:700px\)/);
 assert.match(css,/width:100%!important/);
 assert.match(css,/height:auto!important/);
 assert.match(css,/max-height:none!important/);
 assert.match(css,/object-fit:contain!important/);
 assert.match(css,/aspect-ratio:auto!important/);
 assert.doesNotMatch(css,/object-fit:cover!important/);
});

test("all four book modes and private image wrappers are supported",()=>{
 for(const mode of ["spread","classic","storybook","simple"]){
  assert.ok(css.includes(".story-page.book-style-"+mode+" .story-page-image"));
 }
 assert.ok(css.includes(".story-page-image > div > img"));
 assert.ok(css.includes(".story-page-image .story-image-fallback"));
});

test("reader applies inline important sizing to defeat old mobile height limits",()=>{
  assert.match(app,/readerFullWidth=false/);
  assert.match(app,/node\.style\.setProperty\("max-height","none","important"\)/);
  assert.match(app,/node\.style\.setProperty\("width","100%","important"\)/);
  assert.match(app,/node\.style\.setProperty\("height","auto","important"\)/);
  assert.match(app,/node\.style\.setProperty\("object-fit","contain","important"\)/);
  const calls=app.match(/alt=\{t\.illustration\+" "\+\(page\+1\)\} readerFullWidth/g)||[];
  assert.equal(calls.length,2,"Both private fallback and local reader illustration must be full-width");
});
