import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const styles=readFileSync(new URL("../src/reader-polish.css",import.meta.url),"utf8");

test("changing book page scrolls to story card rather than book header",()=>{
  assert.match(app,/storyPageRef\.current\?\.scrollIntoView\(\{behavior:"auto",block:"start"\}\)/);
  assert.match(app,/previous\?\.id===active\.id&&previous\.page!==page/);
  assert.doesNotMatch(app,/document\.querySelector\("\.reader-title"\)/);
  assert.doesNotMatch(app,/const pageElement=document\.querySelector/);
  assert.match(app,/\[tab,active\?\.id,page\]/);
});

test("switching tabs can still scroll to screen start",()=>{
  assert.match(app,/window\.scrollTo\(\{top:0,left:0,behavior:"instant"\}\);/);
  assert.match(app,/\},\[tab\]\);/);
});

test("mobile story images are bounded by viewport but page text is never clipped",()=>{
  assert.match(styles,/\.reader-page \.story-page-image img,\s*\.reader-page \.story-page-image > \.story-image-fallback\s*\{[^}]*max-height:min\(33dvh,240px\)/s);
  assert.match(styles,/\.reader-page \.story-page \.story-text\s*\{[^}]*line-height:1\.55/s);
  assert.match(styles,/\.reader-page \.story-page\.reader-font-normal \.story-text\s*\{[^}]*font-size:15px/s);
  assert.doesNotMatch(styles,/\.reader-page \.story-page \.story-text\s*\{[^}]*overflow:hidden/s);
});

test("pagination stays below the complete text and print images remain unrestricted",()=>{
  assert.match(app,/<div className="pager">/);
  assert.match(styles,/@media print\{\s*\.reader-page \.story-page-image img,\s*\.reader-page \.story-page-image > \.story-image-fallback\s*\{\s*max-height:none;/s);
});
