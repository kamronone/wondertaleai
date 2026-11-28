import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/mobile-nav-library-audit.css",import.meta.url),"utf8");
const lib=app.slice(app.indexOf('{tab==="library"&&'),app.indexOf('{tab==="reader"&&'));
const nav=app.slice(app.indexOf('className="mobile-tabbar"'),app.indexOf('</nav>',app.indexOf('className="mobile-tabbar"')));

test("four real route actions stay in a fixed safe-area-aware bottom menu",()=>{
  assert.match(app,/import "\.\/mobile-nav-library-audit\.css";/);
  for(const route of ['setTab("home")','setTab("library")','openCreate()','setTab("account")']){
    assert.ok(nav.includes(route),route);
  }
  assert.match(css,/\.shell > main > \.mobile-tabbar\s*\{[\s\S]*?position:fixed!important/);
  assert.match(css,/padding:7px 8px calc\(8px \+ env\(safe-area-inset-bottom, 0px\)\)!important/);
  assert.match(css,/min-height:51px!important/);
});
test("library filters have readable two-column buttons without side clipping",()=>{
  assert.match(lib,/className="library-filters library-concept-chips"/);
  assert.match(lib,/onClick=\{\(\)=>changeLibraryShelf\("favorites"\)\}/);
  assert.match(css,/\.library-concept-chips\s*\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
  assert.match(css,/\.library-concept-chips>button\s*\{[\s\S]*?min-height:45px!important/);
  assert.match(css,/white-space:normal!important/);
});
test("profile and reader keep independent safe padding and page controls",()=>{
  const reader=readFileSync(new URL("../src/reader-concept-four.css",import.meta.url),"utf8");
  assert.match(css,/\.shell > main > \.profile-concept-three\s*\{/);
  assert.match(reader,/bottom:calc\(78px \+ env\(safe-area-inset-bottom, 0px\)\)!important/);
});
