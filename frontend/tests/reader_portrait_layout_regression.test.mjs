import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const css=readFileSync(new URL("../src/reader-concept-four.css",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");

test("every book preset fills the compact frame rather than letterboxing a portrait",()=>{
  for(const preset of ["spread","classic","storybook","simple"]){
    assert.ok(css.includes(".story-page.book-style-"+preset+" .story-page-image:not(.reader-image-expanded) > img"),preset);
  }
  assert.match(css,/\.story-page-image:not\(\.reader-image-expanded\) > img,[\s\S]*?object-fit:cover!important;/);
  assert.match(css,/height:clamp\(205px,31svh,285px\)!important/);
});
test("expanded portrait artwork is full width and natural height, without blank viewport frame",()=>{
  for(const preset of ["spread","classic","storybook","simple"]){
    assert.ok(css.includes(".story-page.book-style-"+preset+" .story-page-image.reader-image-expanded > img"),preset);
  }
  assert.match(css,/\.story-page-image\.reader-image-expanded \{[\s\S]*?height:auto!important;[\s\S]*?max-height:none!important;/);
  assert.match(css,/\.story-page-image\.reader-image-expanded > img,[\s\S]*?width:100%!important;\s*height:auto!important;/);
  assert.match(css,/\.story-page-image\.reader-image-expanded > img,[\s\S]*?max-height:none!important;/);
  assert.match(app,/readerImageExpanded\?" reader-image-expanded":""/);
});
