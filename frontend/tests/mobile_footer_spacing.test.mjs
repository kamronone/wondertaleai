import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const polish=readFileSync(new URL("../src/reader-polish.css",import.meta.url),"utf8");
const base=readFileSync(new URL("../src/style.css",import.meta.url),"utf8");
const app=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");

test("mobile shell no longer stretches main and keeps only a single bottom-nav reservation",()=>{
  assert.match(base,/main\{[^}]*flex:1/);
  assert.match(polish,/\.shell\s*>\s*main\s*\{[^}]*flex:0 0 auto!important/s);
  assert.match(polish,/\.shell\s*\{[^}]*min-height:0!important/s);
  assert.match(polish,/padding-bottom:calc\(76px \+ env\(safe-area-inset-bottom, 0px\)\)!important/);
  assert.match(polish,/\.shell\s*>\s*main\s*\{[^}]*padding-bottom:12px!important/s);
  assert.match(polish,/\.shell\s*>\s*footer\s*\{[^}]*margin:0!important/s);
});

test("mobile footer follows content while the navigation stays fixed",()=>{
  assert.match(app,/return <div className="shell">/);
  assert.match(app,/<main>/);
  assert.match(app,/<footer className="site-legal-footer">/);
  assert.match(app, /<nav aria-label=\{/);
  assert.match(app, /onClick=\{\(\)=>openLegal\("privacy"\)\}/);
  assert.match(polish,/\.shell \.mobile-tabbar\{[^}]*position:fixed!important/s);
  assert.match(polish,/\.reader-page \.pager\{margin-bottom:4px!important\}/);
});

test("print layout does not inherit mobile reserved space",()=>{
  assert.match(polish,/@media print\{\s*\.shell\{min-height:0!important;padding-bottom:0!important\}/);
});

test("empty mobile library does not reserve a second fixed-nav height",()=>{
  assert.match(polish,/\.shell\s*>\s*main\s*>\s*\.library-page\s*\{[^}]*padding-bottom:8px!important/s);
  assert.match(polish,/\.library-page\s*>\s*\.empty\s*\{[^}]*min-height:0!important/s);
  assert.match(polish,/\.library-page\s*>\s*\.empty\s*\{[^}]*height:auto!important/s);
  assert.match(polish,/\.library-page\s*>\s*\.empty\s*\{[^}]*padding:28px 16px!important/s);
});

test("creation wizard leaves no duplicate bottom tab bar gap",()=>{
  assert.match(polish,/\.shell\s*>\s*main\s*>\s*\.create-page\s*\{[^}]*padding-bottom:8px!important/s);
  assert.match(polish,/\.create-page\s*>\s*\.form-card\s*\{[^}]*min-height:0!important/s);
  assert.match(polish,/\.create-page\s*>\s*\.form-card\s*\{[^}]*margin-bottom:0!important/s);
  assert.match(polish,/\.create-page \.wizard-step-actions\{margin-bottom:0!important\}/);
});

test("reader toolbar anchors back button left and action icons right on mobile",()=>{
  assert.match(polish,/\.reader-page \.reader-toolbar\s*>\s*\.back-button\s*\{[^}]*justify-self:start!important/s);
  assert.match(polish,/\.reader-page \.reader-toolbar\s*>\s*\.reader-actions\s*\{[^}]*justify-self:end!important/s);
  assert.match(polish,/\.reader-page \.reader-toolbar\s*\{[^}]*grid-template-columns:minmax\(0,1fr\) auto!important/s);
});
test("reading session timer is absent from the visible reader layout",()=>{
  assert.doesNotMatch(app,/<ReadingSessionTimer\b/);
});

test("reader page removes the legacy 100px bottom padding on iPhone",()=>{
  assert.match(polish,/\.shell\s*>\s*main\s*>\s*\.reader-page\s*\{[^}]*padding-bottom:8px!important/s);
  assert.match(polish,/\.shell\s*>\s*main\s*>\s*\.reader-page\s*\{[^}]*min-height:0!important/s);
  assert.match(polish,/\.shell\s*>\s*main\s*>\s*\.reader-page \.pager\s*\{[^}]*margin-bottom:0!important/s);
});

test("creator action buttons use equal height, equal grid columns, and consistent typography",()=>{
  assert.match(polish,/\.create-page \.wizard-step-actions\s*\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/s);
  assert.match(polish,/\.create-page \.wizard-step-actions > \.primary-button,\s*\.create-page \.wizard-step-actions > \.secondary-button\s*\{[^}]*min-height:60px!important/s);
  assert.match(polish,/\.create-page \.wizard-step-actions > \.primary-button,\s*\.create-page \.wizard-step-actions > \.secondary-button\s*\{[^}]*height:60px!important/s);
  assert.match(polish,/\.create-page \.wizard-step-actions > button:only-child\s*\{[^}]*grid-column:2!important/s);
  assert.match(polish,/\.create-page \.wizard-step-actions > \.secondary-button\s*\{[^}]*background:#fff!important/s);
  assert.match(polish,/\.create-page \.wizard-step-actions > \.primary-button\s*\{[^}]*color:#fff!important/s);
});
